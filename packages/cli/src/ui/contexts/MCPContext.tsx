import { createLogger } from '../../../../core/src/utils/logger.js';

const logger = createLogger('MCPContext');
/**
 * MCPContext - Manages MCP server state and operations for the MCP Panel UI
 * 
 * Provides centralized state management for:
 * - Loading and managing MCP servers
 * - Server health monitoring with real-time updates
 * - OAuth authentication and token management
 * - Marketplace server discovery and installation
 * - Server configuration and lifecycle management
 */

import os from 'os';
import path from 'path';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';

import { DefaultMCPToolWrapper } from '@ollm/ollm-cli-core/mcp/index.js';
import { DefaultMCPClient } from '@ollm/ollm-cli-core/mcp/mcpClient.js';
import { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import { MCPOAuthProvider, FileTokenStorage } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';
import { ToolRouter, type ToolRoutingConfig, DEFAULT_TOOL_ROUTING_CONFIG } from '@ollm/ollm-cli-core/tools/index.js';

import { SettingsService } from '../../config/settingsService.js';
import { useServices } from '../../features/context/ServiceContext.js';
import { mcpConfigService, type MCPConfigFile } from '../../services/mcpConfigService.js';
import { mcpMarketplace, type MCPMarketplaceServer } from '../../services/mcpMarketplace.js';
import { parseError, retryWithBackoff, formatErrorMessage } from '../utils/errorHandling.js';



import type { 
  MCPClient, 
  MCPServerConfig, 
  MCPServerStatus,
  MCPTool,
  MCPOAuthConfig
} from '@ollm/ollm-cli-core/mcp/types.js';

/**
 * System message type for non-invasive notifications
 */
export interface SystemMessage {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: 'error' | 'warning' | 'info' | 'success';
  /** Message text */
  message: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Whether the message can be dismissed */
  dismissible: boolean;
}

/**
 * Extended MCP server configuration with UI-specific fields
 */
export interface ExtendedMCPServerConfig extends MCPServerConfig {
  /** Whether the server is disabled */
  disabled?: boolean;
  /** Auto-approve tool list */
  autoApprove?: string[];
}

/**
 * Extended server status with additional UI-specific information
 */
export interface ExtendedMCPServerStatus extends MCPServerStatus {
  /** Server configuration */
  config: ExtendedMCPServerConfig;
  /** Health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** Connection phase */
  phase?: 'stopped' | 'starting' | 'connecting' | 'health-check' | 'connected' | 'unhealthy' | 'error';
  /** Tools provided by the server */
  toolsList: MCPTool[];
  /** OAuth connection status */
  oauthStatus?: {
    connected: boolean;
    expiresAt?: number;
    scopes?: string[];
  };
  /** Last health check timestamp */
  lastCheckTime?: number;
  /** Last response time in ms */
  responseTime?: number;
  /** Last error message */
  lastError?: string;
}

/**
 * MCP context state
 */
export interface MCPState {
  /** Map of server name to server status */
  servers: Map<string, ExtendedMCPServerStatus>;
  /** Current MCP configuration */
  config: MCPConfigFile;
  /** Marketplace servers */
  marketplace: MCPMarketplaceServer[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Operations in progress (server name -> operation type) */
  operationsInProgress: Map<string, 'restart' | 'install' | 'uninstall' | 'configure'>;
}

/**
 * System message type for non-invasive notifications
 */
export interface SystemMessage {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: 'error' | 'warning' | 'info' | 'success';
  /** Message text */
  message: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Whether the message can be dismissed */
  dismissible: boolean;
}

/**
 * MCP context value
 */
export interface MCPContextValue {
  /** Current state */
  state: MCPState;
  
  // Server Management
  /** Toggle server enabled/disabled state */
  toggleServer: (serverName: string) => Promise<void>;
  /** Restart a server */
  restartServer: (serverName: string) => Promise<void>;
  /** Install a server from marketplace */
  installServer: (serverId: string, config: Partial<MCPServerConfig>) => Promise<void>;
  /** Uninstall a server */
  uninstallServer: (serverName: string) => Promise<void>;
  /** Configure a server */
  configureServer: (serverName: string, config: MCPServerConfig) => Promise<void>;
  
  // OAuth Management
  /** Configure OAuth for a server */
  configureOAuth: (serverName: string, oauth: MCPOAuthConfig) => Promise<void>;
  /** Refresh OAuth token */
  refreshOAuthToken: (serverName: string) => Promise<void>;
  /** Revoke OAuth access */
  revokeOAuthAccess: (serverName: string) => Promise<void>;
  
  // Tool Management
  /** Get tools for a server */
  getServerTools: (serverName: string) => MCPTool[];
  
  // Error Management
  /** Clear the current error state */
  clearError: () => void;
  /** Set tool auto-approve status */
  setToolAutoApprove: (serverName: string, toolName: string, approve: boolean) => Promise<void>;
  /** Emit a system message */
  emitSystemMessage: (type: SystemMessage['type'], message: string, dismissible?: boolean) => void;
  /** Subscribe to system messages */
  subscribeToSystemMessages: (callback: (messages: SystemMessage[]) => void) => () => void;
  
  // Logs & Monitoring
  /** Get server logs */
  getServerLogs: (serverName: string, lines?: number) => Promise<string[]>;
  /** Clear server logs (optional) */
  clearServerLogs?: (serverName: string) => Promise<void>;
  
  // Marketplace
  /** Search marketplace servers */
  searchMarketplace: (query: string) => Promise<MCPMarketplaceServer[]>;
  /** Refresh marketplace data */
  refreshMarketplace: () => Promise<void>;
  
  // General
  /** Refresh all server data */
  refreshServers: () => Promise<void>;
  
  /** Tool Router instance */
  toolRouter: ToolRouter;
}

const MCPContext = createContext<MCPContextValue | undefined>(undefined);

/**
 * Hook to access MCP context
 */
export function useMCP(): MCPContextValue {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
}

export interface MCPProviderProps {
  children: ReactNode;
  /** Optional MCPClient instance (for testing) */
  mcpClient?: MCPClient;
  /** Optional MCPHealthMonitor instance (for testing) */
  healthMonitor?: MCPHealthMonitor;
  /** Optional MCPOAuthProvider instance (for testing) */
  oauthProvider?: MCPOAuthProvider;
}

/**
 * Provider for MCP management
 */
export function MCPProvider({ 
  children,
  mcpClient: customClient,
  healthMonitor: customHealthMonitor,
  oauthProvider: customOAuthProvider
}: MCPProviderProps) {
  const [state, setState] = useState<MCPState>({
    servers: new Map(),
    config: { mcpServers: {} },
    marketplace: [],
    isLoading: true,
    error: null,
    operationsInProgress: new Map(),
  });

  // Track registered tools to avoid state dependency in loadServers
  const lastRegisteredTools = React.useRef<Map<string, MCPTool[]>>(new Map());
  
  // System messages state
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const systemMessageListeners = React.useRef<Set<(messages: SystemMessage[]) => void>>(new Set());
  
  // Operation queue to prevent race conditions on rapid enable/disable
  const operationQueues = React.useRef<Map<string, Promise<void>>>(new Map());

  // Try to get services from ServiceContext. Tests may not provide a ServiceProvider,
  // so fall back to a minimal no-op tool registry to avoid throwing in test environments.
  let container: unknown;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    container = useServices().container;
  } catch {
    container = undefined;
  }

  // Narrowly-typed tool registry with a runtime guard
  const isToolRegistry = (obj: unknown): obj is { register: (t: unknown) => void; unregister: (n: string) => void } => {
    return Boolean(obj && typeof (obj as any).register === 'function' && typeof (obj as any).unregister === 'function');
  };

  const toolRegistry = useMemo(() => {
    try {
      if (container && typeof (container as any).getToolRegistry === 'function') {
        const maybe = (container as any).getToolRegistry();
        if (isToolRegistry(maybe)) return maybe;
      }
    } catch {
      // fallthrough to fallback
    }

    // Minimal fallback tool registry used only for tests: register/unregister are no-ops
    return {
      register: () => {},
      unregister: () => {},
    } as { register: (tool: unknown) => void; unregister: (name: string) => void };
  }, [container]);

  // Initialize services
  const oauthProvider = useMemo(() => {
    if (customOAuthProvider) return customOAuthProvider;
    const tokenFile = path.join(os.homedir(), '.ollm', 'mcp', 'oauth-tokens.json');
    return new MCPOAuthProvider(new FileTokenStorage(tokenFile));
  }, [customOAuthProvider]);

  // Initialize services
  // Pass the shared oauthProvider to the client so it shares token storage
  const mcpClient = useMemo(() => customClient || new DefaultMCPClient(undefined, oauthProvider), [customClient, oauthProvider]);
  const healthMonitor = useMemo(() => customHealthMonitor || new MCPHealthMonitor(mcpClient), [customHealthMonitor, mcpClient]);

  // Initialize tool router
  const toolRouter = useMemo(() => {
    const settings = SettingsService.getInstance().getSettings();
    const config = settings.llm.toolRouting || DEFAULT_TOOL_ROUTING_CONFIG;
    // Use narrow any casts to bridge runtime-provided registries and clients
    return new ToolRouter(mcpClient as any, toolRegistry as any, config as ToolRoutingConfig);
  }, [mcpClient, toolRegistry]);

  // Listen for settings changes to update router config
  useEffect(() => {
    const handleSettingsChange = () => {
      const settings = SettingsService.getInstance().getSettings();
      if (settings.llm.toolRouting) {
        toolRouter.updateConfig(settings.llm.toolRouting as ToolRoutingConfig);
      }
    };
    
    const unsubscribe = SettingsService.getInstance().addChangeListener(handleSettingsChange);
    
    // Cleanup: remove listener on unmount
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [toolRouter]);

  /**
   * Emit a system message
   * Defined early to avoid circular dependencies with other callbacks
   */
  const emitSystemMessage = useCallback((
    type: SystemMessage['type'],
    message: string,
    dismissible: boolean = true
  ) => {
    const newMessage: SystemMessage = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      dismissible,
    };
    
    setSystemMessages(prev => {
      const updated = [...prev, newMessage];
      // Notify all listeners with updated messages
      systemMessageListeners.current.forEach(listener => {
        listener(updated);
      });
      return updated;
    });
    
    // Auto-dismiss success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        setSystemMessages(prev => prev.filter(m => m.id !== newMessage.id));
      }, 5000);
    }
  }, []); // No dependencies needed - uses functional setState
  
  /**
   * Subscribe to system messages
   * Defined early to avoid circular dependencies with other callbacks
   */
  const subscribeToSystemMessages = useCallback((
    callback: (messages: SystemMessage[]) => void
  ): (() => void) => {
    systemMessageListeners.current.add(callback);
    
    // Return unsubscribe function
    return () => {
      systemMessageListeners.current.delete(callback);
    };
  }, []);
  
  /**
   * Enqueue an operation for a server to prevent race conditions
   * Operations for the same server are serialized
   */
  const enqueueServerOperation = useCallback(async <T,>(
    serverName: string,
    operation: () => Promise<T>
  ): Promise<T> => {
    // Get existing queue for this server
    const existingQueue = operationQueues.current.get(serverName) || Promise.resolve();
    
    // Create new promise that waits for existing queue then runs operation
    const newQueue = existingQueue
      .then(() => operation())
      .catch((error) => {
        // Re-throw error but don't break the queue
        throw error;
      })
      .finally(() => {
        // Clean up if this is still the current queue
        if (operationQueues.current.get(serverName) === newQueue) {
          operationQueues.current.delete(serverName);
        }
      });
    
    // Store the new queue
    operationQueues.current.set(serverName, newQueue as Promise<void>);
    
    // Wait for and return the result
    return newQueue as Promise<T>;
  }, []);

  /*
   * Register tools for a server
   */
  const registerServerTools = useCallback((serverName: string, tools: MCPTool[]) => {
      tools.forEach(tool => {
        // Create wrapper instance
        const wrapperFactory = new DefaultMCPToolWrapper(mcpClient);
        
        // Wrap the tool to get a DeclarativeTool compatible object
        const wrappedTool = wrapperFactory.wrapTool(serverName, tool);
        
        // Override the name to include server prefix (if not already handled by wrapTool)
        // DefaultMCPToolWrapper.wrapTool already prefixes with "${serverName}:", 
        // but we want "${serverName}_" or just ensure it's unique.
        // Let's rely on wrapTool's prefixing or ensure consistency.
        // The previous code tried to use defineProperty on the *wrapper factory* which was wrong.
        
        // internalSchema name is already set in wrapTool to "server:tool"
        // Let's enforce our naming convention if different
        // core/src/mcp/mcpToolWrapper.ts uses `${serverName}:${mcpTool.name}`
        
        // We can just register the wrapped tool directly
        toolRegistry.register(wrappedTool);
      });
  }, [mcpClient, toolRegistry]);

  /**
   * Unregister tools for a server
   */
  const unregisterServerTools = useCallback((serverName: string, tools: MCPTool[]) => {
      tools.forEach(tool => {
        // Unregister using the same naming conversion as wrapTool
        // DefaultMCPToolWrapper uses colon separator
        toolRegistry.unregister(`${serverName}:${tool.name}`);
      });
  }, [toolRegistry]);

  /**
   * Load servers from configuration and client
   */
  const loadServers = useCallback(async () => {
    try {
      // Load configuration
      const config = await mcpConfigService.loadMCPConfig();
      
      // Start servers that are configured but not yet started
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        // Skip disabled servers
        if ((serverConfig as ExtendedMCPServerConfig).disabled) {
          continue;
        }
        
        // Check if server is already started (client may provide getServerStatus)
        let existingStatus: Record<string, unknown> | undefined;
        try {
          const getServerStatus = (mcpClient as any)?.getServerStatus;
          if (typeof getServerStatus === 'function') {
            existingStatus = await getServerStatus.call(mcpClient, serverName);
          }
        } catch {
          existingStatus = undefined;
        }

        if (existingStatus && existingStatus.status === 'disconnected') {
          // Server not started yet, start it
          try {
            await mcpClient.startServer(serverName, serverConfig);
          } catch (error) {
            logger.warn(`Failed to start server ${serverName}:`, error);
            // Continue with other servers even if one fails
          }
        }
      }
      
      // Get server statuses from client (client may return a Promise)
      // `getAllServerStatuses` may return either a Promise or a raw Map; normalize with Promise.resolve
      const _serverStatuses = await Promise.resolve((mcpClient as any).getAllServerStatuses());
      const serverStatuses = _serverStatuses as Map<string, MCPServerStatus>;

      // Build extended server status map
      const servers = new Map<string, ExtendedMCPServerStatus>();

      // Include servers from BOTH saved config and any servers discovered by the client
      const configServerNames = Object.keys(config.mcpServers || {});
      const clientServerNames = Array.from(serverStatuses.keys());
      const allServerNames = Array.from(new Set([...configServerNames, ...clientServerNames]));

      for (const serverName of allServerNames) {
        const serverConfig = (config.mcpServers || {})[serverName] as ExtendedMCPServerConfig | undefined;

        // If this server is configured and explicitly disabled, skip starting it
        if (serverConfig?.disabled) {
          // Still include as disabled entry with disconnected status
          servers.set(serverName, {
            name: serverName,
            status: 'disconnected',
            tools: 0,
            uptime: 0,
            config: serverConfig,
            health: 'degraded',
            toolsList: [],
          } as unknown as ExtendedMCPServerStatus);
          continue;
        }

        // For configured servers, attempt to use the client's reported status
        const status = serverStatuses.get(serverName) || {
          name: serverName,
          status: 'disconnected' as const,
          tools: 0,
          uptime: 0,
        };

        // Get tools (only if connected)
        let toolsList: MCPTool[] = [];
        try {
          if (status.status === 'connected') {
            try {
              // Retry tool loading with exponential backoff
              toolsList = await retryWithBackoff(async () => {
                const getTools = (mcpClient as any).getTools;
                if (typeof getTools === 'function') {
                  try {
                    const tools = await getTools.call(mcpClient, serverName);
                    return tools || [];
                  } catch (toolError: any) {
                    // If the error indicates no tools are available (not an actual error),
                    // return empty array instead of throwing
                    const errorMsg = toolError?.message || String(toolError);
                    if (
                      errorMsg.includes('no tools') ||
                      errorMsg.includes('tools/list') ||
                      errorMsg.includes('not implemented') ||
                      errorMsg.includes('Method not found')
                    ) {
                      // Server doesn't provide tools - this is valid
                      return [];
                    }
                    // Real error - rethrow to trigger retry
                    throw toolError;
                  }
                }
                return [];
              }, { maxAttempts: 3, initialDelay: 500 });
              // Note: toolsList can be empty array - that's valid, not an error
            } catch (err) {
              logger.warn(`Failed to get tools for ${serverName} after retries:`, err);
              // Only emit warning if server is still in config and there's a real error
              if (serverConfig) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                // Only show warning for actual errors, not "no tools available" situations
                if (
                  !errorMsg.includes('no tools') &&
                  !errorMsg.includes('not implemented') &&
                  !errorMsg.includes('Method not found') &&
                  !errorMsg.includes('tools/list')
                ) {
                  emitSystemMessage('info', `Tools not loaded for ${serverName}. This may be normal if the server doesn't provide tools. Check MCP server specification or logs if unexpected.`);
                }
              }
            }
          }
        } catch (error) {
          logger.warn(`Failed to get tools for ${serverName}:`, error);
        }

        // Manage tool registration
        const prevTools = lastRegisteredTools.current.get(serverName);
        if (prevTools) {
          unregisterServerTools(serverName, prevTools);
        }

        if (status.status === 'connected' && toolsList.length > 0) {
          registerServerTools(serverName, toolsList);
          lastRegisteredTools.current.set(serverName, toolsList);
        } else {
          lastRegisteredTools.current.delete(serverName);
        }

        // Get OAuth status only when configured
        let oauthStatus;
        if (serverConfig?.oauth?.enabled) {
          try {
            oauthStatus = await oauthProvider.getOAuthStatus(serverName);
          } catch (error) {
            logger.warn(`Failed to get OAuth status for ${serverName}:`, error);
          }
        }

        // Determine health status. Prefer client-reported `health` when available,
        // otherwise infer from the connection `status`.
        const statusRecord: any = status;
        const health = statusRecord?.health ??
          (status.status === 'connected' ? 'healthy' :
          status.status === 'error' ? 'unhealthy' :
          'degraded');

        servers.set(serverName, {
          ...status,
          config: serverConfig || ({} as ExtendedMCPServerConfig),
          health,
          toolsList,
          oauthStatus,
        });
      }
      
      setState(prev => ({
        ...prev,
        servers,
        config,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load servers',
      }));
    }
  }, [mcpClient, oauthProvider, registerServerTools, unregisterServerTools, emitSystemMessage]);

  /**
   * Load marketplace data
   */
  const loadMarketplace = useCallback(async () => {
    try {
      const servers = await mcpMarketplace.getPopularServers(10);
      setState(prev => ({
        ...prev,
        marketplace: servers,
      }));
    } catch (error) {
      logger.warn('Failed to load marketplace:', error);
      // Don't set error state for marketplace failures
    }
  }, []);

  /**
   * Toggle server enabled/disabled state
   */
  const toggleServer = useCallback(async (serverName: string) => {
    // Enqueue operation to prevent race conditions
    return enqueueServerOperation(serverName, async () => {
      // Get fresh server state synchronously from current state
      const server = state.servers.get(serverName);
      
      if (!server) {
        const errorMsg = `Server '${serverName}' not found`;
        emitSystemMessage('error', errorMsg);
        throw new Error(errorMsg);
      }

      const isCurrentlyDisabled = server.config.disabled || false;
      const isActuallyRunning = server.status === 'connected';
      
      const newConfig = {
        ...server.config,
        disabled: !isCurrentlyDisabled,
      };

      // Optimistic UI update - show status change immediately for better UX
      setState(prev => {
        const servers = new Map(prev.servers);
        const serverState = servers.get(serverName);
        if (serverState) {
          servers.set(serverName, {
            ...serverState,
            status: isCurrentlyDisabled ? 'starting' : 'disconnected',
            phase: isCurrentlyDisabled ? 'starting' : 'stopped',
            config: newConfig,
          });
        }
        return { ...prev, servers };
      });

      // Update configuration first
      await mcpConfigService.updateServerConfig(serverName, newConfig as unknown as MCPServerConfig);

      // Start or stop the server with retry logic
      try {
        await retryWithBackoff(async () => {
          if (newConfig.disabled) {
            // Disabling: stop the server if it's running
            if (isActuallyRunning) {
              // Explicitly unregister tools before stopping server
              if (server.toolsList && server.toolsList.length > 0) {
                unregisterServerTools(serverName, server.toolsList);
                lastRegisteredTools.current.delete(serverName);
              }
              await mcpClient.stopServer(serverName);
            }
            // If not running, just update config (already done above)
          } else {
            // Enabling: start the server if it's not running
            if (!isActuallyRunning) {
              await mcpClient.startServer(serverName, newConfig);
            }
            // If already running, just update config (already done above)
          }
        }, { maxAttempts: 2 });
        
        // Emit success message
        emitSystemMessage(
          'success',
          `${serverName} ${newConfig.disabled ? 'disabled' : 'enabled'} successfully`
        );
      } catch (_startError) {
        // If starting fails, revert the config change
        await mcpConfigService.updateServerConfig(serverName, {
          ...newConfig,
          disabled: true,
        } as unknown as MCPServerConfig);
        
        // Ensure tools are unregistered if start failed
        if (server.toolsList) {
            unregisterServerTools(serverName, server.toolsList);
            lastRegisteredTools.current.delete(serverName);
        }

        // Revert optimistic update on error
        await loadServers();

        // Emit error message with more context
        const errorMsg = server.config.oauth?.enabled
          ? `OAuth authentication failed for ${serverName}. Please check OAuth configuration.`
          : `Failed to ${newConfig.disabled ? 'disable' : 'enable'} ${serverName}`;
        emitSystemMessage('error', errorMsg);
        throw new Error(errorMsg);
      }

      // Reload servers to get actual state
      await loadServers();
    });
  }, [state.servers, mcpClient, loadServers, unregisterServerTools, emitSystemMessage, enqueueServerOperation]);

  /**
   * Restart a server
   */
  const restartServer = useCallback(async (serverName: string) => {
    // Enqueue operation to prevent race conditions
    return enqueueServerOperation(serverName, async () => {
      try {
        // Mark operation as in progress
        setState(prev => ({
          ...prev,
          operationsInProgress: new Map(prev.operationsInProgress).set(serverName, 'restart'),
        }));

        // Restart with retry logic
        await retryWithBackoff(async () => {
          await mcpClient.restartServer(serverName);
        }, { maxAttempts: 3 });

        await loadServers();
        
        // Emit success message
        emitSystemMessage('success', `${serverName} restarted successfully`);
      } catch (error) {
        const parsedError = parseError(error);
        const errorMsg = `Failed to restart ${serverName}: ${formatErrorMessage(parsedError)}`;
        emitSystemMessage('error', errorMsg);
        throw error;
      } finally {
        // Clear operation
        setState(prev => {
          const ops = new Map(prev.operationsInProgress);
          ops.delete(serverName);
          return { ...prev, operationsInProgress: ops };
        });
      }
    });
  }, [mcpClient, loadServers, emitSystemMessage, enqueueServerOperation]);

  /**
   * Install a server from marketplace
   */
  const installServer = useCallback(async (serverId: string, config: Partial<MCPServerConfig>) => {
    try {
      await retryWithBackoff(async () => {
        await mcpMarketplace.installServer(serverId, config);
      }, { maxAttempts: 2 });
      
      // Get server details to start it
      // Note: serverId can be either a string ID or a full server object
      const serverDetails = typeof serverId === 'string'
        ? await mcpMarketplace.getServerDetails(serverId)
        : serverId;
        
      const fullConfig: MCPServerConfig = {
        command: config.command || serverDetails.command,
        args: config.args || serverDetails.args || [],
        env: { ...serverDetails.env, ...config.env },
        transport: config.transport || 'stdio',
        timeout: config.timeout,
        oauth: config.oauth,
        url: config.url,
        cwd: config.cwd,
      };
      
      // Start the server with retry
      await retryWithBackoff(async () => {
        await mcpClient.startServer(serverDetails.name, fullConfig);
      }, { maxAttempts: 2 });
      
      // Reload servers and marketplace
      await loadServers();
      await loadMarketplace();
      
      // Emit success message
      emitSystemMessage('success', `${serverDetails.name} installed successfully`);
    } catch (error) {
      const parsedError = parseError(error);
      const errorMsg = `Installation failed: ${formatErrorMessage(parsedError)}`;
      emitSystemMessage('error', errorMsg);
      throw error;
    }
  }, [mcpClient, loadServers, loadMarketplace, emitSystemMessage]);

  /**
   * Uninstall a server
   */
  const uninstallServer = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      
      // Stop the server first
      await mcpClient.stopServer(serverName);
      
      // Unregister tools
      if (server?.toolsList) {
          unregisterServerTools(serverName, server.toolsList);
      }

      // Clean up downloaded packages/cache
      if (server?.config) {
        const { mcpCleanupService } = await import('../../services/mcpCleanup.js');
        await mcpCleanupService.cleanupServer(
          serverName,
          server.config.command,
          server.config.args
        );
      }
      
      // Remove from configuration
      await mcpConfigService.removeServerConfig(serverName);
      
      // Revoke OAuth if configured
      if (server?.config.oauth?.enabled) {
        try {
          await oauthProvider.revokeAccess(serverName, server.config.oauth);
        } catch (error) {
          logger.warn(`Failed to revoke OAuth for ${serverName}:`, error);
        }
      }
      
      // Reload servers
      await loadServers();
      
      // Emit success message
      emitSystemMessage('success', `${serverName} uninstalled successfully`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to uninstall server';
      emitSystemMessage('error', `Failed to uninstall ${serverName}: ${errorMsg}`);
      throw error;
    }
  }, [state.servers, mcpClient, oauthProvider, loadServers, unregisterServerTools, emitSystemMessage]);

  /**
   * Configure a server
   */
  const configureServer = useCallback(async (serverName: string, config: MCPServerConfig) => {
    // Enqueue operation to prevent race conditions
    return enqueueServerOperation(serverName, async () => {
      try {
        // Update configuration
        await mcpConfigService.updateServerConfig(serverName, config);
        
        // Restart the server with new config (with retry)
        await retryWithBackoff(async () => {
          await mcpClient.restartServer(serverName);
        }, { maxAttempts: 2 });
        
        // Reload servers
        await loadServers();
        
        // Emit success message
        emitSystemMessage('success', `${serverName} configuration updated successfully`);
      } catch (error) {
        const parsedError = parseError(error);
        const errorMsg = `Failed to configure ${serverName}: ${formatErrorMessage(parsedError)}`;
        emitSystemMessage('error', errorMsg);
        throw error;
      }
    });
  }, [mcpClient, loadServers, emitSystemMessage, enqueueServerOperation]);

  /**
   * Configure OAuth for a server
   */
  const configureOAuth = useCallback(async (serverName: string, oauth: MCPOAuthConfig) => {
    try {
      const server = state.servers.get(serverName);
      if (!server) {
        const errorMsg = `Server '${serverName}' not found`;
        emitSystemMessage('error', errorMsg);
        throw new Error(errorMsg);
      }

      const newConfig = {
        ...server.config,
        oauth,
      };

      // Update configuration
      await mcpConfigService.updateServerConfig(serverName, newConfig);
      
      // Reload servers
      await loadServers();
      
      // Emit success message
      emitSystemMessage('success', `OAuth configured for ${serverName}`);
    } catch (error) {
      const parsedError = parseError(error);
      const errorMsg = `Failed to configure OAuth for ${serverName}: ${formatErrorMessage(parsedError)}`;
      emitSystemMessage('error', errorMsg);
      throw error;
    }
  }, [state.servers, loadServers, emitSystemMessage]);

  /**
   * Refresh OAuth token
   */
  const refreshOAuthToken = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      if (!server?.config.oauth) {
        const errorMsg = `Server '${serverName}' does not have OAuth configured`;
        emitSystemMessage('error', errorMsg);
        throw new Error(errorMsg);
      }

      await retryWithBackoff(async () => {
        await oauthProvider.refreshToken(serverName, server.config.oauth!);
      }, { maxAttempts: 2 });
      
      // Reload servers to update OAuth status
      await loadServers();
      
      // Emit success message
      emitSystemMessage('success', `OAuth token refreshed for ${serverName}`);
    } catch (error) {
      const parsedError = parseError(error);
      const errorMsg = `Failed to refresh OAuth token for ${serverName}: ${formatErrorMessage(parsedError)}`;
      emitSystemMessage('error', errorMsg);
      throw error;
    }
  }, [state.servers, oauthProvider, loadServers, emitSystemMessage]);

  /**
   * Revoke OAuth access
   */
  const revokeOAuthAccess = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      await oauthProvider.revokeAccess(serverName, server?.config.oauth);
      
      // Reload servers to update OAuth status
      await loadServers();
      
      // Emit success message
      emitSystemMessage('success', `OAuth access revoked for ${serverName}`);
    } catch (error) {
      const parsedError = parseError(error);
      const errorMsg = `Failed to revoke OAuth access for ${serverName}: ${formatErrorMessage(parsedError)}`;
      emitSystemMessage('error', errorMsg);
      throw error;
    }
  }, [state.servers, oauthProvider, loadServers, emitSystemMessage]);

  /**
   * Get tools for a server
   */
  const getServerTools = useCallback((serverName: string): MCPTool[] => {
    const server = state.servers.get(serverName);
    return server?.toolsList || [];
  }, [state.servers]);

  /**
   * Set tool auto-approve status
   */
  const setToolAutoApprove = useCallback(async (serverName: string, toolName: string, approve: boolean) => {
    try {
      const server = state.servers.get(serverName);
      if (!server) {
        const errorMsg = `Server '${serverName}' not found`;
        emitSystemMessage('error', errorMsg);
        throw new Error(errorMsg);
      }

      const currentAutoApprove = server.config.autoApprove || [];
      let newAutoApprove: string[];

      if (approve) {
        // Add tool to auto-approve list if not already there
        newAutoApprove = currentAutoApprove.includes(toolName)
          ? currentAutoApprove
          : [...currentAutoApprove, toolName];
      } else {
        // Remove tool from auto-approve list
        newAutoApprove = currentAutoApprove.filter(t => t !== toolName);
      }

      const newConfig = {
        ...server.config,
        autoApprove: newAutoApprove,
      };

      // Update configuration
      await mcpConfigService.updateServerConfig(serverName, newConfig);
      
      // Reload servers
      await loadServers();
      
      // Emit success message
      emitSystemMessage(
        'success',
        `Tool ${toolName} ${approve ? 'added to' : 'removed from'} auto-approve list`
      );
    } catch (error) {
      const parsedError = parseError(error);
      const errorMsg = `Failed to update auto-approve for ${toolName}: ${formatErrorMessage(parsedError)}`;
      emitSystemMessage('error', errorMsg);
      throw error;
    }
  }, [state.servers, loadServers, emitSystemMessage]);

  /**
   * Search marketplace servers
   */
  const searchMarketplace = useCallback(async (query: string): Promise<MCPMarketplaceServer[]> => {
    try {
      return await mcpMarketplace.searchServers(query);
    } catch (error) {
      logger.warn('Failed to search marketplace:', error);
      return [];
    }
  }, []);

  /**
   * Refresh marketplace data
   */
  const refreshMarketplace = useCallback(async () => {
    try {
      await mcpMarketplace.refreshCache();
      await loadMarketplace();
    } catch (error) {
      logger.warn('Failed to refresh marketplace:', error);
    }
  }, [loadMarketplace]);

  /**
   * Get server logs
   */
  const getServerLogs = useCallback(async (serverName: string, lines: number = 100): Promise<string[]> => {
    try {
      return await mcpClient.getServerLogs(serverName, lines);
    } catch (error) {
      logger.error(`Failed to get logs for ${serverName}:`, error);
      return [];
    }
  }, [mcpClient]);

  /**
   * Clear server logs (optional - not yet implemented in MCPClient)
   */
  const clearServerLogs = useCallback(async (serverName: string): Promise<void> => {
    // This would require implementing log clearing in MCPClient
    // For now, this is a placeholder
    logger.warn(`Clear logs not yet implemented for ${serverName}`);
  }, []);

  /**
   * Refresh all server data
   */
  const refreshServers = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    await loadServers();
  }, [loadServers]);

  // Initialize: load servers and marketplace
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        loadServers(),
        loadMarketplace(),
      ]);
    };

    initialize();
  }, [loadServers, loadMarketplace]);

  // Subscribe to health updates
  useEffect(() => {
    healthMonitor.start();

    const unsubscribe = healthMonitor.subscribeToHealthUpdates((health) => {
      // Update server health in state
      setState(prev => {
        const servers = new Map(prev.servers);
        const server = servers.get(health.serverName);
        
        if (server) {
          servers.set(health.serverName, {
            ...server,
            health: health.healthy ? 'healthy' : 'unhealthy',
            status: health.status,
            phase: health.phase,
            error: health.error,
          });
        }
        
        return { ...prev, servers };
      });
    });

    return () => {
      unsubscribe();
      healthMonitor.stop();
    };
  }, [healthMonitor]);

  // Watch for configuration changes
  useEffect(() => {
    mcpConfigService.startWatching();

    const handleConfigChange = () => {
      // Reload servers when config changes externally
      loadServers();
    };

    mcpConfigService.addChangeListener(handleConfigChange);

    return () => {
      mcpConfigService.removeChangeListener(handleConfigChange);
      mcpConfigService.stopWatching();
    };
  }, [loadServers]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  // Notify listeners when system messages change
  useEffect(() => {
    systemMessageListeners.current.forEach(listener => {
      listener(systemMessages);
    });
  }, [systemMessages]);

  const value: MCPContextValue = {
    state,
    toggleServer,
    restartServer,
    installServer,
    uninstallServer,
    configureServer,
    configureOAuth,
    refreshOAuthToken,
    revokeOAuthAccess,
    getServerTools,
    setToolAutoApprove,
    getServerLogs,
    clearServerLogs,
    searchMarketplace,
    refreshMarketplace,
    refreshServers,
    clearError,
    emitSystemMessage,
    subscribeToSystemMessages,
    toolRouter,
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}
