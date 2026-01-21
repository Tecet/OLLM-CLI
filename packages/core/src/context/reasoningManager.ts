/**
 * Reasoning Manager
 * 
 * Manages reasoning traces from reasoning models (DeepSeek-R1, QwQ, o1, etc.)
 * Preserves thinking processes across context rollovers.
 */

import { randomUUID } from 'crypto';
import type {
  ReasoningTrace,
  ArchivedReasoningTrace,
  ReasoningStorage,
  ReasoningConfig
} from './reasoningTypes.js';

/**
 * Reasoning Manager Implementation
 */
export class ReasoningManagerImpl {
  private traces: Map<string, ReasoningTrace> = new Map();
  private config: ReasoningConfig;

  constructor(config: ReasoningConfig) {
    this.config = config;
  }

  /**
   * Add a reasoning trace
   */
  addTrace(
    messageId: string,
    thinking: string,
    modelName: string,
    thinkingTokens: number,
    answerTokens: number,
    context?: {
      goalId?: string;
      checkpointId?: string;
      decisionId?: string;
      userMessageId?: string;
    }
  ): ReasoningTrace {
    const trace: ReasoningTrace = {
      id: randomUUID(),
      timestamp: new Date(),
      messageId,
      thinking,
      context: context || {},
      metadata: {
        modelName,
        thinkingTokens,
        answerTokens
      }
    };

    // Auto-extract structured data if enabled
    if (this.config.autoExtractStructured) {
      trace.structured = this.extractStructuredData(thinking);
    }

    this.traces.set(trace.id, trace);

    return trace;
  }

  /**
   * Get reasoning storage for snapshot
   */
  getReasoningStorage(): ReasoningStorage {
    const allTraces = Array.from(this.traces.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Keep last N traces in full
    const recent = allTraces.slice(0, this.config.keepRecentTraces);

    // Archive older traces
    const toArchive = allTraces.slice(this.config.keepRecentTraces);
    const archived: ArchivedReasoningTrace[] = toArchive
      .slice(0, this.config.maxArchivedTraces)
      .map(trace => ({
        id: trace.id,
        timestamp: trace.timestamp,
        summary: this.summarizeThinking(trace.thinking),
        keyInsights: trace.structured?.keyInsights || [],
        fullTraceAvailable: true
      }));

    // Calculate totals
    const totalThinkingTokens = allTraces.reduce(
      (sum, t) => sum + t.metadata.thinkingTokens,
      0
    );

    return {
      recent,
      archived,
      totalTraces: allTraces.length,
      totalThinkingTokens
    };
  }

  /**
   * Restore reasoning storage from snapshot
   */
  restoreReasoningStorage(storage: ReasoningStorage): void {
    this.traces.clear();

    // Restore recent traces
    for (const trace of storage.recent) {
      this.traces.set(trace.id, trace);
    }
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): ReasoningTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces for a goal
   */
  getTracesForGoal(goalId: string): ReasoningTrace[] {
    return Array.from(this.traces.values())
      .filter(t => t.context.goalId === goalId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get all traces for a message
   */
  getTracesForMessage(messageId: string): ReasoningTrace[] {
    return Array.from(this.traces.values())
      .filter(t => t.messageId === messageId);
  }

  /**
   * Clear all traces
   */
  clear(): void {
    this.traces.clear();
  }

  /**
   * Extract structured data from thinking process
   */
  private extractStructuredData(thinking: string): {
    alternatives: string[];
    chosenApproach: string;
    rationale: string;
    confidence: number;
    keyInsights: string[];
  } {
    const alternatives: string[] = [];
    const keyInsights: string[] = [];
    let chosenApproach = '';
    let rationale = '';
    let confidence = 50;

    // Extract alternatives (lines starting with "Alternative:", "Option:", etc.)
    const altRegex = /(?:Alternative|Option|Approach)\s*\d*:\s*(.+)/gi;
    let match;
    while ((match = altRegex.exec(thinking)) !== null) {
      alternatives.push(match[1].trim());
    }

    // Extract chosen approach (lines with "chosen", "selected", "decided")
    const chosenRegex = /(?:chosen|selected|decided|going with):\s*(.+)/i;
    const chosenMatch = thinking.match(chosenRegex);
    if (chosenMatch) {
      chosenApproach = chosenMatch[1].trim();
    }

    // Extract rationale (lines with "because", "rationale", "reason")
    const rationaleRegex = /(?:because|rationale|reason):\s*(.+)/i;
    const rationaleMatch = thinking.match(rationaleRegex);
    if (rationaleMatch) {
      rationale = rationaleMatch[1].trim();
    }

    // Extract key insights (lines with "insight:", "key:", "important:")
    const insightRegex = /(?:insight|key|important):\s*(.+)/gi;
    while ((match = insightRegex.exec(thinking)) !== null) {
      keyInsights.push(match[1].trim());
    }

    // Estimate confidence (look for confidence indicators)
    // Check for negative indicators first (more specific)
    if (thinking.match(/(?:uncertain|unsure|maybe|doubt|unclear|not sure|not confident)/i)) {
      confidence = 40;
    } else if (thinking.match(/(?:confident|certain|sure|definitely|clearly)/i)) {
      confidence = 80;
    }

    return {
      alternatives,
      chosenApproach,
      rationale,
      confidence,
      keyInsights
    };
  }

  /**
   * Summarize thinking process (first 200 chars)
   */
  private summarizeThinking(thinking: string): string {
    // Remove extra whitespace
    const cleaned = thinking.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= 200) {
      return cleaned;
    }

    return cleaned.substring(0, 197) + '...';
  }
}

/**
 * Create a new reasoning manager
 */
export function createReasoningManager(config: ReasoningConfig): ReasoningManagerImpl {
  return new ReasoningManagerImpl(config);
}
