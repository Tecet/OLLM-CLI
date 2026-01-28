/**
 * Integration Tests for MCP Marketplace Service
 *
 * These tests verify real connectivity and behavior without mocks.
 * They test the actual fallback logic and local registry functionality.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { MCPMarketplace } from '../mcpMarketplace.js';

describe('MCPMarketplace - Integration Tests (Real Behavior)', () => {
  let marketplace: MCPMarketplace;

  beforeEach(() => {
    marketplace = new MCPMarketplace();
  });

  describe('Real API Connectivity', () => {
    it('should attempt to fetch from marketplace API and fallback to local registry', async () => {
      // This test makes a REAL fetch call to the marketplace URL
      // Since the URL is currently a placeholder (example.com), it will fail
      // and fallback to the local registry - this tests the real fallback logic

      const servers = await marketplace.getAllServers();

      // Should have servers from local registry
      expect(servers).toBeDefined();
      expect(Array.isArray(servers)).toBe(true);
      expect(servers.length).toBeGreaterThan(0);

      // Verify local registry has expected servers
      const serverIds = servers.map((s) => s.id);
      expect(serverIds).toContain('filesystem');
      expect(serverIds).toContain('github');
      expect(serverIds).toContain('postgres');

      console.log(
        `✓ Marketplace fallback working: ${servers.length} servers loaded from local registry`
      );
    }, 10000); // 10 second timeout for network call

    it('should cache results after first call', async () => {
      const startTime1 = Date.now();
      const servers1 = await marketplace.getAllServers();
      const duration1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      const servers2 = await marketplace.getAllServers();
      const duration2 = Date.now() - startTime2;

      // Second call should be much faster (cached)
      expect(duration2).toBeLessThan(duration1);
      expect(servers1).toEqual(servers2);

      console.log(`✓ Cache working: First call ${duration1}ms, Second call ${duration2}ms`);
    }, 10000);
  });

  describe('Real Search Functionality', () => {
    it('should search through real local registry data', async () => {
      // Load servers (will use local registry)
      await marketplace.getAllServers();

      // Test real search
      const filesystemServers = await marketplace.searchServers('filesystem');
      expect(filesystemServers.length).toBeGreaterThan(0);
      expect(filesystemServers[0].name).toBe('filesystem');

      const databaseServers = await marketplace.searchServers('database');
      expect(databaseServers.length).toBeGreaterThan(0);
      expect(
        databaseServers.every(
          (s) =>
            s.description.toLowerCase().includes('database') ||
            s.category?.toLowerCase().includes('database')
        )
      ).toBe(true);

      console.log(
        `✓ Search working: Found ${filesystemServers.length} filesystem servers, ${databaseServers.length} database servers`
      );
    });

    it('should handle case-insensitive search', async () => {
      await marketplace.getAllServers();

      const lower = await marketplace.searchServers('github');
      const upper = await marketplace.searchServers('GITHUB');
      const mixed = await marketplace.searchServers('GiTHuB');

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);

      console.log(`✓ Case-insensitive search working: ${lower.length} results`);
    });
  });

  describe('Real Server Details', () => {
    it('should retrieve real server details from local registry', async () => {
      await marketplace.getAllServers();

      const filesystem = await marketplace.getServerDetails('filesystem');

      expect(filesystem).toBeDefined();
      expect(filesystem.id).toBe('filesystem');
      expect(filesystem.name).toBe('filesystem');
      expect(filesystem.command).toBe('npx');
      expect(filesystem.args).toContain('-y');
      expect(filesystem.rating).toBeGreaterThan(0);
      expect(filesystem.installCount).toBeGreaterThan(0);

      console.log(`✓ Server details working: ${filesystem.name} - ${filesystem.description}`);
    });

    it('should throw error for non-existent server', async () => {
      await marketplace.getAllServers();

      await expect(marketplace.getServerDetails('this-server-does-not-exist-xyz')).rejects.toThrow(
        'Server not found'
      );

      console.log('✓ Error handling working for non-existent servers');
    });
  });

  describe('Real Popular Servers', () => {
    it('should return servers sorted by real install counts', async () => {
      await marketplace.getAllServers();

      const popular = await marketplace.getPopularServers(5);

      expect(popular.length).toBe(5);

      // Verify sorting
      for (let i = 0; i < popular.length - 1; i++) {
        expect(popular[i].installCount).toBeGreaterThanOrEqual(popular[i + 1].installCount);
      }

      console.log('✓ Popular servers sorted correctly:');
      popular.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.name} (${s.installCount} installs)`);
      });
    });
  });

  describe('Real Category Filtering', () => {
    it('should filter by real categories', async () => {
      await marketplace.getAllServers();

      const databases = await marketplace.getServersByCategory('Database');
      expect(databases.length).toBeGreaterThan(0);
      expect(databases.every((s) => s.category === 'Database')).toBe(true);

      const development = await marketplace.getServersByCategory('Development');
      expect(development.length).toBeGreaterThan(0);
      expect(development.every((s) => s.category === 'Development')).toBe(true);

      console.log(
        `✓ Category filtering working: ${databases.length} database servers, ${development.length} development servers`
      );
    });
  });

  describe('Real Cache Refresh', () => {
    it('should refresh cache and attempt new API call', async () => {
      // First load
      const servers1 = await marketplace.getAllServers();
      expect(servers1.length).toBeGreaterThan(0);

      // Refresh cache (will attempt API call again)
      await marketplace.refreshCache();

      // Should still have servers (from local registry fallback)
      const servers2 = await marketplace.getAllServers();
      expect(servers2.length).toBeGreaterThan(0);

      console.log('✓ Cache refresh working');
    }, 10000);
  });

  describe('Real Local Registry', () => {
    it('should have complete and valid server data', async () => {
      const servers = await marketplace.getAllServers();

      const displayCount = Math.min(10, servers.length);
      console.log(
        `\n✓ Local Registry contains ${servers.length} servers (showing ${displayCount}):\n`
      );

      servers.slice(0, displayCount).forEach((server) => {
        // Verify all required fields are present and valid
        expect(server.id).toBeDefined();
        expect(server.name).toBeDefined();
        expect(server.description).toBeDefined();
        expect(typeof server.rating).toBe('number');
        expect(server.rating).toBeGreaterThanOrEqual(0);
        expect(server.rating).toBeLessThanOrEqual(5);
        expect(typeof server.installCount).toBe('number');
        expect(server.installCount).toBeGreaterThan(0);
        expect(typeof server.requiresOAuth).toBe('boolean');
        expect(Array.isArray(server.requirements)).toBe(true);
        expect(server.command).toBeDefined();

        console.log(`  - ${server.name}: ${server.description.substring(0, 60)}...`);
        console.log(`    Rating: ${'★'.repeat(Math.floor(server.rating))} (${server.rating}/5)`);
        console.log(`    Installs: ${server.installCount.toLocaleString()}`);
        console.log(`    OAuth: ${server.requiresOAuth ? 'Required' : 'Not required'}`);
        console.log(`    Category: ${server.category || 'Uncategorized'}`);
        console.log('');
      });
    });
  });
});
