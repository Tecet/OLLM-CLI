/**
 * Tests for ExtensionManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ExtensionManager } from '../extensionManager.js';
import { HookRegistry } from '../../hooks/hookRegistry.js';
import { createTestManifest } from './test-helpers.js';
import type { ExtensionManifest } from '../types.js';

describe('ExtensionManager', () => {
  let testDir: string;
  let hookRegistry: HookRegistry;

  beforeEach(async () => {
    // Create a temporary directory for tests
    testDir = join(tmpdir(), `extension-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    hookRegistry = new HookRegistry();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
          } catch (_error) {
            // Expected error
          }  });

  describe('Extension Discovery', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 12: Extension Discovery
    it('should discover extensions with valid manifests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.string({ minLength: 1, maxLength: 50 }),
          async (name, description) => {
            // Create extension directory
            const extDir = join(testDir, name);
            await mkdir(extDir, { recursive: true });

            // Create manifest
            const manifest: ExtensionManifest = {
              name,
              version: '1.0.0',
              description,
            };
            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify(manifest, null, 2)
            );

            // Load extensions
            const manager = new ExtensionManager({
              directories: [testDir],
              hookRegistry,
            });
            const extensions = await manager.loadExtensions();

            // Verify extension was discovered
            expect(extensions.length).toBeGreaterThanOrEqual(1);
            const found = extensions.find(ext => ext.name === name);
            expect(found).toBeDefined();
            expect(found?.description).toBe(description);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // Increase timeout for property-based test with file I/O

    it('should discover extensions from multiple directories', async () => {
      // Create two directories with extensions
      const dir1 = join(testDir, 'dir1');
      const dir2 = join(testDir, 'dir2');
      await mkdir(dir1, { recursive: true });
      await mkdir(dir2, { recursive: true });

      // Create extension in dir1
      const ext1Dir = join(dir1, 'ext1');
      await mkdir(ext1Dir);
      await writeFile(
        join(ext1Dir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'ext1' }))
      );

      // Create extension in dir2
      const ext2Dir = join(dir2, 'ext2');
      await mkdir(ext2Dir);
      await writeFile(
        join(ext2Dir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'ext2' }))
      );

      // Load extensions from both directories
      const manager = new ExtensionManager({
        directories: [dir1, dir2],
        hookRegistry,
      });
      const extensions = await manager.loadExtensions();

      // Verify both extensions were discovered
      expect(extensions.length).toBe(2);
      expect(extensions.find(e => e.name === 'ext1')).toBeDefined();
      expect(extensions.find(e => e.name === 'ext2')).toBeDefined();
    });

    it('should handle non-existent directories gracefully', async () => {
      const manager = new ExtensionManager({
        directories: ['/non/existent/path'],
        hookRegistry,
      });

      const extensions = await manager.loadExtensions();
      expect(extensions).toEqual([]);
    });
  });

  describe('Invalid Extension Handling', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 13: Invalid Extension Handling
    it('should skip extensions with invalid manifests and continue loading others', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          async (validName) => {
            // Create a completely separate temp directory for this iteration (not under testDir)
            const iterationDir = join(tmpdir(), `ext-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            
            try {
              await mkdir(iterationDir, { recursive: true });

              // Create valid extension
              const validDir = join(iterationDir, validName);
              await mkdir(validDir, { recursive: true });
              await writeFile(
                join(validDir, 'manifest.json'),
                JSON.stringify(createTestManifest({ name: validName }))
              );

              // Create invalid extension (missing required fields)
              const invalidDir = join(iterationDir, 'invalid-ext');
              await mkdir(invalidDir, { recursive: true });
              await writeFile(
                join(invalidDir, 'manifest.json'),
                JSON.stringify({ name: 'invalid' }) // Missing version and description
              );

              // Load extensions
              const manager = new ExtensionManager({
                directories: [iterationDir],
                hookRegistry,
              });
              const extensions = await manager.loadExtensions();

              // Verify valid extension was loaded, invalid was skipped
              expect(extensions.length).toBe(1);
              expect(extensions[0].name).toBe(validName);
            } finally {
              // Clean up iteration directory
              try {
                await rm(iterationDir, { recursive: true, force: true });
                    } catch (_error) {
                      // Expected error
                    }            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      // Create extension with malformed JSON
      const extDir = join(testDir, 'malformed');
      await mkdir(extDir, { recursive: true });
      await writeFile(
        join(extDir, 'manifest.json'),
        '{ invalid json }'
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      const extensions = await manager.loadExtensions();

      // Should not crash, just skip the invalid extension
      expect(extensions).toEqual([]);
    });
  });

  describe('Extension Registration', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 14: Extension Registration
    it('should register hooks when loading extensions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          fc.constantFrom('session_start', 'before_model', 'after_tool'),
          async (extName, event) => {
            // Create a unique test directory for this iteration
            const iterationDir = join(testDir, `reg-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            await mkdir(iterationDir, { recursive: true });

            // Create extension with hooks
            const extDir = join(iterationDir, extName);
            await mkdir(extDir, { recursive: true });

            const manifest: ExtensionManifest = {
              name: extName,
              version: '1.0.0',
              description: 'Test extension',
              hooks: {
                [event]: [
                  {
                    name: 'test-hook',
                    command: 'echo',
                    args: ['test'],
                  },
                ],
              },
            };

            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify(manifest)
            );

            // Create a fresh hook registry for this test
            const testHookRegistry = new HookRegistry();

            // Load extensions (disabled by default)
            const manager = new ExtensionManager({
              directories: [iterationDir],
              hookRegistry: testHookRegistry,
              autoEnable: false,
            });
            await manager.loadExtensions();

            // Enable the extension to register hooks
            await manager.enableExtension(extName);

            // Verify hooks were registered
            const hooks = testHookRegistry.getHooksForEvent(event as any);
            expect(hooks.length).toBeGreaterThanOrEqual(1);
            expect(hooks.some(h => h.extensionName === extName)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should store MCP server configs', async () => {
      // Create extension with MCP servers
      const extDir = join(testDir, 'mcp-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'mcp-ext',
        version: '1.0.0',
        description: 'Extension with MCP servers',
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      await manager.loadExtensions();

      // Verify MCP servers were stored
      const extension = manager.getExtension('mcp-ext');
      expect(extension).toBeDefined();
      expect(extension?.mcpServers.length).toBe(1);
      expect(extension?.mcpServers[0].command).toBe('node');
    });

    it('should merge settings with configuration', async () => {
      // Create extension with settings
      const extDir = join(testDir, 'settings-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'settings-ext',
        version: '1.0.0',
        description: 'Extension with settings',
        settings: [
          {
            name: 'apiKey',
            envVar: 'API_KEY',
            sensitive: true,
            description: 'API key for service',
          },
        ],
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      await manager.loadExtensions();

      // Verify settings were stored
      const extension = manager.getExtension('settings-ext');
      expect(extension).toBeDefined();
      expect(extension?.settings.length).toBe(1);
      expect(extension?.settings[0].name).toBe('apiKey');
      expect(extension?.settings[0].sensitive).toBe(true);
    });
  });

  describe('Extension Enable/Disable', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 17: Extension Disable Cleanup
    it('should unregister hooks when disabling extension', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          async (extName) => {
            // Create a unique test directory for this iteration
            const iterationDir = join(testDir, `disable-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            await mkdir(iterationDir, { recursive: true });

            // Create extension with hooks
            const extDir = join(iterationDir, extName);
            await mkdir(extDir, { recursive: true });

            const manifest: ExtensionManifest = {
              name: extName,
              version: '1.0.0',
              description: 'Test extension',
              hooks: {
                session_start: [
                  {
                    name: 'test-hook',
                    command: 'echo',
                    args: ['test'],
                  },
                ],
              },
            };

            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify(manifest)
            );

            // Create a fresh hook registry for this test
            const testHookRegistry = new HookRegistry();

            // Load extension (disabled by default)
            const manager = new ExtensionManager({
              directories: [iterationDir],
              hookRegistry: testHookRegistry,
              autoEnable: false,
            });
            await manager.loadExtensions();
            
            // Enable extension to register hooks
            await manager.enableExtension(extName);

            // Verify hooks are registered
            const hooksBefore = testHookRegistry.getHooksForEvent('session_start');
            const hookCountBefore = hooksBefore.length;
            expect(hookCountBefore).toBeGreaterThan(0);

            // Disable extension
            await manager.disableExtension(extName);

            // Verify hooks were unregistered
            const hooksAfter = testHookRegistry.getHooksForEvent('session_start');
            expect(hooksAfter.length).toBeLessThan(hookCountBefore);
            expect(hooksAfter.some(h => h.extensionName === extName)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Feature: stage-05-hooks-extensions-mcp, Property 18: Extension Enable Registration
    it('should register hooks when enabling extension', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          async (extName) => {
            // Create extension with hooks
            const extDir = join(testDir, extName);
            await mkdir(extDir, { recursive: true });

            const manifest: ExtensionManifest = {
              name: extName,
              version: '1.0.0',
              description: 'Test extension',
              hooks: {
                before_model: [
                  {
                    name: 'test-hook',
                    command: 'echo',
                    args: ['test'],
                  },
                ],
              },
            };

            await writeFile(
              join(extDir, 'manifest.json'),
              JSON.stringify(manifest)
            );

            // Load extension (disabled by default)
            const manager = new ExtensionManager({
              directories: [testDir],
              hookRegistry,
              autoEnable: false,
            });
            await manager.loadExtensions();

            // Verify no hooks registered yet
            const hooksBefore = hookRegistry.getHooksForEvent('before_model');
            const hookCountBefore = hooksBefore.length;

            // Enable extension
            await manager.enableExtension(extName);

            // Verify hooks were registered
            const hooksAfter = hookRegistry.getHooksForEvent('before_model');
            expect(hooksAfter.length).toBeGreaterThan(hookCountBefore);
            expect(hooksAfter.some(h => h.extensionName === extName)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Extension State Persistence', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 19: Extension State Persistence Round Trip
    it('should persist and restore extension enabled/disabled state', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
              enabled: fc.boolean(),
            }),
            { minLength: 1, maxLength: 5 }
          ).map(arr => {
            // Ensure unique names by deduplicating
            const seen = new Set<string>();
            return arr.filter(item => {
              if (seen.has(item.name)) {
                return false;
              }
              seen.add(item.name);
              return true;
            });
          }).filter(arr => arr.length > 0), // Ensure at least one extension after deduplication
          async (extensionStates) => {
            // Create a unique test directory for this iteration
            const iterationDir = join(testDir, `persist-${Date.now()}-${Math.random().toString(36).substring(7)}`);
            await mkdir(iterationDir, { recursive: true });

            // Create extensions
            for (const state of extensionStates) {
              const extDir = join(iterationDir, state.name);
              await mkdir(extDir, { recursive: true });
              await writeFile(
                join(extDir, 'manifest.json'),
                JSON.stringify(createTestManifest({ name: state.name }))
              );
            }

            // Load extensions
            const manager = new ExtensionManager({
              directories: [iterationDir],
              hookRegistry,
              autoEnable: false,
            });
            await manager.loadExtensions();

            // Set extension states
            for (const state of extensionStates) {
              if (state.enabled) {
                await manager.enableExtension(state.name);
              } else {
                await manager.disableExtension(state.name);
              }
            }

            // Get states
            const savedStates = manager.getExtensionStates();

            // Create new manager and restore states
            const manager2 = new ExtensionManager({
              directories: [iterationDir],
              hookRegistry: new HookRegistry(),
              autoEnable: false,
            });
            await manager2.loadExtensions();
            await manager2.restoreExtensionStates(savedStates);

            // Verify states match
            for (const state of extensionStates) {
              const ext = manager2.getExtension(state.name);
              expect(ext?.enabled).toBe(state.enabled);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Extension Retrieval', () => {
    it('should get extension by name', async () => {
      // Create extension
      const extDir = join(testDir, 'test-ext');
      await mkdir(extDir, { recursive: true });
      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'test-ext' }))
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      await manager.loadExtensions();

      // Get extension
      const extension = manager.getExtension('test-ext');
      expect(extension).toBeDefined();
      expect(extension?.name).toBe('test-ext');
    });

    it('should return undefined for non-existent extension', async () => {
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });

      const extension = manager.getExtension('non-existent');
      expect(extension).toBeUndefined();
    });

    it('should get all extensions', async () => {
      // Create multiple extensions
      for (let i = 0; i < 3; i++) {
        const extDir = join(testDir, `ext${i}`);
        await mkdir(extDir, { recursive: true });
        await writeFile(
          join(extDir, 'manifest.json'),
          JSON.stringify(createTestManifest({ name: `ext${i}` }))
        );
      }

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      await manager.loadExtensions();

      // Get all extensions
      const extensions = manager.getAllExtensions();
      expect(extensions.length).toBe(3);
    });
  });

  describe('Extension Reload', () => {
    it('should reload extension from disk', async () => {
      // Create extension
      const extDir = join(testDir, 'reload-ext');
      await mkdir(extDir, { recursive: true });
      const manifestPath = join(extDir, 'manifest.json');
      await writeFile(
        manifestPath,
        JSON.stringify(createTestManifest({ 
          name: 'reload-ext',
          description: 'Original description'
        }))
      );

      // Load extension
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      await manager.loadExtensions();

      // Verify original description
      let extension = manager.getExtension('reload-ext');
      expect(extension?.description).toBe('Original description');

      // Update manifest
      await writeFile(
        manifestPath,
        JSON.stringify(createTestManifest({ 
          name: 'reload-ext',
          description: 'Updated description'
        }))
      );

      // Reload extension
      await manager.reloadExtension('reload-ext');

      // Verify updated description
      extension = manager.getExtension('reload-ext');
      expect(extension?.description).toBe('Updated description');
    });

    it('should throw error when reloading non-existent extension', async () => {
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });

      await expect(manager.reloadExtension('non-existent')).rejects.toThrow(
        'Extension not found: non-existent'
      );
    });
  });

  describe('Extension Enable/Disable Errors', () => {
    it('should throw error when enabling non-existent extension', async () => {
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });

      await expect(manager.enableExtension('non-existent')).rejects.toThrow(
        'Extension not found: non-existent'
      );
    });

    it('should throw error when disabling non-existent extension', async () => {
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });

      await expect(manager.disableExtension('non-existent')).rejects.toThrow(
        'Extension not found: non-existent'
      );
    });

    it('should not error when enabling already enabled extension', async () => {
      // Create extension
      const extDir = join(testDir, 'enabled-ext');
      await mkdir(extDir, { recursive: true });
      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'enabled-ext' }))
      );

      // Load extension (auto-enabled)
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        autoEnable: true,
      });
      await manager.loadExtensions();

      // Enable again (should not error)
      await expect(manager.enableExtension('enabled-ext')).resolves.not.toThrow();
    });

    it('should not error when disabling already disabled extension', async () => {
      // Create extension
      const extDir = join(testDir, 'disabled-ext');
      await mkdir(extDir, { recursive: true });
      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'disabled-ext' }))
      );

      // Load extension (disabled)
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        autoEnable: false,
      });
      await manager.loadExtensions();

      // Disable again (should not error)
      await expect(manager.disableExtension('disabled-ext')).resolves.not.toThrow();
    });
  });

  describe('Extension with Skills', () => {
    it('should load extension with skills', async () => {
      // Create extension with skills
      const extDir = join(testDir, 'skills-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'skills-ext',
        version: '1.0.0',
        description: 'Extension with skills',
        skills: [
          {
            name: 'test-skill',
            description: 'A test skill',
            prompt: 'Do something useful',
          },
        ],
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
      });
      await manager.loadExtensions();

      // Verify skills were loaded
      const extension = manager.getExtension('skills-ext');
      expect(extension).toBeDefined();
      expect(extension?.skills.length).toBe(1);
      expect(extension?.skills[0].name).toBe('test-skill');
    });
  });

  describe('Auto-enable Configuration', () => {
    it('should auto-enable extensions when autoEnable is true', async () => {
      // Create extension
      const extDir = join(testDir, 'auto-ext');
      await mkdir(extDir, { recursive: true });
      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'auto-ext' }))
      );

      // Load with autoEnable: true
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        autoEnable: true,
      });
      await manager.loadExtensions();

      // Verify extension is enabled
      const extension = manager.getExtension('auto-ext');
      expect(extension?.enabled).toBe(true);
    });

    it('should not auto-enable extensions when autoEnable is false', async () => {
      // Create extension
      const extDir = join(testDir, 'manual-ext');
      await mkdir(extDir, { recursive: true });
      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(createTestManifest({ name: 'manual-ext' }))
      );

      // Load with autoEnable: false
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        autoEnable: false,
      });
      await manager.loadExtensions();

      // Verify extension is disabled
      const extension = manager.getExtension('manual-ext');
      expect(extension?.enabled).toBe(false);
    });
  });

  describe('MCP Integration', () => {
    it('should start MCP servers when enabling extension', async () => {
      // Create mock MCP client
      const startedServers: string[] = [];
      const serverTools = new Map<string, any[]>();
      
      const mockMCPClient = {
        startServer: async (name: string, _config: any) => {
          startedServers.push(name);
        },
        stopServer: async (name: string) => {
          const index = startedServers.indexOf(name);
          if (index > -1) {
            startedServers.splice(index, 1);
          }
        },
        getServerStatus: (name: string) => ({
          name,
          status: startedServers.includes(name) ? 'connected' : 'disconnected',
          tools: serverTools.get(name)?.length || 0,
        }),
        getTools: async (name: string) => {
          const tools = [
            {
              name: 'test-tool',
              description: 'A test tool',
              inputSchema: { type: 'object', properties: {} },
            },
          ];
          serverTools.set(name, tools);
          return tools;
        },
        callTool: async () => ({}),
        listServers: () => [],
      };

      // Create mock tool wrapper
      const wrappedTools: any[] = [];
      const mockToolWrapper = {
        wrapTool: (serverName: string, mcpTool: any) => {
          const tool = {
            name: `${serverName}:${mcpTool.name}`,
            displayName: mcpTool.name,
            schema: {
              name: `${serverName}:${mcpTool.name}`,
              description: mcpTool.description,
              parameters: mcpTool.inputSchema,
            },
            createInvocation: () => ({}),
          };
          wrappedTools.push(tool);
          return tool;
        },
        executeTool: async () => ({ llmContent: '', returnDisplay: '' }),
      };

      // Create mock tool registry
      const registeredTools: any[] = [];
      const mockToolRegistry = {
        register: (tool: any) => {
          registeredTools.push(tool);
        },
        unregister: (name: string) => {
          const index = registeredTools.findIndex(t => t.name === name);
          if (index > -1) {
            registeredTools.splice(index, 1);
          }
        },
        list: () => registeredTools,
        get: () => undefined,
        getFunctionSchemas: () => [],
        createInvocation: () => ({}),
      };

      // Create extension with MCP server
      const extDir = join(testDir, 'mcp-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'mcp-ext',
        version: '1.0.0',
        description: 'Extension with MCP server',
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            env: { TEST_VAR: 'value' },
          },
        },
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        mcpClient: mockMCPClient as any,
        mcpToolWrapper: mockToolWrapper as any,
        toolRegistry: mockToolRegistry as any,
        autoEnable: false,
      });
      await manager.loadExtensions();

      // Enable extension
      await manager.enableExtension('mcp-ext');

      // Verify MCP server was started
      expect(startedServers).toContain('mcp-ext:test-server');

      // Verify tools were registered
      expect(registeredTools.length).toBeGreaterThan(0);
      expect(registeredTools[0].name).toBe('mcp-ext:test-server:test-tool');
    });

    it('should stop MCP servers when disabling extension', async () => {
      // Create mock MCP client
      const startedServers: string[] = [];
      const serverTools = new Map<string, any[]>();
      
      const mockMCPClient = {
        startServer: async (name: string, _config: any) => {
          startedServers.push(name);
        },
        stopServer: async (name: string) => {
          const index = startedServers.indexOf(name);
          if (index > -1) {
            startedServers.splice(index, 1);
          }
        },
        getServerStatus: (name: string) => ({
          name,
          status: startedServers.includes(name) ? 'connected' : 'disconnected',
          tools: serverTools.get(name)?.length || 0,
        }),
        getTools: async (name: string) => {
          const tools = [
            {
              name: 'test-tool',
              description: 'A test tool',
              inputSchema: { type: 'object', properties: {} },
            },
          ];
          serverTools.set(name, tools);
          return tools;
        },
        callTool: async () => ({}),
        listServers: () => [],
      };

      // Create mock tool wrapper
      const mockToolWrapper = {
        wrapTool: (serverName: string, mcpTool: any) => ({
          name: `${serverName}:${mcpTool.name}`,
          displayName: mcpTool.name,
          schema: {
            name: `${serverName}:${mcpTool.name}`,
            description: mcpTool.description,
            parameters: mcpTool.inputSchema,
          },
          createInvocation: () => ({}),
        }),
        executeTool: async () => ({ llmContent: '', returnDisplay: '' }),
      };

      // Create mock tool registry
      const registeredTools: any[] = [];
      const mockToolRegistry = {
        register: (tool: any) => {
          registeredTools.push(tool);
        },
        unregister: (name: string) => {
          const index = registeredTools.findIndex(t => t.name === name);
          if (index > -1) {
            registeredTools.splice(index, 1);
          }
        },
        list: () => registeredTools,
        get: () => undefined,
        getFunctionSchemas: () => [],
        createInvocation: () => ({}),
      };

      // Create extension with MCP server
      const extDir = join(testDir, 'mcp-disable-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'mcp-disable-ext',
        version: '1.0.0',
        description: 'Extension with MCP server',
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Load and enable extension
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        mcpClient: mockMCPClient as any,
        mcpToolWrapper: mockToolWrapper as any,
        toolRegistry: mockToolRegistry as any,
        autoEnable: false, // Start disabled so we can test enable/disable
      });
      await manager.loadExtensions();

      // Enable extension
      await manager.enableExtension('mcp-disable-ext');

      // Verify server is started
      expect(startedServers).toContain('mcp-disable-ext:test-server');
      expect(registeredTools.length).toBeGreaterThan(0);

      // Disable extension
      await manager.disableExtension('mcp-disable-ext');

      // Verify server was stopped
      expect(startedServers).not.toContain('mcp-disable-ext:test-server');

      // Verify tools were removed
      expect(registeredTools.length).toBe(0);
    });

    it('should handle MCP server failures gracefully', async () => {
      // Create mock MCP client that fails
      const mockMCPClient = {
        startServer: async (_name: string, _config: any) => {
          throw new Error('Failed to start server');
        },
        stopServer: async () => {},
        getServerStatus: () => ({
          name: '',
          status: 'error' as const,
          tools: 0,
        }),
        getTools: async () => [],
        callTool: async () => ({}),
        listServers: () => [],
      };

      // Create mock tool wrapper
      const mockToolWrapper = {
        wrapTool: () => ({
          name: 'test',
          displayName: 'test',
          schema: { name: 'test', description: '', parameters: {} },
          createInvocation: () => ({}),
        }),
        executeTool: async () => ({ llmContent: '', returnDisplay: '' }),
      };

      // Create mock tool registry
      const mockToolRegistry = {
        register: () => {},
        unregister: () => {},
        list: () => [],
        get: () => undefined,
        getFunctionSchemas: () => [],
        createInvocation: () => ({}),
      };

      // Create extension with MCP server
      const extDir = join(testDir, 'mcp-fail-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'mcp-fail-ext',
        version: '1.0.0',
        description: 'Extension with failing MCP server',
        mcpServers: {
          'fail-server': {
            command: 'node',
            args: ['server.js'],
          },
        },
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        mcpClient: mockMCPClient as any,
        mcpToolWrapper: mockToolWrapper as any,
        toolRegistry: mockToolRegistry as any,
        autoEnable: false,
      });
      await manager.loadExtensions();

      // Enable extension (should not throw despite MCP failure)
      await expect(manager.enableExtension('mcp-fail-ext')).resolves.not.toThrow();

      // Extension should still be enabled
      const extension = manager.getExtension('mcp-fail-ext');
      expect(extension?.enabled).toBe(true);
    });

    it('should pass extension environment to MCP servers', async () => {
      let capturedEnv: Record<string, string> | undefined;
      
      // Create mock MCP client that captures env
      const mockMCPClient = {
        startServer: async (name: string, config: any) => {
          capturedEnv = config.env;
        },
        stopServer: async () => {},
        getServerStatus: () => ({
          name: '',
          status: 'connected' as const,
          tools: 0,
        }),
        getTools: async () => [],
        callTool: async () => ({}),
        listServers: () => [],
      };

      // Create mock tool wrapper
      const mockToolWrapper = {
        wrapTool: () => ({
          name: 'test',
          displayName: 'test',
          schema: { name: 'test', description: '', parameters: {} },
          createInvocation: () => ({}),
        }),
        executeTool: async () => ({ llmContent: '', returnDisplay: '' }),
      };

      // Create mock tool registry
      const mockToolRegistry = {
        register: () => {},
        unregister: () => {},
        list: () => [],
        get: () => undefined,
        getFunctionSchemas: () => [],
        createInvocation: () => ({}),
      };

      // Create extension with settings and MCP server
      const extDir = join(testDir, 'mcp-env-ext');
      await mkdir(extDir, { recursive: true });

      const manifest: ExtensionManifest = {
        name: 'mcp-env-ext',
        version: '1.0.0',
        description: 'Extension with settings',
        settings: [
          {
            name: 'apiKey',
            envVar: 'API_KEY',
            description: 'API key',
          },
        ],
        mcpServers: {
          'env-server': {
            command: 'node',
            args: ['server.js'],
            env: {
              SERVER_VAR: 'server-value',
            },
          },
        },
      };

      await writeFile(
        join(extDir, 'manifest.json'),
        JSON.stringify(manifest)
      );

      // Set environment variable
      process.env.API_KEY = 'test-key-123';

      // Load extensions
      const manager = new ExtensionManager({
        directories: [testDir],
        hookRegistry,
        mcpClient: mockMCPClient as any,
        mcpToolWrapper: mockToolWrapper as any,
        toolRegistry: mockToolRegistry as any,
        autoEnable: false,
      });
      await manager.loadExtensions();

      // Enable extension
      await manager.enableExtension('mcp-env-ext');

      // Verify environment was passed
      expect(capturedEnv).toBeDefined();
      expect(capturedEnv?.['EXTENSION_MCP_ENV_EXT_API_KEY']).toBe('test-key-123');
      expect(capturedEnv?.['SERVER_VAR']).toBe('server-value');

      // Clean up
      delete process.env.API_KEY;
    });
  });
});
