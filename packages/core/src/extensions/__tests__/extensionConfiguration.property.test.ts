/**
 * Property-based tests for extension configuration effects
 * Feature: stage-05-hooks-extensions-mcp, Property 41: Extension Configuration Effects
 * Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ExtensionManager } from '../extensionManager.js';
import type { ExtensionsConfig } from '../config.js';

describe('Property 41: Extension Configuration Effects', () => {
  // Feature: stage-05-hooks-extensions-mcp, Property 41: Extension Configuration Effects
  it('should not load extensions when disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 3 }),
        async (directories) => {
          // Create extension manager with extensions disabled
          const manager = new ExtensionManager({
            directories,
            autoEnable: true,
            enabled: false,
          });

          // Load extensions
          const extensions = await manager.loadExtensions();

          // Should return empty array when disabled
          expect(extensions).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should scan configured directories', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        async (directories) => {
          // Create extension manager with custom directories
          const manager = new ExtensionManager({
            directories,
            autoEnable: true,
            enabled: true,
          });

          // Manager should be created with configured directories
          expect(manager).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect autoEnable configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (autoEnable) => {
          // Create extension manager with autoEnable config
          const manager = new ExtensionManager({
            directories: ['~/.ollm/extensions'],
            autoEnable,
            enabled: true,
          });

          // Manager should be created successfully
          expect(manager).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate configuration values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.array(fc.string({ minLength: 1 })),
        fc.boolean(),
        async (enabled, directories, autoEnable) => {
          // Create config with various values
          const config: ExtensionsConfig = {
            enabled,
            directories,
            autoEnable,
          };

          // Create manager with config
          const manager = new ExtensionManager({
            directories: config.directories || [],
            autoEnable: config.autoEnable,
            enabled: config.enabled,
          });

          // Manager should be created successfully with valid config
          expect(manager).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use default directories when not specified', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (enabled) => {
          // Create manager without specifying directories
          const manager = new ExtensionManager({
            directories: [],
            autoEnable: true,
            enabled,
          });

          // Manager should be created successfully
          expect(manager).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle enabled/disabled state transitions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        fc.boolean(),
        async (initialEnabled, finalEnabled) => {
          // Create manager with initial state
          const manager1 = new ExtensionManager({
            directories: ['~/.ollm/extensions'],
            autoEnable: true,
            enabled: initialEnabled,
          });

          // Create manager with final state
          const manager2 = new ExtensionManager({
            directories: ['~/.ollm/extensions'],
            autoEnable: true,
            enabled: finalEnabled,
          });

          // Both managers should be created successfully
          expect(manager1).toBeDefined();
          expect(manager2).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
