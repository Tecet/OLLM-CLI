/**
 * Property-based tests for hook output processing
 * Feature: stage-05-hooks-extensions-mcp
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { HookRunner } from '../hookRunner.js';
import type { Hook, HookInput, HookOutput } from '../types.js';
import { arbHook, arbHookInput } from './test-helpers.js';

describe('Hook Output Processing - Property Tests', () => {
  let runner: HookRunner;

  beforeEach(() => {
    runner = new HookRunner(5000);
  });

  /**
   * Property 35: Hook Flow Control
   * For any hook that returns continue: false, the system should abort the current operation,
   * and for hooks that return systemMessages, those messages should be added to conversation
   * context in execution order.
   * Validates: Requirements 15.1, 15.2, 15.4
   */
  describe('Property 35: Hook Flow Control', () => {
    it('should abort execution when any hook returns continue: false', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(arbHook(), { selector: h => h.id, minLength: 2, maxLength: 5 }),
          fc.integer({ min: 0, max: 4 }),
          arbHookInput(),
          async (hooks, abortIndex, input) => {
            // Skip if hooks have invalid IDs (empty or whitespace)
            if (hooks.some(h => !h.id || h.id.trim().length === 0)) {
              return true; // Property holds trivially for invalid inputs
            }
            
            // Ensure we have a valid abort index
            const actualAbortIndex = abortIndex % hooks.length;

            // Mock executeHookInternal to return controlled outputs
            vi.spyOn(runner as any, 'executeHookInternal').mockImplementation(
              (async (hook: Hook, _input: HookInput): Promise<HookOutput> => {
                const hookIndex = hooks.findIndex((h) => h.id === hook.id);
                
                // Hook at abortIndex returns continue: false
                if (hookIndex === actualAbortIndex) {
                  return {
                    continue: false,
                    systemMessage: `Aborted at hook ${hookIndex}`,
                  };
                }
                
                // Other hooks return continue: true
                return {
                  continue: true,
                  systemMessage: `Executed hook ${hookIndex}`,
                };
              }) as any
            );

            const summary = await runner.executeHooksWithSummary(hooks, input);

            // Should not continue if any hook returned continue: false
            expect(summary.shouldContinue).toBe(false);
            expect(summary.aborted).toBe(true);

            // Should only execute hooks up to and including the abort hook
            expect(summary.outputs.length).toBeLessThanOrEqual(actualAbortIndex + 1);

            // Restore original implementation
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should concatenate system messages in execution order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(arbHook(), { selector: h => h.id, minLength: 1, maxLength: 5 }),
          arbHookInput(),
          async (hooks, input) => {
            // Skip if hooks have invalid IDs (empty or whitespace)
            if (hooks.some(h => !h.id || h.id.trim().length === 0)) {
              return true; // Property holds trivially for invalid inputs
            }
            
            // Mock executeHookInternal to return system messages
            vi.spyOn(runner as any, 'executeHookInternal').mockImplementation(
              (async (hook: Hook, _input: HookInput): Promise<HookOutput> => {
                const hookIndex = hooks.findIndex((h) => h.id === hook.id);
                return {
                  continue: true,
                  systemMessage: `Message from hook ${hookIndex}`,
                };
              }) as any
            );

            const summary = await runner.executeHooksWithSummary(hooks, input);

            // Should have collected all system messages
            expect(summary.systemMessages.length).toBe(hooks.length);

            // Messages should be in execution order
            summary.systemMessages.forEach((msg, index) => {
              expect(msg).toBe(`Message from hook ${index}`);
            });

            // Restore original implementation
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue execution when all hooks return continue: true', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(arbHook(), { selector: h => h.id, minLength: 1, maxLength: 5 }),
          arbHookInput(),
          async (hooks, input) => {
            // Skip if hooks have invalid IDs (empty or whitespace)
            if (hooks.some(h => !h.id || h.id.trim().length === 0)) {
              return true; // Property holds trivially for invalid inputs
            }
            
            // Mock executeHookInternal to always return continue: true
            vi.spyOn(runner as any, 'executeHookInternal').mockImplementation(
              (async (_hook: Hook, _input: HookInput): Promise<HookOutput> => {
                return {
                  continue: true,
                };
              }) as any
            );

            const summary = await runner.executeHooksWithSummary(hooks, input);

            // Should continue if all hooks returned continue: true
            expect(summary.shouldContinue).toBe(true);
            expect(summary.aborted).toBe(false);

            // Should have executed all hooks
            expect(summary.outputs.length).toBe(hooks.length);

            // Restore original implementation
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 36: Hook Data Passing
   * For any hook that returns additional data, that data should be available to subsequent
   * hooks in the same event processing chain.
   * Validates: Requirements 15.3, 15.5
   */
  describe('Property 36: Hook Data Passing', () => {
    it('should pass data from one hook to subsequent hooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbHook(), { minLength: 2, maxLength: 5 }),
          arbHookInput(),
          fc.array(
            fc.record({ 
              key: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0 && /^[a-zA-Z0-9_]+$/.test(s)), 
              value: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))
            }), 
            { minLength: 1, maxLength: 3 }
          ),
          async (hooks, input, dataItems) => {
            // Mock executeHookInternal to return data that accumulates
            let callCount = 0;
            vi.spyOn(runner as any, 'executeHookInternal').mockImplementation(
              (async (_hook: Hook, _hookInput: HookInput): Promise<HookOutput> => {
                const currentCall = callCount++;
                
                // Return new data if available
                const newData = currentCall < dataItems.length
                  ? { [dataItems[currentCall].key]: dataItems[currentCall].value }
                  : {};
                
                return {
                  continue: true,
                  data: newData,
                };
              }) as any
            );

            const summary = await runner.executeHooksWithSummary(hooks, input);

            // Should have executed all hooks
            expect(summary.outputs.length).toBe(hooks.length);

            // Aggregated data should contain all data from all hooks (with valid keys)
            const expectedKeys = dataItems
              .slice(0, Math.min(hooks.length, dataItems.length))
              .map(item => item.key)
              .filter(key => key && key.trim().length > 0);
            
            expectedKeys.forEach(key => {
              expect(summary.aggregatedData).toHaveProperty(key);
            });

            // Restore original implementation
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should merge data from multiple hooks without losing previous data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(arbHook(), { minLength: 2, maxLength: 5 }),
          arbHookInput(),
          async (hooks, input) => {
            // Skip if hooks have invalid IDs (empty or whitespace)
            if (hooks.some(h => !h.id || h.id.trim().length === 0)) {
              return true; // Property holds trivially for invalid inputs
            }
            
            // Mock executeHookInternal to return unique data per hook
            vi.spyOn(runner as any, 'executeHookInternal').mockImplementation(
              (async (hook: Hook, _input: HookInput): Promise<HookOutput> => {
                const hookIndex = hooks.findIndex((h) => h.id === hook.id);
                return {
                  continue: true,
                  data: {
                    [`hook_${hookIndex}_data`]: `value_${hookIndex}`,
                  },
                };
              }) as any
            );

            const summary = await runner.executeHooksWithSummary(hooks, input);

            // Aggregated data should contain data from all hooks
            hooks.forEach((_, index) => {
              expect(summary.aggregatedData).toHaveProperty(`hook_${index}_data`);
              expect(summary.aggregatedData[`hook_${index}_data`]).toBe(`value_${index}`);
            });

            // Restore original implementation
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve data through the execution chain even when some hooks do not return data', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uniqueArray(arbHook(), { selector: h => h.id, minLength: 3, maxLength: 5 }),
          arbHookInput(),
          async (hooks, input) => {
            // Mock executeHookInternal where only odd-indexed hooks return data
            vi.spyOn(runner as any, 'executeHookInternal').mockImplementation(
              (async (hook: Hook, _input: HookInput): Promise<HookOutput> => {
                const hookIndex = hooks.findIndex((h) => h.id === hook.id);
                
                // Only odd-indexed hooks return data
                if (hookIndex % 2 === 1) {
                  return {
                    continue: true,
                    data: {
                      [`hook_${hookIndex}_data`]: `value_${hookIndex}`,
                    },
                  };
                }
                
                // Even-indexed hooks return no data
                return {
                  continue: true,
                };
              }) as any
            );

            const summary = await runner.executeHooksWithSummary(hooks, input);

            // Aggregated data should contain data from odd-indexed hooks only
            hooks.forEach((_, index) => {
              if (index % 2 === 1) {
                expect(summary.aggregatedData).toHaveProperty(`hook_${index}_data`);
                expect(summary.aggregatedData[`hook_${index}_data`]).toBe(`value_${index}`);
              }
            });

            // Restore original implementation
            vi.restoreAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
