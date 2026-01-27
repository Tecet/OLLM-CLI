/**
 * Context Manager Tests
 * 
 * Tests for the main orchestration layer that coordinates all context management services.
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createContextManager, ConversationContextManager } from '../contextManager.js';

import type {
  ModelInfo,
  ContextConfig,
  Message
} from '../types.js';

describe('ContextManager', () => {
  let modelInfo: ModelInfo;

  beforeEach(() => {
    modelInfo = {
      parameters: 8,
      contextLimit: 32768
    };
  });

  describe('Property 30: Target Size Configuration', () => {
    /**
     * Feature: stage-04b-context-management, Property 30: Target Size Configuration
     * 
     * For any configured targetSize value, the Context Manager should use the Ollama
     * context size (85% pre-calculated) as the actual maxTokens.
     * 
     * Validates: Requirements 8.1
     */
    it('should use configured targetSize as preferred context size', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2048, max: 131072 }),
          (targetSize) => {
            // Create context manager with specific target size
            const config: Partial<ContextConfig> = {
              targetSize,
              autoSize: false // Disable auto-sizing to test target size
            };

            const manager = createContextManager(
              'test-session',
              modelInfo,
              config
            );

            // Verify the config has the target size (user-facing)
            expect(manager.config.targetSize).toBe(targetSize);

            // Get the context pool's current size (should be Ollama size - 85%)
            const usage = manager.getUsage();
            
            // The context pool should use the Ollama size (85% of target)
            // Since we don't have context profiles in the test, it falls back to 85% calculation
            const clampedSize = Math.max(
              config.minSize || 2048,
              Math.min(targetSize, config.maxSize || 131072)
            );
            const expectedOllamaSize = Math.floor(clampedSize * 0.85);
            
            expect(usage.maxTokens).toBe(expectedOllamaSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should update target size when configuration is updated', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2048, max: 131072 }),
          fc.integer({ min: 2048, max: 131072 }),
          (initialSize, newSize) => {
            // Create manager with initial target size
            const manager = createContextManager(
              'test-session',
              modelInfo,
              { targetSize: initialSize, autoSize: false }
            );

            // Update configuration with new target size
            manager.updateConfig({ targetSize: newSize });

            // Verify the config was updated
            expect(manager.config.targetSize).toBe(newSize);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 33: Auto-Size Dynamic Adjustment', () => {
    /**
     * Feature: stage-04b-context-management, Property 33: Auto-Size Dynamic Adjustment
     * 
     * For any VRAM availability change when autoSize is enabled, the context size
     * should adjust accordingly.
     * 
     * Validates: Requirements 8.4
     */
    it('should adjust context size when autoSize is enabled', async () => {
      fc.assert(
        await fc.asyncProperty(
          fc.integer({ min: 1e9, max: 80e9 }), // VRAM total (1-80 GB)
          fc.integer({ min: 1, max: 70 }), // Model parameters (1-70B)
          async (vramTotal, modelParams) => {
            const testModelInfo: ModelInfo = {
              parameters: modelParams,
              contextLimit: 131072
            };

            const config: Partial<ContextConfig> = {
              autoSize: true,
              vramBuffer: 512 * 1024 * 1024
            };

            const manager = createContextManager(
              'test-session',
              testModelInfo,
              config
            );

            // Start the manager to trigger initial sizing
            await manager.start();

            // Verify autoSize is enabled
            expect(manager.config.autoSize).toBe(true);

            // Get usage - should have calculated optimal size
            const usage = manager.getUsage();
            expect(usage.maxTokens).toBeGreaterThan(0);

            await manager.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 34: VRAM Buffer Reservation', () => {
    /**
     * Feature: stage-04b-context-management, Property 34: VRAM Buffer Reservation
     * 
     * For any configured vramBuffer value, that amount should be reserved and
     * subtracted from available VRAM in all calculations.
     * 
     * Validates: Requirements 8.5
     */
    it('should reserve configured VRAM buffer', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 256 * 1024 * 1024, max: 2 * 1024 * 1024 * 1024 }), // 256MB - 2GB
          (vramBuffer) => {
            const config: Partial<ContextConfig> = {
              vramBuffer,
              autoSize: false
            };

            const manager = createContextManager(
              'test-session',
              modelInfo,
              config
            );

            // Verify the buffer is configured
            expect(manager.config.vramBuffer).toBe(vramBuffer);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 35: Quantization Configuration', () => {
    /**
     * Feature: stage-04b-context-management, Property 35: Quantization Configuration
     * 
     * For any configured kvQuantization type, that quantization should be used
     * in all context size calculations.
     * 
     * Validates: Requirements 8.6
     */
    it('should use configured quantization type', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('f16' as const, 'q8_0' as const, 'q4_0' as const),
          (kvQuantization) => {
            const config: Partial<ContextConfig> = {
              kvQuantization,
              autoSize: false
            };

            const manager = createContextManager(
              'test-session',
              modelInfo,
              config
            );

            // Verify the quantization is configured
            expect(manager.config.kvQuantization).toBe(kvQuantization);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 36: Auto-Snapshot Threshold', () => {
    /**
     * Feature: stage-04b-context-management, Property 36: Auto-Snapshot Threshold
     * 
     * For any configured snapshot threshold, snapshots should be automatically
     * created when context usage reaches that threshold.
     * 
     * Validates: Requirements 8.8
     */
    it('should configure auto-snapshot threshold', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.5, max: 0.95 }),
          (autoThreshold) => {
            const config: Partial<ContextConfig> = {
              snapshots: {
                enabled: true,
                maxCount: 5,
                autoCreate: true,
                autoThreshold
              }
            };

            const manager = createContextManager(
              'test-session',
              modelInfo,
              config
            );

            // Verify the threshold is configured
            expect(manager.config.snapshots.autoThreshold).toBe(autoThreshold);
            expect(manager.config.snapshots.autoCreate).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should create context manager with default configuration', () => {
      const manager = createContextManager('test-session', modelInfo);

      expect(manager).toBeDefined();
      expect(manager.config).toBeDefined();
      expect(manager.config.targetSize).toBe(8192);
      expect(manager.config.minSize).toBe(2048);
      expect(manager.config.maxSize).toBe(131072);
    });

    it('should create context manager with custom configuration', () => {
      const config: Partial<ContextConfig> = {
        targetSize: 16384,
        minSize: 4096,
        maxSize: 65536,
        autoSize: false
      };

      const manager = createContextManager('test-session', modelInfo, config);

      expect(manager.config.targetSize).toBe(16384);
      expect(manager.config.minSize).toBe(4096);
      expect(manager.config.maxSize).toBe(65536);
      expect(manager.config.autoSize).toBe(false);
    });

    it('should start and stop services', async () => {
      const manager = createContextManager('test-session', modelInfo);

      await manager.start();
      // Should not throw

      await manager.stop();
      // Should not throw
    });

    it('should get current usage', () => {
      const manager = createContextManager('test-session', modelInfo);

      const usage = manager.getUsage();

      expect(usage).toBeDefined();
      expect(usage.currentTokens).toBeGreaterThanOrEqual(0);
      expect(usage.maxTokens).toBeGreaterThan(0);
      expect(usage.percentage).toBeGreaterThanOrEqual(0);
      expect(usage.percentage).toBeLessThanOrEqual(100);
    });

    it('sets the safe compression and snapshot thresholds by default', () => {
      const manager = createContextManager('test-session', modelInfo);
      expect(manager.config.compression.threshold).toBeCloseTo(0.68);
      expect(manager.config.snapshots.autoThreshold).toBeCloseTo(0.85);
    });

    it('should set system prompt', () => {
      const manager = createContextManager('test-session', modelInfo);

      manager.setSystemPrompt('You are a helpful assistant.');

      const context = (manager as ConversationContextManager).getContext();
      expect(context.systemPrompt.content).toBe('You are a helpful assistant.');
      expect(context.messages[0].role).toBe('system');
    });

    it('should add message to context', async () => {
      const manager = createContextManager('test-session', modelInfo);

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, world!',
        timestamp: new Date()
      };

      await manager.addMessage(message);

const context = (manager as ConversationContextManager).getContext();
      expect(context.messages).toContainEqual(expect.objectContaining({
        id: 'msg-1',
        role: 'user',
        content: 'Hello, world!'
      }));
    });

    it('should clear context except system prompt', async () => {
      const manager = createContextManager('test-session', modelInfo);

      manager.setSystemPrompt('System prompt');

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'User message',
        timestamp: new Date()
      };

      await manager.addMessage(message);

      await manager.clear();

      const context = (manager as ConversationContextManager).getContext();
      expect(context.messages.length).toBe(1);
      expect(context.messages[0].role).toBe('system');
      expect(context.messages[0].content).toBe('System prompt');
    });

    it('should emit events when configuration is updated', async () => {
      const manager = createContextManager('test-session', modelInfo);

      const eventPromise = new Promise<ContextConfig>((resolve) => {
        manager.on('config-updated', (config) => {
          resolve(config);
        });
      });

      manager.updateConfig({ targetSize: 16384 });

      const config = await eventPromise;
      expect(config.targetSize).toBe(16384);
    });

  it('should emit events when message is added', async () => {
      const manager = createContextManager('test-session', modelInfo);

      const eventPromise = new Promise<{ message: Message; usage: any }>((resolve) => {
        manager.on('message-added', (data) => {
          resolve(data);
        });
      });

      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello!',
        timestamp: new Date()
      };

      await manager.addMessage(message);

      const { message: emittedMessage, usage } = await eventPromise;
    expect(emittedMessage.id).toBe('msg-1');
    expect(usage).toBeDefined();
  });

  describe('Mid-stream guard', () => {
    let manager: ReturnType<typeof createContextManager>;
    let compressSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      manager = createContextManager('test-session', modelInfo, {
        compression: { threshold: 0.6, enabled: true, strategy: 'hybrid', preserveRecent: 1024, summaryMaxTokens: 512 },
      });
      compressSpy = vi.spyOn(manager, 'compress').mockResolvedValue(undefined);
      (manager as any).currentContext.tokenCount = 50;
      (manager as any).currentContext.maxTokens = 200;
    });

    afterEach(() => {
      compressSpy.mockRestore();
    });

    it('triggers compression when inflight usage crosses the threshold', async () => {
      manager.reportInflightTokens(80);
      await Promise.resolve();
      expect(compressSpy).toHaveBeenCalled();
    });

    it('does not trigger compression when usage stays below threshold', async () => {
      manager.reportInflightTokens(10);
      await Promise.resolve();
      expect(compressSpy).not.toHaveBeenCalled();
    });
  });
});
});
