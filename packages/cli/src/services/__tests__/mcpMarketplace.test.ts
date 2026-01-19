/**
 * Tests for MCP Marketplace Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MCPMarketplace } from '../mcpMarketplace.js';
import { mcpConfigService } from '../mcpConfigService.js';

// Mock the config service
vi.mock('../mcpConfigService.js', () => ({
  mcpConfigService: {
    updateServerConfig: vi.fn(),
  },
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('MCPMarketplace', () => {
  let marketplace: MCPMarketplace;

  beforeEach(() => {
    marketplace = new MCPMarketplace();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllServers', () => {
    it('should fetch servers from API on first call', async () => {
      const mockServers = [
        {
          id: 'test-server',
          name: 'Test Server',
          description: 'A test server',
          rating: 5,
          installCount: 100,
          requiresOAuth: false,
          requirements: ['Node.js 18+'],
          command: 'npx',
          args: ['-y', 'test-server'],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });

      const servers = await marketplace.getAllServers();

      expect(servers).toEqual(mockServers);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('mcp-marketplace'),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('should use cached data on subsequent calls within TTL', async () => {
      const mockServers = [
        {
          id: 'test-server',
          name: 'Test Server',
          description: 'A test server',
          rating: 5,
          installCount: 100,
          requiresOAuth: false,
          requirements: ['Node.js 18+'],
          command: 'npx',
          args: ['-y', 'test-server'],
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });

      // First call - should fetch
      await marketplace.getAllServers();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      await marketplace.getAllServers();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should fallback to local registry on API failure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const servers = await marketplace.getAllServers();

      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0]).toHaveProperty('id');
      expect(servers[0]).toHaveProperty('name');
      expect(servers[0]).toHaveProperty('description');
    });

    it('should fallback to local registry on non-OK response', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const servers = await marketplace.getAllServers();

      expect(servers.length).toBeGreaterThan(0);
    });
  });

  describe('searchServers', () => {
    beforeEach(async () => {
      // Setup cache with local registry
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      await marketplace.getAllServers();
    });

    it('should return all servers when query is empty', async () => {
      const servers = await marketplace.searchServers('');
      expect(servers.length).toBeGreaterThan(0);
    });

    it('should filter servers by name', async () => {
      const servers = await marketplace.searchServers('filesystem');
      expect(servers.length).toBeGreaterThan(0);
      expect(servers[0].name.toLowerCase()).toContain('filesystem');
    });

    it('should filter servers by description', async () => {
      const servers = await marketplace.searchServers('database');
      expect(servers.length).toBeGreaterThan(0);
      expect(
        servers.some((s) => s.description.toLowerCase().includes('database'))
      ).toBe(true);
    });

    it('should filter servers by category', async () => {
      const servers = await marketplace.searchServers('development');
      expect(servers.length).toBeGreaterThan(0);
      expect(
        servers.some((s) => s.category?.toLowerCase().includes('development'))
      ).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const lowerCase = await marketplace.searchServers('github');
      const upperCase = await marketplace.searchServers('GITHUB');
      expect(lowerCase).toEqual(upperCase);
    });

    it('should return empty array when no matches found', async () => {
      const servers = await marketplace.searchServers('nonexistent-server-xyz');
      expect(servers).toEqual([]);
    });
  });

  describe('getServerDetails', () => {
    beforeEach(async () => {
      // Setup cache with local registry
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      await marketplace.getAllServers();
    });

    it('should return server details for valid ID', async () => {
      const server = await marketplace.getServerDetails('filesystem');
      expect(server).toBeDefined();
      expect(server.id).toBe('filesystem');
      expect(server.name).toBe('filesystem');
    });

    it('should throw error for invalid server ID', async () => {
      await expect(
        marketplace.getServerDetails('nonexistent-server')
      ).rejects.toThrow('Server not found: nonexistent-server');
    });
  });

  describe('installServer', () => {
    beforeEach(async () => {
      // Setup cache with local registry
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      await marketplace.getAllServers();
    });

    it('should install server with provided config', async () => {
      const config = {
        command: 'custom-command',
        args: ['--custom-arg'],
        env: { CUSTOM_VAR: 'value' },
      };

      await marketplace.installServer('filesystem', config);

      expect(mcpConfigService.updateServerConfig).toHaveBeenCalledWith(
        'filesystem',
        expect.objectContaining({
          command: 'custom-command',
          args: ['--custom-arg'],
          env: expect.objectContaining({ CUSTOM_VAR: 'value' }),
        })
      );
    });

    it('should use marketplace defaults when config not provided', async () => {
      await marketplace.installServer('filesystem', {});

      expect(mcpConfigService.updateServerConfig).toHaveBeenCalledWith(
        'filesystem',
        expect.objectContaining({
          command: 'npx',
          args: expect.arrayContaining(['-y', '@modelcontextprotocol/server-filesystem']),
        })
      );
    });

    it('should merge environment variables', async () => {
      const config = {
        env: { CUSTOM_VAR: 'custom-value' },
      };

      await marketplace.installServer('github', config);

      expect(mcpConfigService.updateServerConfig).toHaveBeenCalledWith(
        'github',
        expect.objectContaining({
          env: expect.objectContaining({
            GITHUB_PERSONAL_ACCESS_TOKEN: '',
            CUSTOM_VAR: 'custom-value',
          }),
        })
      );
    });

    it('should throw error for servers requiring API keys without env vars', async () => {
      await expect(
        marketplace.installServer('github', {})
      ).rejects.toThrow(/requires environment variables/);
    });

    it('should throw error for nonexistent server', async () => {
      await expect(
        marketplace.installServer('nonexistent-server', {})
      ).rejects.toThrow('Server not found: nonexistent-server');
    });
  });

  describe('getPopularServers', () => {
    beforeEach(async () => {
      // Setup cache with local registry
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      await marketplace.getAllServers();
    });

    it('should return servers sorted by install count', async () => {
      const servers = await marketplace.getPopularServers();
      
      expect(servers.length).toBeGreaterThan(0);
      
      // Check that servers are sorted by install count (descending)
      for (let i = 0; i < servers.length - 1; i++) {
        expect(servers[i].installCount).toBeGreaterThanOrEqual(
          servers[i + 1].installCount
        );
      }
    });

    it('should limit results to specified count', async () => {
      const servers = await marketplace.getPopularServers(3);
      expect(servers.length).toBe(3);
    });

    it('should default to 10 servers', async () => {
      const servers = await marketplace.getPopularServers();
      expect(servers.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getServersByCategory', () => {
    beforeEach(async () => {
      // Setup cache with local registry
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      await marketplace.getAllServers();
    });

    it('should return servers in specified category', async () => {
      const servers = await marketplace.getServersByCategory('Database');
      
      expect(servers.length).toBeGreaterThan(0);
      expect(
        servers.every((s) => s.category?.toLowerCase() === 'database')
      ).toBe(true);
    });

    it('should be case-insensitive', async () => {
      const lowerCase = await marketplace.getServersByCategory('database');
      const upperCase = await marketplace.getServersByCategory('DATABASE');
      expect(lowerCase).toEqual(upperCase);
    });

    it('should return empty array for nonexistent category', async () => {
      const servers = await marketplace.getServersByCategory('NonexistentCategory');
      expect(servers).toEqual([]);
    });
  });

  describe('refreshCache', () => {
    it('should clear cache and fetch fresh data', async () => {
      const mockServers = [
        {
          id: 'test-server',
          name: 'Test Server',
          description: 'A test server',
          rating: 5,
          installCount: 100,
          requiresOAuth: false,
          requirements: ['Node.js 18+'],
          command: 'npx',
          args: ['-y', 'test-server'],
        },
      ];

      // First call - use local registry
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      await marketplace.getAllServers();
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Refresh cache - should fetch again
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockServers,
      });
      await marketplace.refreshCache();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('local registry', () => {
    it('should include popular MCP servers', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      
      const servers = await marketplace.getAllServers();
      
      expect(servers.length).toBeGreaterThan(0);
      
      // Check for some expected servers
      const serverIds = servers.map((s) => s.id);
      expect(serverIds).toContain('filesystem');
      expect(serverIds).toContain('github');
      expect(serverIds).toContain('postgres');
    });

    it('should have valid server structure', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Use local'));
      
      const servers = await marketplace.getAllServers();
      
      for (const server of servers) {
        expect(server).toHaveProperty('id');
        expect(server).toHaveProperty('name');
        expect(server).toHaveProperty('description');
        expect(server).toHaveProperty('rating');
        expect(server).toHaveProperty('installCount');
        expect(server).toHaveProperty('requiresOAuth');
        expect(server).toHaveProperty('requirements');
        expect(server).toHaveProperty('command');
        expect(typeof server.rating).toBe('number');
        expect(typeof server.installCount).toBe('number');
        expect(typeof server.requiresOAuth).toBe('boolean');
        expect(Array.isArray(server.requirements)).toBe(true);
      }
    });
  });
});

