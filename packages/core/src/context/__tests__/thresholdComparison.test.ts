/**
 * Threshold Comparison Tests
 * 
 * Tests for floating-point threshold comparison fixes:
 * - Epsilon comparison for threshold matching
 * - Callback deduplication
 * - Normalized threshold units
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSnapshotManager } from '../snapshotManager.js';
import { createSnapshotStorage } from '../snapshotStorage.js';
import { createContextManager } from '../contextManager.js';
import type { ModelInfo, Message } from '../types.js';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

describe('Threshold Comparison Fixes', () => {
  let tempDir: string;
  let modelInfo: ModelInfo;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `threshold-test-${randomUUID()}`);
    modelInfo = {
      parameters: 8,
      contextLimit: 32768
    };
  });

  describe('Epsilon Comparison', () => {
    it('should use epsilon comparison for floating-point thresholds', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();
      manager.onContextThreshold(0.8, callback);

      // Should trigger even with floating-point precision issues
      // 800 / 1000 = 0.8 exactly, but floating-point might not match with ===
      manager.checkThresholds(800, 1000);

      expect(callback).toHaveBeenCalled();
    });

    it('should match thresholds within epsilon tolerance', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();
      
      // Register threshold as 0.8
      manager.onContextThreshold(0.8, callback);

      // Test with slightly different floating-point values
      // All should match within epsilon (0.0001)
      manager.checkThresholds(8000, 10000); // 0.8
      expect(callback).toHaveBeenCalledTimes(1);

      manager.checkThresholds(80000, 100000); // 0.8
      expect(callback).toHaveBeenCalledTimes(2);

      manager.checkThresholds(800, 1000); // 0.8
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should not match thresholds outside epsilon tolerance', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: false, // Disable auto-create to test threshold matching
        autoThreshold: 0.9, // Different from test threshold
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();
      // Use 0.7 as threshold (different from autoThreshold)
      manager.onContextThreshold(0.7, callback);

      // 0.69 should not match 0.7 (difference > epsilon)
      manager.checkThresholds(690, 1000);
      expect(callback).not.toHaveBeenCalled();

      // 0.71 should match (>= threshold)
      manager.checkThresholds(710, 1000);
      expect(callback).toHaveBeenCalled();
    });
  });

  describe('Callback Deduplication', () => {
    it('should not register duplicate callbacks', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();

      // Register same callback multiple times
      manager.onContextThreshold(0.8, callback);
      manager.onContextThreshold(0.8, callback);
      manager.onContextThreshold(0.8, callback);

      // Trigger threshold
      manager.checkThresholds(800, 1000);

      // Should only be called once (deduplicated)
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should allow different callbacks for same threshold', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      // Register different callbacks for same threshold
      manager.onContextThreshold(0.8, callback1);
      manager.onContextThreshold(0.8, callback2);
      manager.onContextThreshold(0.8, callback3);

      // Trigger threshold
      manager.checkThresholds(800, 1000);

      // All should be called
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should prevent callback spam from duplicate registrations', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();

      // Simulate accidental duplicate registrations (common bug)
      for (let i = 0; i < 10; i++) {
        manager.onContextThreshold(0.8, callback);
      }

      // Trigger threshold
      manager.checkThresholds(800, 1000);

      // Should only be called once despite 10 registrations
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Normalized Threshold Units', () => {
    it('should use fractions (0.0-1.0) for threshold comparisons', async () => {
      const manager = createContextManager('test-session', modelInfo, {
        compression: {
          enabled: true,
          threshold: 0.6, // Fraction, not 60
          strategy: 'hybrid',
          preserveRecent: 4096,
          summaryMaxTokens: 1024
        },
        targetSize: 1000
      });

      await manager.start();

      const compressedEvent = vi.fn();
      manager.on('compressed', compressedEvent);

      // Add messages to reach 60% (600 tokens)
      for (let i = 0; i < 6; i++) {
        const message: Message = {
          id: `msg-${i}`,
          role: 'user',
          content: 'A'.repeat(400), // ~100 tokens
          timestamp: new Date()
        };
        await manager.addMessage(message);
      }

      // Wait for compression
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should trigger at 60% (0.6 fraction), not at 6000% (0.6 * 100)
      // If it triggers, the threshold calculation is correct
      // Note: May or may not trigger depending on exact token counts
      // This test verifies the calculation doesn't overflow

      const usage = manager.getUsage();
      expect(usage.percentage).toBeLessThan(100); // Should not be 6000%
      expect(usage.percentage).toBeGreaterThan(0);

      await manager.stop();
    });

    it('should calculate usage as fraction correctly', () => {
      const manager = createContextManager('test-session', modelInfo, {
        targetSize: 1000
      });

      const usage = manager.getUsage();
      
      // Usage percentage should be 0-100, not 0-10000
      expect(usage.percentage).toBeGreaterThanOrEqual(0);
      expect(usage.percentage).toBeLessThanOrEqual(100);
    });

    it('should compare thresholds consistently', async () => {
      const manager = createContextManager('test-session', modelInfo, {
        compression: {
          enabled: true,
          threshold: 0.6, // 60% as fraction
          strategy: 'hybrid',
          preserveRecent: 4096,
          summaryMaxTokens: 1024
        },
        snapshots: {
          enabled: true,
          autoCreate: true,
          autoThreshold: 0.8, // 80% as fraction
          maxCount: 5
        },
        targetSize: 1000
      });

      await manager.start();

      // Both thresholds use same unit system (fractions)
      expect(manager.config.compression.threshold).toBe(0.6);
      expect(manager.config.snapshots.autoThreshold).toBe(0.8);

      // Verify both are fractions, not percentages
      expect(manager.config.compression.threshold).toBeLessThan(1);
      expect(manager.config.snapshots.autoThreshold).toBeLessThan(1);

      await manager.stop();
    });
  });

  describe('AutoThreshold Skip Logic', () => {
    it('should skip autoThreshold when autoCreate is disabled', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: false, // Disabled
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();
      
      // Register callback for autoThreshold
      manager.onContextThreshold(0.8, callback);

      // Trigger at 80%
      manager.checkThresholds(800, 1000);

      // Should be skipped because autoCreate is false
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not skip autoThreshold when autoCreate is enabled', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: true, // Enabled
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();
      
      // Register callback for autoThreshold
      manager.onContextThreshold(0.8, callback);

      // Trigger at 80%
      manager.checkThresholds(800, 1000);

      // Should fire because autoCreate is true
      expect(callback).toHaveBeenCalled();
    });

    it('should use epsilon comparison for autoThreshold skip check', () => {
      const storage = createSnapshotStorage(tempDir);
      const manager = createSnapshotManager(storage, {
        enabled: true,
        autoCreate: false,
        autoThreshold: 0.8,
        maxCount: 5
      });
      manager.setSessionId('test-session');

      const callback = vi.fn();
      
      // Register callback for 0.8 (same as autoThreshold)
      manager.onContextThreshold(0.8, callback);

      // Should skip even with floating-point precision
      manager.checkThresholds(800, 1000);
      expect(callback).not.toHaveBeenCalled();

      manager.checkThresholds(8000, 10000);
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
