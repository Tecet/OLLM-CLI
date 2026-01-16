/**
 * Service Context for React components
 * 
 * Provides access to the service container throughout the React component tree
 */

import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { ServiceContainer, createServiceContainer } from '@ollm/ollm-cli-core/services/serviceContainer.js';
import type { ProviderAdapter } from '@ollm/ollm-cli-core/provider/types.js';
import type { Config } from '../../config/types.js';
import { homedir } from 'os';

/**
 * Service context value
 */
export interface ServiceContextValue {
  container: ServiceContainer;
}

const ServiceContext = createContext<ServiceContextValue | undefined>(undefined);

export interface ServiceProviderProps {
  children: ReactNode;
  provider: ProviderAdapter;
  config: Config;
  workspacePath?: string;
}

/**
 * Service Provider component
 * 
 * Creates and manages the service container lifecycle
 */
export function ServiceProvider({
  children,
  provider,
  config,
  workspacePath,
}: ServiceProviderProps) {
  // Create service container
  const container = useMemo(() => {
    // Convert CLI config to core config format
    const coreConfig = {
      model: {
        default: config.model?.default,
        cacheTTL: 300000, // 5 minutes default
        routing: {
          enabled: true,
          defaultProfile: 'general',
          overrides: {},
        },
        keepAlive: {
          enabled: false,
          models: [],
          timeout: 300,
        },
      },
      memory: {
        enabled: true,
        tokenBudget: 500,
      },
      project: {
        autoDetect: true,
      },
    };
    
    return createServiceContainer({
      provider,
      config: coreConfig,
      workspacePath,
      userHome: homedir(),
    });
  }, [provider, config, workspacePath]);
  
  // Initialize services on mount
  useEffect(() => {
    container.initializeAll().catch(err => {
      console.error('Failed to initialize services:', err);
    });
    
    // Cleanup on unmount
    return () => {
      container.shutdown().catch(err => {
        console.error('Failed to shutdown services:', err);
      });
    };
  }, [container]);
  
  const value: ServiceContextValue = {
    container,
  };
  
  return (
    <ServiceContext.Provider value={value}>
      {children}
    </ServiceContext.Provider>
  );
}

/**
 * Hook to access the service container
 */
export function useServices(): ServiceContextValue {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
}

/**
 * Hook to access a specific service
 */
export function useModelManagement() {
  const { container } = useServices();
  return container.getModelManagementService();
}

export function useModelRouter() {
  const { container } = useServices();
  return container.getModelRouter();
}

export function useMemory() {
  const { container } = useServices();
  return container.getMemoryService();
}

export function useTemplates() {
  const { container } = useServices();
  return container.getTemplateService();
}

export function useComparison() {
  const { container } = useServices();
  return container.getComparisonService();
}

export function useProjectProfile() {
  const { container } = useServices();
  return container.getProjectProfileService();
}
