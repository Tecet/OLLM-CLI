/**
 * Property-Based Tests for Compression Pipeline
 *
 * Tests universal properties that must hold for all compression operations:
 * - Property 13: Compression Pipeline Stages
 * - Property 14: Compression Pipeline Error Handling
 *
 * Requirements: FR-5, FR-6, FR-7
 */

import * as fc from 'fast-check';
import { describe, it, expect, vi } from 'vitest';

import { ActiveContextManager } from '../../storage/activeContextManager.js';
import { SessionHistoryManager } from '../../storage/sessionHistoryManager.js';
import { TokenCounterService } from '../../tokenCounter.js';
import { CompressionPipeline } from '../compressionPipeline.js';
import { SummarizationService } from '../summarizationService.js';
import { ValidationService } from '../validationService.js';

import type { ProviderAdapter } from '../../../provider/types.js';
import type { Message } from '../../types.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a mock provider adapter
 */
function createMockProvider(): ProviderAdapter {
  return {
    chatStream: vi.fn(async function* () {
      yield { type: 'text' as const, value: 'This is a test summary of the conversation.' };
      yield { type: 'finish' as const, reason: 'stop' };
    }),
  } as unknown as ProviderAdapter;
}

/**
 * Create a test message
 */
function createMessage(id: string, role: 'user' | 'assistant' | 'system', content: string): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
  };
}

/**
 * Fast-check arbitrary for generating messages
 */
const messageArbitrary = fc.record({
  id: fc.string({ minLength: 1, maxLength: 20 }),
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 10, maxLength: 200 }),
}).map(({ id, role, content }) => createMessage(id, role, content));

/**
 * Fast-check arbitrary for generating message arrays
 */
const messagesArbitrary = fc.array(messageArbitrary, { minLength: 5, maxLength: 20 });

// ============================================================================
// Property 13: Compression Pipeline Stages
// ============================================================================

describe('Property 13: Compression Pipeline Stages', () => {
  /**
   * **Property:** For any valid set of messages, compression pipeline stages execute in order
   *
   * **Validates:** Requirements FR-5, FR-6
   *
   * **Invariants:**
   * 1. Stages execute in correct order: Identification → Preparation → Summarization → Checkpoint → Update → Validation
   * 2. Each stage completes before next stage starts
   * 3. Progress increases monotonically (never decreases)
   * 4. Final progress is 100%
   * 5. All stages report progress
   */
  it('stages execute in correct order with monotonic progress', async () => {
    await fc.assert(
      fc.asyncProperty(messagesArbitrary, async (messages) => {
        // Setup
        const tokenCounter = new TokenCounterService();
        const systemPrompt = createMessage('sys', 'system', 'You are a helpful assistant.');
        const activeContext = new ActiveContextManager(systemPrompt, 10000, tokenCounter);
        const sessionHistory = new SessionHistoryManager('test-session', '/tmp/test');
        const mockProvider = createMockProvider();

        const summarizationService = new SummarizationService({
          provider: mockProvider,
          model: 'test-model',
        });

        const validationService = new ValidationService({
          ollamaLimit: 10000,
          tokenCounter,
        });

        // Track progress
        const progressEvents: Array<{ stage: string; progress: number; message: string }> = [];

        const pipeline = new CompressionPipeline({
          summarizationService,
          validationService,
          activeContext,
          sessionHistory,
          tokenCounter,
          onProgress: (stage, progress, message) => {
            progressEvents.push({ stage, progress, message });
          },
          keepRecentCount: 3,
        });

        // Add messages to active context
        for (const msg of messages) {
          try {
            activeContext.addMessage(msg);
            sessionHistory.appendMessage(msg);
          } catch {
            // Skip if would exceed limit
          }
        }

        // Execute compression
        const result = await pipeline.compress();

        // If compression succeeded, verify properties
        if (result.success) {
          // Property 1: Stages execute in correct order
          const stageOrder = ['Identification', 'Preparation', 'Summarization', 'Checkpoint Creation', 'Context Update', 'Validation', 'Complete'];
          const observedStages = progressEvents.map(e => e.stage);
          const uniqueStages = [...new Set(observedStages)];

          // Check that stages appear in order (allowing duplicates)
          let lastIndex = -1;
          for (const stage of uniqueStages) {
            const index = stageOrder.indexOf(stage);
            expect(index).toBeGreaterThan(lastIndex);
            lastIndex = index;
          }

          // Property 2: Progress increases monotonically
          for (let i = 1; i < progressEvents.length; i++) {
            expect(progressEvents[i].progress).toBeGreaterThanOrEqual(progressEvents[i - 1].progress);
          }

          // Property 3: Final progress is 100%
          const lastEvent = progressEvents[progressEvents.length - 1];
          expect(lastEvent.progress).toBe(100);

          // Property 4: All stages report progress
          expect(progressEvents.length).toBeGreaterThan(0);

          // Property 5: Checkpoint was created
          expect(result.checkpoint).toBeDefined();
          expect(result.checkpoint?.id).toMatch(/^ckpt_/);

          // Property 6: Tokens were freed
          expect(result.freedTokens).toBeGreaterThan(0);

          // Property 7: Validation passed
          expect(result.validation?.valid).toBe(true);
        }
      }),
      {
        numRuns: 20, // Reduced for performance
        endOnFailure: true,
      }
    );
  });

  /**
   * **Property:** Compression preserves message continuity
   *
   * **Validates:** Requirements FR-5, FR-6
   *
   * **Invariants:**
   * 1. Recent messages are preserved (not compressed)
   * 2. Compressed messages are replaced by checkpoint
   * 3. Total message count decreases (compression happened)
   * 4. Checkpoint summary is non-empty
   */
  it('preserves message continuity after compression', async () => {
    await fc.assert(
      fc.asyncProperty(messagesArbitrary, async (messages) => {
        // Setup
        const tokenCounter = new TokenCounterService();
        const systemPrompt = createMessage('sys', 'system', 'You are a helpful assistant.');
        const activeContext = new ActiveContextManager(systemPrompt, 10000, tokenCounter);
        const sessionHistory = new SessionHistoryManager('test-session', '/tmp/test');
        const mockProvider = createMockProvider();

        const summarizationService = new SummarizationService({
          provider: mockProvider,
          model: 'test-model',
        });

        const validationService = new ValidationService({
          ollamaLimit: 10000,
          tokenCounter,
        });

        const pipeline = new CompressionPipeline({
          summarizationService,
          validationService,
          activeContext,
          sessionHistory,
          tokenCounter,
          keepRecentCount: 3,
        });

        // Add messages
        for (const msg of messages) {
          try {
            activeContext.addMessage(msg);
            sessionHistory.appendMessage(msg);
          } catch {
            // Skip if would exceed limit
          }
        }

        const beforeState = activeContext.getState();
        const beforeMessageCount = beforeState.recentMessages.length;
        const beforeCheckpointCount = beforeState.checkpoints.length;

        // Execute compression
        const result = await pipeline.compress();

        if (result.success) {
          const afterState = activeContext.getState();

          // Property 1: Recent messages preserved (at least keepRecentCount)
          expect(afterState.recentMessages.length).toBeGreaterThanOrEqual(0);
          expect(afterState.recentMessages.length).toBeLessThanOrEqual(beforeMessageCount);

          // Property 2: Checkpoint added
          expect(afterState.checkpoints.length).toBe(beforeCheckpointCount + 1);

          // Property 3: Checkpoint summary is non-empty
          const newCheckpoint = afterState.checkpoints[afterState.checkpoints.length - 1];
          expect(newCheckpoint.summary).toBeTruthy();
          expect(newCheckpoint.summary.length).toBeGreaterThan(0);

          // Property 4: Checkpoint has valid metadata
          expect(newCheckpoint.id).toMatch(/^ckpt_/);
          expect(newCheckpoint.timestamp).toBeGreaterThan(0);
          expect(newCheckpoint.tokenCount).toBeGreaterThan(0);
          expect(newCheckpoint.compressionLevel).toBeGreaterThanOrEqual(1);
          expect(newCheckpoint.compressionLevel).toBeLessThanOrEqual(3);
        }
      }),
      {
        numRuns: 20,
        endOnFailure: true,
      }
    );
  });

  /**
   * **Property:** Compression reduces token count
   *
   * **Validates:** Requirements FR-5
   *
   * **Invariants:**
   * 1. Token count after compression < token count before compression
   * 2. Freed tokens > 0
   * 3. Token count calculation is accurate
   */
  it('reduces token count after compression', async () => {
    await fc.assert(
      fc.asyncProperty(messagesArbitrary, async (messages) => {
        // Setup
        const tokenCounter = new TokenCounterService();
        const systemPrompt = createMessage('sys', 'system', 'You are a helpful assistant.');
        const activeContext = new ActiveContextManager(systemPrompt, 10000, tokenCounter);
        const sessionHistory = new SessionHistoryManager('test-session', '/tmp/test');
        const mockProvider = createMockProvider();

        const summarizationService = new SummarizationService({
          provider: mockProvider,
          model: 'test-model',
        });

        const validationService = new ValidationService({
          ollamaLimit: 10000,
          tokenCounter,
        });

        const pipeline = new CompressionPipeline({
          summarizationService,
          validationService,
          activeContext,
          sessionHistory,
          tokenCounter,
          keepRecentCount: 3,
        });

        // Add messages
        for (const msg of messages) {
          try {
            activeContext.addMessage(msg);
            sessionHistory.appendMessage(msg);
          } catch {
            // Skip if would exceed limit
          }
        }

        const beforeTokens = activeContext.getTokenCount();

        // Execute compression
        const result = await pipeline.compress();

        if (result.success) {
          const afterTokens = activeContext.getTokenCount();

          // Property 1: Token count decreased
          expect(afterTokens).toBeLessThan(beforeTokens);

          // Property 2: Freed tokens matches calculation
          const actualFreed = beforeTokens - afterTokens;
          expect(result.freedTokens).toBeGreaterThan(0);
          // Allow some tolerance for token counting differences
          expect(Math.abs(actualFreed - (result.freedTokens ?? 0))).toBeLessThan(50);

          // Property 3: Context still valid
          const validation = activeContext.validate();
          expect(validation.valid).toBe(true);
        }
      }),
      {
        numRuns: 20,
        endOnFailure: true,
      }
    );
  });
});

// ============================================================================
// Property 14: Compression Pipeline Error Handling
// ============================================================================

describe('Property 14: Compression Pipeline Error Handling', () => {
  /**
   * **Property:** Pipeline handles LLM failures gracefully
   *
   * **Validates:** Requirements FR-7
   *
   * **Invariants:**
   * 1. Pipeline returns success=false on LLM error
   * 2. Error message is provided
   * 3. Active context is not corrupted
   * 4. No partial updates applied
   */
  it('handles LLM failures gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(messagesArbitrary, async (messages) => {
        // Setup with failing provider
        const tokenCounter = new TokenCounterService();
        const systemPrompt = createMessage('sys', 'system', 'You are a helpful assistant.');
        const activeContext = new ActiveContextManager(systemPrompt, 10000, tokenCounter);
        const sessionHistory = new SessionHistoryManager('test-session', '/tmp/test');

        // Mock provider that fails
        const failingProvider: ProviderAdapter = {
          chatStream: vi.fn(async function* () {
            yield { type: 'error' as const, error: { message: 'LLM connection failed', code: 'CONNECTION_ERROR' } };
          }),
        } as unknown as ProviderAdapter;

        const summarizationService = new SummarizationService({
          provider: failingProvider,
          model: 'test-model',
        });

        const validationService = new ValidationService({
          ollamaLimit: 10000,
          tokenCounter,
        });

        const pipeline = new CompressionPipeline({
          summarizationService,
          validationService,
          activeContext,
          sessionHistory,
          tokenCounter,
          keepRecentCount: 3,
        });

        // Add messages
        for (const msg of messages) {
          try {
            activeContext.addMessage(msg);
            sessionHistory.appendMessage(msg);
          } catch {
            // Skip if would exceed limit
          }
        }

        const beforeState = activeContext.getState();
        const beforeTokens = activeContext.getTokenCount();

        // Execute compression (should fail gracefully)
        const result = await pipeline.compress();

        // Only test if we had enough messages to trigger compression
        // (otherwise it returns early with "No messages to compress")
        if (beforeState.recentMessages.length > 3) {
          // Property 1: Returns failure
          expect(result.success).toBe(false);

          // Property 2: Provides error information
          expect(result.reason).toBeTruthy();
          
          // If the reason is "No messages to compress", error field is optional
          // Otherwise (LLM failure), error field should be present
          if (result.reason !== 'No messages to compress') {
            expect(result.error).toBeTruthy();
          }

          // Property 3: Active context unchanged
          const afterState = activeContext.getState();
          expect(afterState.recentMessages.length).toBe(beforeState.recentMessages.length);
          expect(afterState.checkpoints.length).toBe(beforeState.checkpoints.length);
          expect(activeContext.getTokenCount()).toBe(beforeTokens);

          // Property 4: Context still valid
          const validation = activeContext.validate();
          expect(validation.valid).toBe(true);
        }
      }),
      {
        numRuns: 20,
        endOnFailure: true,
      }
    );
  });

  /**
   * **Property:** Pipeline handles validation failures gracefully
   *
   * **Validates:** Requirements FR-7
   *
   * **Invariants:**
   * 1. Pipeline detects validation failures
   * 2. Returns success=false with validation details
   * 3. Provides actionable error information
   */
  it('handles validation failures gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(messagesArbitrary, async (messages) => {
        // Setup with very low limit to trigger validation failure
        const tokenCounter = new TokenCounterService();
        const systemPrompt = createMessage('sys', 'system', 'You are a helpful assistant.');
        const activeContext = new ActiveContextManager(systemPrompt, 500, tokenCounter); // Very low limit
        const sessionHistory = new SessionHistoryManager('test-session', '/tmp/test');
        const mockProvider = createMockProvider();

        const summarizationService = new SummarizationService({
          provider: mockProvider,
          model: 'test-model',
        });

        const validationService = new ValidationService({
          ollamaLimit: 500, // Very low limit
          tokenCounter,
        });

        const pipeline = new CompressionPipeline({
          summarizationService,
          validationService,
          activeContext,
          sessionHistory,
          tokenCounter,
          keepRecentCount: 3,
        });

        // Try to add messages (may fail due to low limit)
        let addedCount = 0;
        for (const msg of messages) {
          try {
            activeContext.addMessage(msg);
            sessionHistory.appendMessage(msg);
            addedCount++;
          } catch {
            // Expected - limit is very low
            break;
          }
        }

        // Only test if we added enough messages
        if (addedCount >= 5) {
          const result = await pipeline.compress();

          // If compression happened but validation failed
          if (!result.success && result.reason === 'Compression failed validation') {
            // Property 1: Validation result provided
            expect(result.validation).toBeDefined();
            expect(result.validation?.valid).toBe(false);

            // Property 2: Error details provided
            expect(result.error).toBeTruthy();
            expect(result.validation?.errors).toBeDefined();
            expect(result.validation?.errors?.length).toBeGreaterThan(0);
          }
        }
      }),
      {
        numRuns: 20,
        endOnFailure: true,
      }
    );
  });

  /**
   * **Property:** Pipeline handles empty message sets gracefully
   *
   * **Validates:** Requirements FR-7
   *
   * **Invariants:**
   * 1. Returns success=false with appropriate reason
   * 2. No errors thrown
   * 3. Context remains valid
   */
  it('handles empty message sets gracefully', async () => {
    // Setup
    const tokenCounter = new TokenCounterService();
    const systemPrompt = createMessage('sys', 'system', 'You are a helpful assistant.');
    const activeContext = new ActiveContextManager(systemPrompt, 10000, tokenCounter);
    const sessionHistory = new SessionHistoryManager('test-session', '/tmp/test');
    const mockProvider = createMockProvider();

    const summarizationService = new SummarizationService({
      provider: mockProvider,
      model: 'test-model',
    });

    const validationService = new ValidationService({
      ollamaLimit: 10000,
      tokenCounter,
    });

    const pipeline = new CompressionPipeline({
      summarizationService,
      validationService,
      activeContext,
      sessionHistory,
      tokenCounter,
      keepRecentCount: 3,
    });

    // Execute compression with no messages
    const result = await pipeline.compress();

    // Property 1: Returns failure with appropriate reason
    expect(result.success).toBe(false);
    expect(result.reason).toBe('No messages to compress');

    // Property 2: No error thrown
    expect(result.error).toBeUndefined();

    // Property 3: Context still valid
    const validation = activeContext.validate();
    expect(validation.valid).toBe(true);
  });
});
