/**
 * Tier-Aware Compression Integration
 *
 * Integrates the context compression system with the tier system to respect
 * tier-specific prompt budgets during compression.
 *
 * Requirements: FR-11
 */

import { ContextTier } from '../types.js';

/**
 * Tier budget configuration
 */
export interface TierBudgetConfig {
  /** Total prompt budget for this tier (in tokens) */
  promptBudget: number;
  /** Minimum tokens reserved for system prompt */
  systemPromptReserve: number;
  /** Compression trigger threshold (percentage of available budget) */
  compressionThreshold: number;
}

/**
 * Tier-aware compression integration
 *
 * Calculates tier budgets dynamically based on context size to ensure
 * consistent behavior across all context sizes.
 * 
 * **What is Tier Budget?**
 * Tier budget is the MAXIMUM allowed size for the system prompt at each tier.
 * It ensures system prompts don't grow too large and consume too much context.
 * 
 * **What it's NOT:**
 * - NOT subtracted from available message space
 * - NOT a reserved space (system prompt tokens are already counted)
 * - ONLY used for validation: if systemPromptTokens > tierBudget, throw error
 * 
 * **Example:**
 * - Tier 2 (8K context): tier budget = 500 tokens
 * - If system prompt = 450 tokens: ✅ Valid (450 < 500)
 * - If system prompt = 600 tokens: ❌ Error (600 > 500)
 */
export class TierAwareCompression {
  /**
   * Get the prompt budget for a specific tier and context size
   * 
   * Budget is calculated as a percentage of context size:
   * - Tier 1 (2-4K): 10% of context (min 400) - INCREASED to accommodate mandates
   * - Tier 2 (8K): 9% of context (min 700) - INCREASED to accommodate mandates
   * - Tier 3 (16K): 6% of context (min 1000)
   * - Tier 4 (32K): 5% of context (min 1500)
   * - Tier 5 (64K+): 2% of context (min 1500)
   *
   * **UPDATED (2026-01-29):** Increased Tier 1-2 budgets to accommodate full system prompt
   * (template + mandates ~200 tokens + skills + sanity checks)
   *
   * @param tier - Context tier
   * @param contextSize - Full context size in tokens
   * @returns Prompt budget in tokens
   */
  getPromptBudget(tier: ContextTier, contextSize: number = 8192): number {
    const percentages: Record<ContextTier, number> = {
      [ContextTier.TIER_1_MINIMAL]: 0.10, // 10% (was 5%, increased for mandates)
      [ContextTier.TIER_2_BASIC]: 0.09,   // 9% (was 6%, increased for mandates)
      [ContextTier.TIER_3_STANDARD]: 0.06, // 6%
      [ContextTier.TIER_4_PREMIUM]: 0.05,  // 5%
      [ContextTier.TIER_5_ULTRA]: 0.02,    // 2%
    };

    const minimums: Record<ContextTier, number> = {
      [ContextTier.TIER_1_MINIMAL]: 400,  // Was 200, increased for mandates
      [ContextTier.TIER_2_BASIC]: 700,    // Was 500, increased for mandates
      [ContextTier.TIER_3_STANDARD]: 1000,
      [ContextTier.TIER_4_PREMIUM]: 1500,
      [ContextTier.TIER_5_ULTRA]: 1500,
    };

    const percentage = percentages[tier];
    const minimum = minimums[tier];
    const calculated = Math.floor(contextSize * percentage);

    return Math.max(minimum, calculated);
  }

  /**
   * Calculate available budget for checkpoints after accounting for system prompt
   *
   * @param tier - Context tier
   * @param systemPromptTokens - Tokens used by system prompt
   * @param contextSize - Full context size in tokens
   * @returns Available tokens for checkpoints and messages
   */
  calculateCheckpointBudget(tier: ContextTier, systemPromptTokens: number, contextSize: number = 8192): number {
    const totalBudget = this.getPromptBudget(tier, contextSize);
    const checkpointBudget = totalBudget - systemPromptTokens;
    return Math.max(0, checkpointBudget);
  }

  /**
   * Determine if compression should be triggered based on tier and current usage
   *
   * @param tier - Context tier
   * @param currentTokens - Current token count (excluding system prompt)
   * @param ollamaLimit - Ollama context limit (85% pre-calculated)
   * @param systemPromptTokens - Tokens used by system prompt
   * @returns True if compression should be triggered
   */
  shouldCompress(
    tier: ContextTier,
    currentTokens: number,
    ollamaLimit: number,
    systemPromptTokens: number
  ): boolean {
    const safetyMargin = 1000; // Reserve for response

    // Calculate available space for messages (Ollama limit - system prompt - safety margin)
    const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;

    // Trigger compression at 75% of available space
    const compressionThreshold = availableForMessages * 0.75;

    return currentTokens > compressionThreshold;
  }

  /**
   * Get tier configuration including compression settings
   *
   * @param tier - Context tier
   * @param contextSize - Full context size in tokens
   * @returns Tier budget configuration
   */
  getTierConfig(tier: ContextTier, contextSize: number = 8192): TierBudgetConfig {
    return {
      promptBudget: this.getPromptBudget(tier, contextSize),
      systemPromptReserve: 100, // Minimum reserve for system prompt
      compressionThreshold: 0.75, // Trigger at 75% of available budget
    };
  }

  /**
   * Calculate total token budget including all components
   *
   * @param tier - Context tier
   * @param systemPromptTokens - Tokens used by system prompt
   * @param checkpointTokens - Tokens used by checkpoints
   * @param ollamaLimit - Ollama context limit
   * @param contextSize - Full context size in tokens
   * @returns Total token budget breakdown
   */
  calculateTotalBudget(
    tier: ContextTier,
    systemPromptTokens: number,
    checkpointTokens: number,
    ollamaLimit: number,
    contextSize: number = 8192
  ): {
    totalOllamaLimit: number;
    systemPromptTokens: number;
    promptBudget: number;
    checkpointTokens: number;
    safetyMargin: number;
    availableForMessages: number;
    compressionThreshold: number;
  } {
    const promptBudget = this.getPromptBudget(tier, contextSize);
    const safetyMargin = 1000;

    // Calculate available space for new messages
    const usedTokens = systemPromptTokens + promptBudget + checkpointTokens + safetyMargin;
    const availableForMessages = Math.max(0, ollamaLimit - usedTokens);
    const compressionThreshold = availableForMessages * 0.75;

    return {
      totalOllamaLimit: ollamaLimit,
      systemPromptTokens,
      promptBudget,
      checkpointTokens,
      safetyMargin,
      availableForMessages,
      compressionThreshold,
    };
  }

  /**
   * Validate that system prompt fits within tier budget
   *
   * @param systemPromptTokens - Current system prompt token count
   * @param tier - Context tier
   * @param contextSize - Full context size
   * @throws Error if system prompt exceeds tier budget
   */
  validateSystemPrompt(systemPromptTokens: number, tier: ContextTier, contextSize: number = 8192): void {
    const promptBudget = this.getPromptBudget(tier, contextSize);

    if (systemPromptTokens > promptBudget) {
      throw new Error(
        `System prompt (${systemPromptTokens} tokens) exceeds tier budget (${promptBudget} tokens) for ${tier}. ` +
          `System prompt must never be compressed.`
      );
    }
  }

  /**
   * Get compression urgency level based on current usage
   *
   * @param tier - Context tier
   * @param currentTokens - Current token count
   * @param ollamaLimit - Ollama context limit
   * @param systemPromptTokens - System prompt tokens
   * @returns Urgency level: 'none' | 'low' | 'medium' | 'high' | 'critical'
   */
  getCompressionUrgency(
    tier: ContextTier,
    currentTokens: number,
    ollamaLimit: number,
    systemPromptTokens: number
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const budget = this.calculateTotalBudget(tier, systemPromptTokens, 0, ollamaLimit);
    const usagePercentage = currentTokens / budget.availableForMessages;

    if (usagePercentage < 0.5) return 'none';
    if (usagePercentage < 0.75) return 'low';
    if (usagePercentage < 0.85) return 'medium';
    if (usagePercentage < 0.95) return 'high';
    return 'critical';
  }

  /**
   * Determine tier from context size
   *
   * @param contextSize - User-facing context size in tokens
   * @returns Corresponding context tier
   */
  getTierFromContextSize(contextSize: number): ContextTier {
    if (contextSize < 8192) return ContextTier.TIER_1_MINIMAL;
    if (contextSize < 16384) return ContextTier.TIER_2_BASIC;
    if (contextSize < 32768) return ContextTier.TIER_3_STANDARD;
    if (contextSize < 65536) return ContextTier.TIER_4_PREMIUM;
    return ContextTier.TIER_5_ULTRA;
  }
}
