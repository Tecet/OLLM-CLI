/**
 * Tier-Aware Compression Integration
 *
 * Integrates the context compression system with the tier system to respect
 * tier-specific prompt budgets during compression.
 *
 * Requirements: FR-11
 */

import { ContextTier, TIER_CONFIGS } from '../types.js';

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
 * Respects tier-specific prompt budgets (200-1500 tokens) and ensures
 * compression triggers account for tier constraints.
 */
export class TierAwareCompression {
  /**
   * Tier-specific prompt budgets (from dev_PromptSystem.md)
   */
  private readonly tierBudgets: Record<ContextTier, number> = {
    [ContextTier.TIER_1_MINIMAL]: 200,
    [ContextTier.TIER_2_BASIC]: 500,
    [ContextTier.TIER_3_STANDARD]: 1000,
    [ContextTier.TIER_4_PREMIUM]: 1500,
    [ContextTier.TIER_5_ULTRA]: 1500,
  };

  /**
   * Get the prompt budget for a specific tier
   *
   * @param tier - Context tier
   * @returns Prompt budget in tokens
   */
  getPromptBudget(tier: ContextTier): number {
    return this.tierBudgets[tier];
  }

  /**
   * Calculate available budget for checkpoints after accounting for system prompt
   *
   * @param tier - Context tier
   * @param systemPromptTokens - Tokens used by system prompt
   * @returns Available tokens for checkpoints and messages
   */
  calculateCheckpointBudget(tier: ContextTier, systemPromptTokens: number): number {
    const totalBudget = this.getPromptBudget(tier);
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
    const promptBudget = this.getPromptBudget(tier);
    const safetyMargin = 1000; // Reserve for response

    // Calculate available space for messages (Ollama limit - system prompt - prompt budget - safety margin)
    const availableForMessages = ollamaLimit - systemPromptTokens - promptBudget - safetyMargin;

    // Trigger compression at 75% of available space
    const compressionThreshold = availableForMessages * 0.75;

    return currentTokens > compressionThreshold;
  }

  /**
   * Get tier configuration including compression settings
   *
   * @param tier - Context tier
   * @returns Tier budget configuration
   */
  getTierConfig(tier: ContextTier): TierBudgetConfig {
    return {
      promptBudget: this.getPromptBudget(tier),
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
   * @returns Total token budget breakdown
   */
  calculateTotalBudget(
    tier: ContextTier,
    systemPromptTokens: number,
    checkpointTokens: number,
    ollamaLimit: number
  ): {
    totalOllamaLimit: number;
    systemPromptTokens: number;
    promptBudget: number;
    checkpointTokens: number;
    safetyMargin: number;
    availableForMessages: number;
    compressionThreshold: number;
  } {
    const promptBudget = this.getPromptBudget(tier);
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
   * Validate that system prompt never gets compressed
   *
   * @param systemPromptTokens - Current system prompt token count
   * @param tier - Context tier
   * @throws Error if system prompt exceeds tier budget
   */
  validateSystemPrompt(systemPromptTokens: number, tier: ContextTier): void {
    const promptBudget = this.getPromptBudget(tier);

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
