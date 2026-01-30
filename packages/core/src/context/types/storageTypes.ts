/**
 * Storage Layer Type Definitions
 *
 * This module defines the three distinct storage layers for the context compression system:
 * 1. Active Context - What gets sent to the LLM (compressed, in-memory)
 * 2. Snapshots - Recovery and rollback data (on disk, never sent to LLM)
 * 3. Session History - Complete uncompressed conversation (on disk, never sent to LLM)
 *
 * These layers are strictly separated with runtime enforcement to prevent cross-contamination.
 *
 * @module storageTypes
 */

import type { Goal } from '../goalTypes.js';
import type { Message } from '../types.js';

// ============================================================================
// Active Context Types (LLM-Bound)
// ============================================================================

/**
 * Active context - what gets sent to the LLM
 *
 * This is the ONLY data structure that should be sent to the LLM.
 * It MUST fit within the Ollama context limit (85% pre-calculated value).
 *
 * **Storage Location:** In-memory only
 * **Lifetime:** Current conversation session
 * **Purpose:** Provide context to LLM for generating responses
 *
 * @example
 * ```typescript
 * const activeContext: ActiveContext = {
 *   systemPrompt: { role: 'system', content: '...', id: '...', timestamp: new Date() },
 *   checkpoints: [checkpoint1, checkpoint2],
 *   recentMessages: [msg1, msg2, msg3],
 *   tokenCount: {
 *     system: 500,
 *     checkpoints: 1200,
 *     recent: 800,
 *     total: 2500
 *   }
 * };
 * ```
 */
export interface ActiveContext {
  /**
   * System prompt message
   * Built by PromptOrchestrator, includes tier prompt + mandates + goals + skills
   * NEVER compressed or modified
   */
  systemPrompt: Message;

  /**
   * Compression checkpoints (LLM-generated summaries)
   * These are summaries of old conversation segments
   * Ordered chronologically (oldest first)
   * Each checkpoint represents a compressed segment of conversation history
   */
  checkpoints: CheckpointSummary[];

  /**
   * Recent messages kept in full
   * Last N messages (typically 5-20 depending on tier)
   * Includes both user and assistant messages
   * Ordered chronologically (oldest first)
   */
  recentMessages: Message[];

  /**
   * Token count breakdown
   * Used for validation and compression triggers
   */
  tokenCount: {
    /** Tokens in system prompt */
    system: number;
    /** Total tokens across all checkpoints */
    checkpoints: number;
    /** Total tokens in recent messages */
    recent: number;
    /** Total tokens (system + checkpoints + recent) */
    total: number;
  };
}

/**
 * Checkpoint summary - LLM-generated summary of old messages
 *
 * Represents a compressed segment of conversation history.
 * Created by asking the LLM to summarize old messages into a concise summary.
 *
 * **Compression Levels:**
 * - Level 1 (Compact): Ultra-compressed, minimal detail (10+ compressions old)
 * - Level 2 (Moderate): Medium detail (5-9 compressions old)
 * - Level 3 (Detailed): Full detail, recent checkpoint (1-4 compressions old)
 *
 * @example
 * ```typescript
 * const checkpoint: CheckpointSummary = {
 *   id: 'ckpt_abc123',
 *   timestamp: Date.now(),
 *   summary: 'User requested file read feature. Implemented readFile() with error handling...',
 *   originalMessageIds: ['msg_1', 'msg_2', 'msg_3'],
 *   tokenCount: 150,
 *   compressionLevel: 3,
 *   compressionNumber: 1,
 *   metadata: {
 *     model: 'llama3:8b',
 *     createdAt: Date.now()
 *   }
 * };
 * ```
 */
export interface CheckpointSummary {
  /** Unique checkpoint identifier (UUID) */
  id: string;

  /** Creation timestamp (milliseconds since epoch) */
  timestamp: number;

  /**
   * LLM-generated summary of the conversation segment
   * This is the actual text that gets included in the prompt
   * Should be concise but preserve key information
   */
  summary: string;

  /**
   * IDs of original messages that were replaced by this summary
   * Used for tracking and potential restoration
   */
  originalMessageIds: string[];

  /** Token count of the summary text */
  tokenCount: number;

  /**
   * Compression level (determines detail)
   * 1 = Compact (ultra-compressed)
   * 2 = Moderate (medium detail)
   * 3 = Detailed (full detail)
   */
  compressionLevel: 1 | 2 | 3;

  /**
   * Compression number when this checkpoint was created
   * Used for aging calculations (older checkpoints get re-compressed)
   */
  compressionNumber: number;

  /** Additional metadata about the checkpoint */
  metadata: {
    /** Model used to create the summary */
    model: string;
    /** When the checkpoint was created (milliseconds since epoch) */
    createdAt: number;
    /** When the checkpoint was last compressed (for aging) */
    compressedAt?: number;
  };
}

// ============================================================================
// Snapshot Types (Recovery)
// ============================================================================

/**
 * Snapshot data - for recovery and rollback
 *
 * Snapshots capture the complete conversation state at a point in time.
 * They are NEVER sent to the LLM - only used for recovery and rollback.
 *
 * **Storage Location:** On disk (`.ollm/snapshots/`)
 * **Lifetime:** Configurable (default: keep last 5)
 * **Purpose:** Enable recovery from errors, rollback to previous state
 *
 * @example
 * ```typescript
 * const snapshot: SnapshotData = {
 *   id: 'snap_xyz789',
 *   sessionId: 'session_abc123',
 *   timestamp: Date.now(),
 *   conversationState: {
 *     messages: [...],
 *     checkpoints: [...],
 *     goals: [...],
 *     metadata: { ... }
 *   },
 *   purpose: 'recovery'
 * };
 * ```
 */
export interface SnapshotData {
  /** Unique snapshot identifier (UUID) */
  id: string;

  /** Associated session ID */
  sessionId: string;

  /** Creation timestamp (milliseconds since epoch) */
  timestamp: number;

  /**
   * Complete conversation state at snapshot time
   * This is the full state needed to restore the conversation
   */
  conversationState: {
    /** All messages at the time of snapshot (full, uncompressed) */
    messages: Message[];

    /** All checkpoints at the time of snapshot */
    checkpoints: CheckpointSummary[];

    /** Active goals at the time of snapshot */
    goals?: Goal[];

    /** Additional metadata */
    metadata: Record<string, unknown>;
  };

  /**
   * Purpose of this snapshot
   * - recovery: Automatic snapshot for error recovery
   * - rollback: Manual snapshot for user-initiated rollback
   * - emergency: Emergency snapshot before critical operations
   */
  purpose: 'recovery' | 'rollback' | 'emergency';
}

// ============================================================================
// Session History Types (Complete Record)
// ============================================================================

/**
 * Session history - complete uncompressed conversation
 *
 * The session history stores the COMPLETE, UNCOMPRESSED conversation.
 * This is the source of truth for what actually happened in the conversation.
 * It is NEVER sent to the LLM and NEVER compressed.
 *
 * **Storage Location:** On disk (`.ollm/session-data/`)
 * **Lifetime:** Permanent (until user deletes)
 * **Purpose:** Complete conversation record, export, review
 *
 * @example
 * ```typescript
 * const history: SessionHistory = {
 *   sessionId: 'session_abc123',
 *   messages: [...], // ALL messages, never compressed
 *   checkpointRecords: [...],
 *   metadata: {
 *     startTime: Date.now(),
 *     lastUpdate: Date.now(),
 *     totalMessages: 42,
 *     totalTokens: 15000,
 *     compressionCount: 3
 *   }
 * };
 * ```
 */
export interface SessionHistory {
  /** Session identifier */
  sessionId: string;

  /**
   * Complete uncompressed message history
   * This array is APPEND-ONLY - messages are never removed or modified
   * Includes all user and assistant messages from the entire conversation
   */
  messages: Message[];

  /**
   * Records of checkpoint creation events
   * Metadata about when and how compressions occurred
   * Does NOT include the actual summaries (those are in checkpoints)
   */
  checkpointRecords: CheckpointRecord[];

  /** Session metadata and statistics */
  metadata: {
    /** When the session started (milliseconds since epoch) */
    startTime: number;

    /** Last update timestamp (milliseconds since epoch) */
    lastUpdate: number;

    /** Total number of messages in history */
    totalMessages: number;

    /** Total tokens across all messages (uncompressed) */
    totalTokens: number;

    /** Number of compressions performed */
    compressionCount: number;
  };
}

/**
 * Checkpoint record - metadata about checkpoint creation
 *
 * Records when and how a checkpoint was created.
 * This is metadata only - the actual summary is in CheckpointSummary.
 *
 * @example
 * ```typescript
 * const record: CheckpointRecord = {
 *   id: 'ckpt_abc123',
 *   timestamp: Date.now(),
 *   messageRange: [0, 10],
 *   originalTokens: 2500,
 *   compressedTokens: 300,
 *   compressionRatio: 0.12,
 *   level: 3
 * };
 * ```
 */
export interface CheckpointRecord {
  /** Checkpoint ID (matches CheckpointSummary.id) */
  id: string;

  /** When the checkpoint was created (milliseconds since epoch) */
  timestamp: number;

  /**
   * Message range that was compressed
   * [startIndex, endIndex] in the messages array
   */
  messageRange: [number, number];

  /** Original token count before compression */
  originalTokens: number;

  /** Token count after compression */
  compressedTokens: number;

  /** Compression ratio (compressedTokens / originalTokens) */
  compressionRatio: number;

  /** Compression level used (1=compact, 2=moderate, 3=detailed) */
  level: 1 | 2 | 3;
}

// ============================================================================
// Storage Boundaries (Runtime Enforcement)
// ============================================================================

/**
 * Validation result for storage operations
 *
 * @example
 * ```typescript
 * const result: ValidationResult = {
 *   valid: false,
 *   errors: ['System prompt missing', 'Token count exceeds limit']
 * };
 * ```
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;

  /** List of validation errors (empty if valid) */
  errors?: string[];
}

/**
 * Storage boundaries - prevent cross-contamination
 *
 * This interface defines methods to enforce strict separation between storage layers.
 * It provides type guards, validation, and enforcement to prevent:
 * - Snapshots being included in prompts sent to LLM
 * - Session history being included in prompts sent to LLM
 * - Active context being stored as permanent history
 *
 * **Critical Rules:**
 * 1. Only ActiveContext should ever be sent to the LLM
 * 2. Snapshots are for recovery only, never for LLM consumption
 * 3. Session history is for record-keeping only, never for LLM consumption
 *
 * @example
 * ```typescript
 * const boundaries: StorageBoundaries = new StorageBoundariesImpl();
 *
 * // Type guard
 * if (boundaries.isActiveContext(data)) {
 *   // Safe to send to LLM
 *   await sendToLLM(data);
 * }
 *
 * // Validation
 * const result = boundaries.validateActiveContext(context);
 * if (!result.valid) {
 *   throw new Error(`Invalid context: ${result.errors.join(', ')}`);
 * }
 *
 * // Enforcement
 * boundaries.preventSnapshotInPrompt(prompt); // Throws if snapshot data detected
 * ```
 */
export interface StorageBoundaries {
  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Check if data is valid ActiveContext
   *
   * @param data - Data to check
   * @returns True if data is ActiveContext
   */
  isActiveContext(data: unknown): data is ActiveContext;

  /**
   * Check if data is valid SnapshotData
   *
   * @param data - Data to check
   * @returns True if data is SnapshotData
   */
  isSnapshotData(data: unknown): data is SnapshotData;

  /**
   * Check if data is valid SessionHistory
   *
   * @param data - Data to check
   * @returns True if data is SessionHistory
   */
  isSessionHistory(data: unknown): data is SessionHistory;

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate ActiveContext structure and constraints
   *
   * Checks:
   * - System prompt exists and is valid
   * - Checkpoints are valid CheckpointSummary objects
   * - Recent messages are valid Message objects
   * - Token counts are accurate and consistent
   * - Total tokens don't exceed limits
   *
   * @param context - Active context to validate
   * @returns Validation result with errors if invalid
   */
  validateActiveContext(context: ActiveContext): ValidationResult;

  /**
   * Validate SnapshotData structure and constraints
   *
   * Checks:
   * - ID and session ID are present
   * - Timestamp is valid
   * - Conversation state is complete
   * - Purpose is valid
   *
   * @param snapshot - Snapshot to validate
   * @returns Validation result with errors if invalid
   */
  validateSnapshotData(snapshot: SnapshotData): ValidationResult;

  /**
   * Validate SessionHistory structure and constraints
   *
   * Checks:
   * - Session ID is present
   * - Messages array exists
   * - Checkpoint records are valid
   * - Metadata is complete and consistent
   *
   * @param history - Session history to validate
   * @returns Validation result with errors if invalid
   */
  validateSessionHistory(history: SessionHistory): ValidationResult;

  // ============================================================================
  // Enforcement
  // ============================================================================

  /**
   * Prevent snapshot data from being included in prompt
   *
   * Scans the prompt for any snapshot-specific data structures.
   * Throws an error if snapshot data is detected.
   *
   * **Critical:** This prevents accidentally sending recovery data to the LLM.
   *
   * @param prompt - Prompt messages to check
   * @throws Error if snapshot data detected in prompt
   */
  preventSnapshotInPrompt(prompt: Message[]): void;

  /**
   * Prevent session history from being included in prompt
   *
   * Scans the prompt for any session history data structures.
   * Throws an error if session history data is detected.
   *
   * **Critical:** This prevents accidentally sending full history to the LLM.
   *
   * @param prompt - Prompt messages to check
   * @throws Error if session history data detected in prompt
   */
  preventHistoryInPrompt(prompt: Message[]): void;
}

// ============================================================================
// Type Guards (Standalone Functions)
// ============================================================================

/**
 * Type guard for ActiveContext
 *
 * @param data - Data to check
 * @returns True if data is ActiveContext
 *
 * @example
 * ```typescript
 * if (isActiveContext(data)) {
 *   console.log(`Active context has ${data.checkpoints.length} checkpoints`);
 * }
 * ```
 */
export function isActiveContext(data: unknown): data is ActiveContext {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'systemPrompt' in obj &&
    typeof obj.systemPrompt === 'object' &&
    'checkpoints' in obj &&
    Array.isArray(obj.checkpoints) &&
    'recentMessages' in obj &&
    Array.isArray(obj.recentMessages) &&
    'tokenCount' in obj &&
    typeof obj.tokenCount === 'object'
  );
}

/**
 * Type guard for SnapshotData
 *
 * @param data - Data to check
 * @returns True if data is SnapshotData
 *
 * @example
 * ```typescript
 * if (isSnapshotData(data)) {
 *   console.log(`Snapshot ${data.id} for session ${data.sessionId}`);
 * }
 * ```
 */
export function isSnapshotData(data: unknown): data is SnapshotData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'id' in obj &&
    typeof obj.id === 'string' &&
    'sessionId' in obj &&
    typeof obj.sessionId === 'string' &&
    'timestamp' in obj &&
    typeof obj.timestamp === 'number' &&
    'conversationState' in obj &&
    typeof obj.conversationState === 'object' &&
    'purpose' in obj &&
    (obj.purpose === 'recovery' || obj.purpose === 'rollback' || obj.purpose === 'emergency')
  );
}

/**
 * Type guard for SessionHistory
 *
 * @param data - Data to check
 * @returns True if data is SessionHistory
 *
 * @example
 * ```typescript
 * if (isSessionHistory(data)) {
 *   console.log(`Session has ${data.messages.length} messages`);
 * }
 * ```
 */
export function isSessionHistory(data: unknown): data is SessionHistory {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  return (
    'sessionId' in obj &&
    typeof obj.sessionId === 'string' &&
    'messages' in obj &&
    Array.isArray(obj.messages) &&
    'checkpointRecords' in obj &&
    Array.isArray(obj.checkpointRecords) &&
    'metadata' in obj &&
    typeof obj.metadata === 'object'
  );
}
