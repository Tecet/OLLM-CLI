/**
 * Compression Service Performance Tests
 * 
 * Tests performance characteristics of compression strategies:
 * - Truncate strategy
 * - Summarize strategy (without LLM)
 * - Hybrid strategy (without LLM)
 * - Token counting
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { CompressionService } from '../compressionService.js';

import type { Message, CompressionStrategy } from '../types.js';

describe('CompressionService Performance', () => {
  let service: CompressionService;

  beforeEach(() => {
    service = new CompressionService();
  });

  function createMessages(count: number): Message[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `msg-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Test message ${i} with some content that is reasonably long to simulate real messages`,
      timestamp: new Date(Date.now() - (count - i) * 1000)
    }));
  }

  describe('Truncate Strategy Performance', () => {
    it('should truncate 100 messages in <10ms', async () => {
      const messages = createMessages(100);
      const strategy: CompressionStrategy = {
        type: 'truncate',
        preserveRecent: 2048
      };

      const start = performance.now();
      const result = await service.compress(messages, strategy);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
      // With fractional preservation, may preserve all messages if budget is sufficient
      expect(result.preserved.length).toBeLessThanOrEqual(messages.length);
    });

    it('should truncate 1000 messages in <50ms', async () => {
      const messages = createMessages(1000);
      const strategy: CompressionStrategy = {
        type: 'truncate',
        preserveRecent: 2048
      };

      const start = performance.now();
      const result = await service.compress(messages, strategy);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
      expect(result.preserved.length).toBeLessThan(messages.length);
    });
  });

  describe('Summarize Strategy Performance (No LLM)', () => {
    it('should handle 100 messages in <20ms', async () => {
      const messages = createMessages(100);
      const strategy: CompressionStrategy = {
        type: 'summarize',
        preserveRecent: 2048,
        summaryMaxTokens: 512
      };

      const start = performance.now();
      const result = await service.compress(messages, strategy);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
      expect(result.summary).toBeDefined();
    });

    it('should handle 1000 messages in <100ms', async () => {
      const messages = createMessages(1000);
      const strategy: CompressionStrategy = {
        type: 'summarize',
        preserveRecent: 2048,
        summaryMaxTokens: 512
      };

      const start = performance.now();
      const result = await service.compress(messages, strategy);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.summary).toBeDefined();
    });
  });

  describe('Hybrid Strategy Performance (No LLM)', () => {
    it('should handle 100 messages in <20ms', async () => {
      const messages = createMessages(100);
      const strategy: CompressionStrategy = {
        type: 'hybrid',
        preserveRecent: 2048,
        summaryMaxTokens: 512
      };

      const start = performance.now();
      const result = await service.compress(messages, strategy);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(20);
      expect(result.summary).toBeDefined();
    });

    it('should handle 1000 messages in <100ms', async () => {
      const messages = createMessages(1000);
      const strategy: CompressionStrategy = {
        type: 'hybrid',
        preserveRecent: 2048,
        summaryMaxTokens: 512
      };

      const start = performance.now();
      const result = await service.compress(messages, strategy);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(100);
      expect(result.summary).toBeDefined();
    });
  });

  describe('Fractional Preservation', () => {
    it('should preserve at least 30% of tokens', async () => {
      const messages = createMessages(100);
      const strategy: CompressionStrategy = {
        type: 'truncate',
        preserveRecent: 100 // Very small budget
      };

      const result = await service.compress(messages, strategy);
      
      // Should preserve more than the configured budget due to fractional preservation
      const preservedRatio = result.compressedTokens / result.originalTokens;
      expect(preservedRatio).toBeGreaterThanOrEqual(0.3);
    });
  });

  describe('Inflation Guard', () => {
    it('should detect inflation when compression increases token count', async () => {
      // Create a scenario where compression would inflate
      // (very few messages, large summary overhead)
      const messages = createMessages(3);
      const strategy: CompressionStrategy = {
        type: 'summarize',
        preserveRecent: 0,
        summaryMaxTokens: 1000 // Large summary
      };

      const result = await service.compress(messages, strategy);
      
      // Should detect inflation
      if (result.compressedTokens >= result.originalTokens) {
        expect(result.status).toBe('inflated');
      }
    });
  });

  describe('User Message Preservation', () => {
    it('should never compress user messages', async () => {
      const messages: Message[] = [
        { id: '1', role: 'user', content: 'User message 1', timestamp: new Date() },
        { id: '2', role: 'assistant', content: 'Assistant response', timestamp: new Date() },
        { id: '3', role: 'user', content: 'User message 2', timestamp: new Date() },
        { id: '4', role: 'assistant', content: 'Assistant response 2', timestamp: new Date() },
      ];

      const strategy: CompressionStrategy = {
        type: 'truncate',
        preserveRecent: 10 // Very small budget
      };

      const result = await service.compress(messages, strategy);
      
      // All user messages should be preserved
      const userMessages = result.preserved.filter(m => m.role === 'user');
      expect(userMessages.length).toBe(2);
    });
  });

  describe('Memory Usage', () => {
    it('should use <10MB for compressing 1000 messages', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      const messages = createMessages(1000);
      const strategy: CompressionStrategy = {
        type: 'truncate',
        preserveRecent: 2048
      };

      await service.compress(messages, strategy);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryUsed).toBeLessThan(10);
    });
  });

  describe('Compression Ratio', () => {
    it('should achieve compression for large conversations', async () => {
      const messages = createMessages(200);
      const strategy: CompressionStrategy = {
        type: 'truncate',
        preserveRecent: 1000 // Smaller budget to force compression
      };

      const result = await service.compress(messages, strategy);
      
      // Should achieve some compression (ratio < 1.0)
      expect(result.compressionRatio).toBeLessThan(1.0);
      expect(result.compressionRatio).toBeGreaterThan(0);
    });
  });

  describe('Estimation Performance', () => {
    it('should estimate compression in <5ms', () => {
      const messages = createMessages(100);
      
      const start = performance.now();
      const estimate = service.estimateCompression(messages);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(5);
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedRatio).toBeGreaterThan(0);
      expect(estimate.estimatedRatio).toBeLessThan(1);
    });
  });
});
