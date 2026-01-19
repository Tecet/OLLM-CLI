/**
 * Chat Compression Service
 *
 * Manages message history size by compressing older messages while preserving recent context.
 * Supports multiple compression strategies: summarize, truncate, and hybrid.
 */

import type {
  SessionMessage,
  CompressionOptions,
  CompressionResult,
} from './types.js';
import type { ProviderAdapter } from '../provider/types.js';
import type { TokenCounter } from '../context/types.js';
import { sanitizeErrorMessage } from './errorSanitization.js';
import { STATE_SNAPSHOT_PROMPT } from '../prompts/templates/stateSnapshot.js';
import { EventEmitter } from 'events';

/**
 * Chat Compression Service
 */
export class ChatCompressionService extends EventEmitter {
  private provider?: ProviderAdapter;
  private model?: string;
  private tokenCounter?: TokenCounter;

  /**
   * Create a new ChatCompressionService
   * 
   * @param provider - Optional provider adapter for LLM-based summarization
   * @param model - Optional model name to use for summarization
   * @param tokenCounter - Optional token counter service for accurate token counting
   */
  constructor(provider?: ProviderAdapter, model?: string, tokenCounter?: TokenCounter) {
    super();
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
   * Count tokens in text using TokenCounterService if available
   * Falls back to estimation if not available
   */
  private async countTokens(text: string): Promise<number> {
    if (this.tokenCounter) {
      return await this.tokenCounter.countTokens(text);
    }
    // Fallback estimation
    return Math.ceil(text.length / 4);
  }

  /**
   * Count tokens in a message using TokenCounterService if available
   */
  private async countMessageTokens(message: SessionMessage): Promise<number> {
    if (this.tokenCounter) {
      // Convert SessionMessage to text for counting
      const text = message.parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('\n');
      
      // Use a unique ID for caching (use timestamp as fallback)
      const messageId = `session-${message.timestamp}`;
      return this.tokenCounter.countTokensCached(messageId, text) + 10; // +10 for structure overhead
    }
    
    // Fallback estimation
    let total = 0;
    for (const part of message.parts) {
      if (part.type === 'text') {
        total += Math.ceil(part.text.length / 4);
      }
    }
    return total + 10; // Add overhead for role and structure
  }

  /**
   * Count tokens in an array of messages
   */
  private async countMessagesTokens(messages: SessionMessage[]): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      total += await this.countMessageTokens(msg);
    }
    return total;
  }
  /**
   * Check if compression is needed based on current token count and limit
   *
   * @param messages - Current message history
   * @param tokenLimit - Maximum token limit for the model
   * @param threshold - Percentage threshold (0-1) at which to trigger compression
   * @returns true if compression should be performed
   */
  async shouldCompress(
    messages: SessionMessage[],
    tokenLimit: number,
    threshold: number
  ): Promise<boolean> {
    const currentTokens = await this.countMessagesTokens(messages);
    const thresholdTokens = tokenLimit * threshold;
    return currentTokens >= thresholdTokens;
  }

  /**
   * Perform compression on message history
   *
   * @param messages - Messages to compress
   * @param options - Compression options
   * @param metadata - Optional session metadata to update (compressionCount will be incremented)
   * @returns Compression result with compressed messages, token counts, and updated metadata
   */
  async compress(
    messages: SessionMessage[],
    options: CompressionOptions,
    metadata?: { tokenCount: number; compressionCount: number }
  ): Promise<CompressionResult & { metadata?: { tokenCount: number; compressionCount: number } }> {
    const originalTokenCount = await this.countMessagesTokens(messages);

    let compressedMessages: SessionMessage[];

    switch (options.strategy) {
      case 'truncate':
        compressedMessages = await this.truncate(
          messages,
          options.targetTokens ?? options.preserveRecentTokens
        );
        break;
      case 'summarize':
        compressedMessages = await this.summarize(
          messages,
          options.targetTokens ?? options.preserveRecentTokens
        );
        break;
      case 'hybrid':
        compressedMessages = await this.hybrid(messages, options);
        break;
      default:
        throw new Error(`Unknown compression strategy: ${options.strategy}`);
    }

    const compressedTokenCount = await this.countMessagesTokens(compressedMessages);

    // Update metadata if provided (Requirement 3.8)
    let updatedMetadata: { tokenCount: number; compressionCount: number } | undefined;
    if (metadata) {
      updatedMetadata = {
        tokenCount: compressedTokenCount,
        compressionCount: metadata.compressionCount + 1,
      };
    }

    // Emit compression-complete event
    this.emit('compression-complete', {
      originalTokenCount,
      compressedTokenCount,
      strategy: options.strategy,
      compressionCount: updatedMetadata?.compressionCount ?? 1,
    });

    return {
      compressedMessages,
      originalTokenCount,
      compressedTokenCount,
      strategy: options.strategy,
      metadata: updatedMetadata,
    };
  }

  /**
   * Truncate strategy: Remove oldest messages until under target token count
   * Always preserves system prompt (first message) and recent messages
   *
   * @param messages - Messages to compress
   * @param targetTokens - Target token count after compression
   * @returns Compressed messages
   */
  async truncate(messages: SessionMessage[], targetTokens: number): Promise<SessionMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    // Always preserve system prompt if it exists
    const systemPrompt =
      messages[0]?.role === 'system' ? [messages[0]] : [];
    const nonSystemMessages = messages[0]?.role === 'system' ? messages.slice(1) : messages;

    // Start from the end and work backwards, keeping messages until we hit the target
    const result: SessionMessage[] = [];
    let currentTokens = await this.countMessagesTokens(systemPrompt);

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countMessageTokens(message);

      if (currentTokens + messageTokens <= targetTokens) {
        result.unshift(message);
        currentTokens += messageTokens;
      } else {
        // Stop adding messages once we exceed target
        break;
      }
    }

    return [...systemPrompt, ...result];
  }

  /**
   * Summarize strategy: Use LLM to generate summary of older messages
   * Preserves system prompt and recent messages, replaces old messages with summary
   *
   * @param messages - Messages to compress
   * @param targetTokens - Target token count after compression
   * @returns Compressed messages with summary
   */
  async summarize(
    messages: SessionMessage[],
    targetTokens: number
  ): Promise<SessionMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    // Always preserve system prompt if it exists
    const systemPrompt =
      messages[0]?.role === 'system' ? [messages[0]] : [];
    const nonSystemMessages = messages[0]?.role === 'system' ? messages.slice(1) : messages;

    if (nonSystemMessages.length === 0) {
      return systemPrompt;
    }

    // Calculate how many recent tokens to preserve
    const systemTokens = await this.countMessagesTokens(systemPrompt);
    const availableTokens = targetTokens - systemTokens;
    const summaryTokenBudget = Math.floor(availableTokens * 0.3); // 30% for summary
    const recentTokenBudget = availableTokens - summaryTokenBudget;

    // Find recent messages to preserve
    const recentMessages: SessionMessage[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        recentMessages.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    // Messages to summarize are everything not in recent
    const messagesToSummarize = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - recentMessages.length
    );

    if (messagesToSummarize.length === 0) {
      // Nothing to summarize, just return what we have
      return [...systemPrompt, ...recentMessages];
    }

    // Generate summary using LLM if available, otherwise use placeholder
    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummary(messagesToSummarize, summaryTokenBudget);
      } catch (error) {
        // Fall back to placeholder if LLM summarization fails
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('LLM summarization failed, using placeholder:', sanitizeErrorMessage(errorMessage));
        summaryText = this.createSummaryPlaceholder(messagesToSummarize);
      }
    } else {
      summaryText = this.createSummaryPlaceholder(messagesToSummarize);
    }

    const summaryMessage: SessionMessage = {
      role: 'system',
      parts: [{ type: 'text', text: summaryText }],
      timestamp: new Date().toISOString(),
    };

    return [...systemPrompt, summaryMessage, ...recentMessages];
  }

  /**
   * Hybrid strategy: Combine summarize and truncate
   * Summarizes middle messages, truncates oldest, preserves recent
   *
   * @param messages - Messages to compress
   * @param options - Compression options
   * @returns Compressed messages
   */
  async hybrid(
    messages: SessionMessage[],
    options: CompressionOptions
  ): Promise<SessionMessage[]> {
    const targetTokens = options.targetTokens ?? options.preserveRecentTokens;

    if (messages.length === 0) {
      return [];
    }

    // Always preserve system prompt if it exists
    const systemPrompt =
      messages[0]?.role === 'system' ? [messages[0]] : [];
    const nonSystemMessages = messages[0]?.role === 'system' ? messages.slice(1) : messages;

    if (nonSystemMessages.length === 0) {
      return systemPrompt;
    }

    // Calculate token budgets
    const systemTokens = await this.countMessagesTokens(systemPrompt);
    const availableTokens = targetTokens - systemTokens;
    const recentTokenBudget = Math.floor(availableTokens * 0.5); // 50% for recent
    const summaryTokenBudget = availableTokens - recentTokenBudget;

    // Find recent messages to preserve
    const recentMessages: SessionMessage[] = [];
    let recentTokens = 0;

    for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
      const message = nonSystemMessages[i];
      const messageTokens = await this.countMessageTokens(message);

      if (recentTokens + messageTokens <= recentTokenBudget) {
        recentMessages.unshift(message);
        recentTokens += messageTokens;
      } else {
        break;
      }
    }

    // Messages to process are everything not in recent
    const olderMessages = nonSystemMessages.slice(
      0,
      nonSystemMessages.length - recentMessages.length
    );

    if (olderMessages.length === 0) {
      // Nothing to compress, just return what we have
      return [...systemPrompt, ...recentMessages];
    }

    // Split older messages into "very old" (truncate) and "middle" (summarize)
    const splitPoint = Math.floor(olderMessages.length * 0.5);
    const middleMessages = olderMessages.slice(splitPoint);

    // Generate summary of middle messages using LLM if available
    let summaryText: string;
    if (this.provider && this.model) {
      try {
        summaryText = await this.generateLLMSummary(middleMessages, summaryTokenBudget);
      } catch (error) {
        // Fall back to placeholder if LLM summarization fails
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn('LLM summarization failed in hybrid strategy, using placeholder:', sanitizeErrorMessage(errorMessage));
        summaryText = this.createSummaryPlaceholder(middleMessages);
      }
    } else {
      summaryText = this.createSummaryPlaceholder(middleMessages);
    }

    const summaryMessage: SessionMessage = {
      role: 'system',
      parts: [{ type: 'text', text: summaryText }],
      timestamp: new Date().toISOString(),
    };

    // Very old messages are simply dropped (truncated)
    return [...systemPrompt, summaryMessage, ...recentMessages];
  }

  /**
   * Generate a summary using the LLM
   * 
   * @param messages - Messages to summarize
   * @param maxTokens - Maximum tokens for the summary
   * @returns Summary text
   */
  private async generateLLMSummary(
    messages: SessionMessage[],
    maxTokens: number
  ): Promise<string> {
    if (!this.provider || !this.model) {
      throw new Error('Provider and model must be set for LLM summarization');
    }

    // Convert SessionMessages to provider Messages format
    const conversationText = messages
      .map((msg) => {
        const text = msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('\n');
        return `${msg.role}: ${text}`;
      })
      .join('\n\n');

    // Create a summarization prompt
    const summaryPrompt = `Please provide a concise summary of the following conversation. Focus on the key topics discussed, important decisions made, and any action items or conclusions. Keep the summary under ${maxTokens} tokens.

Conversation:
${conversationText}

Summary:`;

    // Call the LLM to generate the summary
    const providerMessages = [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: summaryPrompt }],
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
      throw new Error(`Failed to generate LLM summary: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!summaryText.trim()) {
      throw new Error('LLM returned empty summary');
    }

    return `[Previous conversation summary]\n${summaryText.trim()}`;
  }

  /**
   * Generate an XML snapshot using STATE_SNAPSHOT_PROMPT
   * 
   * @param messages - Messages to create snapshot from
   * @returns XML snapshot string
   */
  async generateXMLSnapshot(messages: SessionMessage[]): Promise<string> {
    if (!this.provider || !this.model) {
      throw new Error('Provider and model must be set for XML snapshot generation');
    }

    // Convert SessionMessages to conversation text
    const conversationText = messages
      .map((msg) => {
        const text = msg.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join('\n');
        return `${msg.role}: ${text}`;
      })
      .join('\n\n');

    // Use STATE_SNAPSHOT_PROMPT template
    const systemPrompt = STATE_SNAPSHOT_PROMPT.content;
    
    const providerMessages = [
      {
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: conversationText }],
      },
    ];

    let snapshotXml = '';
    
    try {
      for await (const event of this.provider.chatStream({
        model: this.model,
        messages: providerMessages,
        systemPrompt,
        options: {
          temperature: 0.3, // Lower temperature for structured output
        },
      })) {
        if (event.type === 'text') {
          snapshotXml += event.value;
        } else if (event.type === 'error') {
          throw new Error(event.error.message);
        }
      }
    } catch (error) {
      throw new Error(`Failed to generate XML snapshot: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (!snapshotXml.trim()) {
      throw new Error('LLM returned empty XML snapshot');
    }

    return snapshotXml.trim();
  }

  /**
   * Validate XML structure
   * 
   * @param xml - XML string to validate
   * @returns true if valid, false otherwise
   */
  validateXMLStructure(xml: string): boolean {
    try {
      // Check for required tags
      const requiredTags = [
        'state_snapshot',
        'overall_goal',
        'key_knowledge',
        'file_system_state',
        'current_plan'
      ];

      for (const tag of requiredTags) {
        const openTag = `<${tag}>`;
        const closeTag = `</${tag}>`;
        
        if (!xml.includes(openTag) || !xml.includes(closeTag)) {
          console.warn(`XML validation failed: Missing tag ${tag}`);
          return false;
        }

        // Check that close tag comes after open tag
        const openIndex = xml.indexOf(openTag);
        const closeIndex = xml.indexOf(closeTag);
        
        if (closeIndex <= openIndex) {
          console.warn(`XML validation failed: Invalid tag order for ${tag}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn('XML validation error:', error);
      return false;
    }
  }

  /**
   * Parse and format XML snapshot
   * 
   * @param xml - XML string to parse
   * @returns Formatted XML string
   */
  parseAndFormatXML(xml: string): string {
    try {
      // Extract content between tags and clean up
      let formatted = xml.trim();

      // Remove any markdown code blocks if present
      formatted = formatted.replace(/```xml\n?/g, '');
      formatted = formatted.replace(/```\n?/g, '');

      // Ensure proper indentation (basic formatting)
      const lines = formatted.split('\n');
      let indentLevel = 0;
      const indentedLines: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed) continue;

        // Decrease indent for closing tags
        if (trimmed.startsWith('</')) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        // Add indented line
        indentedLines.push('  '.repeat(indentLevel) + trimmed);

        // Increase indent for opening tags (but not self-closing or if closing tag on same line)
        if (trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.endsWith('/>') && !trimmed.includes('</')) {
          indentLevel++;
        }
      }

      return indentedLines.join('\n');
    } catch (error) {
      console.warn('XML formatting error:', error);
      return xml; // Return original if formatting fails
    }
  }

  /**
   * Create a placeholder summary text
   * In a real implementation, this would call the LLM to generate a summary
   *
   * @param messages - Messages to summarize
   * @returns Summary text
   */
  private createSummaryPlaceholder(messages: SessionMessage[]): string {
    const messageCount = messages.length;
    const userMessages = messages.filter((m) => m.role === 'user').length;
    const assistantMessages = messages.filter((m) => m.role === 'assistant')
      .length;

    return `[Conversation summary: ${messageCount} messages compressed (${userMessages} user, ${assistantMessages} assistant)]`;
  }
}
