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

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';
import { DefaultMCPClient } from '@ollm/ollm-cli-core/mcp/mcpClient.js';
import { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import { MCPOAuthProvider, FileTokenStorage } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';
import type { 
  MCPClient, 
  MCPServerConfig, 
  MCPServerStatus,
  MCPTool,
  MCPOAuthConfig
} from '@ollm/ollm-cli-core/mcp/types.js';
import { mcpConfigService, type MCPConfigFile } from '../../services/mcpConfigService.js';
import { mcpMarketplace, type MCPMarketplaceServer } from '../../services/mcpMarketplace.js';
import { parseError, retryWithBackoff, formatErrorMessage } from '../utils/errorHandling.js';
import path from 'path';
import os from 'os';

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
  /** Tools provided by the server */
  toolsList: MCPTool[];
  /** OAuth connection status */
  oauthStatus?: {
    connected: boolean;
    expiresAt?: number;
    scopes?: string[];
  };
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
  /** Set tool auto-approve status */
  setToolAutoApprove: (serverName: string, toolName: string, approve: boolean) => Promise<void>;
  
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

  // Initialize services
  const mcpClient = useMemo(() => customClient || new DefaultMCPClient(), [customClient]);
  const healthMonitor = useMemo(() => customHealthMonitor || new MCPHealthMonitor(mcpClient), [customHealthMonitor, mcpClient]);
  const oauthProvider = useMemo(() => {
    if (customOAuthProvider) return customOAuthProvider;
    const tokenFile = path.join(os.homedir(), '.ollm', 'mcp', 'oauth-tokens.json');
    return new MCPOAuthProvider(new FileTokenStorage(tokenFile));
  }, [customOAuthProvider]);

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
        if (serverConfig.disabled) {
          continue;
        }
        
        // Check if server is already started
        const existingStatus = mcpClient.getServerStatus(serverName);
        if (existingStatus.status === 'disconnected') {
          // Server not started yet, start it
          try {
            await mcpClient.startServer(serverName, serverConfig);
          } catch (error) {
            console.warn(`Failed to start server ${serverName}:`, error);
            // Continue with other servers even if one fails
          }
        }
      }
      
      // Get server statuses from client
      const serverStatuses = mcpClient.getAllServerStatuses();
      
      // Build extended server status map
      const servers = new Map<string, ExtendedMCPServerStatus>();
      
      // Process ALL servers from config (including disabled ones)
      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        // Get status from client (will be 'disconnected' if not started)
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
            toolsList = await mcpClient.getTools(serverName);
          }
        } catch (error) {
          console.warn(`Failed to get tools for ${serverName}:`, error);
        }
        
        // Get OAuth status
        let oauthStatus;
        if (serverConfig.oauth?.enabled) {
          try {
            oauthStatus = await oauthProvider.getOAuthStatus(serverName);
          } catch (error) {
            console.warn(`Failed to get OAuth status for ${serverName}:`, error);
          }
        }
        
        // Determine health status
        const health = status.status === 'connected' ? 'healthy' :
                      status.status === 'error' ? 'unhealthy' :
                      'degraded';
        
        servers.set(serverName, {
          ...status,
          config: serverConfig,
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
  }, [mcpClient, oauthProvider]);

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
      console.warn('Failed to load marketplace:', error);
      // Don't set error state for marketplace failures
    }
  }, []);

  /**
   * Toggle server enabled/disabled state
   */
  const toggleServer = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      if (!server) {
        throw new Error(`Server '${serverName}' not found`);
      }

      const isCurrentlyDisabled = server.config.disabled || false;
      const newConfig = {
        ...server.config,
        disabled: !isCurrentlyDisabled,
      };

      // Update configuration first
      await mcpConfigService.updateServerConfig(serverName, newConfig);

      // Start or stop the server with retry logic
      try {
        await retryWithBackoff(async () => {
          if (newConfig.disabled) {
            await mcpClient.stopServer(serverName);
          } else {
            await mcpClient.startServer(serverName, newConfig);
          }
        }, { maxAttempts: 2 });
      } catch (startError) {
        // If starting fails, revert the config change
        await mcpConfigService.updateServerConfig(serverName, {
          ...newConfig,
          disabled: true,
        });
        
        // Re-throw with more context
        if (server.config.oauth?.enabled) {
          throw new Error(`OAuth authentication failed for ${serverName}. Please check OAuth configuration.`);
        }
        throw startError;
      }

      // Reload servers
      await loadServers();
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [state.servers, mcpClient, loadServers]);

  /**
   * Restart a server
   */
  const restartServer = useCallback(async (serverName: string) => {
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
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    } finally {
      // Clear operation
      setState(prev => {
        const ops = new Map(prev.operationsInProgress);
        ops.delete(serverName);
        return { ...prev, operationsInProgress: ops };
      });
    }
  }, [mcpClient, loadServers]);

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
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [mcpClient, loadServers, loadMarketplace]);

  /**
   * Uninstall a server
   */
  const uninstallServer = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      
      // Stop the server first
      await mcpClient.stopServer(serverName);
      
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
          console.warn(`Failed to revoke OAuth for ${serverName}:`, error);
        }
      }
      
      // Reload servers
      await loadServers();
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to uninstall server',
      }));
      throw error;
    }
  }, [state.servers, mcpClient, oauthProvider, loadServers]);

  /**
   * Configure a server
   */
  const configureServer = useCallback(async (serverName: string, config: MCPServerConfig) => {
    try {
      // Update configuration
      await mcpConfigService.updateServerConfig(serverName, config);
      
      // Restart the server with new config (with retry)
      await retryWithBackoff(async () => {
        await mcpClient.restartServer(serverName);
      }, { maxAttempts: 2 });
      
      // Reload servers
      await loadServers();
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [mcpClient, loadServers]);

  /**
   * Configure OAuth for a server
   */
  const configureOAuth = useCallback(async (serverName: string, oauth: MCPOAuthConfig) => {
    try {
      const server = state.servers.get(serverName);
      if (!server) {
        throw new Error(`Server '${serverName}' not found`);
      }

      const newConfig = {
        ...server.config,
        oauth,
      };

      // Update configuration
      await mcpConfigService.updateServerConfig(serverName, newConfig);
      
      // Reload servers
      await loadServers();
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [state.servers, loadServers]);

  /**
   * Refresh OAuth token
   */
  const refreshOAuthToken = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      if (!server?.config.oauth) {
        throw new Error(`Server '${serverName}' does not have OAuth configured`);
      }

      await retryWithBackoff(async () => {
        await oauthProvider.refreshToken(serverName, server.config.oauth!);
      }, { maxAttempts: 2 });
      
      // Reload servers to update OAuth status
      await loadServers();
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [state.servers, oauthProvider, loadServers]);

  /**
   * Revoke OAuth access
   */
  const revokeOAuthAccess = useCallback(async (serverName: string) => {
    try {
      const server = state.servers.get(serverName);
      await oauthProvider.revokeAccess(serverName, server?.config.oauth);
      
      // Reload servers to update OAuth status
      await loadServers();
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [state.servers, oauthProvider, loadServers]);

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
        throw new Error(`Server '${serverName}' not found`);
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
    } catch (error) {
      const parsedError = parseError(error);
      setState(prev => ({
        ...prev,
        error: formatErrorMessage(parsedError),
      }));
      throw error;
    }
  }, [state.servers, loadServers]);

  /**
   * Search marketplace servers
   */
  const searchMarketplace = useCallback(async (query: string): Promise<MCPMarketplaceServer[]> => {
    try {
      return await mcpMarketplace.searchServers(query);
    } catch (error) {
      console.warn('Failed to search marketplace:', error);
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
      console.warn('Failed to refresh marketplace:', error);
    }
  }, [loadMarketplace]);

  /**
   * Get server logs
   */
  const getServerLogs = useCallback(async (serverName: string, lines: number = 100): Promise<string[]> => {
    try {
      return await mcpClient.getServerLogs(serverName, lines);
    } catch (error) {
      console.error(`Failed to get logs for ${serverName}:`, error);
      return [];
    }
  }, [mcpClient]);

  /**
   * Clear server logs (optional - not yet implemented in MCPClient)
   */
  const clearServerLogs = useCallback(async (serverName: string): Promise<void> => {
    // This would require implementing log clearing in MCPClient
    // For now, this is a placeholder
    console.warn(`Clear logs not yet implemented for ${serverName}`);
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
  };

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>;
}
