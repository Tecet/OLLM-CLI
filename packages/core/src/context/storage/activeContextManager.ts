/**
 * Active Context Manager
 * 
 * Manages the active context that gets sent to the LLM.
 * This is the ONLY data structure that should be sent to the LLM.
 * 
 * Key responsibilities:
 * - Build prompts for LLM from active context
 * - Add/remove messages from active context
 * - Add checkpoints (compressed summaries)
 * - Track token counts accurately
 * - Validate context size against limits
 * - Enforce token limits with safety margin
 * 
 * Requirements: FR-1, FR-5, FR-6
 * 
 * @module activeContextManager
 */

import { TokenCounterService } from '../tokenCounter.js';

import type { ActiveContext, CheckpointSummary } from '../types/storageTypes.js';
import type { Message } from '../types.js';

/**
 * Validation result for context operations
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Current token count */
  tokens: number;
  /** Token limit */
  limit: number;
  /** Overage amount (if invalid) */
  overage?: number;
  /** Error message (if invalid) */
  message?: string;
}

/**
 * Active Context Manager
 * 
 * Manages what gets sent to the LLM. Enforces token limits and maintains
 * accurate token counts across system prompt, checkpoints, and recent messages.
 * 
 * @example
 * ```typescript
 * const manager = new ActiveContextManager(systemPrompt, 6800, tokenCounter);
 * 
 * // Add messages
 * manager.addMessage(userMessage);
 * manager.addMessage(assistantMessage);
 * 
 * // Build prompt for LLM
 * const prompt = manager.buildPrompt(newUserMessage);
 * 
 * // Validate before sending
 * const validation = manager.validate();
 * if (!validation.valid) {
 *   throw new Error(validation.message);
 * }
 * ```
 */
export class ActiveContextManager {
  private context: ActiveContext;
  private ollamaLimit: number;
  private safetyMargin: number;
  private tokenCounter: TokenCounterService;

  /**
   * Create a new Active Context Manager
   * 
   * @param systemPrompt - System prompt message (built by PromptOrchestrator)
   * @param ollamaLimit - Ollama context limit (85% pre-calculated value)
   * @param tokenCounter - Token counter service for accurate counting
   * @param safetyMargin - Safety margin for response tokens (default: 1000)
   */
  constructor(
    systemPrompt: Message,
    ollamaLimit: number,
    tokenCounter: TokenCounterService,
    safetyMargin: number = 1000
  ) {
    this.ollamaLimit = ollamaLimit;
    this.tokenCounter = tokenCounter;
    this.safetyMargin = safetyMargin;

    // Initialize context with system prompt
    const systemTokens = this.tokenCounter.countTokensCached(
      systemPrompt.id,
      systemPrompt.content
    );

    this.context = {
      systemPrompt,
      checkpoints: [],
      recentMessages: [],
      tokenCount: {
        system: systemTokens,
        checkpoints: 0,
        recent: 0,
        total: systemTokens,
      },
    };
  }

  /**
   * Build prompt for LLM
   * 
   * Constructs the complete prompt array that will be sent to the LLM.
   * Includes system prompt, checkpoint summaries, recent messages, and optionally a new message.
   * 
   * **Order:**
   * 1. System prompt (always first)
   * 2. Checkpoint summaries (oldest to newest)
   * 3. Recent messages (oldest to newest)
   * 4. New message (if provided)
   * 
   * @param newMessage - Optional new message to append to prompt
   * @returns Complete prompt array for LLM
   * 
   * @example
   * ```typescript
   * // Build prompt without new message
   * const prompt = manager.buildPrompt();
   * 
   * // Build prompt with new user message
   * const promptWithNew = manager.buildPrompt(userMessage);
   * ```
   */
  buildPrompt(newMessage?: Message): Message[] {
    const prompt: Message[] = [
      // 1. System prompt (always first)
      this.context.systemPrompt,

      // 2. Checkpoint summaries as assistant messages
      ...this.context.checkpoints.map(cp => ({
        role: 'assistant' as const,
        content: cp.summary,
        id: cp.id,
        timestamp: new Date(cp.timestamp),
        parts: [{ type: 'text' as const, text: cp.summary }],
      })),

      // 3. Recent messages
      ...this.context.recentMessages,
    ];

    // 4. New message (if provided)
    if (newMessage) {
      prompt.push(newMessage);
    }

    return prompt;
  }

  /**
   * Add message to active context
   * 
   * Adds a new message to the recent messages array.
   * Validates that adding the message won't exceed the token limit.
   * 
   * **Throws** if adding the message would exceed the limit.
   * 
   * @param message - Message to add
   * @throws Error if adding message would exceed limit
   * 
   * @example
   * ```typescript
   * try {
   *   manager.addMessage(userMessage);
   * } catch (error) {
   *   console.error('Cannot add message:', error.message);
   *   // Trigger compression
   * }
   * ```
   */
  addMessage(message: Message): void {
    const messageTokens = this.tokenCounter.countTokensCached(
      message.id,
      message.content
    );

    const newTotal = this.context.tokenCount.total + messageTokens;
    const effectiveLimit = this.ollamaLimit - this.safetyMargin;

    if (newTotal > effectiveLimit) {
      throw new Error(
        `Cannot add message: would exceed limit (${newTotal} > ${effectiveLimit}). ` +
        `Current: ${this.context.tokenCount.total}, Adding: ${messageTokens}, ` +
        `Limit: ${effectiveLimit}`
      );
    }

    // Add message to recent messages
    this.context.recentMessages.push(message);

    // Update token counts
    this.context.tokenCount.recent += messageTokens;
    this.context.tokenCount.total += messageTokens;
  }

  /**
   * Add checkpoint summary
   * 
   * Adds a checkpoint summary to the active context.
   * Checkpoints are LLM-generated summaries of old conversation segments.
   * 
   * @param checkpoint - Checkpoint summary to add
   * 
   * @example
   * ```typescript
   * const checkpoint: CheckpointSummary = {
   *   id: 'ckpt_123',
   *   timestamp: Date.now(),
   *   summary: 'User requested file operations...',
   *   originalMessageIds: ['msg_1', 'msg_2'],
   *   tokenCount: 150,
   *   compressionLevel: 3,
   *   compressionNumber: 1,
   *   metadata: { model: 'llama3:8b', createdAt: Date.now() }
   * };
   * 
   * manager.addCheckpoint(checkpoint);
   * ```
   */
  addCheckpoint(checkpoint: CheckpointSummary): void {
    this.context.checkpoints.push(checkpoint);

    // Update token counts
    this.context.tokenCount.checkpoints += checkpoint.tokenCount;
    this.context.tokenCount.total += checkpoint.tokenCount;
  }

  /**
   * Remove messages that were compressed
   * 
   * Removes messages from the recent messages array by their IDs.
   * Typically called after creating a checkpoint to remove the messages
   * that were summarized.
   * 
   * @param messageIds - Array of message IDs to remove
   * 
   * @example
   * ```typescript
   * // After creating checkpoint, remove compressed messages
   * manager.removeMessages(['msg_1', 'msg_2', 'msg_3']);
   * ```
   */
  removeMessages(messageIds: string[]): void {
    const idsSet = new Set(messageIds);

    // Find messages to remove and calculate their token count
    const removed = this.context.recentMessages.filter(m => idsSet.has(m.id));
    const removedTokens = removed.reduce((sum, m) => {
      return sum + this.tokenCounter.countTokensCached(m.id, m.content);
    }, 0);

    // Filter out removed messages
    this.context.recentMessages = this.context.recentMessages.filter(
      m => !idsSet.has(m.id)
    );

    // Update token counts
    this.context.tokenCount.recent -= removedTokens;
    this.context.tokenCount.total -= removedTokens;
  }

  /**
   * Get current token count
   * 
   * Returns the total token count across system prompt, checkpoints, and recent messages.
   * 
   * @returns Total token count
   * 
   * @example
   * ```typescript
   * const total = manager.getTokenCount();
   * console.log(`Current context: ${total} tokens`);
   * ```
   */
  getTokenCount(): number {
    return this.context.tokenCount.total;
  }

  /**
   * Get available tokens
   * 
   * Returns the number of tokens available before hitting the limit.
   * Accounts for the safety margin reserved for the response.
   * 
   * @returns Available token count
   * 
   * @example
   * ```typescript
   * const available = manager.getAvailableTokens();
   * if (available < 500) {
   *   console.log('Context nearly full, consider compression');
   * }
   * ```
   */
  getAvailableTokens(): number {
    const effectiveLimit = this.ollamaLimit - this.safetyMargin;
    return effectiveLimit - this.context.tokenCount.total;
  }

  /**
   * Validate context size
   * 
   * Validates that the current context size is within the token limit.
   * Returns a validation result with details about the validation.
   * 
   * @returns Validation result
   * 
   * @example
   * ```typescript
   * const validation = manager.validate();
   * if (!validation.valid) {
   *   console.error(`Context too large: ${validation.message}`);
   *   console.error(`Overage: ${validation.overage} tokens`);
   * }
   * ```
   */
  validate(): ValidationResult {
    const total = this.context.tokenCount.total;
    const effectiveLimit = this.ollamaLimit - this.safetyMargin;

    if (total <= effectiveLimit) {
      return {
        valid: true,
        tokens: total,
        limit: effectiveLimit,
      };
    }

    return {
      valid: false,
      tokens: total,
      limit: effectiveLimit,
      overage: total - effectiveLimit,
      message: `Context exceeds limit by ${total - effectiveLimit} tokens (${total} > ${effectiveLimit})`,
    };
  }

  /**
   * Get context state
   * 
   * Returns a copy of the current active context state.
   * Useful for debugging and inspection.
   * 
   * @returns Copy of active context
   * 
   * @example
   * ```typescript
   * const state = manager.getState();
   * console.log(`Checkpoints: ${state.checkpoints.length}`);
   * console.log(`Recent messages: ${state.recentMessages.length}`);
   * console.log(`Total tokens: ${state.tokenCount.total}`);
   * ```
   */
  getState(): ActiveContext {
    return {
      systemPrompt: this.context.systemPrompt,
      checkpoints: [...this.context.checkpoints],
      recentMessages: [...this.context.recentMessages],
      tokenCount: { ...this.context.tokenCount },
    };
  }

  /**
   * Get system prompt
   * 
   * Returns the system prompt message.
   * 
   * @returns System prompt message
   */
  getSystemPrompt(): Message {
    return this.context.systemPrompt;
  }

  /**
   * Get checkpoints
   * 
   * Returns a copy of the checkpoints array.
   * 
   * @returns Array of checkpoint summaries
   */
  getCheckpoints(): CheckpointSummary[] {
    return [...this.context.checkpoints];
  }

  /**
   * Get recent messages
   * 
   * Returns a copy of the recent messages array.
   * 
   * @returns Array of recent messages
   */
  getRecentMessages(): Message[] {
    return [...this.context.recentMessages];
  }

  /**
   * Get Ollama limit
   * 
   * Returns the Ollama context limit (85% pre-calculated value).
   * 
   * @returns Ollama context limit in tokens
   */
  getOllamaLimit(): number {
    return this.ollamaLimit;
  }

  /**
   * Update Ollama context limit
   * 
   * Updates the ollama limit when context size changes dynamically.
   * This allows resizing without creating a new session.
   * 
   * @param newLimit - New ollama context limit (85% of context size)
   */
  updateOllamaLimit(newLimit: number): void {
    this.ollamaLimit = newLimit;
  }

  /**
   * Update system prompt
   * 
   * Updates the system prompt when mode or tier changes.
   * Recalculates token counts for the new prompt.
   * 
   * @param newSystemPrompt - New system prompt message
   */
  updateSystemPrompt(newSystemPrompt: Message): void {
    // Count tokens for new system prompt
    const newSystemTokens = this.tokenCounter.countTokensCached(
      newSystemPrompt.id,
      newSystemPrompt.content
    );

    // Update context
    this.context.systemPrompt = newSystemPrompt;
    
    // Recalculate total tokens
    const oldSystemTokens = this.context.tokenCount.system;
    this.context.tokenCount.system = newSystemTokens;
    this.context.tokenCount.total = 
      this.context.tokenCount.total - oldSystemTokens + newSystemTokens;
  }

  /**
   * Get safety margin
   * 
   * Returns the safety margin reserved for the response.
   * 
   * @returns Safety margin in tokens
   */
  getSafetyMargin(): number {
    return this.safetyMargin;
  }

  /**
   * Set safety margin
   * 
   * Updates the safety margin reserved for the response.
   * 
   * @param margin - New safety margin in tokens
   */
  setSafetyMargin(margin: number): void {
    this.safetyMargin = margin;
  }
}
