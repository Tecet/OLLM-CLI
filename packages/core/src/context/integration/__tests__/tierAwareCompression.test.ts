/**
 * Unit Tests for Tier-Aware Compression
 *
 * Tests all tiers (Tier 1-4) with specific scenarios
 * Validates: Requirements FR-11
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { ContextTier } from '../../types.js';
import { TierAwareCompression } from '../tierAwareCompression.js';

describe('TierAwareCompression - Unit Tests', () => {
  let tierCompression: TierAwareCompression;

  beforeEach(() => {
    tierCompression = new TierAwareCompression();
  });

  describe('Tier 1 (983 tokens for 8K context)', () => {
    const tier = ContextTier.TIER_1_MINIMAL;
    const contextSize = 8192;
    const expectedBudget = 983; // 12% of 8192 = 983

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier, contextSize);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      // System prompt uses 150 tokens
      const systemPromptTokens = 150;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(
        tier,
        systemPromptTokens,
        contextSize
      );
      expect(checkpointBudget).toBe(833); // 983 - 150
    });

    it('should return 0 checkpoint budget when system prompt exceeds tier budget', () => {
      const systemPromptTokens = 1000; // Exceeds 983
      const checkpointBudget = tierCompression.calculateCheckpointBudget(
        tier,
        systemPromptTokens,
        contextSize
      );
      expect(checkpointBudget).toBe(0);
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 3400; // 4K context * 0.85
      const systemPromptTokens = 150;
      const safetyMargin = 1000;

      // Available for messages: 3400 - 150 - 1000 = 2250
      // Threshold: 2250 * 0.75 = 1687.5
      const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;
      const threshold = availableForMessages * 0.75;

      // Below threshold - should not compress
      expect(
        tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)
      ).toBe(false);

      // Above threshold - should compress
      expect(
        tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)
      ).toBe(true);
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 150;
      const checkpointTokens = 500;
      const ollamaLimit = 3400;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit,
        contextSize
      );

      expect(budget.totalOllamaLimit).toBe(3400);
      expect(budget.systemPromptTokens).toBe(150);
      expect(budget.promptBudget).toBe(983);
      expect(budget.checkpointTokens).toBe(500);
      expect(budget.safetyMargin).toBe(1000);
      expect(budget.availableForMessages).toBe(767); // 3400 - 150 - 983 - 500 - 1000
      expect(budget.compressionThreshold).toBe(575.25); // 767 * 0.75
    });

    it('should validate system prompt correctly', () => {
      // Valid system prompt
      expect(() => tierCompression.validateSystemPrompt(150, tier, contextSize)).not.toThrow();

      // Invalid system prompt (exceeds budget)
      expect(() => tierCompression.validateSystemPrompt(1000, tier, contextSize)).toThrow(
        /System prompt .* exceeds tier budget/
      );
    });

    it('should calculate compression urgency correctly', () => {
      const ollamaLimit = 3400;
      const systemPromptTokens = 150;

      // Calculate available budget
      const budget = tierCompression.calculateTotalBudget(tier, systemPromptTokens, 0, ollamaLimit);
      const available = budget.availableForMessages;

      // Test different usage levels
      expect(
        tierCompression.getCompressionUrgency(
          tier,
          available * 0.3,
          ollamaLimit,
          systemPromptTokens
        )
      ).toBe('none');
      expect(
        tierCompression.getCompressionUrgency(
          tier,
          available * 0.6,
          ollamaLimit,
          systemPromptTokens
        )
      ).toBe('low');
      expect(
        tierCompression.getCompressionUrgency(
          tier,
          available * 0.8,
          ollamaLimit,
          systemPromptTokens
        )
      ).toBe('medium');
      expect(
        tierCompression.getCompressionUrgency(
          tier,
          available * 0.9,
          ollamaLimit,
          systemPromptTokens
        )
      ).toBe('high');
      expect(
        tierCompression.getCompressionUrgency(
          tier,
          available * 0.96,
          ollamaLimit,
          systemPromptTokens
        )
      ).toBe('critical');
    });
  });

  describe('Tier 2 (737 tokens for 8K context)', () => {
    const tier = ContextTier.TIER_2_BASIC;
    const contextSize = 8192;
    const expectedBudget = 737; // 9% of 8192 = 737

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier, contextSize);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      const systemPromptTokens = 400;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(
        tier,
        systemPromptTokens,
        contextSize
      );
      expect(checkpointBudget).toBe(337); // 737 - 400
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 6800; // 8K context * 0.85
      const systemPromptTokens = 400;
      const safetyMargin = 1000;

      // Available for messages: 6800 - 400 - 1000 = 5400
      // Threshold: 5400 * 0.75 = 4050
      const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;
      const threshold = availableForMessages * 0.75;

      expect(
        tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)
      ).toBe(false);
      expect(
        tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)
      ).toBe(true);
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 400;
      const checkpointTokens = 1000;
      const ollamaLimit = 6800;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit,
        contextSize
      );

      expect(budget.totalOllamaLimit).toBe(6800);
      expect(budget.systemPromptTokens).toBe(400);
      expect(budget.promptBudget).toBe(737);
      expect(budget.checkpointTokens).toBe(1000);
      expect(budget.safetyMargin).toBe(1000);
      expect(budget.availableForMessages).toBe(3663); // 6800 - 400 - 737 - 1000 - 1000
      expect(budget.compressionThreshold).toBe(2747.25); // 3663 * 0.75
    });
  });

  describe('Tier 3 (1000 tokens for 8K context)', () => {
    const tier = ContextTier.TIER_3_STANDARD;
    const contextSize = 8192;
    const expectedBudget = 1000; // 6% of 8192 = 491, but min is 1000

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier, contextSize);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      const systemPromptTokens = 800;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(
        tier,
        systemPromptTokens,
        contextSize
      );
      expect(checkpointBudget).toBe(200); // 1000 - 800
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 13600; // 16K context * 0.85
      const systemPromptTokens = 800;
      const safetyMargin = 1000;

      // Available for messages: 13600 - 800 - 1000 = 11800
      // Threshold: 11800 * 0.75 = 8850
      const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;
      const threshold = availableForMessages * 0.75;

      expect(
        tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)
      ).toBe(false);
      expect(
        tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)
      ).toBe(true);
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 800;
      const checkpointTokens = 2000;
      const ollamaLimit = 13600;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit,
        contextSize
      );

      expect(budget.totalOllamaLimit).toBe(13600);
      expect(budget.systemPromptTokens).toBe(800);
      expect(budget.promptBudget).toBe(1000);
      expect(budget.checkpointTokens).toBe(2000);
      expect(budget.safetyMargin).toBe(1000);
      expect(budget.availableForMessages).toBe(8800); // 13600 - 800 - 1000 - 2000 - 1000
      expect(budget.compressionThreshold).toBe(6600); // 8800 * 0.75
    });
  });

  describe('Tier 4 (1500 tokens for 8K context)', () => {
    const tier = ContextTier.TIER_4_PREMIUM;
    const contextSize = 8192;
    const expectedBudget = 1500; // 5% of 8192 = 409, but min is 1500

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier, contextSize);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      const systemPromptTokens = 1200;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(
        tier,
        systemPromptTokens,
        contextSize
      );
      expect(checkpointBudget).toBe(300); // 1500 - 1200
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 27200; // 32K context * 0.85
      const systemPromptTokens = 1200;
      const safetyMargin = 1000;

      // Available for messages: 27200 - 1200 - 1000 = 25000
      // Threshold: 25000 * 0.75 = 18750
      const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;
      const threshold = availableForMessages * 0.75;

      expect(
        tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)
      ).toBe(false);
      expect(
        tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)
      ).toBe(true);
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 1200;
      const checkpointTokens = 3000;
      const ollamaLimit = 27200;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit,
        contextSize
      );

      expect(budget.totalOllamaLimit).toBe(27200);
      expect(budget.systemPromptTokens).toBe(1200);
      expect(budget.promptBudget).toBe(1500);
      expect(budget.checkpointTokens).toBe(3000);
      expect(budget.safetyMargin).toBe(1000);
      expect(budget.availableForMessages).toBe(20500); // 27200 - 1200 - 1500 - 3000 - 1000
      expect(budget.compressionThreshold).toBe(15375); // 20500 * 0.75
    });
  });

  describe('Tier detection from context size', () => {
    it('should detect Tier 1 for small contexts', () => {
      expect(tierCompression.getTierFromContextSize(2048)).toBe(ContextTier.TIER_1_MINIMAL);
      expect(tierCompression.getTierFromContextSize(4096)).toBe(ContextTier.TIER_1_MINIMAL);
      expect(tierCompression.getTierFromContextSize(8000)).toBe(ContextTier.TIER_1_MINIMAL);
    });

    it('should detect Tier 2 for 8K contexts', () => {
      expect(tierCompression.getTierFromContextSize(8192)).toBe(ContextTier.TIER_2_BASIC);
      expect(tierCompression.getTierFromContextSize(12000)).toBe(ContextTier.TIER_2_BASIC);
      expect(tierCompression.getTierFromContextSize(16000)).toBe(ContextTier.TIER_2_BASIC);
    });

    it('should detect Tier 3 for 16K contexts', () => {
      expect(tierCompression.getTierFromContextSize(16384)).toBe(ContextTier.TIER_3_STANDARD);
      expect(tierCompression.getTierFromContextSize(24000)).toBe(ContextTier.TIER_3_STANDARD);
      expect(tierCompression.getTierFromContextSize(32000)).toBe(ContextTier.TIER_3_STANDARD);
    });

    it('should detect Tier 4 for 32K contexts', () => {
      expect(tierCompression.getTierFromContextSize(32768)).toBe(ContextTier.TIER_4_PREMIUM);
      expect(tierCompression.getTierFromContextSize(48000)).toBe(ContextTier.TIER_4_PREMIUM);
      expect(tierCompression.getTierFromContextSize(65000)).toBe(ContextTier.TIER_4_PREMIUM);
    });

    it('should detect Tier 5 for 64K+ contexts', () => {
      expect(tierCompression.getTierFromContextSize(65536)).toBe(ContextTier.TIER_5_ULTRA);
      expect(tierCompression.getTierFromContextSize(100000)).toBe(ContextTier.TIER_5_ULTRA);
      expect(tierCompression.getTierFromContextSize(131072)).toBe(ContextTier.TIER_5_ULTRA);
    });
  });

  describe('Edge cases', () => {
    const contextSize = 8192;

    it('should handle zero system prompt tokens', () => {
      const tier = ContextTier.TIER_3_STANDARD;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, 0, contextSize);
      expect(checkpointBudget).toBe(1000); // Full tier budget available
    });

    it('should handle maximum system prompt tokens', () => {
      const tier = ContextTier.TIER_3_STANDARD;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, 1000, contextSize);
      expect(checkpointBudget).toBe(0); // No budget left
    });

    it('should handle very small Ollama limits', () => {
      const tier = ContextTier.TIER_1_MINIMAL;
      const ollamaLimit = 2000; // Very small
      const systemPromptTokens = 150;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        0,
        ollamaLimit,
        contextSize
      );
      expect(budget.availableForMessages).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large checkpoint tokens', () => {
      const tier = ContextTier.TIER_4_PREMIUM;
      const systemPromptTokens = 1200;
      const checkpointTokens = 20000; // Very large
      const ollamaLimit = 27200;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit,
        contextSize
      );

      // Calculate expected available: 27200 - 1200 - 1500 - 20000 - 1000 = 3500
      expect(budget.availableForMessages).toBe(3500);
    });
  });

  describe('Tier configuration', () => {
    const contextSize = 8192;

    it('should return correct tier config', () => {
      const tier = ContextTier.TIER_3_STANDARD;
      const config = tierCompression.getTierConfig(tier, contextSize);

      expect(config.promptBudget).toBe(1000);
      expect(config.systemPromptReserve).toBe(100);
      expect(config.compressionThreshold).toBe(0.75);
    });

    it('should have consistent config across all tiers', () => {
      const contextSize = 8192;
      const tiers = [
        ContextTier.TIER_1_MINIMAL,
        ContextTier.TIER_2_BASIC,
        ContextTier.TIER_3_STANDARD,
        ContextTier.TIER_4_PREMIUM,
        ContextTier.TIER_5_ULTRA,
      ];

      tiers.forEach((tier) => {
        const config = tierCompression.getTierConfig(tier, contextSize);
        expect(config.systemPromptReserve).toBe(100);
        expect(config.compressionThreshold).toBe(0.75);
      });
    });
  });
});
