/**
 * Context Command Handler Tests
 * 
 * Tests for the /context command and its subcommands
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  ContextCommandHandler,
  createContextCommandHandler,
  type ContextCommandResult
} from '../contextCommand.js';
import type {
  ContextManager,
  VRAMInfo,
  ContextUsage,
  ContextSnapshot,
  ContextConfig
} from '../../context/types.js';

// ============================================================================
// Mock Helpers
// ============================================================================

function createMockContextManager(overrides?: Partial<ContextManager>): ContextManager {
  const defaultConfig: ContextConfig = {
    targetSize: 8192,
    minSize: 2048,
    maxSize: 131072,
    autoSize: true,
    vramBuffer: 512 * 1024 * 1024,
    kvQuantization: 'q8_0',
    compression: {
      enabled: true,
      threshold: 0.8,
      strategy: 'hybrid',
      preserveRecent: 4096,
      summaryMaxTokens: 1024
    },
    snapshots: {
      enabled: true,
      maxCount: 5,
      autoCreate: true,
      autoThreshold: 0.8
    }
  };

  return {
    config: defaultConfig,
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    updateConfig: vi.fn(),
    getUsage: vi.fn().mockReturnValue({
      currentTokens: 4096,
      maxTokens: 8192,
      percentage: 50,
      vramUsed: 4 * 1024 * 1024 * 1024,
      vramTotal: 8 * 1024 * 1024 * 1024
    }),
    addMessage: vi.fn().mockResolvedValue(undefined),
    createSnapshot: vi.fn().mockResolvedValue({
      id: 'snap-123',
      sessionId: 'session-1',
      timestamp: new Date(),
      tokenCount: 4096,
      summary: 'Test snapshot',
      messages: [],
      metadata: {
        model: 'test-model',
        contextSize: 8192,
        compressionRatio: 1.0
      }
    }),
    restoreSnapshot: vi.fn().mockResolvedValue(undefined),
    listSnapshots: vi.fn().mockResolvedValue([]),
    compress: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

function createMockVRAMInfo(): VRAMInfo {
  return {
    total: 8 * 1024 * 1024 * 1024, // 8GB
    used: 4 * 1024 * 1024 * 1024,  // 4GB
    available: 4 * 1024 * 1024 * 1024, // 4GB
    modelLoaded: 3 * 1024 * 1024 * 1024 // 3GB
  };
}

// ============================================================================
// Property Tests
// ============================================================================

describe('ContextCommandHandler - Property Tests', () => {
  describe('Property 27: Context Size Command', () => {
    /**
     * Feature: stage-04b-context-management, Property 27: Context Size Command
     * 
     * For any target context size value, running `/context size <tokens>` 
     * should set the target to that value.
     * 
     * Validates: Requirements 7.2
     */
    it('should set target size for any valid token count', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2048, max: 131072 }), // Valid token range
          async (targetSize) => {
            // Arrange
            const mockManager = createMockContextManager();
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['size', targetSize.toString()]);

            // Assert
            expect(result.success).toBe(true);
            expect(mockManager.updateConfig).toHaveBeenCalledWith({
              targetSize,
              autoSize: false
            });
            expect(result.message).toContain(targetSize.toString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject sizes below minimum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2047 }), // Below minimum
          async (targetSize) => {
            // Arrange
            const mockManager = createMockContextManager();
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['size', targetSize.toString()]);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('below minimum');
            expect(mockManager.updateConfig).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject sizes above maximum', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 131073, max: 1000000 }), // Above maximum
          async (targetSize) => {
            // Arrange
            const mockManager = createMockContextManager();
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['size', targetSize.toString()]);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('exceeds maximum');
            expect(mockManager.updateConfig).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 28: Snapshot Restoration', () => {
    /**
     * Feature: stage-04b-context-management, Property 28: Snapshot Restoration
     * 
     * For any snapshot ID, running `/context restore <id>` should restore 
     * the context to match that snapshot.
     * 
     * Validates: Requirements 7.5
     */
    it('should restore context for any valid snapshot ID', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Generate random snapshot IDs
          fc.integer({ min: 100, max: 100000 }), // Token count
          async (snapshotId, tokenCount) => {
            // Arrange
            const mockUsage: ContextUsage = {
              currentTokens: tokenCount,
              maxTokens: 8192,
              percentage: (tokenCount / 8192) * 100,
              vramUsed: 4 * 1024 * 1024 * 1024,
              vramTotal: 8 * 1024 * 1024 * 1024
            };
            
            const mockManager = createMockContextManager({
              restoreSnapshot: vi.fn().mockResolvedValue(undefined),
              getUsage: vi.fn().mockReturnValue(mockUsage)
            });
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['restore', snapshotId]);

            // Assert
            expect(result.success).toBe(true);
            expect(mockManager.restoreSnapshot).toHaveBeenCalledWith(snapshotId);
            expect(result.message).toContain(snapshotId);
            expect(result.message).toContain('Restored');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle restoration errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.string({ minLength: 5, maxLength: 50 }), // Error message
          async (snapshotId, errorMsg) => {
            // Arrange
            const mockManager = createMockContextManager({
              restoreSnapshot: vi.fn().mockRejectedValue(new Error(errorMsg))
            });
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['restore', snapshotId]);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to restore snapshot');
            expect(result.message).toContain(errorMsg);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 29: Context Clear Preservation', () => {
    /**
     * Feature: stage-04b-context-management, Property 29: Context Clear Preservation
     * 
     * For any context with a system prompt, running `/context clear` should 
     * remove all messages except the system prompt.
     * 
     * Validates: Requirements 7.7
     */
    it('should preserve system prompt when clearing context', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(undefined), // No input needed, just test the behavior
          async () => {
            // Arrange
            const mockManager = createMockContextManager({
              clear: vi.fn().mockResolvedValue(undefined)
            });
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['clear']);

            // Assert
            expect(result.success).toBe(true);
            expect(mockManager.clear).toHaveBeenCalled();
            expect(result.message).toContain('Context cleared');
            expect(result.message).toContain('System prompt preserved');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle clear errors gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 50 }), // Error message
          async (errorMsg) => {
            // Arrange
            const mockManager = createMockContextManager({
              clear: vi.fn().mockRejectedValue(new Error(errorMsg))
            });
            const mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
            const handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);

            // Act
            const result = await handler.handleCommand(['clear']);

            // Assert
            expect(result.success).toBe(false);
            expect(result.message).toContain('Failed to clear context');
            expect(result.message).toContain(errorMsg);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================================================
// Unit Tests
// ============================================================================

describe('ContextCommandHandler - Unit Tests', () => {
  let mockManager: ContextManager;
  let mockGetVRAMInfo: () => Promise<VRAMInfo>;
  let handler: ContextCommandHandler;

  beforeEach(() => {
    mockManager = createMockContextManager();
    mockGetVRAMInfo = vi.fn().mockResolvedValue(createMockVRAMInfo());
    handler = createContextCommandHandler(mockManager, mockGetVRAMInfo);
  });

  describe('/context (status display)', () => {
    it('should display current context status', async () => {
      // Act
      const result = await handler.handleCommand([]);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Context Status');
      expect(result.message).toContain('Tokens:');
      expect(result.message).toContain('VRAM:');
      expect(result.data).toBeDefined();
    });
  });

  describe('/context auto', () => {
    it('should enable auto-sizing', async () => {
      // Act
      const result = await handler.handleCommand(['auto']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Auto-sizing enabled');
      expect(mockManager.updateConfig).toHaveBeenCalledWith({
        autoSize: true
      });
    });
  });

  describe('/context snapshot', () => {
    it('should create a manual snapshot', async () => {
      // Act
      const result = await handler.handleCommand(['snapshot']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Snapshot created');
      expect(result.message).toContain('snap-123');
      expect(mockManager.createSnapshot).toHaveBeenCalled();
    });

    it('should handle snapshot creation errors', async () => {
      // Arrange
      const errorManager = createMockContextManager({
        createSnapshot: vi.fn().mockRejectedValue(new Error('Disk full'))
      });
      const errorHandler = createContextCommandHandler(errorManager, mockGetVRAMInfo);

      // Act
      const result = await errorHandler.handleCommand(['snapshot']);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to create snapshot');
      expect(result.message).toContain('Disk full');
    });
  });

  describe('/context list', () => {
    it('should list available snapshots', async () => {
      // Arrange
      const snapshots: ContextSnapshot[] = [
        {
          id: 'snap-1',
          sessionId: 'session-1',
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          tokenCount: 5000,
          summary: 'First snapshot',
          messages: [],
          metadata: { model: 'test', contextSize: 8192, compressionRatio: 1.0 }
        },
        {
          id: 'snap-2',
          sessionId: 'session-1',
          timestamp: new Date(Date.now() - 7200000), // 2 hours ago
          tokenCount: 3000,
          summary: 'Second snapshot',
          messages: [],
          metadata: { model: 'test', contextSize: 8192, compressionRatio: 1.0 }
        }
      ];
      const managerWithSnapshots = createMockContextManager({
        listSnapshots: vi.fn().mockResolvedValue(snapshots)
      });
      const handlerWithSnapshots = createContextCommandHandler(
        managerWithSnapshots,
        mockGetVRAMInfo
      );

      // Act
      const result = await handlerWithSnapshots.handleCommand(['list']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Snapshots:');
      expect(result.message).toContain('snap-1');
      expect(result.message).toContain('snap-2');
      expect(result.data).toEqual(snapshots);
    });

    it('should handle empty snapshot list', async () => {
      // Act
      const result = await handler.handleCommand(['list']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('No snapshots available');
    });
  });

  describe('/context restore', () => {
    it('should restore from snapshot', async () => {
      // Act
      const result = await handler.handleCommand(['restore', 'snap-123']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Restored snapshot snap-123');
      expect(mockManager.restoreSnapshot).toHaveBeenCalledWith('snap-123');
    });

    it('should require snapshot ID', async () => {
      // Act
      const result = await handler.handleCommand(['restore']);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Usage: /context restore');
    });
  });

  describe('/context clear', () => {
    it('should clear context', async () => {
      // Act
      const result = await handler.handleCommand(['clear']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Context cleared');
      expect(result.message).toContain('System prompt preserved');
      expect(mockManager.clear).toHaveBeenCalled();
    });
  });

  describe('/context compress', () => {
    it('should manually trigger compression', async () => {
      // Arrange
      const beforeUsage: ContextUsage = {
        currentTokens: 8000,
        maxTokens: 8192,
        percentage: 97.7,
        vramUsed: 4 * 1024 * 1024 * 1024,
        vramTotal: 8 * 1024 * 1024 * 1024
      };
      const afterUsage: ContextUsage = {
        currentTokens: 2000,
        maxTokens: 8192,
        percentage: 24.4,
        vramUsed: 4 * 1024 * 1024 * 1024,
        vramTotal: 8 * 1024 * 1024 * 1024
      };
      
      let callCount = 0;
      const compressManager = createMockContextManager({
        getUsage: vi.fn(() => {
          callCount++;
          return callCount === 1 ? beforeUsage : afterUsage;
        })
      });
      const compressHandler = createContextCommandHandler(
        compressManager,
        mockGetVRAMInfo
      );

      // Act
      const result = await compressHandler.handleCommand(['compress']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('8000 → 2000');
      expect(result.message).toContain('75.0% reduction');
      expect(compressManager.compress).toHaveBeenCalled();
    });
  });

  describe('/context stats', () => {
    it('should display detailed statistics', async () => {
      // Act
      const result = await handler.handleCommand(['stats']);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Detailed Context Statistics');
      expect(result.message).toContain('Memory:');
      expect(result.message).toContain('Context:');
      expect(result.message).toContain('Session:');
      expect(result.data).toBeDefined();
    });
  });

  describe('Unknown subcommand', () => {
    it('should return error for unknown subcommand', async () => {
      // Act
      const result = await handler.handleCommand(['invalid']);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown subcommand');
    });
  });
});
