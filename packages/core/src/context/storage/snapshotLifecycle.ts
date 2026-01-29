/**
 * Snapshot Lifecycle Manager
 *
 * Manages the lifecycle of context snapshots for recovery and rollback.
 * Snapshots are NEVER sent to the LLM - they are only used for recovery.
 *
 * **Key Responsibilities:**
 * - Create snapshots from current conversation state
 * - Restore conversation state from snapshots
 * - List available snapshots
 * - Clean up old snapshots
 *
 * **Storage Layer:** Snapshots (on disk, never sent to LLM)
 *
 * @module snapshotLifecycle
 */

import { createSnapshotStorage } from '../snapshotStorage.js';

import type { CheckpointSummary, SnapshotData } from '../types/storageTypes.js';
import type { Message , SnapshotStorage } from '../types.js';


/**
 * Generate a unique ID for snapshots
 */
function generateId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Snapshot Lifecycle Manager
 *
 * Manages recovery snapshots for the context compression system.
 * Snapshots capture the complete conversation state at a point in time.
 *
 * @example
 * ```typescript
 * const lifecycle = new SnapshotLifecycle('session_123', '/path/to/snapshots');
 *
 * // Create snapshot before risky operation
 * const snapshot = await lifecycle.createSnapshot(
 *   messages,
 *   checkpoints,
 *   'emergency'
 * );
 *
 * // Restore if something goes wrong
 * const state = await lifecycle.restoreSnapshot(snapshot.id);
 *
 * // Clean up old snapshots
 * await lifecycle.cleanup(5); // Keep last 5
 * ```
 */
export class SnapshotLifecycle {
  private storage: SnapshotStorage;
  private sessionId: string;

  /**
   * Create a new snapshot lifecycle manager
   *
   * @param sessionId - Session identifier
   * @param storagePath - Path to snapshot storage directory (optional)
   */
  constructor(sessionId: string, storagePath?: string) {
    this.sessionId = sessionId;
    this.storage = createSnapshotStorage(storagePath);
  }

  /**
   * Create snapshot from current conversation state
   *
   * Captures the complete conversation state at this point in time.
   * The snapshot is NEVER included in active context or sent to the LLM.
   *
   * **Purpose Types:**
   * - `recovery`: Automatic snapshot for error recovery
   * - `rollback`: Manual snapshot for user-initiated rollback
   * - `emergency`: Emergency snapshot before critical operations
   *
   * @param messages - All messages at the time of snapshot (full, uncompressed)
   * @param checkpoints - All checkpoints at the time of snapshot
   * @param purpose - Purpose of this snapshot
   * @param goals - Active goals at the time of snapshot (optional)
   * @returns Created snapshot data
   *
   * @example
   * ```typescript
   * // Create emergency snapshot before compression
   * const snapshot = await lifecycle.createSnapshot(
   *   allMessages,
   *   allCheckpoints,
   *   'emergency'
   * );
   * console.log(`Created snapshot ${snapshot.id}`);
   * ```
   */
  async createSnapshot(
    messages: Message[],
    checkpoints: CheckpointSummary[],
    purpose: 'recovery' | 'rollback' | 'emergency',
    goals?: unknown[]
  ): Promise<SnapshotData> {
    // Create snapshot data structure
    const snapshot: SnapshotData = {
      id: generateId(),
      sessionId: this.sessionId,
      timestamp: Date.now(),
      conversationState: {
        messages: [...messages], // Full copy to prevent mutations
        checkpoints: [...checkpoints], // Full copy to prevent mutations
        goals: goals as any, // Type assertion for flexibility
        metadata: {
          purpose,
          createdBy: 'SnapshotLifecycle',
          messageCount: messages.length,
          checkpointCount: checkpoints.length,
        },
      },
      purpose,
    };

    // Convert to ContextSnapshot format for storage
    const contextSnapshot = this.toContextSnapshot(snapshot);

    // Save to disk
    await this.storage.save(contextSnapshot);

    return snapshot;
  }

  /**
   * Restore snapshot to conversation state
   *
   * Loads a snapshot from disk and returns the conversation state.
   * This allows rolling back to a previous point in the conversation.
   *
   * @param snapshotId - Snapshot identifier
   * @returns Conversation state from the snapshot
   * @throws Error if snapshot not found or corrupted
   *
   * @example
   * ```typescript
   * // Restore from snapshot after error
   * try {
   *   const state = await lifecycle.restoreSnapshot('snap_abc123');
   *   console.log(`Restored ${state.messages.length} messages`);
   *   // Apply state to context manager
   * } catch (error) {
   *   console.error('Failed to restore snapshot:', error);
   * }
   * ```
   */
  async restoreSnapshot(snapshotId: string): Promise<{
    messages: Message[];
    checkpoints: CheckpointSummary[];
    goals?: unknown[];
  }> {
    // Load from disk
    const contextSnapshot = await this.storage.load(snapshotId);

    // Convert back to SnapshotData format
    const snapshot = this.fromContextSnapshot(contextSnapshot);

    // Validate snapshot
    if (!snapshot.conversationState) {
      throw new Error(`Invalid snapshot: missing conversation state`);
    }

    return {
      messages: snapshot.conversationState.messages,
      checkpoints: snapshot.conversationState.checkpoints,
      goals: snapshot.conversationState.goals,
    };
  }

  /**
   * List all snapshots for this session
   *
   * Returns metadata for all snapshots, sorted by timestamp (newest first).
   *
   * @returns Array of snapshot metadata
   *
   * @example
   * ```typescript
   * const snapshots = await lifecycle.listSnapshots();
   * console.log(`Found ${snapshots.length} snapshots`);
   * for (const snapshot of snapshots) {
   *   console.log(`- ${snapshot.id}: ${snapshot.purpose} at ${new Date(snapshot.timestamp)}`);
   * }
   * ```
   */
  async listSnapshots(): Promise<SnapshotData[]> {
    // Get metadata from storage
    const metadataList = await this.storage.list(this.sessionId);

    // Convert to SnapshotData format (without full conversation state)
    return metadataList.map((metadata) => ({
      id: metadata.id,
      sessionId: metadata.sessionId,
      timestamp: metadata.timestamp.getTime(),
      conversationState: {
        messages: [], // Not loaded for list operation
        checkpoints: [],
        metadata: {},
      },
      purpose: 'recovery' as const, // Default, actual purpose in metadata
    }));
  }

  /**
   * Delete old snapshots (keep last N)
   *
   * Cleans up old snapshots to save disk space.
   * Keeps the most recent N snapshots and deletes the rest.
   *
   * @param keepCount - Number of snapshots to keep (default: 5)
   *
   * @example
   * ```typescript
   * // Keep only the last 5 snapshots
   * await lifecycle.cleanup(5);
   * console.log('Old snapshots cleaned up');
   * ```
   */
  async cleanup(keepCount: number = 5): Promise<void> {
    // Get all snapshots for this session
    const metadataList = await this.storage.list(this.sessionId);

    // Sort by timestamp (newest first)
    const sorted = metadataList.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Identify snapshots to delete
    const toDelete = sorted.slice(keepCount);

    // Delete old snapshots
    for (const metadata of toDelete) {
      try {
        await this.storage.delete(metadata.id);
      } catch (error) {
        // Log error but continue cleanup
        console.warn(`Failed to delete snapshot ${metadata.id}:`, error);
      }
    }
  }

  /**
   * Convert SnapshotData to ContextSnapshot format for storage
   *
   * @param snapshot - Snapshot data
   * @returns Context snapshot for storage
   */
  private toContextSnapshot(snapshot: SnapshotData): any {
    return {
      id: snapshot.id,
      sessionId: snapshot.sessionId,
      timestamp: new Date(snapshot.timestamp),
      tokenCount: this.calculateTokenCount(snapshot.conversationState.messages),
      summary: `${snapshot.purpose} snapshot`,
      userMessages: snapshot.conversationState.messages.filter((m) => m.role === 'user'),
      archivedUserMessages: [],
      messages: snapshot.conversationState.messages,
      checkpoints: snapshot.conversationState.checkpoints, // Store checkpoints
      metadata: {
        model: 'unknown',
        contextSize: snapshot.conversationState.messages.length,
        compressionRatio: 1.0,
        totalUserMessages: snapshot.conversationState.messages.filter((m) => m.role === 'user')
          .length,
        totalCheckpoints: snapshot.conversationState.checkpoints.length,
        purpose: snapshot.purpose,
        ...snapshot.conversationState.metadata,
      },
    };
  }

  /**
   * Convert ContextSnapshot to SnapshotData format
   *
   * @param contextSnapshot - Context snapshot from storage
   * @returns Snapshot data
   */
  private fromContextSnapshot(contextSnapshot: any): SnapshotData {
    return {
      id: contextSnapshot.id,
      sessionId: contextSnapshot.sessionId,
      timestamp:
        contextSnapshot.timestamp instanceof Date
          ? contextSnapshot.timestamp.getTime()
          : new Date(contextSnapshot.timestamp).getTime(),
      conversationState: {
        messages: contextSnapshot.messages || [],
        checkpoints: contextSnapshot.checkpoints || [], // Restore checkpoints
        goals: undefined,
        metadata: contextSnapshot.metadata || {},
      },
      purpose: (contextSnapshot.metadata?.purpose as any) || 'recovery',
    };
  }

  /**
   * Calculate total token count for messages
   *
   * @param messages - Messages to count
   * @returns Total token count
   */
  private calculateTokenCount(messages: Message[]): number {
    // Simple estimation: ~4 characters per token
    return messages.reduce((sum, msg) => {
      return sum + Math.ceil(msg.content.length / 4);
    }, 0);
  }
}
