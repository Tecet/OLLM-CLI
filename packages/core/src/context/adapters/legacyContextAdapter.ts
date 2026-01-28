/**
 * Legacy Context Adapter
 * 
 * Provides compatibility layer between legacy and new context compression systems.
 * Handles migration of sessions and snapshots from old format to new format.
 */

import type { Session, SessionMessage, SessionMetadata } from '../../services/types.js';
import type { Message } from '../../provider/types.js';

/**
 * Legacy snapshot format (from old snapshotManager.ts)
 */
export interface LegacySnapshot {
  id: string;
  sessionId: string;
  timestamp: number;
  messages: Message[];
  metadata?: {
    compressionCount?: number;
    tokenCount?: number;
    [key: string]: unknown;
  };
}

/**
 * New snapshot format (from new design)
 */
export interface NewSnapshotData {
  id: string;
  sessionId: string;
  timestamp: number;
  conversationState: {
    messages: Message[];
    checkpoints: CheckpointSummary[];
    goals?: Goal[];
    metadata: Record<string, unknown>;
  };
  purpose: 'recovery' | 'rollback' | 'emergency';
}

/**
 * Checkpoint summary (from new design)
 */
export interface CheckpointSummary {
  id: string;
  timestamp: number;
  summary: string;
  originalMessageIds: string[];
  tokenCount: number;
  compressionLevel: 1 | 2 | 3;
  compressionNumber: number;
  metadata: {
    model: string;
    createdAt: number;
    compressedAt?: number;
  };
}

/**
 * Goal interface (placeholder for future implementation)
 */
export interface Goal {
  id: string;
  description: string;
  status: 'active' | 'completed' | 'cancelled';
  [key: string]: unknown;
}

/**
 * New session history format
 */
export interface NewSessionHistory {
  sessionId: string;
  messages: Message[];
  checkpointRecords: CheckpointRecord[];
  metadata: {
    startTime: number;
    lastUpdate: number;
    totalMessages: number;
    totalTokens: number;
    compressionCount: number;
  };
}

/**
 * Checkpoint record
 */
export interface CheckpointRecord {
  id: string;
  timestamp: number;
  messageRange: [number, number];
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  level: 1 | 2 | 3;
}

/**
 * Legacy Context Adapter
 * Converts between old and new formats
 */
export class LegacyContextAdapter {
  /**
   * Convert legacy session to new session history format
   */
  static migrateSession(legacySession: Session): NewSessionHistory {
    // Convert session messages to Message format
    const messages: Message[] = legacySession.messages.map((msg, index) => ({
      id: `msg-${legacySession.sessionId}-${index}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.parts.map(p => p.text).join('\n'),
      timestamp: new Date(msg.timestamp).getTime(),
    }));

    // Create empty checkpoint records (legacy system didn't track these)
    const checkpointRecords: CheckpointRecord[] = [];

    // Build metadata
    const metadata = {
      startTime: new Date(legacySession.startTime).getTime(),
      lastUpdate: new Date(legacySession.lastActivity).getTime(),
      totalMessages: messages.length,
      totalTokens: legacySession.metadata.tokenCount || 0,
      compressionCount: legacySession.metadata.compressionCount || 0,
    };

    return {
      sessionId: legacySession.sessionId,
      messages,
      checkpointRecords,
      metadata,
    };
  }

  /**
   * Convert legacy snapshot to new snapshot format
   */
  static migrateSnapshot(legacySnapshot: LegacySnapshot): NewSnapshotData {
    return {
      id: legacySnapshot.id,
      sessionId: legacySnapshot.sessionId,
      timestamp: legacySnapshot.timestamp,
      conversationState: {
        messages: legacySnapshot.messages,
        checkpoints: [], // Legacy snapshots didn't have checkpoints
        goals: undefined,
        metadata: {
          ...legacySnapshot.metadata,
          migratedFrom: 'legacy',
          migrationTimestamp: Date.now(),
        },
      },
      purpose: 'recovery', // Default purpose for migrated snapshots
    };
  }

  /**
   * Convert new session history back to legacy format (for rollback)
   */
  static toLegacySession(
    newHistory: NewSessionHistory,
    model: string,
    provider: string
  ): Session {
    // Convert messages back to session message format
    const messages: SessionMessage[] = newHistory.messages.map(msg => ({
      role: msg.role,
      parts: [{ type: 'text' as const, text: msg.content }],
      timestamp: new Date(msg.timestamp).toISOString(),
    }));

    // Build metadata
    const metadata: SessionMetadata = {
      tokenCount: newHistory.metadata.totalTokens,
      compressionCount: newHistory.metadata.compressionCount,
    };

    return {
      sessionId: newHistory.sessionId,
      startTime: new Date(newHistory.metadata.startTime).toISOString(),
      lastActivity: new Date(newHistory.metadata.lastUpdate).toISOString(),
      model,
      provider,
      messages,
      toolCalls: [], // Tool calls not tracked in new format
      metadata,
    };
  }

  /**
   * Convert new snapshot back to legacy format (for rollback)
   */
  static toLegacySnapshot(newSnapshot: NewSnapshotData): LegacySnapshot {
    return {
      id: newSnapshot.id,
      sessionId: newSnapshot.sessionId,
      timestamp: newSnapshot.timestamp,
      messages: newSnapshot.conversationState.messages,
      metadata: {
        ...newSnapshot.conversationState.metadata,
        compressionCount: 0, // Not tracked in new format
        tokenCount: 0, // Would need to recalculate
      },
    };
  }

  /**
   * Check if a session needs migration
   */
  static needsMigration(session: Session): boolean {
    // Check if session has new format indicators
    // Legacy sessions won't have checkpoint records
    return true; // All legacy sessions need migration
  }

  /**
   * Check if a snapshot needs migration
   */
  static snapshotNeedsMigration(snapshot: LegacySnapshot): boolean {
    // Check if snapshot has new format indicators
    return !('conversationState' in snapshot);
  }

  /**
   * Validate migrated session
   */
  static validateMigratedSession(history: NewSessionHistory): boolean {
    return (
      history.sessionId !== undefined &&
      Array.isArray(history.messages) &&
      Array.isArray(history.checkpointRecords) &&
      history.metadata !== undefined &&
      typeof history.metadata.startTime === 'number' &&
      typeof history.metadata.totalMessages === 'number'
    );
  }

  /**
   * Validate migrated snapshot
   */
  static validateMigratedSnapshot(snapshot: NewSnapshotData): boolean {
    return (
      snapshot.id !== undefined &&
      snapshot.sessionId !== undefined &&
      snapshot.conversationState !== undefined &&
      Array.isArray(snapshot.conversationState.messages) &&
      Array.isArray(snapshot.conversationState.checkpoints) &&
      ['recovery', 'rollback', 'emergency'].includes(snapshot.purpose)
    );
  }

  /**
   * Get migration statistics
   */
  static getMigrationStats(
    legacySession: Session,
    newHistory: NewSessionHistory
  ): {
    messageCount: number;
    tokenCount: number;
    compressionCount: number;
    timeDiff: number;
  } {
    return {
      messageCount: newHistory.messages.length,
      tokenCount: newHistory.metadata.totalTokens,
      compressionCount: newHistory.metadata.compressionCount,
      timeDiff:
        newHistory.metadata.lastUpdate - newHistory.metadata.startTime,
    };
  }
}
