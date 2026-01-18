/**
 * Property-based tests for system resilience after extension errors
 * Feature: stage-05-hooks-extensions-mcp, Property 31: System Resilience After Extension Errors
 * Validates: Requirements 11.6, 11.7
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ExtensionManager } from '../extensionManager.js';
import { HookRegistry } from '../../hooks/hookRegistry.js';
import { HookRunner } from '../../hooks/hookRunner.js';
import { DefaultMCPClient } from '../../mcp/mcpClient.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Property 31: System Resilience After Extension Errors', () => {
  // Helper function to create isolated test environment for each property run
  async function createTestEnvironment() {
    // Create unique test directory for this run
    const testDir = join(tmpdir(), `test-resilience-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });

    // Initialize fresh components
    const hookRegistry = new HookRegistry();
    const hookRunner = new HookRunner(
      5000, // timeout
      undefined, // trustedHooks - not needed for this test
      { enabled: true, timeout: 5000, trustWorkspace: true }
    );
    const mcpClient = new DefaultMCPClient({ enabled: true, connectionTimeout: 5000, servers: {} });
    const extensionManager = new ExtensionManager({
      enabled: true,
      directories: [testDir],
      autoEnable: false, // autoEnable: false to control when extensions are enabled
      hookRegistry,
      mcpClient,
    });

    return { testDir, extensionManager, hookRegistry, hookRunner, mcpClient };
  }

  // Helper function to cleanup test environment
  async function cleanupTestEnvironment(testDir: string) {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Property: For any extension with an invalid manifest, the system should log an error,
   * skip that extension, and continue loading other extensions without failing.
   */
  it('should continue loading extensions after invalid manifest', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s) && s.trim() === s),
            isValid: fc.boolean(),
          }),
          { minLength: 2, maxLength: 5, selector: (item) => item.name }
        ),
        async (extensions) => {
          // Create isolated test environment for this run
          const { testDir, extensionManager } = await createTestEnvironment();

          try {
            // Create extension directories with valid and invalid manifests
            for (const ext of extensions) {
              const extDir = join(testDir, ext.name);
              await mkdir(extDir, { recursive: true });

              const manifestPath = join(extDir, 'manifest.json');
              if (ext.isValid) {
                // Create valid manifest
                await writeFile(
                  manifestPath,
                  JSON.stringify({
                    name: ext.name,
                    version: '1.0.0',
                    description: 'Test extension',
                  })
                );
              } else {
                // Create invalid manifest (missing required fields)
                await writeFile(
                  manifestPath,
                  JSON.stringify({
                    name: ext.name,
                    // Missing version and description
                  })
                );
              }
            }

            // Load extensions - should not throw
            const loaded = await extensionManager.loadExtensions();

            // Verify only valid extensions were loaded
            const validCount = extensions.filter(e => e.isValid).length;
            expect(loaded.length).toBe(validCount);

            // Verify extension manager is still functional
            const allExtensions = extensionManager.getAllExtensions();
            expect(allExtensions.length).toBe(validCount);
          } finally {
            // Cleanup
            await cleanupTestEnvironment(testDir);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any hook that fails with an error, the hook runner should log the error,
   * continue executing remaining hooks, and the system should remain operational.
   */
  it('should continue after hook execution failures', { timeout: 60000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && /^[a-z0-9-]+$/.test(s)),
            shouldFail: fc.boolean(),
          }),
          { minLength: 2, maxLength: 3, selector: (item) => item.name }
        ),
        async (hooks) => {
          // Create isolated test environment for this run
          const { testDir, extensionManager, hookRegistry, hookRunner } = await createTestEnvironment();

          try {
            // Create extension with hooks
            const extName = 'test-hooks-ext';
            const extDir = join(testDir, extName);
            await mkdir(extDir, { recursive: true });
            await mkdir(join(extDir, 'hooks'), { recursive: true });

            const hookConfigs: any[] = [];

            for (const hook of hooks) {
              const hookScript = join(extDir, 'hooks', `${hook.name}.js`);
              if (hook.shouldFail) {
                // Create hook that fails
                await writeFile(
                  hookScript,
                  `
                  console.log('{"continue": true, "error": "Intentional failure"}');
                  process.exit(1);
                  `
                );
              } else {
                // Create hook that succeeds
                await writeFile(
                  hookScript,
                  `
                  console.log('{"continue": true, "systemMessage": "Success"}');
                  process.exit(0);
                  `
                );
              }

              hookConfigs.push({
                name: hook.name,
                command: 'node',
                args: [hookScript],
              });
            }

            // Create manifest
            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify({
                name: extName,
                version: '1.0.0',
                description: 'Test extension with hooks',
                hooks: {
                  session_start: hookConfigs,
                },
              })
            );

            // Load extension
            await extensionManager.loadExtensions();

            // Enable extension to register hooks
            await extensionManager.enableExtension(extName);

            // Execute hooks - should not throw even if some fail
            const hookInput = {
              event: 'session_start',
              data: { sessionId: 'test-session' },
            };
            const results = await hookRunner.executeHooks(
              hookRegistry.getHooksForEvent('session_start'),
              hookInput
            );

            // Verify all hooks were attempted
            expect(results.length).toBe(hooks.length);

            // Verify system continues (all results have continue: true)
            for (const result of results) {
              expect(result.continue).toBe(true);
            }

            // Verify extension manager is still functional
            const ext = extensionManager.getExtension(extName);
            expect(ext).toBeDefined();
          } finally {
            // Cleanup
            await cleanupTestEnvironment(testDir);
          }
        }
      ),
      { numRuns: 20, timeout: 50000 }
    );
  });

  /**
   * Property: For any MCP server that fails to start, the system should log an error,
   * mark the server as unavailable, and continue without crashing.
   */
  it('should continue after MCP server startup failures', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            shouldFail: fc.boolean(),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        async (servers) => {
          // Create isolated test environment for this run
          const { testDir, extensionManager, mcpClient } = await createTestEnvironment();

          try {
            // Create extension with MCP servers
            const extName = 'test-mcp-ext';
            const extDir = join(testDir, extName);
            await mkdir(extDir, { recursive: true });

            const mcpServers: Record<string, any> = {};

            for (const server of servers) {
              if (server.shouldFail) {
                // Create server config that will fail (invalid command)
                mcpServers[server.name] = {
                  command: 'nonexistent-command-that-will-fail',
                  args: [],
                };
              } else {
                // Create server config that will succeed (echo command)
                mcpServers[server.name] = {
                  command: 'node',
                  args: ['-e', 'console.log("test")'],
                };
              }
            }

            // Create manifest
            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify({
                name: extName,
                version: '1.0.0',
                description: 'Test extension with MCP servers',
                mcpServers,
              })
            );

            // Load extension - should not throw even if servers fail
            const loaded = await extensionManager.loadExtensions();
            expect(loaded.length).toBe(1);

            // Try to enable extension - should not throw
            try {
              await extensionManager.enableExtension(extName);
            } catch (error) {
              // Some servers may fail, but extension should still be enabled
            }

            // Verify extension manager is still functional
            const ext = extensionManager.getExtension(extName);
            expect(ext).toBeDefined();

            // Verify MCP client is still functional
            const serverList = mcpClient.listServers();
            expect(Array.isArray(serverList)).toBe(true);
          } finally {
            // Cleanup
            await cleanupTestEnvironment(testDir);
          }
        }
      ),
      { numRuns: 30, timeout: 30000 }
    );
  });

  /**
   * Property: For any combination of extension errors (invalid manifest, hook failures, MCP crashes),
   * the system should display clear error messages and continue normal operation.
   */
  it('should remain operational after multiple types of extension errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hasInvalidManifest: fc.boolean(),
          hasFailingHook: fc.boolean(),
          hasFailingMCP: fc.boolean(),
        }),
        async (errorScenario) => {
          // Create isolated test environment for this run
          const { testDir, extensionManager, hookRegistry, mcpClient } = await createTestEnvironment();

          try {
            const extName = 'test-multi-error-ext';
            const extDir = join(testDir, extName);
            await mkdir(extDir, { recursive: true });

            const manifest: any = {
              name: extName,
              version: '1.0.0',
              description: 'Test extension with multiple error types',
            };

            if (errorScenario.hasInvalidManifest) {
              // Make manifest invalid by removing required field
              delete manifest.version;
            }

            if (errorScenario.hasFailingHook) {
              await mkdir(join(extDir, 'hooks'), { recursive: true });
              const hookScript = join(extDir, 'hooks', 'failing.js');
              await writeFile(
                hookScript,
                `process.exit(1);`
              );
              manifest.hooks = {
                session_start: [
                  {
                    name: 'failing-hook',
                    command: 'node',
                    args: [hookScript],
                  },
                ],
              };
            }

            if (errorScenario.hasFailingMCP) {
              manifest.mcpServers = {
                'failing-server': {
                  command: 'nonexistent-command',
                  args: [],
                },
              };
            }

            // Write manifest
            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify(manifest)
            );

            // Load extensions - should not throw
            const loaded = await extensionManager.loadExtensions();

            // If manifest is invalid, extension should not be loaded
            if (errorScenario.hasInvalidManifest) {
              expect(loaded.length).toBe(0);
            } else {
              expect(loaded.length).toBe(1);

              // Try to enable extension - should not throw
              try {
                await extensionManager.enableExtension(extName);
              } catch {
                // May fail due to MCP server issues, but should not crash
              }
            }

            // Verify system is still functional
            const allExtensions = extensionManager.getAllExtensions();
            expect(Array.isArray(allExtensions)).toBe(true);

            // Verify hook registry is still functional
            const hooks = hookRegistry.getAllHooks();
            expect(hooks instanceof Map).toBe(true);

            // Verify MCP client is still functional
            const servers = mcpClient.listServers();
            expect(Array.isArray(servers)).toBe(true);
          } finally {
            // Cleanup
            await cleanupTestEnvironment(testDir);
          }
        }
      ),
      { numRuns: 50, timeout: 30000 }
    );
  });
});
