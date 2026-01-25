import { createLogger } from '../utils/logger.js';
/**
 * Compression Service
 * 
 * Manages context compression using multiple strategies to reduce token usage while
 * preserving conversation quality and critical information.
 * 
 * ## Compression Strategies
 * 
 * ### 1. Truncate Strategy
 * - Removes oldest messages until under target token count
 * - Always preserves system prompt and user messages
 * - Fast and deterministic
 * - Best for: Simple token reduction without LLM overhead
 * 
 * ### 2. Summarize Strategy
 * - Uses LLM to generate summary of older messages
 * - Preserves recent messages verbatim
 * - Requires provider and model configuration
 * - Best for: Maintaining conversation context with semantic compression
 * 
 * ### 3. Hybrid Strategy
 * - Combines truncation and summarization
 * - Truncates very old messages, summarizes middle messages, preserves recent
 * - Supports recursive summarization (merges previous summaries)
 * - Best for: Long conversations requiring multiple compression cycles
 * 
 * ## Preservation Rules
 * 
 * - **User messages**: NEVER compressed - always preserved in full
 * - **System prompts**: Always preserved (first system message)
 * - **Recent messages**: Preserved based on `preserveRecent` token budget
 * - **Fractional preservation**: Keeps at least 30% of total tokens as recent history
 * 
 * ## Performance Characteristics
 * 
 * - **Truncate**: O(n) time, no LLM calls, instant
 * - **Summarize**: O(n) + LLM call (~2-5s), high quality compression
 * - **Hybrid**: O(n) + LLM call (~2-5s), best compression ratio
 * 
 * ## Token Counting
 * 
 * - Uses TokenCounter service if available for accurate counts
 * - Falls back to estimation (4 chars ≈ 1 token)
 * - Adds overhead for tool calls (50 tokens per call)
 * 
 * ## Inflation Guard
 * 
 * Prevents compression from increasing token count:
 * - Compares compressed vs original token counts
 * - Sets status='inflated' if compression fails
 * - Caller can decide whether to use compressed result
 * 
 * @example
 * ```typescript
 * const service = new CompressionService(provider, model, tokenCounter);
 * 
 * const compressed = await service.compress(messages, {
 *   type: 'hybrid',
 *   preserveRecent: 4096,
 *   summaryMaxTokens: 1024
 * });
 * 
 * if (compressed.status === 'success') {
 *   // Use compressed context
 *   const newMessages = [compressed.summary, ...compressed.preserved];
 * }
 * ```
 */

import type {
  Message,
  ICompressionService,
  CompressionStrategy,
  CompressedContext,
  CompressionEstimate,
  TokenCounter,
} from './types.js';

const logger = createLogger('compressionService');

/**
 * Provider adapter interface for LLM-based summarization
 * 
 * Defines the contract for LLM providers used in compression.
 * Only the chatStream method is required for summarization.
 */
export interface ProviderAdapter {
  /**
   * Stream chat responses from the LLM
   * 
   * @param params - Chat parameters including model, messages, and options
   * @param params.model - Model name to use for summarization
   * @param params.messages - Messages to send to the LLM
   * @param params.options - Optional generation parameters
   * @param params.options.maxTokens - Maximum tokens in response
   * @param params.options.temperature - Sampling temperature (0-1)
   * @param params.timeout - Optional timeout in milliseconds
   * @param params.abortSignal - Optional abort signal for cancellation
   * @returns Async iterable of text or error events
   */
  chatStream(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    options?: {
      maxTokens?: number;
      temperature?: number;
    };
    timeout?: number;
    abortSignal?: AbortSignal;
  }): AsyncIterable<
    | { type: 'text'; value: string }
    | { type: 'error'; error: { message: string } }
  >;
}

/**
 * Default tool call overhead in tokens
 * 
 * Each tool call adds approximately 50 tokens of overhead for:
 * - Tool name and parameters
 * - JSON structure
 * - Function call formatting
 */
const TOOL_CALL_OVERHEAD = 50;

/**
 * Compression Service Implementation
 * 
 * Implements three compression strategies:
 * - Summarize: Use LLM to create summary of older messages
 * - Truncate: Remove oldest messages while preserving system prompt
 * - Hybrid: Combine summarization and truncation
 * 
 * ## Performance Notes
 * 
 * ### Token Counting Performance
 * - With TokenCounter: O(1) cached lookups, ~0.1ms per message
 * - Without TokenCounter: O(n) estimation, ~0.01ms per message
 * - Conversation counting: O(n) where n = message count
 * 
 * ### Compression Performance
 * - **Truncate**: O(n) iteration, no I/O, <10ms for 1000 messages
 * - **Summarize**: O(n) + LLM call, 2-5s depending on model speed
 * - **Hybrid**: O(n) + LLM call, 2-5s depending on model speed
 * 
 * ### Memory Usage
 * - Temporary arrays during compression: O(n) space
 * - LLM summarization: Additional O(m) where m = summary length
 * - No persistent caching (stateless service)
 * 
 * ### Optimization Tips
 * - Use TokenCounter for accurate, cached token counts
 * - Truncate strategy for instant compression without LLM overhead
 * - Increase preserveRecent to reduce compression frequency
 * - Lower summaryMaxTokens for faster LLM calls
 */
export class CompressionService implements ICompressionService {
  private provider?: ProviderAdapter;
  private model?: string;
  private tokenCounter?: TokenCounter;

  /**
   * Create a new CompressionService
   * 
   * @param provider - Optional provider adapter for LLM-based summarization
   * @param model - Optional model name to use for summarization
   * @param tokenCounter - Optional token counter service for accurate token counting
   */
  constructor(provider?: ProviderAdapter, model?: string, tokenCounter?: TokenCounter) {
    this.provider = provider;
    this.model = model;
    this.tokenCounter = tokenCounter;
  }

  /**
   * Set the provider and model for LLM-based summarization
   * 
   * @param provider - Provider adapter
   * @param model - Model name
   */
  setProvider(provider: ProviderAdapter, model: string): void {
    this.provider = provider;
    this.model = model;
  }

  /**
   * Set the token counter service
   * 
   * @param tokenCounter - Token counter service
   */
  setTokenCounter(tokenCounter: TokenCounter): void {
    this.tokenCounter = tokenCounter;
  }

  /**
   * Compress messages using specified strategy
   * 
   * @param messages - Messages to compress
   * @param strategy - Compression strategy configuration
   * @returns Compressed context with summary and preserved messages
   */
  async compress(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    const originalTokens = this.countMessagesTokens(messages);

    let result: CompressedContext;

    switch (strategy.type) {
      case 'truncate':
        result = this.truncate(messages, strategy);
        break;
      case 'summarize':
        result = await this.summarize(messages, strategy);
        break;
      case 'hybrid':
        result = await this.hybrid(messages, strategy);
        break;
      default:
        throw new Error(`Unknown compression strategy: ${strategy.type}`);
    }

    // Ensure originalTokens is set correctly
    result.originalTokens = originalTokens;

    // Inflation Guard: Verify token reduction 
    if (result.compressedTokens >= originalTokens && originalTokens > 0) {
      result.status = 'inflated';
      // If inflated, we "fail" the compression and keep original messages
      // Note: In a real system, we might want to return the original messages here,
      // but CompressedContext structure expects summary + preserved.
      // We'll let the manager decide how to handle 'inflated' status.
    } else {
      result.status = 'success';
    }

    return result;
  }

  /**
   * Estimate compression without performing it
   * 
   * @param messages - Messages to estimate compression for
   * @returns Compression estimate with predicted token count and ratio
   */
  estimateCompression(messages: Message[]): CompressionEstimate {
    const originalTokens = this.countMessagesTokens(messages);
    
    // Estimate 50% compression for summarize strategy
    // This is a conservative estimate
    const estimatedTokens = Math.ceil(originalTokens * 0.5);
    const estimatedRatio = estimatedTokens / originalTokens;

    return {
      estimatedTokens,
      estimatedRatio,
      strategy: {
        type: 'summarize',
        preserveRecent: 4096,
        summaryMaxTokens: 1024,
      },
    };
  }

  /**
   * The fraction of the latest chat history to keep verbatim during compression.
   * 
   * This ensures that as context grows, we don't truncate too aggressively.
   * With a value of 0.3, we preserve at least 30% of the total token count
   * as recent history, even if it exceeds the configured preserveRecent value.
   * 
   * @example
   * If total context is 10,000 tokens and preserveRecent is 2,000:
   * - Fractional preserve = 10,000 * 0.3 = 3,000 tokens
   * - Actual preserve = max(2,000, 3,000) = 3,000 tokens
   */
  private readonly COMPRESSION_PRESERVE_FRACTION = 0.3;

  /**
   * Check if compression is needed
   * 
   * @param tokenCount - Current token count
   * @param threshold - Threshold percentage (0-1)
   * @returns true if compression should be triggered
   */
  shouldCompress(tokenCount: number, threshold: number): boolean {
    // This would typically compare against a max token limit
    // For now, we just check if we're above the threshold
    return tokenCount > threshold;
  }

  /**
   * Calculate how many tokens to preserve based on a fraction of total tokens
   * 
   * @param messages - Messages to analyze
   * @param basePreserveRecent - The minimum tokens to preserve from config
   * @returns Dynamic token budget for preserved messages
   */
  private calculatePreserveTokens(
    messages: Message[],
    basePreserveRecent: number
  ): number {
    const totalTokens = this.countMessagesTokens(messages);
    const fractionalPreserve = Math.ceil(totalTokens * this.COMPRESSION_PRESERVE_FRACTION);
    
    // Use the larger of the two to ensure we keep a healthy amount of recent history
    return Math.max(basePreserveRecent, fractionalPreserve);
  }

  /**
   * Truncate strategy: Remove oldest messages (excluding USER) until under target
   * Always preserves system prompt (first message with role='system')
   * NEVER compresses user messages - they are preserved separately
   * 
   * @param messages - Messages to compress
   * @param strategy - Compression strategy configuration
   * @returns Compressed context
   */
  private truncate(
    messages: Message[],
    strategy: CompressionStrategy
  ): CompressedContext {
    if (messages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved: [],
        originalTokens: 0,
        compressedTokens: 0,
        compressionRatio: 0,
      };
    }

    // NEVER compress user messages - isolate them to strict preservation
    const userMessages = messages.filter((m) => m.role === 'user');
    
    // Candidates for truncation: everything else
    const nonUserMessages = messages.filter((m) => m.role !== 'user');

    // Always preserve system prompt if it exists (Requirement 5.2)
    const systemPromptMessage = nonUserMessages.find((m) => m.role === 'system');
    
    // Messages actually eligible for removal (Assistant, Tool, etc., minus system prompt)
    const removableMessages = nonUserMessages.filter((m) => m.role !== 'system');

    // Calculate target tokens for preserved messages (Fractional Preservation)
    // IMPORTANT: The budget applies to the *removable* messages we keep
    const targetTokens = this.calculatePreserveTokens(
      removableMessages,
      strategy.preserveRecent
    );

    // Start from the end and work backwards, keeping messages until we hit the target
    const preservedRemovable: Message[] = [];
    let currentTokens = 0;

    for (let i = removableMessages.length - 1; i >= 0; i--) {
      const message = removableMessages[i];
      const messageTokens = this.countMessageTokens(message);

      if (currentTokens + messageTokens <= targetTokens) {
        preservedRemovable.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Stop adding messages once we exceed target
        break;
      }
    }

    // Reassemble: System Prompt + All User Messages + Preserved Assistant/Tool
    const allPreserved = [
        ...userMessages,
        ...(systemPromptMessage ? [systemPromptMessage] : []),
        ...preservedRemovable
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Create summary message indicating truncation
    const truncatedCount = removableMessages.length - preservedRemovable.length;
    // Only create summary if we actually removed something
    const summary = truncatedCount > 0 
        ? this.createTruncationSummary(truncatedCount)
        : null;

    // Calculate tokens
    const userTokens = this.countMessagesTokens(userMessages);
    const systemTokens = systemPromptMessage ? this.countMessageTokens(systemPromptMessage) : 0;
    const preservedRemovableTokens = this.countMessagesTokens(preservedRemovable);
    
    const compressedTokens = (summary ? this.countMessageTokens(summary) : 0) + 
                             preservedRemovableTokens + 
                             userTokens + 
                             systemTokens;
                             
    const originalTokens = this.countMessagesTokens(messages);

    return {
      summary: summary || this.createEmptySummary(), // fallback for type safety
      preserved: allPreserved,
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      // If we didn't actually compress anything (summary is null), we might want to signal that,
      // but for now we follow the interface.
    };
  }

  /**
   * Summarize strategy: Use LLM to generate summary of older messages (excluding USER)
   * Preserves system prompt and recent messages, replaces old messages with summary
   * NEVER compresses user messages - they are preserved separately
   * 
   * @param messages - Messages to compress
   * @param strategy - Compression strategy configuration
   * @returns Compressed context with summary
   */
  private async summarize(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    if (messages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved: [],
        originalTokens: 0,
        compressedTokens: 0,
        compressionRatio: 0,
      };
    }

    // NEVER compress user messages - isolate them
    const userMessages = messages.filter((m) => m.role === 'user');
    
    // Candidates for summarization
    const nonUserMessages = messages.filter((m) => m.role !== 'user');

    // Always preserve system prompt
    const systemPromptMessage = nonUserMessages.find((m) => m.role === 'system');
    
    // Messages eligible for summarization (Assistant, Tool, excluding system prompt)
    const summarizableMessages = nonUserMessages.filter((m) => m.role !== 'system');

    if (summarizableMessages.length === 0) {
       // Nothing to summarize (only system/user messages present)
       const allPreserved = messages.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
       return {
        summary: this.createEmptySummary(),
        preserved: allPreserved,
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: this.countMessagesTokens(messages),
        compressionRatio: 1,
      };
    }

    // Calculate how many recent tokens to preserve (Fractional Preservation)
    const recentTokenBudget = this.calculatePreserveTokens(
      summarizableMessages,
      strategy.preserveRecent
    );

    // Find recent messages to preserve (don't summarize these)
    const preservedRecent: Message[] = [];
    let recentTokens = 0;

    for (let i = summarizableMessages.length - 1; i >= 0; i--) {
      const message = summarizableMessages[i];
      const messageTokens = this.countMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        preservedRecent.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    // Messages to summarize are the older ones
    const messagesToSummarize = summarizableMessages.slice(
      0,
      summarizableMessages.length - preservedRecent.length
    );

    if (messagesToSummarize.length === 0) {
      // Nothing old enough to summarize
      const allPreserved = messages.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime());
       return {
        summary: this.createEmptySummary(),
        preserved: allPreserved,
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: this.countMessagesTokens(messages),
        compressionRatio: 1,
      };
    }

    // Generate summary using LLM if available (Requirement 5.1)
    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummary(
          messagesToSummarize,
          strategy.summaryMaxTokens,
          strategy.summaryTimeout
        );
      } catch (error) {
        // Fall back to placeholder if LLM summarization fails
        logger.warn('LLM summarization failed, using placeholder:', error);
        summaryText = this.createSummaryPlaceholder(messagesToSummarize);
      }
    } else {
      summaryText = this.createSummaryPlaceholder(messagesToSummarize);
    }

    const summary: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: summaryText,
      timestamp: new Date(),
    };

    // Reassemble: System Prompt + All User Messages + Preserved Recent Assistant/Tool
    const allPreserved = [
        ...userMessages,
        ...(systemPromptMessage ? [systemPromptMessage] : []),
        ...preservedRecent
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate tokens
    const userTokens = this.countMessagesTokens(userMessages);
    const systemTokens = systemPromptMessage ? this.countMessageTokens(systemPromptMessage) : 0;
    const recentPreservedTokens = this.countMessagesTokens(preservedRecent);
    
    // Note: The summary is technically "added" to the context, replacing the summarized messages
    const compressedTokens = this.countMessageTokens(summary) + 
                             recentPreservedTokens + 
                             userTokens + 
                             systemTokens;
    const originalTokens = this.countMessagesTokens(messages);

    return {
      summary,
      preserved: allPreserved,
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
    };
  }

  /**
   * Hybrid strategy: Combine summarize and truncate (Requirement 5.3)
   * Summarizes middle messages, truncates oldest, preserves recent
   * NEVER compresses user messages - they are preserved separately
   * 
   * @param messages - Messages to compress
   * @param strategy - Compression strategy configuration
   * @returns Compressed context
   */
  private async hybrid(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    if (messages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved: [],
        originalTokens: 0,
        compressedTokens: 0,
        compressionRatio: 0,
      };
    }

    // NEVER compress user messages - isolate them
    const userMessages = messages.filter((m) => m.role === 'user');
    const nonUserMessages = messages.filter((m) => m.role !== 'user');

    // Always preserve system prompt if it exists
    const _systemPrompt = nonUserMessages.find((m) => m.role === 'system');

    // RECURSIVE LOGIC: Look for existing summary to merge
    let previousSummary: string | undefined;
    const existingSummaryIndex = nonUserMessages.findIndex(m => 
        m.role === 'system' && m.content.startsWith('[Recursive Context Summary]')
    );

    if (existingSummaryIndex !== -1) {
        // Extract content
        const summaryMsg = nonUserMessages[existingSummaryIndex];
        previousSummary = summaryMsg.content.replace('[Recursive Context Summary]\n', '');
        
        // Remove old summary from valid messages
        nonUserMessages.splice(existingSummaryIndex, 1);
    }
    
    // Valid non-system messages
    const nonSystemMessages = nonUserMessages.filter((m) => m.role !== 'system');

    if (nonSystemMessages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved: userMessages,
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: this.countMessagesTokens(userMessages),
        compressionRatio: this.countMessagesTokens(userMessages) / this.countMessagesTokens(messages),
      };
    }

    // Calculate token budget (Fractional Preservation)
    const recentTokenBudget = this.calculatePreserveTokens(
      nonSystemMessages,
      strategy.preserveRecent
    );

    // Find recent messages to preserve
    const preserved: Message[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = this.countMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        preserved.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    // Messages to process are everything not in recent
    const olderMessages = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - preserved.length
    );

    if (olderMessages.length === 0 && !previousSummary) {
      // Nothing to compress, add user messages back and return
      const allPreserved = [...userMessages, ...preserved]
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const userTokens = this.countMessagesTokens(userMessages);
      return {
        summary: this.createEmptySummary(),
        preserved: allPreserved,
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: recentTokens + userTokens,
        compressionRatio: (recentTokens + userTokens) / this.countMessagesTokens(messages),
      };
    }

    // Split older messages into "very old" (truncate) and "middle" (summarize)
    const splitPoint = Math.floor(olderMessages.length * 0.5);
    const middleMessages = olderMessages.slice(splitPoint);
    // veryOldMessages are implicitly truncated by not including them in summary

    // Generate summary of middle messages using LLM if available
    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummary(
          middleMessages,
          strategy.summaryMaxTokens,
          strategy.summaryTimeout,
          previousSummary // Pass previous summary for merging
        );
      } catch (error) {
        // Fall back to placeholder if LLM summarization fails
        logger.warn(
          'LLM summarization failed in hybrid strategy, using placeholder:',
          error
        );
        summaryText = this.createSummaryPlaceholder(middleMessages);
      }
    } else {
      summaryText = this.createSummaryPlaceholder(middleMessages);
    }

    const truncatedCount = olderMessages.length - middleMessages.length;
    const summaryWithTruncation = `${summaryText}\n\n[${truncatedCount} older messages truncated]`;

    const summary: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: summaryWithTruncation,
      timestamp: new Date(),
    };

    // Reassemble: System Prompt + All User Messages + Preserved Recent
    const allPreserved = [
        ...userMessages,
        ...(_systemPrompt ? [_systemPrompt] : []),
        ...preserved
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate tokens
    const userTokens = this.countMessagesTokens(userMessages);
    const systemTokens = _systemPrompt ? this.countMessageTokens(_systemPrompt) : 0;
    const recentPreservedTokens = this.countMessagesTokens(preserved);
    
    const compressedTokens = this.countMessageTokens(summary) + 
                             recentPreservedTokens + 
                             userTokens + 
                             systemTokens;
    const originalTokens = this.countMessagesTokens(messages);

    return {
      summary,
      preserved: allPreserved,
      originalTokens,
      compressedTokens,
      compressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
    };
  }

  /**
   * Generate a summary using the LLM with Recursive/Rolling logic
   * 
   * @param messages - Messages to summarize
   * @param maxTokens - Maximum tokens for the summary
   * @param previousSummary - (Optional) Content of the previous summary to merge
   * @returns Summary text
   */
  private async generateLLMSummary(
    messages: Message[],
    maxTokens: number,
    timeoutMs?: number,
    previousSummary?: string
  ): Promise<string> {
    if (!this.provider || !this.model) {
      throw new Error('Provider and model must be set for LLM summarization');
    }

    // Convert Messages to conversation text
    const conversationText = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    let summaryPrompt = '';

    if (previousSummary) {
        // RECURSIVE MODE: We have a previous summary, so we must merge and update
        summaryPrompt = `You are a specialized Context Compressor. Your goal is to maintain a coherent "Long-Term Memory" for an AI session.

INPUTS:
1. PREVIOUS SUMMARY: A summary of the conversation up to this point.
2. NEW CONVERSATION: Recent messages that need to be compressed.

INSTRUCTIONS:
- Combine the PREVIOUS SUMMARY and NEW CONVERSATION into a single, updated summary.
- You MUST structure the output into two distinct sections:
  1. "🎯 Active Goals": The current high-level objectives and immediate next steps. Keep this precise.
  2. "📜 History Archive": A highly compressed chronological history of key decisions, actions taken, and established facts.
- Drop irrelevant details from the archives but preserve technical specifics (file paths, variable names) if they are still relevant to the Active Goals.
- Keep the total output under ${maxTokens} tokens.

PREVIOUS SUMMARY:
${previousSummary}

NEW CONVERSATION:
${conversationText}

Updated Summary:`;
    } else {
        // FRESH MODE: First time encoding
        summaryPrompt = `You are a specialized Context Compressor. Your goal is to create a long-term memory for this conversation.

INSTRUCTIONS:
- Summarize the provided conversation.
- You MUST structure the output into two distinct sections:
  1. "🎯 Active Goals": The current high-level objectives and immediate next steps.
  2. "📜 History Archive": A chronological history of key decisions and actions.
- Keep the total output under ${maxTokens} tokens.

Conversation:
${conversationText}

Summary:`;
    }

    // Call the LLM to generate the summary
    const providerMessages = [
      {
        role: 'user',
        content: summaryPrompt,
      },
    ];

    let summaryText = '';

    try {
      // Pass timeout to provider if available (defaults to 2 minutes)
      const timeout = timeoutMs ?? 120000;
      for await (const event of this.provider.chatStream({
        model: this.model,
        messages: providerMessages,
        options: {
            maxTokens: maxTokens + 100, // Allowance for structure
            temperature: 0.2, // Low temp for factual consistency
        },
        timeout,
      })) {
        if (event.type === 'text') {
          summaryText += event.value;
        } else if (event.type === 'error') {
          throw new Error(event.error.message);
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to generate LLM summary: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!summaryText.trim()) {
      throw new Error('LLM returned empty summary');
    }

    return `[Recursive Context Summary]\n${summaryText.trim()}`;
  }

  /**
   * Create a placeholder summary text
   * 
   * @param messages - Messages to summarize
   * @returns Summary text
   */
  private createSummaryPlaceholder(messages: Message[]): string {
    const messageCount = messages.length;
    return `[Conversation summary: ${messageCount} messages compressed (LLM unavailable)]`;
  }

  /**
   * Create a truncation summary message
   * 
   * @param truncatedCount - Number of messages truncated
   * @returns Summary message
   */
  private createTruncationSummary(truncatedCount: number): Message {
    return {
      id: `truncation-${Date.now()}`,
      role: 'system',
      content: `[${truncatedCount} older messages truncated to manage context size]`,
      timestamp: new Date(),
    };
  }

  /**
   * Create an empty summary message
   * 
   * @returns Empty summary message
   */
  private createEmptySummary(): Message {
    return {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: '[No messages to compress]',
      timestamp: new Date(),
    };
  }

  /**
   * Count tokens in a single message
   * Uses TokenCounterService if available, otherwise falls back to estimation
   * 
   * @param message - Message to count
   * @returns Token count
   */
  private countMessageTokens(message: Message): number {
    // Use TokenCounterService if available
    if (this.tokenCounter) {
      // Use cached count if available
      const count = this.tokenCounter.countTokensCached(message.id, message.content);
      
      // Add tool call overhead if present
      if (message.metadata?.toolCalls) {
        return count + (message.metadata.toolCalls.length * TOOL_CALL_OVERHEAD);
      }
      
      return count;
    }
    
    // Fallback to estimation
    const contentTokens = Math.ceil(message.content.length / 4);
    // Add overhead for role and structure
    let total = contentTokens + 10;
    
    // Add tool call overhead if present
    if (message.metadata?.toolCalls) {
      total += message.metadata.toolCalls.length * TOOL_CALL_OVERHEAD;
    }
    
    return total;
  }

  /**
   * Count tokens in an array of messages
   * Uses TokenCounterService if available for accurate counting
   * 
   * @param messages - Messages to count
   * @returns Total token count
   */
  private countMessagesTokens(messages: Message[]): number {
    // Use TokenCounterService if available
    if (this.tokenCounter) {
      return this.tokenCounter.countConversationTokens(messages);
    }
    
    // Fallback to local counting
    return messages.reduce(
      (sum, msg) => sum + this.countMessageTokens(msg),
      0
    );
  }
}
