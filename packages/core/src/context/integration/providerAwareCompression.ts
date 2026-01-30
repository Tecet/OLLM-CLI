/**
 * Provider-Aware Compression Integration
 *
 * Integrates the context compression system with provider-specific context limits
 * to respect provider constraints and use pre-calculated 85% values correctly.
 *
 * Requirements: FR-14
 */

import type { ContextProfile } from '../types.js';

/**
 * Provider information for compression
 */
export interface ProviderInfo {
  /** Provider name (e.g., 'ollama', 'vllm', 'openai-compatible') */
  name: string;
  /** Model identifier */
  modelId: string;
  /** Requested context size */
  requestedSize: number;
}

/**
 * Validation result for provider limits
 */
export interface ValidationResult {
  /** Whether the context is valid */
  valid: boolean;
  /** Current token count */
  tokens: number;
  /** Effective limit (with safety margin) */
  limit: number;
  /** Overage amount (if invalid) */
  overage?: number;
  /** Validation message */
  message?: string;
}

/**
 * Profile manager interface for provider integration
 * This interface abstracts the ProfileManager to avoid circular dependencies
 */
export interface IProfileManager {
  /** Get model entry by ID */
  getModelEntry(modelId: string): {
    id: string;
    name: string;
    context_profiles?: ContextProfile[];
    default_context?: number;
    max_context_window?: number;
  };
}

/**
 * Provider-aware compression integration
 *
 * Uses provider-specific context limits from LLM_profiles.json and respects
 * pre-calculated 85% values (ollama_context_size) for compression triggers.
 */
export class ProviderAwareCompression {
  private profileManager: IProfileManager;
  private currentContextSize: number;

  constructor(profileManager: IProfileManager, currentContextSize: number = 8192) {
    this.profileManager = profileManager;
    this.currentContextSize = currentContextSize;
  }

  /**
   * Get provider-specific context limit
   *
   * Reads the pre-calculated ollama_context_size (85% value) from the model's
   * context profile for the current context size.
   *
   * @param modelId - Model identifier (e.g., "llama3.2:3b")
   * @returns Context limit in tokens (pre-calculated 85% value)
   *
   * @example
   * ```typescript
   * const limit = compression.getContextLimit('llama3.2:3b');
   * console.log(limit); // 6963 (for 8K context)
   * ```
   */
  getContextLimit(modelId: string): number {
    const modelEntry = this.profileManager.getModelEntry(modelId);
    if (!modelEntry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Get current context profile
    const profile = this.findContextProfile(
      modelEntry.context_profiles || [],
      this.currentContextSize
    );

    if (!profile) {
      // Fallback: calculate 85% if profile not found
      return Math.floor(this.currentContextSize * 0.85);
    }

    // Return pre-calculated 85% value
    return profile.ollama_context_size;
  }

  /**
   * Get pre-calculated ollama_context_size (85% value) for a specific context size
   *
   * This method reads the pre-calculated value from LLM_profiles.json.
   * The 85% calculation is done by developers, not at runtime.
   *
   * @param modelId - Model identifier
   * @param requestedSize - Requested context size (e.g., 8192, 16384)
   * @returns Pre-calculated ollama_context_size
   *
   * @example
   * ```typescript
   * const size = compression.getOllamaContextSize('llama3.2:3b', 8192);
   * console.log(size); // 6963 (pre-calculated 85% of 8192)
   * ```
   */
  getOllamaContextSize(modelId: string, requestedSize: number): number {
    const modelEntry = this.profileManager.getModelEntry(modelId);
    if (!modelEntry) {
      throw new Error(`Model not found: ${modelId}`);
    }

    // Find matching profile
    const profile = this.findContextProfile(modelEntry.context_profiles || [], requestedSize);

    if (!profile) {
      throw new Error(`No profile for size ${requestedSize} in model ${modelId}`);
    }

    // Return pre-calculated 85% value
    return profile.ollama_context_size;
  }

  /**
   * Validate context against provider limits
   *
   * Checks if the current token count fits within the provider's context limit,
   * accounting for a safety margin for the response.
   *
   * @param tokens - Current token count
   * @param modelId - Model identifier
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = compression.validateAgainstProvider(5000, 'llama3.2:3b');
   * if (!result.valid) {
   *   console.error(result.message);
   * }
   * ```
   */
  validateAgainstProvider(tokens: number, modelId: string): ValidationResult {
    const limit = this.getContextLimit(modelId);
    const safetyMargin = 1000; // Reserve for response
    const effectiveLimit = limit - safetyMargin;

    if (tokens <= effectiveLimit) {
      return { valid: true, tokens, limit: effectiveLimit };
    }

    return {
      valid: false,
      tokens,
      limit: effectiveLimit,
      overage: tokens - effectiveLimit,
      message: `Context exceeds provider limit by ${tokens - effectiveLimit} tokens`,
    };
  }

  /**
   * Determine if compression should be triggered based on provider limits
   *
   * Triggers compression when token usage exceeds 75% of available space
   * (after accounting for system prompt and safety margin).
   *
   * @param currentTokens - Current token count (excluding system prompt)
   * @param modelId - Model identifier
   * @param systemPromptTokens - Tokens used by system prompt
   * @returns True if compression should be triggered
   *
   * @example
   * ```typescript
   * const shouldCompress = compression.shouldCompress(
   *   4000,
   *   'llama3.2:3b',
   *   500
   * );
   * ```
   */
  shouldCompress(currentTokens: number, modelId: string, systemPromptTokens: number): boolean {
    const ollamaLimit = this.getContextLimit(modelId);
    const safetyMargin = 1000; // Reserve for response

    // Calculate available space for messages
    // (Ollama limit - system prompt - safety margin)
    // Note: tier budget is NOT subtracted because systemPromptTokens already includes it
    const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;

    // Trigger compression at 75% of available space
    const compressionThreshold = availableForMessages * 0.75;

    return currentTokens > compressionThreshold;
  }

  /**
   * Handle provider errors during compression
   *
   * Provides error handling strategies for different provider error types.
   *
   * @param error - Error from provider
   * @param modelId - Model identifier
   * @returns Error handling strategy
   *
   * @example
   * ```typescript
   * try {
   *   await sendToProvider(prompt);
   * } catch (error) {
   *   const strategy = compression.handleProviderError(error, modelId);
   *   if (strategy.shouldRetry) {
   *     // Retry with compression
   *   }
   * }
   * ```
   */
  handleProviderError(
    error: Error,
    modelId: string
  ): {
    type: 'context_overflow' | 'connection_error' | 'unknown';
    shouldRetry: boolean;
    shouldCompress: boolean;
    message: string;
  } {
    const errorMessage = error.message.toLowerCase();

    // Context overflow errors
    if (
      errorMessage.includes('context') ||
      errorMessage.includes('token') ||
      errorMessage.includes('limit') ||
      errorMessage.includes('too long')
    ) {
      return {
        type: 'context_overflow',
        shouldRetry: true,
        shouldCompress: true,
        message: `Context overflow for ${modelId}. Compression required.`,
      };
    }

    // Connection errors
    if (
      errorMessage.includes('connection') ||
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnrefused')
    ) {
      return {
        type: 'connection_error',
        shouldRetry: true,
        shouldCompress: false,
        message: `Connection error to provider. Retry without compression.`,
      };
    }

    // Unknown errors
    return {
      type: 'unknown',
      shouldRetry: false,
      shouldCompress: false,
      message: `Unknown provider error: ${error.message}`,
    };
  }

  /**
   * Get compression urgency based on provider limits
   *
   * @param currentTokens - Current token count
   * @param modelId - Model identifier
   * @param systemPromptTokens - System prompt tokens
   * @param tierBudget - Tier budget
   * @returns Urgency level
   */
  getCompressionUrgency(
    currentTokens: number,
    modelId: string,
    systemPromptTokens: number
  ): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const ollamaLimit = this.getContextLimit(modelId);
    const safetyMargin = 1000;
    const availableForMessages = ollamaLimit - systemPromptTokens - safetyMargin;
    const usagePercentage = currentTokens / availableForMessages;

    if (usagePercentage < 0.5) return 'none';
    if (usagePercentage < 0.75) return 'low';
    if (usagePercentage < 0.85) return 'medium';
    if (usagePercentage < 0.95) return 'high';
    return 'critical';
  }

  /**
   * Update current context size
   *
   * Call this when the user changes context size to update compression triggers.
   *
   * @param newSize - New context size
   */
  updateContextSize(newSize: number): void {
    this.currentContextSize = newSize;
  }

  /**
   * Get current context size
   *
   * @returns Current context size
   */
  getCurrentContextSize(): number {
    return this.currentContextSize;
  }

  /**
   * Find context profile for a specific size
   *
   * @param profiles - Available context profiles
   * @param size - Requested size
   * @returns Matching profile or undefined
   */
  private findContextProfile(profiles: ContextProfile[], size: number): ContextProfile | undefined {
    return profiles.find((p) => p.size === size);
  }

  /**
   * Get all available context sizes for a model
   *
   * @param modelId - Model identifier
   * @returns Array of available context sizes
   */
  getAvailableContextSizes(modelId: string): number[] {
    const modelEntry = this.profileManager.getModelEntry(modelId);
    if (!modelEntry || !modelEntry.context_profiles || modelEntry.context_profiles.length === 0) {
      return [4096, 8192, 16384, 32768]; // Default sizes
    }

    return modelEntry.context_profiles.map((p) => p.size);
  }

  /**
   * Get provider information
   *
   * @param modelId - Model identifier
   * @returns Provider information
   */
  getProviderInfo(modelId: string): ProviderInfo {
    // Determine provider from model ID
    // This is a simplified version - in production, this would query the actual provider
    const name = modelId.includes('vllm')
      ? 'vllm'
      : modelId.includes('openai')
        ? 'openai-compatible'
        : 'ollama';

    return {
      name,
      modelId,
      requestedSize: this.currentContextSize,
    };
  }
}
