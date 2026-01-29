/**
 * Unit Tests for Tier-Aware Compression
 *
 * Tests all tiers (Tier 1-4) with specific scenarios
 * Validates: Requirements FR-11
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TierAwareCompression } from '../tierAwareCompression.js';
import { ContextTier } from '../../types.js';

describe('TierAwareCompression - Unit Tests', () => {
  let tierCompression: TierAwareCompression;

  beforeEach(() => {
    tierCompression = new TierAwareCompression();
  });

  describe('Tier 1 (200 tokens)', () => {
    const tier = ContextTier.TIER_1_MINIMAL;
    const expectedBudget = 200;

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      // System prompt uses 150 tokens
      const systemPromptTokens = 150;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, systemPromptTokens);
      expect(checkpointBudget).toBe(50); // 200 - 150
    });

    it('should return 0 checkpoint budget when system prompt exceeds tier budget', () => {
      const systemPromptTokens = 250; // Exceeds 200
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, systemPromptTokens);
      expect(checkpointBudget).toBe(0);
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 3400; // 4K context * 0.85
      const systemPromptTokens = 150;
      const promptBudget = 200;
      const safetyMargin = 1000;

      // Available for messages: 3400 - 150 - 200 - 1000 = 2050
      // Threshold: 2050 * 0.75 = 1537.5
      const availableForMessages = ollamaLimit - systemPromptTokens - promptBudget - safetyMargin;
      const threshold = availableForMessages * 0.75;

      // Below threshold - should not compress
      expect(tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)).toBe(
        false
      );

      // Above threshold - should compress
      expect(tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)).toBe(
        true
      );
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 150;
      const checkpointTokens = 500;
      const ollamaLimit = 3400;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit
      );

      expect(budget.totalOllamaLimit).toBe(3400);
      expect(budget.systemPromptTokens).toBe(150);
      expect(budget.promptBudget).toBe(200);
      expect(budget.checkpointTokens).toBe(500);
      expect(budget.safetyMargin).toBe(1000);
      expect(budget.availableForMessages).toBe(1550); // 3400 - 150 - 200 - 500 - 1000
      expect(budget.compressionThreshold).toBe(1162.5); // 1550 * 0.75
    });

    it('should validate system prompt correctly', () => {
      // Valid system prompt
      expect(() => tierCompression.validateSystemPrompt(150, tier)).not.toThrow();

      // Invalid system prompt (exceeds budget)
      expect(() => tierCompression.validateSystemPrompt(250, tier)).toThrow(
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
      expect(tierCompression.getCompressionUrgency(tier, available * 0.3, ollamaLimit, systemPromptTokens)).toBe(
        'none'
      );
      expect(tierCompression.getCompressionUrgency(tier, available * 0.6, ollamaLimit, systemPromptTokens)).toBe(
        'low'
      );
      expect(tierCompression.getCompressionUrgency(tier, available * 0.8, ollamaLimit, systemPromptTokens)).toBe(
        'medium'
      );
      expect(tierCompression.getCompressionUrgency(tier, available * 0.9, ollamaLimit, systemPromptTokens)).toBe(
        'high'
      );
      expect(tierCompression.getCompressionUrgency(tier, available * 0.96, ollamaLimit, systemPromptTokens)).toBe(
        'critical'
      );
    });
  });

  describe('Tier 2 (500 tokens)', () => {
    const tier = ContextTier.TIER_2_BASIC;
    const expectedBudget = 500;

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      const systemPromptTokens = 400;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, systemPromptTokens);
      expect(checkpointBudget).toBe(100); // 500 - 400
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 6800; // 8K context * 0.85
      const systemPromptTokens = 400;
      const promptBudget = 500;
      const safetyMargin = 1000;

      // Available for messages: 6800 - 400 - 500 - 1000 = 4900
      // Threshold: 4900 * 0.75 = 3675
      const availableForMessages = ollamaLimit - systemPromptTokens - promptBudget - safetyMargin;
      const threshold = availableForMessages * 0.75;

      expect(tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)).toBe(
        false
      );
      expect(tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)).toBe(
        true
      );
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 400;
      const checkpointTokens = 1000;
      const ollamaLimit = 6800;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit
      );

      expect(budget.totalOllamaLimit).toBe(6800);
      expect(budget.systemPromptTokens).toBe(400);
      expect(budget.promptBudget).toBe(500);
      expect(budget.checkpointTokens).toBe(1000);
      expect(budget.safetyMargin).toBe(1000);
      expect(budget.availableForMessages).toBe(3900); // 6800 - 400 - 500 - 1000 - 1000
      expect(budget.compressionThreshold).toBe(2925); // 3900 * 0.75
    });
  });

  describe('Tier 3 (1000 tokens)', () => {
    const tier = ContextTier.TIER_3_STANDARD;
    const expectedBudget = 1000;

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      const systemPromptTokens = 800;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, systemPromptTokens);
      expect(checkpointBudget).toBe(200); // 1000 - 800
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 13600; // 16K context * 0.85
      const systemPromptTokens = 800;
      const promptBudget = 1000;
      const safetyMargin = 1000;

      // Available for messages: 13600 - 800 - 1000 - 1000 = 10800
      // Threshold: 10800 * 0.75 = 8100
      const availableForMessages = ollamaLimit - systemPromptTokens - promptBudget - safetyMargin;
      const threshold = availableForMessages * 0.75;

      expect(tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)).toBe(
        false
      );
      expect(tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)).toBe(
        true
      );
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 800;
      const checkpointTokens = 2000;
      const ollamaLimit = 13600;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit
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

  describe('Tier 4 (1500 tokens)', () => {
    const tier = ContextTier.TIER_4_PREMIUM;
    const expectedBudget = 1500;

    it('should have correct prompt budget', () => {
      const budget = tierCompression.getPromptBudget(tier);
      expect(budget).toBe(expectedBudget);
    });

    it('should calculate checkpoint budget correctly', () => {
      const systemPromptTokens = 1200;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, systemPromptTokens);
      expect(checkpointBudget).toBe(300); // 1500 - 1200
    });

    it('should trigger compression at appropriate threshold', () => {
      const ollamaLimit = 27200; // 32K context * 0.85
      const systemPromptTokens = 1200;
      const promptBudget = 1500;
      const safetyMargin = 1000;

      // Available for messages: 27200 - 1200 - 1500 - 1000 = 23500
      // Threshold: 23500 * 0.75 = 17625
      const availableForMessages = ollamaLimit - systemPromptTokens - promptBudget - safetyMargin;
      const threshold = availableForMessages * 0.75;

      expect(tierCompression.shouldCompress(tier, threshold - 100, ollamaLimit, systemPromptTokens)).toBe(
        false
      );
      expect(tierCompression.shouldCompress(tier, threshold + 100, ollamaLimit, systemPromptTokens)).toBe(
        true
      );
    });

    it('should calculate total budget correctly', () => {
      const systemPromptTokens = 1200;
      const checkpointTokens = 3000;
      const ollamaLimit = 27200;

      const budget = tierCompression.calculateTotalBudget(
        tier,
        systemPromptTokens,
        checkpointTokens,
        ollamaLimit
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
    it('should handle zero system prompt tokens', () => {
      const tier = ContextTier.TIER_3_STANDARD;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, 0);
      expect(checkpointBudget).toBe(1000); // Full tier budget available
    });

    it('should handle maximum system prompt tokens', () => {
      const tier = ContextTier.TIER_3_STANDARD;
      const checkpointBudget = tierCompression.calculateCheckpointBudget(tier, 1000);
      expect(checkpointBudget).toBe(0); // No budget left
    });

    it('should handle very small Ollama limits', () => {
      const tier = ContextTier.TIER_1_MINIMAL;
      const ollamaLimit = 2000; // Very small
      const systemPromptTokens = 150;

      const budget = tierCompression.calculateTotalBudget(tier, systemPromptTokens, 0, ollamaLimit);
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
        ollamaLimit
      );

      // Calculate expected available: 27200 - 1200 - 1500 - 20000 - 1000 = 3500
      expect(budget.availableForMessages).toBe(3500);
    });
  });

  describe('Tier configuration', () => {
    it('should return correct tier config', () => {
      const tier = ContextTier.TIER_3_STANDARD;
      const config = tierCompression.getTierConfig(tier);

      expect(config.promptBudget).toBe(1000);
      expect(config.systemPromptReserve).toBe(100);
      expect(config.compressionThreshold).toBe(0.75);
    });

    it('should have consistent config across all tiers', () => {
      const tiers = [
        ContextTier.TIER_1_MINIMAL,
        ContextTier.TIER_2_BASIC,
        ContextTier.TIER_3_STANDARD,
        ContextTier.TIER_4_PREMIUM,
        ContextTier.TIER_5_ULTRA,
      ];

      tiers.forEach((tier) => {
        const config = tierCompression.getTierConfig(tier);
        expect(config.systemPromptReserve).toBe(100);
        expect(config.compressionThreshold).toBe(0.75);
      });
    });
  });
});
