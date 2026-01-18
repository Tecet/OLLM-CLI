/**
 * Property-Based Tests for HooksContext
 * 
 * These tests verify critical correctness properties using fast-check
 * to generate random test cases and ensure invariants hold across all inputs.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { HooksProvider, useHooks } from '../HooksContext.js';
import { HookRegistry } from '@ollm/ollm-cli-core/hooks/hookRegistry.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import { SettingsService } from '../../../config/settingsService.js';
import { Text } from 'ink';
import * as fc from 'fast-check';

// Mock SettingsService
vi.mock('../../../config/settingsService.js', () => {
  const mockSettings = {
    hooks: {
      enabled: {} as Record<string, boolean>,
    },
  };

  return {
    SettingsService: {
      getInstance: vi.fn(() => ({
        getHookSettings: vi.fn(() => mockSettings.hooks),
        setHookEnabled: vi.fn((hookId: string, enabled: boolean) => {
          mockSettings.hooks.enabled[hookId] = enabled;
        }),
        removeHookSetting: vi.fn((hookId: string) => {
          delete mockSettings.hooks.enabled[hookId];
        }),
      })),
    },
  };
});

describe('HooksContext - Property-Based Tests', () => {
  let hookRegistry: HookRegistry;
  let settingsService: ReturnType<typeof SettingsService.getInstance>;

  beforeEach(() => {
    hookRegistry = new HookRegistry();
    settingsService = SettingsService.getInstance();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset mock settings
    const mockSettings = {
      hooks: {
        enabled: {} as Record<string, boolean>,
      },
    };
    vi.mocked(settingsService.getHookSettings).mockReturnValue(mockSettings.hooks);
  });

  // Helper component to test the hook
  const TestComponent = ({ onRender }: { onRender: (value: ReturnType<typeof useHooks>) => void }) => {
    const hooks = useHooks();
    
    useEffect(() => {
      onRender(hooks);
    }, [hooks, onRender]);

    return <Text>Test</Text>;
  };

  /**
   * Property: Toggle idempotency
   * 
   * **Validates: Requirements 2.4, 4.1**
   * 
   * This property verifies that toggling a hook twice returns it to its original state.
   * This is a critical correctness property that ensures enable/disable operations
   * are consistent and predictable.
   * 
   * For any hook ID and initial enabled state:
   * - Toggle once: state changes to opposite
   * - Toggle twice: state returns to original
   * 
   * This property must hold for:
   * - Any valid hook ID (alphanumeric strings)
   * - Any initial state (enabled or disabled)
   * - Multiple consecutive toggles
   */
  it('Property: Toggle operations are idempotent (toggling twice returns to original state)', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary hook IDs and initial states
        fc.record({
          hookId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          initialState: fc.boolean(),
        }),
        async ({ hookId, initialState }) => {
          // Setup: Create a fresh context for each test case
          const testRegistry = new HookRegistry();
          const testSettings = SettingsService.getInstance();
          
          // Register a test hook
          const testHook: Hook = {
            id: hookId,
            name: `Test Hook ${hookId}`,
            command: 'echo "test"',
            source: 'user',
          };
          
          testRegistry.registerHook('session_start', testHook);
          
          // Set initial state in settings
          const mockSettings = {
            hooks: {
              enabled: {
                [hookId]: initialState,
              } as Record<string, boolean>,
            },
          };
          vi.mocked(testSettings.getHookSettings).mockReturnValue(mockSettings.hooks);
          
          // Capture the context value
          let capturedValue: ReturnType<typeof useHooks> | null = null;
          
          render(
            <HooksProvider hookRegistry={testRegistry} settingsService={testSettings}>
              <TestComponent onRender={(value) => { capturedValue = value; }} />
            </HooksProvider>
          );
          
          // Wait for initialization
          await new Promise(resolve => setTimeout(resolve, 100));
          
          expect(capturedValue).not.toBeNull();
          
          // Verify initial state
          const initialEnabled = capturedValue!.isHookEnabled(hookId);
          expect(initialEnabled).toBe(initialState);
          
          // Act: Toggle once
          await capturedValue!.toggleHook(hookId);
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Verify state changed
          const afterFirstToggle = capturedValue!.isHookEnabled(hookId);
          expect(afterFirstToggle).toBe(!initialState);
          
          // Act: Toggle twice (back to original)
          await capturedValue!.toggleHook(hookId);
          await new Promise(resolve => setTimeout(resolve, 50));
          
          // Assert: Back to initial state (idempotency)
          const afterSecondToggle = capturedValue!.isHookEnabled(hookId);
          expect(afterSecondToggle).toBe(initialState);
          
          // Verify settings were updated correctly
          expect(testSettings.setHookEnabled).toHaveBeenCalledTimes(2);
          expect(testSettings.setHookEnabled).toHaveBeenNthCalledWith(1, hookId, !initialState);
          expect(testSettings.setHookEnabled).toHaveBeenNthCalledWith(2, hookId, initialState);
        }
      ),
      {
        // Run 100 test cases with different hook IDs and initial states
        numRuns: 100,
        // Verbose output for debugging
        verbose: false,
      }
    );
  });

  /**
   * Property: Multiple consecutive toggles maintain consistency
   * 
   * This is an extension of the idempotency property that verifies
   * any even number of toggles returns to the original state.
   */
  it('Property: Even number of toggles returns to original state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hookId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          initialState: fc.boolean(),
          toggleCount: fc.integer({ min: 2, max: 10 }).filter(n => n % 2 === 0), // Even numbers only
        }),
        async ({ hookId, initialState, toggleCount }) => {
          // Setup
          const testRegistry = new HookRegistry();
          const testSettings = SettingsService.getInstance();
          
          const testHook: Hook = {
            id: hookId,
            name: `Test Hook ${hookId}`,
            command: 'echo "test"',
            source: 'user',
          };
          
          testRegistry.registerHook('session_start', testHook);
          
          const mockSettings = {
            hooks: {
              enabled: {
                [hookId]: initialState,
              } as Record<string, boolean>,
            },
          };
          vi.mocked(testSettings.getHookSettings).mockReturnValue(mockSettings.hooks);
          
          let capturedValue: ReturnType<typeof useHooks> | null = null;
          
          render(
            <HooksProvider hookRegistry={testRegistry} settingsService={testSettings}>
              <TestComponent onRender={(value) => { capturedValue = value; }} />
            </HooksProvider>
          );
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          expect(capturedValue).not.toBeNull();
          
          // Verify initial state
          expect(capturedValue!.isHookEnabled(hookId)).toBe(initialState);
          
          // Act: Toggle multiple times (even number)
          for (let i = 0; i < toggleCount; i++) {
            await capturedValue!.toggleHook(hookId);
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          
          // Assert: Back to initial state after even number of toggles
          const finalState = capturedValue!.isHookEnabled(hookId);
          expect(finalState).toBe(initialState);
        }
      ),
      {
        numRuns: 50,
        verbose: false,
      }
    );
  });

  /**
   * Property: Odd number of toggles inverts the state
   * 
   * Verifies that any odd number of toggles results in the opposite state.
   */
  it('Property: Odd number of toggles inverts the state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          hookId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
          initialState: fc.boolean(),
          toggleCount: fc.integer({ min: 1, max: 9 }).filter(n => n % 2 === 1), // Odd numbers only
        }),
        async ({ hookId, initialState, toggleCount }) => {
          // Setup
          const testRegistry = new HookRegistry();
          const testSettings = SettingsService.getInstance();
          
          const testHook: Hook = {
            id: hookId,
            name: `Test Hook ${hookId}`,
            command: 'echo "test"',
            source: 'user',
          };
          
          testRegistry.registerHook('session_start', testHook);
          
          const mockSettings = {
            hooks: {
              enabled: {
                [hookId]: initialState,
              } as Record<string, boolean>,
            },
          };
          vi.mocked(testSettings.getHookSettings).mockReturnValue(mockSettings.hooks);
          
          let capturedValue: ReturnType<typeof useHooks> | null = null;
          
          render(
            <HooksProvider hookRegistry={testRegistry} settingsService={testSettings}>
              <TestComponent onRender={(value) => { capturedValue = value; }} />
            </HooksProvider>
          );
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          expect(capturedValue).not.toBeNull();
          
          // Verify initial state
          expect(capturedValue!.isHookEnabled(hookId)).toBe(initialState);
          
          // Act: Toggle multiple times (odd number)
          for (let i = 0; i < toggleCount; i++) {
            await capturedValue!.toggleHook(hookId);
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          
          // Assert: Opposite of initial state after odd number of toggles
          const finalState = capturedValue!.isHookEnabled(hookId);
          expect(finalState).toBe(!initialState);
        }
      ),
      {
        numRuns: 50,
        verbose: false,
      }
    );
  });
});
