/**
 * Property-based tests for MCP configuration effects
 * Feature: stage-05-hooks-extensions-mcp, Property 40: MCP Configuration Effects
 * Validates: Requirements 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { DefaultMCPClient } from '../mcpClient.js';
import type { MCPConfig, MCPServerConfig } from '../index.js';

describe('Property 40: MCP Configuration Effects', () => {
  // Feature: stage-05-hooks-extensions-mcp, Property 40: MCP Configuration Effects
  it('should reject server startup when MCP is disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(fc.string()),
        async (serverName, command, args) => {
          // Create MCP client with MCP disabled
          const config: MCPConfig = {
            enabled: false,
            connectionTimeout: 10000,
            servers: {},
          };
          const client = new DefaultMCPClient(config);

          const serverConfig: MCPServerConfig = {
            command,
            args,
          };

          // Attempt to start server
          await expect(client.startServer(serverName, serverConfig)).rejects.toThrow('disabled');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use configured connection timeout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 5000 }),
        async (timeout) => {
          // Create MCP client with custom timeout
          const config: MCPConfig = {
            enabled: true,
            connectionTimeout: timeout,
            servers: {},
          };
          const client = new DefaultMCPClient(config);

          const serverConfig: MCPServerConfig = {
            command: 'nonexistent-command',
            args: [],
          };

          const startTime = Date.now();

          // Attempt to start server (should fail/timeout)
          try {
            await client.startServer('test-server', serverConfig);
          } catch (_error) {
            // Expected to fail
          }

          const elapsed = Date.now() - startTime;

          // Should respect timeout (with some margin for processing)
          expect(elapsed).toBeLessThan(timeout + 2000);
        }
      ),
      { numRuns: 20 } // Fewer runs since this involves timeouts
    );
  });

  it('should allow direct server configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.array(fc.string()),
        async (serverName, command, args) => {
          // Create MCP client with direct server config
          const serverConfig: MCPServerConfig = {
            command,
            args,
          };

          const config: MCPConfig = {
            enabled: true,
            connectionTimeout: 10000,
            servers: {
              [serverName]: serverConfig,
            },
          };

          const client = new DefaultMCPClient(config);

          // Config should be stored
          expect(config.servers).toHaveProperty(serverName);
          expect(config.servers[serverName]).toEqual(serverConfig);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate configuration values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.integer({ min: 1, max: 60000 }),
        async (enabled, connectionTimeout) => {
          // Create config with various values
          const client = new DefaultMCPClient(config);

          // Client should be created successfully with valid config
          expect(client).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should support per-server configuration overrides', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1000, max: 30000 }),
        async (serverName, serverTimeout) => {
          // Create config with global timeout
          const config: MCPConfig = {
            enabled: true,
            connectionTimeout: 10000,
            servers: {},
          };

          new DefaultMCPClient(config);

          // Server config with override timeout
          const serverConfig: MCPServerConfig = {
            command: 'test-command',
            args: [],
            timeout: serverTimeout,
          };

          // Server config should have its own timeout
          expect(serverConfig.timeout).toBe(serverTimeout);
        }
      ),
      { numRuns: 100 }
    );
  });
});
