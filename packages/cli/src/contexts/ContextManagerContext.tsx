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

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

// Import from @ollm/core using the aliased types
import {
  MemoryLevel,
  createContextManager,
} from '@ollm/core';

import type {
  ContextConfig,
  ContextUsage,
  ContextSnapshot,
  VRAMInfo,
  ContextManagerInterface,
  ContextModelInfo,
  ContextMessage,
} from '@ollm/core';

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
  
  // Context manager reference
  const managerRef = useRef<ContextManagerInterface | null>(null);
  
  // Initialize context manager
  useEffect(() => {
    const initManager = async () => {
      try {
        // Create context manager using the factory function
        const manager = createContextManager(sessionId, modelInfo, config);
        managerRef.current = manager;
        
        // Start the context manager
        await manager.start();
        setActive(true);
        
        // Get initial usage
        setUsage(manager.getUsage());
        
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
  };
  
  const actions: ContextManagerActions = {
    addMessage,
    compress,
    clear,
    createSnapshot: createSnapshotAction,
    restoreSnapshot,
    refreshSnapshots,
    updateConfig,
    refreshVRAM,
  };
  
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
