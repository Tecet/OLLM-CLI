/**
 * Property-Based Tests for Tier-Aware Compression
 *
 * Property 23: Tier Budget Enforcement
 * Validates: Requirements FR-11
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TierAwareCompression } from '../tierAwareCompression.js';
import { ContextTier } from '../../types.js';

describe('Property 23: Tier Budget Enforcement', () => {
  const tierCompression = new TierAwareCompression();

  /**
   * Property: Prompt budget is always within expected range for each tier
   */
  it('should enforce tier-specific prompt budgets', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        (tier) => {
          const budget = tierCompression.getPromptBudget(tier);

          // Budget must be positive
          expect(budget).toBeGreaterThan(0);

          // Budget must match expected values
          const expectedBudgets: Record<ContextTier, number> = {
            [ContextTier.TIER_1_MINIMAL]: 200,
            [ContextTier.TIER_2_BASIC]: 500,
            [ContextTier.TIER_3_STANDARD]: 1000,
            [ContextTier.TIER_4_PREMIUM]: 1500,
            [ContextTier.TIER_5_ULTRA]: 1500,
          };

          expect(budget).toBe(expectedBudgets[tier]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Checkpoint budget is never negative
   */
  it('should never return negative checkpoint budget', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 0, max: 2000 }), // System prompt tokens
        (tier, systemPromptTokens) => {
          const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, systemPromptTokens);

          // Checkpoint budget must never be negative
          expect(checkpointBudget).toBeGreaterThanOrEqual(0);

          // If system prompt exceeds tier budget, checkpoint budget should be 0
          const promptBudget = tierCompression.getPromptBudget(tier);
          if (systemPromptTokens >= promptBudget) {
            expect(checkpointBudget).toBe(0);
          } else {
            expect(checkpointBudget).toBe(promptBudget - systemPromptTokens);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * Property: Compression triggers respect tier budgets
   */
  it('should trigger compression based on tier-specific thresholds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 0, max: 10000 }), // Current tokens
        fc.integer({ min: 8000, max: 100000 }), // Ollama limit
        fc.integer({ min: 100, max: 1500 }), // System prompt tokens
        (tier, currentTokens, ollamaLimit, systemPromptTokens) => {
          const shouldCompress = tierCompression.shouldCompress(
            tier,
            currentTokens,
            ollamaLimit,
            systemPromptTokens
          );

          // Calculate expected threshold
          const promptBudget = tierCompression.getPromptBudget(tier);
          const safetyMargin = 1000;
          const availableForMessages = ollamaLimit - systemPromptTokens - promptBudget - safetyMargin;
          const threshold = availableForMessages * 0.75;

          // Compression should trigger when current tokens exceed threshold
          if (currentTokens > threshold) {
            expect(shouldCompress).toBe(true);
          } else {
            expect(shouldCompress).toBe(false);
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * Property: Total budget calculation includes all components
   */
  it('should include all components in total budget calculation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 100, max: 1500 }), // System prompt tokens
        fc.integer({ min: 0, max: 5000 }), // Checkpoint tokens
        fc.integer({ min: 8000, max: 100000 }), // Ollama limit
        (tier, systemPromptTokens, checkpointTokens, ollamaLimit) => {
          const budget = tierCompression.calculateTotalBudget(
            tier,
            systemPromptTokens,
            checkpointTokens,
            ollamaLimit
          );

          // All components must be included
          expect(budget.totalOllamaLimit).toBe(ollamaLimit);
          expect(budget.systemPromptTokens).toBe(systemPromptTokens);
          expect(budget.checkpointTokens).toBe(checkpointTokens);
          expect(budget.promptBudget).toBe(tierCompression.getPromptBudget(tier));
          expect(budget.safetyMargin).toBe(1000);

          // Available for messages must be non-negative
          expect(budget.availableForMessages).toBeGreaterThanOrEqual(0);

          // Compression threshold must be 75% of available
          expect(budget.compressionThreshold).toBe(budget.availableForMessages * 0.75);

          // Total used + available should equal Ollama limit
          const totalUsed =
            budget.systemPromptTokens +
            budget.promptBudget +
            budget.checkpointTokens +
            budget.safetyMargin;
          expect(budget.availableForMessages).toBe(Math.max(0, ollamaLimit - totalUsed));
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * Property: System prompt validation never allows compression
   */
  it('should throw error if system prompt exceeds tier budget', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 0, max: 3000 }), // System prompt tokens
        (tier, systemPromptTokens) => {
          const promptBudget = tierCompression.getPromptBudget(tier);

          if (systemPromptTokens > promptBudget) {
            // Should throw error
            expect(() => {
              tierCompression.validateSystemPrompt(systemPromptTokens, tier);
            }).toThrow(/System prompt .* exceeds tier budget/);
          } else {
            // Should not throw
            expect(() => {
              tierCompression.validateSystemPrompt(systemPromptTokens, tier);
            }).not.toThrow();
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * Property: Compression urgency increases with token usage
   */
  it('should calculate compression urgency correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 8000, max: 100000 }), // Ollama limit
        fc.integer({ min: 100, max: 1000 }), // System prompt tokens
        fc.float({ min: 0, max: 1 }), // Usage percentage
        (tier, ollamaLimit, systemPromptTokens, usagePercentage) => {
          const budget = tierCompression.calculateTotalBudget(tier, systemPromptTokens, 0, ollamaLimit);
          const currentTokens = Math.floor(budget.availableForMessages * usagePercentage);

          const urgency = tierCompression.getCompressionUrgency(
            tier,
            currentTokens,
            ollamaLimit,
            systemPromptTokens
          );

          // Urgency should match usage percentage
          if (usagePercentage < 0.5) {
            expect(urgency).toBe('none');
          } else if (usagePercentage < 0.75) {
            expect(urgency).toBe('low');
          } else if (usagePercentage < 0.85) {
            expect(urgency).toBe('medium');
          } else if (usagePercentage < 0.95) {
            expect(urgency).toBe('high');
          } else {
            expect(urgency).toBe('critical');
          }
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * Property: Tier detection from context size is consistent
   */
  it('should consistently detect tier from context size', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2048, max: 131072 }), (contextSize) => {
        const tier = tierCompression.getTierFromContextSize(contextSize);

        // Verify tier matches expected range
        if (contextSize < 8192) {
          expect(tier).toBe(ContextTier.TIER_1_MINIMAL);
        } else if (contextSize < 16384) {
          expect(tier).toBe(ContextTier.TIER_2_BASIC);
        } else if (contextSize < 32768) {
          expect(tier).toBe(ContextTier.TIER_3_STANDARD);
        } else if (contextSize < 65536) {
          expect(tier).toBe(ContextTier.TIER_4_PREMIUM);
        } else {
          expect(tier).toBe(ContextTier.TIER_5_ULTRA);
        }
      }),
      { numRuns: 500 }
    );
  });

  /**
   * Property: Tier budgets are monotonically increasing (except TIER_5)
   */
  it('should have monotonically increasing budgets across tiers', () => {
    const tier1Budget = tierCompression.getPromptBudget(ContextTier.TIER_1_MINIMAL);
    const tier2Budget = tierCompression.getPromptBudget(ContextTier.TIER_2_BASIC);
    const tier3Budget = tierCompression.getPromptBudget(ContextTier.TIER_3_STANDARD);
    const tier4Budget = tierCompression.getPromptBudget(ContextTier.TIER_4_PREMIUM);
    const tier5Budget = tierCompression.getPromptBudget(ContextTier.TIER_5_ULTRA);

    // Budgets should increase (or stay same for TIER_4 and TIER_5)
    expect(tier2Budget).toBeGreaterThan(tier1Budget);
    expect(tier3Budget).toBeGreaterThan(tier2Budget);
    expect(tier4Budget).toBeGreaterThan(tier3Budget);
    expect(tier5Budget).toBeGreaterThanOrEqual(tier4Budget);
  });
});
