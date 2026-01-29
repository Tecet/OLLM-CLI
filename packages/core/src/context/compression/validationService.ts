/**
 * Validation Service
 *
 * Provides pre-send validation to prevent context overflow and ensure prompts
 * fit within provider limits. This is a critical safety mechanism that prevents
 * crashes by validating prompt size before sending to the LLM.
 *
 * Requirements: FR-5, FR-8
 */

import { TokenCounterService } from '../tokenCounter.js';

import type { ValidationResult } from '../types/storageTypes.js';
import type { Message } from '../types.js';

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Ollama context limit (85% pre-calculated value) */
  ollamaLimit: number;

  /** Safety margin to reserve for response (default: 1000 tokens) */
  safetyMargin?: number;

  /** Token counter instance */
  tokenCounter?: TokenCounterService;
}

/**
 * Suggested action when validation fails
 */
export interface SuggestedAction {
  /** Action type */
  type: 'compress' | 'merge_checkpoints' | 'emergency_rollover' | 'remove_messages';

  /** Action description */
  description: string;

  /** Estimated tokens that would be freed */
  estimatedTokensFreed: number;

  /** Priority (1 = highest) */
  priority: number;
}

/**
 * Extended validation result with suggestions
 */
export interface ExtendedValidationResult extends ValidationResult {
  /** Total tokens in prompt */
  tokens?: number;

  /** Effective limit (ollamaLimit - safetyMargin) */
  limit?: number;

  /** Tokens over limit (if invalid) */
  overage?: number;

  /** Suggested actions to fix the issue */
  suggestions?: SuggestedAction[];
}

/**
 * Validation Service
 *
 * Validates prompt size before sending to LLM and suggests corrective actions
 * if the prompt exceeds the provider's context limit.
 *
 * **Critical Safety Mechanism:**
 * - MUST be called before every LLM request
 * - MUST block sending if validation fails
 * - MUST provide actionable suggestions
 *
 * @example
 * ```typescript
 * const validator = new ValidationService({
 *   ollamaLimit: 6800,
 *   safetyMargin: 1000
 * });
 *
 * const result = validator.validatePromptSize(messages);
 * if (!result.valid) {
 *   console.error('Prompt too large:', result.errors);
 *   console.log('Suggestions:', result.suggestions);
 *   throw new Error('Cannot send oversized prompt');
 * }
 * ```
 */
export class ValidationService {
  private ollamaLimit: number;
  private safetyMargin: number;
  private tokenCounter: TokenCounterService;

  constructor(config: ValidationConfig) {
    this.ollamaLimit = config.ollamaLimit;
    this.safetyMargin = config.safetyMargin ?? 1000;
    this.tokenCounter = config.tokenCounter ?? new TokenCounterService();
  }

  /**
   * Validate prompt size against Ollama limit
   *
   * This is the main validation method that MUST be called before every
   * LLM request. It calculates total tokens and compares against the limit.
   *
   * Requirements: FR-5, FR-8
   *
   * @param messages - Messages to validate
   * @returns Validation result with suggestions if invalid
   *
   * @example
   * ```typescript
   * const result = validator.validatePromptSize(messages);
   * if (!result.valid) {
   *   // Handle validation failure
   *   for (const suggestion of result.suggestions) {
   *     console.log(`${suggestion.type}: ${suggestion.description}`);
   *   }
   * }
   * ```
   */
  validatePromptSize(messages: Message[]): ExtendedValidationResult {
    // Calculate total tokens
    const totalTokens = this.calculateTotalTokens(messages);

    // Check against Ollama limit
    const limitCheck = this.checkOllamaLimit(totalTokens);

    if (limitCheck.valid) {
      return {
        valid: true,
        tokens: totalTokens,
        limit: limitCheck.effectiveLimit,
        errors: [],
      };
    }

    // Generate suggestions for fixing the issue
    const suggestions = this.suggestActions(totalTokens, limitCheck.effectiveLimit, messages);

    return {
      valid: false,
      tokens: totalTokens,
      limit: limitCheck.effectiveLimit,
      overage: limitCheck.overage,
      errors: [
        `Prompt exceeds Ollama limit by ${limitCheck.overage} tokens`,
        `Total: ${totalTokens} tokens, Limit: ${limitCheck.effectiveLimit} tokens`,
      ],
      suggestions,
    };
  }

  /**
   * Calculate total tokens in messages
   *
   * Uses the token counter to sum up tokens across all messages,
   * including tool call overhead.
   *
   * Requirements: FR-5
   *
   * @param messages - Messages to count
   * @returns Total token count
   *
   * @example
   * ```typescript
   * const total = validator.calculateTotalTokens(messages);
   * console.log(`Total tokens: ${total}`);
   * ```
   */
  calculateTotalTokens(messages: Message[]): number {
    return this.tokenCounter.countConversationTokens(messages);
  }

  /**
   * Check if total tokens exceed Ollama limit
   *
   * Compares total tokens against the effective limit (ollamaLimit - safetyMargin).
   * The safety margin reserves space for the LLM's response.
   *
   * Requirements: FR-5, FR-8
   *
   * @param totalTokens - Total tokens to check
   * @returns Validation result with limit details
   *
   * @example
   * ```typescript
   * const check = validator.checkOllamaLimit(5000);
   * if (!check.valid) {
   *   console.log(`Over by ${check.overage} tokens`);
   * }
   * ```
   */
  checkOllamaLimit(totalTokens: number): {
    valid: boolean;
    effectiveLimit: number;
    overage?: number;
  } {
    const effectiveLimit = this.ollamaLimit - this.safetyMargin;

    if (totalTokens <= effectiveLimit) {
      return {
        valid: true,
        effectiveLimit,
      };
    }

    return {
      valid: false,
      effectiveLimit,
      overage: totalTokens - effectiveLimit,
    };
  }

  /**
   * Suggest actions to fix validation failure
   *
   * Analyzes the current state and suggests prioritized actions to reduce
   * token count and fit within the limit. Actions are ordered by priority.
   *
   * Requirements: FR-8
   *
   * @param totalTokens - Current total tokens
   * @param effectiveLimit - Effective limit (with safety margin)
   * @param messages - Current messages
   * @returns Array of suggested actions, ordered by priority
   *
   * @example
   * ```typescript
   * const suggestions = validator.suggestActions(7000, 5800, messages);
   * for (const action of suggestions) {
   *   console.log(`Priority ${action.priority}: ${action.description}`);
   *   console.log(`  Would free ~${action.estimatedTokensFreed} tokens`);
   * }
   * ```
   */
  suggestActions(
    totalTokens: number,
    effectiveLimit: number,
    messages: Message[]
  ): SuggestedAction[] {
    const overage = totalTokens - effectiveLimit;
    const suggestions: SuggestedAction[] = [];

    // Count different message types
    const assistantMessages = messages.filter((m) => m.role === 'assistant');
    const userMessages = messages.filter((m) => m.role === 'user');
    const systemMessages = messages.filter((m) => m.role === 'system');

    // Estimate tokens by role (for future use in detailed analysis)
    const _assistantTokens = assistantMessages.reduce(
      (sum, m) => sum + (m.tokenCount ?? this.tokenCounter.countTokensCached(m.id, m.content)),
      0
    );
    const _userTokens = userMessages.reduce(
      (sum, m) => sum + (m.tokenCount ?? this.tokenCounter.countTokensCached(m.id, m.content)),
      0
    );

    // Suggestion 1: Compress old messages (highest priority)
    if (assistantMessages.length > 5) {
      const oldMessages = assistantMessages.slice(0, -5);
      const oldTokens = oldMessages.reduce(
        (sum, m) => sum + (m.tokenCount ?? this.tokenCounter.countTokensCached(m.id, m.content)),
        0
      );
      const estimatedFreed = Math.floor(oldTokens * 0.7); // Assume 70% compression

      suggestions.push({
        type: 'compress',
        description: `Compress ${oldMessages.length} old assistant messages into a checkpoint`,
        estimatedTokensFreed: estimatedFreed,
        priority: 1,
      });
    }

    // Suggestion 2: Merge existing checkpoints (if we have checkpoints)
    // Note: We can't detect checkpoints from messages alone, but we can suggest it
    if (systemMessages.length > 1) {
      // Multiple system messages might indicate checkpoints
      const estimatedFreed = Math.floor(overage * 0.3);

      suggestions.push({
        type: 'merge_checkpoints',
        description: 'Merge older checkpoints to free space',
        estimatedTokensFreed: estimatedFreed,
        priority: 2,
      });
    }

    // Suggestion 3: Remove old user messages (medium priority)
    if (userMessages.length > 10) {
      const oldUserMessages = userMessages.slice(0, -10);
      const oldUserTokens = oldUserMessages.reduce(
        (sum, m) => sum + (m.tokenCount ?? this.tokenCounter.countTokensCached(m.id, m.content)),
        0
      );

      suggestions.push({
        type: 'remove_messages',
        description: `Remove ${oldUserMessages.length} old user messages`,
        estimatedTokensFreed: oldUserTokens,
        priority: 3,
      });
    }

    // Suggestion 4: Emergency rollover (last resort)
    if (overage > effectiveLimit * 0.5) {
      // If we're way over, suggest emergency rollover
      suggestions.push({
        type: 'emergency_rollover',
        description: 'Create snapshot and start fresh conversation',
        estimatedTokensFreed: totalTokens - (systemMessages[0]?.tokenCount ?? 0),
        priority: 4,
      });
    }

    // Sort by priority (lower number = higher priority)
    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Update the Ollama limit
   *
   * Useful when switching models or context sizes.
   *
   * @param newLimit - New Ollama context limit
   */
  setOllamaLimit(newLimit: number): void {
    this.ollamaLimit = newLimit;
  }

  /**
   * Update the safety margin
   *
   * @param newMargin - New safety margin in tokens
   */
  setSafetyMargin(newMargin: number): void {
    this.safetyMargin = newMargin;
  }

  /**
   * Get current configuration
   *
   * @returns Current validation configuration
   */
  getConfig(): {
    ollamaLimit: number;
    safetyMargin: number;
    effectiveLimit: number;
  } {
    return {
      ollamaLimit: this.ollamaLimit,
      safetyMargin: this.safetyMargin,
      effectiveLimit: this.ollamaLimit - this.safetyMargin,
    };
  }
}
