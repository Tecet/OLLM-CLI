/**
 * Reasoning Manager Tests
 * 
 * Tests for reasoning trace management including:
 * - Trace addition
 * - Structured data extraction
 * - Storage management (recent + archived)
 * - Trace retrieval
 * - Serialization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReasoningManagerImpl } from '../reasoningManager.js';
import type { ReasoningConfig } from '../reasoningTypes.js';

describe('ReasoningManager', () => {
  let reasoningManager: ReasoningManagerImpl;
  const config: ReasoningConfig = {
    enabled: true,
    keepRecentTraces: 5,
    maxArchivedTraces: 20,
    autoExtractStructured: true
  };

  beforeEach(() => {
    reasoningManager = new ReasoningManagerImpl(config);
  });

  describe('Trace Addition', () => {
    it('should add a reasoning trace', () => {
      const trace = reasoningManager.addTrace(
        'msg-123',
        'Let me think about this problem...',
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace).toBeDefined();
      expect(trace.id).toBeDefined();
      expect(trace.messageId).toBe('msg-123');
      expect(trace.thinking).toBe('Let me think about this problem...');
      expect(trace.metadata.modelName).toBe('deepseek-r1');
      expect(trace.metadata.thinkingTokens).toBe(100);
      expect(trace.metadata.answerTokens).toBe(50);
    });

    it('should add trace with context', () => {
      const trace = reasoningManager.addTrace(
        'msg-123',
        'Thinking...',
        'qwq',
        100,
        50,
        {
          goalId: 'goal-456',
          checkpointId: 'checkpoint-789',
          userMessageId: 'user-msg-111'
        }
      );
      
      expect(trace.context.goalId).toBe('goal-456');
      expect(trace.context.checkpointId).toBe('checkpoint-789');
      expect(trace.context.userMessageId).toBe('user-msg-111');
    });
  });

  describe('Structured Data Extraction', () => {
    it('should extract alternatives from thinking', () => {
      const thinking = `
        Alternative 1: Use a hash map for O(1) lookup
        Alternative 2: Use a binary search tree
        Option 3: Use a simple array with linear search
      `;
      
      const trace = reasoningManager.addTrace(
        'msg-123',
        thinking,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace.structured).toBeDefined();
      expect(trace.structured?.alternatives.length).toBeGreaterThan(0);
    });

    it('should extract chosen approach', () => {
      const thinking = `
        Alternative 1: Use a hash map
        Alternative 2: Use an array
        
        I've chosen: Use a hash map for better performance
      `;
      
      const trace = reasoningManager.addTrace(
        'msg-123',
        thinking,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace.structured?.chosenApproach).toContain('hash map');
    });

    it('should extract rationale', () => {
      const thinking = `
        I'll use a hash map.
        Rationale: Hash maps provide O(1) lookup time which is optimal for this use case.
      `;
      
      const trace = reasoningManager.addTrace(
        'msg-123',
        thinking,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace.structured?.rationale).toContain('O(1) lookup');
    });

    it('should extract key insights', () => {
      const thinking = `
        Key: The bottleneck is in the lookup operation
        Important: We need to optimize for read performance
        Insight: Caching can reduce database calls by 80%
      `;
      
      const trace = reasoningManager.addTrace(
        'msg-123',
        thinking,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace.structured?.keyInsights.length).toBeGreaterThan(0);
    });

    it('should estimate confidence level', () => {
      const thinkingConfident = 'I am confident this is the right approach.';
      const trace1 = reasoningManager.addTrace(
        'msg-123',
        thinkingConfident,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace1.structured?.confidence).toBeGreaterThanOrEqual(50);
      
      const thinkingUncertain = 'I am uncertain about this approach.';
      const trace2 = reasoningManager.addTrace(
        'msg-456',
        thinkingUncertain,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace2.structured?.confidence).toBeLessThanOrEqual(50);
    });
  });

  describe('Storage Management', () => {
    it('should keep recent traces', () => {
      for (let i = 0; i < 3; i++) {
        reasoningManager.addTrace(
          `msg-${i}`,
          `Thinking ${i}`,
          'deepseek-r1',
          100,
          50
        );
      }
      
      const storage = reasoningManager.getReasoningStorage();
      expect(storage.recent).toHaveLength(3);
      expect(storage.archived).toHaveLength(0);
    });

    it('should archive old traces', () => {
      // Add more traces than keepRecentTraces
      for (let i = 0; i < 10; i++) {
        reasoningManager.addTrace(
          `msg-${i}`,
          `Thinking ${i}`,
          'deepseek-r1',
          100,
          50
        );
      }
      
      const storage = reasoningManager.getReasoningStorage();
      expect(storage.recent).toHaveLength(config.keepRecentTraces);
      expect(storage.archived.length).toBeGreaterThan(0);
    });

    it('should limit archived traces', () => {
      // Add many more traces than limits
      for (let i = 0; i < 50; i++) {
        reasoningManager.addTrace(
          `msg-${i}`,
          `Thinking ${i}`,
          'deepseek-r1',
          100,
          50
        );
      }
      
      const storage = reasoningManager.getReasoningStorage();
      expect(storage.archived.length).toBeLessThanOrEqual(config.maxArchivedTraces);
    });

    it('should calculate total thinking tokens', () => {
      reasoningManager.addTrace('msg-1', 'Thinking 1', 'deepseek-r1', 100, 50);
      reasoningManager.addTrace('msg-2', 'Thinking 2', 'deepseek-r1', 150, 75);
      reasoningManager.addTrace('msg-3', 'Thinking 3', 'deepseek-r1', 200, 100);
      
      const storage = reasoningManager.getReasoningStorage();
      expect(storage.totalThinkingTokens).toBe(450);
    });
  });

  describe('Trace Retrieval', () => {
    beforeEach(() => {
      reasoningManager.addTrace('msg-1', 'Thinking 1', 'deepseek-r1', 100, 50, {
        goalId: 'goal-1'
      });
      reasoningManager.addTrace('msg-2', 'Thinking 2', 'deepseek-r1', 100, 50, {
        goalId: 'goal-1'
      });
      reasoningManager.addTrace('msg-3', 'Thinking 3', 'deepseek-r1', 100, 50, {
        goalId: 'goal-2'
      });
    });

    it('should get trace by ID', () => {
      const storage = reasoningManager.getReasoningStorage();
      const traceId = storage.recent[0].id;
      
      const trace = reasoningManager.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace?.id).toBe(traceId);
    });

    it('should get traces for goal', () => {
      const traces = reasoningManager.getTracesForGoal('goal-1');
      expect(traces).toHaveLength(2);
      expect(traces.every(t => t.context.goalId === 'goal-1')).toBe(true);
    });

    it('should get traces for message', () => {
      const traces = reasoningManager.getTracesForMessage('msg-1');
      expect(traces).toHaveLength(1);
      expect(traces[0].messageId).toBe('msg-1');
    });

    it('should return empty array for non-existent goal', () => {
      const traces = reasoningManager.getTracesForGoal('non-existent');
      expect(traces).toHaveLength(0);
    });
  });

  describe('Archived Traces', () => {
    it('should create summaries for archived traces', () => {
      const longThinking = 'This is a very long thinking process that should be summarized when archived. '.repeat(10);
      
      for (let i = 0; i < 10; i++) {
        reasoningManager.addTrace(
          `msg-${i}`,
          longThinking,
          'deepseek-r1',
          100,
          50
        );
      }
      
      const storage = reasoningManager.getReasoningStorage();
      expect(storage.archived.length).toBeGreaterThan(0);
      
      const archivedTrace = storage.archived[0];
      expect(archivedTrace.summary.length).toBeLessThan(longThinking.length);
      expect(archivedTrace.summary.length).toBeLessThanOrEqual(200);
    });

    it('should preserve key insights in archived traces', () => {
      const thinking = 'Key: This is an important insight that should be preserved';
      
      for (let i = 0; i < 10; i++) {
        reasoningManager.addTrace(
          `msg-${i}`,
          thinking,
          'deepseek-r1',
          100,
          50
        );
      }
      
      const storage = reasoningManager.getReasoningStorage();
      const archivedTrace = storage.archived[0];
      
      expect(archivedTrace.keyInsights.length).toBeGreaterThan(0);
    });
  });

  describe('Storage Restoration', () => {
    it('should restore reasoning storage', () => {
      reasoningManager.addTrace('msg-1', 'Thinking 1', 'deepseek-r1', 100, 50);
      reasoningManager.addTrace('msg-2', 'Thinking 2', 'deepseek-r1', 100, 50);
      
      const storage = reasoningManager.getReasoningStorage();
      
      const newManager = new ReasoningManagerImpl(config);
      newManager.restoreReasoningStorage(storage);
      
      const restoredStorage = newManager.getReasoningStorage();
      expect(restoredStorage.recent).toHaveLength(storage.recent.length);
      expect(restoredStorage.totalTraces).toBe(storage.totalTraces);
    });

    it('should clear all traces', () => {
      reasoningManager.addTrace('msg-1', 'Thinking 1', 'deepseek-r1', 100, 50);
      reasoningManager.addTrace('msg-2', 'Thinking 2', 'deepseek-r1', 100, 50);
      
      reasoningManager.clear();
      
      const storage = reasoningManager.getReasoningStorage();
      expect(storage.recent).toHaveLength(0);
      expect(storage.archived).toHaveLength(0);
      expect(storage.totalTraces).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty thinking content', () => {
      const trace = reasoningManager.addTrace(
        'msg-123',
        '',
        'deepseek-r1',
        0,
        50
      );
      
      expect(trace).toBeDefined();
      expect(trace.thinking).toBe('');
    });

    it('should handle very long thinking content', () => {
      const longThinking = 'Thinking... '.repeat(10000);
      
      const trace = reasoningManager.addTrace(
        'msg-123',
        longThinking,
        'deepseek-r1',
        10000,
        50
      );
      
      expect(trace).toBeDefined();
      expect(trace.thinking).toBe(longThinking);
    });

    it('should handle special characters in thinking', () => {
      const thinking = 'Thinking with <tags> and "quotes" and \'apostrophes\' and $pecial ch@rs!';
      
      const trace = reasoningManager.addTrace(
        'msg-123',
        thinking,
        'deepseek-r1',
        100,
        50
      );
      
      expect(trace.thinking).toBe(thinking);
    });
  });
});
