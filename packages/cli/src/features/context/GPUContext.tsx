import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

import { createGPUMonitor, type GPUInfo, type GPUMonitor } from '@ollm/core';

import { setLastGPUInfo } from './gpuHintStore.js';

export interface GPUContextValue {
  /** Current GPU information, null if not yet loaded */
  info: GPUInfo | null;
  
  /** Whether GPU info is currently being loaded */
  loading: boolean;
  
  /** Error that occurred during GPU monitoring, if any */
  error: Error | null;
  
  /** Manually refresh GPU information */
  refresh: () => Promise<void>;
}

const GPUContext = createContext<GPUContextValue | undefined>(undefined);

export interface GPUProviderProps {
  children: ReactNode;
  
  /** GPU monitor instance (for testing) */
  monitor?: GPUMonitor;
  
  /** Polling interval in milliseconds (default: 5000) */
  pollingInterval?: number;
  
  /** Whether to start polling automatically (default: true) */
  autoStart?: boolean;
}

export function GPUProvider({
  children,
  monitor: externalMonitor,
  pollingInterval = 5000,
  autoStart = true,
}: GPUProviderProps) {
  const [info, setInfo] = useState<GPUInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [monitor] = useState<GPUMonitor>(() => externalMonitor || createGPUMonitor());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const newInfo = await monitor.getInfo();
      setInfo(newInfo);
      setLastGPUInfo(newInfo);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.warn('Failed to get GPU info:', error);
    } finally {
      setLoading(false);
    }
  }, [monitor]);

  useEffect(() => {
    if (!autoStart) {
      return;
    }

    // Initial fetch
    refresh();

    // Set up polling
    monitor.onUpdate((newInfo) => {
      setInfo(newInfo);
      setError(null);
      setLastGPUInfo(newInfo);
    });

    monitor.startPolling(pollingInterval);

    // Cleanup
    return () => {
      monitor.stopPolling();
    };
  }, [monitor, pollingInterval, autoStart, refresh]);

  const value: GPUContextValue = {
    info,
    loading,
    error,
    refresh,
  };

  return <GPUContext.Provider value={value}>{children}</GPUContext.Provider>;
}

export function useGPU(): GPUContextValue {
  const context = useContext(GPUContext);
  if (!context) {
    throw new Error('useGPU must be used within a GPUProvider');
  }
  return context;
}

export function useOptionalGPU(): GPUContextValue | null {
  return useContext(GPUContext) ?? null;
}
