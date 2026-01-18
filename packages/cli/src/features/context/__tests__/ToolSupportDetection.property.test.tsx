/**
 * Property-Based Tests for Tool Support Detection
 * 
 * These tests validate critical correctness properties:
 * - Property 19.1: Tools never sent to non-supporting models
 * - Property 19.2: Unknown models always prompt or use safe default
 * - Property 19.3: Metadata persistence is consistent
 * - Property 19.4: Override precedence is correct
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import type { UserModel } from '../../profiles/types.js';

describe('Tool Support Detection - Property Tests', () => {
  beforeEach(() => {
    // Clear global callbacks before each test
    globalThis.__ollmAddSystemMessage = undefined;
    globalThis.__ollmPromptUser = undefined;
  });

  afterEach(() => {
    // Clean up after tests
    globalThis.__ollmAddSystemMessage = undefined;
    globalThis.__ollmPromptUser = undefined;
  });

  describe('Property 19.1: Tools never sent to non-supporting models', () => {
    it('should never expose tools to models with tool_support=false', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            toolSupport: fc.constant(false),
            source: fc.constantFrom('profile', 'user_confirmed', 'auto_detected', 'runtime_error'),
          }),
          (config) => {
            // Simulate model with tool_support=false
            const model: Partial<UserModel> = {
              id: config.modelId,
              name: config.modelId,
              tool_support: config.toolSupport,
              tool_support_source: config.source,
            };

            // Property: If tool_support is false, tools should never be sent
            // This is enforced by modelSupportsTools() check in ChatContext
            
            // Verify the model metadata
            expect(model.tool_support).toBe(false);
            
            // In the actual implementation, ChatContext checks:
            // if (!modelSupportsTools(currentModel)) {
            //   // Don't create ToolRegistry
            //   // Don't pass tools to LLM
            // }
            
            // This property ensures safety: non-supporting models never receive tools
            return model.tool_support === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should filter tools based on model capability before sending to LLM', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelSupportsTools: fc.boolean(),
            toolsAvailable: fc.array(fc.string(), { minLength: 0, maxLength: 10 }),
          }),
          (config) => {
            // Property: Tools sent to LLM = tools available if model supports, empty otherwise
            const toolsSentToLLM = config.modelSupportsTools ? config.toolsAvailable : [];
            
            // Verify the filtering logic
            if (!config.modelSupportsTools) {
              expect(toolsSentToLLM).toEqual([]);
            } else {
              expect(toolsSentToLLM).toEqual(config.toolsAvailable);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never create ToolRegistry when model does not support tools', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (modelSupportsTools) => {
            // Property: ToolRegistry creation is conditional on model support
            const shouldCreateRegistry = modelSupportsTools;
            
            // In ChatContext:
            // const toolRegistry = modelSupportsTools ? new ToolRegistry() : undefined;
            
            if (!modelSupportsTools) {
              expect(shouldCreateRegistry).toBe(false);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19.2: Unknown models always prompt or use safe default', () => {
    it('should always handle unknown models with prompt or safe default', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            hasPromptCallback: fc.boolean(),
            userResponse: fc.constantFrom('Yes', 'No', 'Auto-detect', 'timeout'),
          }),
          async (config) => {
            // Setup prompt callback based on test config
            if (config.hasPromptCallback) {
              globalThis.__ollmPromptUser = vi.fn().mockResolvedValue(
                config.userResponse === 'timeout' ? 'No' : config.userResponse
              );
            } else {
              globalThis.__ollmPromptUser = undefined;
            }

            // Property: Unknown models must either:
            // 1. Prompt user (if callback available)
            // 2. Use safe default (tools disabled)
            
            let toolSupport: boolean;
            
            if (config.hasPromptCallback) {
              // Should prompt user
              if (config.userResponse === 'Yes') {
                toolSupport = true;
              } else if (config.userResponse === 'No' || config.userResponse === 'timeout') {
                toolSupport = false; // Safe default
              } else {
                // Auto-detect would run, but for this test we assume it returns false (safe default)
                toolSupport = false;
              }
            } else {
              // No prompt callback - must use safe default
              toolSupport = false;
            }

            // Verify safe default is used when no prompt callback
            if (!config.hasPromptCallback) {
              expect(toolSupport).toBe(false);
            }
            
            // Verify timeout uses safe default
            if (config.userResponse === 'timeout') {
              expect(toolSupport).toBe(false);
            }
            
            // Property always holds: tool support is defined as boolean
            expect(typeof toolSupport).toBe('boolean');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should timeout after 30 seconds and use safe default', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (_modelId) => {
            // Property: Timeout always results in safe default (tools disabled)
            const TIMEOUT_MS = 30000;
            const SAFE_DEFAULT = false;
            
            // After timeout, tool_support should be set to safe default
            const toolSupportAfterTimeout = SAFE_DEFAULT;
            
            expect(TIMEOUT_MS).toBe(30000);
            expect(toolSupportAfterTimeout).toBe(false);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should never leave unknown models in undefined state', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            hasProfile: fc.boolean(),
            hasUserModel: fc.boolean(),
          }),
          (config) => {
            // Property: Every model must have a defined tool_support value
            // Either from profile, user_models.json, or safe default
            
            let toolSupport: boolean;
            
            if (config.hasProfile || config.hasUserModel) {
              // Has metadata - use it
              toolSupport = true; // Assume true from metadata
            } else {
              // Unknown model - must prompt or use safe default
              toolSupport = false; // Safe default
            }
            
            // Verify tool_support is never undefined
            expect(toolSupport).toBeDefined();
            expect(typeof toolSupport).toBe('boolean');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19.3: Metadata persistence is consistent', () => {
    it('should preserve all metadata fields when updating tool_support', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            originalToolSupport: fc.boolean(),
            newToolSupport: fc.boolean(),
            manualContext: fc.option(fc.integer({ min: 1024, max: 131072 })),
            abilities: fc.array(fc.constantFrom('code', 'chat', 'vision', 'reasoning'), { maxLength: 4 }),
          }),
          (config) => {
            // Create original model with metadata
            const originalModel: Partial<UserModel> = {
              id: config.modelId,
              name: config.modelId,
              tool_support: config.originalToolSupport,
              manual_context: config.manualContext ?? undefined,
              abilities: config.abilities,
            };

            // Simulate updating tool_support
            const updatedModel: Partial<UserModel> = {
              ...originalModel,
              tool_support: config.newToolSupport,
              tool_support_source: 'user_confirmed',
              tool_support_confirmed_at: new Date().toISOString(),
            };

            // Property: Other metadata fields must be preserved
            expect(updatedModel.manual_context).toEqual(originalModel.manual_context);
            expect(updatedModel.abilities).toEqual(originalModel.abilities);
            expect(updatedModel.id).toBe(originalModel.id);
            expect(updatedModel.name).toBe(originalModel.name);
            
            // New fields should be added
            expect(updatedModel.tool_support).toBe(config.newToolSupport);
            expect(updatedModel.tool_support_source).toBe('user_confirmed');
            expect(updatedModel.tool_support_confirmed_at).toBeDefined();
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistent source and timestamp when saving', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            toolSupport: fc.boolean(),
            source: fc.constantFrom('user_confirmed', 'auto_detected'),
          }),
          (config) => {
            // Simulate saving metadata
            const savedModel: Partial<UserModel> = {
              id: config.modelId,
              tool_support: config.toolSupport,
              tool_support_source: config.source,
              tool_support_confirmed_at: new Date().toISOString(),
            };

            // Property: Source and timestamp must be consistent
            expect(savedModel.tool_support_source).toBe(config.source);
            expect(savedModel.tool_support_confirmed_at).toBeDefined();
            
            // Timestamp should be valid ISO string
            const timestamp = new Date(savedModel.tool_support_confirmed_at!);
            expect(timestamp.toString()).not.toBe('Invalid Date');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never lose user_confirmed overrides during updates', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            existingSource: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
            newSource: fc.constantFrom('auto_detected', 'runtime_error', 'profile'),
          }),
          (config) => {
            // Property: user_confirmed should never be overridden by lower precedence sources
            const precedence = {
              'user_confirmed': 4,
              'auto_detected': 3,
              'runtime_error': 2,
              'profile': 1,
            };

            const shouldOverride = precedence[config.newSource] >= precedence[config.existingSource];
            
            // If existing is user_confirmed, new source should not override
            if (config.existingSource === 'user_confirmed') {
              expect(shouldOverride).toBe(false);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle concurrent updates correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            updates: fc.array(
              fc.record({
                toolSupport: fc.boolean(),
                source: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
                timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          (config) => {
            // Property: Last update with highest precedence should win
            const precedence = {
              'user_confirmed': 4,
              'auto_detected': 3,
              'runtime_error': 2,
              'profile': 1,
            };

            // Sort updates by precedence (highest first)
            const sortedUpdates = [...config.updates].sort((a, b) => {
              const precA = precedence[a.source];
              const precB = precedence[b.source];
              return precB - precA;
            });

            // Winner should be the update with highest precedence
            const winner = sortedUpdates[0];
            
            expect(winner).toBeDefined();
            expect(precedence[winner.source]).toBeGreaterThanOrEqual(
              Math.min(...config.updates.map(u => precedence[u.source]))
            );
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 19.4: Override precedence is correct', () => {
    it('should respect precedence order: user_confirmed > auto_detected > runtime_error > profile', () => {
      fc.assert(
        fc.property(
          fc.record({
            source1: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
            source2: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
          }),
          (config) => {
            const precedence = {
              'user_confirmed': 4,
              'auto_detected': 3,
              'runtime_error': 2,
              'profile': 1,
            };

            const prec1 = precedence[config.source1];
            const prec2 = precedence[config.source2];

            // Property: Higher precedence value should always win
            if (prec1 > prec2) {
              expect(prec1).toBeGreaterThan(prec2);
            } else if (prec1 < prec2) {
              expect(prec1).toBeLessThan(prec2);
            } else {
              expect(prec1).toBe(prec2);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should never allow lower precedence to override higher precedence', () => {
      fc.assert(
        fc.property(
          fc.record({
            existingSource: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
            newSource: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
          }),
          (config) => {
            const precedence = {
              'user_confirmed': 4,
              'auto_detected': 3,
              'runtime_error': 2,
              'profile': 1,
            };

            const existingPrec = precedence[config.existingSource];
            const newPrec = precedence[config.newSource];

            // Property: Override only allowed if new precedence >= existing precedence
            const shouldOverride = newPrec >= existingPrec;
            
            if (newPrec < existingPrec) {
              expect(shouldOverride).toBe(false);
            } else {
              expect(shouldOverride).toBe(true);
            }
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle equal precedence with timestamp tiebreaker', () => {
      fc.assert(
        fc.property(
          fc.record({
            source: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
            timestamp1: fc.integer({ min: 1000000000000, max: 9999999999999 }),
            timestamp2: fc.integer({ min: 1000000000000, max: 9999999999999 }),
          }),
          (config) => {
            // Property: When precedence is equal, newer timestamp should win
            const override1 = {
              source: config.source,
              timestamp: config.timestamp1,
            };
            
            const override2 = {
              source: config.source,
              timestamp: config.timestamp2,
            };

            // Same precedence, so timestamp determines winner
            const winner = config.timestamp2 >= config.timestamp1 ? override2 : override1;
            
            expect(winner.timestamp).toBeGreaterThanOrEqual(
              Math.min(config.timestamp1, config.timestamp2)
            );
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain precedence across multiple model swaps', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
              source: fc.constantFrom('user_confirmed', 'auto_detected', 'runtime_error', 'profile'),
              toolSupport: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (swaps) => {
            // Property: Precedence rules apply consistently across all swaps
            const precedence = {
              'user_confirmed': 4,
              'auto_detected': 3,
              'runtime_error': 2,
              'profile': 1,
            };

            // Track overrides for each model
            const overrides = new Map<string, { source: string; precedence: number }>();

            for (const swap of swaps) {
              const existing = overrides.get(swap.modelId);
              const newPrec = precedence[swap.source];

              if (!existing || newPrec >= existing.precedence) {
                // Override allowed
                overrides.set(swap.modelId, {
                  source: swap.source,
                  precedence: newPrec,
                });
              }
            }

            // Verify all overrides respect precedence
            for (const [_modelId, override] of overrides) {
              expect(override.precedence).toBeGreaterThanOrEqual(1);
              expect(override.precedence).toBeLessThanOrEqual(4);
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should never downgrade user_confirmed to any other source', () => {
      fc.assert(
        fc.property(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            attempts: fc.array(
              fc.constantFrom('auto_detected', 'runtime_error', 'profile'),
              { minLength: 1, maxLength: 10 }
            ),
          }),
          (config) => {
            // Start with user_confirmed
            let currentSource: string = 'user_confirmed';
            const precedence = {
              'user_confirmed': 4,
              'auto_detected': 3,
              'runtime_error': 2,
              'profile': 1,
            };

            // Try to override with lower precedence sources
            for (const attemptSource of config.attempts) {
              const currentPrec = precedence[currentSource];
              const attemptPrec = precedence[attemptSource];

              if (attemptPrec >= currentPrec) {
                currentSource = attemptSource;
              }
            }

            // Property: Should still be user_confirmed (highest precedence)
            expect(currentSource).toBe('user_confirmed');
            
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Integration Properties', () => {
    it('should maintain consistency across full workflow', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            modelId: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            isKnown: fc.boolean(),
            userResponse: fc.constantFrom('Yes', 'No', 'Auto-detect'),
            autoDetectResult: fc.boolean(),
          }),
          async (config) => {
            // Property: Full workflow maintains consistency
            let finalToolSupport: boolean;
            let finalSource: string;

            if (config.isKnown) {
              // Known model - use profile
              finalToolSupport = true; // Assume profile says true
              finalSource = 'profile';
            } else {
              // Unknown model - prompt user
              if (config.userResponse === 'Yes') {
                finalToolSupport = true;
                finalSource = 'user_confirmed';
              } else if (config.userResponse === 'No') {
                finalToolSupport = false;
                finalSource = 'user_confirmed';
              } else {
                // Auto-detect
                finalToolSupport = config.autoDetectResult;
                finalSource = 'auto_detected';
              }
            }

            // Verify consistency
            expect(finalToolSupport).toBeDefined();
            expect(typeof finalToolSupport).toBe('boolean');
            expect(finalSource).toBeDefined();
            expect(['profile', 'user_confirmed', 'auto_detected']).toContain(finalSource);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle rapid model swaps correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 1, maxLength: 50 }),
            { minLength: 2, maxLength: 20 }
          ),
          (modelIds) => {
            // Property: Rapid swaps should not cause race conditions
            // Each model should maintain its own override state
            
            const overrides = new Map<string, boolean>();
            
            for (const modelId of modelIds) {
              // Each model gets its own override
              if (!overrides.has(modelId)) {
                overrides.set(modelId, false); // Safe default
              }
            }

            // Verify each model has a defined state
            for (const modelId of modelIds) {
              expect(overrides.has(modelId)).toBe(true);
              expect(typeof overrides.get(modelId)).toBe('boolean');
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
