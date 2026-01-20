/**
 * Test utilities for MCP components
 * 
 * Provides mock factories and helpers for testing MCP-related components.
 * Use these utilities to create consistent mocks across test files.
 */

import { vi } from 'vitest';
import type { MCPClient } from '@ollm/ollm-cli-core/mcp/types.js';
import type { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import type { MCPOAuthProvider } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';
import type { ExtendedMCPServerStatus } from '../MCPContext.js';

/**
 * Create a mock MCPClient for testing
 */
export function createMockMCPClient(overrides?: Partial<MCPClient>): Partial<MCPClient> {
  return {
    getAllServerStatuses: vi.fn().mockReturnValue(new Map()),
    restartServer: vi.fn().mockResolvedValue(undefined),
    getServerLogs: vi.fn().mockResolvedValue([]),
    getTools: vi.fn().mockResolvedValue([]),
    startServer: vi.fn().mockResolvedValue(undefined),
    stopServer: vi.fn().mockResolvedValue(undefined),
    getServerStatus: vi.fn().mockReturnValue({
      name: 'test-server',
      status: 'connected' as const,
      tools: 0,
      uptime: 1000,
    }),
    listServers: vi.fn().mockReturnValue([]),
    callTool: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

/**
 * Create a mock MCPHealthMonitor for testing
 */
export function createMockHealthMonitor(overrides?: Partial<MCPHealthMonitor>): Partial<MCPHealthMonitor> {
  return {
    start: vi.fn().mockReturnValue(undefined),
    stop: vi.fn().mockReturnValue(undefined),
    subscribeToHealthUpdates: vi.fn().mockReturnValue(() => {}),
    getServerHealth: vi.fn().mockReturnValue({
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 100,
    }),
    getAllServerHealth: vi.fn().mockReturnValue(new Map()),
    ...overrides,
  };
}

/**
 * Create a mock MCPOAuthProvider for testing
 */
export function createMockOAuthProvider(overrides?: Partial<MCPOAuthProvider>): Partial<MCPOAuthProvider> {
  return {
    getOAuthStatus: vi.fn().mockReturnValue({
      connected: false,
    }),
    authorize: vi.fn().mockResolvedValue('https://oauth.example.com'),
    refreshToken: vi.fn().mockResolvedValue(undefined),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Create a mock server status for testing
 */
export function createMockServerStatus(
  name: string,
  overrides?: Partial<ExtendedMCPServerStatus>
): ExtendedMCPServerStatus {
  return {
    name,
    status: 'connected' as const,
    tools: 0,
    uptime: 1000,
    config: {
      command: 'test',
      args: [],
      env: {},
      disabled: false,
      autoApprove: [],
    },
    health: 'healthy',
    toolsList: [],
    oauthStatus: {
      connected: false,
    },
    ...overrides,
  };
}

/**
 * Setup standard MCP service mocks
 * Call this in beforeEach to set up consistent mocks
 */
export function setupMCPServiceMocks() {
  // Mock config service
  vi.mock('../../../../services/mcpConfigService.js', () => ({
    mcpConfigService: {
      loadMCPConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
      updateServerConfig: vi.fn().mockResolvedValue(undefined),
      removeServerConfig: vi.fn().mockResolvedValue(undefined),
      startWatching: vi.fn(),
      stopWatching: vi.fn(),
      addChangeListener: vi.fn(),
      removeChangeListener: vi.fn(),
    },
  }));

  // Mock marketplace service
  vi.mock('../../../../services/mcpMarketplace.js', () => ({
    mcpMarketplace: {
      getPopularServers: vi.fn().mockResolvedValue([
        {
          id: 'test-server-1',
          name: 'Test Server 1',
          description: 'A test server',
          rating: 4.5,
          installCount: 1000,
          requiresOAuth: false,
          requirements: [],
          command: 'test',
          args: [],
        },
      ]),
      searchServers: vi.fn().mockResolvedValue([]),
      refreshCache: vi.fn().mockResolvedValue(undefined),
      installServer: vi.fn().mockResolvedValue(undefined),
      getServerDetails: vi.fn().mockResolvedValue({
        id: 'test-server',
        name: 'test-server',
        description: 'Test server',
        rating: 5,
        installCount: 100,
        requiresOAuth: false,
        requirements: [],
        command: 'test',
        args: [],
      }),
    },
  }));

  // Mock MCP core modules
  vi.mock('@ollm/ollm-cli-core/mcp/mcpClient.js', () => ({
    DefaultMCPClient: vi.fn().mockImplementation(() => createMockMCPClient()),
  }));

  vi.mock('@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js', () => ({
    MCPHealthMonitor: vi.fn().mockImplementation(() => createMockHealthMonitor()),
  }));

  vi.mock('@ollm/ollm-cli-core/mcp/mcpOAuth.js', () => ({
    MCPOAuthProvider: vi.fn().mockImplementation(() => createMockOAuthProvider()),
    FileTokenStorage: vi.fn().mockImplementation(() => ({
      saveToken: vi.fn().mockResolvedValue(undefined),
      loadToken: vi.fn().mockResolvedValue(null),
      deleteToken: vi.fn().mockResolvedValue(undefined),
    })),
  }));
}

/**
 * Create a test MCPContext value with mock data
 */
export function createMockMCPContextValue(overrides?: Partial<ReturnType<typeof import('../MCPContext.js').useMCP>>) {
  const servers = new Map<string, ExtendedMCPServerStatus>();
  
  return {
    state: {
      servers,
      config: { mcpServers: {} },
      marketplace: [],
      isLoading: false,
      error: null,
    },
    toggleServer: vi.fn().mockResolvedValue(undefined),
    restartServer: vi.fn().mockResolvedValue(undefined),
    installServer: vi.fn().mockResolvedValue(undefined),
    uninstallServer: vi.fn().mockResolvedValue(undefined),
    configureServer: vi.fn().mockResolvedValue(undefined),
    configureOAuth: vi.fn().mockResolvedValue(undefined),
    refreshOAuthToken: vi.fn().mockResolvedValue(undefined),
    revokeOAuthAccess: vi.fn().mockResolvedValue(undefined),
    getServerTools: vi.fn().mockReturnValue([]),
    setToolAutoApprove: vi.fn().mockResolvedValue(undefined),
    getServerLogs: vi.fn().mockResolvedValue([]),
    clearServerLogs: vi.fn().mockResolvedValue(undefined),
    searchMarketplace: vi.fn().mockResolvedValue([]),
    refreshMarketplace: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
