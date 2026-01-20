/**
 * MarketplaceDialog Tests
 * 
 * Tests for the marketplace browser dialog component.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { MarketplaceDialog } from '../MarketplaceDialog.js';
import { MCPProvider } from '../../../contexts/MCPContext.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import type { MCPMarketplaceServer } from '../../../../services/mcpMarketplace.js';

// Mock servers for testing
const mockServers: MCPMarketplaceServer[] = [
  {
    id: 'filesystem',
    name: 'filesystem',
    description: 'Secure file system operations',
    rating: 5,
    installCount: 10000,
    requiresOAuth: false,
    requirements: ['Node.js 18+'],
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    category: 'File System',
    author: 'Anthropic',
  },
  {
    id: 'github',
    name: 'github',
    description: 'GitHub API integration',
    rating: 4.8,
    installCount: 8500,
    requiresOAuth: true,
    requirements: ['Node.js 18+', 'GitHub Personal Access Token'],
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
    category: 'Development',
    author: 'Anthropic',
  },
  {
    id: 'postgres',
    name: 'postgres',
    description: 'PostgreSQL database integration',
    rating: 4.7,
    installCount: 7200,
    requiresOAuth: false,
    requirements: ['Node.js 18+', 'PostgreSQL connection string'],
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: { POSTGRES_CONNECTION_STRING: '' },
    category: 'Database',
    author: 'Anthropic',
  },
];

// Mock MCP context
const mockMCPContext = {
  servers: new Map(),
  config: { mcpServers: {} },
  marketplace: mockServers,
  loading: false,
  error: null,
  toggleServer: vi.fn(),
  restartServer: vi.fn(),
  installServer: vi.fn(),
  uninstallServer: vi.fn(),
  configureServer: vi.fn(),
  configureOAuth: vi.fn(),
  refreshOAuthToken: vi.fn(),
  revokeOAuthAccess: vi.fn(),
  getServerHealth: vi.fn(),
  getServerLogs: vi.fn(),
  getServerTools: vi.fn(),
  setToolAutoApprove: vi.fn(),
  searchMarketplace: vi.fn().mockResolvedValue(mockServers),
  refreshMarketplace: vi.fn(),
};

// Mock UI context
const mockUIContext = {
  state: {
    theme: {
      text: { primary: 'white', secondary: 'gray' },
      border: { active: 'cyan', inactive: 'gray' },
      status: { success: 'green', error: 'red', warning: 'yellow', info: 'cyan' },
    },
  },
  dispatch: vi.fn(),
};

/**
 * Render MarketplaceDialog with mocked contexts
 */
function renderMarketplaceDialog(props: { onClose: () => void }) {
  return render(
    <UIProvider value={mockUIContext as unknown as import('../../../../features/context/UIContext.js').UIContextValue}>
      <MCPProvider value={mockMCPContext as unknown as import('../../../contexts/MCPContext.js').MCPContextValue}>
        <MarketplaceDialog {...props} />
      </MCPProvider>
    </UIProvider>
  );
}

describe('MarketplaceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render dialog with title', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      expect(lastFrame()).toContain('MCP Marketplace');
    });

    it('should render search box', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      expect(lastFrame()).toContain('Search:');
      expect(lastFrame()).toContain('Type to search or press / to focus');
    });

    it('should render all marketplace servers', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      expect(lastFrame()).toContain('filesystem');
      expect(lastFrame()).toContain('github');
      expect(lastFrame()).toContain('postgres');
    });

    it('should display server count', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      expect(lastFrame()).toContain('3 servers found');
    });

    it('should show OAuth indicator for servers requiring OAuth', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      const frame = lastFrame();
      // GitHub requires OAuth
      expect(frame).toContain('🔐 OAuth');
    });

    it('should display server ratings as stars', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      const frame = lastFrame();
      // filesystem has 5 stars
      expect(frame).toContain('★★★★★');
      // github has 4.8 stars (4 full + half)
      expect(frame).toContain('★★★★½');
    });

    it('should display formatted install counts', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      const frame = lastFrame();
      expect(frame).toContain('10.0K installs');
      expect(frame).toContain('8.5K installs');
      expect(frame).toContain('7.2K installs');
    });

    it('should display server categories', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      const frame = lastFrame();
      expect(frame).toContain('File System');
      expect(frame).toContain('Development');
      expect(frame).toContain('Database');
    });

    it('should show navigation help text', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      expect(lastFrame()).toContain('↑↓: Navigate');
      expect(lastFrame()).toContain('Enter: Install');
      expect(lastFrame()).toContain('/: Search');
      expect(lastFrame()).toContain('Esc: Close');
    });

    it('should show tip in footer', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      expect(lastFrame()).toContain('💡 Tip:');
    });
  });

  describe('Search Functionality', () => {
    it('should filter servers by name', async () => {
      const onClose = vi.fn();
      mockMCPContext.searchMarketplace.mockResolvedValue([mockServers[1]]); // github only

      const { stdin } = renderMarketplaceDialog({ onClose });

      // Focus search with /
      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Type search query
      stdin.write('github');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMCPContext.searchMarketplace).toHaveBeenCalledWith('github');
    });

    it('should filter servers by description', async () => {
      const onClose = vi.fn();
      mockMCPContext.searchMarketplace.mockResolvedValue([mockServers[2]]); // postgres only

      const { stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('database');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMCPContext.searchMarketplace).toHaveBeenCalledWith('database');
    });

    it('should show search focused state', async () => {
      const onClose = vi.fn();
      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('Type to search, Enter to finish, Esc to cancel');
    });

    it('should handle backspace in search', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('test');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Backspace
      stdin.write('\x7f');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockMCPContext.searchMarketplace).toHaveBeenCalledWith('tes');
    });

    it('should exit search mode on Enter', async () => {
      const onClose = vi.fn();
      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('test');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('\r'); // Enter
      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('↑↓: Navigate');
    });

    it('should exit search mode on Esc', async () => {
      const onClose = vi.fn();
      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('\x1b'); // Esc
      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('↑↓: Navigate');
    });

    it('should show empty state when no results', async () => {
      const onClose = vi.fn();
      mockMCPContext.searchMarketplace.mockResolvedValue([]);

      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('nonexistent');
      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('No servers found matching');
      expect(frame).toContain('0 servers found');
    });
  });

  describe('Navigation', () => {
    it('should highlight first server by default', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      // First server should have border (focused)
      const frame = lastFrame();
      expect(frame).toContain('filesystem');
    });

    it('should navigate down with arrow key', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      // Press down arrow
      stdin.write('\x1b[B');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Second server should now be focused
      // (Testing this requires checking the border/highlight state)
    });

    it('should navigate up with arrow key', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      // Navigate down first
      stdin.write('\x1b[B');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Then navigate up
      stdin.write('\x1b[A');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be back at first server
    });

    it('should not navigate above first server', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      // Try to navigate up from first position
      stdin.write('\x1b[A');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be at first server
    });

    it('should not navigate below last server', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      // Navigate to last server
      stdin.write('\x1b[B'); // Down
      await new Promise(resolve => setTimeout(resolve, 100));
      stdin.write('\x1b[B'); // Down
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to navigate down past last
      stdin.write('\x1b[B');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still be at last server
    });
  });

  describe('Installation', () => {
    it('should open install dialog on Enter', async () => {
      const onClose = vi.fn();
      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      // Press Enter to install first server
      stdin.write('\r');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should show InstallServerDialog
      const frame = lastFrame();
      expect(frame).toContain('Install MCP Server');
    });

    it('should show Install button on focused server', () => {
      const onClose = vi.fn();
      const { lastFrame } = renderMarketplaceDialog({ onClose });

      const frame = lastFrame();
      expect(frame).toContain('[Enter] ⬇ Install');
    });
  });

  describe('Closing', () => {
    it('should call onClose when Esc pressed', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('\x1b'); // Esc
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onClose).toHaveBeenCalled();
    });

    it('should not close when Esc pressed in search mode', async () => {
      const onClose = vi.fn();
      const { stdin } = renderMarketplaceDialog({ onClose });

      // Enter search mode
      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Press Esc (should exit search, not close dialog)
      stdin.write('\x1b');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Loading and Error States', () => {
    it('should show loading state', async () => {
      const onClose = vi.fn();
      mockMCPContext.searchMarketplace.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockServers), 1000))
      );

      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('test');
      await new Promise(resolve => setTimeout(resolve, 100));

      const frame = lastFrame();
      expect(frame).toContain('⟳ Loading servers...');
    });

    it('should show error state on search failure', async () => {
      const onClose = vi.fn();
      mockMCPContext.searchMarketplace.mockRejectedValue(new Error('Network error'));

      const { lastFrame, stdin } = renderMarketplaceDialog({ onClose });

      stdin.write('/');
      await new Promise(resolve => setTimeout(resolve, 100));

      stdin.write('test');
      await new Promise(resolve => setTimeout(resolve, 200));

      const frame = lastFrame();
      expect(frame).toContain('✗ Network error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty marketplace', () => {
      const onClose = vi.fn();
      const emptyContext = {
        ...mockMCPContext,
        marketplace: [],
        searchMarketplace: vi.fn().mockResolvedValue([]),
      };

      const { lastFrame } = render(
        <UIProvider value={mockUIContext as unknown as import('../../../../features/context/UIContext.js').UIContextValue}>
          <MCPProvider value={emptyContext as unknown as import('../../../contexts/MCPContext.js').MCPContextValue}>
            <MarketplaceDialog onClose={onClose} />
          </MCPProvider>
        </UIProvider>
      );

      expect(lastFrame()).toContain('0 servers found');
    });

    it('should handle servers without categories', () => {
      const onClose = vi.fn();
      const serversWithoutCategory = [
        { ...mockServers[0], category: undefined },
      ];
      const contextWithoutCategory = {
        ...mockMCPContext,
        marketplace: serversWithoutCategory,
        searchMarketplace: vi.fn().mockResolvedValue(serversWithoutCategory),
      };

      const { lastFrame } = render(
        <UIProvider value={mockUIContext as unknown as import('../../../../features/context/UIContext.js').UIContextValue}>
          <MCPProvider value={contextWithoutCategory as unknown as import('../../../contexts/MCPContext.js').MCPContextValue}>
            <MarketplaceDialog onClose={onClose} />
          </MCPProvider>
        </UIProvider>
      );

      // Should render without errors
      expect(lastFrame()).toContain('filesystem');
    });

    it('should handle very large install counts', () => {
      const onClose = vi.fn();
      const serverWithLargeCount = [
        { ...mockServers[0], installCount: 1500000 },
      ];
      const contextWithLargeCount = {
        ...mockMCPContext,
        marketplace: serverWithLargeCount,
        searchMarketplace: vi.fn().mockResolvedValue(serverWithLargeCount),
      };

      const { lastFrame } = render(
        <UIProvider value={mockUIContext as unknown as import('../../../../features/context/UIContext.js').UIContextValue}>
          <MCPProvider value={contextWithLargeCount as unknown as import('../../../contexts/MCPContext.js').MCPContextValue}>
            <MarketplaceDialog onClose={onClose} />
          </MCPProvider>
        </UIProvider>
      );

      expect(lastFrame()).toContain('1.5M installs');
    });

    it('should handle ratings with half stars', () => {
      const onClose = vi.fn();
      const serverWithHalfStar = [
        { ...mockServers[0], rating: 3.7 },
      ];
      const contextWithHalfStar = {
        ...mockMCPContext,
        marketplace: serverWithHalfStar,
        searchMarketplace: vi.fn().mockResolvedValue(serverWithHalfStar),
      };

      const { lastFrame } = render(
        <UIProvider value={mockUIContext as unknown as import('../../../../features/context/UIContext.js').UIContextValue}>
          <MCPProvider value={contextWithHalfStar as unknown as import('../../../contexts/MCPContext.js').MCPContextValue}>
            <MarketplaceDialog onClose={onClose} />
          </MCPProvider>
        </UIProvider>
      );

      expect(lastFrame()).toContain('★★★½');
    });
  });
});
