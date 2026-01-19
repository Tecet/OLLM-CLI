/**
 * Dynamic Sizing Integration Tests
 * 
 * Validates that num_ctx parameter reaches the provider and is respected.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextPoolImpl } from '../contextPool.js';
import type { VRAMInfo, ModelInfo, ContextPool } from '../types.js';

describe('Dynamic Sizing Integration', () => {
  let contextPool: ContextPool;
  let resizeCallbackMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resizeCallbackMock = vi.fn();
    contextPool = new ContextPoolImpl(
      {
        minContextSize: 2048,
        maxContextSize: 131072,
        targetContextSize: 8192,
        autoSize: true,
      },
      resizeCallbackMock
    );
  });

  describe('num_ctx propagation', () => {
    it('should call resize callback with calculated size', async () => {
      const vramInfo: VRAMInfo = {
        total: 8 * 1024 * 1024 * 1024, // 8GB
        used: 2 * 1024 * 1024 * 1024,  // 2GB
        available: 6 * 1024 * 1024 * 1024, // 6GB
        percentage: 25,
      };

      const modelInfo: ModelInfo = {
        parameters: 7, // 7B model
        contextLimit: 32768,
      };

      // Calculate optimal size
      const optimalSize = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Resize to optimal size
      await contextPool.resize(optimalSize);

      // Verify resize callback was called with the new size
      expect(resizeCallbackMock).toHaveBeenCalledWith(optimalSize);
      expect(resizeCallbackMock).toHaveBeenCalledTimes(1);
    });

    it('should not call resize callback if size unchanged', async () => {
      const currentSize = contextPool.currentSize;

      // Try to resize to same size
      await contextPool.resize(currentSize);

      // Verify resize callback was NOT called
      expect(resizeCallbackMock).not.toHaveBeenCalled();
    });

    it('should clamp size to min/max bounds', async () => {
      // Try to resize below minimum
      await contextPool.resize(1024);

      // Should be clamped to minimum (2048)
      expect(resizeCallbackMock).toHaveBeenCalledWith(2048);

      resizeCallbackMock.mockClear();

      // Try to resize above maximum
      await contextPool.resize(200000);

      // Should be clamped to maximum (131072)
      expect(resizeCallbackMock).toHaveBeenCalledWith(131072);
    });

    it('should respect model context limit', async () => {
      const vramInfo: VRAMInfo = {
        total: 24 * 1024 * 1024 * 1024, // 24GB
        used: 4 * 1024 * 1024 * 1024,   // 4GB
        available: 20 * 1024 * 1024 * 1024, // 20GB
        percentage: 16.7,
      };

      const modelInfo: ModelInfo = {
        parameters: 7,
        contextLimit: 8192, // Model only supports 8K context
      };

      const optimalSize = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Should not exceed model's context limit
      expect(optimalSize).toBeLessThanOrEqual(8192);
    });
  });

  describe('VRAM-based sizing', () => {
    it('should calculate larger context for more available VRAM', async () => {
      const modelInfo: ModelInfo = {
        parameters: 7,
        contextLimit: 32768,
      };

      // Low VRAM scenario
      const lowVRAM: VRAMInfo = {
        total: 4 * 1024 * 1024 * 1024,
        used: 2 * 1024 * 1024 * 1024,
        available: 2 * 1024 * 1024 * 1024,
        percentage: 50,
      };

      const lowSize = contextPool.calculateOptimalSize(lowVRAM, modelInfo);

      // High VRAM scenario
      const highVRAM: VRAMInfo = {
        total: 24 * 1024 * 1024 * 1024,
        used: 4 * 1024 * 1024 * 1024,
        available: 20 * 1024 * 1024 * 1024,
        percentage: 16.7,
      };

      const highSize = contextPool.calculateOptimalSize(highVRAM, modelInfo);

      // High VRAM should allow larger context
      expect(highSize).toBeGreaterThan(lowSize);
    });

    it('should return minimum size when VRAM is insufficient', async () => {
      const modelInfo: ModelInfo = {
        parameters: 7,
        contextLimit: 32768,
      };

      // Very low VRAM
      const vramInfo: VRAMInfo = {
        total: 2 * 1024 * 1024 * 1024,
        used: 1.9 * 1024 * 1024 * 1024,
        available: 100 * 1024 * 1024, // Only 100MB available
        percentage: 95,
      };

      const size = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Should return minimum size
      expect(size).toBe(2048);
    });
  });

  describe('Quantization impact', () => {
    it('should calculate different sizes for different quantization types', async () => {
      const vramInfo: VRAMInfo = {
        total: 8 * 1024 * 1024 * 1024,
        used: 2 * 1024 * 1024 * 1024,
        available: 6 * 1024 * 1024 * 1024,
        percentage: 25,
      };

      const modelInfo: ModelInfo = {
        parameters: 7,
        contextLimit: 32768,
      };

      // Test with f16 (2 bytes per value)
      contextPool.updateConfig({ kvCacheQuantization: 'f16' });
      const f16Size = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Test with q8_0 (1 byte per value)
      contextPool.updateConfig({ kvCacheQuantization: 'q8_0' });
      const q8Size = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Test with q4_0 (0.5 bytes per value)
      contextPool.updateConfig({ kvCacheQuantization: 'q4_0' });
      const q4Size = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Lower quantization should allow larger context
      expect(q4Size).toBeGreaterThan(q8Size);
      expect(q8Size).toBeGreaterThan(f16Size);
    });
  });

  describe('Auto-sizing toggle', () => {
    it('should use target size when auto-sizing is disabled', async () => {
      contextPool.updateConfig({
        autoSize: false,
        targetContextSize: 16384,
      });

      const vramInfo: VRAMInfo = {
        total: 24 * 1024 * 1024 * 1024,
        used: 4 * 1024 * 1024 * 1024,
        available: 20 * 1024 * 1024 * 1024,
        percentage: 16.7,
      };

      const modelInfo: ModelInfo = {
        parameters: 7,
        contextLimit: 32768,
      };

      const size = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Should return target size, not calculated size
      expect(size).toBe(16384);
    });

    it('should calculate size when auto-sizing is enabled', async () => {
      contextPool.updateConfig({
        autoSize: true,
        targetContextSize: 8192,
      });

      const vramInfo: VRAMInfo = {
        total: 24 * 1024 * 1024 * 1024,
        used: 4 * 1024 * 1024 * 1024,
        available: 20 * 1024 * 1024 * 1024,
        percentage: 16.7,
      };

      const modelInfo: ModelInfo = {
        parameters: 7,
        contextLimit: 32768,
      };

      const size = contextPool.calculateOptimalSize(vramInfo, modelInfo);

      // Should calculate based on VRAM, not use target
      expect(size).not.toBe(8192);
      expect(size).toBeGreaterThan(8192);
    });
  });

  describe('Usage tracking', () => {
    it('should track current token usage', () => {
      contextPool.setCurrentTokens(4096);

      const usage = contextPool.getUsage();

      expect(usage.currentTokens).toBe(4096);
      expect(usage.maxTokens).toBe(contextPool.currentSize);
      expect(usage.percentage).toBeGreaterThan(0);
      expect(usage.percentage).toBeLessThanOrEqual(100);
    });

    it('should calculate usage percentage correctly', () => {
      contextPool.currentSize = 8192;
      contextPool.setCurrentTokens(4096);

      const usage = contextPool.getUsage();

      expect(usage.percentage).toBe(50);
    });

    it('should clamp percentage to 0-100 range', () => {
      contextPool.currentSize = 8192;
      
      // Test over 100%
      contextPool.setCurrentTokens(10000);
      let usage = contextPool.getUsage();
      expect(usage.percentage).toBe(100);

      // Test negative (should be clamped to 0)
      contextPool.setCurrentTokens(-100);
      usage = contextPool.getUsage();
      expect(usage.currentTokens).toBe(0);
      expect(usage.percentage).toBe(0);
    });
  });

  describe('Resize with active requests', () => {
    it('should wait for active requests before resizing', async () => {
      // Mark requests as active
      contextPool.beginRequest();
      contextPool.beginRequest();

      expect(contextPool.hasActiveRequests()).toBe(true);

      // Start resize (should wait)
      const resizePromise = contextPool.resize(16384);

      // Resize should not complete immediately
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(resizeCallbackMock).not.toHaveBeenCalled();

      // End one request
      contextPool.endRequest();
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(resizeCallbackMock).not.toHaveBeenCalled();

      // End last request
      contextPool.endRequest();

      // Wait for resize to complete
      await resizePromise;

      // Now resize should have completed
      expect(resizeCallbackMock).toHaveBeenCalledWith(16384);
      expect(contextPool.hasActiveRequests()).toBe(false);
    });

    it('should proceed after timeout even with active requests', async () => {
      // Mark request as active
      contextPool.beginRequest();

      // Start resize with very short timeout (we'll mock the wait)
      const resizePromise = contextPool.resize(16384);

      // Wait for timeout (30s in real code, but test will complete faster)
      // In real scenario, this would timeout and proceed
      await resizePromise;

      // Should have called resize callback despite active request
      expect(resizeCallbackMock).toHaveBeenCalledWith(16384);
    }, 35000); // 35s timeout for test
  });
});
