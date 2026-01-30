/**
 * Model-Aware Compression Integration
 *
 * Integrates model size detection with compression system to:
 * - Calculate reliability scores based on model size
 * - Set warning thresholds based on model capabilities
 * - Adapt compression quality to model size
 *
 * Requirements: FR-13
 *
 * @module modelAwareCompression
 */

/**
 * Extract model size from model name
 * @param modelId - The model identifier (e.g., "llama3.2:3b", "mistral:7b")
 * @returns The model size in billions of parameters (default: 7)
 */
export function extractModelSize(modelId: string): number {
  if (!modelId || modelId === '') return 7; // Default to 7B if no model name
  const match = modelId.match(/(\d+\.?\d*)b/i);
  if (match) {
    return parseFloat(match[1]);
  }
  return 7; // Default to 7B
}

/**
 * Model-aware compression integration
 *
 * Adapts compression behavior based on model size:
 * - Larger models = better compression quality
 * - Smaller models = earlier warnings
 * - Model size affects reliability scoring
 */
export class ModelAwareCompression {
  /**
   * Get model size for reliability calculation
   *
   * Extracts model size from model identifier.
   * Falls back to 7B if size cannot be determined.
   *
   * @param modelId - Model identifier (e.g., "llama3.2:3b")
   * @returns Model size in billions of parameters
   *
   * @example
   * ```typescript
   * const size = compression.getModelSize('llama3.2:3b');
   * console.log(size); // 3
   * ```
   */
  getModelSize(modelId: string): number {
    return extractModelSize(modelId);
  }

  /**
   * Calculate compression reliability based on model size
   *
   * Reliability decreases with:
   * - Smaller models (less capable of maintaining context)
   * - More compressions (information loss accumulates)
   *
   * Formula from dev_ContextCompression.md:
   * - modelFactor: Based on model size (0.3 to 0.95)
   * - compressionPenalty: 10% per compression (exponential decay)
   * - reliability = modelFactor * compressionPenalty
   *
   * @param modelSize - Model size in billions of parameters
   * @param compressionCount - Number of compressions performed
   * @returns Reliability score (0.0 to 1.0)
   *
   * @example
   * ```typescript
   * // 13B model, 3 compressions
   * const reliability = compression.calculateReliability(13, 3);
   * console.log(reliability); // ~0.51 (51%)
   * ```
   */
  calculateReliability(modelSize: number, compressionCount: number): number {
    // Model factor based on size (from dev_ContextCompression.md)
    const modelFactor =
      modelSize >= 70
        ? 0.95 // 70B+ models: Excellent
        : modelSize >= 30
          ? 0.85 // 30B models: Very good
          : modelSize >= 13
            ? 0.7 // 13B models: Good
            : modelSize >= 7
              ? 0.5 // 7B models: Moderate
              : 0.3; // 3B and below: Limited

    // Compression penalty: 10% loss per compression (exponential decay)
    // This is more realistic than linear decay
    const compressionPenalty = Math.pow(0.9, compressionCount);

    return modelFactor * compressionPenalty;
  }

  /**
   * Determine warning threshold based on model size
   *
   * Smaller models need earlier warnings because they:
   * - Lose context quality faster
   * - Have less capacity for maintaining coherence
   * - Struggle with complex summarization
   *
   * @param modelSize - Model size in billions of parameters
   * @returns Number of compressions before warning
   *
   * @example
   * ```typescript
   * const threshold = compression.getWarningThreshold(3);
   * console.log(threshold); // 3 (warn after 3 compressions)
   * ```
   */
  getWarningThreshold(modelSize: number): number {
    // Smaller models need earlier warnings
    if (modelSize <= 3) return 3; // 3B: Warn after 3 compressions
    if (modelSize <= 7) return 5; // 7B: Warn after 5 compressions
    if (modelSize <= 13) return 7; // 13B: Warn after 7 compressions
    return 10; // 30B+: Warn after 10 compressions
  }

  /**
   * Get reliability level description
   *
   * @param reliability - Reliability score (0.0 to 1.0)
   * @returns Human-readable reliability level
   */
  getReliabilityLevel(reliability: number): {
    level: 'excellent' | 'good' | 'moderate' | 'low' | 'critical';
    emoji: string;
    description: string;
  } {
    if (reliability >= 0.85) {
      return {
        level: 'excellent',
        emoji: '🟢',
        description: 'Excellent reliability - context well maintained',
      };
    } else if (reliability >= 0.7) {
      return {
        level: 'good',
        emoji: '🟢',
        description: 'Good reliability - minor information loss',
      };
    } else if (reliability >= 0.5) {
      return {
        level: 'moderate',
        emoji: '🟡',
        description: 'Moderate reliability - noticeable context degradation',
      };
    } else if (reliability >= 0.4) {
      return {
        level: 'low',
        emoji: '🟠',
        description: 'Low reliability - significant context loss',
      };
    } else {
      return {
        level: 'critical',
        emoji: '🔴',
        description: 'Critical - consider starting new conversation',
      };
    }
  }

  /**
   * Check if warning should be shown
   *
   * @param modelSize - Model size in billions of parameters
   * @param compressionCount - Number of compressions performed
   * @returns True if warning should be shown
   */
  shouldWarn(modelSize: number, compressionCount: number): boolean {
    const threshold = this.getWarningThreshold(modelSize);
    return compressionCount >= threshold;
  }

  /**
   * Get compression quality recommendation
   *
   * Larger models can handle more aggressive compression
   * while maintaining quality.
   *
   * @param modelSize - Model size in billions of parameters
   * @returns Recommended compression level (1=compact, 2=moderate, 3=detailed)
   */
  getRecommendedCompressionLevel(modelSize: number): 1 | 2 | 3 {
    if (modelSize >= 30) return 1; // Large models: Aggressive compression OK
    if (modelSize >= 13) return 2; // Medium models: Moderate compression
    return 3; // Small models: Detailed compression
  }
}
