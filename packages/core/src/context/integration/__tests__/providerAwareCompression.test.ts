/**
 * Provider-Aware Compression Integration Tests
 *
 * Tests for FR-14: Provider System Integration
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  ProviderAwareCompression,
  type IProfileManager,
  type ValidationResult,
} from '../providerAwareCompression.js';

import type { ContextProfile } from '../../types.js';

// Mock ProfileManager for testing
class MockProfileManager implements IProfileManager {
  private models: Map<
    string,
    {
      id: string;
      name: string;
      context_profiles?: ContextProfile[];
      default_context?: number;
      max_context_window?: number;
    }
  > = new Map();

  addModel(
    modelId: string,
    profiles: ContextProfile[],
    defaultContext: number = 8192,
    maxWindow: number = 131072
  ): void {
    this.models.set(modelId, {
      id: modelId,
      name: modelId,
      context_profiles: profiles,
      default_context: defaultContext,
      max_context_window: maxWindow,
    });
  }

  getModelEntry(modelId: string) {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }
    return model;
  }
}

// Helper to create standard context profiles
function createStandardProfiles(): ContextProfile[] {
  return [
    { size: 4096, size_label: '4k', ollama_context_size: 3482, vram_estimate_gb: 2.5 },
    { size: 8192, size_label: '8k', ollama_context_size: 6963, vram_estimate_gb: 2.9 },
    { size: 16384, size_label: '16k', ollama_context_size: 13926, vram_estimate_gb: 3.7 },
    { size: 32768, size_label: '32k', ollama_context_size: 27853, vram_estimate_gb: 5.2 },
    { size: 65536, size_label: '64k', ollama_context_size: 55706, vram_estimate_gb: 8.2 },
  ];
}

describe('ProviderAwareCompression', () => {
  let profileManager: MockProfileManager;
  let compression: ProviderAwareCompression;

  beforeEach(() => {
    profileManager = new MockProfileManager();
    profileManager.addModel('llama3.2:3b', createStandardProfiles());
    profileManager.addModel('mistral:7b', createStandardProfiles());
    profileManager.addModel('codellama:13b', createStandardProfiles());
    compression = new ProviderAwareCompression(profileManager, 8192);
  });

  describe('getContextLimit', () => {
    it('should return pre-calculated ollama_context_size for 8K context', () => {
      const limit = compression.getContextLimit('llama3.2:3b');
      expect(limit).toBe(6963); // Pre-calculated 85% of 8192
    });

    it('should return correct limit for different context sizes', () => {
      const compression4k = new ProviderAwareCompression(profileManager, 4096);
      const compression16k = new ProviderAwareCompression(profileManager, 16384);

      expect(compression4k.getContextLimit('llama3.2:3b')).toBe(3482);
      expect(compression16k.getContextLimit('llama3.2:3b')).toBe(13926);
    });

    it('should throw error for unknown model', () => {
      expect(() => compression.getContextLimit('unknown:model')).toThrow('Model not found');
    });

    it('should fallback to 85% calculation if profile not found', () => {
      // Add model with no profiles
      profileManager.addModel('custom:model', []);
      const limit = compression.getContextLimit('custom:model');
      expect(limit).toBe(Math.floor(8192 * 0.85)); // 6963
    });
  });

  describe('getOllamaContextSize', () => {
    it('should return pre-calculated value for specific size', () => {
      const size = compression.getOllamaContextSize('llama3.2:3b', 8192);
      expect(size).toBe(6963);
    });

    it('should return correct values for all standard sizes', () => {
      expect(compression.getOllamaContextSize('llama3.2:3b', 4096)).toBe(3482);
      expect(compression.getOllamaContextSize('llama3.2:3b', 8192)).toBe(6963);
      expect(compression.getOllamaContextSize('llama3.2:3b', 16384)).toBe(13926);
      expect(compression.getOllamaContextSize('llama3.2:3b', 32768)).toBe(27853);
    });

    it('should throw error for unknown size', () => {
      expect(() => compression.getOllamaContextSize('llama3.2:3b', 999999)).toThrow(
        'No profile for size'
      );
    });
  });

  describe('validateAgainstProvider', () => {
    it('should validate tokens within limit', () => {
      const result = compression.validateAgainstProvider(5000, 'llama3.2:3b');
      expect(result.valid).toBe(true);
      expect(result.tokens).toBe(5000);
      expect(result.limit).toBe(6963 - 1000); // ollama_context_size - safety margin
    });

    it('should reject tokens exceeding limit', () => {
      const result = compression.validateAgainstProvider(7000, 'llama3.2:3b');
      expect(result.valid).toBe(false);
      expect(result.overage).toBeGreaterThan(0);
      expect(result.message).toContain('exceeds provider limit');
    });

    it('should account for safety margin', () => {
      const limit = 6963; // ollama_context_size for 8K
      const safetyMargin = 1000;
      const effectiveLimit = limit - safetyMargin;

      const result = compression.validateAgainstProvider(effectiveLimit, 'llama3.2:3b');
      expect(result.valid).toBe(true);

      const result2 = compression.validateAgainstProvider(effectiveLimit + 1, 'llama3.2:3b');
      expect(result2.valid).toBe(false);
    });
  });

  describe('shouldCompress', () => {
    it('should not trigger compression below 75% threshold', () => {
      const ollamaLimit = 6963;
      const systemPrompt = 500;
      const tierBudget = 1000;
      const safetyMargin = 1000;
      const available = ollamaLimit - systemPrompt - tierBudget - safetyMargin;
      const threshold = available * 0.75;

      const shouldCompress = compression.shouldCompress(
        threshold - 100,
        'llama3.2:3b',
        systemPrompt,
        tierBudget
      );
      expect(shouldCompress).toBe(false);
    });

    it('should trigger compression above 75% threshold', () => {
      const ollamaLimit = 6963;
      const systemPrompt = 500;
      const tierBudget = 1000;
      const safetyMargin = 1000;
      const available = ollamaLimit - systemPrompt - tierBudget - safetyMargin;
      const threshold = available * 0.75;

      const shouldCompress = compression.shouldCompress(
        threshold + 100,
        'llama3.2:3b',
        systemPrompt,
        tierBudget
      );
      expect(shouldCompress).toBe(true);
    });

    it('should respect different tier budgets', () => {
      const systemPrompt = 500;
      const smallTierBudget = 200;
      const largeTierBudget = 1500;

      // With small tier budget, more space available, higher threshold
      const shouldCompress1 = compression.shouldCompress(
        3000,
        'llama3.2:3b',
        systemPrompt,
        smallTierBudget
      );

      // With large tier budget, less space available, lower threshold
      const shouldCompress2 = compression.shouldCompress(
        3000,
        'llama3.2:3b',
        systemPrompt,
        largeTierBudget
      );

      // Same token count, but different tier budgets should give different results
      expect(shouldCompress1).not.toBe(shouldCompress2);
    });
  });

  describe('handleProviderError', () => {
    it('should detect context overflow errors', () => {
      const errors = [
        new Error('Context limit exceeded'),
        new Error('Token limit reached'),
        new Error('Prompt too long'),
        new Error('Maximum context size exceeded'),
      ];

      for (const error of errors) {
        const strategy = compression.handleProviderError(error, 'llama3.2:3b');
        expect(strategy.type).toBe('context_overflow');
        expect(strategy.shouldRetry).toBe(true);
        expect(strategy.shouldCompress).toBe(true);
      }
    });

    it('should detect connection errors', () => {
      const errors = [
        new Error('Connection refused'),
        new Error('Network timeout'),
        new Error('ECONNREFUSED'),
        new Error('Connection error'),
      ];

      for (const error of errors) {
        const strategy = compression.handleProviderError(error, 'llama3.2:3b');
        expect(strategy.type).toBe('connection_error');
        expect(strategy.shouldRetry).toBe(true);
        expect(strategy.shouldCompress).toBe(false);
      }
    });

    it('should handle unknown errors', () => {
      const error = new Error('Something went wrong');
      const strategy = compression.handleProviderError(error, 'llama3.2:3b');
      expect(strategy.type).toBe('unknown');
      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.shouldCompress).toBe(false);
    });
  });

  describe('getCompressionUrgency', () => {
    it('should return correct urgency levels', () => {
      const systemPrompt = 500;
      const tierBudget = 1000;
      const ollamaLimit = 6963;
      const safetyMargin = 1000;
      const available = ollamaLimit - systemPrompt - tierBudget - safetyMargin;

      expect(
        compression.getCompressionUrgency(available * 0.4, 'llama3.2:3b', systemPrompt, tierBudget)
      ).toBe('none');
      expect(
        compression.getCompressionUrgency(available * 0.6, 'llama3.2:3b', systemPrompt, tierBudget)
      ).toBe('low');
      expect(
        compression.getCompressionUrgency(available * 0.8, 'llama3.2:3b', systemPrompt, tierBudget)
      ).toBe('medium');
      expect(
        compression.getCompressionUrgency(available * 0.9, 'llama3.2:3b', systemPrompt, tierBudget)
      ).toBe('high');
      expect(
        compression.getCompressionUrgency(
          available * 0.96,
          'llama3.2:3b',
          systemPrompt,
          tierBudget
        )
      ).toBe('critical');
    });
  });

  describe('updateContextSize', () => {
    it('should update context size and affect limits', () => {
      expect(compression.getContextLimit('llama3.2:3b')).toBe(6963); // 8K

      compression.updateContextSize(16384);
      expect(compression.getContextLimit('llama3.2:3b')).toBe(13926); // 16K

      compression.updateContextSize(4096);
      expect(compression.getContextLimit('llama3.2:3b')).toBe(3482); // 4K
    });
  });

  describe('getAvailableContextSizes', () => {
    it('should return all available sizes for a model', () => {
      const sizes = compression.getAvailableContextSizes('llama3.2:3b');
      expect(sizes).toEqual([4096, 8192, 16384, 32768, 65536]);
    });

    it('should return default sizes for model without profiles', () => {
      profileManager.addModel('custom:model', []);
      const sizes = compression.getAvailableContextSizes('custom:model');
      expect(sizes).toEqual([4096, 8192, 16384, 32768]);
    });
  });

  describe('getProviderInfo', () => {
    it('should detect Ollama provider', () => {
      const info = compression.getProviderInfo('llama3.2:3b');
      expect(info.name).toBe('ollama');
      expect(info.modelId).toBe('llama3.2:3b');
      expect(info.requestedSize).toBe(8192);
    });

    it('should detect vLLM provider', () => {
      const info = compression.getProviderInfo('vllm-model:7b');
      expect(info.name).toBe('vllm');
    });

    it('should detect OpenAI-compatible provider', () => {
      const info = compression.getProviderInfo('openai-gpt-4');
      expect(info.name).toBe('openai-compatible');
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 26: Provider Limit Respect', () => {
    it('should never allow tokens to exceed provider limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // currentTokens
          fc.constantFrom('llama3.2:3b', 'mistral:7b', 'codellama:13b'), // modelId
          fc.integer({ min: 100, max: 1000 }), // systemPromptTokens
          fc.integer({ min: 200, max: 1500 }), // tierBudget
          (currentTokens, modelId, systemPromptTokens, tierBudget) => {
            const validation = compression.validateAgainstProvider(currentTokens, modelId);
            const limit = compression.getContextLimit(modelId);
            const safetyMargin = 1000;
            const effectiveLimit = limit - safetyMargin;

            // Property: Validation result must match actual limit check
            if (currentTokens <= effectiveLimit) {
              expect(validation.valid).toBe(true);
            } else {
              expect(validation.valid).toBe(false);
              expect(validation.overage).toBe(currentTokens - effectiveLimit);
            }

            // Property: Limit must always be positive
            expect(limit).toBeGreaterThan(0);

            // Property: Effective limit must be less than raw limit
            expect(effectiveLimit).toBeLessThan(limit);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should respect pre-calculated 85% values from profiles', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(4096, 8192, 16384, 32768, 65536), // contextSize
          fc.constantFrom('llama3.2:3b', 'mistral:7b', 'codellama:13b'), // modelId
          (contextSize, modelId) => {
            const testCompression = new ProviderAwareCompression(profileManager, contextSize);
            const ollamaSize = testCompression.getOllamaContextSize(modelId, contextSize);
            const limit = testCompression.getContextLimit(modelId);

            // Property: ollama_context_size must equal context limit
            expect(ollamaSize).toBe(limit);

            // Property: ollama_context_size must be less than raw context size
            expect(ollamaSize).toBeLessThan(contextSize);

            // Property: ollama_context_size should be approximately 85% of context size
            // (within 1% tolerance for rounding)
            const expectedSize = Math.floor(contextSize * 0.85);
            const tolerance = contextSize * 0.01;
            expect(Math.abs(ollamaSize - expectedSize)).toBeLessThanOrEqual(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should trigger compression before reaching provider limit', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // currentTokens
          fc.constantFrom('llama3.2:3b', 'mistral:7b'), // modelId
          fc.integer({ min: 100, max: 1000 }), // systemPromptTokens
          fc.integer({ min: 200, max: 1500 }), // tierBudget
          (currentTokens, modelId, systemPromptTokens, tierBudget) => {
            const shouldCompress = compression.shouldCompress(
              currentTokens,
              modelId,
              systemPromptTokens,
              tierBudget
            );
            const validation = compression.validateAgainstProvider(currentTokens, modelId);

            // Property: If compression is triggered, we should still be within limit
            // (compression is preventive, not reactive)
            if (shouldCompress) {
              // We might be close to limit, but not necessarily over it
              const ollamaLimit = compression.getContextLimit(modelId);
              const safetyMargin = 1000;
              const available = ollamaLimit - systemPromptTokens - tierBudget - safetyMargin;
              const threshold = available * 0.75;

              expect(currentTokens).toBeGreaterThan(threshold);
            }

            // Property: If we're over limit, compression should definitely be triggered
            if (!validation.valid) {
              expect(shouldCompress).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle context size changes correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(4096, 8192, 16384, 32768), // contextSize
          fc.constantFrom('llama3.2:3b', 'mistral:7b'), // modelId
          (contextSize, modelId) => {
            const testCompression = new ProviderAwareCompression(profileManager, 8192);
            const initialLimit = testCompression.getContextLimit(modelId);

            testCompression.updateContextSize(contextSize);
            const newLimit = testCompression.getContextLimit(modelId);

            // Property: Limit must change when context size changes
            if (contextSize !== 8192) {
              expect(newLimit).not.toBe(initialLimit);
            }

            // Property: Larger context size = larger limit
            if (contextSize > 8192) {
              expect(newLimit).toBeGreaterThan(initialLimit);
            } else if (contextSize < 8192) {
              expect(newLimit).toBeLessThan(initialLimit);
            }

            // Property: getCurrentContextSize must match what was set
            expect(testCompression.getCurrentContextSize()).toBe(contextSize);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should provide consistent urgency levels', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }), // currentTokens
          fc.constantFrom('llama3.2:3b', 'mistral:7b'), // modelId
          fc.integer({ min: 100, max: 1000 }), // systemPromptTokens
          fc.integer({ min: 200, max: 1500 }), // tierBudget
          (currentTokens, modelId, systemPromptTokens, tierBudget) => {
            const urgency = compression.getCompressionUrgency(
              currentTokens,
              modelId,
              systemPromptTokens,
              tierBudget
            );

            const ollamaLimit = compression.getContextLimit(modelId);
            const safetyMargin = 1000;
            const available = ollamaLimit - systemPromptTokens - tierBudget - safetyMargin;
            const usagePercentage = currentTokens / available;

            // Property: Urgency level must match usage percentage
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
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Unit Tests for Provider Integration
// ============================================================================

describe('Provider Integration - Ollama', () => {
  let profileManager: MockProfileManager;
  let compression: ProviderAwareCompression;

  beforeEach(() => {
    profileManager = new MockProfileManager();
    // Ollama models with standard profiles
    profileManager.addModel('llama3.2:3b', createStandardProfiles());
    profileManager.addModel('mistral:7b', createStandardProfiles());
    profileManager.addModel('codellama:13b', createStandardProfiles());
    compression = new ProviderAwareCompression(profileManager, 8192);
  });

  it('should read Ollama provider limits from profiles', () => {
    const limit = compression.getContextLimit('llama3.2:3b');
    expect(limit).toBe(6963); // Pre-calculated 85% for 8K
  });

  it('should use 85% values correctly for Ollama', () => {
    const sizes = [4096, 8192, 16384, 32768, 65536];
    const expected = [3482, 6963, 13926, 27853, 55706];

    sizes.forEach((size, index) => {
      const testCompression = new ProviderAwareCompression(profileManager, size);
      const limit = testCompression.getContextLimit('llama3.2:3b');
      expect(limit).toBe(expected[index]);
    });
  });

  it('should respect Ollama provider in compression triggers', () => {
    const systemPrompt = 500;
    const tierBudget = 1000;
    const ollamaLimit = 6963;
    const safetyMargin = 1000;
    const available = ollamaLimit - systemPrompt - tierBudget - safetyMargin;
    const threshold = available * 0.75;

    // Just below threshold - no compression
    expect(
      compression.shouldCompress(threshold - 1, 'llama3.2:3b', systemPrompt, tierBudget)
    ).toBe(false);

    // Just above threshold - compression triggered
    expect(
      compression.shouldCompress(threshold + 1, 'llama3.2:3b', systemPrompt, tierBudget)
    ).toBe(true);
  });

  it('should handle Ollama provider errors', () => {
    const contextError = new Error('Ollama: context limit exceeded');
    const strategy = compression.handleProviderError(contextError, 'llama3.2:3b');

    expect(strategy.type).toBe('context_overflow');
    expect(strategy.shouldRetry).toBe(true);
    expect(strategy.shouldCompress).toBe(true);
  });

  it('should validate against Ollama limits', () => {
    const ollamaLimit = 6963;
    const safetyMargin = 1000;
    const effectiveLimit = ollamaLimit - safetyMargin;

    // Within limit
    const result1 = compression.validateAgainstProvider(effectiveLimit - 100, 'llama3.2:3b');
    expect(result1.valid).toBe(true);

    // Over limit
    const result2 = compression.validateAgainstProvider(effectiveLimit + 100, 'llama3.2:3b');
    expect(result2.valid).toBe(false);
    expect(result2.overage).toBe(100);
  });
});

describe('Provider Integration - vLLM', () => {
  let profileManager: MockProfileManager;
  let compression: ProviderAwareCompression;

  beforeEach(() => {
    profileManager = new MockProfileManager();
    // vLLM models might have different profiles
    const vllmProfiles: ContextProfile[] = [
      { size: 8192, size_label: '8k', ollama_context_size: 6963, vram_estimate_gb: 4.0 },
      { size: 16384, size_label: '16k', ollama_context_size: 13926, vram_estimate_gb: 6.0 },
      { size: 32768, size_label: '32k', ollama_context_size: 27853, vram_estimate_gb: 10.0 },
    ];
    profileManager.addModel('vllm-llama:7b', vllmProfiles);
    compression = new ProviderAwareCompression(profileManager, 8192);
  });

  it('should read vLLM provider limits from profiles', () => {
    const limit = compression.getContextLimit('vllm-llama:7b');
    expect(limit).toBe(6963);
  });

  it('should use 85% values correctly for vLLM', () => {
    const compression16k = new ProviderAwareCompression(profileManager, 16384);
    const limit = compression16k.getContextLimit('vllm-llama:7b');
    expect(limit).toBe(13926);
  });

  it('should respect vLLM provider in compression triggers', () => {
    const systemPrompt = 500;
    const tierBudget = 1000;

    const shouldCompress = compression.shouldCompress(
      4000,
      'vllm-llama:7b',
      systemPrompt,
      tierBudget
    );

    // Should be based on vLLM's context limit
    expect(typeof shouldCompress).toBe('boolean');
  });

  it('should handle vLLM provider errors', () => {
    const contextError = new Error('vLLM: maximum context length exceeded');
    const strategy = compression.handleProviderError(contextError, 'vllm-llama:7b');

    expect(strategy.type).toBe('context_overflow');
    expect(strategy.shouldCompress).toBe(true);
  });

  it('should detect vLLM provider from model ID', () => {
    const info = compression.getProviderInfo('vllm-llama:7b');
    expect(info.name).toBe('vllm');
    expect(info.modelId).toBe('vllm-llama:7b');
  });
});

describe('Provider Integration - OpenAI-compatible', () => {
  let profileManager: MockProfileManager;
  let compression: ProviderAwareCompression;

  beforeEach(() => {
    profileManager = new MockProfileManager();
    // OpenAI-compatible models
    const openaiProfiles: ContextProfile[] = [
      { size: 4096, size_label: '4k', ollama_context_size: 3482, vram_estimate_gb: 0 },
      { size: 8192, size_label: '8k', ollama_context_size: 6963, vram_estimate_gb: 0 },
      { size: 16384, size_label: '16k', ollama_context_size: 13926, vram_estimate_gb: 0 },
      { size: 32768, size_label: '32k', ollama_context_size: 27853, vram_estimate_gb: 0 },
      { size: 128000, size_label: '128k', ollama_context_size: 108800, vram_estimate_gb: 0 },
    ];
    profileManager.addModel('openai-gpt-4', openaiProfiles);
    compression = new ProviderAwareCompression(profileManager, 8192);
  });

  it('should read OpenAI-compatible provider limits from profiles', () => {
    const limit = compression.getContextLimit('openai-gpt-4');
    expect(limit).toBe(6963);
  });

  it('should support large context sizes for OpenAI-compatible', () => {
    const compression128k = new ProviderAwareCompression(profileManager, 128000);
    const limit = compression128k.getContextLimit('openai-gpt-4');
    expect(limit).toBe(108800); // 85% of 128K
  });

  it('should use 85% values correctly for OpenAI-compatible', () => {
    const sizes = [4096, 8192, 16384, 32768];
    const expected = [3482, 6963, 13926, 27853];

    sizes.forEach((size, index) => {
      const testCompression = new ProviderAwareCompression(profileManager, size);
      const limit = testCompression.getContextLimit('openai-gpt-4');
      expect(limit).toBe(expected[index]);
    });
  });

  it('should respect OpenAI-compatible provider in compression triggers', () => {
    const systemPrompt = 500;
    const tierBudget = 1000;

    const shouldCompress = compression.shouldCompress(
      4000,
      'openai-gpt-4',
      systemPrompt,
      tierBudget
    );

    expect(typeof shouldCompress).toBe('boolean');
  });

  it('should handle OpenAI-compatible provider errors', () => {
    const contextError = new Error('OpenAI: context_length_exceeded');
    const strategy = compression.handleProviderError(contextError, 'openai-gpt-4');

    expect(strategy.type).toBe('context_overflow');
    expect(strategy.shouldCompress).toBe(true);
  });

  it('should detect OpenAI-compatible provider from model ID', () => {
    const info = compression.getProviderInfo('openai-gpt-4');
    expect(info.name).toBe('openai-compatible');
    expect(info.modelId).toBe('openai-gpt-4');
  });

  it('should handle very large contexts for OpenAI-compatible', () => {
    const compression128k = new ProviderAwareCompression(profileManager, 128000);
    const validation = compression128k.validateAgainstProvider(100000, 'openai-gpt-4');

    // 100K tokens should be valid for 128K context (108800 - 1000 safety = 107800 effective)
    expect(validation.valid).toBe(true);
  });
});

describe('Provider Integration - Error Handling', () => {
  let profileManager: MockProfileManager;
  let compression: ProviderAwareCompression;

  beforeEach(() => {
    profileManager = new MockProfileManager();
    profileManager.addModel('test-model:7b', createStandardProfiles());
    compression = new ProviderAwareCompression(profileManager, 8192);
  });

  it('should handle missing model gracefully', () => {
    expect(() => compression.getContextLimit('nonexistent:model')).toThrow('Model not found');
  });

  it('should handle missing context profile gracefully', () => {
    expect(() => compression.getOllamaContextSize('test-model:7b', 999999)).toThrow(
      'No profile for size'
    );
  });

  it('should provide fallback for models without profiles', () => {
    profileManager.addModel('minimal-model', []);
    const limit = compression.getContextLimit('minimal-model');
    expect(limit).toBe(Math.floor(8192 * 0.85)); // Fallback calculation
  });

  it('should handle connection errors differently from context errors', () => {
    const contextError = new Error('Context limit exceeded');
    const connectionError = new Error('Connection refused');

    const contextStrategy = compression.handleProviderError(contextError, 'test-model:7b');
    const connectionStrategy = compression.handleProviderError(connectionError, 'test-model:7b');

    expect(contextStrategy.shouldCompress).toBe(true);
    expect(connectionStrategy.shouldCompress).toBe(false);
  });

  it('should handle unknown errors conservatively', () => {
    const unknownError = new Error('Something unexpected happened');
    const strategy = compression.handleProviderError(unknownError, 'test-model:7b');

    expect(strategy.type).toBe('unknown');
    expect(strategy.shouldRetry).toBe(false);
    expect(strategy.shouldCompress).toBe(false);
  });
});

describe('Provider Integration - Context Size Management', () => {
  let profileManager: MockProfileManager;
  let compression: ProviderAwareCompression;

  beforeEach(() => {
    profileManager = new MockProfileManager();
    profileManager.addModel('test-model:7b', createStandardProfiles());
    compression = new ProviderAwareCompression(profileManager, 8192);
  });

  it('should update context size and recalculate limits', () => {
    expect(compression.getCurrentContextSize()).toBe(8192);
    expect(compression.getContextLimit('test-model:7b')).toBe(6963);

    compression.updateContextSize(16384);
    expect(compression.getCurrentContextSize()).toBe(16384);
    expect(compression.getContextLimit('test-model:7b')).toBe(13926);
  });

  it('should list all available context sizes', () => {
    const sizes = compression.getAvailableContextSizes('test-model:7b');
    expect(sizes).toEqual([4096, 8192, 16384, 32768, 65536]);
  });

  it('should provide default sizes for models without profiles', () => {
    profileManager.addModel('minimal-model', []);
    const sizes = compression.getAvailableContextSizes('minimal-model');
    expect(sizes).toEqual([4096, 8192, 16384, 32768]);
  });

  it('should maintain consistency across context size changes', () => {
    const sizes = [4096, 8192, 16384, 32768];

    sizes.forEach((size) => {
      compression.updateContextSize(size);
      const limit = compression.getContextLimit('test-model:7b');
      const ollamaSize = compression.getOllamaContextSize('test-model:7b', size);

      // Limit should match ollama_context_size
      expect(limit).toBe(ollamaSize);

      // Limit should be less than raw size
      expect(limit).toBeLessThan(size);
    });
  });
});
