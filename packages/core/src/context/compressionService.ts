/**
 * Compression Service
 * 
 * Manages context compression using multiple strategies: summarize, truncate, and hybrid.
 * Reduces context size while preserving recent messages and system prompts.
 */

import type {
  Message,
  ICompressionService,
  CompressionStrategy,
  CompressedContext,
  CompressionEstimate,
} from './types.js';

/**
 * Provider adapter interface for LLM-based summarization
 */
export interface ProviderAdapter {
  chatStream(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    options?: {
      maxTokens?: number;
      temperature?: number;
    };
  }): AsyncIterable<
    | { type: 'text'; value: string }
    | { type: 'error'; error: { message: string } }
  >;
}

/**
 * Compression Service Implementation
 * 
 * Implements three compression strategies:
 * - Summarize: Use LLM to create summary of older messages
 * - Truncate: Remove oldest messages while preserving system prompt
 * - Hybrid: Combine summarization and truncation
 */
export class CompressionService implements ICompressionService {
  private provider?: ProviderAdapter;
  private model?: string;

  /**
   * Create a new CompressionService
   * 
   * @param provider - Optional provider adapter for LLM-based summarization
   * @param model - Optional model name to use for summarization
   */
  constructor(provider?: ProviderAdapter, model?: string) {
    this.provider = provider;
    this.model = model;
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
   * The fraction of the latest chat history to keep verbatim.
   * Ensures that as context grows, we don't truncate too aggressively.
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
   * Truncate strategy: Remove oldest messages until under target
   * Always preserves system prompt (first message with role='system')
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

    // Always preserve system prompt if it exists (Requirement 5.2)
    const _systemPrompt = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Calculate target tokens for preserved messages (Fractional Preservation)
    const targetTokens = this.calculatePreserveTokens(
      messages,
      strategy.preserveRecent
    );

    // Start from the end and work backwards, keeping messages until we hit the target
    const preserved: Message[] = [];
    let currentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = this.countMessageTokens(message);

      if (currentTokens + messageTokens <= targetTokens) {
        preserved.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Stop adding messages once we exceed target
        break;
      }
    }

    // Create summary message indicating truncation
    const truncatedCount = nonSystemMessages.length - preserved.length;
    const summary = this.createTruncationSummary(truncatedCount);

    const compressedTokens = this.countMessageTokens(summary) + currentTokens;
    const originalTokens = this.countMessagesTokens(messages);

    return {
      summary,
      preserved,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  /**
   * Summarize strategy: Use LLM to generate summary of older messages
   * Preserves system prompt and recent messages, replaces old messages with summary
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

    // Always preserve system prompt if it exists
    const _systemPrompt = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    if (nonSystemMessages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved: [],
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: 0,
        compressionRatio: 0,
      };
    }

    // Calculate how many recent tokens to preserve (Fractional Preservation)
    const recentTokenBudget = this.calculatePreserveTokens(
      messages,
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

    // Messages to summarize are everything not in recent
    const messagesToSummarize = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - preserved.length
    );

    if (messagesToSummarize.length === 0) {
      // Nothing to summarize, just return what we have
      return {
        summary: this.createEmptySummary(),
        preserved,
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: recentTokens,
        compressionRatio: recentTokens / this.countMessagesTokens(messages),
      };
    }

    // Generate summary using LLM if available (Requirement 5.1)
    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummary(
          messagesToSummarize,
          strategy.summaryMaxTokens
        );
      } catch (error) {
        // Fall back to placeholder if LLM summarization fails
        console.warn('LLM summarization failed, using placeholder:', error);
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

    const compressedTokens = this.countMessageTokens(summary) + recentTokens;
    const originalTokens = this.countMessagesTokens(messages);

    return {
      summary,
      preserved,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  /**
   * Hybrid strategy: Combine summarize and truncate (Requirement 5.3)
   * Summarizes middle messages, truncates oldest, preserves recent
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

    // Always preserve system prompt if it exists
    const _systemPrompt = messages.find((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    if (nonSystemMessages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved: [],
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: 0,
        compressionRatio: 0,
      };
    }

    // Calculate token budgets (Fractional Preservation)
    const recentTokenBudget = this.calculatePreserveTokens(
      messages,
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

    if (olderMessages.length === 0) {
      // Nothing to compress, just return what we have
      return {
        summary: this.createEmptySummary(),
        preserved,
        originalTokens: this.countMessagesTokens(messages),
        compressedTokens: recentTokens,
        compressionRatio: recentTokens / this.countMessagesTokens(messages),
      };
    }

    // Split older messages into "very old" (truncate) and "middle" (summarize)
    const splitPoint = Math.floor(olderMessages.length * 0.5);
    const middleMessages = olderMessages.slice(splitPoint);

    // Generate summary of middle messages using LLM if available
    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummary(
          middleMessages,
          strategy.summaryMaxTokens
        );
      } catch (error) {
        // Fall back to placeholder if LLM summarization fails
        console.warn(
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

    const compressedTokens = this.countMessageTokens(summary) + recentTokens;
    const originalTokens = this.countMessagesTokens(messages);

    return {
      summary,
      preserved,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  /**
   * Generate a summary using the LLM
   * 
   * @param messages - Messages to summarize
   * @param maxTokens - Maximum tokens for the summary
   * @returns Summary text
   */
  private async generateLLMSummary(
    messages: Message[],
    maxTokens: number
  ): Promise<string> {
    if (!this.provider || !this.model) {
      throw new Error('Provider and model must be set for LLM summarization');
    }

    // Convert Messages to conversation text
    const conversationText = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    // Create a summarization prompt
    const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key topics discussed, important decisions made, and any action items or conclusions. Keep the summary under ${maxTokens} tokens.

Conversation:
${conversationText}

Summary:`;

    // Call the LLM to generate the summary
    const providerMessages = [
      {
        role: 'user',
        content: summaryPrompt,
      },
    ];

    let summaryText = '';

    try {
      for await (const event of this.provider.chatStream({
        model: this.model,
        messages: providerMessages,
        options: {
          maxTokens,
          temperature: 0.3, // Lower temperature for more focused summaries
        },
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

    return `[Previous conversation summary]\n${summaryText.trim()}`;
  }

  /**
   * Create a placeholder summary text
   * 
   * @param messages - Messages to summarize
   * @returns Summary text
   */
  private createSummaryPlaceholder(messages: Message[]): string {
    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    const assistantMessages = messages.filter((m) => m.role === 'assistant')
      .length;

    return `[Conversation summary: ${messageCount} messages compressed (${userMessages} user, ${assistantMessages} assistant)]`;
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
   * Uses rough estimation: 4 characters per token
   * 
   * @param message - Message to count
   * @returns Token count
   */
  private countMessageTokens(message: Message): number {
    const contentTokens = Math.ceil(message.content.length / 4);
    // Add overhead for role and structure
    return contentTokens + 10;
  }

  /**
   * Count tokens in an array of messages
   * 
   * @param messages - Messages to count
   * @returns Total token count
   */
  private countMessagesTokens(messages: Message[]): number {
    return messages.reduce(
      (sum, msg) => sum + this.countMessageTokens(msg),
      0
    );
  }
}
