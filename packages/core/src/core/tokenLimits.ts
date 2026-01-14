/**
 * Token counting and limit enforcement for chat requests.
 * Provides token estimation with provider fallback and context limit checking.
 * Integrates with Model Database for per-model context window limits.
 */

import type { ProviderAdapter, ProviderRequest } from '../provider/types.js';
import { ModelDatabase, modelDatabase } from '../routing/modelDatabase.js';

/**
 * Configuration for token limit enforcement
 */
export interface TokenLimitConfig {
  /** Map of model name to maximum token limit (overrides Model Database) */
  modelLimits?: Map<string, number>;
  /** Warning threshold as a percentage (e.g., 0.9 for 90%) */
  warningThreshold: number;
  /** Model Database instance (optional, uses singleton by default) */
  modelDatabase?: ModelDatabase;
}

/**
 * Result of token limit check
 */
export interface TokenLimitCheckResult {
  /** Whether the request is within the token limit */
  withinLimit: boolean;
  /** Whether the request is in the warning zone (approaching limit) */
  isWarning: boolean;
  /** The token limit for the model */
  limit: number;
}

/**
 * Token counter that estimates token usage and enforces context limits.
 * Uses provider's token counting when available, falls back to character-based estimation.
 * Queries Model Database for per-model context window limits.
 */
export class TokenCounter {
  private modelDatabase: ModelDatabase;

  constructor(
    private provider: ProviderAdapter,
    private config: TokenLimitConfig
  ) {
    // Validate warningThreshold
    if (!Number.isFinite(config.warningThreshold) || config.warningThreshold < 0 || config.warningThreshold > 1) {
      throw new Error(
        `Invalid warningThreshold: ${config.warningThreshold}. Must be a finite number between 0 and 1.`
      );
    }

    // Use provided Model Database or singleton
    this.modelDatabase = config.modelDatabase ?? modelDatabase;
  }

  /**
   * Estimate the total token count for a chat request.
   * Uses provider's countTokens method if available, otherwise falls back to character-based estimation.
   *
   * @param request - The provider request to estimate tokens for
   * @returns Promise resolving to estimated token count
   */
  async estimateTokens(request: ProviderRequest): Promise<number> {
    // Use provider's token counter if available
    if (this.provider.countTokens) {
      return await this.provider.countTokens(request);
    }

    // Fallback: estimate based on character count
    return this.fallbackEstimate(request);
  }

  /**
   * Fallback token estimation using character count divided by 4.
   * This is a rough approximation: 1 token ≈ 4 characters.
   *
   * @param request - The provider request to estimate tokens for
   * @returns Estimated token count
   */
  private fallbackEstimate(request: ProviderRequest): number {
    let totalChars = 0;

    // Count system prompt
    if (request.systemPrompt) {
      totalChars += request.systemPrompt.length;
    }

    // Count messages
    for (const message of request.messages) {
      for (const part of message.parts) {
        if (part.type === 'text') {
          totalChars += part.text.length;
        }
        // Note: Images are not counted in character-based estimation
      }
    }

    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(totalChars / 4);
  }

  /**
   * Check if the estimated token count is within the model's limit.
   * Also determines if the count is in the warning zone (approaching limit).
   * Uses Model Database to query context window limits, with config overrides.
   *
   * Requirements: 8.1, 8.2, 8.3
   *
   * @param model - The model name to check limits for
   * @param estimatedTokens - The estimated token count
   * @returns Token limit check result
   */
  checkLimit(model: string, estimatedTokens: number): TokenLimitCheckResult {
    // Get the limit for this model:
    // 1. Check config overrides first
    // 2. Query Model Database for known models
    // 3. Fall back to safe default (4096)
    let limit: number;
    
    if (this.config.modelLimits?.has(model)) {
      // Config override takes precedence
      limit = this.config.modelLimits.get(model)!;
    } else {
      // Query Model Database (returns 4096 for unknown models)
      limit = this.modelDatabase.getContextWindow(model);
    }

    const warningThreshold = limit * this.config.warningThreshold;

    return {
      withinLimit: estimatedTokens <= limit,
      isWarning: estimatedTokens >= warningThreshold && estimatedTokens <= limit,
      limit,
    };
  }
}
