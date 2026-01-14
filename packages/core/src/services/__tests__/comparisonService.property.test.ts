/**
 * Property-based tests for Comparison Service
 * Feature: stage-07-model-management
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ComparisonService } from '../comparisonService.js';
import type { ProviderAdapter, ProviderRequest, ProviderEvent } from '../../provider/types.js';

/**
 * Create a mock provider that returns a specific response for a given model.
 */
function createMockProvider(
  modelResponses: Map<string, { text: string; shouldError?: boolean; errorMessage?: string }>
): ProviderAdapter {
  return {
    name: 'mock-comparison-provider',
    async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
      const modelConfig = modelResponses.get(request.model);
      
      if (!modelConfig) {
        yield {
          type: 'error',
          error: { message: `Unknown model: ${request.model}` },
        };
        return;
      }

      if (modelConfig.shouldError) {
        yield {
          type: 'error',
          error: { message: modelConfig.errorMessage ?? 'Model error' },
        };
        return;
      }

      // Emit text response
      yield { type: 'text', value: modelConfig.text };
      yield { type: 'finish', reason: 'stop' };
    },
  };
}

describe('Comparison Service Properties', () => {
  /**
   * Property 29: Parallel model execution
   * For any comparison request with multiple models, all models should be invoked
   * with the same prompt
   * Validates: Requirements 14.1
   */
  it('Property 29: Parallel model execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          prompt: fc.string({ minLength: 1, maxLength: 200 }),
          models: fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 2, maxLength: 5 }
          ),
        }),
        async ({ prompt, models }) => {
          // Create responses for each model
          const modelResponses = new Map(
            models.map((model) => [
              model,
              { text: `Response from ${model}` },
            ])
          );

          const provider = createMockProvider(modelResponses);
          const service = new ComparisonService(provider);

          // Execute comparison
          const result = await service.compare(prompt, models);

          // All models should have results
          expect(result.results.length).toBe(models.length);

          // Each model should appear exactly once
          const resultModels = result.results.map((r) => r.model);
          expect(new Set(resultModels).size).toBe(models.length);

          // All models should be in the results
          for (const model of models) {
            expect(resultModels).toContain(model);
          }

          // Prompt should match
          expect(result.prompt).toBe(prompt);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 30: Comparison result structure
   * For any comparison result, each ModelResult should contain response text,
   * token count, latency, and tokens per second
   * Validates: Requirements 14.2, 15.2, 15.3
   */
  it('Property 30: Comparison result structure', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          prompt: fc.string({ minLength: 1, maxLength: 200 }),
          models: fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 5 }
          ),
          responses: fc.array(
            fc.string({ minLength: 10, maxLength: 500 }),
            { minLength: 1, maxLength: 5 }
          ),
        }),
        async ({ prompt, models, responses }) => {
          // Create responses for each model
          const modelResponses = new Map(
            models.map((model, idx) => [
              model,
              { text: responses[idx % responses.length] },
            ])
          );

          const provider = createMockProvider(modelResponses);
          const service = new ComparisonService(provider);

          // Execute comparison
          const result = await service.compare(prompt, models);

          // Check structure of each result
          for (const modelResult of result.results) {
            // Should have model name
            expect(modelResult.model).toBeDefined();
            expect(typeof modelResult.model).toBe('string');

            // Should have response (string, possibly empty on error)
            expect(modelResult.response).toBeDefined();
            expect(typeof modelResult.response).toBe('string');

            // Should have token count (number >= 0)
            expect(modelResult.tokenCount).toBeDefined();
            expect(typeof modelResult.tokenCount).toBe('number');
            expect(modelResult.tokenCount).toBeGreaterThanOrEqual(0);

            // Should have latency (number >= 0)
            expect(modelResult.latencyMs).toBeDefined();
            expect(typeof modelResult.latencyMs).toBe('number');
            expect(modelResult.latencyMs).toBeGreaterThanOrEqual(0);

            // Should have tokens per second (number >= 0)
            expect(modelResult.tokensPerSecond).toBeDefined();
            expect(typeof modelResult.tokensPerSecond).toBe('number');
            expect(modelResult.tokensPerSecond).toBeGreaterThanOrEqual(0);

            // If no error, response should not be empty
            if (!modelResult.error) {
              expect(modelResult.response.length).toBeGreaterThan(0);
              expect(modelResult.tokenCount).toBeGreaterThan(0);
            }
          }

          // Result should have timestamp
          expect(result.timestamp).toBeInstanceOf(Date);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 31: Partial failure handling
   * For any comparison where some models fail, the result should include errors
   * for failed models without failing the entire comparison
   * Validates: Requirements 14.4
   */
  it('Property 31: Partial failure handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          prompt: fc.string({ minLength: 1, maxLength: 200 }),
          successModels: fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 3 }
          ),
          failModels: fc.uniqueArray(
            fc.string({ minLength: 1, maxLength: 20 }),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        async ({ prompt, successModels, failModels }) => {
          // Ensure no overlap between success and fail models
          const uniqueFailModels = failModels.filter(
            (m) => !successModels.includes(m)
          );

          // Skip if we don't have both success and fail models
          if (successModels.length === 0 || uniqueFailModels.length === 0) {
            return true;
          }

          const allModels = [...successModels, ...uniqueFailModels];

          // Create responses: success models get text, fail models get errors
          const modelResponses = new Map([
            ...successModels.map((model) => [
              model,
              { text: `Success response from ${model}` },
            ] as const),
            ...uniqueFailModels.map((model) => [
              model,
              {
                text: '',
                shouldError: true,
                errorMessage: `Error from ${model}`,
              },
            ] as const),
          ]);

          const provider = createMockProvider(modelResponses);
          const service = new ComparisonService(provider);

          // Execute comparison - should not throw
          const result = await service.compare(prompt, allModels);

          // Should have results for all models
          expect(result.results.length).toBe(allModels.length);

          // Success models should have responses without errors
          for (const model of successModels) {
            const modelResult = result.results.find((r) => r.model === model);
            expect(modelResult).toBeDefined();
            if (modelResult) {
              expect(modelResult.error).toBeUndefined();
              expect(modelResult.response.length).toBeGreaterThan(0);
              expect(modelResult.tokenCount).toBeGreaterThan(0);
            }
          }

          // Fail models should have errors
          for (const model of uniqueFailModels) {
            const modelResult = result.results.find((r) => r.model === model);
            expect(modelResult).toBeDefined();
            if (modelResult) {
              expect(modelResult.error).toBeDefined();
              expect(typeof modelResult.error).toBe('string');
              expect(modelResult.error!.length).toBeGreaterThan(0);
              expect(modelResult.response).toBe('');
              expect(modelResult.tokenCount).toBe(0);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
