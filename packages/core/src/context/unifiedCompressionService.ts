/**
 * Unified Compression Service
 * 
 * Consolidates CompressionService and ChatCompressionService into a single service
 * that handles both Message and SessionMessage formats.
 */

import type {
  Message,
  ICompressionService,
  CompressionStrategy,
  CompressedContext,
  CompressionEstimate,
  TokenCounter,
} from './types.js';
import type { SessionMessage } from '../services/types.js';
import { EventEmitter } from 'events';

/**
 * Provider adapter interface for LLM-based summarization
 */
export interface ProviderAdapter {
  chatStream(params: {
    model: string;
    messages: Array<{ role: string; content: string }> | Array<{ role: string; parts: Array<{ type: string; text: string }> }>;
    options?: {
      maxTokens?: number;
      temperature?: number;
    };
    systemPrompt?: string;
    timeout?: number;
    abortSignal?: AbortSignal;
  }): AsyncIterable<
    | { type: 'text'; value: string }
    | { type: 'error'; error: { message: string } }
  >;
}

/**
 * Compression options for SessionMessage format
 */
export interface SessionCompressionOptions {
  strategy: 'truncate' | 'summarize' | 'hybrid';
  preserveRecentTokens: number;
  targetTokens?: number;
}

/**
 * Compression result for SessionMessage format
 */
export interface SessionCompressionResult {
  compressedMessages: SessionMessage[];
  originalTokenCount: number;
  compressedTokenCount: number;
  strategy: string;
}

/**
 * Default tool call overhead in tokens
 */
const TOOL_CALL_OVERHEAD = 50;

/**
 * Unified Compression Service
 * 
 * Handles both Message and SessionMessage formats with a single implementation.
 * Supports three compression strategies: truncate, summarize, and hybrid.
 */
export class UnifiedCompressionService extends EventEmitter implements ICompressionService {
  private provider?: ProviderAdapter;
  private model?: string;
  private tokenCounter?: TokenCounter;
  private readonly COMPRESSION_PRESERVE_FRACTION = 0.3;

  constructor(provider?: ProviderAdapter, model?: string, tokenCounter?: TokenCounter) {
    super();
    this.provider = provider;
    this.model = model;
    this.tokenCounter = tokenCounter;
  }

  /**
   * Set the provider and model for LLM-based summarization
   */
  setProvider(provider: ProviderAdapter, model: string): void {
    this.provider = provider;
    this.model = model;
  }

  /**
   * Set the token counter service
   */
  setTokenCounter(tokenCounter: TokenCounter): void {
    this.tokenCounter = tokenCounter;
  }

  // ============================================================================
  // Message Format API (ICompressionService)
  // ============================================================================

  /**
   * Compress messages using specified strategy (Message format)
   */
  async compress(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    const originalTokens = await this.countMessagesTokens(messages);

    let result: CompressedContext;

    switch (strategy.type) {
      case 'truncate':
        result = await this.truncateMessages(messages, strategy);
        break;
      case 'summarize':
        result = await this.summarizeMessages(messages, strategy);
        break;
      case 'hybrid':
        result = await this.hybridMessages(messages, strategy);
        break;
      default:
        throw new Error(`Unknown compression strategy: ${strategy.type}`);
    }

    result.originalTokens = originalTokens;

    // Inflation Guard
    if (result.compressedTokens >= originalTokens && originalTokens > 0) {
      result.status = 'inflated';
    } else {
      result.status = 'success';
    }

    return result;
  }

  /**
   * Estimate compression without performing it
   */
  estimateCompression(messages: Message[]): CompressionEstimate {
    const originalTokens = this.countMessagesTokensSync(messages);
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
   * Check if compression is needed
   */
  shouldCompress(tokenCount: number, threshold: number): boolean {
    return tokenCount > threshold;
  }

  // ============================================================================
  // SessionMessage Format API
  // ============================================================================

  /**
   * Check if compression is needed (SessionMessage format)
   */
  async shouldCompressSession(
    messages: SessionMessage[],
    tokenLimit: number,
    threshold: number
  ): Promise<boolean> {
    const currentTokens = await this.countSessionMessagesTokens(messages);
    const thresholdTokens = tokenLimit * threshold;
    return currentTokens >= thresholdTokens;
  }

  /**
   * Compress messages (SessionMessage format)
   */
  async compressSession(
    messages: SessionMessage[],
    options: SessionCompressionOptions
  ): Promise<SessionCompressionResult> {
    const originalTokenCount = await this.countSessionMessagesTokens(messages);

    let compressedMessages: SessionMessage[];

    switch (options.strategy) {
      case 'truncate':
        compressedMessages = await this.truncateSessionMessages(
          messages,
          options.targetTokens ?? options.preserveRecentTokens
        );
        break;
      case 'summarize':
        compressedMessages = await this.summarizeSessionMessages(
          messages,
          options.targetTokens ?? options.preserveRecentTokens
        );
        break;
      case 'hybrid':
        compressedMessages = await this.hybridSessionMessages(messages, options);
        break;
      default:
        throw new Error(`Unknown compression strategy: ${options.strategy}`);
    }

    const compressedTokenCount = await this.countSessionMessagesTokens(compressedMessages);

    this.emit('compression-complete', {
      originalTokenCount,
      compressedTokenCount,
      strategy: options.strategy,
    });

    return {
      compressedMessages,
      originalTokenCount,
      compressedTokenCount,
      strategy: options.strategy,
    };
  }

  // ============================================================================
  // Message Format Implementation
  // ============================================================================

  private async truncateMessages(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    if (messages.length === 0) {
      return this.createEmptyResult();
    }

    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const targetTokens = this.calculatePreserveTokens(messages, strategy.preserveRecent);

    const preserved: Message[] = [];
    let currentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countMessageTokens(message);

      if (currentTokens + messageTokens <= targetTokens) {
        preserved.unshift(message);
        currentTokens += messageTokens;
      } else {
        break;
      }
    }

    const truncatedCount = nonSystemMessages.length - preserved.length;
    const summary = this.createTruncationSummary(truncatedCount);
    const compressedTokens = await this.countMessageTokens(summary) + currentTokens;
    const originalTokens = await this.countMessagesTokens(messages);

    return {
      summary,
      preserved,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  private async summarizeMessages(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    if (messages.length === 0) {
      return this.createEmptyResult();
    }

    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    if (nonSystemMessages.length === 0) {
      return this.createEmptyResult();
    }

    const recentTokenBudget = this.calculatePreserveTokens(messages, strategy.preserveRecent);
    const preserved: Message[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        preserved.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    const messagesToSummarize = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - preserved.length
    );

    if (messagesToSummarize.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved,
        originalTokens: await this.countMessagesTokens(messages),
        compressedTokens: recentTokens,
        compressionRatio: recentTokens / await this.countMessagesTokens(messages),
      };
    }

    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummaryFromMessages(
          messagesToSummarize,
          strategy.summaryMaxTokens
        );
      } catch (error) {
        console.warn('LLM summarization failed, using placeholder:', error);
        summaryText = this.createSummaryPlaceholderFromMessages(messagesToSummarize);
      }
    } else {
      summaryText = this.createSummaryPlaceholderFromMessages(messagesToSummarize);
    }

    const summary: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: summaryText,
      timestamp: new Date(),
    };

    const compressedTokens = await this.countMessageTokens(summary) + recentTokens;
    const originalTokens = await this.countMessagesTokens(messages);

    return {
      summary,
      preserved,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  private async hybridMessages(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext> {
    if (messages.length === 0) {
      return this.createEmptyResult();
    }

    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    if (nonSystemMessages.length === 0) {
      return this.createEmptyResult();
    }

    const recentTokenBudget = this.calculatePreserveTokens(messages, strategy.preserveRecent);
    const preserved: Message[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        preserved.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    const olderMessages = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - preserved.length
    );

    if (olderMessages.length === 0) {
      return {
        summary: this.createEmptySummary(),
        preserved,
        originalTokens: await this.countMessagesTokens(messages),
        compressedTokens: recentTokens,
        compressionRatio: recentTokens / await this.countMessagesTokens(messages),
      };
    }

    const splitPoint = Math.floor(olderMessages.length * 0.5);
    const middleMessages = olderMessages.slice(splitPoint);

    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummaryFromMessages(
          middleMessages,
          strategy.summaryMaxTokens
        );
      } catch (error) {
        console.warn('LLM summarization failed in hybrid strategy:', error);
        summaryText = this.createSummaryPlaceholderFromMessages(middleMessages);
      }
    } else {
      summaryText = this.createSummaryPlaceholderFromMessages(middleMessages);
    }

    const truncatedCount = olderMessages.length - middleMessages.length;
    const summaryWithTruncation = `${summaryText}\n\n[${truncatedCount} older messages truncated]`;

    const summary: Message = {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: summaryWithTruncation,
      timestamp: new Date(),
    };

    const compressedTokens = await this.countMessageTokens(summary) + recentTokens;
    const originalTokens = await this.countMessagesTokens(messages);

    return {
      summary,
      preserved,
      originalTokens,
      compressedTokens,
      compressionRatio: compressedTokens / originalTokens,
    };
  }

  // ============================================================================
  // SessionMessage Format Implementation
  // ============================================================================

  private async truncateSessionMessages(
    messages: SessionMessage[],
    targetTokens: number
  ): Promise<SessionMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const systemPrompt = messages[0]?.role === 'system' ? [messages[0]] : [];
    const nonSystemMessages = messages[0]?.role === 'system' ? messages.slice(1) : messages;

    const result: SessionMessage[] = [];
    let currentTokens = await this.countSessionMessagesTokens(systemPrompt);

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countSessionMessageTokens(message);

      if (currentTokens + messageTokens <= targetTokens) {
        result.unshift(message);
        currentTokens += messageTokens;
      } else {
        break;
      }
    }

    return [...systemPrompt, ...result];
  }

  private async summarizeSessionMessages(
    messages: SessionMessage[],
    targetTokens: number
  ): Promise<SessionMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const systemPrompt = messages[0]?.role === 'system' ? [messages[0]] : [];
    const nonSystemMessages = messages[0]?.role === 'system' ? messages.slice(1) : messages;

    if (nonSystemMessages.length === 0) {
      return systemPrompt;
    }

    const systemTokens = await this.countSessionMessagesTokens(systemPrompt);
    const availableTokens = targetTokens - systemTokens;
    const summaryTokenBudget = Math.floor(availableTokens * 0.3);
    const recentTokenBudget = availableTokens - summaryTokenBudget;

    const recentMessages: SessionMessage[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countSessionMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        recentMessages.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    const messagesToSummarize = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - recentMessages.length
    );

    if (messagesToSummarize.length === 0) {
      return [...systemPrompt, ...recentMessages];
    }

    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummaryFromSessionMessages(
          messagesToSummarize,
          summaryTokenBudget
        );
      } catch (error) {
        console.warn('LLM summarization failed:', error);
        summaryText = this.createSummaryPlaceholderFromSessionMessages(messagesToSummarize);
      }
    } else {
      summaryText = this.createSummaryPlaceholderFromSessionMessages(messagesToSummarize);
    }

    const summaryMessage: SessionMessage = {
      role: 'system',
      parts: [{ type: 'text', text: summaryText }],
      timestamp: new Date().toISOString(),
    };

    return [...systemPrompt, summaryMessage, ...recentMessages];
  }

  private async hybridSessionMessages(
    messages: SessionMessage[],
    options: SessionCompressionOptions
  ): Promise<SessionMessage[]> {
    const targetTokens = options.targetTokens ?? options.preserveRecentTokens;

    if (messages.length === 0) {
      return [];
    }

    const systemPrompt = messages[0]?.role === 'system' ? [messages[0]] : [];
    const nonSystemMessages = messages[0]?.role === 'system' ? messages.slice(1) : messages;

    if (nonSystemMessages.length === 0) {
      return systemPrompt;
    }

    const systemTokens = await this.countSessionMessagesTokens(systemPrompt);
    const availableTokens = targetTokens - systemTokens;
    const recentTokenBudget = Math.floor(availableTokens * 0.5);
    const summaryTokenBudget = availableTokens - recentTokenBudget;

    const recentMessages: SessionMessage[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countSessionMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        recentMessages.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    const olderMessages = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - recentMessages.length
    );

    if (olderMessages.length === 0) {
      return [...systemPrompt, ...recentMessages];
    }

    const splitPoint = Math.floor(olderMessages.length * 0.5);
    const middleMessages = olderMessages.slice(splitPoint);

    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummaryFromSessionMessages(
          middleMessages,
          summaryTokenBudget
        );
      } catch (error) {
        console.warn('LLM summarization failed in hybrid strategy:', error);
        summaryText = this.createSummaryPlaceholderFromSessionMessages(middleMessages);
      }
    } else {
      summaryText = this.createSummaryPlaceholderFromSessionMessages(middleMessages);
    }

    const summaryMessage: SessionMessage = {
      role: 'system',
      parts: [{ type: 'text', text: summaryText }],
      timestamp: new Date().toISOString(),
    };

    return [...systemPrompt, summaryMessage, ...recentMessages];
  }

  // ============================================================================
  // Token Counting
  // ============================================================================

  private async countMessageTokens(message: Message): Promise<number> {
    if (this.tokenCounter) {
      const count = this.tokenCounter.countTokensCached(message.id, message.content);
      if (message.metadata?.toolCalls) {
        return count + (message.metadata.toolCalls.length * TOOL_CALL_OVERHEAD);
      }
      return count;
    }
    
    const contentTokens = Math.ceil(message.content.length / 4);
    let total = contentTokens + 10;
    if (message.metadata?.toolCalls) {
      total += message.metadata.toolCalls.length * TOOL_CALL_OVERHEAD;
    }
    return total;
  }

  private async countMessagesTokens(messages: Message[]): Promise<number> {
    if (this.tokenCounter) {
      return this.tokenCounter.countConversationTokens(messages);
    }
    
    let total = 0;
    for (const msg of messages) {
      total += await this.countMessageTokens(msg);
    }
    return total;
  }

  private countMessagesTokensSync(messages: Message[]): number {
    return messages.reduce((sum, msg) => {
      const contentTokens = Math.ceil(msg.content.length / 4);
      let total = contentTokens + 10;
      if (msg.metadata?.toolCalls) {
        total += msg.metadata.toolCalls.length * TOOL_CALL_OVERHEAD;
      }
      return sum + total;
    }, 0);
  }

  private async countSessionMessageTokens(message: SessionMessage): Promise<number> {
    if (this.tokenCounter) {
      const text = message.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      const messageId = `session-${message.timestamp}`;
      return this.tokenCounter.countTokensCached(messageId, text) + 10;
    }
    
    let total = 0;
    for (const part of message.parts) {
      if (part.type === 'text') {
        total += Math.ceil(part.text.length / 4);
      }
    }
    return total + 10;
  }

  private async countSessionMessagesTokens(messages: SessionMessage[]): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      total += await this.countSessionMessageTokens(msg);
    }
    return total;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculatePreserveTokens(messages: Message[], basePreserveRecent: number): number {
    const totalTokens = this.countMessagesTokensSync(messages);
    const fractionalPreserve = Math.ceil(totalTokens * this.COMPRESSION_PRESERVE_FRACTION);
    return Math.max(basePreserveRecent, fractionalPreserve);
  }

  private async generateLLMSummaryFromMessages(
    messages: Message[],
    maxTokens: number
    , timeoutMs?: number
  ): Promise<string> {
    if (!this.provider || !this.model) {
      throw new Error('Provider and model must be set for LLM summarization');
    }

    const conversationText = messages
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n\n');

    const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key topics discussed, important decisions made, and any action items or conclusions. Keep the summary under ${maxTokens} tokens.

Conversation:
${conversationText}

Summary:`;

    const providerMessages = [{ role: 'user', content: summaryPrompt }];
    let summaryText = '';

    const timeout = timeoutMs ?? 120000;
    for await (const event of this.provider.chatStream({
      model: this.model,
      messages: providerMessages,
      options: { maxTokens, temperature: 0.3 },
      timeout,
    })) {
      if (event.type === 'text') {
        summaryText += event.value;
      } else if (event.type === 'error') {
        throw new Error(event.error.message);
      }
    }

    if (!summaryText.trim()) {
      throw new Error('LLM returned empty summary');
    }

    return `[Previous conversation summary]\n${summaryText.trim()}`;
  }

  private async generateLLMSummaryFromSessionMessages(
    messages: SessionMessage[],
    maxTokens: number
    , timeoutMs?: number
  ): Promise<string> {
    if (!this.provider || !this.model) {
      throw new Error('Provider and model must be set for LLM summarization');
    }

    const conversationText = messages
      .map((msg) => {
        const text = msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('\n');
        return `${msg.role}: ${text}`;
      })
      .join('\n\n');

    const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key topics discussed, important decisions made, and any action items or conclusions. Keep the summary under ${maxTokens} tokens.

Conversation:
${conversationText}

Summary:`;

    const providerMessages = [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: summaryPrompt }],
      },
    ];

    let summaryText = '';

    const timeout = timeoutMs ?? 120000;
    for await (const event of this.provider.chatStream({
      model: this.model,
      messages: providerMessages,
      options: { maxTokens, temperature: 0.3 },
      timeout,
    })) {
      if (event.type === 'text') {
        summaryText += event.value;
      } else if (event.type === 'error') {
        throw new Error(event.error.message);
      }
    }

    if (!summaryText.trim()) {
      throw new Error('LLM returned empty summary');
    }

    return `[Previous conversation summary]\n${summaryText.trim()}`;
  }

  private createSummaryPlaceholderFromMessages(messages: Message[]): string {
    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    const assistantMessages = messages.filter((m) => m.role === 'assistant').length;
    return `[Conversation summary: ${messageCount} messages compressed (${userMessages} user, ${assistantMessages} assistant)]`;
  }

  private createSummaryPlaceholderFromSessionMessages(messages: SessionMessage[]): string {
    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    const assistantMessages = messages.filter((m) => m.role === 'assistant').length;
    return `[Conversation summary: ${messageCount} messages compressed (${userMessages} user, ${assistantMessages} assistant)]`;
  }

  private createTruncationSummary(truncatedCount: number): Message {
    return {
      id: `truncation-${Date.now()}`,
      role: 'system',
      content: `[${truncatedCount} older messages truncated to manage context size]`,
      timestamp: new Date(),
    };
  }

  private createEmptySummary(): Message {
    return {
      id: `summary-${Date.now()}`,
      role: 'system',
      content: '[No messages to compress]',
      timestamp: new Date(),
    };
  }

  private createEmptyResult(): CompressedContext {
    return {
      summary: this.createEmptySummary(),
      preserved: [],
      originalTokens: 0,
      compressedTokens: 0,
      compressionRatio: 0,
    };
  }
}

/**
 * Create a new unified compression service instance
 */
export function createUnifiedCompressionService(
  provider?: ProviderAdapter,
  model?: string,
  tokenCounter?: TokenCounter
): UnifiedCompressionService {
  return new UnifiedCompressionService(provider, model, tokenCounter);
}
