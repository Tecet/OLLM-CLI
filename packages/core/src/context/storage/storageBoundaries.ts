/**
 * Storage Boundaries Implementation
 * 
 * Enforces strict separation between storage layers to prevent cross-contamination.
 * Provides runtime validation and enforcement to ensure:
 * - Only ActiveContext is sent to the LLM
 * - Snapshots are never included in prompts
 * - Session history is never included in prompts
 * 
 * @module storageBoundaries
 */

import { isActiveContext, isSnapshotData, isSessionHistory } from '../types/storageTypes.js';

import type {
  ActiveContext,
  SnapshotData,
  SessionHistory,
  StorageBoundaries as IStorageBoundaries,
  ValidationResult,
  CheckpointSummary,
} from '../types/storageTypes.js';
import type { Message } from '../types.js';

/**
 * Storage boundaries implementation
 * 
 * Provides type guards, validation, and enforcement methods to maintain
 * strict separation between storage layers.
 * 
 * @example
 * ```typescript
 * const boundaries = new StorageBoundariesImpl();
 * 
 * // Validate before sending to LLM
 * const result = boundaries.validateActiveContext(context);
 * if (!result.valid) {
 *   throw new Error(`Invalid context: ${result.errors?.join(', ')}`);
 * }
 * 
 * // Enforce boundaries
 * boundaries.preventSnapshotInPrompt(prompt);
 * boundaries.preventHistoryInPrompt(prompt);
 * ```
 */
export class StorageBoundariesImpl implements IStorageBoundaries {
  // ============================================================================
  // Type Guards
  // ============================================================================

  /**
   * Check if data is valid ActiveContext
   */
  isActiveContext(data: unknown): data is ActiveContext {
    return isActiveContext(data);
  }

  /**
   * Check if data is valid SnapshotData
   */
  isSnapshotData(data: unknown): data is SnapshotData {
    return isSnapshotData(data);
  }

  /**
   * Check if data is valid SessionHistory
   */
  isSessionHistory(data: unknown): data is SessionHistory {
    return isSessionHistory(data);
  }

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate ActiveContext structure and constraints
   */
  validateActiveContext(context: ActiveContext): ValidationResult {
    const errors: string[] = [];

    // Validate system prompt
    if (!context.systemPrompt) {
      errors.push('System prompt is missing');
    } else if (!this.isValidMessage(context.systemPrompt)) {
      errors.push('System prompt is not a valid Message');
    } else if (context.systemPrompt.role !== 'system') {
      errors.push('System prompt must have role "system"');
    }

    // Validate checkpoints
    if (!Array.isArray(context.checkpoints)) {
      errors.push('Checkpoints must be an array');
    } else {
      context.checkpoints.forEach((checkpoint, index) => {
        const checkpointErrors = this.validateCheckpoint(checkpoint);
        if (checkpointErrors.length > 0) {
          errors.push(`Checkpoint ${index}: ${checkpointErrors.join(', ')}`);
        }
      });
    }

    // Validate recent messages
    if (!Array.isArray(context.recentMessages)) {
      errors.push('Recent messages must be an array');
    } else {
      context.recentMessages.forEach((message, index) => {
        if (!this.isValidMessage(message)) {
          errors.push(`Recent message ${index} is not a valid Message`);
        }
      });
    }

    // Validate token count
    if (!context.tokenCount) {
      errors.push('Token count is missing');
    } else {
      if (typeof context.tokenCount.system !== 'number' || context.tokenCount.system < 0) {
        errors.push('Token count system must be a non-negative number');
      }
      if (typeof context.tokenCount.checkpoints !== 'number' || context.tokenCount.checkpoints < 0) {
        errors.push('Token count checkpoints must be a non-negative number');
      }
      if (typeof context.tokenCount.recent !== 'number' || context.tokenCount.recent < 0) {
        errors.push('Token count recent must be a non-negative number');
      }
      if (typeof context.tokenCount.total !== 'number' || context.tokenCount.total < 0) {
        errors.push('Token count total must be a non-negative number');
      }

      // Validate token count consistency
      const expectedTotal =
        context.tokenCount.system +
        context.tokenCount.checkpoints +
        context.tokenCount.recent;

      if (Math.abs(context.tokenCount.total - expectedTotal) > 1) {
        errors.push(
          `Token count total (${context.tokenCount.total}) does not match sum of components (${expectedTotal})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate SnapshotData structure and constraints
   */
  validateSnapshotData(snapshot: SnapshotData): ValidationResult {
    const errors: string[] = [];

    // Validate ID
    if (!snapshot.id || typeof snapshot.id !== 'string') {
      errors.push('Snapshot ID must be a non-empty string');
    }

    // Validate session ID
    if (!snapshot.sessionId || typeof snapshot.sessionId !== 'string') {
      errors.push('Session ID must be a non-empty string');
    }

    // Validate timestamp
    if (typeof snapshot.timestamp !== 'number' || snapshot.timestamp <= 0) {
      errors.push('Timestamp must be a positive number');
    }

    // Validate conversation state
    if (!snapshot.conversationState) {
      errors.push('Conversation state is missing');
    } else {
      if (!Array.isArray(snapshot.conversationState.messages)) {
        errors.push('Conversation state messages must be an array');
      }
      if (!Array.isArray(snapshot.conversationState.checkpoints)) {
        errors.push('Conversation state checkpoints must be an array');
      }
      if (typeof snapshot.conversationState.metadata !== 'object') {
        errors.push('Conversation state metadata must be an object');
      }
    }

    // Validate purpose
    const validPurposes = ['recovery', 'rollback', 'emergency'];
    if (!validPurposes.includes(snapshot.purpose)) {
      errors.push(`Purpose must be one of: ${validPurposes.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Validate SessionHistory structure and constraints
   */
  validateSessionHistory(history: SessionHistory): ValidationResult {
    const errors: string[] = [];

    // Validate session ID
    if (!history.sessionId || typeof history.sessionId !== 'string') {
      errors.push('Session ID must be a non-empty string');
    }

    // Validate messages
    if (!Array.isArray(history.messages)) {
      errors.push('Messages must be an array');
    } else {
      history.messages.forEach((message, index) => {
        if (!this.isValidMessage(message)) {
          errors.push(`Message ${index} is not a valid Message`);
        }
      });
    }

    // Validate checkpoint records
    if (!Array.isArray(history.checkpointRecords)) {
      errors.push('Checkpoint records must be an array');
    } else {
      history.checkpointRecords.forEach((record, index) => {
        const recordErrors = this.validateCheckpointRecord(record);
        if (recordErrors.length > 0) {
          errors.push(`Checkpoint record ${index}: ${recordErrors.join(', ')}`);
        }
      });
    }

    // Validate metadata
    if (!history.metadata) {
      errors.push('Metadata is missing');
    } else {
      if (typeof history.metadata.startTime !== 'number' || history.metadata.startTime <= 0) {
        errors.push('Metadata startTime must be a positive number');
      }
      if (typeof history.metadata.lastUpdate !== 'number' || history.metadata.lastUpdate <= 0) {
        errors.push('Metadata lastUpdate must be a positive number');
      }
      if (typeof history.metadata.totalMessages !== 'number' || history.metadata.totalMessages < 0) {
        errors.push('Metadata totalMessages must be a non-negative number');
      }
      if (typeof history.metadata.totalTokens !== 'number' || history.metadata.totalTokens < 0) {
        errors.push('Metadata totalTokens must be a non-negative number');
      }
      if (typeof history.metadata.compressionCount !== 'number' || history.metadata.compressionCount < 0) {
        errors.push('Metadata compressionCount must be a non-negative number');
      }

      // Validate metadata consistency
      if (history.metadata.totalMessages !== history.messages.length) {
        errors.push(
          `Metadata totalMessages (${history.metadata.totalMessages}) does not match messages array length (${history.messages.length})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============================================================================
  // Enforcement
  // ============================================================================

  /**
   * Prevent snapshot data from being included in prompt
   * 
   * Scans messages for snapshot-specific markers and throws if detected.
   */
  preventSnapshotInPrompt(prompt: Message[]): void {
    for (const message of prompt) {
      // Check for snapshot-specific fields in message metadata
      if (message.metadata) {
        if ('snapshotId' in message.metadata) {
          throw new Error(
            'CRITICAL: Snapshot data detected in prompt. Snapshots must never be sent to LLM.'
          );
        }
        if ('conversationState' in message.metadata) {
          throw new Error(
            'CRITICAL: Snapshot conversation state detected in prompt. Snapshots must never be sent to LLM.'
          );
        }
        if ('purpose' in message.metadata && 
            ['recovery', 'rollback', 'emergency'].includes(message.metadata.purpose as string)) {
          throw new Error(
            'CRITICAL: Snapshot purpose marker detected in prompt. Snapshots must never be sent to LLM.'
          );
        }
      }

      // Check message content for snapshot markers
      if (typeof message.content === 'string') {
        if (message.content.includes('[SNAPSHOT]') || message.content.includes('snapshot_')) {
          throw new Error(
            'WARNING: Possible snapshot data in message content. Review prompt before sending to LLM.'
          );
        }
      }
    }
  }

  /**
   * Prevent session history from being included in prompt
   * 
   * Scans messages for session history markers and throws if detected.
   */
  preventHistoryInPrompt(prompt: Message[]): void {
    for (const message of prompt) {
      // Check for session history-specific fields in message metadata
      if (message.metadata) {
        if ('sessionHistory' in message.metadata) {
          throw new Error(
            'CRITICAL: Session history detected in prompt. Session history must never be sent to LLM.'
          );
        }
        if ('checkpointRecords' in message.metadata) {
          throw new Error(
            'CRITICAL: Checkpoint records detected in prompt. Session history must never be sent to LLM.'
          );
        }
        if ('totalMessages' in message.metadata && 'compressionCount' in message.metadata) {
          throw new Error(
            'CRITICAL: Session history metadata detected in prompt. Session history must never be sent to LLM.'
          );
        }
      }

      // Check message content for history markers
      if (typeof message.content === 'string') {
        if (message.content.includes('[HISTORY]') || message.content.includes('session_history_')) {
          throw new Error(
            'WARNING: Possible session history data in message content. Review prompt before sending to LLM.'
          );
        }
      }
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Validate a message object
   */
  private isValidMessage(message: unknown): message is Message {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;

    return (
      'role' in msg &&
      typeof msg.role === 'string' &&
      ['system', 'user', 'assistant'].includes(msg.role) &&
      'content' in msg &&
      (typeof msg.content === 'string' || Array.isArray(msg.content)) &&
      'id' in msg &&
      typeof msg.id === 'string' &&
      'timestamp' in msg
    );
  }

  /**
   * Validate a checkpoint summary
   */
  private validateCheckpoint(checkpoint: CheckpointSummary): string[] {
    const errors: string[] = [];

    if (!checkpoint.id || typeof checkpoint.id !== 'string') {
      errors.push('ID must be a non-empty string');
    }

    if (typeof checkpoint.timestamp !== 'number' || checkpoint.timestamp <= 0) {
      errors.push('Timestamp must be a positive number');
    }

    if (!checkpoint.summary || typeof checkpoint.summary !== 'string') {
      errors.push('Summary must be a non-empty string');
    }

    if (!Array.isArray(checkpoint.originalMessageIds)) {
      errors.push('Original message IDs must be an array');
    }

    if (typeof checkpoint.tokenCount !== 'number' || checkpoint.tokenCount < 0) {
      errors.push('Token count must be a non-negative number');
    }

    if (![1, 2, 3].includes(checkpoint.compressionLevel)) {
      errors.push('Compression level must be 1, 2, or 3');
    }

    if (typeof checkpoint.compressionNumber !== 'number' || checkpoint.compressionNumber < 0) {
      errors.push('Compression number must be a non-negative number');
    }

    if (!checkpoint.metadata || typeof checkpoint.metadata !== 'object') {
      errors.push('Metadata must be an object');
    } else {
      if (!checkpoint.metadata.model || typeof checkpoint.metadata.model !== 'string') {
        errors.push('Metadata model must be a non-empty string');
      }
      if (typeof checkpoint.metadata.createdAt !== 'number' || checkpoint.metadata.createdAt <= 0) {
        errors.push('Metadata createdAt must be a positive number');
      }
    }

    return errors;
  }

  /**
   * Validate a checkpoint record
   */
  private validateCheckpointRecord(record: any): string[] {
    const errors: string[] = [];

    if (!record.id || typeof record.id !== 'string') {
      errors.push('ID must be a non-empty string');
    }

    if (typeof record.timestamp !== 'number' || record.timestamp <= 0) {
      errors.push('Timestamp must be a positive number');
    }

    if (!Array.isArray(record.messageRange) || record.messageRange.length !== 2) {
      errors.push('Message range must be an array of two numbers');
    } else {
      if (typeof record.messageRange[0] !== 'number' || record.messageRange[0] < 0) {
        errors.push('Message range start must be a non-negative number');
      }
      if (typeof record.messageRange[1] !== 'number' || record.messageRange[1] < 0) {
        errors.push('Message range end must be a non-negative number');
      }
      if (record.messageRange[0] > record.messageRange[1]) {
        errors.push('Message range start must be less than or equal to end');
      }
    }

    if (typeof record.originalTokens !== 'number' || record.originalTokens < 0) {
      errors.push('Original tokens must be a non-negative number');
    }

    if (typeof record.compressedTokens !== 'number' || record.compressedTokens < 0) {
      errors.push('Compressed tokens must be a non-negative number');
    }

    if (typeof record.compressionRatio !== 'number' || record.compressionRatio < 0 || record.compressionRatio > 1) {
      errors.push('Compression ratio must be between 0 and 1');
    }

    if (![1, 2, 3].includes(record.level)) {
      errors.push('Level must be 1, 2, or 3');
    }

    return errors;
  }
}

/**
 * Create a new StorageBoundaries instance
 * 
 * @returns StorageBoundaries implementation
 * 
 * @example
 * ```typescript
 * const boundaries = createStorageBoundaries();
 * const result = boundaries.validateActiveContext(context);
 * ```
 */
export function createStorageBoundaries(): IStorageBoundaries {
  return new StorageBoundariesImpl();
}
