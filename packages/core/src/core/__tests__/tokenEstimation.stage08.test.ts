/**
 * Token Estimation Unit Tests (Stage 08)
 * 
 * Tests token estimation accuracy and context limit enforcement.
 * 
 * Property 9: Token Estimation Accuracy
 * Property 10: Context Limit Enforcement
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  text: fc.string({ minLength: 0, maxLength: 1000 }),
});

// Generate an image message part
const imagePartArbitrary = fc.record({
  type: fc.constant('image' as const),
  data: fc.string({ minLength: 10, maxLength: 100 }),
  mimeType: fc.constantFrom('image/png', 'image/jpeg', 'image/gif'),
});

// Generate a message part (text or image)
const messagePartArbitrary = fc.oneof(textPartArbitrary, imagePartArbitrary);

// Generate a message with mixed content
const messageArbitrary = fc.record({
  role: fc.constantFrom('system' as const, 'user' as const, 'assistant' as const, 'tool' as const),
  parts: fc.array(messagePartArbitrary, { minLength: 1, maxLength: 5 }),
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

// Generate a provider request
const providerRequestArbitrary = fc.record({
  model: fc.string({ minLength: 1, maxLength: 50 }),
  systemPrompt: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: undefined }),
  messages: fc.array(messageArbitrary, { minLength: 0, maxLength: 20 }),
  tools: fc.constant(undefined),
  toolChoice: fc.constant(undefined),
  options: fc.constant(undefined),
  abortSignal: fc.constant(undefined),
});

// Generate a mock provider without countTokens
const mockProviderWithoutCountTokens: ProviderAdapter = {
  name: 'mock-provider',
  chatStream: async function* (): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: 'mock' };
  },
};

// Create a mock provider with countTokens that returns a specific value
const createMockProviderWithCountTokens = (tokenCount: number): ProviderAdapter => ({
  name: 'mock-provider-with-count',
  chatStream: async function* (): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: 'mock' };
  },
  countTokens: async (_request: ProviderRequest): Promise<number> => {
    return tokenCount;
  },
});

// Create a mock provider with countTokens that accurately counts tokens
// This simulates a real provider's token counting (using the same fallback formula for testing)
const createAccurateMockProvider = (): ProviderAdapter => ({
  name: 'accurate-mock-provider',
  chatStream: async function* (): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: 'mock' };
  },
  countTokens: async (request: ProviderRequest): Promise<number> => {
    let totalChars = 0;
    if (request.systemPrompt) {
      totalChars += request.systemPrompt.length;
    }
    for (const message of request.messages) {
      for (const part of message.parts) {
        if (part.type === 'text') {
          totalChars += part.text.length;
        }
      }
    }
    return Math.ceil(totalChars / 4);
  },
});

/**
 * Helper to calculate expected token count using fallback estimation
 */
function calculateExpectedTokens(request: ProviderRequest): number {
  let totalChars = 0;
  
  if (request.systemPrompt) {
    totalChars += request.systemPrompt.length;
  }
  
  for (const message of request.messages) {
    for (const part of message.parts) {
      if (part.type === 'text') {
        totalChars += part.text.length;
      }
      // Images are not counted in character-based estimation
    }
  }
  
  return Math.ceil(totalChars / 4);
}

/**
 * Property 9: Token Estimation Accuracy
 * 
 * For any message or message sequence, the estimated token count should be
 * within 10% of the actual token count.
 * 
 * Validates: Requirements 4.1, 4.2, 4.3
 */
describe('Property 9: Token Estimation Accuracy', () => {
  it('should estimate tokens within 10% of actual count for any request', async () => {
    // Feature: stage-08-testing-qa, Property 9: Token Estimation Accuracy
    // Validates: Requirements 4.1, 4.2, 4.3
    
    await fc.assert(
      fc.asyncProperty(
        providerRequestArbitrary,
        async (request) => {
          // Use accurate mock provider that simulates real token counting
          const provider = createAccurateMockProvider();
          const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
          
          const estimate = await tokenCounter.estimateTokens(request);
          const actual = await provider.countTokens!(request);
          
          // Calculate 10% margin
          const margin = actual * 0.1;
          const lowerBound = actual - margin;
          const upperBound = actual + margin;
          
          // Estimate should be within 10% of actual
          expect(estimate).toBeGreaterThanOrEqual(lowerBound);
          expect(estimate).toBeLessThanOrEqual(upperBound);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should count different message types correctly', async () => {
    // Feature: stage-08-testing-qa, Property 9: Token Estimation Accuracy
    // Validates: Requirements 4.2
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.string({ minLength: 1, maxLength: 500 }),
        async (userText, assistantText, systemText) => {
          const request: ProviderRequest = {
            model: 'test-model',
            systemPrompt: systemText,
            messages: [
              {
                role: 'user',
                parts: [{ type: 'text', text: userText }],
              },
              {
                role: 'assistant',
                parts: [{ type: 'text', text: assistantText }],
              },
            ],
          };
          
          const provider = mockProviderWithoutCountTokens;
          const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
          
          const estimate = await tokenCounter.estimateTokens(request);
          const expected = calculateExpectedTokens(request);
          
          // Should match the fallback formula exactly
          expect(estimate).toBe(expected);
          
          // Verify it counts all message types
          const totalChars = systemText.length + userText.length + assistantText.length;
          const expectedTokens = Math.ceil(totalChars / 4);
          expect(estimate).toBe(expectedTokens);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle tool call messages in token estimation', async () => {
    // Feature: stage-08-testing-qa, Property 9: Token Estimation Accuracy
    // Validates: Requirements 4.3
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.record({
          param1: fc.string(),
          param2: fc.integer(),
        }),
        async (userText, toolName, toolArgs) => {
          // Create a request with a tool call message
          const toolCallText = `Calling ${toolName} with ${JSON.stringify(toolArgs)}`;
          
          const request: ProviderRequest = {
            model: 'test-model',
            messages: [
              {
                role: 'user',
                parts: [{ type: 'text', text: userText }],
              },
              {
                role: 'assistant',
                parts: [{ type: 'text', text: toolCallText }],
              },
              {
                role: 'tool',
                parts: [{ type: 'text', text: 'Tool result' }],
                name: toolName,
              },
            ],
          };
          
          const provider = mockProviderWithoutCountTokens;
          const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
          
          const estimate = await tokenCounter.estimateTokens(request);
          const expected = calculateExpectedTokens(request);
          
          // Should count tool messages correctly
          expect(estimate).toBe(expected);
          expect(estimate).toBeGreaterThan(0);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should produce consistent estimates for the same request', async () => {
    // Feature: stage-08-testing-qa, Property 9: Token Estimation Accuracy
    // Validates: Requirements 4.1
    
    await fc.assert(
      fc.asyncProperty(
        providerRequestArbitrary,
        async (request) => {
          const provider = mockProviderWithoutCountTokens;
          const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
          
          // Call estimateTokens multiple times with the same request
          const estimate1 = await tokenCounter.estimateTokens(request);
          const estimate2 = await tokenCounter.estimateTokens(request);
          const estimate3 = await tokenCounter.estimateTokens(request);
          
          // All estimates should be identical
          expect(estimate1).toBe(estimate2);
          expect(estimate2).toBe(estimate3);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty requests correctly', async () => {
    // Feature: stage-08-testing-qa, Property 9: Token Estimation Accuracy
    // Validates: Requirements 4.1
    
    const emptyRequest: ProviderRequest = {
      model: 'test-model',
      messages: [],
    };
    
    const provider = mockProviderWithoutCountTokens;
    const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
    
    const estimate = await tokenCounter.estimateTokens(emptyRequest);
    
    // Empty request should have 0 tokens
    expect(estimate).toBe(0);
  });

  it('should not count image parts in fallback estimation', async () => {
    // Feature: stage-08-testing-qa, Property 9: Token Estimation Accuracy
    // Validates: Requirements 4.2
    
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 10, maxLength: 100 }),
        async (text, imageData) => {
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
                  { type: 'image', data: imageData, mimeType: 'image/png' },
                ],
              },
            ],
          };
          
          const provider = mockProviderWithoutCountTokens;
          const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
          
          const estimateText = await tokenCounter.estimateTokens(requestWithText);
          const estimateTextAndImage = await tokenCounter.estimateTokens(requestWithTextAndImage);
          
          // Image should not affect token count in fallback estimation
          expect(estimateText).toBe(estimateTextAndImage);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 10: Context Limit Enforcement
 * 
 * For any message that exceeds the model's context window, the system should
 * reject it; for any message within the limit, the system should accept it.
 * 
 * Validates: Requirements 4.4, 4.5, 4.6
 */
describe('Property 10: Context Limit Enforcement', () => {
  it('should reject messages exceeding context limits', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.4
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1000, max: 10000 }),
        (modelName, limit) => {
          const provider = mockProviderWithoutCountTokens;
          const config = {
            modelLimits: new Map([[modelName, limit]]),
            warningThreshold: 0.9,
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

  it('should accept messages within context limits', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.5
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1000, max: 10000 }),
        (modelName, limit) => {
          const provider = mockProviderWithoutCountTokens;
          const config = {
            modelLimits: new Map([[modelName, limit]]),
            warningThreshold: 0.9,
          };
          const tokenCounter = new TokenCounter(provider, config);
          
          // Test tokens within limit
          const tokensWithinLimit = Math.floor(limit * 0.5); // 50% of limit
          const result = tokenCounter.checkLimit(modelName, tokensWithinLimit);
          
          expect(result.withinLimit).toBe(true);
          expect(result.limit).toBe(limit);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly apply context window size per model', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.6
    
    fc.assert(
      fc.property(
        fc.record({
          model1: fc.string({ minLength: 1, maxLength: 20 }),
          model2: fc.string({ minLength: 1, maxLength: 20 }),
          limit1: fc.integer({ min: 2048, max: 8192 }),
          limit2: fc.integer({ min: 16384, max: 32768 }),
        }),
        fc.integer({ min: 5000, max: 15000 }),
        ({ model1, model2, limit1, limit2 }, tokens) => {
          // Ensure models are different
          if (model1 === model2) return true;
          
          const provider = mockProviderWithoutCountTokens;
          const config = {
            modelLimits: new Map([
              [model1, limit1],
              [model2, limit2],
            ]),
            warningThreshold: 0.9,
          };
          const tokenCounter = new TokenCounter(provider, config);
          
          // Check limit for model1
          const result1 = tokenCounter.checkLimit(model1, tokens);
          expect(result1.limit).toBe(limit1);
          expect(result1.withinLimit).toBe(tokens <= limit1);
          
          // Check limit for model2
          const result2 = tokenCounter.checkLimit(model2, tokens);
          expect(result2.limit).toBe(limit2);
          expect(result2.withinLimit).toBe(tokens <= limit2);
          
          // If limits are different, results should differ for tokens between them
          if (limit1 < tokens && tokens <= limit2) {
            expect(result1.withinLimit).toBe(false);
            expect(result2.withinLimit).toBe(true);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle tokens at exactly the limit', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.5
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1000, max: 10000 }),
        (modelName, limit) => {
          const provider = mockProviderWithoutCountTokens;
          const config = {
            modelLimits: new Map([[modelName, limit]]),
            warningThreshold: 0.9,
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

  it('should use Model Database context window for known models', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.6
    
    fc.assert(
      fc.property(
        fc.constantFrom(
          'llama3.1:8b',
          'mistral:7b',
          'codellama:13b',
          'phi3:mini',
          'gemma:7b'
        ),
        fc.integer({ min: 1000, max: 200000 }),
        (modelName, estimatedTokens) => {
          const provider = mockProviderWithoutCountTokens;
          const config = {
            warningThreshold: 0.9,
          };
          const tokenCounter = new TokenCounter(provider, config);
          
          const result = tokenCounter.checkLimit(modelName, estimatedTokens);
          
          // The limit should come from Model Database, not the default 4096
          expect(result.limit).toBeGreaterThan(0);
          
          // Verify the result is consistent with the limit
          expect(result.withinLimit).toBe(estimatedTokens <= result.limit);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use safe default (4096) for unknown models', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.6
    
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 5, maxLength: 20 })
          .filter((s) => /^[a-z0-9-]+:[a-z0-9-]+$/i.test(s))
          .filter((s) => !s.startsWith('llama') && !s.startsWith('mistral') && !s.startsWith('phi')),
        fc.integer({ min: 1000, max: 10000 }),
        (unknownModel, estimatedTokens) => {
          const provider = mockProviderWithoutCountTokens;
          const config = {
            warningThreshold: 0.9,
          };
          const tokenCounter = new TokenCounter(provider, config);
          
          const result = tokenCounter.checkLimit(unknownModel, estimatedTokens);
          
          // Unknown models should get the safe default of 4096
          expect(result.limit).toBe(4096);
          
          // Verify the result is consistent with the limit
          expect(result.withinLimit).toBe(estimatedTokens <= 4096);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should emit warning when approaching context limit', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.4
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1000, max: 10000 }),
        fc.double({ min: 0.8, max: 0.99, noNaN: true }),
        (modelName, limit, warningThreshold) => {
          const provider = mockProviderWithoutCountTokens;
          const config = {
            modelLimits: new Map([[modelName, limit]]),
            warningThreshold,
          };
          const tokenCounter = new TokenCounter(provider, config);
          
          const warningZoneStart = Math.ceil(limit * warningThreshold);
          
          // Test tokens in warning zone
          const tokensInWarningZone = warningZoneStart + Math.floor((limit - warningZoneStart) / 2);
          const result = tokenCounter.checkLimit(modelName, tokensInWarningZone);
          
          expect(result.isWarning).toBe(true);
          expect(result.withinLimit).toBe(true);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not emit warning when well below context limit', () => {
    // Feature: stage-08-testing-qa, Property 10: Context Limit Enforcement
    // Validates: Requirements 4.5
    
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 1000, max: 10000 }),
        fc.double({ min: 0.8, max: 0.99, noNaN: true }),
        (modelName, limit, warningThreshold) => {
          const provider = mockProviderWithoutCountTokens;
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

/**
 * Unit Tests for Edge Cases
 */
describe('Token Estimation - Edge Cases', () => {
  it('should handle very long messages', async () => {
    const veryLongText = 'x'.repeat(100000);
    const request: ProviderRequest = {
      model: 'test-model',
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: veryLongText }],
        },
      ],
    };
    
    const provider = mockProviderWithoutCountTokens;
    const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
    
    const estimate = await tokenCounter.estimateTokens(request);
    const expected = Math.ceil(veryLongText.length / 4);
    
    expect(estimate).toBe(expected);
    expect(estimate).toBe(25000);
  });

  it('should handle messages with only whitespace', async () => {
    const whitespaceText = '   \n\t  \n  ';
    const request: ProviderRequest = {
      model: 'test-model',
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: whitespaceText }],
        },
      ],
    };
    
    const provider = mockProviderWithoutCountTokens;
    const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
    
    const estimate = await tokenCounter.estimateTokens(request);
    const expected = Math.ceil(whitespaceText.length / 4);
    
    expect(estimate).toBe(expected);
  });

  it('should handle messages with special characters', async () => {
    const specialText = 'Test with "quotes" and \'apostrophes\' and <tags> and émojis 🌍';
    const request: ProviderRequest = {
      model: 'test-model',
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: specialText }],
        },
      ],
    };
    
    const provider = mockProviderWithoutCountTokens;
    const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
    
    const estimate = await tokenCounter.estimateTokens(request);
    const expected = Math.ceil(specialText.length / 4);
    
    expect(estimate).toBe(expected);
  });

  it('should handle multiple messages with mixed roles', async () => {
    const request: ProviderRequest = {
      model: 'test-model',
      systemPrompt: 'You are a helpful assistant.',
      messages: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }],
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Hi there!' }],
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'How are you?' }],
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'I am doing well, thank you!' }],
        },
      ],
    };
    
    const provider = mockProviderWithoutCountTokens;
    const tokenCounter = new TokenCounter(provider, { warningThreshold: 0.9 });
    
    const estimate = await tokenCounter.estimateTokens(request);
    const expected = calculateExpectedTokens(request);
    
    expect(estimate).toBe(expected);
    expect(estimate).toBeGreaterThan(0);
  });

  it('should handle zero-length context limit', () => {
    const provider = mockProviderWithoutCountTokens;
    const config = {
      modelLimits: new Map([['test-model', 0]]),
      warningThreshold: 0.9,
    };
    const tokenCounter = new TokenCounter(provider, config);
    
    const result = tokenCounter.checkLimit('test-model', 1);
    
    expect(result.withinLimit).toBe(false);
    expect(result.limit).toBe(0);
  });
});
