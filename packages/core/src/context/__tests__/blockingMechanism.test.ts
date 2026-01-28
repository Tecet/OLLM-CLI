/**
 * Tests for Blocking Mechanism (Phase 2)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CompressionCoordinator } from '../compressionCoordinator.js';
import { ContextTier, OperationalMode } from '../types.js';

import type { ConversationContext, ContextConfig } from '../types.js';

describe('Blocking Mechanism (Phase 2)', () => {
  let compressionCoordinator: CompressionCoordinator;
  let mockContext: ConversationContext;
  let mockEmit: ReturnType<typeof vi.fn>;
  
  const sessionId = 'test-session';
  
  beforeEach(() => {
    mockContext = {
      sessionId,
      messages: [],
      systemPrompt: {
        id: 'system-1',
        role: 'system',
        content: 'Test system prompt',
        timestamp: new Date()
      },
      tokenCount: 0,
      maxTokens: 6963,
      checkpoints: [],
      architectureDecisions: [],
      neverCompressed: [],
      metadata: {
        model: 'test-model',
        contextSize: 6963,
        compressionHistory: []
      }
    };
    
    mockEmit = vi.fn();
    
    const mockConfig: ContextConfig = {
      targetSize: 8192,
      minSize: 4096,
      maxSize: 16384,
      autoSize: false,
      vramBuffer: 0.1,
      kvQuantization: false,
      compression: {
        enabled: true,
        strategy: 'summarize',
        preserveRecent: 10,
        summaryMaxTokens: 500
      },
      snapshots: {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.85,
        maxSnapshots: 10
      }
    };
    
    compressionCoordinator = new CompressionCoordinator({
      config: mockConfig,
      getContext: () => mockContext,
      getUsage: () => ({
        currentTokens: mockContext.tokenCount,
        maxTokens: mockContext.maxTokens,
        percentage: (mockContext.tokenCount / mockContext.maxTokens) * 100
      }),
      getTierConfig: () => ({
        tier: ContextTier.TIER_3_STANDARD,
        strategy: 'summarize',
        maxCheckpoints: 10
      }),
      getModeProfile: () => ({
        mode: OperationalMode.ASSISTANT,
        contextStrategy: 'balanced',
        compressionThreshold: 0.8
      }),
      snapshotManager: {
        createSnapshot: vi.fn().mockResolvedValue({
          id: 'snapshot-1',
          sessionId,
          timestamp: new Date(),
          context: mockContext,
          metadata: {
            reason: 'auto',
            tokenCount: 0,
            messageCount: 0
          }
        }),
        restoreSnapshot: vi.fn(),
        listSnapshots: vi.fn(),
        getSnapshot: vi.fn(),
        onContextThreshold: vi.fn(),
        onBeforeOverflow: vi.fn()
      } as any,
      compressionService: {
        compress: vi.fn().mockResolvedValue({
          summary: {
            id: 'summary-1',
            role: 'system',
            content: 'Test summary',
            timestamp: new Date()
          },
          preserved: [],
          originalTokens: 1000,
          compressedTokens: 500,
          compressionRatio: 0.5,
          status: 'compressed'
        })
      } as any,
      tokenCounter: {
        countTokensCached: vi.fn().mockReturnValue(100),
        countConversationTokens: vi.fn().mockReturnValue(100),
        getMetrics: vi.fn(),
        resetMetrics: vi.fn()
      } as any,
      contextPool: {
        getCurrentSize: vi.fn().mockReturnValue(6963),
        setCurrentTokens: vi.fn()
      } as any,
      emit: mockEmit,
      checkpointManager: {
        compressOldCheckpoints: vi.fn().mockResolvedValue(undefined),
        preserveNeverCompressed: vi.fn().mockReturnValue([]),
        extractCriticalInfo: vi.fn().mockReturnValue([]),
        reconstructNeverCompressed: vi.fn().mockReturnValue([])
      } as any,
      isTestEnv: true
    });
  });

  it('should not be in progress initially', () => {
    expect(compressionCoordinator.isSummarizationInProgress()).toBe(false);
  });

  it('should set in-progress flag during summarization', async () => {
    // Add messages to trigger compression
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    // Start summarization (don't await)
    const summarizationPromise = compressionCoordinator.handleAutoThreshold();
    
    // Check flag is set
    expect(compressionCoordinator.isSummarizationInProgress()).toBe(true);
    
    // Wait for completion
    await summarizationPromise;
    
    // Check flag is cleared
    expect(compressionCoordinator.isSummarizationInProgress()).toBe(false);
  });

  it('should emit block-user-input event when summarization starts', async () => {
    // Add messages
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    await compressionCoordinator.handleAutoThreshold();
    
    // Check block event was emitted
    expect(mockEmit).toHaveBeenCalledWith('block-user-input', expect.objectContaining({
      reason: 'checkpoint-creation'
    }));
  });

  it('should emit unblock-user-input event when summarization completes', async () => {
    // Add messages
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    await compressionCoordinator.handleAutoThreshold();
    
    // Check unblock event was emitted
    expect(mockEmit).toHaveBeenCalledWith('unblock-user-input', expect.objectContaining({
      reason: 'checkpoint-complete'
    }));
  });

  it('should wait for summarization to complete', async () => {
    // Add messages
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    // Start summarization (don't await)
    const summarizationPromise = compressionCoordinator.handleAutoThreshold();
    
    // Wait for summarization
    const waitPromise = compressionCoordinator.waitForSummarization();
    
    // Both should complete
    await Promise.all([summarizationPromise, waitPromise]);
    
    expect(compressionCoordinator.isSummarizationInProgress()).toBe(false);
  });

  it('should timeout if summarization takes too long', async () => {
    // Mock a slow compression
    const slowCompressionService = {
      compress: vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          summary: {
            id: 'summary-1',
            role: 'system',
            content: 'Test summary',
            timestamp: new Date()
          },
          preserved: [],
          originalTokens: 1000,
          compressedTokens: 500,
          compressionRatio: 0.5,
          status: 'compressed'
        }), 5000)) // 5 seconds
      )
    };
    
    // Create new coordinator with slow service
    const slowCoordinator = new CompressionCoordinator({
      ...compressionCoordinator as any,
      compressionService: slowCompressionService as any
    });
    
    // Add messages
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    // Start summarization (don't await)
    const summarizationPromise = slowCoordinator.handleAutoThreshold();
    
    // Wait with short timeout (100ms)
    const start = Date.now();
    await slowCoordinator.waitForSummarization(100);
    const elapsed = Date.now() - start;
    
    // Should timeout quickly (not wait 5 seconds)
    expect(elapsed).toBeLessThan(200);
    
    // Clean up
    await summarizationPromise;
  });

  it('should not wait if no summarization in progress', async () => {
    const start = Date.now();
    await compressionCoordinator.waitForSummarization();
    const elapsed = Date.now() - start;
    
    // Should return immediately
    expect(elapsed).toBeLessThan(10);
  });

  it('should clear flag even if summarization fails', async () => {
    // Mock compression failure
    const failingCompressionService = {
      compress: vi.fn().mockRejectedValue(new Error('Compression failed'))
    };
    
    const failingCoordinator = new CompressionCoordinator({
      ...compressionCoordinator as any,
      compressionService: failingCompressionService as any
    });
    
    // Add messages
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    // Summarization should fail but not throw
    await failingCoordinator.handleAutoThreshold();
    
    // Flag should still be cleared
    expect(failingCoordinator.isSummarizationInProgress()).toBe(false);
    
    // Unblock event should still be emitted
    expect(mockEmit).toHaveBeenCalledWith('unblock-user-input', expect.objectContaining({
      reason: 'checkpoint-complete'
    }));
  });

  it('should handle multiple concurrent wait calls', async () => {
    // Add messages
    for (let i = 0; i < 15; i++) {
      mockContext.messages.push({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i}`,
        timestamp: new Date()
      });
    }
    
    // Start summarization (don't await)
    const summarizationPromise = compressionCoordinator.handleAutoThreshold();
    
    // Multiple wait calls
    const wait1 = compressionCoordinator.waitForSummarization();
    const wait2 = compressionCoordinator.waitForSummarization();
    const wait3 = compressionCoordinator.waitForSummarization();
    
    // All should complete
    await Promise.all([summarizationPromise, wait1, wait2, wait3]);
    
    expect(compressionCoordinator.isSummarizationInProgress()).toBe(false);
  });
});
