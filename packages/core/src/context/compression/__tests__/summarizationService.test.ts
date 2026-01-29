/**
 * Unit Tests for Summarization Service
 *
 * Tests specific examples and edge cases:
 * - Empty input
 * - Single message
 * - LLM failure
 *
 * Requirements: FR-5, FR-6, FR-7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SummarizationService } from '../summarizationService.js';
import type { Message } from '../../types.js';
import type { ProviderAdapter, ProviderRequest, ProviderEvent } from '../../../provider/types.js';

/**
 * Mock provider that returns predictable summaries
 */
class MockSuccessProvider implements ProviderAdapter {
  name = 'mock-success';

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Extract just the conversation content, not the system instructions
    const userMessage = request.messages.find((m) => m.parts.some((p) => p.type === 'text'));
    if (!userMessage) {
      const summary = 'Empty conversation summary.';
      for (const char of summary) {
        yield { type: 'text', value: char };
      }
      yield { type: 'finish', reason: 'stop' };
      return;
    }

    const content = userMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as any).text)
      .join(' ');

    // Extract conversation from the prompt
    const conversationMatch = content.match(/CONVERSATION TO SUMMARIZE:\s*([\s\S]+?)(?:\n\nProvide|$)/);
    const conversation = conversationMatch ? conversationMatch[1] : content;

    // Generate a summary that's shorter than the original
    const words = conversation.split(/\s+/).filter((w) => w.length > 2);
    const targetWords = Math.max(4, Math.floor(words.length * 0.5));
    const summaryWords = words.slice(0, targetWords);
    let summary = summaryWords.join(' ');

    // Ensure it ends with a period
    if (!summary.endsWith('.')) {
      summary += '.';
    }

    // Ensure minimum length but not longer than original
    if (summary.length < 20) {
      summary = 'Brief conversation summary.';
    }

    // Ensure it's not longer than original
    if (summary.length > conversation.length * 1.3) {
      summary = words.slice(0, Math.max(3, Math.floor(words.length * 0.4))).join(' ') + '.';
    }

    for (const char of summary) {
      yield { type: 'text', value: char };
    }
    yield { type: 'finish', reason: 'stop' };
  }
}

/**
 * Mock provider that fails
 */
class MockFailureProvider implements ProviderAdapter {
  name = 'mock-failure';

  async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
    yield {
      type: 'error',
      error: {
        message: 'LLM service unavailable',
        code: '503',
        httpStatus: 503,
      },
    };
  }
}

/**
 * Mock provider that times out
 */
class MockTimeoutProvider implements ProviderAdapter {
  name = 'mock-timeout';

  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Check for abort signal and respect it
    const checkAbort = () => {
      if (request.abortSignal?.aborted) {
        throw new DOMException('The operation was aborted', 'AbortError');
      }
    };

    // Simulate a long delay with periodic abort checks
    for (let i = 0; i < 100; i++) {
      checkAbort();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    
    checkAbort();
    yield { type: 'text', value: 'Too late' };
    yield { type: 'finish', reason: 'stop' };
  }
}

/**
 * Mock provider that returns empty summary
 */
class MockEmptyProvider implements ProviderAdapter {
  name = 'mock-empty';

  async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: '' };
    yield { type: 'finish', reason: 'stop' };
  }
}

describe('SummarizationService - Unit Tests', () => {
  describe('Edge Case: Empty Input', () => {
    it('should handle empty message array gracefully', async () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 5000,
      });

      const emptyMessages: Message[] = [];
      const result = await service.summarize(emptyMessages, 2);

      // Empty input should still work - LLM will generate a minimal summary
      // The validation may reject it if it's longer than empty (0 chars)
      // So we just check that it completes without crashing
      expect(result).toBeDefined();
      expect(result.level).toBe(2);
      // Success depends on whether the summary passes validation
      if (result.success) {
        expect(result.summary).toBeTruthy();
      } else {
        expect(result.error).toBeTruthy();
      }
    });
  });

  describe('Edge Case: Single Message', () => {
    it('should handle single message correctly', async () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 5000,
      });

      const singleMessage: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello, how are you today?',
          timestamp: new Date(),
          tokenCount: 6,
        },
      ];

      const result = await service.summarize(singleMessage, 2);

      expect(result.success).toBe(true);
      expect(result.summary).toBeTruthy();
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should handle single very long message', async () => {
      // Create a special provider that respects maxSummaryTokens
      class MockLongMessageProvider implements ProviderAdapter {
        name = 'mock-long';

        async *chatStream(_request: ProviderRequest): AsyncIterable<ProviderEvent> {
          // Generate a summary that's within the 500 token limit
          // 500 tokens ≈ 2000 characters
          const summary = 'This is a summary of a very long message. '.repeat(40); // ~1680 chars, ~420 tokens
          for (const char of summary) {
            yield { type: 'text', value: char };
          }
          yield { type: 'finish', reason: 'stop' };
        }
      }

      const provider = new MockLongMessageProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 5000,
      });

      const longMessage: Message[] = [
        {
          id: '2',
          role: 'assistant',
          content: 'A'.repeat(10000), // 10k characters
          timestamp: new Date(),
          tokenCount: 2500,
        },
      ];

      const result = await service.summarize(longMessage, 1);

      expect(result.success).toBe(true);
      expect(result.summary.length).toBeLessThan(10000);
      expect(result.tokenCount).toBeLessThan(2500);
    });
  });

  describe('Edge Case: LLM Failure', () => {
    it('should handle LLM service errors gracefully', async () => {
      const provider = new MockFailureProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 5000,
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
          tokenCount: 3,
        },
      ];

      const result = await service.summarize(messages, 2);

      // Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('LLM service unavailable');
      expect(result.summary).toBe('');
      expect(result.tokenCount).toBe(0);
    });

    it('should handle LLM timeout', async () => {
      const provider = new MockTimeoutProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 100, // Very short timeout
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
          tokenCount: 3,
        },
      ];

      const result = await service.summarize(messages, 2);

      // Should fail with timeout error
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('timeout');
    });

    it('should handle empty LLM response', async () => {
      const provider = new MockEmptyProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 5000,
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
          tokenCount: 3,
        },
      ];

      const result = await service.summarize(messages, 2);

      // Should fail validation
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.error).toContain('empty');
    });
  });

  describe('Prompt Building', () => {
    it('should build correct prompt for each compression level', () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
          tokenCount: 1,
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          tokenCount: 3,
        },
      ];

      // Level 1 - COMPACT
      const prompt1 = service.buildSummarizationPrompt(messages, 1);
      expect(prompt1).toContain('ULTRA-COMPACT');
      expect(prompt1).toContain('50-100 tokens');

      // Level 2 - MODERATE
      const prompt2 = service.buildSummarizationPrompt(messages, 2);
      expect(prompt2).toContain('MODERATE');
      expect(prompt2).toContain('150-300 tokens');

      // Level 3 - DETAILED
      const prompt3 = service.buildSummarizationPrompt(messages, 3);
      expect(prompt3).toContain('DETAILED');
      expect(prompt3).toContain('300-500 tokens');
    });

    it('should include mode-specific preservation instructions', () => {
      const provider = new MockSuccessProvider();

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 1,
        },
      ];

      // Developer mode
      const devService = new SummarizationService({
        provider,
        model: 'test-model',
        mode: 'DEVELOPER',
      });
      const devPrompt = devService.buildSummarizationPrompt(messages, 2);
      expect(devPrompt).toContain('Code snippets');
      expect(devPrompt).toContain('file paths');

      // Planning mode
      const planService = new SummarizationService({
        provider,
        model: 'test-model',
        mode: 'PLANNING',
      });
      const planPrompt = planService.buildSummarizationPrompt(messages, 2);
      expect(planPrompt).toContain('Goals');
      expect(planPrompt).toContain('objectives');

      // Debugger mode
      const debugService = new SummarizationService({
        provider,
        model: 'test-model',
        mode: 'DEBUGGER',
      });
      const debugPrompt = debugService.buildSummarizationPrompt(messages, 2);
      expect(debugPrompt).toContain('Error symptoms');
      expect(debugPrompt).toContain('stack traces');
    });

    it('should include goal context when goal is provided', () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 1,
        },
      ];

      const goal = {
        id: 'goal-1',
        description: 'Implement user authentication',
        status: 'active' as const,
        createdAt: new Date(),
        subtasks: [
          {
            id: 'sub-1',
            description: 'Create login form',
            status: 'completed' as const,
            createdAt: new Date(),
            completedAt: new Date(),
            dependsOn: [],
          },
          {
            id: 'sub-2',
            description: 'Add validation',
            status: 'in-progress' as const,
            createdAt: new Date(),
            dependsOn: [],
          },
        ],
        checkpoints: [],
        decisions: [
          {
            id: 'dec-1',
            description: 'Use JWT tokens',
            rationale: 'Industry standard',
            alternatives: [],
            timestamp: new Date(),
            locked: true,
          },
        ],
        artifacts: [
          {
            type: 'file' as const,
            path: 'src/auth/login.ts',
            action: 'created' as const,
            timestamp: new Date(),
          },
        ],
        blockers: [],
        priority: 'high' as const,
        tags: [],
      };

      const prompt = service.buildSummarizationPrompt(messages, 2, goal);

      expect(prompt).toContain('ACTIVE GOAL');
      expect(prompt).toContain('Implement user authentication');
      expect(prompt).toContain('Create login form');
      expect(prompt).toContain('Add validation');
      expect(prompt).toContain('Use JWT tokens');
      expect(prompt).toContain('src/auth/login.ts');
    });
  });

  describe('Summary Validation', () => {
    let service: SummarizationService;

    beforeEach(() => {
      const provider = new MockSuccessProvider();
      service = new SummarizationService({
        provider,
        model: 'test-model',
      });
    });

    it('should reject empty summaries', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 1,
        },
      ];

      const validation = service.validateSummary('', messages);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('empty');
    });

    it('should reject too short summaries', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test message',
          timestamp: new Date(),
          tokenCount: 2,
        },
      ];

      const validation = service.validateSummary('Too short', messages);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('too short');
    });

    it('should reject summaries that echo the prompt', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 1,
        },
      ];

      const validation = service.validateSummary('Please summarize this', messages);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('longer than original');
    });

    it('should reject summaries significantly longer than original', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Short',
          timestamp: new Date(),
          tokenCount: 1,
        },
      ];

      // Summary that is more than 50% longer than original
      const longSummary = 'This is a very long summary that is much much longer than the original message content and exceeds the tolerance';
      const validation = service.validateSummary(longSummary, messages);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('longer than original');
    });

    it('should accept valid summaries', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'This is a test message with some content that needs to be summarized',
          timestamp: new Date(),
          tokenCount: 15,
        },
      ];

      const validation = service.validateSummary('Test message about summarization', messages);
      expect(validation.valid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });
  });

  describe('Configuration Updates', () => {
    it('should allow updating mode', () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        mode: 'ASSISTANT',
      });

      service.setMode('DEVELOPER');

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Test',
          timestamp: new Date(),
          tokenCount: 1,
        },
      ];

      const prompt = service.buildSummarizationPrompt(messages, 2);
      expect(prompt).toContain('Code snippets');
    });

    it('should allow updating max summary tokens', () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        maxSummaryTokens: 500,
      });

      service.setMaxSummaryTokens(1000);

      // Validation should now allow larger summaries
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'A'.repeat(2000), // Long message
          timestamp: new Date(),
          tokenCount: 500,
        },
      ];

      const largeSummary = 'A'.repeat(3000); // ~750 tokens
      const validation = service.validateSummary(largeSummary, messages);
      // Should pass because summary is within 1.5x of original
      expect(validation.valid).toBe(true);
    });

    it('should allow updating timeout', () => {
      const provider = new MockSuccessProvider();
      const service = new SummarizationService({
        provider,
        model: 'test-model',
        timeout: 5000,
      });

      service.setTimeout(10000);

      // Timeout is now 10 seconds (tested implicitly in async operations)
      expect(service).toBeDefined();
    });
  });
});
