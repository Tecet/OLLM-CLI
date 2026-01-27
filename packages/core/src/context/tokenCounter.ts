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

/**
 * Default tool call overhead in tokens
 * Accounts for tool schema and result formatting
 */
const TOOL_CALL_OVERHEAD = 50;

/**
 * Metrics for token counting performance and behavior
 */
export class TokenCounterMetrics {
  private cacheHits = 0;
  private cacheMisses = 0;
  private recalculations = 0;
  private totalTokensCounted = 0;
  private largestMessage = 0;
  private startTime = Date.now();

  recordCacheHit(): void {
    this.cacheHits++;
  }

  recordCacheMiss(tokens: number): void {
    this.cacheMisses++;
    this.totalTokensCounted += tokens;
    this.largestMessage = Math.max(this.largestMessage, tokens);
  }

  recordRecalculation(_messageCount: number, _totalTokens: number): void {
    this.recalculations++;
  }

  getStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(1) : '0.0';
    const uptime = Math.round((Date.now() - this.startTime) / 1000);

    return {
      cacheHitRate: `${hitRate}%`,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      recalculations: this.recalculations,
      totalTokensCounted: this.totalTokensCounted,
      largestMessage: this.largestMessage,
      avgTokensPerMessage: this.cacheMisses > 0 
        ? Math.round(this.totalTokensCounted / this.cacheMisses)
        : 0,
      uptimeSeconds: uptime
    };
  }

  reset(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.recalculations = 0;
    this.totalTokensCounted = 0;
    this.largestMessage = 0;
    this.startTime = Date.now();
  }
}

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
  private metrics: TokenCounterMetrics;
  private _isDevelopment: boolean;

  constructor(config: TokenCounterConfig = {}) {
    this.cache = new SimpleTokenCountCache();
    this.provider = config.provider;
    this.modelMultiplier = config.modelMultiplier ?? 1.0;
    this.toolCallOverhead = config.toolCallOverhead ?? TOOL_CALL_OVERHEAD;
    this.metrics = new TokenCounterMetrics();
    this._isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
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
        console.warn('Provider token counting failed, using fallback estimation:', error);
      }
    }

    // Fallback estimation: Math.ceil(text.length / 4)
    // This approximates ~0.75 words per token
    // Apply multiplier in single operation to avoid double rounding
    return Math.ceil((text.length / 4) * this.modelMultiplier);
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
      this.metrics.recordCacheHit();
      return cached;
    }

    // Calculate synchronously using fallback estimation
    // Single rounding operation for accuracy
    const count = Math.ceil((text.length / 4) * this.modelMultiplier);
    
    // ✅ VALIDATION: Ensure token count is valid
    if (count < 0) {
      console.error('[TokenCounter] INVALID: Negative token count!', {
        messageId,
        count,
        textLength: text.length,
        multiplier: this.modelMultiplier
      });
      throw new Error(`Invalid token count: ${count}`);
    }
    
    // Cache the result
    this.cache.set(messageId, count);
    this.metrics.recordCacheMiss(count);
    
    return count;
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
    
    // 📊 METRICS: Track recalculation
    this.metrics.recordRecalculation(messages.length, total);
    
    // ✅ VALIDATION: Ensure total is valid
    if (total < 0) {
      console.error('[TokenCounter] INVALID: Negative conversation total!', {
        messageCount: messages.length,
        total,
        toolCallCount
      });
      throw new Error(`Invalid conversation token count: ${total}`);
    }

    return total;
  }

  /**
   * Get token counting metrics
   */
  getMetrics() {
    return this.metrics.getStats();
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics.reset();
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
