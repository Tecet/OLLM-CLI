/**
 * Property-based tests for SettingsService hook settings persistence
 * Feature: stage-06c-hooks-panel-ui
 * Task: 5.4.4 Property: Settings persistence
 * 
 * **Validates: Requirements 2.4, 4.1**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { SettingsService } from '../settingsService.js';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

describe('SettingsService Hook Settings Persistence Property Tests', () => {
  let testDir: string;
  let testOllmDir: string;
  let testSettingsPath: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = join(os.tmpdir(), `ollm-test-settings-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    testOllmDir = join(testDir, '.ollm');
    mkdirSync(testOllmDir, { recursive: true });
    testSettingsPath = join(testOllmDir, 'settings.json');

    // Mock homedir to use test directory
    vi.spyOn(os, 'homedir').mockReturnValue(testDir);
    
    // Reset singleton instance
    (SettingsService as any).instance = undefined;
  });

  afterEach(() => {
    // Restore original homedir
    vi.restoreAllMocks();

    // Clean up test directory
    try {
      if (existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  /**
   * Property 1: Settings Persistence Round Trip
   * For any set of hook IDs and enabled states, saving them
   * and loading them back should preserve the exact state.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 1: Settings round trip
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 1: Hook settings persist correctly across save-load cycles', () => {
    // Generator for hook IDs (alphanumeric with dashes)
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    // Generator for enabled state
    const enabledArb = fc.boolean();

    // Generator for a map of hook settings
    const hookSettingsArb = fc.dictionary(hookIdArb, enabledArb, { minKeys: 1, maxKeys: 20 });

    fc.assert(
      fc.property(hookSettingsArb, (hookSettings) => {
        const service = SettingsService.getInstance();

        // Save all hook settings
        for (const [hookId, enabled] of Object.entries(hookSettings)) {
          service.setHookEnabled(hookId, enabled);
        }

        // Create a new instance to simulate app restart
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();

        // Load settings back
        const loadedSettings = newService.getHookSettings();

        // Verify all settings match
        for (const [hookId, expectedEnabled] of Object.entries(hookSettings)) {
          expect(loadedSettings.enabled[hookId]).toBe(expectedEnabled);
        }

        // Verify no extra settings were added
        const loadedKeys = Object.keys(loadedSettings.enabled);
        const originalKeys = Object.keys(hookSettings);
        expect(loadedKeys.sort()).toEqual(originalKeys.sort());
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Toggle Idempotency
   * Toggling a hook's enabled state multiple times should
   * result in the correct final state, regardless of intermediate operations.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 2: Toggle idempotency
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 2: Multiple toggles result in correct final state', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    
    // Generate a sequence of toggle operations
    const toggleSequenceArb = fc.record({
      hookId: hookIdArb,
      operations: fc.array(fc.boolean(), { minLength: 1, maxLength: 10 })
    });

    fc.assert(
      fc.property(toggleSequenceArb, ({ hookId, operations }) => {
        const service = SettingsService.getInstance();

        // Apply all operations in sequence
        for (const enabled of operations) {
          service.setHookEnabled(hookId, enabled);
        }

        // The final state should match the last operation
        const finalExpectedState = operations[operations.length - 1];
        const loadedSettings = service.getHookSettings();

        expect(loadedSettings.enabled[hookId]).toBe(finalExpectedState);

        // Verify persistence by creating new instance
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        const reloadedSettings = newService.getHookSettings();

        expect(reloadedSettings.enabled[hookId]).toBe(finalExpectedState);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Concurrent Hook Updates
   * Setting multiple hooks' states in quick succession should
   * preserve all changes correctly without data loss.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 3: Concurrent updates
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 3: Concurrent hook updates preserve all changes', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    const enabledArb = fc.boolean();

    // Generate multiple unique hooks with their states
    const multipleHooksArb = fc
      .array(
        fc.record({
          hookId: hookIdArb,
          enabled: enabledArb
        }),
        { minLength: 5, maxLength: 20 }
      )
      .map((hooks) => {
        // Ensure unique hook IDs
        const uniqueMap = new Map<string, boolean>();
        for (const hook of hooks) {
          uniqueMap.set(hook.hookId, hook.enabled);
        }
        return Array.from(uniqueMap.entries()).map(([hookId, enabled]) => ({ hookId, enabled }));
      })
      .filter((hooks) => hooks.length >= 5);

    fc.assert(
      fc.property(multipleHooksArb, (hooks) => {
        const service = SettingsService.getInstance();

        // Set all hooks rapidly (simulating concurrent updates)
        for (const { hookId, enabled } of hooks) {
          service.setHookEnabled(hookId, enabled);
        }

        // Verify all settings were saved correctly
        const loadedSettings = service.getHookSettings();

        for (const { hookId, enabled } of hooks) {
          expect(loadedSettings.enabled[hookId]).toBe(enabled);
        }

        // Verify persistence
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        const reloadedSettings = newService.getHookSettings();

        for (const { hookId, enabled } of hooks) {
          expect(reloadedSettings.enabled[hookId]).toBe(enabled);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 4: Remove Hook Setting Cleanup
   * Removing a hook setting should completely remove it from storage,
   * and it should not reappear after reload.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 4: Setting removal
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 4: Removing hook settings cleans up storage completely', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    const enabledArb = fc.boolean();

    const hookSettingsArb = fc
      .array(
        fc.record({
          hookId: hookIdArb,
          enabled: enabledArb
        }),
        { minLength: 3, maxLength: 10 }
      )
      .map((hooks) => {
        // Ensure unique hook IDs
        const uniqueMap = new Map<string, boolean>();
        for (const hook of hooks) {
          uniqueMap.set(hook.hookId, hook.enabled);
        }
        return Array.from(uniqueMap.entries()).map(([hookId, enabled]) => ({ hookId, enabled }));
      })
      .filter((hooks) => hooks.length >= 3);

    fc.assert(
      fc.property(hookSettingsArb, (hooks) => {
        const service = SettingsService.getInstance();

        // Save all hooks
        for (const { hookId, enabled } of hooks) {
          service.setHookEnabled(hookId, enabled);
        }

        // Remove the first hook
        const removedHookId = hooks[0].hookId;
        service.removeHookSetting(removedHookId);

        // Verify it's removed from current instance
        const currentSettings = service.getHookSettings();
        expect(currentSettings.enabled[removedHookId]).toBeUndefined();

        // Verify remaining hooks are still present
        for (let i = 1; i < hooks.length; i++) {
          const { hookId, enabled } = hooks[i];
          expect(currentSettings.enabled[hookId]).toBe(enabled);
        }

        // Verify persistence - removed hook should not reappear
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        const reloadedSettings = newService.getHookSettings();

        expect(reloadedSettings.enabled[removedHookId]).toBeUndefined();

        // Verify remaining hooks are still present after reload
        for (let i = 1; i < hooks.length; i++) {
          const { hookId, enabled } = hooks[i];
          expect(reloadedSettings.enabled[hookId]).toBe(enabled);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 5: State Consistency Across Multiple Instances
   * Multiple instances of SettingsService (simulating app restarts)
   * should always see the same persisted state.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 5: Multi-instance consistency
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 5: Settings remain consistent across multiple service instances', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    const enabledArb = fc.boolean();

    const hookSettingsArb = fc.dictionary(hookIdArb, enabledArb, { minKeys: 1, maxKeys: 15 });

    fc.assert(
      fc.property(hookSettingsArb, (hookSettings) => {
        // First instance: save settings
        const service1 = SettingsService.getInstance();
        for (const [hookId, enabled] of Object.entries(hookSettings)) {
          service1.setHookEnabled(hookId, enabled);
        }
        const settings1 = service1.getHookSettings();

        // Second instance: load settings
        (SettingsService as any).instance = undefined;
        const service2 = SettingsService.getInstance();
        const settings2 = service2.getHookSettings();

        // Third instance: verify again
        (SettingsService as any).instance = undefined;
        const service3 = SettingsService.getInstance();
        const settings3 = service3.getHookSettings();

        // All instances should see the same state
        expect(settings2.enabled).toEqual(settings1.enabled);
        expect(settings3.enabled).toEqual(settings1.enabled);

        // Verify each individual setting
        for (const [hookId, expectedEnabled] of Object.entries(hookSettings)) {
          expect(settings1.enabled[hookId]).toBe(expectedEnabled);
          expect(settings2.enabled[hookId]).toBe(expectedEnabled);
          expect(settings3.enabled[hookId]).toBe(expectedEnabled);
        }
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 6: Empty Settings Handling
   * Starting with no hook settings and adding/removing hooks
   * should work correctly without errors.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 6: Empty state handling
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 6: Empty settings state is handled correctly', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    const enabledArb = fc.boolean();

    fc.assert(
      fc.property(hookIdArb, enabledArb, (hookId, enabled) => {
        // Start with fresh service (no existing settings)
        const service = SettingsService.getInstance();

        // Get settings before adding any hooks
        const emptySettings = service.getHookSettings();
        expect(emptySettings.enabled).toBeDefined();
        expect(Object.keys(emptySettings.enabled).length).toBe(0);

        // Add a hook
        service.setHookEnabled(hookId, enabled);

        // Verify it was added
        const settingsWithHook = service.getHookSettings();
        expect(settingsWithHook.enabled[hookId]).toBe(enabled);

        // Remove the hook
        service.removeHookSetting(hookId);

        // Verify we're back to empty
        const settingsAfterRemoval = service.getHookSettings();
        expect(settingsAfterRemoval.enabled[hookId]).toBeUndefined();

        // Verify persistence of empty state
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        const reloadedSettings = newService.getHookSettings();
        expect(reloadedSettings.enabled[hookId]).toBeUndefined();
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 7: Special Characters in Hook IDs
   * Hook IDs with valid special characters (dashes, numbers)
   * should be saved and loaded correctly.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 7: Special character handling
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 7: Hook IDs with special characters persist correctly', () => {
    // Generator for hook IDs with various valid patterns
    const specialHookIdArb = fc.oneof(
      fc.constant('hook-with-dashes'),
      fc.constant('hook123'),
      fc.constant('my-hook-v2'),
      fc.constant('test-hook-2024'),
      fc.constant('a1-b2-c3'),
      fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/)
    );

    const enabledArb = fc.boolean();

    fc.assert(
      fc.property(specialHookIdArb, enabledArb, (hookId, enabled) => {
        const service = SettingsService.getInstance();

        // Save the hook setting
        service.setHookEnabled(hookId, enabled);

        // Verify it was saved
        const settings = service.getHookSettings();
        expect(settings.enabled[hookId]).toBe(enabled);

        // Verify persistence
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        const reloadedSettings = newService.getHookSettings();
        expect(reloadedSettings.enabled[hookId]).toBe(enabled);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Overwrite Behavior
   * Setting a hook's enabled state multiple times should
   * always use the most recent value.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 8: Overwrite consistency
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 8: Overwriting hook settings uses the latest value', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);

    fc.assert(
      fc.property(hookIdArb, (hookId) => {
        const service = SettingsService.getInstance();

        // Set to true
        service.setHookEnabled(hookId, true);
        expect(service.getHookSettings().enabled[hookId]).toBe(true);

        // Overwrite with false
        service.setHookEnabled(hookId, false);
        expect(service.getHookSettings().enabled[hookId]).toBe(false);

        // Overwrite with true again
        service.setHookEnabled(hookId, true);
        expect(service.getHookSettings().enabled[hookId]).toBe(true);

        // Verify final state persists
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        expect(newService.getHookSettings().enabled[hookId]).toBe(true);
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 9: Bulk Operations Consistency
   * Performing many operations and then checking persistence
   * should maintain all changes correctly.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 9: Bulk operations
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 9: Bulk operations maintain consistency', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    const enabledArb = fc.boolean();

    // Generate a sequence of operations
    const operationsArb = fc.array(
      fc.record({
        type: fc.constantFrom('set', 'remove'),
        hookId: hookIdArb,
        enabled: enabledArb
      }),
      { minLength: 10, maxLength: 50 }
    );

    fc.assert(
      fc.property(operationsArb, (operations) => {
        const service = SettingsService.getInstance();

        // Track expected final state
        const expectedState = new Map<string, boolean | undefined>();

        // Apply all operations
        for (const op of operations) {
          if (op.type === 'set') {
            service.setHookEnabled(op.hookId, op.enabled);
            expectedState.set(op.hookId, op.enabled);
          } else {
            service.removeHookSetting(op.hookId);
            expectedState.set(op.hookId, undefined);
          }
        }

        // Verify current state matches expected
        const currentSettings = service.getHookSettings();
        for (const [hookId, expectedEnabled] of expectedState.entries()) {
          if (expectedEnabled === undefined) {
            expect(currentSettings.enabled[hookId]).toBeUndefined();
          } else {
            expect(currentSettings.enabled[hookId]).toBe(expectedEnabled);
          }
        }

        // Verify persistence
        (SettingsService as any).instance = undefined;
        const newService = SettingsService.getInstance();
        const reloadedSettings = newService.getHookSettings();

        for (const [hookId, expectedEnabled] of expectedState.entries()) {
          if (expectedEnabled === undefined) {
            expect(reloadedSettings.enabled[hookId]).toBeUndefined();
          } else {
            expect(reloadedSettings.enabled[hookId]).toBe(expectedEnabled);
          }
        }
      }),
      { numRuns: 30 }
    );
  });

  /**
   * Property 10: No Data Corruption
   * Settings file should always contain valid JSON after any operation.
   * 
   * Feature: stage-06c-hooks-panel-ui, Property 10: Data integrity
   * **Validates: Requirements 2.4, 4.1**
   */
  it('Property 10: Settings file remains valid JSON after all operations', () => {
    const hookIdArb = fc.stringMatching(/^[a-z0-9][a-z0-9-]{2,30}[a-z0-9]$/);
    const enabledArb = fc.boolean();

    const hookSettingsArb = fc.dictionary(hookIdArb, enabledArb, { minKeys: 1, maxKeys: 10 });

    fc.assert(
      fc.property(hookSettingsArb, (hookSettings) => {
        const service = SettingsService.getInstance();

        // Perform operations
        for (const [hookId, enabled] of Object.entries(hookSettings)) {
          service.setHookEnabled(hookId, enabled);
        }

        // Verify settings file is valid JSON
        expect(existsSync(testSettingsPath)).toBe(true);

        const fileContent = readFileSync(testSettingsPath, 'utf-8');
        
        // Should be parseable JSON
        let parsed;
        expect(() => {
          parsed = JSON.parse(fileContent);
        }).not.toThrow();

        // Should have hooks structure
        expect(parsed).toHaveProperty('hooks');
        expect(parsed.hooks).toHaveProperty('enabled');
        expect(typeof parsed.hooks.enabled).toBe('object');

        // All values should be booleans
        for (const [hookId, enabled] of Object.entries(parsed.hooks.enabled)) {
          expect(typeof enabled).toBe('boolean');
        }
      }),
      { numRuns: 50 }
    );
  });
});
