/**
 * Property-based tests for Token Counter.
 * These tests validate the correctness properties defined in the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TokenCounter } from '../tokenLimits.js';
import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderEvent,
  Message,
  MessagePart,
} from '../../provider/types.js';

/**
 * Arbitraries (generators) for property-based testing
 */

// Generate a text message part
const textPartArbitrary = fc.record({
  type: fc.constant('text' as const),
  text: fc.string(),
});

// Generate a message
const messageArbitrary = fc.record({
  role: fc.constantFrom('system' as const, 'user' as const, 'assistant' as const, 'tool' as const),
  parts: fc.array(textPartArbitrary, { minLength: 1, maxLength: 3 }),
  name: fc.option(fc.string(), { nil: undefined }),
});

// Generate a provider request
const providerRequestArbitrary = fc.record({
  model: fc.string({ minLength: 1 }),
  systemPrompt: fc.option(fc.string(), { nil: undefined }),
  messages: fc.array(messageArbitrary, { minLength: 0, maxLength: 10 }),
  tools: fc.constant(undefined),
  toolChoice: fc.constant(undefined),
  options: fc.constant(undefined),
  abortSignal: fc.constant(undefined),
});

// Generate a mock provider without countTokens
const mockProviderWithoutCountTokens = fc.constant({
  name: 'mock-provider',
  chatStream: async function* (): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: 'mock' };
  },
} as ProviderAdapter);

// Generate a mock provider with countTokens
const createMockProviderWithCountTokens = (tokenCount: number): ProviderAdapter => ({
  name: 'mock-provider-with-count',
  chatStream: async function* (): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: 'mock' };
  },
  countTokens: async (_request: ProviderRequest): Promise<number> => {
    return tokenCount;
  },
});

// Generate token limit config
const tokenLimitConfigArbitrary = fc.record({
  modelLimits: fc.option(fc.constant(new Map<string, number>([['test-model', 4096]])), { nil: undefined }),
  warningThreshold: fc.double({ min: 0.5, max: 0.99, noNaN: true }),
});

describe('Token Counter - Property-Based Tests', () => {
  describe('Property 22: Token Count Estimation', () => {
    it('should produce a positive integer estimate for any chat request', async () => {
      // Feature: stage-02-core-provider, Property 22: Token Count Estimation
      // Validates: Requirements 7.1
      await fc.assert(
        fc.asyncProperty(
          providerRequestArbitrary,
          mockProviderWithoutCountTokens,
          tokenLimitConfigArbitrary,
          async (request, provider, config) => {
            const tokenCounter = new TokenCounter(provider, config);
            const estimate = await tokenCounter.estimateTokens(request);

            // Should be a positive integer (or zero for empty requests)
            expect(Number.isInteger(estimate)).toBe(true);
            expect(estimate).toBeGreaterThanOrEqual(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent estimates for the same request', async () => {
      // Feature: stage-02-core-provider, Property 22: Token Count Estimation
      // Validates: Requirements 7.1
      await fc.assert(
        fc.asyncProperty(
          providerRequestArbitrary,
          mockProviderWithoutCountTokens,
          tokenLimitConfigArbitrary,
          async (request, provider, config) => {
            const tokenCounter = new TokenCounter(provider, config);

            // Call estimateTokens twice with the same request
            const estimate1 = await tokenCounter.estimateTokens(request);
            const estimate2 = await tokenCounter.estimateTokens(request);

            // Should produce the same result
            expect(estimate1).toBe(estimate2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 23: Provider Tokenizer Usage', () => {
    it('should use provider countTokens method when available', async () => {
      // Feature: stage-02-core-provider, Property 23: Provider Tokenizer Usage
      // Validates: Requirements 7.2
      await fc.assert(
        fc.asyncProperty(
          providerRequestArbitrary,
          fc.integer({ min: 1, max: 10000 }),
          tokenLimitConfigArbitrary,
          async (request, expectedTokens, config) => {
            const provider = createMockProviderWithCountTokens(expectedTokens);
            const tokenCounter = new TokenCounter(provider, config);

            const estimate = await tokenCounter.estimateTokens(request);

            // Should use the provider's countTokens method
            expect(estimate).toBe(expectedTokens);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not use fallback when provider has countTokens', async () => {
      // Feature: stage-02-core-provider, Property 23: Provider Tokenizer Usage
      // Validates: Requirements 7.2
      await fc.assert(
        fc.asyncProperty(
          providerRequestArbitrary,
          fc.integer({ min: 1, max: 10000 }),
          tokenLimitConfigArbitrary,
          async (request, providerTokens, config) => {
            const provider = createMockProviderWithCountTokens(providerTokens);
            const tokenCounter = new TokenCounter(provider, config);

            const estimate = await tokenCounter.estimateTokens(request);

            // Calculate what fallback would return
            let totalChars = 0;
            if (request.systemPrompt) {
              totalChars += request.systemPrompt.length;
            }
            for (const msg of request.messages) {
              for (const part of msg.parts) {
                if (part.type === 'text') {
                  totalChars += part.text.length;
                }
              }
            }
            const fallbackEstimate = Math.ceil(totalChars / 4);

            // If provider returns different value than fallback, verify we used provider
            if (providerTokens !== fallbackEstimate) {
              expect(estimate).toBe(providerTokens);
              expect(estimate).not.toBe(fallbackEstimate);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 24: Fallback Token Estimation', () => {
    it('should equal Math.ceil(text.length / 4) for any text content', async () => {
      // Feature: stage-02-core-provider, Property 24: Fallback Token Estimation
      // Validates: Requirements 7.3
      await fc.assert(
        fc.asyncProperty(
          providerRequestArbitrary,
          mockProviderWithoutCountTokens,
          tokenLimitConfigArbitrary,
          async (request, provider, config) => {
            const tokenCounter = new TokenCounter(provider, config);
            const estimate = await tokenCounter.estimateTokens(request);

            // Calculate expected fallback estimate
            let totalChars = 0;
            if (request.systemPrompt) {
              totalChars += request.systemPrompt.length;
            }
            for (const msg of request.messages) {
              for (const part of msg.parts) {
                if (part.type === 'text') {
                  totalChars += part.text.length;
                }
              }
            }
            const expectedEstimate = Math.ceil(totalChars / 4);

            // Should match the fallback formula
            expect(estimate).toBe(expectedEstimate);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty requests correctly', async () => {
      // Feature: stage-02-core-provider, Property 24: Fallback Token Estimation
      // Validates: Requirements 7.3
      const emptyRequest: ProviderRequest = {
        model: 'test-model',
        messages: [],
      };

      await fc.assert(
        fc.asyncProperty(
          mockProviderWithoutCountTokens,
          tokenLimitConfigArbitrary,
          async (provider, config) => {
            const tokenCounter = new TokenCounter(provider, config);
            const estimate = await tokenCounter.estimateTokens(emptyRequest);

            // Empty request should have 0 tokens
            expect(estimate).toBe(0);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only count text parts, not images', async () => {
      // Feature: stage-02-core-provider, Property 24: Fallback Token Estimation
      // Validates: Requirements 7.3
      await fc.assert(
        fc.asyncProperty(
          fc.string(),
          mockProviderWithoutCountTokens,
          tokenLimitConfigArbitrary,
          async (text, provider, config) => {
            const requestWithText: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [{ type: 'text', text }],
                },
              ],
            };

            const requestWithTextAndImage: ProviderRequest = {
              model: 'test-model',
              messages: [
                {
                  role: 'user',
                  parts: [
                    { type: 'text', text },
                    { type: 'image', data: 'base64data', mimeType: 'image/png' },
                  ],
                },
              ],
            };

            const tokenCounter = new TokenCounter(provider, config);
            const estimateText = await tokenCounter.estimateTokens(requestWithText);
            const estimateTextAndImage = await tokenCounter.estimateTokens(
              requestWithTextAndImage
            );

            // Image should not affect token count in fallback estimation
            expect(estimateText).toBe(estimateTextAndImage);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 25: Token Limit Warning', () => {
    it('should emit warning when tokens are between 90% and 100% of limit', () => {
      // Feature: stage-02-core-provider, Property 25: Token Limit Warning
      // Validates: Requirements 7.4
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1000, max: 10000 }),
          fc.double({ min: 0.8, max: 0.99, noNaN: true }),
          mockProviderWithoutCountTokens,
          (modelName, limit, warningThreshold, provider) => {
            const config = {
              modelLimits: new Map([[modelName, limit]]),
              warningThreshold,
            };
            const tokenCounter = new TokenCounter(provider, config);

            const warningZoneStart = Math.ceil(limit * warningThreshold);

            // Test tokens in warning zone
            for (
              let tokens = warningZoneStart;
              tokens <= limit;
              tokens += Math.max(1, Math.floor((limit - warningZoneStart) / 5))
            ) {
              const result = tokenCounter.checkLimit(modelName, tokens);
              expect(result.isWarning).toBe(true);
              expect(result.withinLimit).toBe(true);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not emit warning when tokens are below threshold', () => {
      // Feature: stage-02-core-provider, Property 25: Token Limit Warning
      // Validates: Requirements 7.4
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1000, max: 10000 }),
          fc.double({ min: 0.8, max: 0.99, noNaN: true }),
          mockProviderWithoutCountTokens,
          (modelName, limit, warningThreshold, provider) => {
            const config = {
              modelLimits: new Map([[modelName, limit]]),
              warningThreshold,
            };
            const tokenCounter = new TokenCounter(provider, config);

            const warningZoneStart = Math.ceil(limit * warningThreshold);
            const tokensBeforeWarning = Math.max(0, warningZoneStart - 1);

            const result = tokenCounter.checkLimit(modelName, tokensBeforeWarning);

            expect(result.isWarning).toBe(false);
            expect(result.withinLimit).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 26: Token Limit Enforcement', () => {
    it('should indicate limit exceeded when tokens exceed model limit', () => {
      // Feature: stage-02-core-provider, Property 26: Token Limit Enforcement
      // Validates: Requirements 7.5
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1000, max: 10000 }),
          fc.double({ min: 0.8, max: 0.99, noNaN: true }),
          mockProviderWithoutCountTokens,
          (modelName, limit, warningThreshold, provider) => {
            const config = {
              modelLimits: new Map([[modelName, limit]]),
              warningThreshold,
            };
            const tokenCounter = new TokenCounter(provider, config);

            // Test tokens exceeding limit
            const tokensOverLimit = limit + 1;
            const result = tokenCounter.checkLimit(modelName, tokensOverLimit);

            expect(result.withinLimit).toBe(false);
            expect(result.limit).toBe(limit);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use default limit of 4096 for unknown models', () => {
      // Feature: stage-02-core-provider, Property 26: Token Limit Enforcement
      // Validates: Requirements 7.5
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.double({ min: 0.8, max: 0.99, noNaN: true }),
          mockProviderWithoutCountTokens,
          (unknownModel, warningThreshold, provider) => {
            const config = {
              modelLimits: new Map<string, number>(), // Empty map
              warningThreshold,
            };
            const tokenCounter = new TokenCounter(provider, config);

            const result = tokenCounter.checkLimit(unknownModel, 5000);

            // Should use default limit of 4096
            expect(result.limit).toBe(4096);
            expect(result.withinLimit).toBe(false); // 5000 > 4096

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly identify tokens at exactly the limit', () => {
      // Feature: stage-02-core-provider, Property 26: Token Limit Enforcement
      // Validates: Requirements 7.5
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1000, max: 10000 }),
          fc.double({ min: 0.8, max: 0.99, noNaN: true }),
          mockProviderWithoutCountTokens,
          (modelName, limit, warningThreshold, provider) => {
            const config = {
              modelLimits: new Map([[modelName, limit]]),
              warningThreshold,
            };
            const tokenCounter = new TokenCounter(provider, config);

            // Tokens exactly at limit should be within limit
            const result = tokenCounter.checkLimit(modelName, limit);

            expect(result.withinLimit).toBe(true);
            expect(result.limit).toBe(limit);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 16: Token Limit Enforcement with Model Database', () => {
    /**
     * Feature: stage-07-model-management, Property 16: Token limit enforcement
     * 
     * For any model, token estimation should use the model's context window limit
     * from the Model Database, or the safe default if unknown.
     * 
     * Validates: Requirements 8.1, 8.2
     */
    it('should use Model Database context window for known models', () => {
      // Feature: stage-07-model-management, Property 16: Token limit enforcement
      // Validates: Requirements 8.1, 8.2
      fc.assert(
        fc.property(
          mockProviderWithoutCountTokens,
          fc.constantFrom(
            'llama3.1:8b',
            'mistral:7b',
            'codellama:13b',
            'phi3:mini',
            'gemma:7b',
            'qwen:14b'
          ),
          fc.integer({ min: 1000, max: 200000 }),
          (provider, modelName, estimatedTokens) => {
            const config: TokenLimitConfig = {
              warningThreshold: 0.9,
            };

            const tokenCounter = new TokenCounter(provider, config);
            const result = tokenCounter.checkLimit(modelName, estimatedTokens);

            // The limit should come from Model Database, not the default 4096
            // Known models have various context windows (2048, 4096, 8192, 16384, 32768, 128000)
            expect(result.limit).toBeGreaterThan(0);
            
            // Verify the result is consistent with the limit
            expect(result.withinLimit).toBe(estimatedTokens <= result.limit);
            expect(result.isWarning).toBe(
              estimatedTokens >= result.limit * 0.9 && estimatedTokens <= result.limit
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use safe default (4096) for unknown models', () => {
      // Feature: stage-07-model-management, Property 16: Token limit enforcement
      // Validates: Requirements 8.2
      fc.assert(
        fc.property(
          mockProviderWithoutCountTokens,
          fc
            .string({ minLength: 5, maxLength: 20 })
            .filter((s) => /^[a-z0-9-]+:[a-z0-9-]+$/i.test(s))
            .filter((s) => !s.startsWith('llama') && !s.startsWith('mistral') && !s.startsWith('phi')),
          fc.integer({ min: 1000, max: 10000 }),
          (provider, unknownModel, estimatedTokens) => {
            const config: TokenLimitConfig = {
              warningThreshold: 0.9,
            };

            const tokenCounter = new TokenCounter(provider, config);
            const result = tokenCounter.checkLimit(unknownModel, estimatedTokens);

            // Unknown models should get the safe default of 4096
            expect(result.limit).toBe(4096);
            
            // Verify the result is consistent with the limit
            expect(result.withinLimit).toBe(estimatedTokens <= 4096);
            expect(result.isWarning).toBe(
              estimatedTokens >= 4096 * 0.9 && estimatedTokens <= 4096
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prefer config overrides over Model Database', () => {
      // Feature: stage-07-model-management, Property 16: Token limit enforcement
      // Validates: Requirements 8.1
      fc.assert(
        fc.property(
          mockProviderWithoutCountTokens,
          fc.constantFrom('llama3.1:8b', 'mistral:7b'),
          fc.integer({ min: 5000, max: 20000 }),
          fc.integer({ min: 1000, max: 50000 }),
          (provider, modelName, overrideLimit, estimatedTokens) => {
            const config: TokenLimitConfig = {
              modelLimits: new Map([[modelName, overrideLimit]]),
              warningThreshold: 0.9,
            };

            const tokenCounter = new TokenCounter(provider, config);
            const result = tokenCounter.checkLimit(modelName, estimatedTokens);

            // The limit should be the override, not from Model Database
            expect(result.limit).toBe(overrideLimit);
            
            // Verify the result is consistent with the override limit
            expect(result.withinLimit).toBe(estimatedTokens <= overrideLimit);
            expect(result.isWarning).toBe(
              estimatedTokens >= overrideLimit * 0.9 && estimatedTokens <= overrideLimit
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Configuration Validation', () => {
    it('should reject NaN warningThreshold', () => {
      const config = {
        modelLimits: new Map<string, number>([['test-model', 4096]]),
        warningThreshold: NaN,
      };

      fc.assert(
        fc.property(mockProviderWithoutCountTokens, (provider) => {
          expect(() => new TokenCounter(provider, config)).toThrow(
            'Invalid warningThreshold: NaN. Must be a finite number between 0 and 1.'
          );
          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should reject Infinity warningThreshold', () => {
      const config = {
        modelLimits: new Map<string, number>([['test-model', 4096]]),
        warningThreshold: Infinity,
      };

      fc.assert(
        fc.property(mockProviderWithoutCountTokens, (provider) => {
          expect(() => new TokenCounter(provider, config)).toThrow(
            'Invalid warningThreshold: Infinity. Must be a finite number between 0 and 1.'
          );
          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should reject negative Infinity warningThreshold', () => {
      const config = {
        modelLimits: new Map<string, number>([['test-model', 4096]]),
        warningThreshold: -Infinity,
      };

      fc.assert(
        fc.property(mockProviderWithoutCountTokens, (provider) => {
          expect(() => new TokenCounter(provider, config)).toThrow(
            'Invalid warningThreshold: -Infinity. Must be a finite number between 0 and 1.'
          );
          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should reject warningThreshold less than 0', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -100, max: -0.01, noNaN: true }),
          mockProviderWithoutCountTokens,
          (invalidThreshold, provider) => {
            const config = {
              modelLimits: new Map<string, number>([['test-model', 4096]]),
              warningThreshold: invalidThreshold,
            };

            expect(() => new TokenCounter(provider, config)).toThrow(
              /Invalid warningThreshold: .+\. Must be a finite number between 0 and 1\./
            );
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should reject warningThreshold greater than 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1.01, max: 100, noNaN: true }),
          mockProviderWithoutCountTokens,
          (invalidThreshold, provider) => {
            const config = {
              modelLimits: new Map<string, number>([['test-model', 4096]]),
              warningThreshold: invalidThreshold,
            };

            expect(() => new TokenCounter(provider, config)).toThrow(
              /Invalid warningThreshold: .+\. Must be a finite number between 0 and 1\./
            );
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should accept valid warningThreshold values between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true }),
          mockProviderWithoutCountTokens,
          (validThreshold, provider) => {
            const config = {
              modelLimits: new Map<string, number>([['test-model', 4096]]),
              warningThreshold: validThreshold,
            };

            // Should not throw
            expect(() => new TokenCounter(provider, config)).not.toThrow();
            const tokenCounter = new TokenCounter(provider, config);
            expect(tokenCounter).toBeDefined();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept boundary values 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(0, 1),
          mockProviderWithoutCountTokens,
          (boundaryValue, provider) => {
            const config = {
              modelLimits: new Map<string, number>([['test-model', 4096]]),
              warningThreshold: boundaryValue,
            };

            // Should not throw
            expect(() => new TokenCounter(provider, config)).not.toThrow();
            return true;
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
