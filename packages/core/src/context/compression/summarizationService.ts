/**
 * Summarization Service
 *
 * Provides LLM-based summarization of conversation history with:
 * - Three compression levels (Compact, Moderate, Detailed)
 * - Goal-aware summarization
 * - Mode-specific preservation strategies
 * - Error handling for LLM failures
 * - Summary validation
 *
 * Requirements: FR-5, FR-6, FR-7
 */

import type { Message } from '../types.js';
import type { Goal } from '../goalTypes.js';
import type { ProviderAdapter, ProviderRequest } from '../../provider/types.js';

/**
 * Compression level determines summary detail
 */
export type CompressionLevel = 1 | 2 | 3;

/**
 * Summarization result
 */
export interface SummarizationResult {
  /** LLM-generated summary */
  summary: string;
  /** Token count of summary */
  tokenCount: number;
  /** Compression level used */
  level: CompressionLevel;
  /** Model used for summarization */
  model: string;
  /** Whether summarization succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Summarization configuration
 */
export interface SummarizationConfig {
  /** Provider adapter for LLM calls */
  provider: ProviderAdapter;
  /** Model to use for summarization */
  model: string;
  /** Operational mode (affects preservation strategy) */
  mode?: 'DEVELOPER' | 'PLANNING' | 'DEBUGGER' | 'ASSISTANT';
  /** Maximum tokens for summary */
  maxSummaryTokens?: number;
  /** Timeout for LLM call in milliseconds */
  timeout?: number;
}

/**
 * Summarization Service
 *
 * Creates semantic summaries of conversation history using LLM.
 * Supports three compression levels and goal-aware summarization.
 */
export class SummarizationService {
  private provider: ProviderAdapter;
  private model: string;
  private mode: string;
  private maxSummaryTokens: number;
  private timeout: number;

  constructor(config: SummarizationConfig) {
    this.provider = config.provider;
    this.model = config.model;
    this.mode = config.mode ?? 'ASSISTANT';
    this.maxSummaryTokens = config.maxSummaryTokens ?? 500;
    this.timeout = config.timeout ?? 30000; // 30 seconds default
  }

  /**
   * Summarize messages using LLM
   *
   * Requirements: FR-5, FR-6
   */
  async summarize(
    messages: Message[],
    level: CompressionLevel,
    goal?: Goal
  ): Promise<SummarizationResult> {
    try {
      // Build summarization prompt
      const prompt = this.buildSummarizationPrompt(messages, level, goal);

      // Call LLM with timeout
      const summary = await this.callLLM(prompt);

      // Validate summary
      const validation = this.validateSummary(summary, messages);
      if (!validation.valid) {
        throw new Error(`Summary validation failed: ${validation.reason}`);
      }

      // Count tokens in summary (estimate)
      const tokenCount = Math.ceil(summary.length / 4);

      return {
        summary,
        tokenCount,
        level,
        model: this.model,
        success: true,
      };
    } catch (error) {
      // Error handling for LLM failures (FR-7)
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SummarizationService] Summarization failed:', errorMessage);

      return {
        summary: '',
        tokenCount: 0,
        level,
        model: this.model,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Build summarization prompt based on level and goal
   *
   * Requirements: FR-5, FR-6
   */
  buildSummarizationPrompt(
    messages: Message[],
    level: CompressionLevel,
    goal?: Goal
  ): string {
    // Get base prompt for compression level
    const basePrompt = this.getBasePrompt(level);

    // Get mode-specific preservation instructions
    const preservationInstructions = this.getPreservationInstructions();

    // Build conversation text
    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    // Build goal context if provided
    const goalContext = goal ? this.buildGoalContext(goal) : '';

    // Combine all parts
    return `${basePrompt}

${preservationInstructions}

${goalContext}

CONVERSATION TO SUMMARIZE:
${conversationText}

Provide a concise summary that maintains essential information for continuing the conversation.`;
  }

  /**
   * Get base prompt for compression level
   */
  private getBasePrompt(level: CompressionLevel): string {
    switch (level) {
      case 1: // COMPACT - Ultra-compressed
        return `You are summarizing a conversation history. Create an ULTRA-COMPACT summary (50-100 tokens).

Focus on:
- Key decisions made
- Critical information only
- Essential context for continuation

Omit:
- Conversational details
- Intermediate steps
- Explanations`;

      case 2: // MODERATE - Balanced
        return `You are summarizing a conversation history. Create a MODERATE summary (150-300 tokens).

Focus on:
- Important decisions and outcomes
- Key technical details
- Relevant context
- Main discussion points

Omit:
- Verbose explanations
- Redundant information`;

      case 3: // DETAILED - Comprehensive
        return `You are summarizing a conversation history. Create a DETAILED summary (300-500 tokens).

Focus on:
- All significant decisions
- Technical details and implementations
- Discussion context
- Important code snippets or file paths
- Reasoning behind choices

Maintain enough detail for seamless continuation.`;

      default:
        return this.getBasePrompt(3); // Default to detailed
    }
  }

  /**
   * Get mode-specific preservation instructions
   */
  private getPreservationInstructions(): string {
    switch (this.mode) {
      case 'DEVELOPER':
        return `PRESERVATION PRIORITY (Developer Mode):
- Code snippets and file paths
- Technical decisions and implementations
- Error messages and debugging context
- API signatures and function names`;

      case 'PLANNING':
        return `PRESERVATION PRIORITY (Planning Mode):
- Goals and objectives
- Architectural decisions
- Trade-offs discussed
- Next steps and action items`;

      case 'DEBUGGER':
        return `PRESERVATION PRIORITY (Debugger Mode):
- Error symptoms and stack traces
- Debugging steps taken
- Root cause analysis
- Solutions attempted and results`;

      case 'ASSISTANT':
      default:
        return `PRESERVATION PRIORITY:
- Key decisions made
- Important context
- User preferences
- Conversation flow`;
    }
  }

  /**
   * Build goal context for goal-aware summarization
   */
  private buildGoalContext(goal: Goal): string {
    const completedSubtasks = goal.subtasks.filter((s) => s.status === 'completed');
    const inProgressSubtasks = goal.subtasks.filter((s) => s.status === 'in-progress');
    const lockedDecisions = goal.decisions.filter((d) => d.locked);

    return `ACTIVE GOAL: ${goal.description}
Priority: ${goal.priority}
Status: ${goal.status}

Completed Subtasks (${completedSubtasks.length}/${goal.subtasks.length}):
${completedSubtasks.map((s) => `✅ ${s.description}`).join('\n')}

In Progress:
${inProgressSubtasks.map((s) => `🔄 ${s.description}`).join('\n')}

Locked Decisions:
${lockedDecisions.map((d) => `🔒 ${d.description}`).join('\n')}

Recent Artifacts:
${goal.artifacts.slice(-3).map((a) => `${a.action} ${a.path}`).join('\n')}

IMPORTANT: Preserve information relevant to goal progress.`;
  }

  /**
   * Call LLM with timeout and error handling
   *
   * Requirements: FR-7
   */
  private async callLLM(prompt: string): Promise<string> {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.timeout);

    try {
      const request: ProviderRequest = {
        model: this.model,
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: prompt }],
          },
        ],
        options: {
          temperature: 0.3, // Lower temperature for consistent summaries
          maxTokens: this.maxSummaryTokens,
        },
        abortSignal: abortController.signal,
        timeout: this.timeout,
      };

      let summary = '';

      // Stream response from LLM
      for await (const event of this.provider.chatStream(request)) {
        if (event.type === 'text') {
          summary += event.value;
        } else if (event.type === 'error') {
          throw new Error(event.error.message);
        } else if (event.type === 'finish') {
          break;
        }
      }

      clearTimeout(timeoutId);

      if (!summary.trim()) {
        throw new Error('LLM returned empty summary');
      }

      return summary.trim();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Summarization timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Validate summary quality
   *
   * Requirements: FR-6
   */
  validateSummary(
    summary: string,
    originalMessages: Message[]
  ): { valid: boolean; reason?: string } {
    // Check if summary is empty
    if (!summary || summary.trim().length === 0) {
      return { valid: false, reason: 'Summary is empty' };
    }

    // Calculate original length
    const originalLength = originalMessages.reduce((sum, m) => sum + m.content.length, 0);

    // For very short messages (< 30 chars), be more lenient
    if (originalLength < 30) {
      // Just check that summary is not empty and reasonable
      if (summary.length < 15) {
        return { valid: false, reason: 'Summary is too short (< 15 characters)' };
      }
      // Allow summary to be up to 2x longer for very short messages
      if (summary.length > originalLength * 2) {
        return { valid: false, reason: 'Summary is significantly longer than original content' };
      }
      return { valid: true };
    }

    // Check if summary is too short (likely failed)
    if (summary.length < 20) {
      return { valid: false, reason: 'Summary is too short (< 20 characters)' };
    }

    // Check if summary is just repeating the prompt
    if (summary.toLowerCase().includes('summarize') && summary.length < 100) {
      return { valid: false, reason: 'Summary appears to be echoing the prompt' };
    }

    // Check if summary is longer than original (compression failed)
    // Allow some tolerance for short messages (up to 50% longer)
    const maxAllowedLength = Math.max(originalLength, originalLength * 1.5);
    
    if (summary.length > maxAllowedLength) {
      return { valid: false, reason: 'Summary is significantly longer than original content' };
    }

    // Check token count is within limits
    const estimatedTokens = Math.ceil(summary.length / 4);
    if (estimatedTokens > this.maxSummaryTokens * 1.2) {
      // Allow 20% overage
      return {
        valid: false,
        reason: `Summary exceeds token limit (${estimatedTokens} > ${this.maxSummaryTokens})`,
      };
    }

    return { valid: true };
  }

  /**
   * Update configuration
   */
  setMode(mode: 'DEVELOPER' | 'PLANNING' | 'DEBUGGER' | 'ASSISTANT'): void {
    this.mode = mode;
  }

  setMaxSummaryTokens(maxTokens: number): void {
    this.maxSummaryTokens = maxTokens;
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}
