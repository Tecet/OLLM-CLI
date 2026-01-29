/**
 * Goal Progress Tracker
 *
 * Tracks goal progress through compression by:
 * - Parsing goal markers from summaries
 * - Updating goal state based on markers
 * - Recording progress in goal manager
 *
 * Requirements: FR-10
 */

import { GoalMarkerParser, type ParsedGoalUpdate } from './goalMarkerParser.js';

import type { Goal, GoalManager, ArtifactType } from '../goalTypes.js';

/**
 * Progress tracking result
 */
export interface ProgressTrackingResult {
  /** Whether tracking succeeded */
  success: boolean;

  /** Number of updates applied */
  updatesApplied: number;

  /** Updates that were parsed */
  updates: ParsedGoalUpdate[];

  /** Error message if failed */
  error?: string;
}

/**
 * Goal Progress Tracker Configuration
 */
export interface GoalProgressTrackerConfig {
  /** Goal manager for updating goals */
  goalManager: GoalManager;

  /** Goal marker parser (optional, will create default) */
  parser?: GoalMarkerParser;
}

/**
 * Goal Progress Tracker
 *
 * Tracks goal progress by parsing markers from LLM summaries
 * and updating the goal manager accordingly.
 *
 * @example
 * ```typescript
 * const tracker = new GoalProgressTracker({ goalManager });
 *
 * // After compression
 * const summary = compressionResult.checkpoint.summary;
 * const goal = goalManager.getActiveGoal();
 *
 * if (goal) {
 *   const result = tracker.trackProgress(summary, goal);
 *   console.log(`Applied ${result.updatesApplied} updates`);
 * }
 * ```
 */
export class GoalProgressTracker {
  private goalManager: GoalManager;
  private parser: GoalMarkerParser;

  constructor(config: GoalProgressTrackerConfig) {
    this.goalManager = config.goalManager;
    this.parser = config.parser ?? new GoalMarkerParser();
  }

  /**
   * Track goal progress from summary
   *
   * Parses goal markers from the summary and updates the goal accordingly.
   *
   * Requirements: FR-10
   *
   * @param summary - LLM-generated summary with goal markers
   * @param goal - Goal to update
   * @returns Progress tracking result
   *
   * @example
   * ```typescript
   * const result = tracker.trackProgress(summary, activeGoal);
   * if (result.success) {
   *   console.log(`Applied ${result.updatesApplied} updates to goal`);
   * } else {
   *   console.error(`Tracking failed: ${result.error}`);
   * }
   * ```
   */
  trackProgress(summary: string, goal: Goal): ProgressTrackingResult {
    try {
      // Parse goal markers from summary
      const updates = this.parser.parse(summary);

      if (updates.length === 0) {
        return {
          success: true,
          updatesApplied: 0,
          updates: [],
        };
      }

      // Apply updates to goal
      let updatesApplied = 0;

      for (const update of updates) {
        try {
          switch (update.type) {
            case 'checkpoint':
              this.applyCheckpointUpdate(goal, update);
              updatesApplied++;
              break;

            case 'decision':
              this.applyDecisionUpdate(goal, update);
              updatesApplied++;
              break;

            case 'artifact':
              this.applyArtifactUpdate(goal, update);
              updatesApplied++;
              break;
          }
        } catch (error) {
          // Log error but continue with other updates
          console.warn(
            `[GoalProgressTracker] Failed to apply update:`,
            update,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      return {
        success: true,
        updatesApplied,
        updates,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[GoalProgressTracker] Progress tracking failed:', errorMessage);

      return {
        success: false,
        updatesApplied: 0,
        updates: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Apply checkpoint update to goal
   *
   * Updates subtask status based on checkpoint marker.
   * If subtask doesn't exist, it's created.
   *
   * @param goal - Goal to update
   * @param update - Checkpoint update to apply
   */
  private applyCheckpointUpdate(
    goal: Goal,
    update: ParsedGoalUpdate & { type: 'checkpoint' }
  ): void {
    // Find matching subtask by description
    const subtask = goal.subtasks.find(
      (s) => s.description.toLowerCase() === update.description.toLowerCase()
    );

    if (subtask) {
      // Update existing subtask status
      this.goalManager.updateSubtaskStatus(goal.id, subtask.id, update.status);

      // If completed, mark completion time
      if (update.status === 'completed') {
        this.goalManager.completeSubtask(goal.id, subtask.id);
      }
    } else {
      // Create new subtask with the status
      const newSubtask = this.goalManager.addSubtask(goal.id, update.description);

      // Update status if not pending
      if (update.status !== 'pending') {
        this.goalManager.updateSubtaskStatus(goal.id, newSubtask.id, update.status);
      }

      // If completed, mark completion time
      if (update.status === 'completed') {
        this.goalManager.completeSubtask(goal.id, newSubtask.id);
      }
    }
  }

  /**
   * Apply decision update to goal
   *
   * Records decision in goal. If decision already exists, updates locked status.
   *
   * @param goal - Goal to update
   * @param update - Decision update to apply
   */
  private applyDecisionUpdate(
    goal: Goal,
    update: ParsedGoalUpdate & { type: 'decision' }
  ): void {
    // Check if decision already exists
    const existingDecision = goal.decisions.find(
      (d) => d.description.toLowerCase() === update.description.toLowerCase()
    );

    if (existingDecision) {
      // Update locked status if needed
      if (update.locked && !existingDecision.locked) {
        this.goalManager.lockDecision(goal.id, existingDecision.id);
      }
    } else {
      // Record new decision
      const decision = this.goalManager.recordDecision(
        goal.id,
        update.description,
        'Extracted from compression summary', // Rationale
        [] // No alternatives from marker
      );

      // Lock if specified
      if (update.locked) {
        this.goalManager.lockDecision(goal.id, decision.id);
      }
    }
  }

  /**
   * Apply artifact update to goal
   *
   * Records artifact in goal.
   *
   * @param goal - Goal to update
   * @param update - Artifact update to apply
   */
  private applyArtifactUpdate(
    goal: Goal,
    update: ParsedGoalUpdate & { type: 'artifact' }
  ): void {
    // Infer artifact type from file extension
    const type = this.inferArtifactType(update.path);

    // Record artifact
    this.goalManager.recordArtifact(
      goal.id,
      type,
      update.path,
      update.action,
      `Extracted from compression summary`
    );
  }

  /**
   * Infer artifact type from file path
   *
   * @param path - File path
   * @returns Inferred artifact type
   */
  private inferArtifactType(path: string): ArtifactType {
    const lowerPath = path.toLowerCase();

    // Test files
    if (lowerPath.includes('test') || lowerPath.includes('spec')) {
      return 'test';
    }

    // Documentation files
    if (
      lowerPath.endsWith('.md') ||
      lowerPath.endsWith('.txt') ||
      lowerPath.includes('doc') ||
      lowerPath.includes('readme')
    ) {
      return 'documentation';
    }

    // Configuration files
    if (
      lowerPath.endsWith('.json') ||
      lowerPath.endsWith('.yaml') ||
      lowerPath.endsWith('.yml') ||
      lowerPath.endsWith('.toml') ||
      lowerPath.endsWith('.ini') ||
      lowerPath.includes('config')
    ) {
      return 'configuration';
    }

    // Default to file
    return 'file';
  }

  /**
   * Check if summary contains goal markers
   *
   * @param summary - Summary to check
   * @returns True if summary contains goal markers
   *
   * @example
   * ```typescript
   * if (tracker.hasMarkers(summary)) {
   *   const result = tracker.trackProgress(summary, goal);
   * }
   * ```
   */
  hasMarkers(summary: string): boolean {
    return this.parser.hasMarkers(summary);
  }

  /**
   * Get marker statistics from summary
   *
   * @param summary - Summary to analyze
   * @returns Marker counts by type
   *
   * @example
   * ```typescript
   * const stats = tracker.getStats(summary);
   * console.log(`Found ${stats.total} goal markers`);
   * ```
   */
  getStats(summary: string): {
    checkpoints: number;
    decisions: number;
    artifacts: number;
    total: number;
  } {
    return this.parser.getStats(summary);
  }
}

