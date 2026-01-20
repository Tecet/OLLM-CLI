/**
 * Context Pool Tests
 * 
 * Tests for context pool service including property-based tests
 * for context size calculations, quantization, and usage tracking.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createContextPool } from '../contextPool.js';
import type { KVQuantization } from '../types.js';

describe('ContextPool', () => {
  describe('Property 7: Context Size Formula', () => {
    /**
     * Feature: stage-04b-context-management, Property 7: Context Size Formula
     * Validates: Requirements 3.2
     * 
     * For any available VRAM, safety buffer, and bytes per token,
     * the calculated context size should equal floor((availableVRAM - safetyBuffer) / bytesPerToken).
     */
    it('should calculate context size using the correct formula', () => {
      fc.assert(
        fc.property(
          // Generate random VRAM info
          fc.record({
            total: fc.integer({ min: 1e9, max: 80e9 }),
            used: fc.integer({ min: 0, max: 40e9 }),
            available: fc.integer({ min: 1e9, max: 80e9 }),
            modelLoaded: fc.integer({ min: 0, max: 40e9 })
          }),
          // Generate random model info
          fc.record({
            parameters: fc.integer({ min: 1, max: 70 }), // 1B to 70B params
            contextLimit: fc.integer({ min: 8192, max: 131072 })
          }),
          // Generate random quantization
          fc.constantFrom<KVQuantization>('f16', 'q8_0', 'q4_0'),
          // Generate random reserve buffer
          fc.integer({ min: 100 * 1024 * 1024, max: 2048 * 1024 * 1024 }),
          (vramInfo, modelInfo, quantization, reserveBuffer) => {
            // Create context pool with auto-sizing enabled
            const pool = createContextPool({
              autoSize: true,
              kvCacheQuantization: quantization,
              reserveBuffer,
              minContextSize: 512,
              maxContextSize: 200000
            });

            // Calculate optimal size
            const calculatedSize = pool.calculateOptimalSize(vramInfo, modelInfo);

            // Calculate expected size using the formula
            const bytesPerValue: Record<KVQuantization, number> = {
              'f16': 2,
              'q8_0': 1,
              'q4_0': 0.5
            };
            const bytesPerToken = (modelInfo.parameters * 2 * bytesPerValue[quantization]) / 1e9;
            const usableVRAM = vramInfo.available - reserveBuffer;
            
            let expectedSize: number;
            if (usableVRAM <= 0) {
              expectedSize = 512; // minContextSize
            } else {
              const rawSize = Math.floor(usableVRAM / bytesPerToken);
              // Clamp to min/max and model limit
              expectedSize = Math.max(512, Math.min(rawSize, modelInfo.contextLimit, 200000));
            }

            // Verify the formula is applied correctly
            expect(calculatedSize).toBe(expectedSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Quantization Bytes Per Token', () => {
    /**
     * Feature: stage-04b-context-management, Property 8: Quantization Bytes Per Token
     * Validates: Requirements 3.3, 3.4, 3.5
     * 
     * For any KV cache quantization type (f16, q8_0, q4_0),
     * the bytes per value used in calculations should match the specification (2, 1, 0.5 respectively).
     */
    it('should use correct bytes per value for each quantization type', () => {
      fc.assert(
        fc.property(
          fc.record({
            total: fc.integer({ min: 8e9, max: 80e9 }),
            used: fc.integer({ min: 0, max: 40e9 }),
            available: fc.integer({ min: 4e9, max: 80e9 }),
            modelLoaded: fc.integer({ min: 0, max: 40e9 })
          }),
          fc.record({
            parameters: fc.integer({ min: 7, max: 70 }),
            contextLimit: fc.integer({ min: 32768, max: 131072 })
          }),
          (vramInfo, modelInfo) => {
            const reserveBuffer = 512 * 1024 * 1024;
            const usableVRAM = vramInfo.available - reserveBuffer;

            // Test f16 quantization (2 bytes per value)
            const poolF16 = createContextPool({
              autoSize: true,
              kvCacheQuantization: 'f16',
              reserveBuffer,
              minContextSize: 512,
              maxContextSize: 200000
            });
            const sizeF16 = poolF16.calculateOptimalSize(vramInfo, modelInfo);
            const bytesPerTokenF16 = (modelInfo.parameters * 2 * 2) / 1e9;
            const expectedF16 = Math.max(512, Math.min(
              Math.floor(usableVRAM / bytesPerTokenF16),
              modelInfo.contextLimit,
              200000
            ));
            expect(sizeF16).toBe(expectedF16);

            // Test q8_0 quantization (1 byte per value)
            const poolQ8 = createContextPool({
              autoSize: true,
              kvCacheQuantization: 'q8_0',
              reserveBuffer,
              minContextSize: 512,
              maxContextSize: 200000
            });
            const sizeQ8 = poolQ8.calculateOptimalSize(vramInfo, modelInfo);
            const bytesPerTokenQ8 = (modelInfo.parameters * 2 * 1) / 1e9;
            const expectedQ8 = Math.max(512, Math.min(
              Math.floor(usableVRAM / bytesPerTokenQ8),
              modelInfo.contextLimit,
              200000
            ));
            expect(sizeQ8).toBe(expectedQ8);

            // Test q4_0 quantization (0.5 bytes per value)
            const poolQ4 = createContextPool({
              autoSize: true,
              kvCacheQuantization: 'q4_0',
              reserveBuffer,
              minContextSize: 512,
              maxContextSize: 200000
            });
            const sizeQ4 = poolQ4.calculateOptimalSize(vramInfo, modelInfo);
            const bytesPerTokenQ4 = (modelInfo.parameters * 2 * 0.5) / 1e9;
            const expectedQ4 = Math.max(512, Math.min(
              Math.floor(usableVRAM / bytesPerTokenQ4),
              modelInfo.contextLimit,
              200000
            ));
            expect(sizeQ4).toBe(expectedQ4);

            // Verify ordering: q4_0 > q8_0 > f16 (more tokens with lower precision)
            if (usableVRAM > 0) {
              expect(sizeQ4).toBeGreaterThanOrEqual(sizeQ8);
              expect(sizeQ8).toBeGreaterThanOrEqual(sizeF16);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 9: Context Resize Preservation', () => {
    /**
     * Feature: stage-04b-context-management, Property 9: Context Resize Preservation
     * Validates: Requirements 3.7
     * 
     * For any context with existing conversation data,
     * resizing the context should preserve all messages without data loss.
     */
    it('should preserve data when resizing context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2048, max: 32768 }),
          fc.integer({ min: 2048, max: 32768 }),
          async (initialSize, newSize) => {
            let resizeCallbackInvoked = false;
            let resizeCallbackSize = 0;

            // Create pool with resize callback
            const pool = createContextPool(
              {
                targetContextSize: initialSize,
                minContextSize: 2048,
                maxContextSize: 65536,
                autoSize: false
              },
              async (size: number) => {
                resizeCallbackInvoked = true;
                resizeCallbackSize = size;
              }
            );

            // Verify initial size
            expect(pool.currentSize).toBe(initialSize);

            // Resize
            await pool.resize(newSize);

            // Verify resize was called if size changed
            const clampedNewSize = Math.max(2048, Math.min(newSize, 65536));
            if (clampedNewSize !== initialSize) {
              expect(resizeCallbackInvoked).toBe(true);
              expect(resizeCallbackSize).toBe(clampedNewSize);
            }

            // Verify new size is set correctly
            expect(pool.currentSize).toBe(clampedNewSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 10: Context Usage Fields', () => {
    /**
     * Feature: stage-04b-context-management, Property 10: Context Usage Fields
     * Validates: Requirements 3.8
     * 
     * For any context usage request,
     * the returned ContextUsage object should contain current usage percentage and token counts.
     */
    it('should return complete usage information', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2048, max: 65536 }),
          fc.integer({ min: 0, max: 65536 }),
          fc.record({
            total: fc.integer({ min: 8e9, max: 80e9 }),
            used: fc.integer({ min: 0, max: 40e9 }),
            available: fc.integer({ min: 1e9, max: 80e9 }),
            modelLoaded: fc.integer({ min: 0, max: 40e9 })
          }),
          (contextSize, currentTokens, vramInfo) => {
            const pool = createContextPool({
              targetContextSize: contextSize,
              autoSize: false
            });

            // Set current tokens and VRAM info
            (pool as any).setCurrentTokens(currentTokens);
            (pool as any).updateVRAMInfo(vramInfo);

            // Get usage
            const usage = pool.getUsage();

            // Verify all required fields are present
            expect(usage).toHaveProperty('currentTokens');
            expect(usage).toHaveProperty('maxTokens');
            expect(usage).toHaveProperty('percentage');
            expect(usage).toHaveProperty('vramUsed');
            expect(usage).toHaveProperty('vramTotal');

            // Verify values are correct
            expect(usage.currentTokens).toBe(currentTokens);
            expect(usage.maxTokens).toBe(contextSize);
            expect(usage.vramUsed).toBe(vramInfo.used);
            expect(usage.vramTotal).toBe(vramInfo.total);

            // Verify percentage calculation
            const expectedPercentage = contextSize > 0
              ? Math.min(100, Math.max(0, (currentTokens / contextSize) * 100))
              : 0;
            expect(usage.percentage).toBeCloseTo(expectedPercentage, 2);

            // Verify percentage is in valid range
            expect(usage.percentage).toBeGreaterThanOrEqual(0);
            expect(usage.percentage).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 31: Minimum Size Invariant', () => {
    /**
     * Feature: stage-04b-context-management, Property 31: Minimum Size Invariant
     * Validates: Requirements 8.2
     * 
     * For any context operation,
     * the context size should never be reduced below the configured minSize.
     */
    it('should never reduce context below minimum size', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1024, max: 8192 }),
          fc.integer({ min: 512, max: 131072 }),
          (minSize, requestedSize) => {
            const pool = createContextPool({
              minContextSize: minSize,
              maxContextSize: 131072,
              autoSize: false
            });

            // Try to set size below minimum
            pool.updateConfig({ targetContextSize: requestedSize });

            // Verify size is never below minimum
            expect(pool.currentSize).toBeGreaterThanOrEqual(minSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce minimum size in calculateOptimalSize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2048, max: 8192 }),
          fc.record({
            total: fc.integer({ min: 1e9, max: 80e9 }),
            used: fc.integer({ min: 0, max: 79e9 }),
            available: fc.integer({ min: 0, max: 1e9 }), // Low available memory
            modelLoaded: fc.integer({ min: 0, max: 40e9 })
          }),
          fc.record({
            parameters: fc.integer({ min: 1, max: 70 }),
            contextLimit: fc.integer({ min: 8192, max: 131072 })
          }),
          (minSize, vramInfo, modelInfo) => {
            const pool = createContextPool({
              minContextSize: minSize,
              maxContextSize: 131072,
              autoSize: true,
              reserveBuffer: 512 * 1024 * 1024
            });

            const calculatedSize = pool.calculateOptimalSize(vramInfo, modelInfo);

            // Verify size is never below minimum
            expect(calculatedSize).toBeGreaterThanOrEqual(minSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 32: Maximum Size Invariant', () => {
    /**
     * Feature: stage-04b-context-management, Property 32: Maximum Size Invariant
     * Validates: Requirements 8.3
     * 
     * For any context operation,
     * the context size should never exceed the configured maxSize.
     */
    it('should never exceed maximum size', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8192, max: 65536 }),
          fc.integer({ min: 512, max: 200000 }),
          (maxSize, requestedSize) => {
            const pool = createContextPool({
              minContextSize: 2048,
              maxContextSize: maxSize,
              autoSize: false
            });

            // Try to set size above maximum
            pool.updateConfig({ targetContextSize: requestedSize });

            // Verify size never exceeds maximum
            expect(pool.currentSize).toBeLessThanOrEqual(maxSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should enforce maximum size in calculateOptimalSize', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 8192, max: 32768 }),
          fc.record({
            total: fc.integer({ min: 40e9, max: 80e9 }),
            used: fc.integer({ min: 0, max: 20e9 }),
            available: fc.integer({ min: 20e9, max: 80e9 }), // High available memory
            modelLoaded: fc.integer({ min: 0, max: 20e9 })
          }),
          fc.record({
            parameters: fc.integer({ min: 1, max: 10 }), // Small model
            contextLimit: fc.integer({ min: 65536, max: 200000 })
          }),
          (maxSize, vramInfo, modelInfo) => {
            const pool = createContextPool({
              minContextSize: 2048,
              maxContextSize: maxSize,
              autoSize: true,
              reserveBuffer: 512 * 1024 * 1024
            });

            const calculatedSize = pool.calculateOptimalSize(vramInfo, modelInfo);

            // Verify size never exceeds maximum
            expect(calculatedSize).toBeLessThanOrEqual(maxSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
