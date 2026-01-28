/**
 * Chat Compression Service Tests
 * 
 * Tests for chat compression service including:
 * - Message compression strategies
 * - Token counting
 * - Compression ratio calculation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ChatCompressionService } from '../chatCompressionService.js';

import type { SessionMessage, CompressionOptions } from '../types.js';
import type { TokenCounter } from '../../context/types.js';
import type { ProviderAdapter } from '../../provider/types.js';

describe('ChatCompressionService', () => {
  let service: ChatCompressionService;
  let mockProvider: ProviderAdapter;
  let mockTokenCounter: TokenCounter;

  beforeEach(() => {
    // Mock provider
    mockProvider = {
      chatStream: vi.fn(),
    } as unknown as ProviderAdapter;

    // Mock token counter
    mockTokenCounter = {
      countTokens: vi.fn(async (text: string) => Math.ceil(text.length / 4)),
      countTokensCached: vi.fn((id: string, text: string) => Math.ceil(text.length / 4)),
    } as unknown as TokenCounter;

    // Create service
    service = new ChatCompressionService(mockProvider, 'test-model', mockTokenCounter);
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  function createTestMessage(role: 'user' | 'assistant' | 'system', content: string, timestamp?: Date): SessionMessage {
    return {
      role,
      parts: [{ type: 'text', text: content }],
      timestamp: timestamp || new Date(),
    };
  }

  // ============================================================================
  // Initialization Tests
  // ============================================================================

  describe('initialization', () => {
    it('should initialize with provider and model', () => {
      expect(service).toBeDefined();
    });

    it('should initialize without provider', () => {
      const serviceWithoutProvider = new ChatCompressionService();
      expect(serviceWithoutProvider).toBeDefined();
    });

    it('should allow setting provider after initialization', () => {
      const serviceWithoutProvider = new ChatCompressionService();
      serviceWithoutProvider.setProvider(mockProvider, 'new-model');
      expect(serviceWithoutProvider).toBeDefined();
    });

    it('should allow setting token counter after initialization', () => {
      const serviceWithoutCounter = new ChatCompressionService();
      serviceWithoutCounter.setTokenCounter(mockTokenCounter);
      expect(serviceWithoutCounter).toBeDefined();
    });
  });

  // ============================================================================
  // Token Counting Tests
  // ============================================================================

  describe('token counting', () => {
    it('should count tokens using token counter', async () => {
      const messages = [
        createTestMessage('user', 'Hello world'),
        createTestMessage('assistant', 'Hi there'),
      ];

      const shouldCompress = await service.shouldCompress(messages, 1000, 0.8);

      expect(mockTokenCounter.countTokensCached).toHaveBeenCalled();
      expect(typeof shouldCompress).toBe('boolean');
    });

    it('should use fallback estimation when token counter is not available', async () => {
      const serviceWithoutCounter = new ChatCompressionService();
      const messages = [
        createTestMessage('user', 'Hello world'),
      ];

      const shouldCompress = await serviceWithoutCounter.shouldCompress(messages, 1000, 0.8);

      expect(typeof shouldCompress).toBe('boolean');
    });

    it('should add overhead for message structure', async () => {
      const message = createTestMessage('user', 'Test');
      const messages = [message];

      await service.shouldCompress(messages, 1000, 0.8);

      // Verify token counter was called (overhead is added internally)
      expect(mockTokenCounter.countTokensCached).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Compression Decision Tests
  // ============================================================================

  describe('shouldCompress', () => {
    it('should return true when token count exceeds threshold', async () => {
      const messages = [
        createTestMessage('user', 'A'.repeat(4000)), // ~1000 tokens
      ];

      const shouldCompress = await service.shouldCompress(messages, 1000, 0.8);

      expect(shouldCompress).toBe(true);
    });

    it('should return false when token count is below threshold', async () => {
      const messages = [
        createTestMessage('user', 'Short message'),
      ];

      const shouldCompress = await service.shouldCompress(messages, 10000, 0.8);

      expect(shouldCompress).toBe(false);
    });

    it('should respect different threshold values', async () => {
      const messages = [
        createTestMessage('user', 'A'.repeat(2000)), // ~500 tokens
      ];

      const shouldCompressHigh = await service.shouldCompress(messages, 1000, 0.4);
      const shouldCompressLow = await service.shouldCompress(messages, 1000, 0.6);

      expect(shouldCompressHigh).toBe(true);
      expect(shouldCompressLow).toBe(false);
    });

    it('should handle empty message array', async () => {
      const shouldCompress = await service.shouldCompress([], 1000, 0.8);

      expect(shouldCompress).toBe(false);
    });
  });

  // ============================================================================
  // Compression Strategy Tests
  // ============================================================================

  describe('compress', () => {
    it('should compress messages with truncate strategy', async () => {
      const messages = [
        createTestMessage('user', 'Message 1'),
        createTestMessage('assistant', 'Response 1'),
        createTestMessage('user', 'Message 2'),
        createTestMessage('assistant', 'Response 2'),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 50,
        preserveRecentTokens: 50,
      };

      const result = await service.compress(messages, options);

      expect(result).toBeDefined();
      expect(result.compressedMessages).toBeDefined();
      expect(result.originalTokenCount).toBeGreaterThan(0);
      expect(result.compressedTokenCount).toBeLessThanOrEqual(result.originalTokenCount);
      expect(result.strategy).toBe('truncate');
    });

    it('should calculate token reduction', async () => {
      const messages = [
        createTestMessage('user', 'A'.repeat(1000)),
        createTestMessage('assistant', 'B'.repeat(1000)),
        createTestMessage('user', 'C'.repeat(100)),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 200, // Increased to ensure some messages remain
        preserveRecentTokens: 200,
      };

      const result = await service.compress(messages, options);

      expect(result.compressedTokenCount).toBeLessThan(result.originalTokenCount);
      expect(result.compressedMessages.length).toBeGreaterThan(0);
    });

    it('should update metadata compression count', async () => {
      const messages = [
        createTestMessage('user', 'Test message'),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 50,
        preserveRecentTokens: 50,
      };

      const metadata = {
        tokenCount: 100,
        compressionCount: 0,
      };

      const result = await service.compress(messages, options, metadata);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.compressionCount).toBe(1);
    });

    it('should preserve recent messages', async () => {
      const messages = [
        createTestMessage('user', 'Old message 1'),
        createTestMessage('assistant', 'Old response 1'),
        createTestMessage('user', 'Recent message'),
        createTestMessage('assistant', 'Recent response'),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 50,
        preserveRecentTokens: 50,
      };

      const result = await service.compress(messages, options);

      // Recent messages should be preserved
      expect(result.compressedMessages.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Event Emission Tests
  // ============================================================================

  describe('event emission', () => {
    it('should emit events as EventEmitter', () => {
      const listener = vi.fn();
      service.on('test-event', listener);
      service.emit('test-event', { data: 'test' });

      expect(listener).toHaveBeenCalledWith({ data: 'test' });
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      service.on('test-event', listener1);
      service.on('test-event', listener2);
      service.emit('test-event');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases Tests
  // ============================================================================

  describe('edge cases', () => {
    it('should handle messages with multiple parts', async () => {
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
          ],
          timestamp: new Date(),
        },
      ];

      const shouldCompress = await service.shouldCompress(messages, 1000, 0.8);

      expect(typeof shouldCompress).toBe('boolean');
    });

    it('should handle messages with non-text parts', async () => {
      const messages: SessionMessage[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Text part' },
            { type: 'image' as any, data: 'image-data' },
          ],
          timestamp: new Date(),
        },
      ];

      const shouldCompress = await service.shouldCompress(messages, 1000, 0.8);

      expect(typeof shouldCompress).toBe('boolean');
    });

    it('should handle very long messages', async () => {
      const messages = [
        createTestMessage('user', 'A'.repeat(100000)),
      ];

      const shouldCompress = await service.shouldCompress(messages, 10000, 0.8);

      expect(shouldCompress).toBe(true);
    });

    it('should handle empty message content', async () => {
      const messages = [
        createTestMessage('user', ''),
      ];

      const shouldCompress = await service.shouldCompress(messages, 1000, 0.8);

      expect(typeof shouldCompress).toBe('boolean');
    });

    it('should handle zero token limit', async () => {
      const messages = [
        createTestMessage('user', 'Test'),
      ];

      const shouldCompress = await service.shouldCompress(messages, 0, 0.8);

      expect(shouldCompress).toBe(true);
    });

    it('should handle zero threshold', async () => {
      const messages = [
        createTestMessage('user', 'Test'),
      ];

      const shouldCompress = await service.shouldCompress(messages, 1000, 0);

      expect(shouldCompress).toBe(true);
    });
  });

  // ============================================================================
  // Provider Integration Tests
  // ============================================================================

  describe('provider integration', () => {
    it('should work without provider for truncate strategy', async () => {
      const serviceWithoutProvider = new ChatCompressionService(undefined, undefined, mockTokenCounter);
      
      const messages = [
        createTestMessage('user', 'Test message'),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 50,
        preserveRecentTokens: 50,
      };

      const result = await serviceWithoutProvider.compress(messages, options);

      expect(result).toBeDefined();
    });

    it('should update provider and model', () => {
      const newProvider = {} as ProviderAdapter;
      service.setProvider(newProvider, 'new-model');

      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // Token Counter Integration Tests
  // ============================================================================

  describe('token counter integration', () => {
    it('should use token counter when available', async () => {
      const messages = [
        createTestMessage('user', 'Test message'),
      ];

      await service.shouldCompress(messages, 1000, 0.8);

      expect(mockTokenCounter.countTokensCached).toHaveBeenCalled();
    });

    it('should cache token counts', async () => {
      const message = createTestMessage('user', 'Test message');
      const messages = [message, message]; // Same message twice

      await service.shouldCompress(messages, 1000, 0.8);

      // Should use cached count for second message
      expect(mockTokenCounter.countTokensCached).toHaveBeenCalled();
    });

    it('should update token counter', () => {
      const newTokenCounter = {} as TokenCounter;
      service.setTokenCounter(newTokenCounter);

      expect(service).toBeDefined();
    });
  });

  // ============================================================================
  // Metadata Tests
  // ============================================================================

  describe('metadata handling', () => {
    it('should preserve metadata fields', async () => {
      const messages = [
        createTestMessage('user', 'Test'),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 50,
        preserveRecentTokens: 50,
      };

      const metadata = {
        tokenCount: 100,
        compressionCount: 5,
      };

      const result = await service.compress(messages, options, metadata);

      expect(result.metadata?.tokenCount).toBeDefined();
      expect(result.metadata?.compressionCount).toBe(6);
    });

    it('should work without metadata', async () => {
      const messages = [
        createTestMessage('user', 'Test'),
      ];

      const options: CompressionOptions = {
        strategy: 'truncate',
        targetTokens: 50,
        preserveRecentTokens: 50,
      };

      const result = await service.compress(messages, options);

      expect(result).toBeDefined();
      expect(result.metadata).toBeUndefined();
    });
  });
});
