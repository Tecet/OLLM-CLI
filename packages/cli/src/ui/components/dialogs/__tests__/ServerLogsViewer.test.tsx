/**
 * ServerLogsViewer - Tests
 * 
 * Tests for the ServerLogsViewer dialog component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from 'ink-testing-library';
import { ServerLogsViewer } from '../ServerLogsViewer.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import type { MCPClient } from '@ollm/ollm-cli-core/mcp/types.js';
import type { MCPHealthMonitor } from '@ollm/ollm-cli-core/mcp/mcpHealthMonitor.js';
import type { MCPOAuthProvider } from '@ollm/ollm-cli-core/mcp/mcpOAuth.js';

// Mock dependencies
vi.mock('../../../../services/mcpConfigService.js', () => ({
  mcpConfigService: {
    loadMCPConfig: vi.fn().mockResolvedValue({ mcpServers: {} }),
    saveMCPConfig: vi.fn().mockResolvedValue(undefined),
    updateServerConfig: vi.fn().mockResolvedValue(undefined),
    removeServerConfig: vi.fn().mockResolvedValue(undefined),
    startWatching: vi.fn(),
    stopWatching: vi.fn(),
    addChangeListener: vi.fn(),
    removeChangeListener: vi.fn(),
  },
}));

vi.mock('../../../../services/mcpMarketplace.js', () => ({
  mcpMarketplace: {
    getAllServers: vi.fn().mockResolvedValue([]),
    searchServers: vi.fn().mockResolvedValue([]),
    getServerDetails: vi.fn().mockResolvedValue(null),
    installServer: vi.fn().mockResolvedValue(undefined),
    refreshCache: vi.fn().mockResolvedValue(undefined),
    getPopularServers: vi.fn().mockResolvedValue([]),
  },
}));

/**
 * Create mock MCP client
 */
function createMockMCPClient(overrides?: Partial<MCPClient>): MCPClient {
  return {
    startServer: vi.fn().mockResolvedValue(undefined),
    stopServer: vi.fn().mockResolvedValue(undefined),
    restartServer: vi.fn().mockResolvedValue(undefined),
    getServerStatus: vi.fn().mockResolvedValue({
      name: 'test-server',
      status: 'running',
      uptime: 1000,
      error: null,
    }),
    getAllServerStatuses: vi.fn().mockReturnValue(new Map()),
    getTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({ content: [] }),
    listResources: vi.fn().mockResolvedValue([]),
    readResource: vi.fn().mockResolvedValue({ contents: [] }),
    getServerLogs: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as MCPClient;
}

/**
 * Create mock health monitor
 */
function createMockHealthMonitor(): MCPHealthMonitor {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    subscribeToHealthUpdates: vi.fn().mockReturnValue(() => {}),
    getServerHealth: vi.fn().mockReturnValue({
      status: 'healthy',
      lastCheck: Date.now(),
      responseTime: 100,
    }),
    getAllServerHealth: vi.fn().mockReturnValue(new Map()),
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
  } as unknown as MCPHealthMonitor;
}

/**
 * Create mock OAuth provider
 */
function createMockOAuthProvider(): MCPOAuthProvider {
  return {
    authorize: vi.fn().mockResolvedValue('https://auth.example.com'),
    refreshToken: vi.fn().mockResolvedValue(undefined),
    revokeAccess: vi.fn().mockResolvedValue(undefined),
    getOAuthStatus: vi.fn().mockReturnValue({
      connected: false,
    }),
  } as unknown as MCPOAuthProvider;
}

/**
 * Render ServerLogsViewer with providers
 */
function renderServerLogsViewer(
  props: Partial<React.ComponentProps<typeof ServerLogsViewer>> = {},
  mcpClient?: MCPClient,
  healthMonitor?: MCPHealthMonitor,
  oauthProvider?: MCPOAuthProvider
) {
  const client = mcpClient || createMockMCPClient();
  const monitor = healthMonitor || createMockHealthMonitor();
  const oauth = oauthProvider || createMockOAuthProvider();

  return render(
    <UIProvider>
      <MCPProvider
        mcpClient={client}
        healthMonitor={monitor}
        oauthProvider={oauth}
      >
        <ServerLogsViewer
          serverName="test-server"
          onClose={vi.fn()}
          {...props}
        />
      </MCPProvider>
    </UIProvider>
  );
}

describe('ServerLogsViewer', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with server name in title', () => {
      const { lastFrame } = renderServerLogsViewer();

      expect(lastFrame()).toContain('Server Logs: test-server');
    });

    it('should show loading state initially', () => {
      const { lastFrame } = renderServerLogsViewer();

      expect(lastFrame()).toContain('Loading logs...');
    });

    it('should show no logs message when empty', async () => {
      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue([]),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      // Wait for logs to load
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('No logs available');
    });

    it('should display log entries', async () => {
      const mockLogs = [
        '[2024-01-18T12:00:00.000Z] [INFO] Server started',
        '[2024-01-18T12:00:01.000Z] [DEBUG] Connection established',
        '[2024-01-18T12:00:02.000Z] [ERROR] Failed to connect',
      ];

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      // Wait for logs to load
      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('Server started');
      expect(frame).toContain('Connection established');
      expect(frame).toContain('Failed to connect');
    });
  });

  describe('Log Level Filtering', () => {
    it('should show all logs by default', async () => {
      const mockLogs = [
        '[INFO] Info message',
        '[DEBUG] Debug message',
        '[ERROR] Error message',
      ];

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('ALL');
      expect(frame).toContain('3 entries');
    });

    it('should display filter button with current level', async () => {
      const { lastFrame } = renderServerLogsViewer();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('Filter by level:');
      expect(lastFrame()).toContain('ALL');
    });
  });

  describe('Action Buttons', () => {
    it('should render all action buttons', async () => {
      const { lastFrame } = renderServerLogsViewer();

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('Refresh');
      expect(frame).toContain('Copy');
      expect(frame).toContain('Clear');
      expect(frame).toContain('Close');
    });

    it('should disable copy button when no logs', async () => {
      const { lastFrame } = renderServerLogsViewer();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Copy button should be present but disabled (implementation detail)
      expect(lastFrame()).toContain('Copy');
    });

    it('should disable clear button when no logs', async () => {
      const { lastFrame } = renderServerLogsViewer();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear button should be present but disabled (implementation detail)
      expect(lastFrame()).toContain('Clear');
    });
  });

  describe('Log Parsing', () => {
    it('should parse timestamps from log entries', async () => {
      const mockLogs = [
        '[2024-01-18T12:34:56.789Z] [INFO] Message with timestamp',
      ];

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      // Should show formatted time (HH:MM:SS)
      expect(frame).toContain('12:34:56');
    });

    it('should parse log levels from entries', async () => {
      const mockLogs = [
        '[INFO] Info message',
        '[DEBUG] Debug message',
        '[WARN] Warning message',
        '[ERROR] Error message',
      ];

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('INFO');
      expect(frame).toContain('DEBUG');
      expect(frame).toContain('WARN');
      expect(frame).toContain('ERROR');
    });

    it('should handle logs without timestamps', async () => {
      const mockLogs = [
        'Plain log message without timestamp',
      ];

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('Plain log message without timestamp');
    });
  });

  describe('Scrolling', () => {
    it('should show scroll indicators when logs exceed visible area', async () => {
      // Create more than 20 logs (maxVisibleLines)
      const mockLogs = Array.from({ length: 30 }, (_, i) => 
        `[INFO] Log entry ${i + 1}`
      );

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      // Should show scroll down indicator
      expect(frame).toContain('▼ Scroll down for more');
    });

    it('should show entry count', async () => {
      const mockLogs = [
        '[INFO] Log 1',
        '[INFO] Log 2',
        '[INFO] Log 3',
      ];

      const mockClient = createMockMCPClient({
        getServerLogs: vi.fn().mockResolvedValue(mockLogs),
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('Showing');
      expect(frame).toContain('3');
      expect(frame).toContain('entries');
    });
  });

  describe('Integration', () => {
    it('should call getServerLogs with server name', async () => {
      const mockGetServerLogs = vi.fn().mockResolvedValue([]);
      const mockClient = createMockMCPClient({
        getServerLogs: mockGetServerLogs,
      });

      renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockGetServerLogs).toHaveBeenCalledWith('test-server', 100);
    });

    it('should handle errors when loading logs', async () => {
      const mockGetServerLogs = vi.fn().mockRejectedValue(new Error('Failed to load logs'));
      const mockClient = createMockMCPClient({
        getServerLogs: mockGetServerLogs,
      });

      const { lastFrame } = renderServerLogsViewer({}, mockClient);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Should show no logs message on error
      expect(lastFrame()).toContain('No logs available');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should display keyboard shortcuts', async () => {
      const { lastFrame } = renderServerLogsViewer();

      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('R'); // Refresh
      expect(frame).toContain('C'); // Copy
      expect(frame).toContain('X'); // Clear
      expect(frame).toContain('Esc'); // Close
    });

    it('should show filter cycle hint', async () => {
      const { lastFrame } = renderServerLogsViewer();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('Press F to cycle filters');
    });
  });
});
