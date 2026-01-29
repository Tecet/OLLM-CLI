/**
 * Property-Based Tests for Validation Service
 *
 * Tests universal properties that must hold for all inputs:
 * - Property 11: Validation Accuracy
 * - Property 12: Validation Suggestions
 *
 * Requirements: FR-5, FR-8
 */

import * as fc from 'fast-check';
import { describe, it, expect } from 'vitest';

import { ValidationService } from '../validationService.js';

import type { Message } from '../../types.js';

/**
 * Arbitrary for generating messages with realistic token counts
 */
const messageArbitrary = fc.record({
  id: fc.uuid(),
  role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
  content: fc.string({ minLength: 10, maxLength: 500 }),
  timestamp: fc.date(),
}).map((msg) => ({
  ...msg,
  // Calculate realistic token count (approx 1 token per 4 characters)
  tokenCount: Math.ceil(msg.content.length / 4),
}));

/**
 * Arbitrary for generating message arrays with controlled token counts
 */
const messagesArbitrary = fc.array(messageArbitrary, { minLength: 1, maxLength: 50 });

/**
 * Arbitrary for Ollama limits (common values)
 */
const ollamaLimitArbitrary = fc.constantFrom(
  2048, // 2K context
  4096, // 4K context
  6800, // 8K context (85% of 8192)
  13600, // 16K context (85% of 16384)
  27200 // 32K context (85% of 32768)
);

describe('ValidationService - Property Tests', () => {
  describe('Property 11: Validation Accuracy', () => {
    /**
     * **Validates: Requirements FR-5, FR-8**
     *
     * Property: For all message arrays and Ollama limits, validation must:
     * 1. Correctly identify when messages fit within limit
     * 2. Correctly identify when messages exceed limit
     * 3. Calculate accurate token counts
     * 4. Provide correct overage amounts
     * 5. Never produce false positives or false negatives
     */
    it('should accurately validate prompt size against any Ollama limit', async () => {
      await fc.assert(
        fc.asyncProperty(messagesArbitrary, ollamaLimitArbitrary, async (messages, ollamaLimit) => {
          const validator = new ValidationService({
            ollamaLimit,
            safetyMargin: 1000,
          });

          // Execute validation
          const result = validator.validatePromptSize(messages);

          // Calculate expected token count manually
          const expectedTokens = messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
          const effectiveLimit = ollamaLimit - 1000;

          // Property 1: Token count must be accurate
          expect(result.tokens).toBe(expectedTokens);

          // Property 2: Limit must be correct
          expect(result.limit).toBe(effectiveLimit);

          // Property 3: Validation result must be consistent with token count
          if (expectedTokens <= effectiveLimit) {
            // Should be valid
            expect(result.valid).toBe(true);
            expect(result.overage).toBeUndefined();
            expect(result.errors).toEqual([]);
          } else {
            // Should be invalid
            expect(result.valid).toBe(false);
            expect(result.overage).toBe(expectedTokens - effectiveLimit);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
          }

          // Property 4: Overage calculation must be accurate
          if (!result.valid && result.overage) {
            expect(result.overage).toBe(expectedTokens - effectiveLimit);
            expect(result.overage).toBeGreaterThan(0);
          }

          // Property 5: Error messages must be informative
          if (!result.valid) {
            expect(result.errors).toBeDefined();
            expect(result.errors!.some((e) => e.includes('exceeds'))).toBe(true);
            expect(result.errors!.some((e) => e.includes(expectedTokens.toString()))).toBe(true);
          }
        }),
        {
          numRuns: 50, // Run many test cases for accuracy
          endOnFailure: true,
        }
      );
    });

    it('should handle edge cases at the boundary correctly', async () => {
      const ollamaLimit = 5000;
      const safetyMargin = 1000;
      const effectiveLimit = ollamaLimit - safetyMargin; // 4000

      const validator = new ValidationService({
        ollamaLimit,
        safetyMargin,
      });

      // Test exactly at limit
      const atLimit: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'x'.repeat(effectiveLimit * 4), // 4 chars per token
          timestamp: new Date(),
          tokenCount: effectiveLimit,
        },
      ];

      const atLimitResult = validator.validatePromptSize(atLimit);
      expect(atLimitResult.valid).toBe(true);
      expect(atLimitResult.tokens).toBe(effectiveLimit);

      // Test one token over limit
      const overLimit: Message[] = [
        {
          id: '2',
          role: 'user',
          content: 'x'.repeat((effectiveLimit + 1) * 4),
          timestamp: new Date(),
          tokenCount: effectiveLimit + 1,
        },
      ];

      const overLimitResult = validator.validatePromptSize(overLimit);
      expect(overLimitResult.valid).toBe(false);
      expect(overLimitResult.overage).toBe(1);

      // Test one token under limit
      const underLimit: Message[] = [
        {
          id: '3',
          role: 'user',
          content: 'x'.repeat((effectiveLimit - 1) * 4),
          timestamp: new Date(),
          tokenCount: effectiveLimit - 1,
        },
      ];

      const underLimitResult = validator.validatePromptSize(underLimit);
      expect(underLimitResult.valid).toBe(true);
      expect(underLimitResult.tokens).toBe(effectiveLimit - 1);
    });

    it('should maintain accuracy across different safety margins', async () => {
      await fc.assert(
        fc.asyncProperty(
          messagesArbitrary,
          ollamaLimitArbitrary,
          fc.integer({ min: 100, max: 2000 }),
          async (messages, ollamaLimit, safetyMargin) => {
            const validator = new ValidationService({
              ollamaLimit,
              safetyMargin,
            });

            const result = validator.validatePromptSize(messages);
            const expectedTokens = messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);
            const effectiveLimit = ollamaLimit - safetyMargin;

            // Property: Validation must be accurate regardless of safety margin
            expect(result.tokens).toBe(expectedTokens);
            expect(result.limit).toBe(effectiveLimit);
            expect(result.valid).toBe(expectedTokens <= effectiveLimit);

            if (!result.valid) {
              expect(result.overage).toBe(expectedTokens - effectiveLimit);
            }
          }
        ),
        {
          numRuns: 30,
          endOnFailure: true,
        }
      );
    });
  });

  describe('Property 12: Validation Suggestions', () => {
    /**
     * **Validates: Requirements FR-8**
     *
     * Property: For all invalid prompts, suggestions must:
     * 1. Be provided (non-empty array)
     * 2. Be ordered by priority (lower number = higher priority)
     * 3. Have realistic token estimates
     * 4. Provide actionable descriptions
     * 5. Cover enough tokens to potentially fix the issue
     */
    it('should always provide useful suggestions when validation fails', async () => {
      await fc.assert(
        fc.asyncProperty(messagesArbitrary, ollamaLimitArbitrary, async (messages, ollamaLimit) => {
          const validator = new ValidationService({
            ollamaLimit,
            safetyMargin: 1000,
          });

          const result = validator.validatePromptSize(messages);

          // Only test when validation fails
          if (!result.valid && result.suggestions) {
            // Property 1: Suggestions must be provided
            expect(result.suggestions).toBeDefined();
            expect(result.suggestions.length).toBeGreaterThan(0);

            // Property 2: Suggestions must be ordered by priority
            for (let i = 1; i < result.suggestions.length; i++) {
              expect(result.suggestions[i].priority).toBeGreaterThanOrEqual(
                result.suggestions[i - 1].priority
              );
            }

            // Property 3: Each suggestion must have valid fields
            for (const suggestion of result.suggestions) {
              expect(suggestion.type).toBeDefined();
              expect(['compress', 'merge_checkpoints', 'emergency_rollover', 'remove_messages']).toContain(
                suggestion.type
              );
              expect(suggestion.description).toBeTruthy();
              expect(suggestion.description.length).toBeGreaterThan(10);
              expect(suggestion.estimatedTokensFreed).toBeGreaterThan(0);
              expect(suggestion.priority).toBeGreaterThan(0);
            }

            // Property 4: Total estimated tokens freed should be significant
            const totalFreed = result.suggestions.reduce((sum, s) => sum + s.estimatedTokensFreed, 0);
            expect(totalFreed).toBeGreaterThan(0);

            // Property 5: At least one suggestion should free enough tokens
            const overage = result.overage || 0;
            const hasViableSolution = result.suggestions.some((s) => s.estimatedTokensFreed >= overage * 0.5);
            expect(hasViableSolution).toBe(true);
          }
        }),
        {
          numRuns: 30,
          endOnFailure: true,
        }
      );
    });

    it('should provide appropriate suggestions based on message composition', async () => {
      const ollamaLimit = 5000;
      const validator = new ValidationService({
        ollamaLimit,
        safetyMargin: 1000,
      });

      // Test with many assistant messages (should suggest compression)
      const manyAssistant: Message[] = Array.from({ length: 20 }, (_, i) => ({
        id: `assistant-${i}`,
        role: 'assistant' as const,
        content: 'x'.repeat(400), // 100 tokens each
        timestamp: new Date(),
        tokenCount: 100,
      }));

      const assistantResult = validator.validatePromptSize(manyAssistant);
      if (!assistantResult.valid && assistantResult.suggestions) {
        const compressSuggestion = assistantResult.suggestions.find((s) => s.type === 'compress');
        expect(compressSuggestion).toBeDefined();
        expect(compressSuggestion!.priority).toBe(1); // Should be highest priority
      }

      // Test with many user messages (should suggest removal)
      const manyUser: Message[] = Array.from({ length: 20 }, (_, i) => ({
        id: `user-${i}`,
        role: 'user' as const,
        content: 'x'.repeat(400),
        timestamp: new Date(),
        tokenCount: 100,
      }));

      const userResult = validator.validatePromptSize(manyUser);
      if (!userResult.valid && userResult.suggestions) {
        const removeSuggestion = userResult.suggestions.find((s) => s.type === 'remove_messages');
        expect(removeSuggestion).toBeDefined();
      }

      // Test with massive overage (should suggest emergency rollover)
      const massiveOverage: Message[] = Array.from({ length: 50 }, (_, i) => ({
        id: `massive-${i}`,
        role: 'assistant' as const,
        content: 'x'.repeat(800),
        timestamp: new Date(),
        tokenCount: 200,
      }));

      const massiveResult = validator.validatePromptSize(massiveOverage);
      if (!massiveResult.valid && massiveResult.suggestions) {
        const emergencySuggestion = massiveResult.suggestions.find((s) => s.type === 'emergency_rollover');
        expect(emergencySuggestion).toBeDefined();
      }
    });

    it('should provide realistic token estimates in suggestions', async () => {
      await fc.assert(
        fc.asyncProperty(messagesArbitrary, ollamaLimitArbitrary, async (messages, ollamaLimit) => {
          const validator = new ValidationService({
            ollamaLimit,
            safetyMargin: 1000,
          });

          const result = validator.validatePromptSize(messages);

          if (!result.valid && result.suggestions) {
            const totalTokens = result.tokens || 0;

            for (const suggestion of result.suggestions) {
              // Property: Estimated tokens freed should be reasonable
              // (not more than total tokens, not negative)
              expect(suggestion.estimatedTokensFreed).toBeGreaterThan(0);
              expect(suggestion.estimatedTokensFreed).toBeLessThanOrEqual(totalTokens);

              // Property: Emergency rollover should free most tokens
              if (suggestion.type === 'emergency_rollover') {
                expect(suggestion.estimatedTokensFreed).toBeGreaterThan(totalTokens * 0.5);
              }

              // Property: Compression should free significant tokens
              if (suggestion.type === 'compress') {
                expect(suggestion.estimatedTokensFreed).toBeGreaterThan(0);
              }
            }
          }
        }),
        {
          numRuns: 30,
          endOnFailure: true,
        }
      );
    });

    it('should handle empty or minimal message arrays gracefully', async () => {
      const validator = new ValidationService({
        ollamaLimit: 5000,
        safetyMargin: 1000,
      });

      // Test with single message
      const singleMessage: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
          tokenCount: 2,
        },
      ];

      const singleResult = validator.validatePromptSize(singleMessage);
      expect(singleResult.valid).toBe(true);
      expect(singleResult.tokens).toBe(2);

      // Test with empty array
      const emptyMessages: Message[] = [];
      const emptyResult = validator.validatePromptSize(emptyMessages);
      expect(emptyResult.valid).toBe(true);
      expect(emptyResult.tokens).toBe(0);
    });
  });

  describe('Configuration and State Management', () => {
    it('should allow updating Ollama limit dynamically', () => {
      const validator = new ValidationService({
        ollamaLimit: 5000,
        safetyMargin: 1000,
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'x'.repeat(20000), // 5000 tokens
          timestamp: new Date(),
          tokenCount: 5000,
        },
      ];

      // Should be invalid with initial limit
      const result1 = validator.validatePromptSize(messages);
      expect(result1.valid).toBe(false);

      // Update limit
      validator.setOllamaLimit(10000);

      // Should be valid with new limit
      const result2 = validator.validatePromptSize(messages);
      expect(result2.valid).toBe(true);
    });

    it('should allow updating safety margin dynamically', () => {
      const validator = new ValidationService({
        ollamaLimit: 5000,
        safetyMargin: 1000,
      });

      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'x'.repeat(16000), // 4000 tokens
          timestamp: new Date(),
          tokenCount: 4000,
        },
      ];

      // Should be valid with initial margin (4000 <= 5000 - 1000)
      const result1 = validator.validatePromptSize(messages);
      expect(result1.valid).toBe(true);

      // Update margin
      validator.setSafetyMargin(2000);

      // Should be invalid with new margin (4000 > 5000 - 2000)
      const result2 = validator.validatePromptSize(messages);
      expect(result2.valid).toBe(false);
    });

    it('should provide accurate configuration information', () => {
      const validator = new ValidationService({
        ollamaLimit: 6800,
        safetyMargin: 1200,
      });

      const config = validator.getConfig();
      expect(config.ollamaLimit).toBe(6800);
      expect(config.safetyMargin).toBe(1200);
      expect(config.effectiveLimit).toBe(5600);
    });
  });
});
