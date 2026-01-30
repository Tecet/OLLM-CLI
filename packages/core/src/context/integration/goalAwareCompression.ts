/**
 * Goal-Aware Compression Integration
 *
 * Integrates the context compression system with the goal management system
 * to ensure goals are NEVER compressed and guide summarization to preserve
 * goal-relevant information.
 *
 * Requirements: FR-15
 */

import type { Goal, GoalManager } from '../goalTypes.js';
import type { Message } from '../types.js';

/**
 * Goal update parsed from LLM summary
 */
export interface GoalUpdate {
  /** Type of update */
  type: 'checkpoint' | 'decision' | 'artifact';
  /** Checkpoint description (for checkpoint updates) */
  description?: string;
  /** Checkpoint status (for checkpoint updates) */
  status?: 'pending' | 'in-progress' | 'completed' | 'blocked';
  /** Decision description (for decision updates) */
  decisionDescription?: string;
  /** Decision rationale (for decision updates) */
  rationale?: string;
  /** Whether decision is locked (for decision updates) */
  locked?: boolean;
  /** Artifact action (for artifact updates) */
  action?: 'created' | 'modified' | 'deleted';
  /** Artifact path (for artifact updates) */
  path?: string;
}

/**
 * Goal-aware compression integration
 *
 * Ensures goals are NEVER compressed (always in system prompt) and provides
 * goal-aware summarization that preserves goal-relevant information.
 */
export class GoalAwareCompression {
  private goalManager: GoalManager;

  constructor(goalManager: GoalManager) {
    this.goalManager = goalManager;
  }

  /**
   * Get active goal for summarization context
   *
   * Returns the currently active goal to guide summarization, or null if
   * no goal is active.
   *
   * @returns Active goal or null
   *
   * @example
   * ```typescript
   * const goal = compression.getActiveGoal();
   * if (goal) {
   *   console.log(`Active goal: ${goal.description}`);
   * }
   * ```
   */
  getActiveGoal(): Goal | null {
    return this.goalManager.getActiveGoal();
  }

  /**
   * Build goal-aware summarization prompt
   *
   * Creates a summarization prompt that includes the active goal context
   * and instructs the LLM to preserve goal-relevant information.
   *
   * @param messages - Messages to summarize
   * @param goal - Active goal (if any)
   * @param basePrompt - Base summarization prompt
   * @returns Goal-aware summarization prompt
   *
   * @example
   * ```typescript
   * const prompt = compression.buildGoalAwarePrompt(
   *   messages,
   *   activeGoal,
   *   'Summarize the following conversation...'
   * );
   * ```
   */
  buildGoalAwarePrompt(messages: Message[], goal: Goal | null, basePrompt: string): string {
    if (!goal) {
      // No active goal - use base prompt
      return `${basePrompt}\n\n${this.formatMessages(messages)}`;
    }

    // Build goal context
    const goalContext = this.formatGoalContext(goal);

    // Build goal-aware prompt
    return `
${basePrompt}

ACTIVE GOAL CONTEXT:
${goalContext}

MESSAGES TO SUMMARIZE:
${this.formatMessages(messages)}

SUMMARIZATION INSTRUCTIONS:
When summarizing, focus on preserving information relevant to the active goal:
- Decisions made toward the goal
- Checkpoints completed or in progress
- Files created, modified, or deleted
- Blockers encountered and their resolutions
- Technical details needed to continue work
- Next steps planned

Use these markers in your summary to track goal progress:
- [CHECKPOINT] <description> - <status>
- [DECISION] <description> - <LOCKED|UNLOCKED>
- [ARTIFACT] <action> <path>

Provide a concise summary that maintains essential information for continuing work on the goal.
    `.trim();
  }

  /**
   * Parse goal markers from LLM summary
   *
   * Extracts structured goal updates from the LLM's summary using markers
   * like [CHECKPOINT], [DECISION], and [ARTIFACT].
   *
   * @param summary - LLM-generated summary
   * @returns Array of goal updates
   *
   * @example
   * ```typescript
   * const summary = `
   *   [CHECKPOINT] Implemented user authentication - COMPLETED
   *   [DECISION] Use JWT tokens - LOCKED
   *   [ARTIFACT] Created auth.ts
   * `;
   * const updates = compression.parseGoalMarkers(summary);
   * ```
   */
  parseGoalMarkers(summary: string): GoalUpdate[] {
    const updates: GoalUpdate[] = [];
    const lines = summary.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Parse checkpoint markers
      if (trimmedLine.startsWith('[CHECKPOINT]')) {
        const match = trimmedLine.match(
          /\[CHECKPOINT\]\s+(.+?)\s+-\s+(COMPLETED|IN-PROGRESS|PENDING|BLOCKED)/i
        );
        if (match) {
          updates.push({
            type: 'checkpoint',
            description: match[1].trim(),
            status: match[2].toLowerCase() as 'completed' | 'in-progress' | 'pending' | 'blocked',
          });
        }
      }

      // Parse decision markers
      else if (trimmedLine.startsWith('[DECISION]')) {
        const match = trimmedLine.match(/\[DECISION\]\s+(.+?)\s+-\s+(LOCKED|UNLOCKED)?/i);
        if (match) {
          updates.push({
            type: 'decision',
            decisionDescription: match[1].trim(),
            locked: match[2]?.toUpperCase() === 'LOCKED',
          });
        }
      }

      // Parse artifact markers
      else if (trimmedLine.startsWith('[ARTIFACT]')) {
        const match = trimmedLine.match(/\[ARTIFACT\]\s+(Created|Modified|Deleted)\s+(.+)/i);
        if (match) {
          updates.push({
            type: 'artifact',
            action: match[1].toLowerCase() as 'created' | 'modified' | 'deleted',
            path: match[2].trim(),
          });
        }
      }
    }

    return updates;
  }

  /**
   * Update goal based on parsed markers
   *
   * Applies goal updates extracted from the LLM summary to the active goal.
   *
   * @param goal - Goal to update
   * @param updates - Parsed goal updates
   * @returns Updated goal
   *
   * @example
   * ```typescript
   * const updates = compression.parseGoalMarkers(summary);
   * const updatedGoal = compression.updateGoal(activeGoal, updates);
   * ```
   */
  updateGoal(goal: Goal, updates: GoalUpdate[]): Goal {
    const updatedGoal = { ...goal };

    for (const update of updates) {
      switch (update.type) {
        case 'checkpoint':
          this.applyCheckpointUpdate(updatedGoal, update);
          break;

        case 'decision':
          this.applyDecisionUpdate(updatedGoal, update);
          break;

        case 'artifact':
          this.applyArtifactUpdate(updatedGoal, update);
          break;
      }
    }

    return updatedGoal;
  }

  /**
   * Verify goals are never compressed
   *
   * Validates that no goal information appears in the messages to be compressed.
   * Goals should always remain in the system prompt.
   *
   * @param messages - Messages to compress
   * @param goal - Active goal
   * @returns True if validation passes
   * @throws Error if goal information found in messages
   *
   * @example
   * ```typescript
   * compression.verifyGoalsNotCompressed(messages, activeGoal);
   * ```
   */
  verifyGoalsNotCompressed(messages: Message[], goal: Goal | null): boolean {
    if (!goal) {
      return true; // No goal to verify
    }

    // Check if any message contains goal markers or goal description
    const goalKeywords = [
      goal.description.toLowerCase(),
      '[checkpoint]',
      '[decision]',
      '[artifact]',
      'active goal:',
      'goal context:',
    ];

    for (const message of messages) {
      const content = message.content.toLowerCase();
      for (const keyword of goalKeywords) {
        if (content.includes(keyword)) {
          throw new Error(
            `Goal information found in messages to compress. ` +
              `Goals must remain in system prompt. ` +
              `Keyword: "${keyword}"`
          );
        }
      }
    }

    return true;
  }

  /**
   * Get goal preservation strategy
   *
   * Returns a strategy object describing what information to preserve
   * based on the active goal.
   *
   * @param goal - Active goal
   * @returns Preservation strategy
   *
   * @example
   * ```typescript
   * const strategy = compression.getPreservationStrategy(activeGoal);
   * if (strategy.preserveDecisions) {
   *   // Ensure decisions are preserved in summary
   * }
   * ```
   */
  getPreservationStrategy(goal: Goal | null): {
    preserveDecisions: boolean;
    preserveCheckpoints: boolean;
    preserveArtifacts: boolean;
    preserveBlockers: boolean;
    preserveTechnicalDetails: boolean;
  } {
    if (!goal) {
      return {
        preserveDecisions: false,
        preserveCheckpoints: false,
        preserveArtifacts: false,
        preserveBlockers: false,
        preserveTechnicalDetails: false,
      };
    }

    return {
      preserveDecisions: true,
      preserveCheckpoints: true,
      preserveArtifacts: true,
      preserveBlockers: goal.blockers.length > 0,
      preserveTechnicalDetails: goal.status === 'active',
    };
  }

  /**
   * Format goal context for prompt
   *
   * @param goal - Goal to format
   * @returns Formatted goal context
   */
  private formatGoalContext(goal: Goal): string {
    const lines: string[] = [];

    // Goal description and status
    lines.push(`Goal: ${goal.description}`);
    lines.push(`Status: ${goal.status}`);
    lines.push(`Priority: ${goal.priority}`);
    lines.push('');

    // Subtasks
    if (goal.subtasks.length > 0) {
      lines.push('Subtasks:');
      for (const subtask of goal.subtasks) {
        const icon = this.getSubtaskIcon(subtask.status);
        lines.push(`${icon} ${subtask.description}`);
      }
      lines.push('');
    }

    // Recent checkpoints (last 3)
    if (goal.checkpoints.length > 0) {
      lines.push('Recent Checkpoints:');
      const recentCheckpoints = goal.checkpoints.slice(-3);
      for (const checkpoint of recentCheckpoints) {
        lines.push(`✓ ${checkpoint.description}`);
      }
      lines.push('');
    }

    // Key decisions (locked ones)
    const lockedDecisions = goal.decisions.filter((d) => d.locked);
    if (lockedDecisions.length > 0) {
      lines.push('Key Decisions (Locked):');
      for (const decision of lockedDecisions) {
        lines.push(`🔒 ${decision.description}`);
      }
      lines.push('');
    }

    // Active blockers
    const activeBlockers = goal.blockers.filter((b) => !b.resolvedAt);
    if (activeBlockers.length > 0) {
      lines.push('Active Blockers:');
      for (const blocker of activeBlockers) {
        lines.push(`⚠️ ${blocker.description}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format messages for prompt
   *
   * @param messages - Messages to format
   * @returns Formatted messages
   */
  private formatMessages(messages: Message[]): string {
    return messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  }

  /**
   * Get icon for subtask status
   *
   * @param status - Subtask status
   * @returns Icon string
   */
  private getSubtaskIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '✅';
      case 'in-progress':
        return '🔄';
      case 'blocked':
        return '🚫';
      default:
        return '⏳';
    }
  }

  /**
   * Apply checkpoint update to goal
   *
   * @param goal - Goal to update
   * @param update - Checkpoint update
   */
  private applyCheckpointUpdate(goal: Goal, update: GoalUpdate): void {
    if (!update.description || !update.status) {
      return;
    }

    // Find matching subtask
    const subtask = goal.subtasks.find((st) =>
      st.description.toLowerCase().includes(update.description!.toLowerCase())
    );

    if (subtask) {
      // Update subtask status
      subtask.status = update.status as 'pending' | 'in-progress' | 'completed' | 'blocked';
      if (update.status === 'completed') {
        subtask.completedAt = new Date();
      }
    }
  }

  /**
   * Apply decision update to goal
   *
   * @param goal - Goal to update
   * @param update - Decision update
   */
  private applyDecisionUpdate(goal: Goal, update: GoalUpdate): void {
    if (!update.decisionDescription) {
      return;
    }

    // Check if decision already exists
    const existingDecision = goal.decisions.find(
      (d) => d.description.toLowerCase() === update.decisionDescription!.toLowerCase()
    );

    if (existingDecision) {
      // Update locked status
      if (update.locked !== undefined) {
        existingDecision.locked = update.locked;
      }
    } else {
      // Add new decision
      goal.decisions.push({
        id: this.generateId(),
        description: update.decisionDescription,
        rationale: update.rationale || 'Extracted from summary',
        alternatives: [],
        timestamp: new Date(),
        locked: update.locked || false,
      });
    }
  }

  /**
   * Apply artifact update to goal
   *
   * @param goal - Goal to update
   * @param update - Artifact update
   */
  private applyArtifactUpdate(goal: Goal, update: GoalUpdate): void {
    if (!update.action || !update.path) {
      return;
    }

    // Add artifact
    goal.artifacts.push({
      type: this.inferArtifactType(update.path),
      path: update.path,
      action: update.action,
      timestamp: new Date(),
      description: `${update.action} during compression`,
    });
  }

  /**
   * Infer artifact type from path
   *
   * @param path - File path
   * @returns Artifact type
   */
  private inferArtifactType(path: string): 'file' | 'test' | 'documentation' | 'configuration' {
    const lowerPath = path.toLowerCase();

    if (
      lowerPath.includes('test') ||
      lowerPath.endsWith('.test.ts') ||
      lowerPath.endsWith('.spec.ts')
    ) {
      return 'test';
    }

    if (lowerPath.includes('readme') || lowerPath.includes('doc') || lowerPath.endsWith('.md')) {
      return 'documentation';
    }

    if (
      lowerPath.includes('config') ||
      lowerPath.endsWith('.json') ||
      lowerPath.endsWith('.yaml') ||
      lowerPath.endsWith('.yml')
    ) {
      return 'configuration';
    }

    return 'file';
  }

  /**
   * Generate unique ID
   *
   * @returns Unique ID string
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
