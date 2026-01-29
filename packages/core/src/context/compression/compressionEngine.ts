/**
 * Compression Engine
 *
 * Core compression logic with strategy pattern for different compression types.
 * Integrates with CompressionPipeline to provide flexible compression strategies.
 *
 * Supports multiple compression strategies:
 * - Standard: Default compression for normal conversation flow
 * - Aggressive: More aggressive compression for space-critical situations
 * - Selective: Compress only specific message types
 * - Emergency: Ultra-aggressive compression for emergency situations
 *
 * Requirements: FR-5, FR-6
 */

import type { Message } from '../types.js';
import type { Goal } from '../goalTypes.js';
import type { CheckpointSummary } from '../types/storageTypes.js';
import type { CompressionLevel } from './summarizationService.js';
import { CompressionPipeline, type CompressionResult, type CompressionPipelineConfig } from './compressionPipeline.js';
import { TokenCounterService } from '../tokenCounter.js';

/**
 * Compression strategy type
 */
export type CompressionStrategy = 'standard' | 'aggressive' | 'selective' | 'emergency';

/**
 * Compression strategy configuration
 */
export interface StrategyConfig {
  /** Strategy name */
  name: CompressionStrategy;

  /** Number of recent messages to keep */
  keepRecentCount: number;

  /** Minimum messages required for compression */
  minMessagesToCompress: number;

  /** Whether to compress user messages */
  compressUserMessages: boolean;

  /** Compression level to use */
  compressionLevel: CompressionLevel;

  /** Maximum tokens for summary */
  maxSummaryTokens: number;
}

/**
 * Compression engine configuration
 */
export interface CompressionEngineConfig {
  /** Pipeline configuration */
  pipelineConfig: CompressionPipelineConfig;

  /** Token counter service */
  tokenCounter: TokenCounterService;

  /** Default strategy (default: 'standard') */
  defaultStrategy?: CompressionStrategy;
}

/**
 * Compression Engine
 *
 * Provides flexible compression with multiple strategies.
 * Uses strategy pattern to allow different compression behaviors.
 *
 * @example
 * ```typescript
 * const engine = new CompressionEngine({
 *   pipelineConfig: { ... },
 *   tokenCounter,
 *   defaultStrategy: 'standard'
 * });
 *
 * // Use default strategy
 * const result = await engine.compress(goal);
 *
 * // Use specific strategy
 * const aggressiveResult = await engine.compressWithStrategy('aggressive', goal);
 *
 * // Get strategy recommendations
 * const recommended = engine.recommendStrategy(currentTokens, limit);
 * ```
 */
export class CompressionEngine {
  private pipeline: CompressionPipeline;
  private tokenCounter: TokenCounterService;
  private currentStrategy: CompressionStrategy;
  private strategies: Map<CompressionStrategy, StrategyConfig>;

  constructor(config: CompressionEngineConfig) {
    this.pipeline = new CompressionPipeline(config.pipelineConfig);
    this.tokenCounter = config.tokenCounter;
    this.currentStrategy = config.defaultStrategy ?? 'standard';
    this.strategies = this.initializeStrategies();
  }

  /**
   * Initialize compression strategies
   *
   * Defines the configuration for each compression strategy.
   *
   * Requirements: FR-5, FR-6
   */
  private initializeStrategies(): Map<CompressionStrategy, StrategyConfig> {
    const strategies = new Map<CompressionStrategy, StrategyConfig>();

    // Standard strategy - balanced compression
    strategies.set('standard', {
      name: 'standard',
      keepRecentCount: 5,
      minMessagesToCompress: 2,
      compressUserMessages: false,
      compressionLevel: 3, // Detailed
      maxSummaryTokens: 500,
    });

    // Aggressive strategy - more compression
    strategies.set('aggressive', {
      name: 'aggressive',
      keepRecentCount: 3,
      minMessagesToCompress: 1,
      compressUserMessages: false,
      compressionLevel: 2, // Moderate
      maxSummaryTokens: 300,
    });

    // Selective strategy - compress only assistant messages
    strategies.set('selective', {
      name: 'selective',
      keepRecentCount: 7,
      minMessagesToCompress: 3,
      compressUserMessages: false,
      compressionLevel: 3, // Detailed
      maxSummaryTokens: 500,
    });

    // Emergency strategy - ultra-aggressive compression
    strategies.set('emergency', {
      name: 'emergency',
      keepRecentCount: 2,
      minMessagesToCompress: 1,
      compressUserMessages: true, // Compress everything
      compressionLevel: 1, // Compact
      maxSummaryTokens: 200,
    });

    return strategies;
  }

  /**
   * Compress using current strategy
   *
   * Applies the currently selected compression strategy.
   *
   * Requirements: FR-5, FR-6
   *
   * @param goal - Optional goal for goal-aware compression
   * @returns Compression result
   *
   * @example
   * ```typescript
   * const result = await engine.compress(goal);
   * if (result.success) {
   *   console.log(`Freed ${result.freedTokens} tokens`);
   * }
   * ```
   */
  async compress(goal?: Goal): Promise<CompressionResult> {
    return this.compressWithStrategy(this.currentStrategy, goal);
  }

  /**
   * Compress using specific strategy
   *
   * Applies a specific compression strategy, overriding the current strategy.
   *
   * Requirements: FR-5, FR-6
   *
   * @param strategy - Strategy to use
   * @param goal - Optional goal for goal-aware compression
   * @returns Compression result
   *
   * @example
   * ```typescript
   * // Use aggressive compression in space-critical situation
   * const result = await engine.compressWithStrategy('aggressive', goal);
   * ```
   */
  async compressWithStrategy(
    strategy: CompressionStrategy,
    goal?: Goal
  ): Promise<CompressionResult> {
    const strategyConfig = this.strategies.get(strategy);
    if (!strategyConfig) {
      return {
        success: false,
        reason: `Unknown strategy: ${strategy}`,
        error: `Strategy '${strategy}' is not defined`,
      };
    }

    // Apply strategy configuration to pipeline
    this.applyStrategy(strategyConfig);

    // Execute compression with configured strategy
    try {
      const result = await this.pipeline.compress(goal);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        reason: 'Compression error',
        error: errorMessage,
      };
    }
  }

  /**
   * Apply strategy configuration to pipeline
   *
   * Configures the pipeline according to the strategy settings.
   *
   * @param strategy - Strategy configuration to apply
   */
  private applyStrategy(strategy: StrategyConfig): void {
    // Update pipeline configuration
    this.pipeline.setKeepRecentCount(strategy.keepRecentCount);

    // Note: Other strategy parameters (compressionLevel, maxSummaryTokens, etc.)
    // would be applied to the summarization service if we had access to it here.
    // For now, the pipeline uses its default configuration.
    // In a full implementation, we would pass these through the pipeline config.
  }

  /**
   * Recommend compression strategy based on context state
   *
   * Analyzes current token usage and recommends an appropriate strategy.
   *
   * **Recommendation Logic:**
   * - Emergency: > 95% of limit
   * - Aggressive: > 85% of limit
   * - Standard: > 70% of limit
   * - Selective: < 70% of limit
   *
   * Requirements: FR-5, FR-6
   *
   * @param currentTokens - Current token count
   * @param tokenLimit - Maximum token limit
   * @returns Recommended strategy
   *
   * @example
   * ```typescript
   * const strategy = engine.recommendStrategy(5800, 6800);
   * console.log(`Recommended strategy: ${strategy}`); // 'aggressive'
   * ```
   */
  recommendStrategy(currentTokens: number, tokenLimit: number): CompressionStrategy {
    const usage = currentTokens / tokenLimit;

    if (usage >= 0.95) {
      return 'emergency';
    } else if (usage >= 0.85) {
      return 'aggressive';
    } else if (usage >= 0.70) {
      return 'standard';
    } else {
      return 'selective';
    }
  }

  /**
   * Set current strategy
   *
   * Changes the default strategy used by compress().
   *
   * @param strategy - Strategy to set as current
   *
   * @example
   * ```typescript
   * engine.setStrategy('aggressive');
   * const result = await engine.compress(); // Uses aggressive strategy
   * ```
   */
  setStrategy(strategy: CompressionStrategy): void {
    if (!this.strategies.has(strategy)) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.currentStrategy = strategy;
  }

  /**
   * Get current strategy
   *
   * @returns Current strategy name
   */
  getCurrentStrategy(): CompressionStrategy {
    return this.currentStrategy;
  }

  /**
   * Get strategy configuration
   *
   * @param strategy - Strategy to get configuration for
   * @returns Strategy configuration or undefined if not found
   *
   * @example
   * ```typescript
   * const config = engine.getStrategyConfig('aggressive');
   * console.log(`Keeps ${config.keepRecentCount} recent messages`);
   * ```
   */
  getStrategyConfig(strategy: CompressionStrategy): StrategyConfig | undefined {
    return this.strategies.get(strategy);
  }

  /**
   * Get all available strategies
   *
   * @returns Array of strategy names
   *
   * @example
   * ```typescript
   * const strategies = engine.getAvailableStrategies();
   * console.log(`Available: ${strategies.join(', ')}`);
   * // Output: "Available: standard, aggressive, selective, emergency"
   * ```
   */
  getAvailableStrategies(): CompressionStrategy[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Register custom strategy
   *
   * Allows adding custom compression strategies at runtime.
   *
   * @param strategy - Strategy name
   * @param config - Strategy configuration
   *
   * @example
   * ```typescript
   * engine.registerStrategy('custom', {
   *   name: 'custom',
   *   keepRecentCount: 4,
   *   minMessagesToCompress: 2,
   *   compressUserMessages: false,
   *   compressionLevel: 2,
   *   maxSummaryTokens: 400
   * });
   * ```
   */
  registerStrategy(strategy: CompressionStrategy, config: StrategyConfig): void {
    this.strategies.set(strategy, config);
  }

  /**
   * Calculate compression efficiency
   *
   * Calculates how effective a compression was.
   *
   * @param originalTokens - Token count before compression
   * @param compressedTokens - Token count after compression
   * @returns Efficiency metrics
   *
   * @example
   * ```typescript
   * const efficiency = engine.calculateEfficiency(2500, 300);
   * console.log(`Saved ${efficiency.tokensSaved} tokens (${efficiency.percentageSaved}%)`);
   * // Output: "Saved 2200 tokens (88%)"
   * ```
   */
  calculateEfficiency(
    originalTokens: number,
    compressedTokens: number
  ): {
    tokensSaved: number;
    percentageSaved: number;
    compressionRatio: number;
  } {
    const tokensSaved = originalTokens - compressedTokens;
    const percentageSaved = (tokensSaved / originalTokens) * 100;
    const compressionRatio = compressedTokens / originalTokens;

    return {
      tokensSaved,
      percentageSaved: Math.round(percentageSaved * 100) / 100,
      compressionRatio: Math.round(compressionRatio * 100) / 100,
    };
  }

  /**
   * Estimate compression result
   *
   * Estimates the result of compression without actually performing it.
   * Useful for deciding whether to compress.
   *
   * @param messages - Messages to estimate compression for
   * @param strategy - Strategy to use for estimation
   * @returns Estimated result
   *
   * @example
   * ```typescript
   * const estimate = engine.estimateCompression(messages, 'standard');
   * if (estimate.estimatedTokensSaved > 1000) {
   *   await engine.compressWithStrategy('standard');
   * }
   * ```
   */
  estimateCompression(
    messages: Message[],
    strategy: CompressionStrategy
  ): {
    estimatedTokensSaved: number;
    estimatedCompressionRatio: number;
    worthCompressing: boolean;
  } {
    const strategyConfig = this.strategies.get(strategy);
    if (!strategyConfig) {
      return {
        estimatedTokensSaved: 0,
        estimatedCompressionRatio: 1.0,
        worthCompressing: false,
      };
    }

    // Calculate original tokens
    const originalTokens = messages.reduce((sum, m) => {
      return sum + this.tokenCounter.countTokensCached(m.id, m.content);
    }, 0);

    // Estimate compressed size based on strategy
    // These are rough estimates based on typical compression ratios
    let estimatedRatio: number;
    switch (strategy) {
      case 'emergency':
        estimatedRatio = 0.10; // 10% of original
        break;
      case 'aggressive':
        estimatedRatio = 0.15; // 15% of original
        break;
      case 'standard':
        estimatedRatio = 0.20; // 20% of original
        break;
      case 'selective':
        estimatedRatio = 0.25; // 25% of original
        break;
      default:
        estimatedRatio = 0.20;
    }

    const estimatedCompressedTokens = Math.ceil(originalTokens * estimatedRatio);
    const estimatedTokensSaved = originalTokens - estimatedCompressedTokens;

    // Worth compressing if we save at least 500 tokens
    const worthCompressing = estimatedTokensSaved >= 500;

    return {
      estimatedTokensSaved,
      estimatedCompressionRatio: estimatedRatio,
      worthCompressing,
    };
  }

  /**
   * Get pipeline instance
   *
   * Provides access to the underlying pipeline for advanced use cases.
   *
   * @returns Compression pipeline instance
   */
  getPipeline(): CompressionPipeline {
    return this.pipeline;
  }
}
