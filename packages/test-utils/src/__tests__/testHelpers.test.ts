/**
 * Unit tests for test helper utilities.
 * Tests server detection, timing helpers, and resource tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isServerAvailable,
  getServerUrl,
  skipIfNoServer,
  measureTestTime,
  assertTestSpeed,
  delay,
  waitFor,
  createCleanupTracker,
  createResourceTracker,
  DEFAULT_SERVER_URL,
} from '../testHelpers.js';

describe('Server Detection', () => {
  it('debug env', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('VITEST:', process.env.VITEST);
  });
  describe('getServerUrl', () => {
    it('returns the default server URL', () => {
      const url = getServerUrl();
      expect(url).toBe(DEFAULT_SERVER_URL);
    });

    it('returns configured URL from environment', () => {
      // The URL is read from process.env at module load time
      expect(DEFAULT_SERVER_URL).toBeDefined();
      expect(DEFAULT_SERVER_URL).toContain('http');
    });
  });

  describe('isServerAvailable', () => {
    it('returns false for invalid server', async () => {
      const available = await isServerAvailable('http://invalid-server-that-does-not-exist:99999');
      expect(available).toBe(false);
    });

    it('handles timeout gracefully', async () => {
      // Use a non-routable IP to trigger timeout
      const available = await isServerAvailable('http://192.0.2.1:11434');
      expect(available).toBe(false);
    });

    it('uses default URL when not specified', async () => {
      const available = await isServerAvailable();
      // Result depends on whether server is actually running
      expect(typeof available).toBe('boolean');
    });
  });

  describe('skipIfNoServer', () => {
    it('returns a function', () => {
      const skipFn = skipIfNoServer();
      expect(typeof skipFn).toBe('function');
    });

    it('returns true when server unavailable', async () => {
      const skipFn = skipIfNoServer('http://invalid-server:99999');
      const shouldSkip = await skipFn();
      expect(shouldSkip).toBe(true);
    });

    it('logs skip message when server unavailable', async () => {
      // Save original env
      const originalNodeEnv = process.env.NODE_ENV;
      const originalVitest = process.env.VITEST;
      
      // Set env to non-test to enable logging
      process.env.NODE_ENV = 'development';
      process.env.VITEST = '';
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const skipFn = skipIfNoServer('http://invalid-server:99999');
      await skipFn();
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls.some(call => 
        call.some(arg => typeof arg === 'string' && arg.includes('Skipping'))
      )).toBe(true);
      
      consoleSpy.mockRestore();
      
      // Restore original env
      process.env.NODE_ENV = originalNodeEnv;
      if (originalVitest !== undefined) {
        process.env.VITEST = originalVitest;
      } else {
        delete process.env.VITEST;
      }
    });
  });
});

describe('Timing Helpers', () => {
  describe('measureTestTime', () => {
    it('measures synchronous function execution time', async () => {
      const { result, duration } = await measureTestTime(() => {
        return 42;
      });
      
      expect(result).toBe(42);
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('measures async function execution time', async () => {
      const { result, duration } = await measureTestTime(async () => {
        await delay(50);
        return 'done';
      });
      
      expect(result).toBe('done');
      expect(duration).toBeGreaterThanOrEqual(45); // Allow some variance
      expect(duration).toBeLessThan(150);
    });

    it('measures time accurately for longer operations', async () => {
      const { duration } = await measureTestTime(async () => {
        await delay(100);
      });
      
      expect(duration).toBeGreaterThanOrEqual(95);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('assertTestSpeed', () => {
    it('does not throw when duration is within limit', () => {
      expect(() => assertTestSpeed(50, 100, 'test')).not.toThrow();
    });

    it('throws when duration exceeds limit', () => {
      expect(() => assertTestSpeed(150, 100, 'slow test')).toThrow();
      expect(() => assertTestSpeed(150, 100, 'slow test')).toThrow('slow test');
      expect(() => assertTestSpeed(150, 100, 'slow test')).toThrow('150');
      expect(() => assertTestSpeed(150, 100, 'slow test')).toThrow('100ms');
    });

    it('includes test name in error message', () => {
      expect(() => assertTestSpeed(200, 100, 'my-test')).toThrow('my-test');
    });
  });

  describe('delay', () => {
    it('delays for specified milliseconds', async () => {
      const start = Date.now();
      await delay(50);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(45);
      expect(elapsed).toBeLessThan(150);
    });

    it('handles zero delay', async () => {
      const start = Date.now();
      await delay(0);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('waitFor', () => {
    it('resolves when condition becomes true', async () => {
      let value = false;
      setTimeout(() => { value = true; }, 50);
      
      await waitFor(() => value, { timeout: 1000, interval: 10 });
      
      expect(value).toBe(true);
    });

    it('throws when condition does not become true within timeout', async () => {
      await expect(
        waitFor(() => false, { timeout: 100, interval: 10 })
      ).rejects.toThrow('not met within 100ms');
    });

    it('supports async conditions', async () => {
      let value = false;
      setTimeout(() => { value = true; }, 50);
      
      await waitFor(async () => value, { timeout: 1000, interval: 10 });
      
      expect(value).toBe(true);
    });

    it('uses default timeout and interval', async () => {
      let value = false;
      setTimeout(() => { value = true; }, 50);
      
      await waitFor(() => value);
      
      expect(value).toBe(true);
    });

    it('checks condition immediately', async () => {
      const value = true;
      
      const start = Date.now();
      await waitFor(() => value, { timeout: 1000, interval: 100 });
      const elapsed = Date.now() - start;
      
      // Should resolve immediately without waiting for interval
      expect(elapsed).toBeLessThan(50);
    });
  });
});

describe('Cleanup Tracking', () => {
  describe('createCleanupTracker', () => {
    it('tracks cleanup calls', () => {
      const tracker = createCleanupTracker();
      
      expect(tracker.wasCleanedUp()).toBe(false);
      
      tracker.cleanup();
      
      expect(tracker.wasCleanedUp()).toBe(true);
    });

    it('can be reset', () => {
      const tracker = createCleanupTracker();
      
      tracker.cleanup();
      expect(tracker.wasCleanedUp()).toBe(true);
      
      tracker.reset();
      expect(tracker.wasCleanedUp()).toBe(false);
    });

    it('handles multiple cleanup calls', () => {
      const tracker = createCleanupTracker();
      
      tracker.cleanup();
      tracker.cleanup();
      
      expect(tracker.wasCleanedUp()).toBe(true);
    });
  });
});

describe('Resource Tracking', () => {
  describe('createResourceTracker', () => {
    it('tracks resources', () => {
      const tracker = createResourceTracker();
      let cleaned = false;
      
      tracker.track({
        cleanup: () => { cleaned = true; },
      });
      
      expect(tracker.hasUncleaned()).toBe(true);
      expect(cleaned).toBe(false);
    });

    it('cleans up all resources', async () => {
      const tracker = createResourceTracker();
      const cleanupCalls: number[] = [];
      
      tracker.track({
        cleanup: () => { cleanupCalls.push(1); },
      });
      tracker.track({
        cleanup: () => { cleanupCalls.push(2); },
      });
      
      await tracker.cleanupAll();
      
      expect(cleanupCalls).toEqual([1, 2]);
      expect(tracker.hasUncleaned()).toBe(false);
    });

    it('handles async cleanup functions', async () => {
      const tracker = createResourceTracker();
      let cleaned = false;
      
      tracker.track({
        cleanup: async () => {
          await delay(10);
          cleaned = true;
        },
      });
      
      await tracker.cleanupAll();
      
      expect(cleaned).toBe(true);
      expect(tracker.hasUncleaned()).toBe(false);
    });

    it('tracks multiple resources', async () => {
      const tracker = createResourceTracker();
      const cleanupOrder: string[] = [];
      
      tracker.track({
        cleanup: () => { cleanupOrder.push('first'); },
      });
      tracker.track({
        cleanup: () => { cleanupOrder.push('second'); },
      });
      tracker.track({
        cleanup: () => { cleanupOrder.push('third'); },
      });
      
      await tracker.cleanupAll();
      
      expect(cleanupOrder).toEqual(['first', 'second', 'third']);
    });

    it('reports uncleaned resources correctly', () => {
      const tracker = createResourceTracker();
      
      expect(tracker.hasUncleaned()).toBe(false);
      
      tracker.track({
        cleanup: () => {},
      });
      
      expect(tracker.hasUncleaned()).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('combines timing and cleanup tracking', async () => {
    const tracker = createCleanupTracker();
    
    const { result, duration } = await measureTestTime(async () => {
      await delay(50);
      tracker.cleanup();
      return 'done';
    });
    
    expect(result).toBe('done');
    expect(duration).toBeGreaterThanOrEqual(45);
    expect(tracker.wasCleanedUp()).toBe(true);
  });

  it('uses waitFor with resource cleanup', async () => {
    const resourceTracker = createResourceTracker();
    let resourceReady = false;
    
    resourceTracker.track({
      cleanup: () => { resourceReady = false; },
    });
    
    setTimeout(() => { resourceReady = true; }, 50);
    
    await waitFor(() => resourceReady, { timeout: 1000 });
    
    expect(resourceReady).toBe(true);
    
    await resourceTracker.cleanupAll();
    
    expect(resourceReady).toBe(false);
  });
});
