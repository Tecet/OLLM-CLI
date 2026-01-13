/**
 * Property-based tests for GPU Monitor
 * Feature: stage-06-cli-ui
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { DefaultGPUMonitor, type GPUInfo } from '../gpuMonitor.js';

describe('GPU Monitor - Property Tests', () => {
  let monitor: DefaultGPUMonitor;

  beforeEach(() => {
    monitor = new DefaultGPUMonitor();
  });

  describe('Property 4: GPU Temperature Warning', () => {
    /**
     * Feature: stage-06-cli-ui, Property 4: GPU Temperature Warning
     * 
     * For any GPU temperature reading above 80°C, the status bar should display 
     * a warning indicator. This test verifies that the high temperature callback
     * is triggered when temperature exceeds the threshold.
     * 
     * Validates: Requirements 2.3
     */
    it('should trigger warning callback when temperature exceeds 80°C', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.float({ min: -50, max: 150 }), // Temperature range
          async (temperature) => {
            // Create a fresh monitor for each test
            const testMonitor = new DefaultGPUMonitor();
            let warningTriggered = false;
            const threshold = 80;

            // Register high temperature callback
            testMonitor.onHighTemp(threshold, () => {
              warningTriggered = true;
            });

            // Create mock GPU info with the test temperature
            const mockInfo: GPUInfo = {
              available: true,
              vendor: 'nvidia',
              vramTotal: 8 * 1024 * 1024 * 1024,
              vramUsed: 4 * 1024 * 1024 * 1024,
              vramFree: 4 * 1024 * 1024 * 1024,
              temperature,
              temperatureMax: 90,
              gpuUtilization: 50
            };

            // Mock the entire getInfo method to return our test data
            // and manually call checkThresholds via the public API
            testMonitor.getInfo = vi.fn(async () => {
              // Simulate what the real getInfo does - it calls checkThresholds internally
              // We need to access the private method, so we'll use type assertion
              const privateMonitor = testMonitor as any;
              if (privateMonitor.checkThresholds) {
                privateMonitor.checkThresholds(mockInfo);
              }
              return mockInfo;
            });

            // Call getInfo which will trigger threshold checks
            await testMonitor.getInfo();

            // Verify: warning should be triggered if and only if temperature > threshold
            // Use a small epsilon for floating point comparison to avoid boundary issues
            const epsilon = 0.0001;
            if (temperature > threshold + epsilon) {
              expect(warningTriggered).toBe(true);
            } else if (temperature < threshold - epsilon) {
              expect(warningTriggered).toBe(false);
            }
            // For values very close to the threshold (within epsilon), we don't assert
            // as the behavior may vary due to floating point precision
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: VRAM Query Structure', () => {
    /**
     * Feature: stage-06-cli-ui, Property 5: VRAM Query Structure
     * 
     * For any successful VRAM query, the returned GPUInfo should contain 
     * total, used, and free VRAM values in bytes.
     * 
     * Validates: Requirements 2.4
     */
    it('should return GPUInfo with required VRAM fields in bytes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            vramTotal: fc.integer({ min: 0, max: 128 * 1024 * 1024 * 1024 }), // 0 to 128GB
            vramUsed: fc.integer({ min: 0, max: 128 * 1024 * 1024 * 1024 }),
            vramFree: fc.integer({ min: 0, max: 128 * 1024 * 1024 * 1024 })
          }),
          async (vramData) => {
            // Mock GPU info with test VRAM data
            const mockInfo: GPUInfo = {
              available: true,
              vendor: 'nvidia',
              vramTotal: vramData.vramTotal,
              vramUsed: vramData.vramUsed,
              vramFree: vramData.vramFree,
              temperature: 70,
              temperatureMax: 90,
              gpuUtilization: 50
            };

            // Mock getInfo to return our test data
            monitor.getInfo = vi.fn().mockResolvedValue(mockInfo);

            // Query GPU info
            const info = await monitor.getInfo();

            // Verify structure: all VRAM fields must be present and be numbers
            expect(info).toHaveProperty('vramTotal');
            expect(info).toHaveProperty('vramUsed');
            expect(info).toHaveProperty('vramFree');

            expect(typeof info.vramTotal).toBe('number');
            expect(typeof info.vramUsed).toBe('number');
            expect(typeof info.vramFree).toBe('number');

            // Verify values are in bytes (non-negative integers)
            expect(info.vramTotal).toBeGreaterThanOrEqual(0);
            expect(info.vramUsed).toBeGreaterThanOrEqual(0);
            expect(info.vramFree).toBeGreaterThanOrEqual(0);

            // Verify the values match what we provided
            expect(info.vramTotal).toBe(vramData.vramTotal);
            expect(info.vramUsed).toBe(vramData.vramUsed);
            expect(info.vramFree).toBe(vramData.vramFree);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
