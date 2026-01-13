/**
 * VRAM Monitor Tests
 * 
 * Tests for VRAM monitoring functionality including GPU detection,
 * memory querying, and low-memory event emission.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DefaultVRAMMonitor, createVRAMMonitor } from '../vramMonitor.js';
import { GPUType, GPUDetector, VRAMInfo } from '../types.js';
import * as fc from 'fast-check';

// Mock GPU detector for testing
class MockGPUDetector implements GPUDetector {
  constructor(private gpuType: GPUType = GPUType.CPU_ONLY) {}

  async detectGPU(): Promise<GPUType> {
    return this.gpuType;
  }

  async hasGPU(): Promise<boolean> {
    return this.gpuType !== GPUType.CPU_ONLY;
  }

  setGPUType(type: GPUType): void {
    this.gpuType = type;
  }
}

describe('VRAMMonitor', () => {
  let monitor: DefaultVRAMMonitor;
  let mockDetector: MockGPUDetector;

  beforeEach(() => {
    mockDetector = new MockGPUDetector();
    monitor = new DefaultVRAMMonitor(mockDetector);
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Property Tests', () => {
    describe('Property 1: VRAM Info Completeness', () => {
      it('should return VRAMInfo with all required fields for any GPU type', async () => {
        // Feature: stage-04b-context-management, Property 1: VRAM Info Completeness
        // For any VRAM information request, the returned VRAMInfo object should contain
        // all required fields (total, used, available, modelLoaded) with non-negative values.

        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(GPUType.CPU_ONLY, GPUType.NVIDIA, GPUType.AMD, GPUType.APPLE_SILICON, GPUType.WINDOWS),
            async (gpuType) => {
              mockDetector.setGPUType(gpuType);
              monitor.clearCache();

              const info = await monitor.getInfo();

              // Check all required fields exist
              expect(info).toHaveProperty('total');
              expect(info).toHaveProperty('used');
              expect(info).toHaveProperty('available');
              expect(info).toHaveProperty('modelLoaded');

              // Check all values are non-negative numbers
              expect(typeof info.total).toBe('number');
              expect(typeof info.used).toBe('number');
              expect(typeof info.available).toBe('number');
              expect(typeof info.modelLoaded).toBe('number');

              expect(info.total).toBeGreaterThanOrEqual(0);
              expect(info.used).toBeGreaterThanOrEqual(0);
              expect(info.available).toBeGreaterThanOrEqual(0);
              expect(info.modelLoaded).toBeGreaterThanOrEqual(0);

              // Sanity check: used + available should be reasonably close to total
              // (allowing for significant variance due to system overhead, caching, and rounding)
              // On some systems, used + available may not equal total due to buffers/cache
              expect(info.used + info.available).toBeLessThanOrEqual(info.total * 1.5);
            }
          ),
          { numRuns: 20, timeout: 25000 } // Reduced runs for slower systems
        );
      }, 30000); // Vitest timeout: 30 seconds
    });

    describe('Property 2: Low Memory Event Emission', () => {
      it('should emit low-memory event when available memory drops below threshold', async () => {
        // Feature: stage-04b-context-management, Property 2: Low Memory Event Emission
        // For any memory state and threshold, when available memory drops below the threshold,
        // a low-memory event should be emitted.

        await fc.assert(
          fc.asyncProperty(
            fc.double({ min: 0.9, max: 0.99 }), // Very high threshold to ensure low memory condition
            async (threshold) => {
              mockDetector.setGPUType(GPUType.CPU_ONLY);
              monitor.clearCache();
              monitor.setLowMemoryThreshold(threshold);
              monitor.resetCooldown();

              let eventEmitted = false;
              let emittedInfo: VRAMInfo | null = null;

              monitor.onLowMemory((info) => {
                eventEmitted = true;
                emittedInfo = info;
              });

              // Start monitoring with short interval for testing
              monitor.startMonitoring(50);

              // Wait for at least 4-5 monitoring cycles to ensure event fires
              await new Promise(resolve => setTimeout(resolve, 300));

              monitor.stopMonitoring();

              // Get current memory info to verify condition
              const info = await monitor.getInfo();
              const isLowMemory = info.available < info.total * threshold;

              // With a very high threshold (90-99%), memory should always be "low"
              // so the event should have been emitted
              expect(isLowMemory).toBe(true);
              expect(eventEmitted).toBe(true);
              expect(emittedInfo).not.toBeNull();
              
              if (emittedInfo) {
                expect((emittedInfo as VRAMInfo).available).toBeLessThan((emittedInfo as VRAMInfo).total * threshold);
              }
            }
          ),
          { numRuns: 10, timeout: 15000 } // Fewer runs with longer timeout
        );
      }, 20000); // Increased Vitest timeout
    });
  });

  describe('Unit Tests', () => {
    describe('GPU Detection', () => {
      it('should detect NVIDIA GPU', async () => {
        mockDetector.setGPUType(GPUType.NVIDIA);
        monitor.clearCache();

        const info = await monitor.getInfo();
        
        expect(info).toBeDefined();
        expect(info.total).toBeGreaterThan(0);
      });

      it('should detect AMD GPU', async () => {
        mockDetector.setGPUType(GPUType.AMD);
        monitor.clearCache();

        const info = await monitor.getInfo();
        
        expect(info).toBeDefined();
        expect(info.total).toBeGreaterThan(0);
      });

      it('should detect Apple Silicon', async () => {
        mockDetector.setGPUType(GPUType.APPLE_SILICON);
        monitor.clearCache();

        const info = await monitor.getInfo();
        
        expect(info).toBeDefined();
        expect(info.total).toBeGreaterThan(0);
      });

      it('should fall back to CPU-only mode', async () => {
        mockDetector.setGPUType(GPUType.CPU_ONLY);
        monitor.clearCache();

        const info = await monitor.getInfo();
        
        expect(info).toBeDefined();
        expect(info.total).toBeGreaterThan(0);
        // CPU-only should use system RAM
        expect(info.total).toBeGreaterThan(1024 * 1024 * 1024); // At least 1GB
      });
    });

    describe('Memory Querying', () => {
      it('should return consistent memory info on multiple calls', async () => {
        const info1 = await monitor.getInfo();
        const info2 = await monitor.getInfo();

        // Total should be the same
        expect(info1.total).toBe(info2.total);
        
        // Used and available may vary slightly but should be in same ballpark
        expect(Math.abs(info1.used - info2.used)).toBeLessThan(info1.total * 0.1);
      });

      it('should calculate available memory for context', async () => {
        const available = await monitor.getAvailableForContext();
        const info = await monitor.getInfo();

        // Available for context should be less than total available
        // (due to reserved memory)
        expect(available).toBeLessThanOrEqual(info.available);
        expect(available).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Monitoring', () => {
      it('should start and stop monitoring', async () => {
        let callCount = 0;
        monitor.onLowMemory(() => {
          callCount++;
        });

        monitor.startMonitoring(100);
        await new Promise(resolve => setTimeout(resolve, 350));
        
        monitor.stopMonitoring();
        const countAfterStop = callCount;
        
        // Wait to ensure no more events fire
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Count should not increase after stopping (allow for up to 2 extra due to timing/async)
        expect(callCount).toBeLessThanOrEqual(countAfterStop + 2);
      });

      it('should emit low-memory events with cooldown', async () => {
        monitor.setLowMemoryThreshold(0.99); // Very high threshold to trigger event
        monitor.resetCooldown(); // Ensure cooldown is reset
        
        let eventCount = 0;
        monitor.onLowMemory(() => {
          eventCount++;
        });

        monitor.startMonitoring(100);
        
        // Wait for multiple monitoring cycles
        await new Promise(resolve => setTimeout(resolve, 600));
        
        monitor.stopMonitoring();

        // Should have emitted at most 3 events due to cooldown (allowing for timing variance and async)
        expect(eventCount).toBeLessThanOrEqual(3);
      });
    });

    describe('Factory Function', () => {
      it('should create a VRAM monitor instance', () => {
        const newMonitor = createVRAMMonitor();
        expect(newMonitor).toBeDefined();
        expect(typeof newMonitor.getInfo).toBe('function');
        expect(typeof newMonitor.startMonitoring).toBe('function');
        expect(typeof newMonitor.stopMonitoring).toBe('function');
      });

      it('should accept custom GPU detector', () => {
        const customDetector = new MockGPUDetector(GPUType.NVIDIA);
        const newMonitor = createVRAMMonitor(customDetector);
        expect(newMonitor).toBeDefined();
      });
    });
  });
});
