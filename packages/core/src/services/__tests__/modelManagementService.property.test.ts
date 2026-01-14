/**
 * Property-based tests for Model Management Service
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import { ModelManagementService } from '../modelManagementService.js';
import { MockProvider } from '@ollm/test-utils';
import type { ModelInfo, ProviderAdapter, PullProgress } from '../../provider/types.js';

describe('Model Management Service Properties', () => {
  let service: ModelManagementService;
  let mockProvider: MockProvider;

  beforeEach(() => {
    mockProvider = new MockProvider();
    service = new ModelManagementService(mockProvider, {
      cacheTTL: 1000, // 1 second for testing
      keepAliveEnabled: true,
      keepAliveTimeout: 5, // 5 seconds for testing
    });
  });

  afterEach(() => {
    service.dispose();
  });

  /**
   * Property 1: Model list retrieval
   * For any state of the Provider_Adapter, calling listModels should return
   * a list of ModelInfo objects with required fields (name, size, modifiedAt)
   * Validates: Requirements 1.1, 1.2
   */
  it('Property 1: Model list retrieval', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            sizeBytes: fc.integer({ min: 1000000, max: 10000000000 }),
            modifiedAt: fc.date().map((d) => d.toISOString()),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        async (models) => {
          // Create provider with mock models
          const provider = new MockProvider({ models });
          const svc = new ModelManagementService(provider);

          try {
            const result = await svc.listModels();

            // Should return an array
            expect(Array.isArray(result)).toBe(true);

            // Should have the same length as mock models
            expect(result.length).toBe(models.length);

            // Each model should have required fields
            for (const model of result) {
              expect(model.name).toBeDefined();
              expect(typeof model.name).toBe('string');
              expect(model.name.length).toBeGreaterThan(0);

              if (model.sizeBytes !== undefined) {
                expect(typeof model.sizeBytes).toBe('number');
                expect(model.sizeBytes).toBeGreaterThan(0);
              }

              if (model.modifiedAt !== undefined) {
                expect(typeof model.modifiedAt).toBe('string');
              }
            }
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Model list caching
   * For any sequence of listModels calls without cache invalidation, the second
   * call should return cached results without calling the Provider_Adapter
   * Validates: Requirements 1.3
   */
  it('Property 2: Model list caching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            sizeBytes: fc.integer({ min: 1000000, max: 10000000000 }),
            modifiedAt: fc.date().map((d) => d.toISOString()),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (models) => {
          // Create provider with mock models and spy on listModels
          const provider = new MockProvider({ models });
          const listModelsSpy = vi.spyOn(provider, 'listModels');
          const svc = new ModelManagementService(provider, { cacheTTL: 10000 });

          try {
            // First call should hit the provider
            const result1 = await svc.listModels();
            expect(listModelsSpy).toHaveBeenCalledTimes(1);

            // Second call should use cache
            const result2 = await svc.listModels();
            expect(listModelsSpy).toHaveBeenCalledTimes(1); // Still 1

            // Results should be identical
            expect(result2).toEqual(result1);
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Cache invalidation after mutations
   * For any model mutation operation (pull, delete), the operation should
   * invalidate the model list cache
   * Validates: Requirements 2.3, 3.2
   */
  it('Property 3: Cache invalidation after mutations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialModels: fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 50 }),
              sizeBytes: fc.integer({ min: 1000000, max: 10000000000 }),
              modifiedAt: fc.date().map((d) => d.toISOString()),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          modelName: fc.string({ minLength: 1, maxLength: 50 }),
          operation: fc.constantFrom('pull', 'delete'),
        }),
        async ({ initialModels, modelName, operation }) => {
          const provider = new MockProvider({ models: initialModels });
          const listModelsSpy = vi.spyOn(provider, 'listModels');
          const svc = new ModelManagementService(provider, { cacheTTL: 10000 });

          try {
            // First call to populate cache
            await svc.listModels();
            expect(listModelsSpy).toHaveBeenCalledTimes(1);

            // Perform mutation
            if (operation === 'pull') {
              await svc.pullModel(modelName);
            } else {
              await svc.deleteModel(modelName);
            }

            // Next call should hit provider again (cache invalidated)
            await svc.listModels();
            expect(listModelsSpy).toHaveBeenCalledTimes(2);
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Offline operation with cache
   * For any cached model list, when the Provider_Adapter is unavailable,
   * listModels should return the cached data
   * Validates: Requirements 1.5
   */
  it('Property 4: Offline operation with cache', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            sizeBytes: fc.integer({ min: 1000000, max: 10000000000 }),
            modifiedAt: fc.date().map((d) => d.toISOString()),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (models) => {
          const provider = new MockProvider({ models });
          const svc = new ModelManagementService(provider, { cacheTTL: 10000 });

          try {
            // First call to populate cache
            const cachedResult = await svc.listModels();

            // Make provider fail
            vi.spyOn(provider, 'listModels').mockRejectedValue(
              new Error('Provider unavailable')
            );

            // Should still return cached data
            const result = await svc.listModels();
            expect(result).toEqual(cachedResult);
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Progress event emission
   * For any model pull operation, progress events should be emitted with
   * required fields (percentage, transferRate, bytesDownloaded, totalBytes)
   * Validates: Requirements 2.2
   */
  it('Property 5: Progress event emission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (modelName) => {
          const provider = new MockProvider();
          const svc = new ModelManagementService(provider);

          try {
            const progressEvents: any[] = [];

            await svc.pullModel(modelName, (progress) => {
              progressEvents.push(progress);
            });

            // Should have received progress events
            expect(progressEvents.length).toBeGreaterThan(0);

            // Each event should have required fields
            for (const event of progressEvents) {
              expect(typeof event.percentage).toBe('number');
              expect(event.percentage).toBeGreaterThanOrEqual(0);
              expect(event.percentage).toBeLessThanOrEqual(100);

              expect(typeof event.transferRate).toBe('number');
              expect(event.transferRate).toBeGreaterThanOrEqual(0);

              expect(typeof event.bytesDownloaded).toBe('number');
              expect(event.bytesDownloaded).toBeGreaterThanOrEqual(0);

              expect(typeof event.totalBytes).toBe('number');
              expect(event.totalBytes).toBeGreaterThanOrEqual(0);
            }
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Pull cancellation
   * For any in-progress model pull, cancelling the operation should abort the download
   * Validates: Requirements 2.5
   * 
   * Note: This test is currently skipped because the ProviderAdapter interface
   * doesn't support abort signals for pullModel. This would require updating
   * the interface to accept an AbortSignal parameter.
   */
  it.skip('Property 6: Pull cancellation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (modelName) => {
          const provider = new MockProvider({ eventDelay: 100 });
          const svc = new ModelManagementService(provider);

          try {
            // Start pull
            const pullPromise = svc.pullModel(modelName);

            // Cancel immediately
            svc.cancelPull(modelName);

            // Should complete (either successfully or with cancellation)
            await expect(pullPromise).resolves.toBeUndefined();
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 50 } // Fewer runs due to delays
    );
  });

  /**
   * Property 7: Loaded model unload before deletion
   * For any model that is currently loaded, deleting it should unload it first
   * Validates: Requirements 3.4
   */
  it('Property 7: Loaded model unload before deletion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (modelName) => {
          const provider = new MockProvider();
          const svc = new ModelManagementService(provider);

          try {
            // Load the model
            await svc.keepModelLoaded(modelName);
            expect(svc.getLoadedModels()).toContain(modelName);

            // Delete the model
            await svc.deleteModel(modelName);

            // Model should no longer be loaded
            expect(svc.getLoadedModels()).not.toContain(modelName);
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Error handling consistency
   * For any operation that fails (list, pull, delete, show), the service should
   * return a descriptive error message
   * Validates: Requirements 1.4, 2.4, 3.3, 4.3
   */
  it('Property 8: Error handling consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          modelName: fc.string({ minLength: 1, maxLength: 50 }),
          operation: fc.constantFrom('list', 'pull', 'delete', 'show'),
          errorMessage: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ modelName, operation, errorMessage }) => {
          // Create provider that throws errors
          const provider = new MockProvider();
          const error = new Error(errorMessage);

          // Mock all operations to fail
          vi.spyOn(provider, 'listModels').mockRejectedValue(error);
          vi.spyOn(provider, 'pullModel').mockRejectedValue(error);
          vi.spyOn(provider, 'deleteModel').mockRejectedValue(error);
          vi.spyOn(provider, 'showModel').mockRejectedValue(error);

          const svc = new ModelManagementService(provider);

          try {
            let thrownError: Error | null = null;

            try {
              switch (operation) {
                case 'list':
                  await svc.listModels();
                  break;
                case 'pull':
                  await svc.pullModel(modelName);
                  break;
                case 'delete':
                  await svc.deleteModel(modelName);
                  break;
                case 'show':
                  await svc.showModel(modelName);
                  break;
              }
            } catch (e) {
              thrownError = e as Error;
            }

            // Should have thrown an error
            expect(thrownError).not.toBeNull();

            if (thrownError) {
              // Error message should be descriptive
              expect(thrownError.message).toBeDefined();
              expect(thrownError.message.length).toBeGreaterThan(0);

              // Should contain context about the operation
              expect(
                thrownError.message.toLowerCase().includes('failed') ||
                  thrownError.message.toLowerCase().includes('error')
              ).toBe(true);
            }
          } finally {
            svc.dispose();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
