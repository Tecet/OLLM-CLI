/**
 * Service Context for React components
 * 
 * Provides access to the service container throughout the React component tree
 */

import { homedir } from 'os';

import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';

import { DefaultMCPClient, DefaultMCPToolWrapper } from '@ollm/ollm-cli-core/mcp/index.js';
import { ServiceContainer, createServiceContainer } from '@ollm/ollm-cli-core/services/serviceContainer.js';
import { ToolRegistry, registerBuiltInTools } from '@ollm/ollm-cli-core/tools/index.js';

import { createLogger } from '../../../../core/src/utils/logger.js';
import { SettingsService } from '../../config/settingsService.js';
import { useDialog } from '../../ui/contexts/DialogContext.js';

import type { Config } from '../../config/types.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import type { ProviderAdapter } from '@ollm/ollm-cli-core/provider/types.js';

const logger = createLogger('ServiceContext');


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
  // Get dialog functions for hook approval
  const { showHookApproval } = useDialog();
  
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
      hooks: {
        enabled: true,
        trustWorkspace: false,
        timeout: 30000,
        // Wire up the approval callback to the dialog system
        approvalCallback: async (hook: Hook, hash: string): Promise<boolean> => {
          return await showHookApproval(hook, hash);
        },
      },
    };
    
    return createServiceContainer({
      provider,
      config: coreConfig,
      workspacePath,
      userHome: homedir(),
    });
  }, [provider, config, workspacePath, showHookApproval]);
  
  // Initialize ToolRegistry with SettingsService integration
  useEffect(() => {
    const settingsService = SettingsService.getInstance();
    const toolRegistry = new ToolRegistry(settingsService);
    
    // Register built-in tools
    const userHome = homedir();
    const memoryPath = `${userHome}/.ollm/memory.json`;
    const todosPath = `${userHome}/.ollm/todos.json`;
    registerBuiltInTools(toolRegistry, { memoryPath, todosPath });
    
    // Set the configured registry in the container
    container.setToolRegistry(toolRegistry);
    
    // Initialize MCP integration (CLI layer responsibility)
    // Create MCP client with configuration
    const mcpClient = new DefaultMCPClient({
      enabled: true,
      connectionTimeout: 30000,
      servers: {}, // Servers will be loaded from extensions
    });
    
    // Create MCP tool wrapper
    const mcpToolWrapper = new DefaultMCPToolWrapper(mcpClient);
    
    // Wire MCP dependencies into ExtensionManager
    const extensionManager = container.getExtensionManager();
    extensionManager.setMCPClient(mcpClient);
    extensionManager.setMCPToolWrapper(mcpToolWrapper);
    
    logger.info('✅ MCP integration initialized: MCPClient and MCPToolWrapper wired into ExtensionManager');
  }, [container]);
  
  // Initialize services on mount
  useEffect(() => {
    container.initializeAll().catch(err => {
      logger.error('Failed to initialize services:', err);
    });
    
    // Cleanup on unmount
    return () => {
      container.shutdown().catch(err => {
        logger.error('Failed to shutdown services:', err);
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

export function useHooks() {
  const { container } = useServices();
  return container.getHookService();
}

export function useExtensionManager() {
  const { container } = useServices();
  return container.getExtensionManager();
}

export function useExtensionRegistry() {
  const { container } = useServices();
  return container.getExtensionRegistry();
}
