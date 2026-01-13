/**
 * Integration tests for error scenarios
 * Validates: Requirements 11.6, 11.7
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExtensionManager } from '../extensionManager.js';
import { HookRegistry } from '../../hooks/hookRegistry.js';
import { HookRunner } from '../../hooks/hookRunner.js';
import { DefaultMCPClient } from '../../mcp/mcpClient.js';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Error Scenarios Integration Tests', () => {
  let testDir: string;
  let extensionManager: ExtensionManager;
  let hookRegistry: HookRegistry;
  let hookRunner: HookRunner;
  let mcpClient: DefaultMCPClient;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `test-error-scenarios-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Initialize components
    hookRegistry = new HookRegistry();
    hookRunner = new HookRunner(
      5000, // timeout
      undefined, // trustedHooks
      { enabled: true, timeout: 5000, trustWorkspace: true }
    );
    mcpClient = new DefaultMCPClient({ enabled: true, connectionTimeout: 5000, servers: {} });
    extensionManager = new ExtensionManager({
      enabled: true,
      directories: [testDir],
      autoEnable: false, // Control when extensions are enabled
      hookRegistry,
      mcpClient,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle hook failures gracefully', async () => {
    // Create extension with failing hook
    const extDir = join(testDir, 'failing-hook-ext');
    await mkdir(extDir, { recursive: true });
    await mkdir(join(extDir, 'hooks'), { recursive: true });

    const failingHook = join(extDir, 'hooks', 'failing.js');
    await writeFile(
      failingHook,
      `
      console.error('Hook error!');
      process.exit(1);
      `
    );

    const successHook = join(extDir, 'hooks', 'success.js');
    await writeFile(
      successHook,
      `
      console.log('{"continue": true, "systemMessage": "Success"}');
      process.exit(0);
      `
    );

    await writeFile(
      join(extDir, 'manifest.json'),
      JSON.stringify({
        name: 'failing-hook-ext',
        version: '1.0.0',
        description: 'Extension with failing hook',
        hooks: {
          session_start: [
            {
              name: 'failing-hook',
              command: 'node',
              args: [failingHook],
            },
            {
              name: 'success-hook',
              command: 'node',
              args: [successHook],
            },
          ],
        },
      })
    );

    // Load extension
    const loaded = await extensionManager.loadExtensions();
    expect(loaded.length).toBe(1);

    // Enable extension to register hooks
    await extensionManager.enableExtension('failing-hook-ext');

    // Verify hooks were registered
    const hooks = hookRegistry.getHooksForEvent('session_start');
    expect(hooks.length).toBe(2);

    // Execute hooks - should not throw
    const hookInput = {
      event: 'session_start',
      data: { sessionId: 'test-session' },
    };
    const results = await hookRunner.executeHooks(hooks, hookInput);

    // Both hooks should have results
    expect(results.length).toBe(2);

    // First hook should have error
    expect(results[0].error).toBeDefined();
    expect(results[0].continue).toBe(true);

    // Second hook should succeed
    expect(results[1].systemMessage).toBe('Success');
    expect(results[1].continue).toBe(true);

    // System should still be functional
    expect(extensionManager.getExtension('failing-hook-ext')).toBeDefined();
  });

  it('should handle MCP server crashes gracefully', async () => {
    // Create extension with crashing MCP server
    const extDir = join(testDir, 'crashing-mcp-ext');
    await mkdir(extDir, { recursive: true });

    await writeFile(
      join(extDir, 'manifest.json'),
      JSON.stringify({
        name: 'crashing-mcp-ext',
        version: '1.0.0',
        description: 'Extension with crashing MCP server',
        mcpServers: {
          'crashing-server': {
            command: 'nonexistent-command-that-will-fail',
            args: [],
          },
        },
      })
    );

    // Load extension - should not throw
    const loaded = await extensionManager.loadExtensions();
    expect(loaded.length).toBe(1);

    // Try to enable extension - may throw but should not crash
    try {
      await extensionManager.enableExtension('crashing-mcp-ext');
    } catch (error) {
      // Expected - MCP server failed to start
      expect(error).toBeDefined();
    }

    // System should still be functional
    expect(extensionManager.getExtension('crashing-mcp-ext')).toBeDefined();
    expect(mcpClient.listServers()).toBeDefined();
  });

  it('should handle invalid manifests gracefully', async () => {
    // Create extension with invalid manifest
    const invalidExtDir = join(testDir, 'invalid-ext');
    await mkdir(invalidExtDir, { recursive: true });

    await writeFile(
      join(invalidExtDir, 'manifest.json'),
      JSON.stringify({
        name: 'invalid-ext',
        // Missing required fields: version, description
      })
    );

    // Create extension with valid manifest
    const validExtDir = join(testDir, 'valid-ext');
    await mkdir(validExtDir, { recursive: true });

    await writeFile(
      join(validExtDir, 'manifest.json'),
      JSON.stringify({
        name: 'valid-ext',
        version: '1.0.0',
        description: 'Valid extension',
      })
    );

    // Load extensions - should not throw
    const loaded = await extensionManager.loadExtensions();

    // Only valid extension should be loaded
    expect(loaded.length).toBe(1);
    expect(loaded[0].name).toBe('valid-ext');

    // System should still be functional
    expect(extensionManager.getAllExtensions().length).toBe(1);
  });

  it('should verify system continues after all error types', async () => {
    // Create multiple extensions with different error types
    
    // 1. Extension with invalid manifest
    const invalidExtDir = join(testDir, 'invalid-manifest-ext');
    await mkdir(invalidExtDir, { recursive: true });
    await writeFile(
      join(invalidExtDir, 'manifest.json'),
      '{ "name": "invalid" }' // Missing required fields
    );

    // 2. Extension with failing hook
    const failingHookExtDir = join(testDir, 'failing-hook-ext2');
    await mkdir(failingHookExtDir, { recursive: true });
    await mkdir(join(failingHookExtDir, 'hooks'), { recursive: true });
    const failingHook = join(failingHookExtDir, 'hooks', 'fail.js');
    await writeFile(failingHook, 'process.exit(1);');
    await writeFile(
      join(failingHookExtDir, 'manifest.json'),
      JSON.stringify({
        name: 'failing-hook-ext2',
        version: '1.0.0',
        description: 'Extension with failing hook',
        hooks: {
          session_start: [
            {
              name: 'failing',
              command: 'node',
              args: [failingHook],
            },
          ],
        },
      })
    );

    // 3. Extension with failing MCP server
    const failingMCPExtDir = join(testDir, 'failing-mcp-ext2');
    await mkdir(failingMCPExtDir, { recursive: true });
    await writeFile(
      join(failingMCPExtDir, 'manifest.json'),
      JSON.stringify({
        name: 'failing-mcp-ext2',
        version: '1.0.0',
        description: 'Extension with failing MCP',
        mcpServers: {
          'failing': {
            command: 'nonexistent',
            args: [],
          },
        },
      })
    );

    // 4. Valid extension
    const validExtDir = join(testDir, 'valid-ext2');
    await mkdir(validExtDir, { recursive: true });
    await writeFile(
      join(validExtDir, 'manifest.json'),
      JSON.stringify({
        name: 'valid-ext2',
        version: '1.0.0',
        description: 'Valid extension',
      })
    );

    // Load all extensions - should not throw
    const loaded = await extensionManager.loadExtensions();

    // Should load valid extensions (failing-hook-ext2, failing-mcp-ext2, valid-ext2)
    expect(loaded.length).toBeGreaterThanOrEqual(1);

    // Try to enable extensions with errors
    for (const ext of loaded) {
      try {
        await extensionManager.enableExtension(ext.name);
      } catch {
        // Some may fail, but should not crash
      }
    }

    // Verify system is still functional
    expect(extensionManager.getAllExtensions().length).toBeGreaterThanOrEqual(1);
    expect(hookRegistry.getAllHooks()).toBeDefined();
    expect(mcpClient.listServers()).toBeDefined();

    // Verify we can still perform operations
    const allExtensions = extensionManager.getAllExtensions();
    expect(Array.isArray(allExtensions)).toBe(true);
  });
});
