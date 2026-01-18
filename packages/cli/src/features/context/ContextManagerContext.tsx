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

// Import from @ollm/core using the aliased types
import {
  MemoryLevel,
  createContextManager,
  HotSwapService,
  PromptRegistry,
  PromptModeManager,
  ContextAnalyzer,
  ModeSnapshotManager,
  WorkflowManager,
} from '@ollm/core';

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
} from '@ollm/core';

import { SettingsService } from '../../config/settingsService.js';

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
  
  /** Set the system prompt */
  setSystemPrompt: (prompt: string) => void;

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
  
  /** Get the PromptModeManager instance */
  getModeManager: () => PromptModeManager | null;
  
  /** Get the SnapshotManager instance */
  getSnapshotManager: () => ModeSnapshotManager | null;
  
  /** Get the WorkflowManager instance */
  getWorkflowManager: () => WorkflowManager | null;
  
  /** Get the HybridModeManager instance */
  getHybridModeManager: () => import('@ollm/core').HybridModeManager | null;
  
  /** Switch to a hybrid mode */
  switchToHybridMode: (hybridMode: import('@ollm/core').HybridMode) => void;
  
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
  
  // Context manager reference
  const managerRef = useRef<ContextManagerInterface | null>(null);
  
  // Prompt mode manager reference
  const modeManagerRef = useRef<PromptModeManager | null>(null);
  
  // Snapshot manager reference
  const snapshotManagerRef = useRef<ModeSnapshotManager | null>(null);
  
  // Workflow manager reference
  const workflowManagerRef = useRef<WorkflowManager | null>(null);
  
  // Hybrid mode manager reference
  const hybridModeManagerRef = useRef<import('@ollm/core').HybridModeManager | null>(null);
  
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
        // Note: SystemPromptBuilder is created internally by ContextManager
        // We need to get the PromptRegistry and create the mode manager
        const promptRegistry = new PromptRegistry();
        const contextAnalyzer = new ContextAnalyzer();
        
        // For now, we'll create a simple SystemPromptBuilder wrapper
        // In a full implementation, this would be passed from ContextManager
        const systemPromptBuilder = {
          build: (config: any) => {
            // This is a simplified version - the real implementation
            // would use the actual SystemPromptBuilder from ContextManager
            return manager.getSystemPrompt();
          }
        };
        
        const modeManager = new PromptModeManager(
          systemPromptBuilder as any,
          promptRegistry,
          contextAnalyzer
        );
        
        modeManagerRef.current = modeManager;
        
        // Create SnapshotManager
        const snapshotManager = new ModeSnapshotManager({
          sessionId,
          storagePath: undefined, // Use default path
          maxCacheSize: 10,
          pruneAfterMs: 3600000, // 1 hour
        });
        
        // Initialize the snapshot manager
        await snapshotManager.initialize();
        
        snapshotManagerRef.current = snapshotManager;
        
        // Create WorkflowManager
        const workflowManager = new WorkflowManager(modeManager);
        workflowManagerRef.current = workflowManager;
        
        // Create HybridModeManager
        const { HybridModeManager } = await import('@ollm/core');
        const hybridModeManager = new HybridModeManager();
        hybridModeManagerRef.current = hybridModeManager;
        
        // Listen for mode changes
        const modeChangeCallback = (transition: ModeTransition) => {
          setCurrentMode(transition.to);
          console.log(`Mode changed: ${transition.from} → ${transition.to} (${transition.trigger})`);
          
          // Persist mode changes to settings (for both auto and manual)
          SettingsService.getInstance().setMode(transition.to);
          
          // Rebuild system prompt with new mode
          // Note: Tools and skills will be populated by the caller (ChatContext)
          // This ensures the prompt is updated even for automatic mode switches
          const newPrompt = modeManager.buildPrompt({
            mode: transition.to,
            tools: [], // Will be populated by ChatContext when available
            skills: modeManager.getActiveSkills(),
            workspace: undefined, // Will be populated by ChatContext when available
          });
          
          // Update system prompt in ContextManager
          manager.setSystemPrompt(newPrompt);
          
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
        };
        
        modeChangeCallbackRef.current = modeChangeCallback;
        modeManager.onModeChange(modeChangeCallback);
        
        // Listen for auto-switch changes
        const autoSwitchChangeCallback = (enabled: boolean) => {
          setAutoSwitchEnabled(enabled);
          console.log(`Auto-switch ${enabled ? 'enabled' : 'disabled'}`);
          
          // Persist auto-switch preference to settings
          SettingsService.getInstance().setAutoSwitch(enabled);
        };
        
        modeManager.on('auto-switch-changed', autoSwitchChangeCallback);
        
        // Start the context manager
        await manager.start();
        setActive(true);
        
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
        
        // Build initial system prompt for Assistant mode
        const initialPrompt = modeManager.buildPrompt({
          mode: startMode as ModeType,
          tools: [], // Will be populated later when tools are registered
          skills: [], // Will be populated later when skills are loaded
          workspace: undefined, // Will be populated later when workspace is loaded
        });
        
        // Set system prompt in ContextManager
        manager.setSystemPrompt(initialPrompt);
        
        // Update state
        setCurrentMode(startMode as ModeType);
        setAutoSwitchEnabled(savedAutoSwitch);
        
        // Listen for compression event (Subtask 15.1)
        const compressionCallback = () => {
          console.log('Compression complete, rebuilding prompt with current mode');
          
          // Rebuild prompt with ModeManager after compression (Subtask 15.2)
          if (modeManagerRef.current) {
            // Preserve current mode after compression (Subtask 15.3)
            const currentMode = modeManagerRef.current.getCurrentMode();
            
            const newPrompt = modeManagerRef.current.buildPrompt({
              mode: currentMode,
              tools: [], // Will be populated by ChatContext when available
              skills: modeManagerRef.current.getActiveSkills(),
              workspace: undefined, // Will be populated by ChatContext when available
            });
            
            // Update system prompt in ContextManager (Subtask 15.4)
            manager.setSystemPrompt(newPrompt);
            
            console.log(`System prompt rebuilt after compression (mode: ${currentMode})`);
          }
        };
        
        // Register compression listener on the manager
        manager.on('compressed', compressionCallback);
        
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Failed to initialize ContextManager:', message);
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
        snapshotManagerRef.current.clearCache();
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
  }, []);
  
  // Compress context action
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
  
  // Clear context action
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
      console.error('Failed to create snapshot:', errorMsg);
      setError(errorMsg);
      throw err;
    }
  }, []);
  
  // Restore snapshot action
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
  
  // Refresh snapshots action
  const refreshSnapshots = useCallback(async () => {
    if (!managerRef.current) return;
    
    try {
      const updatedSnapshots = await managerRef.current.listSnapshots();
      setSnapshots(updatedSnapshots);
    } catch (err) {
      console.error('Failed to refresh snapshots:', err);
    }
  }, []);
  
  // Update config action
  const updateConfig = useCallback((newConfig: Partial<ContextConfig>) => {
    if (!managerRef.current) {
      console.warn('ContextManager not initialized');
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
  
  const setSystemPrompt = useCallback((prompt: string) => {
    if (!managerRef.current) {
      console.warn('ContextManager not initialized');
      return;
    }
    managerRef.current.setSystemPrompt(prompt);
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
  };
  
  // Resize action
  const resize = useCallback(async (size: number) => {
    if (!managerRef.current) return;
    
    // Update config which will trigger internal resize
    managerRef.current.updateConfig({ targetSize: size, autoSize: false });
    
    // Persist settings
    SettingsService.getInstance().setContextSize(size);

    setUsage(managerRef.current.getUsage());
  }, []);

  // Hot Swap Action
  const hotSwap = useCallback(async (newSkills?: string[]) => {
    if (!managerRef.current) return;
    if (!provider) {
        console.warn('HotSwap unavailable: No provider connected');
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
            snapshotManagerRef.current || undefined
        );
        
        await hotSwapService.swap(newSkills);
        setUsage(managerRef.current.getUsage());
        setError(null);
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Failed to hot swap:', errorMsg);
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
  
  const getHybridModeManager = useCallback(() => {
    return hybridModeManagerRef.current;
  }, []);
  
  const switchToHybridMode = useCallback((hybridMode: import('@ollm/core').HybridMode) => {
    if (!modeManagerRef.current || !hybridModeManagerRef.current) {
      console.warn('Mode managers not initialized');
      return;
    }
    
    // Set active hybrid mode
    hybridModeManagerRef.current.setActiveHybridMode(hybridMode);
    
    // Disable auto-switching
    modeManagerRef.current.setAutoSwitch(false);
    setAutoSwitchEnabled(false);
    
    // Build hybrid prompt
    const hybridPrompt = hybridModeManagerRef.current.combinePrompts(
      hybridMode.modes,
      (mode) => modeManagerRef.current!.getModeTemplate?.(mode) || ''
    );
    
    // Set the hybrid prompt
    if (managerRef.current) {
      managerRef.current.setSystemPrompt(hybridPrompt);
    }
    
    // Update current mode to the first mode in the hybrid
    // (for display purposes)
    setCurrentMode(hybridMode.modes[0]);
    
    // Persist settings
    SettingsService.getInstance().setMode(hybridMode.modes[0]);
    SettingsService.getInstance().setAutoSwitch(false);
    
    console.log(`Switched to hybrid mode: ${hybridMode.name} (${hybridMode.modes.join(', ')})`);
  }, []);
  
  const switchMode = useCallback((mode: ModeType) => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
      return;
    }
    
    modeManagerRef.current.forceMode(mode);
    setCurrentMode(mode);
    setAutoSwitchEnabled(false);
    
    // Persist mode preference to settings
    SettingsService.getInstance().setMode(mode);
    SettingsService.getInstance().setAutoSwitch(false);
  }, []);
  
  const switchModeExplicit = useCallback((mode: ModeType) => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
      return;
    }
    
    // Use explicit trigger to bypass focus mode check
    modeManagerRef.current.switchMode(mode, 'explicit', 1.0);
    setCurrentMode(mode);
    setAutoSwitchEnabled(false);
    
    // Persist mode preference to settings
    SettingsService.getInstance().setMode(mode);
    SettingsService.getInstance().setAutoSwitch(false);
  }, []);
  
  const setAutoSwitchAction = useCallback((enabled: boolean) => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
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
      console.warn('PromptModeManager not initialized');
      return;
    }
    
    modeManagerRef.current.restoreModeHistory(history);
    
    // Update current mode state from restored history
    const currentMode = modeManagerRef.current.getCurrentMode();
    setCurrentMode(currentMode);
    
    console.log(`Restored mode history with ${history.length} transitions, current mode: ${currentMode}`);
  }, []);
  
  const getModeHistoryAction = useCallback(() => {
    if (!modeManagerRef.current) {
      console.warn('PromptModeManager not initialized');
      return [];
    }
    
    return modeManagerRef.current.getSerializableModeHistory();
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
    setSystemPrompt,
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
    getHybridModeManager,
    switchToHybridMode,
    switchMode,
    switchModeExplicit,
    setAutoSwitch: setAutoSwitchAction,
    getCurrentMode: getCurrentModeAction,
    restoreModeHistory: restoreModeHistoryAction,
    getModeHistory: getModeHistoryAction,
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
    setSystemPrompt,
    on,
    off,
    getModeManager,
    getSnapshotManager,
    getWorkflowManager,
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
