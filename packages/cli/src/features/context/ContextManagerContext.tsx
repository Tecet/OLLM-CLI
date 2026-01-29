/**
 * Context Manager Context - React Integration
 *
 * Bridges the core ContextManager with React UI.
 *
 * Responsibilities:
 * - Initialize and manage core ContextManager lifecycle
 * - Expose context state to React components
 * - Provide actions for UI interactions
 * - Listen to core events and update UI state
 *
 * Does NOT:
 * - Calculate tiers (core does this)
 * - Build prompts (core does this)
 * - Manage VRAM (core does this)
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react';

import {
  MemoryLevel,
  createContextManager,
  HotSwapService,
  PromptRegistry,
  PromptModeManager,
  ContextAnalyzer,
  WorkflowManager,
  createSnapshotManager,
  createSnapshotStorage,
  SnapshotManager as PromptsSnapshotManager,
  ContextTier,
} from '@ollm/core';

import { getSessionManager } from './SessionManager.js';
import { SettingsService } from '../../config/settingsService.js';

import type {
  ContextConfig,
  ContextUsage,
  ContextSnapshot,
  VRAMInfo,
  ContextManagerInterface,
  ContextModelInfo,
  ContextMessage,
  ProviderAdapter,
  ModeType,
  ModeTransition,
  SnapshotManager as CoreSnapshotManager,
} from '@ollm/core';

// Global reference for CLI commands
let globalContextManager: ContextManagerActions | null = null;

/**
 * Get the global context manager instance (for CLI commands)
 */
export function getGlobalContextManager(): ContextManagerActions | null {
  return globalContextManager;
}

/**
 * Context manager state exposed to UI
 */
export interface ContextManagerState {
  usage: ContextUsage;
  vram: VRAMInfo | null;
  memoryLevel: MemoryLevel;
  active: boolean;
  compressing: boolean;
  snapshots: ContextSnapshot[];
  error: string | null;
  currentMode: ModeType;
  autoSwitchEnabled: boolean;
  currentTier: ContextTier;
  autoSizeEnabled: boolean;
}

/**
 * Context manager actions available to UI
 */
export interface ContextManagerActions {
  addMessage: (message: Omit<ContextMessage, 'id' | 'timestamp' | 'tokenCount'>) => Promise<void>;
  compress: () => Promise<void>;
  clear: () => Promise<void>;
  createSnapshot: () => Promise<ContextSnapshot>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  refreshSnapshots: () => Promise<void>;
  updateConfig: (config: Partial<ContextConfig>) => void;
  refreshVRAM: () => Promise<void>;
  getContext: () => Promise<ContextMessage[]>;
  resize: (size: number) => Promise<void>;
  hotSwap: (newSkills?: string[]) => Promise<void>;
  getSystemPrompt: () => string;
  on: (event: string, callback: (data: unknown) => void) => void;
  off: (event: string, callback: (data: unknown) => void) => void;
  getUsage: () => ContextUsage;
  getConfig: () => ContextConfig;
  getManager: () => ContextManagerInterface | null;
  reportInflightTokens: (delta: number) => void;
  clearInflightTokens: () => void;
  getModeManager: () => PromptModeManager | null;
  getSnapshotManager: () => CoreSnapshotManager | null;
  getWorkflowManager: () => WorkflowManager | null;
  getPromptsSnapshotManager: () => PromptsSnapshotManager | null;
  switchMode: (mode: ModeType) => void;
  switchModeExplicit: (mode: ModeType) => void;
  setAutoSwitch: (enabled: boolean) => void;
  getCurrentMode: () => ModeType;
  restoreModeHistory: (
    history: Array<{
      from: string;
      to: string;
      timestamp: string;
      trigger: 'auto' | 'manual' | 'tool' | 'explicit';
      confidence: number;
    }>
  ) => void;
  getModeHistory: () => Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }>;
  getTokenMetrics: () => {
    totalTokensCounted: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: string;
    recalculations: number;
    largestMessage: number;
    avgTokensPerMessage: number;
    uptimeSeconds: number;
  };
}

export interface ContextManagerContextValue {
  state: ContextManagerState;
  actions: ContextManagerActions;
}

const ContextManagerContext = createContext<ContextManagerContextValue | undefined>(undefined);

export interface ContextManagerProviderProps {
  children: ReactNode;
  sessionId: string;
  modelInfo: ContextModelInfo;
  config?: Partial<ContextConfig>;
  modelId: string;
  provider?: ProviderAdapter;
  onMemoryLevelChange?: (level: MemoryLevel) => void;
  onCompression?: () => void;
}

const DEFAULT_USAGE: ContextUsage = {
  currentTokens: 0,
  maxTokens: 4096,
  percentage: 0,
  vramUsed: 0,
  vramTotal: 0,
};

export function ContextManagerProvider({
  children,
  sessionId,
  modelInfo,
  config,
  modelId,
  provider,
  onMemoryLevelChange,
  onCompression,
}: ContextManagerProviderProps) {
  // State
  const [usage, setUsage] = useState<ContextUsage>(DEFAULT_USAGE);
  const [vram, _setVRAM] = useState<VRAMInfo | null>(null);
  const [memoryLevel, _setMemoryLevel] = useState<MemoryLevel>(MemoryLevel.NORMAL);
  const [active, setActive] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [snapshots, setSnapshots] = useState<ContextSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<ModeType>('assistant');
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false); // Disabled by default
  const [currentTier, setCurrentTier] = useState<ContextTier>(ContextTier.TIER_3_STANDARD);
  const [autoSizeEnabled, setAutoSizeEnabled] = useState(config?.autoSize ?? true);

  // Refs
  const managerRef = useRef<ContextManagerInterface | null>(null);
  const modeManagerRef = useRef<PromptModeManager | null>(null);
  const snapshotManagerRef = useRef<CoreSnapshotManager | null>(null);
  const workflowManagerRef = useRef<WorkflowManager | null>(null);
  const promptsSnapshotManagerRef = useRef<PromptsSnapshotManager | null>(null);
  const modeChangeCallbackRef = useRef<((transition: ModeTransition) => void) | null>(null);
  const sessionChangeCleanupRef = useRef<(() => void) | null>(null);

  // Initialize context manager
  useEffect(() => {
    const initManager = async () => {
      try {
        // Check for pending context size from SessionManager
        let effectiveConfig = config;
        try {
          const { getSessionManager } = await import('./SessionManager.js');
          const sessionManager = getSessionManager();
          const pendingSize = sessionManager.getPendingContextSize();
          
          if (pendingSize !== null) {
            console.log(`[ContextManagerContext] Using pending context size: ${pendingSize}`);
            effectiveConfig = {
              ...config,
              targetSize: pendingSize,
              autoSize: false, // Disable auto-size when user explicitly selects size
            };
          }
        } catch (error) {
          console.warn('[ContextManagerContext] Failed to check pending context size:', error);
        }

        // Create context manager
        const manager = createContextManager(sessionId, modelInfo, effectiveConfig);
        managerRef.current = manager;

        // Create mode manager
        const contextAnalyzer = new ContextAnalyzer();
        const modeManager = new PromptModeManager(contextAnalyzer);
        modeManagerRef.current = modeManager;

        // Create snapshot manager
        const path = await import('path');
        const os = await import('os');
        const modeSnapshotPath = path.join(os.homedir(), '.ollm', 'mode-snapshots');
        const snapshotStorage = createSnapshotStorage(modeSnapshotPath);
        const snapshotManager = createSnapshotManager(snapshotStorage, {
          enabled: true,
          maxCount: 10,
          autoCreate: true,
          autoThreshold: 0.8,
        });
        promptsSnapshotManagerRef.current = snapshotManager as unknown as PromptsSnapshotManager;

        // Create workflow manager
        const workflowManager = new WorkflowManager(modeManager);
        workflowManagerRef.current = workflowManager;

        // Create prompts snapshot manager
        const promptsSnapshotManager = new PromptsSnapshotManager({
          sessionId,
          storagePath: path.join(os.homedir(), '.ollm', 'mode-transition-snapshots'),
          maxCacheSize: 20,
          pruneAfterMs: 7200000, // 2 hours
        });
        await promptsSnapshotManager.initialize();
        promptsSnapshotManagerRef.current = promptsSnapshotManager;

        // Listen for mode changes
        const modeChangeCallback = (transition: ModeTransition) => {
          setCurrentMode(transition.to);
          console.log(
            `Mode changed: ${transition.from} → ${transition.to} (${transition.trigger})`
          );

          // Persist to settings
          SettingsService.getInstance().setMode(transition.to);

          // Update system prompt in core
          manager.setMode(transition.to as any);

          // Emit event for session manager
          manager.emit('mode-transition', {
            from: transition.from,
            to: transition.to,
            timestamp: transition.timestamp.toISOString(),
            trigger: transition.trigger,
            confidence: transition.confidence,
          });

          // Create transition snapshot if we have user messages
          const promptsSnapshotMgr = promptsSnapshotManagerRef.current;
          if (promptsSnapshotMgr && managerRef.current) {
            (async () => {
              try {
                const messages = await managerRef.current!.getMessages();
                const hasUserMessages = messages.some((m) => m.role === 'user');
                
                if (!hasUserMessages) {
                  console.log(`[ModeSnapshot] Skipping auto-transition snapshot (no user messages yet)`);
                  return;
                }

                console.log(`[ModeSnapshot] Creating snapshot for auto-transition: ${transition.from} → ${transition.to}`);
                
                const snapshot = promptsSnapshotMgr.createTransitionSnapshot(
                  transition.from,
                  transition.to,
                  {
                    messages: messages.map((m) => ({
                      role: m.role,
                      parts: [{ type: 'text', text: m.content }],
                    })),
                    activeSkills: modeManager.getActiveSkills(),
                    activeTools: [],
                    currentTask: undefined,
                  }
                );
                
                await promptsSnapshotMgr.storeSnapshot(snapshot, true);
                console.log(`[ModeSnapshot] Auto-transition snapshot created: ${snapshot.id}`);
              } catch (error) {
                console.error('[ModeSnapshot] Failed to capture transition snapshot:', error);
              }
            })();
          }
        };

        modeChangeCallbackRef.current = modeChangeCallback;
        modeManager.onModeChange(modeChangeCallback);

        // Listen for auto-switch changes
        modeManager.on('auto-switch-changed', (enabled: boolean) => {
          setAutoSwitchEnabled(enabled);
          SettingsService.getInstance().setAutoSwitch(enabled);
        });

        // Listen for tier changes
        manager.on('tier-changed', (data: unknown) => {
          const tierData = data as { tier?: ContextTier };
          if (tierData.tier !== undefined) {
            setCurrentTier(tierData.tier);
          }
        });

        // Listen for started event (contains initial tier)
        manager.on('started', (data: unknown) => {
          const startData = data as { tier?: ContextTier; autoSizeEnabled?: boolean };
          if (startData.tier !== undefined) {
            setCurrentTier(startData.tier);
          }
          if (startData.autoSizeEnabled !== undefined) {
            setAutoSizeEnabled(startData.autoSizeEnabled);
          }
        });

        // Listen for compression events
        manager.on('summarizing', () => setCompressing(true));
        manager.on('auto-summary-created', () => {
          setCompressing(false);
          setUsage(manager.getUsage());
        });
        manager.on('auto-summary-failed', (data) => {
          setCompressing(false);
          const reason =
            (data && (data as { reason?: unknown }).reason) ||
            (data && (data as { error?: unknown }).error
              ? String((data as { error?: unknown }).error)
              : null);
          if (reason) setError(`Auto-summary failed: ${reason}`);
        });
        manager.on('compressed', () => {
          setCompressing(false);
          setUsage(manager.getUsage());
        });

        // Listen for config updates
        manager.on('config-updated', (updatedConfig) => {
          const cfg = updatedConfig as ContextConfig;
          if (cfg.autoSize !== undefined) {
            setAutoSizeEnabled(cfg.autoSize);
          }
        });

        // Start the manager
        await manager.start();
        setActive(true);

        // Get initial usage
        setUsage(manager.getUsage());

        // Start in assistant mode
        const startMode = 'assistant';
        const savedAutoSwitch = false; // Force auto-switch OFF

        modeManager.forceMode(startMode as ModeType);
        modeManager.setAutoSwitch(savedAutoSwitch);

        setCurrentMode(startMode as ModeType);
        setAutoSwitchEnabled(savedAutoSwitch);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to initialize ContextManager:', message);
        setError(message);
        setActive(false);
      }
    };

    initManager();

    // Listen for session changes from SessionManager
    try {
      const sessionManager = getSessionManager();
      const cleanup = sessionManager.onSessionChange(async (newSessionId, newModel) => {
        console.log(`[ContextManagerContext] Session change detected: ${newSessionId} for model: ${newModel}`);
        
        // Stop old manager
        if (managerRef.current) {
          await managerRef.current.stop();
        }
        
        // Reinitialize with new session
        await initManager();
      });
      sessionChangeCleanupRef.current = cleanup;
    } catch (error) {
      console.warn('[ContextManagerContext] SessionManager not initialized yet:', error);
    }

    // Cleanup
    return () => {
      if (managerRef.current) {
        managerRef.current.stop().catch(console.error);
        managerRef.current = null;
      }
      if (modeManagerRef.current && modeChangeCallbackRef.current) {
        modeManagerRef.current.offModeChange(modeChangeCallbackRef.current);
        modeManagerRef.current = null;
      }
      if (sessionChangeCleanupRef.current) {
        sessionChangeCleanupRef.current();
        sessionChangeCleanupRef.current = null;
      }
      modeChangeCallbackRef.current = null;
    };
  }, [sessionId, modelInfo, config]);

  // Update usage periodically
  useEffect(() => {
    if (!active || !managerRef.current) return;

    const updateUsage = () => {
      if (managerRef.current) {
        setUsage(managerRef.current.getUsage());
      }
    };

    const interval = setInterval(updateUsage, 2000);
    return () => clearInterval(interval);
  }, [active]);

  // Actions
  const addMessage = useCallback(
    async (message: Omit<ContextMessage, 'id' | 'timestamp' | 'tokenCount'>) => {
      if (!managerRef.current) {
        console.warn('ContextManager not initialized');
        return;
      }

      try {
        const fullMessage: ContextMessage = {
          ...message,
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
        };

        await managerRef.current.addMessage(fullMessage);
        setUsage(managerRef.current.getUsage());
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Failed to add message:', errorMsg);
        setError(errorMsg);
      }
    },
    []
  );

  const compress = useCallback(async () => {
    if (!managerRef.current) {
      console.warn('ContextManager not initialized');
      return;
    }

    try {
      setCompressing(true);
      onCompression?.();

      await managerRef.current.compress();
      setUsage(managerRef.current.getUsage());
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to compress context:', errorMsg);
      setError(errorMsg);
    } finally {
      setCompressing(false);
    }
  }, [onCompression]);

  const clear = useCallback(async () => {
    if (!managerRef.current) {
      console.warn('ContextManager not initialized');
      return;
    }

    try {
      await managerRef.current.clear();
      setUsage(managerRef.current.getUsage());
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to clear context:', errorMsg);
      setError(errorMsg);
    }
  }, []);

  const createSnapshotAction = useCallback(async (): Promise<ContextSnapshot> => {
    if (!managerRef.current) {
      throw new Error('ContextManager not initialized');
    }

    try {
      const snapshot = await managerRef.current.createSnapshot();
      const updatedSnapshots = await managerRef.current.listSnapshots();
      setSnapshots(updatedSnapshots);
      setError(null);
      return snapshot;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to create snapshot:', errorMsg);
      setError(errorMsg);
      throw err;
    }
  }, []);

  const restoreSnapshot = useCallback(async (snapshotId: string) => {
    if (!managerRef.current) {
      console.warn('ContextManager not initialized');
      return;
    }

    try {
      await managerRef.current.restoreSnapshot(snapshotId);
      setUsage(managerRef.current.getUsage());
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('Failed to restore snapshot:', errorMsg);
      setError(errorMsg);
    }
  }, []);

  const refreshSnapshots = useCallback(async () => {
    if (!managerRef.current) return;

    try {
      const updatedSnapshots = await managerRef.current.listSnapshots();
      setSnapshots(updatedSnapshots);
    } catch (err) {
      console.error('Failed to refresh snapshots:', err);
    }
  }, []);

  const updateConfig = useCallback((newConfig: Partial<ContextConfig>) => {
    if (!managerRef.current) {
      console.warn('ContextManager not initialized');
      return;
    }

    managerRef.current.updateConfig(newConfig);
    setUsage(managerRef.current.getUsage());
  }, []);

  const refreshVRAM = useCallback(async () => {
    // VRAM info is managed by core, just trigger a refresh if needed
  }, []);

  const getContext = useCallback(async () => {
    if (!managerRef.current) return [];
    return await managerRef.current.getMessages();
  }, []);

  const getSystemPrompt = useCallback(() => {
    return managerRef.current?.getSystemPrompt() || '';
  }, []);

  const resize = useCallback(async (size: number) => {
    if (!managerRef.current) return;

    console.log(`[ContextManagerContext] Resize to ${size} tokens, disabling auto-size`);

    managerRef.current.updateConfig({ targetSize: size, autoSize: false });
    setAutoSizeEnabled(false);

    const newUsage = managerRef.current.getUsage();
    setUsage(newUsage);
  }, []);

  const hotSwap = useCallback(
    async (newSkills?: string[]) => {
      if (!managerRef.current) return;
      if (!provider) {
        console.warn('HotSwap unavailable: No provider connected');
        return;
      }

      try {
        const promptRegistry = new PromptRegistry();
        const hotSwapService = new HotSwapService(
          managerRef.current,
          promptRegistry,
          provider,
          modelId,
          modeManagerRef.current || undefined,
          promptsSnapshotManagerRef.current || undefined
        );

        await hotSwapService.swap(newSkills);
        setUsage(managerRef.current.getUsage());
        setError(null);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Failed to hot swap:', errorMsg);
        setError(errorMsg);
      }
    },
    [provider, modelId]
  );

  const on = useCallback((event: string, callback: (data: unknown) => void) => {
    if (managerRef.current) {
      managerRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event: string, callback: (data: unknown) => void) => {
    if (managerRef.current) {
      managerRef.current.off(event, callback);
    }
  }, []);

  const getModeManager = useCallback(() => modeManagerRef.current, []);
  const getSnapshotManager = useCallback(() => snapshotManagerRef.current, []);
  const getWorkflowManager = useCallback(() => workflowManagerRef.current, []);
  const getPromptsSnapshotManager = useCallback(() => promptsSnapshotManagerRef.current, []);

  const switchModeExplicit = useCallback((mode: ModeType) => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
      return;
    }

    const previousMode = modeManagerRef.current.getCurrentMode();
    
    // Create snapshot before switching (if we have messages)
    if (promptsSnapshotManagerRef.current && managerRef.current) {
      (async () => {
        try {
          const messages = await managerRef.current!.getMessages();
          const hasUserMessages = messages.some((m) => m.role === 'user');
          
          if (hasUserMessages) {
            console.log(`[ModeSnapshot] Creating snapshot for explicit switch: ${previousMode} → ${mode}`);
            
            const snapshot = promptsSnapshotManagerRef.current!.createTransitionSnapshot(
              previousMode,
              mode,
              {
                messages: messages.map((m) => ({
                  role: m.role,
                  parts: [{ type: 'text', text: m.content }],
                })),
                activeSkills: modeManagerRef.current?.getActiveSkills() || [],
                activeTools: [],
                currentTask: undefined,
              }
            );
            
            await promptsSnapshotManagerRef.current!.storeSnapshot(snapshot, true);
            console.log(`[ModeSnapshot] Snapshot created: ${snapshot.id}`);
          } else {
            console.log(`[ModeSnapshot] Skipping snapshot (no user messages yet)`);
          }
        } catch (error) {
          console.error('[ModeSnapshot] Failed to capture explicit transition snapshot:', error);
        }
      })();
    }

    modeManagerRef.current.switchMode(mode, 'explicit', 1.0);
    setCurrentMode(mode);
    setAutoSwitchEnabled(false);
    managerRef.current?.setMode?.(mode as any);

    SettingsService.getInstance().setMode(mode);
    SettingsService.getInstance().setAutoSwitch(false);
  }, []);

  const switchMode = useCallback((mode: ModeType) => {
    // Delegate to switchModeExplicit for backward compatibility
    switchModeExplicit(mode);
  }, [switchModeExplicit]);

  const setAutoSwitchAction = useCallback((enabled: boolean) => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
      return;
    }

    modeManagerRef.current.setAutoSwitch(enabled);
    setAutoSwitchEnabled(enabled);
    SettingsService.getInstance().setAutoSwitch(enabled);
  }, []);

  const getCurrentModeAction = useCallback(() => {
    return modeManagerRef.current?.getCurrentMode() || 'assistant';
  }, []);

  const restoreModeHistoryAction = useCallback(
    (
      history: Array<{
        from: string;
        to: string;
        timestamp: string;
        trigger: 'auto' | 'manual' | 'tool' | 'explicit';
        confidence: number;
      }>
    ) => {
      if (!modeManagerRef.current) {
        console.warn('PromptModeManager not initialized');
        return;
      }

      modeManagerRef.current.restoreModeHistory(history);
      const currentMode = modeManagerRef.current.getCurrentMode();
      setCurrentMode(currentMode);
    },
    []
  );

  const getModeHistoryAction = useCallback(() => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
      return [];
    }

    return modeManagerRef.current.getSerializableModeHistory();
  }, []);

  // Memory level change effect
  useEffect(() => {
    onMemoryLevelChange?.(memoryLevel);
  }, [memoryLevel, onMemoryLevelChange]);

  const state: ContextManagerState = {
    usage,
    vram,
    memoryLevel,
    active,
    compressing,
    snapshots,
    error,
    currentMode,
    autoSwitchEnabled,
    currentTier,
    autoSizeEnabled,
  };

  const actions: ContextManagerActions = useMemo(
    () => ({
      addMessage,
      compress,
      clear,
      createSnapshot: createSnapshotAction,
      restoreSnapshot,
      refreshSnapshots,
      updateConfig,
      refreshVRAM,
      getContext,
      resize,
      hotSwap,
      getSystemPrompt,
      on,
      off,
      getUsage: () => managerRef.current?.getUsage() || DEFAULT_USAGE,
      getConfig: () => {
        if (!managerRef.current) throw new Error('ContextManager not initialized');
        return managerRef.current.config;
      },
      getManager: () => managerRef.current,
      getModeManager,
      getSnapshotManager,
      getWorkflowManager,
      getPromptsSnapshotManager,
      switchMode,
      switchModeExplicit,
      setAutoSwitch: setAutoSwitchAction,
      getCurrentMode: getCurrentModeAction,
      restoreModeHistory: restoreModeHistoryAction,
      getModeHistory: getModeHistoryAction,
      reportInflightTokens: (delta: number) => managerRef.current?.reportInflightTokens(delta),
      clearInflightTokens: () => managerRef.current?.clearInflightTokens(),
      getTokenMetrics: () =>
        managerRef.current?.getTokenMetrics() || {
          totalTokensCounted: 0,
          cacheHits: 0,
          cacheMisses: 0,
          cacheHitRate: '0%',
          recalculations: 0,
          largestMessage: 0,
          avgTokensPerMessage: 0,
          uptimeSeconds: 0,
        },
    }),
    [
      addMessage,
      compress,
      clear,
      createSnapshotAction,
      restoreSnapshot,
      refreshSnapshots,
      updateConfig,
      refreshVRAM,
      getContext,
      resize,
      hotSwap,
      getSystemPrompt,
      on,
      off,
      getModeManager,
      getSnapshotManager,
      getWorkflowManager,
      getPromptsSnapshotManager,
      switchMode,
      switchModeExplicit,
      setAutoSwitchAction,
      getCurrentModeAction,
      restoreModeHistoryAction,
      getModeHistoryAction,
    ]
  );

  // Update global reference
  useEffect(() => {
    if (managerRef.current && active) {
      globalContextManager = actions;
      console.log('[ContextManagerContext] Global manager set');
    }
    return () => {
      // Keep global manager during cleanup to avoid race conditions
    };
  }, [actions, active]);

  return (
    <ContextManagerContext.Provider value={{ state, actions }}>
      {children}
    </ContextManagerContext.Provider>
  );
}

/**
 * Hook to access the context manager
 */
export function useContextManager(): ContextManagerContextValue {
  const context = useContext(ContextManagerContext);
  if (!context) {
    throw new Error('useContextManager must be used within a ContextManagerProvider');
  }
  return context;
}

/**
 * Hook to get just the context usage (convenience)
 */
export function useContextUsage(): ContextUsage {
  const { state } = useContextManager();
  return state.usage;
}

/**
 * Hook to get memory status (convenience)
 */
export function useMemoryStatus(): { level: MemoryLevel; percentage: number } {
  const { state } = useContextManager();
  return {
    level: state.memoryLevel,
    percentage: state.usage.percentage,
  };
}
