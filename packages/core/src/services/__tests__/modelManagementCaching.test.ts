/**
 * Tests for Model Management Service Caching
 * 
 * Tests the caching behavior of the ModelManagementService, including:
 * - Cache TTL (30 seconds)
 * - Force refresh functionality
 * - Cache invalidation on model operations
 * - Fallback to stale cache on errors
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModelManagementService } from '../modelManagementService.js';
import type { ProviderAdapter, ModelInfo } from '../../provider/types.js';

// Mock provider
function createMockProvider(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
  return {
    name: 'test-provider',
    chatStream: vi.fn(),
    countTokens: vi.fn(),
    listModels: vi.fn(),
    pullModel: vi.fn(),
    deleteModel: vi.fn(),
    showModel: vi.fn(),
    ...overrides,
  } as unknown as ProviderAdapter;
}

// Mock model data
const mockModels: ModelInfo[] = [
  { name: 'model1', size: 1000, modifiedAt: new Date() },
  { name: 'model2', size: 2000, modifiedAt: new Date() },
];

const updatedMockModels: ModelInfo[] = [
  { name: 'model1', size: 1000, modifiedAt: new Date() },
  { name: 'model2', size: 2000, modifiedAt: new Date() },
  { name: 'model3', size: 3000, modifiedAt: new Date() },
];

describe('ModelManagementService - Caching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cache TTL', () => {
    it('should cache model list for 30 seconds by default', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // First call - should hit provider
      const result1 = await service.listModels();
      expect(result1).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(1);

      // Second call within 30s - should use cache
      const result2 = await service.listModels();
      expect(result2).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(1); // Still 1

      // Advance time by 29 seconds - still cached
      vi.advanceTimersByTime(29 * 1000);
      const result3 = await service.listModels();
      expect(result3).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(1); // Still 1

      // Advance time by 2 more seconds (total 31s) - cache expired
      vi.advanceTimersByTime(2 * 1000);
      const result4 = await service.listModels();
      expect(result4).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(2); // Now 2
    });

    it('should respect custom cache TTL', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider, {
        cacheTTL: 10 * 1000, // 10 seconds
      });

      // First call
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(1);

      // After 9 seconds - still cached
      vi.advanceTimersByTime(9 * 1000);
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(1);

      // After 11 seconds total - cache expired
      vi.advanceTimersByTime(2 * 1000);
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(2);
    });

    it('should allow cache TTL of 0 to disable caching', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider, {
        cacheTTL: 0,
      });

      // Every call should hit provider
      await service.listModels();
      await service.listModels();
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(3);
    });
  });

  describe('Force Refresh', () => {
    it('should bypass cache when forceRefresh is true', async () => {
      const listModels = vi.fn()
        .mockResolvedValueOnce(mockModels)
        .mockResolvedValueOnce(updatedMockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // First call - should hit provider
      const result1 = await service.listModels();
      expect(result1).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(1);

      // Second call with forceRefresh - should bypass cache
      const result2 = await service.listModels(true);
      expect(result2).toEqual(updatedMockModels);
      expect(listModels).toHaveBeenCalledTimes(2);

      // Third call without forceRefresh - should use new cache
      const result3 = await service.listModels();
      expect(result3).toEqual(updatedMockModels);
      expect(listModels).toHaveBeenCalledTimes(2); // Still 2
    });

    it('should update cache after force refresh', async () => {
      const listModels = vi.fn()
        .mockResolvedValueOnce(mockModels)
        .mockResolvedValueOnce(updatedMockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Initial call
      await service.listModels();

      // Force refresh
      await service.listModels(true);

      // Subsequent calls should use updated cache
      const result = await service.listModels();
      expect(result).toEqual(updatedMockModels);
      expect(listModels).toHaveBeenCalledTimes(2);
    });

    it('should work with forceRefresh even when cache is expired', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Initial call
      await service.listModels();

      // Expire cache
      vi.advanceTimersByTime(31 * 1000);

      // Force refresh (cache already expired)
      await service.listModels(true);
      expect(listModels).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache after pulling a model', async () => {
      const listModels = vi.fn()
        .mockResolvedValueOnce(mockModels)
        .mockResolvedValueOnce(updatedMockModels);
      const pullModel = vi.fn().mockResolvedValue(undefined);
      const provider = createMockProvider({ listModels, pullModel });
      const service = new ModelManagementService(provider);

      // Initial list
      const result1 = await service.listModels();
      expect(result1).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(1);

      // Pull a model (no progress callback)
      await service.pullModel('model3');
      expect(pullModel).toHaveBeenCalledWith('model3', undefined);

      // List again - should fetch fresh data
      const result2 = await service.listModels();
      expect(result2).toEqual(updatedMockModels);
      expect(listModels).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after deleting a model', async () => {
      const listModels = vi.fn()
        .mockResolvedValueOnce(updatedMockModels)
        .mockResolvedValueOnce(mockModels);
      const deleteModel = vi.fn().mockResolvedValue(undefined);
      const provider = createMockProvider({ listModels, deleteModel });
      const service = new ModelManagementService(provider);

      // Initial list
      const result1 = await service.listModels();
      expect(result1).toEqual(updatedMockModels);
      expect(listModels).toHaveBeenCalledTimes(1);

      // Delete a model
      await service.deleteModel('model3');
      expect(deleteModel).toHaveBeenCalledWith('model3');

      // List again - should fetch fresh data
      const result2 = await service.listModels();
      expect(result2).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache when manually called', async () => {
      const listModels = vi.fn()
        .mockResolvedValueOnce(mockModels)
        .mockResolvedValueOnce(updatedMockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Initial list
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(1);

      // Manually invalidate cache
      service.invalidateCache();

      // List again - should fetch fresh data
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling with Cache', () => {
    it('should return stale cache on provider error', async () => {
      const listModels = vi.fn()
        .mockResolvedValueOnce(mockModels)
        .mockRejectedValueOnce(new Error('Provider unavailable'));
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Initial successful call
      const result1 = await service.listModels();
      expect(result1).toEqual(mockModels);

      // Expire cache
      vi.advanceTimersByTime(31 * 1000);

      // Provider fails, but cache is available
      const result2 = await service.listModels();
      expect(result2).toEqual(mockModels); // Returns stale cache
      expect(listModels).toHaveBeenCalledTimes(2);
    });

    it('should throw error if no cache available on provider error', async () => {
      const listModels = vi.fn().mockRejectedValue(new Error('Provider unavailable'));
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // No cache available, should throw
      await expect(service.listModels()).rejects.toThrow(
        'Failed to list models: Provider unavailable'
      );
    });

    it('should not cache failed requests', async () => {
      const listModels = vi.fn()
        .mockRejectedValueOnce(new Error('Provider unavailable'))
        .mockResolvedValueOnce(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // First call fails
      await expect(service.listModels()).rejects.toThrow();

      // Second call succeeds and caches
      const result = await service.listModels();
      expect(result).toEqual(mockModels);
      expect(listModels).toHaveBeenCalledTimes(2);

      // Third call uses cache
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(2); // Still 2
    });
  });

  describe('Cache Behavior Edge Cases', () => {
    it('should handle rapid successive calls correctly', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Make 5 rapid calls
      const promises = [
        service.listModels(),
        service.listModels(),
        service.listModels(),
        service.listModels(),
        service.listModels(),
      ];

      const results = await Promise.all(promises);

      // All should return same data
      results.forEach(result => {
        expect(result).toEqual(mockModels);
      });

      // Provider should be called multiple times (no request deduplication)
      // This is expected behavior - each call checks cache independently
      expect(listModels).toHaveBeenCalled();
    });

    it('should handle empty model list', async () => {
      const listModels = vi.fn().mockResolvedValue([]);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      const result1 = await service.listModels();
      expect(result1).toEqual([]);

      // Should still cache empty list
      const result2 = await service.listModels();
      expect(result2).toEqual([]);
      expect(listModels).toHaveBeenCalledTimes(1);
    });

    it('should handle cache invalidation during pull failure', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const pullModel = vi.fn().mockRejectedValue(new Error('Pull failed'));
      const provider = createMockProvider({ listModels, pullModel });
      const service = new ModelManagementService(provider);

      // Initial list
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(1);

      // Pull fails - cache should NOT be invalidated
      await expect(service.pullModel('model3')).rejects.toThrow();

      // List again - should use cache (not invalidated on failure)
      await service.listModels();
      expect(listModels).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('Performance', () => {
    it('should reduce provider calls with caching', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Make 100 calls within cache window
      for (let i = 0; i < 100; i++) {
        await service.listModels();
      }

      // Should only call provider once
      expect(listModels).toHaveBeenCalledTimes(1);
    });

    it('should handle cache expiration correctly over time', async () => {
      const listModels = vi.fn().mockResolvedValue(mockModels);
      const provider = createMockProvider({ listModels });
      const service = new ModelManagementService(provider);

      // Call every 20 seconds for 2 minutes
      for (let i = 0; i < 6; i++) {
        await service.listModels();
        vi.advanceTimersByTime(20 * 1000);
      }

      // Cache expires every 30s, so should call provider 3 times
      // (0s, 40s, 80s) - the 120s call hasn't happened yet
      expect(listModels).toHaveBeenCalledTimes(3);
    });
  });
});
