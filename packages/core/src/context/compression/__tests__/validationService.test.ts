/**
 * Unit Tests for Validation Service
 *
 * Tests specific examples and edge cases for the validation service.
 *
 * Requirements: FR-5, FR-8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationService } from '../validationService.js';
import type { Message } from '../../types.js';

describe('ValidationService - Unit Tests', () => {
  let validator: ValidationService;

  beforeEach(() => {
    validator = new ValidationService({
      ollamaLimit: 6800,
      safetyMargin: 1000,
    });
  });

  describe('validatePromptSize', () => {
    it('should validate a prompt that fits within the limit', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: new Date(),
          tokenCount: 5,
        },
        {
          id: '2',
          role: 'assistant',
          content: 'I am doing well, thank you!',
          timestamp: new Date(),
          tokenCount: 7,
        },
      ];

      const result = validator.validatePromptSize(messages);

      expect(result.valid).toBe(true);
      expect(result.tokens).toBe(12);
      expect(result.limit).toBe(5800); // 6800 - 1000
      expect(result.errors).toEqual([]);
    });

    it('should invalidate a prompt that exceeds the limit', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'x'.repeat(24000), // 6000 tokens
          timestamp: new Date(),
          tokenCount: 6000,
        },
      ];

      const result = validator.validatePromptSize(messages);

      expect(result.valid).toBe(false);
      expect(result.tokens).toBe(6000);
      expect(result.limit).toBe(5800);
      expect(result.overage).toBe(200);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('calculateTotalTokens', () => {
    it('should calculate total tokens correctly', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
          tokenCount: 2,
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: new Date(),
          tokenCount: 3,
        },
        {
          id: '3',
          role: 'user',
          content: 'How are you?',
          timestamp: new Date(),
          tokenCount: 4,
        },
      ];

      const total = validator.calculateTotalTokens(messages);
      expect(total).toBe(9);
    });

    it('should handle empty message array', () => {
      const messages: Message[] = [];
      const total = validator.calculateTotalTokens(messages);
      expect(total).toBe(0);
    });
  });

  describe('checkOllamaLimit', () => {
    it('should pass when tokens are within limit', () => {
      const result = validator.checkOllamaLimit(5000);

      expect(result.valid).toBe(true);
      expect(result.effectiveLimit).toBe(5800);
      expect(result.overage).toBeUndefined();
    });

    it('should fail when tokens exceed limit', () => {
      const result = validator.checkOllamaLimit(6000);

      expect(result.valid).toBe(false);
      expect(result.effectiveLimit).toBe(5800);
      expect(result.overage).toBe(200);
    });

    it('should pass when tokens exactly equal limit', () => {
      const result = validator.checkOllamaLimit(5800);

      expect(result.valid).toBe(true);
      expect(result.effectiveLimit).toBe(5800);
    });
  });

  describe('suggestActions', () => {
    it('should suggest compression when there are many assistant messages', () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        role: 'assistant' as const,
        content: 'x'.repeat(400),
        timestamp: new Date(),
        tokenCount: 100,
      }));

      const suggestions = validator.suggestActions(6000, 5800, messages);

      expect(suggestions.length).toBeGreaterThan(0);
      const compressSuggestion = suggestions.find((s) => s.type === 'compress');
      expect(compressSuggestion).toBeDefined();
      expect(compressSuggestion!.priority).toBe(1);
    });

    it('should suggest removing messages when there are many user messages', () => {
      const messages: Message[] = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        role: 'user' as const,
        content: 'x'.repeat(400),
        timestamp: new Date(),
        tokenCount: 100,
      }));

      const suggestions = validator.suggestActions(6000, 5800, messages);

      const removeSuggestion = suggestions.find((s) => s.type === 'remove_messages');
      expect(removeSuggestion).toBeDefined();
    });

    it('should suggest emergency rollover for massive overage', () => {
      const messages: Message[] = Array.from({ length: 50 }, (_, i) => ({
        id: `${i}`,
        role: 'assistant' as const,
        content: 'x'.repeat(800),
        timestamp: new Date(),
        tokenCount: 200,
      }));

      const suggestions = validator.suggestActions(10000, 5800, messages);

      const emergencySuggestion = suggestions.find((s) => s.type === 'emergency_rollover');
      expect(emergencySuggestion).toBeDefined();
    });

    it('should order suggestions by priority', () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: 'x'.repeat(400),
        timestamp: new Date(),
        tokenCount: 100,
      }));

      const suggestions = validator.suggestActions(6000, 5800, messages);

      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i - 1].priority);
      }
    });
  });

  describe('Configuration Management', () => {
    it('should update Ollama limit', () => {
      validator.setOllamaLimit(10000);
      const config = validator.getConfig();

      expect(config.ollamaLimit).toBe(10000);
      expect(config.effectiveLimit).toBe(9000); // 10000 - 1000
    });

    it('should update safety margin', () => {
      validator.setSafetyMargin(2000);
      const config = validator.getConfig();

      expect(config.safetyMargin).toBe(2000);
      expect(config.effectiveLimit).toBe(4800); // 6800 - 2000
    });

    it('should return current configuration', () => {
      const config = validator.getConfig();

      expect(config.ollamaLimit).toBe(6800);
      expect(config.safetyMargin).toBe(1000);
      expect(config.effectiveLimit).toBe(5800);
    });
  });
});
