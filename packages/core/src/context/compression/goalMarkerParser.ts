/**
 * Goal Marker Parser
 *
 * Parses goal markers from LLM-generated summaries to track goal progress.
 * Supports markers for:
 * - Checkpoints: [CHECKPOINT] description - STATUS
 * - Decisions: [DECISION] description - LOCKED?
 * - Artifacts: [ARTIFACT] action path
 *
 * Requirements: FR-10
 */

import type { SubtaskStatus, ArtifactAction } from '../goalTypes.js';

/**
 * Parsed goal update from summary
 */
export interface GoalUpdate {
  /** Type of update */
  type: 'checkpoint' | 'decision' | 'artifact';
}

/**
 * Checkpoint update
 */
export interface CheckpointUpdate extends GoalUpdate {
  type: 'checkpoint';
  /** Checkpoint description */
  description: string;
  /** Checkpoint status */
  status: SubtaskStatus;
}

/**
 * Decision update
 */
export interface DecisionUpdate extends GoalUpdate {
  type: 'decision';
  /** Decision description */
  description: string;
  /** Whether decision is locked */
  locked: boolean;
}

/**
 * Artifact update
 */
export interface ArtifactUpdate extends GoalUpdate {
  type: 'artifact';
  /** Action performed */
  action: ArtifactAction;
  /** File path */
  path: string;
}

/**
 * Union type for all goal updates
 */
export type ParsedGoalUpdate = CheckpointUpdate | DecisionUpdate | ArtifactUpdate;

/**
 * Goal Marker Parser
 *
 * Parses structured markers from LLM summaries to track goal progress.
 *
 * @example
 * ```typescript
 * const parser = new GoalMarkerParser();
 * const summary = `
 *   Summary of work completed.
 *   [CHECKPOINT] Implement authentication - COMPLETED
 *   [DECISION] Use JWT tokens - LOCKED
 *   [ARTIFACT] Created src/auth/login.ts
 * `;
 * const updates = parser.parse(summary);
 * // updates = [
 * //   { type: 'checkpoint', description: 'Implement authentication', status: 'completed' },
 * //   { type: 'decision', description: 'Use JWT tokens', locked: true },
 * //   { type: 'artifact', action: 'created', path: 'src/auth/login.ts' }
 * // ]
 * ```
 */
export class GoalMarkerParser {
  /**
   * Parse goal markers from summary text
   *
   * @param summary - LLM-generated summary text
   * @returns Array of parsed goal updates
   *
   * @example
   * ```typescript
   * const parser = new GoalMarkerParser();
   * const updates = parser.parse(summary);
   * for (const update of updates) {
   *   if (update.type === 'checkpoint') {
   *     console.log(`Checkpoint: ${update.description} - ${update.status}`);
   *   }
   * }
   * ```
   */
  parse(summary: string): ParsedGoalUpdate[] {
    const updates: ParsedGoalUpdate[] = [];

    // Split into lines for parsing
    const lines = summary.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Parse checkpoint markers
      if (trimmed.startsWith('[CHECKPOINT]')) {
        const checkpoint = this.parseCheckpoint(trimmed);
        if (checkpoint) {
          updates.push(checkpoint);
        }
      }

      // Parse decision markers
      else if (trimmed.startsWith('[DECISION]')) {
        const decision = this.parseDecision(trimmed);
        if (decision) {
          updates.push(decision);
        }
      }

      // Parse artifact markers
      else if (trimmed.startsWith('[ARTIFACT]')) {
        const artifact = this.parseArtifact(trimmed);
        if (artifact) {
          updates.push(artifact);
        }
      }
    }

    return updates;
  }

  /**
   * Parse checkpoint marker
   *
   * Format: [CHECKPOINT] description - STATUS
   * Status: COMPLETED | IN-PROGRESS | PENDING | BLOCKED
   *
   * @param line - Line containing checkpoint marker
   * @returns Parsed checkpoint update or null if invalid
   */
  private parseCheckpoint(line: string): CheckpointUpdate | null {
    // Match: [CHECKPOINT] description - STATUS
    const match = line.match(
      /\[CHECKPOINT\]\s+(.+?)\s+-\s+(COMPLETED|IN-PROGRESS|PENDING|BLOCKED)/i
    );

    if (!match) {
      return null;
    }

    const description = match[1].trim();
    const statusStr = match[2].toUpperCase();

    // Map status string to SubtaskStatus
    let status: SubtaskStatus;
    switch (statusStr) {
      case 'COMPLETED':
        status = 'completed';
        break;
      case 'IN-PROGRESS':
        status = 'in-progress';
        break;
      case 'PENDING':
        status = 'pending';
        break;
      case 'BLOCKED':
        status = 'blocked';
        break;
      default:
        return null;
    }

    return {
      type: 'checkpoint',
      description,
      status,
    };
  }

  /**
   * Parse decision marker
   *
   * Format: [DECISION] description - LOCKED?
   *
   * @param line - Line containing decision marker
   * @returns Parsed decision update or null if invalid
   */
  private parseDecision(line: string): DecisionUpdate | null {
    // Match: [DECISION] description - LOCKED (optional)
    const match = line.match(/\[DECISION\]\s+(.+?)(?:\s+-\s+(LOCKED))?$/i);

    if (!match) {
      return null;
    }

    const description = match[1].trim();
    const locked = !!match[2];

    return {
      type: 'decision',
      description,
      locked,
    };
  }

  /**
   * Parse artifact marker
   *
   * Format: [ARTIFACT] action path
   * Action: Created | Modified | Deleted
   *
   * @param line - Line containing artifact marker
   * @returns Parsed artifact update or null if invalid
   */
  private parseArtifact(line: string): ArtifactUpdate | null {
    // Match: [ARTIFACT] action path
    const match = line.match(/\[ARTIFACT\]\s+(Created|Modified|Deleted)\s+(.+)$/i);

    if (!match) {
      return null;
    }

    const actionStr = match[1].toLowerCase();
    const path = match[2].trim();

    // Map action string to ArtifactAction
    let action: ArtifactAction;
    switch (actionStr) {
      case 'created':
        action = 'created';
        break;
      case 'modified':
        action = 'modified';
        break;
      case 'deleted':
        action = 'deleted';
        break;
      default:
        return null;
    }

    return {
      type: 'artifact',
      action,
      path,
    };
  }

  /**
   * Check if summary contains any goal markers
   *
   * @param summary - Summary text to check
   * @returns True if summary contains goal markers
   *
   * @example
   * ```typescript
   * const parser = new GoalMarkerParser();
   * if (parser.hasMarkers(summary)) {
   *   const updates = parser.parse(summary);
   *   // Process updates...
   * }
   * ```
   */
  hasMarkers(summary: string): boolean {
    return (
      summary.includes('[CHECKPOINT]') ||
      summary.includes('[DECISION]') ||
      summary.includes('[ARTIFACT]')
    );
  }

  /**
   * Get marker statistics from summary
   *
   * @param summary - Summary text to analyze
   * @returns Marker counts by type
   *
   * @example
   * ```typescript
   * const parser = new GoalMarkerParser();
   * const stats = parser.getStats(summary);
   * console.log(`Found ${stats.checkpoints} checkpoints, ${stats.decisions} decisions`);
   * ```
   */
  getStats(summary: string): {
    checkpoints: number;
    decisions: number;
    artifacts: number;
    total: number;
  } {
    const updates = this.parse(summary);

    const checkpoints = updates.filter((u) => u.type === 'checkpoint').length;
    const decisions = updates.filter((u) => u.type === 'decision').length;
    const artifacts = updates.filter((u) => u.type === 'artifact').length;

    return {
      checkpoints,
      decisions,
      artifacts,
      total: updates.length,
    };
  }
}
