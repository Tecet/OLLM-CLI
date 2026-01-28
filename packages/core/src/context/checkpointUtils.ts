/**
 * Checkpoint Utilities
 * 
 * Utility functions for working with compression checkpoints.
 * These functions provide common operations for finding, sorting,
 * filtering, and validating checkpoints.
 */

import type { CompressionCheckpoint, Message } from './types.js';

/**
 * Find a checkpoint by its ID
 * 
 * @param checkpoints - Array of checkpoints to search
 * @param id - Checkpoint ID to find
 * @returns The checkpoint if found, undefined otherwise
 * 
 * @example
 * ```typescript
 * const checkpoint = findCheckpointById(checkpoints, 'checkpoint-123');
 * if (checkpoint) {
 *   console.log('Found:', checkpoint.summary.content);
 * }
 * ```
 */
export function findCheckpointById(
  checkpoints: CompressionCheckpoint[],
  id: string
): CompressionCheckpoint | undefined {
  return checkpoints.find(cp => cp.id === id);
}

/**
 * Find checkpoints created after a specific timestamp
 * 
 * @param checkpoints - Array of checkpoints to search
 * @param timestamp - Timestamp to compare against
 * @returns Array of checkpoints created after the timestamp
 * 
 * @example
 * ```typescript
 * const recent = findCheckpointsAfter(checkpoints, new Date('2026-01-01'));
 * console.log(`Found ${recent.length} recent checkpoints`);
 * ```
 */
export function findCheckpointsAfter(
  checkpoints: CompressionCheckpoint[],
  timestamp: Date
): CompressionCheckpoint[] {
  return checkpoints.filter(cp => cp.createdAt > timestamp);
}

/**
 * Find checkpoints created before a specific timestamp
 * 
 * @param checkpoints - Array of checkpoints to search
 * @param timestamp - Timestamp to compare against
 * @returns Array of checkpoints created before the timestamp
 * 
 * @example
 * ```typescript
 * const old = findCheckpointsBefore(checkpoints, new Date('2026-01-01'));
 * console.log(`Found ${old.length} old checkpoints`);
 * ```
 */
export function findCheckpointsBefore(
  checkpoints: CompressionCheckpoint[],
  timestamp: Date
): CompressionCheckpoint[] {
  return checkpoints.filter(cp => cp.createdAt < timestamp);
}

/**
 * Sort checkpoints by age (oldest first)
 * 
 * @param checkpoints - Array of checkpoints to sort
 * @returns New array sorted by creation date (oldest first)
 * 
 * @example
 * ```typescript
 * const sorted = sortCheckpointsByAge(checkpoints);
 * console.log('Oldest:', sorted[0].createdAt);
 * ```
 */
export function sortCheckpointsByAge(
  checkpoints: CompressionCheckpoint[]
): CompressionCheckpoint[] {
  return [...checkpoints].sort((a, b) => 
    a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/**
 * Sort checkpoints by age (newest first)
 * 
 * @param checkpoints - Array of checkpoints to sort
 * @returns New array sorted by creation date (newest first)
 * 
 * @example
 * ```typescript
 * const sorted = sortCheckpointsByAgeDesc(checkpoints);
 * console.log('Newest:', sorted[0].createdAt);
 * ```
 */
export function sortCheckpointsByAgeDesc(
  checkpoints: CompressionCheckpoint[]
): CompressionCheckpoint[] {
  return [...checkpoints].sort((a, b) => 
    b.createdAt.getTime() - a.createdAt.getTime()
  );
}

/**
 * Filter checkpoints by compression level
 * 
 * @param checkpoints - Array of checkpoints to filter
 * @param level - Compression level to filter by
 * @returns Array of checkpoints at the specified level
 * 
 * @example
 * ```typescript
 * const tier3 = filterCheckpointsByLevel(checkpoints, 3);
 * console.log(`Found ${tier3.length} tier 3 checkpoints`);
 * ```
 */
export function filterCheckpointsByLevel(
  checkpoints: CompressionCheckpoint[],
  level: number
): CompressionCheckpoint[] {
  return checkpoints.filter(cp => cp.level === level);
}

/**
 * Get the most recent N checkpoints
 * 
 * @param checkpoints - Array of checkpoints
 * @param count - Number of recent checkpoints to return
 * @returns Array of the N most recent checkpoints
 * 
 * @example
 * ```typescript
 * const recent = getRecentCheckpoints(checkpoints, 5);
 * console.log(`Got ${recent.length} recent checkpoints`);
 * ```
 */
export function getRecentCheckpoints(
  checkpoints: CompressionCheckpoint[],
  count: number
): CompressionCheckpoint[] {
  return sortCheckpointsByAgeDesc(checkpoints).slice(0, count);
}

/**
 * Get the oldest N checkpoints
 * 
 * @param checkpoints - Array of checkpoints
 * @param count - Number of old checkpoints to return
 * @returns Array of the N oldest checkpoints
 * 
 * @example
 * ```typescript
 * const old = getOldestCheckpoints(checkpoints, 5);
 * console.log(`Got ${old.length} old checkpoints`);
 * ```
 */
export function getOldestCheckpoints(
  checkpoints: CompressionCheckpoint[],
  count: number
): CompressionCheckpoint[] {
  return sortCheckpointsByAge(checkpoints).slice(0, count);
}

/**
 * Validate a checkpoint has all required fields
 * 
 * @param checkpoint - Checkpoint to validate
 * @returns true if valid, false otherwise
 * 
 * @example
 * ```typescript
 * if (validateCheckpoint(checkpoint)) {
 *   console.log('Checkpoint is valid');
 * }
 * ```
 */
export function validateCheckpoint(checkpoint: CompressionCheckpoint): boolean {
  return !!(
    checkpoint.id &&
    checkpoint.level >= 0 &&
    checkpoint.range &&
    checkpoint.summary &&
    checkpoint.createdAt &&
    checkpoint.originalTokens >= 0 &&
    checkpoint.currentTokens >= 0 &&
    checkpoint.compressionCount >= 0
  );
}

/**
 * Extract checkpoint summaries as messages
 * 
 * @param checkpoints - Array of checkpoints
 * @returns Array of summary messages
 * 
 * @example
 * ```typescript
 * const summaries = extractCheckpointSummaries(checkpoints);
 * context.messages = [...systemMessages, ...summaries, ...recentMessages];
 * ```
 */
export function extractCheckpointSummaries(
  checkpoints: CompressionCheckpoint[]
): Message[] {
  return checkpoints.map(cp => cp.summary);
}

/**
 * Calculate total tokens across all checkpoints
 * 
 * @param checkpoints - Array of checkpoints
 * @returns Total current tokens
 * 
 * @example
 * ```typescript
 * const total = calculateTotalCheckpointTokens(checkpoints);
 * console.log(`Checkpoints use ${total} tokens`);
 * ```
 */
export function calculateTotalCheckpointTokens(
  checkpoints: CompressionCheckpoint[]
): number {
  return checkpoints.reduce((sum, cp) => sum + cp.currentTokens, 0);
}

/**
 * Calculate total original tokens across all checkpoints
 * 
 * @param checkpoints - Array of checkpoints
 * @returns Total original tokens before compression
 * 
 * @example
 * ```typescript
 * const original = calculateTotalOriginalTokens(checkpoints);
 * const current = calculateTotalCheckpointTokens(checkpoints);
 * const ratio = current / original;
 * console.log(`Compression ratio: ${ratio.toFixed(2)}`);
 * ```
 */
export function calculateTotalOriginalTokens(
  checkpoints: CompressionCheckpoint[]
): number {
  return checkpoints.reduce((sum, cp) => sum + cp.originalTokens, 0);
}

/**
 * Split checkpoints into old and recent based on count
 * 
 * @param checkpoints - Array of checkpoints
 * @param keepRecent - Number of recent checkpoints to keep
 * @returns Object with old and recent checkpoint arrays
 * 
 * @example
 * ```typescript
 * const { old, recent } = splitCheckpointsByAge(checkpoints, 4);
 * // Merge old checkpoints, keep recent ones
 * const merged = mergeCheckpoints(old);
 * context.checkpoints = [merged, ...recent];
 * ```
 */
export function splitCheckpointsByAge(
  checkpoints: CompressionCheckpoint[],
  keepRecent: number
): { old: CompressionCheckpoint[]; recent: CompressionCheckpoint[] } {
  const sorted = sortCheckpointsByAge(checkpoints);
  const splitIndex = Math.max(0, sorted.length - keepRecent);
  
  return {
    old: sorted.slice(0, splitIndex),
    recent: sorted.slice(splitIndex)
  };
}

/**
 * Check if checkpoints exceed a maximum count
 * 
 * @param checkpoints - Array of checkpoints
 * @param maxCount - Maximum allowed count
 * @returns true if count exceeds maximum
 * 
 * @example
 * ```typescript
 * if (exceedsMaxCheckpoints(checkpoints, 10)) {
 *   // Merge or remove old checkpoints
 * }
 * ```
 */
export function exceedsMaxCheckpoints(
  checkpoints: CompressionCheckpoint[],
  maxCount: number
): boolean {
  return checkpoints.length > maxCount;
}

/**
 * Get checkpoints that need merging based on max count
 * 
 * @param checkpoints - Array of checkpoints
 * @param maxCount - Maximum allowed count
 * @returns Object with checkpoints to merge and keep
 * 
 * @example
 * ```typescript
 * const { toMerge, toKeep } = getCheckpointsForMerging(checkpoints, 10);
 * if (toMerge.length > 0) {
 *   const merged = mergeCheckpoints(toMerge);
 *   context.checkpoints = [merged, ...toKeep];
 * }
 * ```
 */
export function getCheckpointsForMerging(
  checkpoints: CompressionCheckpoint[],
  maxCount: number
): { toMerge: CompressionCheckpoint[]; toKeep: CompressionCheckpoint[] } {
  if (checkpoints.length <= maxCount) {
    return { toMerge: [], toKeep: checkpoints };
  }

  const excess = checkpoints.length - maxCount;
  const sorted = sortCheckpointsByAge(checkpoints);
  
  return {
    toMerge: sorted.slice(0, excess + 1),
    toKeep: sorted.slice(excess + 1)
  };
}
