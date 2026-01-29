/**
 * Property-Based Tests for Compression Engine
 *
 * Tests universal properties that must hold for all compression strategies.
 *
 * **Property 15: Compression Engine Strategies**
 * **Validates: Requirements FR-5, FR-6**
 *
 * Properties tested:
 * 1. All strategies must be valid and registered
 * 2. Strategy recommendations must be consistent with token usage
 * 3. Compression efficiency calculations must be accurate
 * 4. Strategy configurations must be valid
 * 5. Custom strategies can be registered and used
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { ActiveContextManager } from '../../storage/activeContextManager.js';
import { SessionHistoryManager } from '../../storage/sessionHistoryManager.js';
import { TokenCounterService } from '../../tokenCounter.js';
import { CompressionEngine, type CompressionStrategy, type StrategyConfig } from '../compressionEngine.js';
import { SummarizationService } from '../summarizationService.js';
import { ValidationService } from '../validationService.js';

import type { ProviderAdapter } from '../../../provider/types.js';
import type { Message } from '../../types.js';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Create mock provider adapter
 */
function createMockProvider(): ProviderAdapter {
  return {
    name: 'mock-provider',
    chatStream: async function* () {
      yield { type: 'text' as const, value: 'Mock summary of conversation' };
      yield { type: 'finish' as const, reason: 'stop' };
    },
  } as ProviderAdapter;
}

/**
 * Create test compression engine
 */
function createTestEngine(defaultStrategy?: CompressionStrategy): CompressionEngine {
  const tokenCounter = new TokenCounterService();
  const provider = createMockProvider();

  const systemPrompt: Message = {
    role: 'system',
    content: 'You are a helpful assistant.',
    id: 'system_1',
    timestamp: new Date(),
  };

  const activeContext = new ActiveContextManager(systemPrompt, 6800, tokenCounter);
  const sessionHistory = new SessionHistoryManager('test-session', './test-data');
  const summarizationService = new SummarizationService({
    provider,
    model: 'test-model',
  });
  const validationService = new ValidationService({
    ollamaLimit: 6800,
    safetyMargin: 1000,
    tokenCounter,
  });

  return new CompressionEngine({
    pipelineConfig: {
      summarizationService,
      validationService,
      activeContext,
      sessionHistory,
      tokenCounter,
    },
    tokenCounter,
    defaultStrategy,
  });
}

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Arbitrary for compression strategy
 */
const strategyArbitrary = fc.constantFrom<CompressionStrategy>(
  'standard',
  'aggressive',
  'selective',
  'emergency'
);

/**
 * Arbitrary for token counts
 */
const tokenCountArbitrary = fc.integer({ min: 100, max: 10000 });

/**
 * Arbitrary for token limits
 */
const tokenLimitArbitrary = fc.integer({ min: 1000, max: 20000 });

/**
 * Arbitrary for strategy configuration
 */
const strategyConfigArbitrary: fc.Arbitrary<StrategyConfig> = fc.record({
  name: strategyArbitrary,
  keepRecentCount: fc.integer({ min: 1, max: 10 }),
  minMessagesToCompress: fc.integer({ min: 1, max: 5 }),
  compressUserMessages: fc.boolean(),
  compressionLevel: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
  maxSummaryTokens: fc.integer({ min: 100, max: 1000 }),
});

// ============================================================================
// Property Tests
// ============================================================================

describe('CompressionEngine - Property Tests', () => {
  describe('Property 15.1: All strategies must be valid and registered', () => {
    it('should have all default strategies registered', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();
          const config = engine.getStrategyConfig(strategy);

          // Property: Every default strategy must be registered
          expect(config).toBeDefined();
          expect(config?.name).toBe(strategy);
        })
      );
    });

    it('should return all available strategies', () => {
      const engine = createTestEngine();
      const strategies = engine.getAvailableStrategies();

      // Property: Must have exactly 4 default strategies
      expect(strategies).toHaveLength(4);
      expect(strategies).toContain('standard');
      expect(strategies).toContain('aggressive');
      expect(strategies).toContain('selective');
      expect(strategies).toContain('emergency');
    });

    it('should allow setting any valid strategy as current', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();

          // Property: Setting a valid strategy should not throw
          expect(() => engine.setStrategy(strategy)).not.toThrow();

          // Property: Current strategy should be the one we set
          expect(engine.getCurrentStrategy()).toBe(strategy);
        })
      );
    });

    it('should throw when setting invalid strategy', () => {
      const engine = createTestEngine();

      // Property: Setting invalid strategy must throw
      expect(() => engine.setStrategy('invalid' as CompressionStrategy)).toThrow();
    });
  });

  describe('Property 15.2: Strategy recommendations must be consistent', () => {
    it('should recommend emergency strategy for very high usage', () => {
      fc.assert(
        fc.property(
          tokenLimitArbitrary,
          fc.double({ min: 0.95, max: 1.0, noNaN: true }),
          (limit, usageRatio) => {
            const engine = createTestEngine();
            const currentTokens = Math.ceil(limit * usageRatio); // Use ceil to ensure we're at or above the threshold

            const recommended = engine.recommendStrategy(currentTokens, limit);

            // Property: Usage >= 95% must recommend emergency
            expect(recommended).toBe('emergency');
          }
        )
      );
    });

    it('should recommend aggressive strategy for high usage', () => {
      fc.assert(
        fc.property(
          tokenLimitArbitrary,
          fc.double({ min: 0.86, max: 0.94, noNaN: true }), // Avoid boundaries
          (limit, usageRatio) => {
            const engine = createTestEngine();
            const currentTokens = Math.ceil(limit * usageRatio);

            const recommended = engine.recommendStrategy(currentTokens, limit);

            // Property: Usage >= 85% and < 95% must recommend aggressive
            expect(recommended).toBe('aggressive');
          }
        )
      );
    });

    it('should recommend standard strategy for moderate usage', () => {
      fc.assert(
        fc.property(
          tokenLimitArbitrary,
          fc.double({ min: 0.71, max: 0.84, noNaN: true }), // Avoid boundaries
          (limit, usageRatio) => {
            const engine = createTestEngine();
            const currentTokens = Math.ceil(limit * usageRatio);

            const recommended = engine.recommendStrategy(currentTokens, limit);

            // Property: Usage >= 70% and < 85% must recommend standard
            expect(recommended).toBe('standard');
          }
        )
      );
    });

    it('should recommend selective strategy for low usage', () => {
      fc.assert(
        fc.property(
          tokenLimitArbitrary,
          fc.double({ min: 0.1, max: 0.70 }),
          (limit, usageRatio) => {
            const engine = createTestEngine();
            const currentTokens = Math.floor(limit * usageRatio);

            const recommended = engine.recommendStrategy(currentTokens, limit);

            // Property: Usage < 70% must recommend selective
            expect(recommended).toBe('selective');
          }
        )
      );
    });

    it('should have monotonic strategy recommendations', () => {
      fc.assert(
        fc.property(tokenLimitArbitrary, (limit) => {
          const engine = createTestEngine();

          // Test at different usage levels
          const usage10 = engine.recommendStrategy(Math.floor(limit * 0.10), limit);
          const usage50 = engine.recommendStrategy(Math.floor(limit * 0.50), limit);
          const usage75 = engine.recommendStrategy(Math.floor(limit * 0.75), limit);
          const usage90 = engine.recommendStrategy(Math.floor(limit * 0.90), limit);
          const usage98 = engine.recommendStrategy(Math.floor(limit * 0.98), limit);

          // Property: Recommendations should become more aggressive as usage increases
          const strategyOrder = ['selective', 'standard', 'aggressive', 'emergency'];
          const getStrategyLevel = (s: CompressionStrategy) => strategyOrder.indexOf(s);

          expect(getStrategyLevel(usage10)).toBeLessThanOrEqual(getStrategyLevel(usage50));
          expect(getStrategyLevel(usage50)).toBeLessThanOrEqual(getStrategyLevel(usage75));
          expect(getStrategyLevel(usage75)).toBeLessThanOrEqual(getStrategyLevel(usage90));
          expect(getStrategyLevel(usage90)).toBeLessThanOrEqual(getStrategyLevel(usage98));
        })
      );
    });
  });

  describe('Property 15.3: Compression efficiency calculations must be accurate', () => {
    it('should calculate correct tokens saved', () => {
      fc.assert(
        fc.property(
          tokenCountArbitrary,
          tokenCountArbitrary,
          (originalTokens, compressedTokens) => {
            const engine = createTestEngine();
            const efficiency = engine.calculateEfficiency(originalTokens, compressedTokens);

            // Property: Tokens saved = original - compressed
            expect(efficiency.tokensSaved).toBe(originalTokens - compressedTokens);
          }
        )
      );
    });

    it('should calculate correct percentage saved', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }),
          fc.integer({ min: 10, max: 100 }),
          (originalTokens, compressedTokens) => {
            fc.pre(originalTokens > compressedTokens); // Ensure compression actually happened

            const engine = createTestEngine();
            const efficiency = engine.calculateEfficiency(originalTokens, compressedTokens);

            const expectedPercentage =
              ((originalTokens - compressedTokens) / originalTokens) * 100;

            // Property: Percentage saved should be accurate (within rounding)
            expect(efficiency.percentageSaved).toBeCloseTo(expectedPercentage, 2);
          }
        )
      );
    });

    it('should calculate correct compression ratio', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 10000 }),
          fc.integer({ min: 10, max: 100 }),
          (originalTokens, compressedTokens) => {
            fc.pre(originalTokens > 0); // Avoid division by zero

            const engine = createTestEngine();
            const efficiency = engine.calculateEfficiency(originalTokens, compressedTokens);

            const expectedRatio = compressedTokens / originalTokens;

            // Property: Compression ratio should be accurate (within rounding)
            // Use 1 decimal place tolerance to account for rounding in calculateEfficiency
            expect(efficiency.compressionRatio).toBeCloseTo(expectedRatio, 1);
          }
        )
      );
    });

    it('should handle zero compression (no savings)', () => {
      fc.assert(
        fc.property(tokenCountArbitrary, (tokens) => {
          const engine = createTestEngine();
          const efficiency = engine.calculateEfficiency(tokens, tokens);

          // Property: No compression means 0 tokens saved, 0% saved, ratio 1.0
          expect(efficiency.tokensSaved).toBe(0);
          expect(efficiency.percentageSaved).toBe(0);
          expect(efficiency.compressionRatio).toBe(1.0);
        })
      );
    });

    it('should handle negative compression (expansion)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 1100, max: 2000 }),
          (originalTokens, compressedTokens) => {
            fc.pre(compressedTokens > originalTokens); // Ensure expansion

            const engine = createTestEngine();
            const efficiency = engine.calculateEfficiency(originalTokens, compressedTokens);

            // Property: Expansion means negative tokens saved
            expect(efficiency.tokensSaved).toBeLessThan(0);
            expect(efficiency.percentageSaved).toBeLessThan(0);
            expect(efficiency.compressionRatio).toBeGreaterThan(1.0);
          }
        )
      );
    });
  });

  describe('Property 15.4: Strategy configurations must be valid', () => {
    it('should have valid keepRecentCount for all strategies', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();
          const config = engine.getStrategyConfig(strategy);

          // Property: keepRecentCount must be positive
          expect(config?.keepRecentCount).toBeGreaterThan(0);
        })
      );
    });

    it('should have valid minMessagesToCompress for all strategies', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();
          const config = engine.getStrategyConfig(strategy);

          // Property: minMessagesToCompress must be positive
          expect(config?.minMessagesToCompress).toBeGreaterThan(0);
        })
      );
    });

    it('should have valid compressionLevel for all strategies', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();
          const config = engine.getStrategyConfig(strategy);

          // Property: compressionLevel must be 1, 2, or 3
          expect(config?.compressionLevel).toBeGreaterThanOrEqual(1);
          expect(config?.compressionLevel).toBeLessThanOrEqual(3);
        })
      );
    });

    it('should have valid maxSummaryTokens for all strategies', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();
          const config = engine.getStrategyConfig(strategy);

          // Property: maxSummaryTokens must be positive
          expect(config?.maxSummaryTokens).toBeGreaterThan(0);
        })
      );
    });

    it('should have emergency strategy as most aggressive', () => {
      const engine = createTestEngine();
      const emergency = engine.getStrategyConfig('emergency')!;
      const standard = engine.getStrategyConfig('standard')!;

      // Property: Emergency should keep fewer messages
      expect(emergency.keepRecentCount).toBeLessThanOrEqual(standard.keepRecentCount);

      // Property: Emergency should use more aggressive compression level
      expect(emergency.compressionLevel).toBeLessThanOrEqual(standard.compressionLevel);

      // Property: Emergency should have smaller max summary tokens
      expect(emergency.maxSummaryTokens).toBeLessThanOrEqual(standard.maxSummaryTokens);
    });
  });

  describe('Property 15.5: Custom strategies can be registered and used', () => {
    it('should allow registering custom strategies', () => {
      fc.assert(
        fc.property(strategyConfigArbitrary, (config) => {
          const engine = createTestEngine();
          const customName = 'custom' as CompressionStrategy;
          const customConfig = { ...config, name: customName };

          // Property: Registering custom strategy should not throw
          expect(() => engine.registerStrategy(customName, customConfig)).not.toThrow();

          // Property: Custom strategy should be retrievable
          const retrieved = engine.getStrategyConfig(customName);
          expect(retrieved).toEqual(customConfig);
        })
      );
    });

    it('should allow using custom strategies', () => {
      fc.assert(
        fc.property(strategyConfigArbitrary, (config) => {
          const engine = createTestEngine();
          const customName = 'custom' as CompressionStrategy;
          const customConfig = { ...config, name: customName };

          engine.registerStrategy(customName, customConfig);

          // Property: Setting custom strategy as current should work
          expect(() => engine.setStrategy(customName)).not.toThrow();
          expect(engine.getCurrentStrategy()).toBe(customName);
        })
      );
    });

    it('should include custom strategies in available strategies', () => {
      fc.assert(
        fc.property(strategyConfigArbitrary, (config) => {
          const engine = createTestEngine();
          const customName = 'custom' as CompressionStrategy;
          const customConfig = { ...config, name: customName };

          const beforeCount = engine.getAvailableStrategies().length;
          engine.registerStrategy(customName, customConfig);
          const afterCount = engine.getAvailableStrategies().length;

          // Property: Available strategies should increase by 1
          expect(afterCount).toBe(beforeCount + 1);

          // Property: Custom strategy should be in the list
          expect(engine.getAvailableStrategies()).toContain(customName);
        })
      );
    });

    it('should allow overwriting existing strategies', () => {
      fc.assert(
        fc.property(strategyArbitrary, strategyConfigArbitrary, (strategy, newConfig) => {
          const engine = createTestEngine();
          const modifiedConfig = { ...newConfig, name: strategy };

          // Property: Overwriting should not throw
          expect(() => engine.registerStrategy(strategy, modifiedConfig)).not.toThrow();

          // Property: Configuration should be updated
          const retrieved = engine.getStrategyConfig(strategy);
          expect(retrieved).toEqual(modifiedConfig);
        })
      );
    });
  });

  describe('Property 15.6: Compression estimation must be reasonable', () => {
    it('should estimate token savings correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
              content: fc.string({ minLength: 10, maxLength: 500 }),
              id: fc.uuid(),
              timestamp: fc.date(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          strategyArbitrary,
          (messages, strategy) => {
            const engine = createTestEngine();
            const estimate = engine.estimateCompression(messages as Message[], strategy);

            // Property: Estimated savings should be non-negative for valid compression
            if (estimate.worthCompressing) {
              expect(estimate.estimatedTokensSaved).toBeGreaterThanOrEqual(0);
            }

            // Property: Compression ratio should be between 0 and 1
            expect(estimate.estimatedCompressionRatio).toBeGreaterThan(0);
            expect(estimate.estimatedCompressionRatio).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 50 } // Reduce runs for performance
      );
    });

    it('should recommend compression only when worthwhile', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
              content: fc.string({ minLength: 10, maxLength: 500 }),
              id: fc.uuid(),
              timestamp: fc.date(),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          strategyArbitrary,
          (messages, strategy) => {
            const engine = createTestEngine();
            const estimate = engine.estimateCompression(messages as Message[], strategy);

            // Property: Should only recommend compression if savings >= 500 tokens
            if (estimate.worthCompressing) {
              expect(estimate.estimatedTokensSaved).toBeGreaterThanOrEqual(500);
            } else {
              expect(estimate.estimatedTokensSaved).toBeLessThan(500);
            }
          }
        ),
        { numRuns: 50 } // Reduce runs for performance
      );
    });

    it('should have more aggressive strategies save more tokens', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
              content: fc.string({ minLength: 100, maxLength: 500 }),
              id: fc.uuid(),
              timestamp: fc.date(),
            }),
            { minLength: 5, maxLength: 20 }
          ),
          (messages) => {
            const engine = createTestEngine();

            const selective = engine.estimateCompression(messages as Message[], 'selective');
            const standard = engine.estimateCompression(messages as Message[], 'standard');
            const aggressive = engine.estimateCompression(messages as Message[], 'aggressive');
            const emergency = engine.estimateCompression(messages as Message[], 'emergency');

            // Property: More aggressive strategies should have lower compression ratios
            expect(emergency.estimatedCompressionRatio).toBeLessThanOrEqual(
              aggressive.estimatedCompressionRatio
            );
            expect(aggressive.estimatedCompressionRatio).toBeLessThanOrEqual(
              standard.estimatedCompressionRatio
            );
            expect(standard.estimatedCompressionRatio).toBeLessThanOrEqual(
              selective.estimatedCompressionRatio
            );
          }
        ),
        { numRuns: 30 } // Reduce runs for performance
      );
    });
  });

  describe('Property 15.7: Strategy selection must be deterministic', () => {
    it('should return same strategy for same inputs', () => {
      fc.assert(
        fc.property(tokenCountArbitrary, tokenLimitArbitrary, (tokens, limit) => {
          const engine1 = createTestEngine();
          const engine2 = createTestEngine();

          const strategy1 = engine1.recommendStrategy(tokens, limit);
          const strategy2 = engine2.recommendStrategy(tokens, limit);

          // Property: Same inputs should produce same strategy
          expect(strategy1).toBe(strategy2);
        })
      );
    });

    it('should maintain current strategy across operations', () => {
      fc.assert(
        fc.property(strategyArbitrary, (strategy) => {
          const engine = createTestEngine();
          engine.setStrategy(strategy);

          const before = engine.getCurrentStrategy();
          const _config = engine.getStrategyConfig(strategy);
          const after = engine.getCurrentStrategy();

          // Property: Getting config should not change current strategy
          expect(before).toBe(strategy);
          expect(after).toBe(strategy);
          expect(before).toBe(after);
        })
      );
    });
  });
});
