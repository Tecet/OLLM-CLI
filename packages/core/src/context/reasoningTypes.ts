/**
 * Reasoning Trace Types
 * 
 * Support for reasoning models (DeepSeek-R1, QwQ, o1, etc.) that produce
 * internal thinking processes. These traces are preserved across context
 * rollovers so the model can review its past reasoning.
 */

/**
 * Reasoning trace from a reasoning model
 */
export interface ReasoningTrace {
  /** Unique ID */
  id: string;
  
  /** When this reasoning occurred */
  timestamp: Date;
  
  /** What message this reasoning is for */
  messageId: string;
  
  /** Full thinking process (from <think> tags) */
  thinking: string;
  
  /** Context about what was being worked on */
  context: {
    /** Goal being worked on */
    goalId?: string;
    /** Checkpoint this relates to */
    checkpointId?: string;
    /** Decision this relates to */
    decisionId?: string;
    /** User message that prompted this */
    userMessageId?: string;
  };
  
  /** Structured reasoning data (parsed from thinking) */
  structured?: {
    /** Alternative approaches considered */
    alternatives: string[];
    /** Chosen approach */
    chosenApproach: string;
    /** Rationale for choice */
    rationale: string;
    /** Confidence level (0-100) */
    confidence: number;
    /** Key insights discovered */
    keyInsights: string[];
  };
  
  /** Metadata */
  metadata: {
    /** Model that produced this reasoning */
    modelName: string;
    /** Tokens used in thinking */
    thinkingTokens: number;
    /** Tokens in final answer */
    answerTokens: number;
  };
}

/**
 * Archived reasoning trace (summary only)
 */
export interface ArchivedReasoningTrace {
  /** Original trace ID */
  id: string;
  /** When this reasoning occurred */
  timestamp: Date;
  /** Brief summary of thinking (first 200 chars) */
  summary: string;
  /** Key insights (preserved) */
  keyInsights: string[];
  /** Full trace available for retrieval */
  fullTraceAvailable: boolean;
}

/**
 * Reasoning storage in snapshot
 */
export interface ReasoningStorage {
  /** Recent reasoning traces (last 5, full detail) */
  recent: ReasoningTrace[];
  
  /** Archived reasoning traces (summaries only) */
  archived: ArchivedReasoningTrace[];
  
  /** Total reasoning traces in session */
  totalTraces: number;
  
  /** Total thinking tokens used */
  totalThinkingTokens: number;
}

/**
 * Configuration for reasoning trace management
 */
export interface ReasoningConfig {
  /** Enable reasoning trace storage */
  enabled: boolean;
  
  /** Keep last N reasoning traces in full (default: 5) */
  keepRecentTraces: number;
  
  /** Maximum archived traces to keep (default: 20) */
  maxArchivedTraces: number;
  
  /** Auto-extract structured data from thinking (default: true) */
  autoExtractStructured: boolean;
}

/**
 * Default reasoning configuration
 */
export const DEFAULT_REASONING_CONFIG: ReasoningConfig = {
  enabled: true,
  keepRecentTraces: 5,
  maxArchivedTraces: 20,
  autoExtractStructured: true
};
