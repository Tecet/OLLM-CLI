/**
 * Snapshot Utilities
 *
 * Utility functions for working with context snapshots.
 * These functions provide common operations for finding, sorting,
 * filtering, and validating snapshots.
 */

import type { SnapshotMetadata, ContextSnapshot, Message } from './types.js';

/**
 * Find a snapshot by its ID
 *
 * @param snapshots - Array of snapshot metadata to search
 * @param id - Snapshot ID to find
 * @returns The snapshot metadata if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const snapshot = findSnapshotById(snapshots, 'snapshot-123');
 * if (snapshot) {
 *   console.log('Found:', snapshot.summary);
 * }
 * ```
 */
export function findSnapshotById(
  snapshots: SnapshotMetadata[],
  id: string
): SnapshotMetadata | undefined {
  return snapshots.find((s) => s.id === id);
}

/**
 * Find snapshots for a specific session
 *
 * @param snapshots - Array of snapshot metadata to search
 * @param sessionId - Session ID to filter by
 * @returns Array of snapshots for the session
 *
 * @example
 * ```typescript
 * const sessionSnapshots = findSnapshotsBySession(snapshots, 'session-123');
 * console.log(`Found ${sessionSnapshots.length} snapshots for session`);
 * ```
 */
export function findSnapshotsBySession(
  snapshots: SnapshotMetadata[],
  sessionId: string
): SnapshotMetadata[] {
  return snapshots.filter((s) => s.sessionId === sessionId);
}

/**
 * Find snapshots created after a specific timestamp
 *
 * @param snapshots - Array of snapshot metadata to search
 * @param timestamp - Timestamp to compare against
 * @returns Array of snapshots created after the timestamp
 *
 * @example
 * ```typescript
 * const recent = findSnapshotsAfter(snapshots, new Date('2026-01-01'));
 * console.log(`Found ${recent.length} recent snapshots`);
 * ```
 */
export function findSnapshotsAfter(
  snapshots: SnapshotMetadata[],
  timestamp: Date
): SnapshotMetadata[] {
  return snapshots.filter((s) => s.timestamp > timestamp);
}

/**
 * Find snapshots created before a specific timestamp
 *
 * @param snapshots - Array of snapshot metadata to search
 * @param timestamp - Timestamp to compare against
 * @returns Array of snapshots created before the timestamp
 *
 * @example
 * ```typescript
 * const old = findSnapshotsBefore(snapshots, new Date('2026-01-01'));
 * console.log(`Found ${old.length} old snapshots`);
 * ```
 */
export function findSnapshotsBefore(
  snapshots: SnapshotMetadata[],
  timestamp: Date
): SnapshotMetadata[] {
  return snapshots.filter((s) => s.timestamp < timestamp);
}

/**
 * Sort snapshots by age (oldest first)
 *
 * @param snapshots - Array of snapshot metadata to sort
 * @returns New array sorted by timestamp (oldest first)
 *
 * @example
 * ```typescript
 * const sorted = sortSnapshotsByAge(snapshots);
 * console.log('Oldest:', sorted[0].timestamp);
 * ```
 */
export function sortSnapshotsByAge(snapshots: SnapshotMetadata[]): SnapshotMetadata[] {
  return [...snapshots].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Sort snapshots by age (newest first)
 *
 * @param snapshots - Array of snapshot metadata to sort
 * @returns New array sorted by timestamp (newest first)
 *
 * @example
 * ```typescript
 * const sorted = sortSnapshotsByAgeDesc(snapshots);
 * console.log('Newest:', sorted[0].timestamp);
 * ```
 */
export function sortSnapshotsByAgeDesc(snapshots: SnapshotMetadata[]): SnapshotMetadata[] {
  return [...snapshots].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Get the most recent N snapshots
 *
 * @param snapshots - Array of snapshot metadata
 * @param count - Number of recent snapshots to return
 * @returns Array of the N most recent snapshots
 *
 * @example
 * ```typescript
 * const recent = getRecentSnapshots(snapshots, 5);
 * console.log(`Got ${recent.length} recent snapshots`);
 * ```
 */
export function getRecentSnapshots(
  snapshots: SnapshotMetadata[],
  count: number
): SnapshotMetadata[] {
  return sortSnapshotsByAgeDesc(snapshots).slice(0, count);
}

/**
 * Get the oldest N snapshots
 *
 * @param snapshots - Array of snapshot metadata
 * @param count - Number of old snapshots to return
 * @returns Array of the N oldest snapshots
 *
 * @example
 * ```typescript
 * const old = getOldestSnapshots(snapshots, 5);
 * console.log(`Got ${old.length} old snapshots`);
 * ```
 */
export function getOldestSnapshots(
  snapshots: SnapshotMetadata[],
  count: number
): SnapshotMetadata[] {
  return sortSnapshotsByAge(snapshots).slice(0, count);
}

/**
 * Validate snapshot metadata has all required fields
 *
 * @param snapshot - Snapshot metadata to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * if (validateSnapshotMetadata(snapshot)) {
 *   console.log('Snapshot metadata is valid');
 * }
 * ```
 */
export function validateSnapshotMetadata(snapshot: SnapshotMetadata): boolean {
  return !!(
    snapshot.id &&
    snapshot.sessionId &&
    snapshot.timestamp &&
    snapshot.tokenCount >= 0 &&
    snapshot.size >= 0
  );
}

/**
 * Validate a full context snapshot has all required fields
 *
 * @param snapshot - Context snapshot to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * if (validateContextSnapshot(snapshot)) {
 *   console.log('Context snapshot is valid');
 * }
 * ```
 */
export function validateContextSnapshot(snapshot: ContextSnapshot): boolean {
  return !!(
    snapshot.id &&
    snapshot.sessionId &&
    snapshot.timestamp &&
    snapshot.tokenCount >= 0 &&
    Array.isArray(snapshot.userMessages) &&
    Array.isArray(snapshot.messages) &&
    snapshot.metadata
  );
}

/**
 * Calculate total size of snapshots
 *
 * @param snapshots - Array of snapshot metadata
 * @returns Total token count across all snapshots
 *
 * @example
 * ```typescript
 * const total = calculateTotalSnapshotSize(snapshots);
 * console.log(`Snapshots use ${total} tokens`);
 * ```
 */
export function calculateTotalSnapshotSize(snapshots: SnapshotMetadata[]): number {
  return snapshots.reduce((sum, s) => sum + s.tokenCount, 0);
}

/**
 * Calculate total file size across snapshots
 *
 * @param snapshots - Array of snapshot metadata
 * @returns Total size in bytes
 *
 * @example
 * ```typescript
 * const total = calculateTotalSnapshotFileSize(snapshots);
 * console.log(`Snapshots use ${total} bytes`);
 * ```
 */
export function calculateTotalSnapshotFileSize(snapshots: SnapshotMetadata[]): number {
  return snapshots.reduce((sum, s) => sum + s.size, 0);
}

/**
 * Group snapshots by session ID
 *
 * @param snapshots - Array of snapshot metadata
 * @returns Map of session ID to snapshots
 *
 * @example
 * ```typescript
 * const grouped = groupSnapshotsBySession(snapshots);
 * for (const [sessionId, sessionSnapshots] of grouped) {
 *   console.log(`Session ${sessionId}: ${sessionSnapshots.length} snapshots`);
 * }
 * ```
 */
export function groupSnapshotsBySession(
  snapshots: SnapshotMetadata[]
): Map<string, SnapshotMetadata[]> {
  const grouped = new Map<string, SnapshotMetadata[]>();

  for (const snapshot of snapshots) {
    const existing = grouped.get(snapshot.sessionId) || [];
    existing.push(snapshot);
    grouped.set(snapshot.sessionId, existing);
  }

  return grouped;
}

/**
 * Filter snapshots that exceed a token threshold
 *
 * @param snapshots - Array of snapshot metadata
 * @param threshold - Token count threshold
 * @returns Array of snapshots exceeding the threshold
 *
 * @example
 * ```typescript
 * const large = filterSnapshotsAboveThreshold(snapshots, 10000);
 * console.log(`Found ${large.length} large snapshots`);
 * ```
 */
export function filterSnapshotsAboveThreshold(
  snapshots: SnapshotMetadata[],
  threshold: number
): SnapshotMetadata[] {
  return snapshots.filter((s) => s.tokenCount > threshold);
}

/**
 * Filter snapshots that are below a token threshold
 *
 * @param snapshots - Array of snapshot metadata
 * @param threshold - Token count threshold
 * @returns Array of snapshots below the threshold
 *
 * @example
 * ```typescript
 * const small = filterSnapshotsBelowThreshold(snapshots, 1000);
 * console.log(`Found ${small.length} small snapshots`);
 * ```
 */
export function filterSnapshotsBelowThreshold(
  snapshots: SnapshotMetadata[],
  threshold: number
): SnapshotMetadata[] {
  return snapshots.filter((s) => s.tokenCount < threshold);
}

/**
 * Get snapshots to delete based on max count
 *
 * @param snapshots - Array of snapshot metadata
 * @param maxCount - Maximum number of snapshots to keep
 * @returns Object with snapshots to keep and delete
 *
 * @example
 * ```typescript
 * const { toKeep, toDelete } = getSnapshotsForCleanup(snapshots, 100);
 * for (const snapshot of toDelete) {
 *   await storage.delete(snapshot.id);
 * }
 * ```
 */
export function getSnapshotsForCleanup(
  snapshots: SnapshotMetadata[],
  maxCount: number
): { toKeep: SnapshotMetadata[]; toDelete: SnapshotMetadata[] } {
  if (snapshots.length <= maxCount) {
    return { toKeep: snapshots, toDelete: [] };
  }

  const sorted = sortSnapshotsByAgeDesc(snapshots);

  return {
    toKeep: sorted.slice(0, maxCount),
    toDelete: sorted.slice(maxCount),
  };
}

/**
 * Extract user messages from a context snapshot
 *
 * @param snapshot - Context snapshot
 * @returns Array of user messages
 *
 * @example
 * ```typescript
 * const userMessages = extractUserMessages(snapshot);
 * console.log(`Found ${userMessages.length} user messages`);
 * ```
 */
export function extractUserMessages(snapshot: ContextSnapshot): Message[] {
  // Prefer userMessages field if available (new format)
  if (snapshot.userMessages && snapshot.userMessages.length > 0) {
    return snapshot.userMessages;
  }

  // Fall back to filtering messages (old format)
  return snapshot.messages.filter((m) => m.role === 'user');
}

/**
 * Extract non-user messages from a context snapshot
 *
 * @param snapshot - Context snapshot
 * @returns Array of non-user messages (system, assistant, tool)
 *
 * @example
 * ```typescript
 * const otherMessages = extractNonUserMessages(snapshot);
 * console.log(`Found ${otherMessages.length} non-user messages`);
 * ```
 */
export function extractNonUserMessages(snapshot: ContextSnapshot): Message[] {
  return snapshot.messages.filter((m) => m.role !== 'user');
}

/**
 * Check if snapshots exceed maximum count
 *
 * @param snapshots - Array of snapshot metadata
 * @param maxCount - Maximum allowed count
 * @returns true if count exceeds maximum
 *
 * @example
 * ```typescript
 * if (exceedsMaxSnapshots(snapshots, 100)) {
 *   // Cleanup old snapshots
 * }
 * ```
 */
export function exceedsMaxSnapshots(snapshots: SnapshotMetadata[], maxCount: number): boolean {
  return snapshots.length > maxCount;
}
