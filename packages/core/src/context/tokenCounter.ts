import { createLogger } from '../utils/logger.js';
/**
 * Token Counter Service
 * 
 * Provides token counting functionality with provider API integration,
 * fallback estimation, caching, and tool call overhead calculation.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import type { TokenCounter, TokenCountCache, Message } from './types.js';
import type { ProviderAdapter } from '../provider/types.js';

const logger = createLogger('tokenCounter');

/**
 * Default tool call overhead in tokens
 * Accounts for tool schema and result formatting
 */
const TOOL_CALL_OVERHEAD = 50;

/**
 * Simple in-memory cache for token counts
 */
class SimpleTokenCountCache implements TokenCountCache {
  private cache = new Map<string, number>();

  get(messageId: string): number | undefined {
    return this.cache.get(messageId);
  }

  set(messageId: string, count: number): void {
    this.cache.set(messageId, count);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * Token counter configuration
 */
export interface TokenCounterConfig {
  /** Provider adapter for token counting API (optional) */
  provider?: ProviderAdapter;
  /** Model-specific token multiplier (default: 1.0) */
  modelMultiplier?: number;
  /** Tool call overhead in tokens (default: 50) */
  toolCallOverhead?: number;
}

/**
 * Token Counter implementation
 * 
 * Provides accurate token counting with:
 * - Provider API integration when available
 * - Fallback estimation using character count
 * - Message-level caching to avoid recalculation
 * - Tool call overhead accounting
 * - Per-model multiplier support
 */
export class TokenCounterService implements TokenCounter {
  private cache: TokenCountCache;
  private provider?: ProviderAdapter;
  private modelMultiplier: number;
  private toolCallOverhead: number;

  constructor(config: TokenCounterConfig = {}) {
    this.cache = new SimpleTokenCountCache();
    this.provider = config.provider;
    this.modelMultiplier = config.modelMultiplier ?? 1.0;
    this.toolCallOverhead = config.toolCallOverhead ?? TOOL_CALL_OVERHEAD;
  }

  /**
   * Count tokens in text using provider API or fallback estimation
   * 
   * Requirements: 2.2, 2.3
   */
  async countTokens(text: string): Promise<number> {
    // Try provider API first if available
    if (this.provider?.countTokens) {
      try {
        const count = await this.provider.countTokens({
          model: '', // Model name not needed for simple text counting
          messages: [{ role: 'user', parts: [{ type: 'text', text }] }]
        });
        // Apply multiplier and round
        return Math.round(count * this.modelMultiplier);
      } catch (error) {
        // Fall through to estimation on error
        logger.warn('Provider token counting failed, using fallback estimation:', error);
      }
    }

    // Fallback estimation: Math.ceil(text.length / 4)
    // This approximates ~0.75 words per token
    const estimated = Math.ceil(text.length / 4);
    
    // Apply multiplier: multiply first, then round
    // This ensures consistent behavior with the formula
    return Math.round(estimated * this.modelMultiplier);
  }

  /**
   * Count tokens using cached value if available
   * 
   * Requirements: 2.1, 2.4
   */
  countTokensCached(messageId: string, text: string): number {
    // Check cache first
    const cached = this.cache.get(messageId);
    if (cached !== undefined) {
      return cached;
    }

    // Calculate synchronously using fallback estimation
    const count = Math.ceil(text.length / 4);
    const adjusted = Math.round(count * this.modelMultiplier);
    
    // Cache the result
    this.cache.set(messageId, adjusted);
    
    return adjusted;
  }

  /**
   * Count total tokens in conversation including tool call overhead
   * 
   * Requirements: 2.5
   */
  countConversationTokens(messages: Message[]): number {
    let total = 0;
    let toolCallCount = 0;

    for (const message of messages) {
      // Use cached count if available, otherwise calculate
      const tokenCount = message.tokenCount ?? this.countTokensCached(message.id, message.content);
      total += tokenCount;

      // Count tool calls for overhead calculation
      if (message.metadata?.toolCalls) {
        toolCallCount += message.metadata.toolCalls.length;
      }
    }

    // Add tool call overhead
    total += toolCallCount * this.toolCallOverhead;

    return total;
  }

  /**
   * Clear the token count cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Update the provider adapter
   */
  setProvider(provider: ProviderAdapter | undefined): void {
    this.provider = provider;
  }

  /**
   * Update the model multiplier
   * 
   * Requirements: 2.6
   */
  setModelMultiplier(multiplier: number): void {
    this.modelMultiplier = multiplier;
    // Clear cache when multiplier changes as cached values are now invalid
    this.clearCache();
  }

  /**
   * Update the tool call overhead
   */
  setToolCallOverhead(overhead: number): void {
    this.toolCallOverhead = overhead;
  }
}

/**
 * Create a new token counter instance
 */
export function createTokenCounter(config: TokenCounterConfig = {}): TokenCounter {
  return new TokenCounterService(config);
}
