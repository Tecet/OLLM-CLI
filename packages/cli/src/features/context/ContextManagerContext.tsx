/**
 * Context Manager Context
 * 
 * React context that integrates the core ContextManager with the CLI UI.
 * Provides:
 * - VRAM-aware automatic context sizing
 * - Token counting and usage tracking
 * - Context compression triggers
 * - Snapshot creation and restoration
 * - Memory guard status
 * 
 * This bridges the @ollm/core context management system with React components.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode, useMemo } from 'react';

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
} from '@ollm/core';

import { createLogger } from '../../../../core/src/utils/logger.js';
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
  SnapshotConfig as _SnapshotConfig,
  SnapshotStorage as _SnapshotStorage,
 SnapshotManager as CoreSnapshotManager } from '@ollm/core';

const logger = createLogger('ContextManagerContext');




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
  /** Current context usage statistics */
  usage: ContextUsage;
  
  /** Current VRAM information */
  vram: VRAMInfo | null;
  
  /** Current memory level (normal, warning, critical, emergency) */
  memoryLevel: MemoryLevel;
  
  /** Whether context manager is active */
  active: boolean;
  
  /** Whether compression is in progress */
  compressing: boolean;
  
  /** List of available snapshots */
  snapshots: ContextSnapshot[];
  
  /** Error message if any operation failed */
  error: string | null;
  
  /** Current prompt mode */
  currentMode: ModeType;
  
  /** Whether auto-switching is enabled */
  autoSwitchEnabled: boolean;
  
  /** Current prompt tier (for display) */
  currentTier: string;
  
  /** Effective prompt tier (hardware capability tier) */
  effectivePromptTier: string;
  
  /** Actual context tier (based on context size) */
  actualContextTier: string;
  
  /** Whether auto-sizing is enabled */
  autoSizeEnabled: boolean;
  
  /** Hidden field to force re-renders */
  _forceUpdate?: number;
}

/**
 * Context manager actions available to UI
 */
export interface ContextManagerActions {
  /** Add a message to the context */
  addMessage: (message: Omit<ContextMessage, 'id' | 'timestamp' | 'tokenCount'>) => Promise<void>;
  
  /** Trigger manual context compression */
  compress: () => Promise<void>;
  
  /** Clear context (keeps system prompt) */
  clear: () => Promise<void>;
  
  /** Create a snapshot of current context */
  createSnapshot: () => Promise<ContextSnapshot>;
  
  /** Restore context from a snapshot */
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  
  /** Refresh snapshots list */
  refreshSnapshots: () => Promise<void>;
  
  /** Update context configuration */
  updateConfig: (config: Partial<ContextConfig>) => void;
  
  /** Refresh VRAM information */
  refreshVRAM: () => Promise<void>;

  /** Get current context state (messages and metadata) */
  getContext: () => Promise<ContextMessage[]>;

  /** Resize context to specific size */
  resize: (size: number) => Promise<void>;

  /** Perform context hot swap */
  hotSwap: (newSkills?: string[]) => Promise<void>;

  /** Get the current system prompt string */
  getSystemPrompt: () => string;

  /** Register event listener */
  on: (event: string, callback: (data: unknown) => void) => void;

  /** Unregister event listener */
  off: (event: string, callback: (data: unknown) => void) => void;

  /** Get current context usage directly */
  getUsage: () => ContextUsage;

  /** Get current configuration */
  getConfig: () => ContextConfig;

  /** Get raw manager instance (use with caution) */
  getManager: () => ContextManagerInterface | null;
  
  /** Report in-flight (streaming) token delta to the manager (can be positive or negative) */
  reportInflightTokens: (delta: number) => void;
  /** Clear in-flight token accounting */
  clearInflightTokens: () => void;
  
  /** Get the PromptModeManager instance */
  getModeManager: () => PromptModeManager | null;
  
  /** Get the SnapshotManager instance */
  getSnapshotManager: () => CoreSnapshotManager | null;
  
  /** Get the WorkflowManager instance */
  getWorkflowManager: () => WorkflowManager | null;
  /** Get the PromptsSnapshotManager instance */
  getPromptsSnapshotManager: () => PromptsSnapshotManager | null;
  
  /** Switch to a specific mode */
  switchMode: (mode: ModeType) => void;
  
  /** Switch to a specific mode with explicit trigger (bypasses focus mode check) */
  switchModeExplicit: (mode: ModeType) => void;
  
  /** Enable or disable auto-switching */
  setAutoSwitch: (enabled: boolean) => void;
  
  /** Get current mode */
  getCurrentMode: () => ModeType;
  
  /** Restore mode history from session (when resuming) */
  restoreModeHistory: (history: Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }>) => void;
  
  /** Get mode history for session persistence */
  getModeHistory: () => Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }>;
}

export interface ContextManagerContextValue {
  state: ContextManagerState;
  actions: ContextManagerActions;
}

const ContextManagerContext = createContext<ContextManagerContextValue | undefined>(undefined);

export interface ContextManagerProviderProps {
  children: ReactNode;
  
  /** Session ID for this context */
  sessionId: string;
  
  /** Model information for context sizing */
  modelInfo: ContextModelInfo;
  
  /** Custom configuration overrides */
  config?: Partial<ContextConfig>;
  
  /** Current model ID */
  modelId: string;

  /** LLM Provider Adapter */
  provider?: ProviderAdapter;
  
  /** Callback when memory level changes */
  onMemoryLevelChange?: (level: MemoryLevel) => void;
  
  /** Callback when compression is triggered */
  onCompression?: () => void;
}

/**
 * Default empty usage state
 */
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
  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(true);
  const [currentTier, setCurrentTier] = useState<string>('Tier 3');
  const [effectivePromptTier, setEffectivePromptTier] = useState<string>('Tier 3');
  const [actualContextTier, setActualContextTier] = useState<string>('Tier 3');
  const [autoSizeEnabled, setAutoSizeEnabled] = useState(true);
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0);

  // Refs to hold latest tier values for callbacks (avoids stale-closure issues)
  const currentTierRef = useRef(currentTier);
  const effectivePromptTierRef = useRef(effectivePromptTier);
  const actualContextTierRef = useRef(actualContextTier);

  useEffect(() => { currentTierRef.current = currentTier; }, [currentTier]);
  useEffect(() => { effectivePromptTierRef.current = effectivePromptTier; }, [effectivePromptTier]);
  useEffect(() => { actualContextTierRef.current = actualContextTier; }, [actualContextTier]);
  
  // Context manager reference
  const managerRef = useRef<ContextManagerInterface | null>(null);
  
  // Prompt mode manager reference
  const modeManagerRef = useRef<PromptModeManager | null>(null);
  
  // Snapshot manager reference
  const snapshotManagerRef = useRef<CoreSnapshotManager | null>(null);
  
  // Workflow manager reference
  const workflowManagerRef = useRef<WorkflowManager | null>(null);
  
  // Prompts Snapshot manager reference
  const promptsSnapshotManagerRef = useRef<PromptsSnapshotManager | null>(null);
  
  // Mode change callback reference for cleanup
  const modeChangeCallbackRef = useRef<((transition: ModeTransition) => void) | null>(null);
  
  // Initialize context manager
  useEffect(() => {
    const initManager = async () => {
      try {
        // Create context manager using the factory function
        const manager = createContextManager(sessionId, modelInfo, config);
        managerRef.current = manager;
        
        // Create PromptModeManager
        const contextAnalyzer = new ContextAnalyzer();
        const modeManager = new PromptModeManager(contextAnalyzer);
        
        modeManagerRef.current = modeManager;
        
        // Create SnapshotManager
        // Fix: Use user home directory for snapshots instead of CWD to avoid polluting workspace
        const path = await import('path');
        const os = await import('os');
        
        const modeSnapshotPath = path.join(os.homedir(), '.ollm', 'mode-snapshots');
        
        // FIX: Use createSnapshotManager and createSnapshotStorage, providing SnapshotConfig
        const snapshotStorage = createSnapshotStorage(modeSnapshotPath);
        const snapshotManager = createSnapshotManager(
          snapshotStorage,
          {
            enabled: true, // Enable snapshots for mode manager
            maxCount: 10,
            autoCreate: true,
            autoThreshold: 0.8 // Default threshold
          }
        );
        
        // Initialize the snapshot manager (no 'initialize' method on SnapshotManagerImpl)
        // Note: Type mismatch between context SnapshotManager and prompts SnapshotManager
        promptsSnapshotManagerRef.current = snapshotManager as unknown as PromptsSnapshotManager;
        
        // Create WorkflowManager
        const workflowManager = new WorkflowManager(modeManager);
        workflowManagerRef.current = workflowManager;
        
        // Create PromptsSnapshotManager (for mode transitions and HotSwapTool)
        const promptsSnapshotManager = new PromptsSnapshotManager({
          sessionId,
          storagePath: path.join(os.homedir(), '.ollm', 'mode-transition-snapshots'),
          maxCacheSize: 20, // Keep more mode snapshots
          pruneAfterMs: 7200000, // 2 hours
        });
        await promptsSnapshotManager.initialize();
        promptsSnapshotManagerRef.current = promptsSnapshotManager;
        
        // Listen for mode changes
        const modeChangeCallback = (transition: ModeTransition) => {
          setCurrentMode(transition.to);
          logger.info(`Mode changed: ${transition.from} → ${transition.to} (${transition.trigger})`);
          
          // Persist mode changes to settings (for both auto and manual)
          SettingsService.getInstance().setMode(transition.to);
          
          // Update system prompt in ContextManager via core routing
          manager.setMode(transition.to as any);
          
          // Save mode history to session metadata (Subtask 17.5)
          // Note: This will be integrated when ChatRecordingService is available in the context
          // For now, we emit an event that can be listened to by the session manager
          manager.emit('mode-transition', {
            from: transition.from,
            to: transition.to,
            timestamp: transition.timestamp.toISOString(),
            trigger: transition.trigger,
            confidence: transition.confidence
          });

          const promptsSnapshotManager = promptsSnapshotManagerRef.current;
          if (promptsSnapshotManager && managerRef.current) {
            (async () => {
              try {
                const messages = await managerRef.current!.getMessages();
                const hasUserMessages = messages.some(m => m.role === 'user');
                if (!hasUserMessages) {
                  return;
                }

                const snapshot = promptsSnapshotManager.createTransitionSnapshot(
                  transition.from,
                  transition.to,
                  {
                    messages: messages.map(m => ({
                      role: m.role,
                      parts: [{ type: 'text', text: m.content }]
                    })),
                    activeSkills: modeManager.getActiveSkills(),
                    activeTools: [],
                    currentTask: undefined
                  }
                );
                await promptsSnapshotManager.storeSnapshot(snapshot, true);
              } catch (error) {
                logger.error('[ModeSnapshot] Failed to capture transition snapshot:', error);
              }
            })();
          }
        };
        
        modeChangeCallbackRef.current = modeChangeCallback;
        modeManager.onModeChange(modeChangeCallback);
        
        // Listen for auto-switch changes
        const autoSwitchChangeCallback = (enabled: boolean) => {
          setAutoSwitchEnabled(enabled);
          logger.info(`Auto-switch ${enabled ? 'enabled' : 'disabled'}`);
          
          // Persist auto-switch preference to settings
          SettingsService.getInstance().setAutoSwitch(enabled);
        };
        
        modeManager.on('auto-switch-changed', autoSwitchChangeCallback);
        
        // Listen for tier changes to update UI (Subtask: Display prompt tier in side panel)
        // IMPORTANT: Register this BEFORE calling manager.start() so we catch the initial 'started' event
        const tierChangeCallback = async (data: unknown) => {
          const fs = await import('fs');
          fs.appendFileSync('context-debug.log', `[${new Date().toISOString()}] TIER CHANGE EVENT: ${JSON.stringify(data)}\n`);
          
          logger.info('[UI] ===== TIER CHANGE EVENT RECEIVED =====');
          logger.info('[UI] Event data:', data);
          
          const tierData = data as {
            tier?: string | number;
            effectivePromptTier?: string | number;
            actualContextTier?: string | number;
          };
          
          // Convert tier to display string (handles both number and string formats)
          const tierToString = (tier: string | number | undefined): string => {
            if (tier === undefined) return 'Unknown';
            
            // If it's already a string like "2-4K", convert to "Tier 1"
            if (typeof tier === 'string') {
              const tierMap: Record<string, string> = {
                '2-4K': 'Tier 1',
                '8K': 'Tier 2',
                '16K': 'Tier 3',
                '32K': 'Tier 4',
                '64K+': 'Tier 5'
              };
              return tierMap[tier] || `Tier ${tier}`;
            }
            
            // If it's a number, convert to "Tier X"
            return `Tier ${tier}`;
          };
          
          logger.info('[UI] Before state updates:');
          logger.info('[UI]   currentTier:', currentTierRef.current);
          logger.info('[UI]   effectivePromptTier:', effectivePromptTierRef.current);
          logger.info('[UI]   actualContextTier:', actualContextTierRef.current);
          
          // Update currentTier (use tier if available, otherwise use effectivePromptTier)
          const newCurrentTier = tierData.tier !== undefined 
            ? tierToString(tierData.tier)
            : tierData.effectivePromptTier !== undefined
            ? tierToString(tierData.effectivePromptTier)
            : currentTierRef.current;

          if (newCurrentTier !== currentTierRef.current) {
            logger.info('[UI] Setting currentTier to:', newCurrentTier);
            setCurrentTier(newCurrentTier);
          }
          
          if (tierData.effectivePromptTier !== undefined) {
            const newEffective = tierToString(tierData.effectivePromptTier);
            logger.info('[UI] Setting effectivePromptTier to:', newEffective);
            setEffectivePromptTier(newEffective);
          }
          if (tierData.actualContextTier !== undefined) {
            const newActual = tierToString(tierData.actualContextTier);
            logger.info('[UI] Setting actualContextTier to:', newActual);
            setActualContextTier(newActual);
          }
          
          // Force a re-render to ensure UI updates
          setForceUpdateCounter(prev => prev + 1);
          
          logger.info(`[UI] Tier changed: Current=${newCurrentTier}, Effective=${tierToString(tierData.effectivePromptTier)}, Actual=${tierToString(tierData.actualContextTier)}`);
          logger.info('[UI] ===== TIER CHANGE EVENT END =====');
        };
        
        manager.on('tier-changed', tierChangeCallback);
        manager.on('started', tierChangeCallback); // Also listen to started event for initial tier
        
        // Start the context manager (this will emit 'started' event which we now catch)
        await manager.start();
        setActive(true);
        // Listen for summarization/compression lifecycle events to update UI state
        manager.on('summarizing', () => {
          setCompressing(true);
        });
        manager.on('auto-summary-created', () => {
          setCompressing(false);
          setUsage(manager.getUsage());
        });
        manager.on('auto-summary-failed', (data) => {
          setCompressing(false);
          const reason = (data && (data as { reason?: unknown }).reason) || ((data && (data as { error?: unknown }).error) ? String((data as { error?: unknown }).error) : null);
          if (reason) setError(`Auto-summary failed: ${reason}`);
        });
        manager.on('compressed', () => {
          setCompressing(false);
          setUsage(manager.getUsage());
        });
        
        // Get initial usage
        setUsage(manager.getUsage());
        
        // Always start in assistant mode for a fresh session, regardless of saved preference
        // This ensures safety guards are active and the user starts with a clean slate.
        const settingsService = SettingsService.getInstance();
        const startMode = 'assistant';
        const savedAutoSwitch = settingsService.getAutoSwitch();
        
        // Set the mode
        modeManager.forceMode(startMode as ModeType);
        
        // Restore auto-switch preference
        modeManager.setAutoSwitch(savedAutoSwitch);
        
        // Update state
        setCurrentMode(startMode as ModeType);
        setAutoSwitchEnabled(savedAutoSwitch);
        
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to initialize ContextManager:', message);
        setError(message);
        setActive(false);
      }
    };
    
    initManager();
    
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
      if (snapshotManagerRef.current) {
        // No clearCache() method on CoreSnapshotManager (SnapshotManagerImpl)
      // snapshotManagerRef.current.clearCache(); // Removed due to type mismatch
        snapshotManagerRef.current = null;
      }
      modeChangeCallbackRef.current = null;
    };
  }, [sessionId, modelInfo, config]);
  
  // Update usage periodically when active
  useEffect(() => {
    if (!active || !managerRef.current) return;
    
    const updateUsage = () => {
      if (managerRef.current) {
        setUsage(managerRef.current.getUsage());
      }
    };
    
    // Update every 2 seconds
    const interval = setInterval(updateUsage, 2000);
    // const interval = undefined; // TEMPORARY: Disable usage polling
    
    return () => clearInterval(interval);
  }, [active]);
  
  // Add message action
  const addMessage = useCallback(async (message: Omit<ContextMessage, 'id' | 'timestamp' | 'tokenCount'>) => {
    if (!managerRef.current) {
      logger.warn('ContextManager not initialized');
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
      logger.error('Failed to add message:', errorMsg);
      setError(errorMsg);
    }
  }, []);
  
  // Compress context action
  const compress = useCallback(async () => {
    if (!managerRef.current) {
      logger.warn('ContextManager not initialized');
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
      logger.error('Failed to compress context:', errorMsg);
      setError(errorMsg);
    } finally {
      setCompressing(false);
    }
  }, [onCompression]);
  
  // Clear context action
  const clear = useCallback(async () => {
    if (!managerRef.current) {
      logger.warn('ContextManager not initialized');
      return;
    }
    
    try {
      await managerRef.current.clear();
      setUsage(managerRef.current.getUsage());
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to clear context:', errorMsg);
      setError(errorMsg);
    }
  }, []);
  
  // Create snapshot action
  const createSnapshotAction = useCallback(async (): Promise<ContextSnapshot> => {
    if (!managerRef.current) {
      throw new Error('ContextManager not initialized');
    }
    
    try {
      const snapshot = await managerRef.current.createSnapshot();
      
      // Refresh snapshots list
      const updatedSnapshots = await managerRef.current.listSnapshots();
      setSnapshots(updatedSnapshots);
      
      setError(null);
      return snapshot;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to create snapshot:', errorMsg);
      setError(errorMsg);
      throw err;
    }
  }, []);
  
  // Restore snapshot action
  const restoreSnapshot = useCallback(async (snapshotId: string) => {
    if (!managerRef.current) {
      logger.warn('ContextManager not initialized');
      return;
    }
    
    try {
      await managerRef.current.restoreSnapshot(snapshotId);
      setUsage(managerRef.current.getUsage());
      setError(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to restore snapshot:', errorMsg);
      setError(errorMsg);
    }
  }, []);
  
  // Refresh snapshots action
  const refreshSnapshots = useCallback(async () => {
    if (!managerRef.current) return;
    
    try {
      const updatedSnapshots = await managerRef.current.listSnapshots();
      setSnapshots(updatedSnapshots);
    } catch (err) {
      logger.error('Failed to refresh snapshots:', err);
    }
  }, []);
  
  // Update config action
  const updateConfig = useCallback((newConfig: Partial<ContextConfig>) => {
    if (!managerRef.current) {
      logger.warn('ContextManager not initialized');
      return;
    }
    
    managerRef.current.updateConfig(newConfig);
    setUsage(managerRef.current.getUsage());
  }, []);
  
  // Refresh VRAM action
  const refreshVRAM = useCallback(async () => {
    // This would need to be integrated with the VRAMMonitor
    // For now, we rely on GPUContext for VRAM info
  }, []);

  // Get current context
  const getContext = useCallback(async () => {
    if (!managerRef.current) return [];
    // Use getMessages from the core manager
    return await managerRef.current.getMessages();
  }, []);
  
  const getSystemPrompt = useCallback(() => {
    return managerRef.current?.getSystemPrompt() || '';
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
    effectivePromptTier,
    actualContextTier,
    autoSizeEnabled,
    _forceUpdate: forceUpdateCounter, // Hidden field to force re-renders
  };
  
  // Resize action
  const resize = useCallback(async (size: number) => {
    if (!managerRef.current) return;
    
    const fs = await import('fs');
    const logMsg = `[${new Date().toISOString()}] ===== RESIZE CALLED =====\nTarget size: ${size} tokens\n`;
    fs.appendFileSync('context-debug.log', logMsg);
    
    logger.info(`[ContextManagerContext] ===== RESIZE CALLED =====`);
    logger.info(`[ContextManagerContext] Target size: ${size} tokens`);
    logger.info(`[ContextManagerContext] Disabling auto-size`);
    
    // Update config which will trigger internal resize
    managerRef.current.updateConfig({ targetSize: size, autoSize: false });
    
    // Update local state to reflect manual mode
    setAutoSizeEnabled(false);
    
    // Persist settings
    SettingsService.getInstance().setContextSize(size);

    const newUsage = managerRef.current.getUsage();
    setUsage(newUsage);
    
    fs.appendFileSync('context-debug.log', `Resize complete. New usage: ${JSON.stringify(newUsage)}\n`);
    
    logger.info(`[ContextManagerContext] Resize complete`);
    logger.info(`[ContextManagerContext] New usage:`, newUsage);
    logger.info(`[ContextManagerContext] ===== RESIZE END =====`);
  }, []);

  // Hot Swap Action
  const hotSwap = useCallback(async (newSkills?: string[]) => {
    if (!managerRef.current) return;
    if (!provider) {
        logger.warn('HotSwap unavailable: No provider connected');
        return;
    }

    try {
        const promptRegistry = new PromptRegistry(); // Or get global instance
        // Initialize HotSwapService
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
        logger.error('Failed to hot swap:', errorMsg);
        setError(errorMsg);
    }
  }, [provider, modelId]);

  // Event listener registration
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
  
  // Mode management actions
  const getModeManager = useCallback(() => {
    return modeManagerRef.current;
  }, []);
  
  const getSnapshotManager = useCallback(() => {
    return snapshotManagerRef.current;
  }, []);
  
  const getWorkflowManager = useCallback(() => {
    return workflowManagerRef.current;
  }, []);
  
  const switchMode = useCallback((mode: ModeType) => {
    if (!modeManagerRef.current) {
      logger.warn('PromptModeManager not initialized');
      return;
    }
    
    modeManagerRef.current.forceMode(mode);
    setCurrentMode(mode);
    setAutoSwitchEnabled(false);
    managerRef.current?.setMode?.(mode as any);
    
    // Persist mode preference to settings
    SettingsService.getInstance().setMode(mode);
    SettingsService.getInstance().setAutoSwitch(false);
  }, []);
  
  const switchModeExplicit = useCallback((mode: ModeType) => {
    if (!modeManagerRef.current) {
      logger.warn('PromptModeManager not initialized');
      return;
    }
    
    // Use explicit trigger to bypass focus mode check
    modeManagerRef.current.switchMode(mode, 'explicit', 1.0);
    setCurrentMode(mode);
    setAutoSwitchEnabled(false);
    managerRef.current?.setMode?.(mode as any);
    
    // Persist mode preference to settings
    SettingsService.getInstance().setMode(mode);
    SettingsService.getInstance().setAutoSwitch(false);
  }, []);
  
  const setAutoSwitchAction = useCallback((enabled: boolean) => {
    if (!modeManagerRef.current) {
      logger.warn('PromptModeManager not initialized');
      return;
    }
    
    modeManagerRef.current.setAutoSwitch(enabled);
    setAutoSwitchEnabled(enabled);
    
    // Persist auto-switch preference to settings
    SettingsService.getInstance().setAutoSwitch(enabled);
  }, []);
  
  const getCurrentModeAction = useCallback(() => {
    return modeManagerRef.current?.getCurrentMode() || 'assistant';
  }, []);
  
  const restoreModeHistoryAction = useCallback((history: Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }>) => {
    if (!modeManagerRef.current) {
      logger.warn('PromptModeManager not initialized');
      return;
    }
    
    modeManagerRef.current.restoreModeHistory(history);
    
    // Update current mode state from restored history
    const currentMode = modeManagerRef.current.getCurrentMode();
    setCurrentMode(currentMode);
    
    logger.info(`Restored mode history with ${history.length} transitions, current mode: ${currentMode}`);
  }, []);
  
  const getModeHistoryAction = useCallback(() => {
    if (!modeManagerRef.current) {
      logger.warn('PromptModeManager not initialized');
      return [];
    }
    
    return modeManagerRef.current.getSerializableModeHistory();
  }, []);

  const getPromptsSnapshotManager = useCallback(() => {
    return promptsSnapshotManagerRef.current;
  }, []);

  const actions: ContextManagerActions = useMemo(() => ({
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
        if (!managerRef.current) throw new Error("ContextManager not initialized");
        return managerRef.current.config;
    },
    getManager: () => managerRef.current,
    getModeManager,
    getSnapshotManager,
    getWorkflowManager,
    getPromptsSnapshotManager, // Add this
    switchMode,
    switchModeExplicit,
    setAutoSwitch: setAutoSwitchAction,
    getCurrentMode: getCurrentModeAction,
    restoreModeHistory: restoreModeHistoryAction,
    getModeHistory: getModeHistoryAction,
    reportInflightTokens: (delta: number) => managerRef.current?.reportInflightTokens(delta),
    clearInflightTokens: () => managerRef.current?.clearInflightTokens(),
  }), [
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
    getPromptsSnapshotManager, // Add this
    switchMode,
    switchModeExplicit,
    setAutoSwitchAction,
    getCurrentModeAction,
    restoreModeHistoryAction,
    getModeHistoryAction,
  ]);
  
  // Update global reference
  useEffect(() => {
    if (active) {
      globalContextManager = actions;
    }
    return () => {
      globalContextManager = null;
    };
  }, [active, actions]);
  
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
