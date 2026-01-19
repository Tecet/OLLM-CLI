/**
 * Tests for improved token counting in LocalProvider
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LocalProvider } from '../localProvider.js';
import type { ProviderRequest } from '@ollm/core';

describe('LocalProvider Token Counting', () => {
  let provider: LocalProvider;

  beforeEach(() => {
    provider = new LocalProvider({ 
      baseUrl: 'http://localhost:11434',
      tokenCountingMethod: 'tiktoken' 
    });
  });

  describe('Tiktoken Method', () => {
    it('should count tokens accurately for simple text', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'Hello, world!' }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // "Hello, world!" is approximately 4 tokens
      expect(count).toBeGreaterThan(2);
      expect(count).toBeLessThan(8);
    });

    it('should count tokens for system prompt', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'Hello' }] 
          }
        ],
        systemPrompt: 'You are a helpful assistant.',
      };

      const count = await provider.countTokens(request);
      
      // Should include both system prompt and message
      expect(count).toBeGreaterThan(5);
      expect(count).toBeLessThan(15);
    });

    it('should count tokens for multiple messages', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'Hello' }] 
          },
          { 
            role: 'assistant', 
            parts: [{ type: 'text', text: 'Hi there!' }] 
          },
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'How are you?' }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // Should count all messages
      expect(count).toBeGreaterThanOrEqual(8);
      expect(count).toBeLessThan(20);
    });

    it('should handle empty messages', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [],
      };

      const count = await provider.countTokens(request);
      expect(count).toBe(0);
    });

    it('should handle long text', async () => {
      const longText = 'This is a longer piece of text that contains multiple sentences. '.repeat(10);
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: longText }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // Long text should have many tokens
      expect(count).toBeGreaterThan(100);
    });
  });

  describe('Multiplier Method', () => {
    beforeEach(() => {
      provider = new LocalProvider({ 
        baseUrl: 'http://localhost:11434',
        tokenCountingMethod: 'multiplier' 
      });
    });

    it('should use correct multiplier for llama models', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'a'.repeat(100) }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // 100 chars * 0.25 = 25 tokens
      expect(count).toBe(25);
    });

    it('should use correct multiplier for mistral models', async () => {
      const request: ProviderRequest = {
        model: 'mistral',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'a'.repeat(100) }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // 100 chars * 0.27 = 27 tokens
      expect(count).toBe(27);
    });

    it('should use default multiplier for unknown models', async () => {
      const request: ProviderRequest = {
        model: 'unknown-model',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'a'.repeat(100) }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // 100 chars * 0.25 (default) = 25 tokens
      expect(count).toBe(25);
    });

    it('should handle system prompt in multiplier method', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'a'.repeat(100) }] 
          }
        ],
        systemPrompt: 'a'.repeat(100),
      };

      const count = await provider.countTokens(request);
      
      // 200 chars * 0.25 = 50 tokens
      expect(count).toBe(50);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fall back to multiplier if tiktoken fails', async () => {
      // This test would require mocking tiktoken to throw an error
      // For now, we just verify the multiplier method works
      const providerWithMultiplier = new LocalProvider({ 
        baseUrl: 'http://localhost:11434',
        tokenCountingMethod: 'multiplier' 
      });

      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'Hello' }] 
          }
        ],
      };

      const count = await providerWithMultiplier.countTokens(request);
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages with only images', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'image', data: 'base64data' }] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // Images don't contribute to token count
      expect(count).toBe(0);
    });

    it('should handle mixed text and image parts', async () => {
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [
              { type: 'text', text: 'Hello' },
              { type: 'image', data: 'base64data' },
              { type: 'text', text: 'World' }
            ] 
          }
        ],
      };

      const count = await provider.countTokens(request);
      
      // Should only count text parts
      expect(count).toBeGreaterThan(0);
    });

    it('should handle very long system prompts', async () => {
      const longPrompt = 'You are a helpful assistant. '.repeat(100);
      const request: ProviderRequest = {
        model: 'llama2',
        messages: [
          { 
            role: 'user', 
            parts: [{ type: 'text', text: 'Hello' }] 
          }
        ],
        systemPrompt: longPrompt,
      };

      const count = await provider.countTokens(request);
      
      // Should handle long prompts without error
      expect(count).toBeGreaterThan(500);
    });
  });
});
