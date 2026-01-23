/**
 * Goal Manager Implementation
 * 
 * Manages goals, checkpoints, decisions, and artifacts for long-running sessions.
 */

import { randomUUID } from 'crypto';

import type {
  Goal,
  GoalStack,
  GoalManager,
  GoalPriority,
  Subtask,
  SubtaskStatus,
  Checkpoint,
  CheckpointState,
  Decision,
  Artifact,
  ArtifactType,
  ArtifactAction,
  Blocker,
  BlockerType,
  GoalManagementConfig
} from './goalTypes.js';

/**
 * Goal Manager Implementation
 */
export class GoalManagerImpl implements GoalManager {
  private goals: Map<string, Goal> = new Map();
  private activeGoalId: string | null = null;
  private config: GoalManagementConfig;
  private sessionStartTime: Date;

  constructor(config: GoalManagementConfig) {
    this.config = config;
    this.sessionStartTime = new Date();
  }

  // ============================================================================
  // Goal Lifecycle
  // ============================================================================

  createGoal(description: string, priority: GoalPriority = 'medium', subtasks?: string[]): Goal {
    const goal: Goal = {
      id: randomUUID(),
      description,
      status: 'active',
      createdAt: new Date(),
      parentGoalId: undefined,
      subtasks: subtasks?.map(desc => this.createSubtaskObject(desc)) || [],
      checkpoints: [],
      decisions: [],
      artifacts: [],
      blockers: [],
      priority,
      tags: []
    };

    // Pause current active goal if exists
    if (this.activeGoalId) {
      const currentGoal = this.goals.get(this.activeGoalId);
      if (currentGoal && currentGoal.status === 'active') {
        currentGoal.status = 'paused';
        currentGoal.pausedAt = new Date();
      }
    }

    this.goals.set(goal.id, goal);
    this.activeGoalId = goal.id;

    return goal;
  }

  completeGoal(goalId: string, summary?: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    goal.status = 'completed';
    goal.completedAt = new Date();

    // Calculate actual effort
    const durationMs = goal.completedAt.getTime() - goal.createdAt.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    goal.actualEffort = `${hours}h ${minutes}m`;

    // Create final checkpoint if summary provided
    if (summary) {
      this.createCheckpoint(goalId, 'Goal completed', {}, summary);
    }

    // Clear active goal if this was it
    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }

    // Cleanup old completed goals
    this.cleanupCompletedGoals();
  }

  pauseGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    goal.status = 'paused';
    goal.pausedAt = new Date();

    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }
  }

  resumeGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    if (goal.status !== 'paused') {
      throw new Error(`Goal is not paused: ${goalId}`);
    }

    // Pause current active goal if exists
    if (this.activeGoalId) {
      const currentGoal = this.goals.get(this.activeGoalId);
      if (currentGoal && currentGoal.status === 'active') {
        currentGoal.status = 'paused';
        currentGoal.pausedAt = new Date();
      }
    }

    goal.status = 'active';
    goal.pausedAt = undefined;
    this.activeGoalId = goalId;
  }

  abandonGoal(goalId: string, reason: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    goal.status = 'abandoned';
    
    // Record reason as a checkpoint
    this.createCheckpoint(goalId, `Goal abandoned: ${reason}`, {}, reason);

    if (this.activeGoalId === goalId) {
      this.activeGoalId = null;
    }
  }

  // ============================================================================
  // Subtask Management
  // ============================================================================

  addSubtask(goalId: string, description: string, dependsOn: string[] = []): Subtask {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const subtask = this.createSubtaskObject(description, dependsOn);
    goal.subtasks.push(subtask);

    return subtask;
  }

  completeSubtask(goalId: string, subtaskId: string): void {
    this.updateSubtaskStatus(goalId, subtaskId, 'completed');
    
    const goal = this.goals.get(goalId);
    if (goal) {
      const subtask = goal.subtasks.find(st => st.id === subtaskId);
      if (subtask) {
        subtask.completedAt = new Date();
      }
    }
  }

  updateSubtaskStatus(goalId: string, subtaskId: string, status: SubtaskStatus): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const subtask = goal.subtasks.find(st => st.id === subtaskId);
    if (!subtask) {
      throw new Error(`Subtask not found: ${subtaskId}`);
    }

    subtask.status = status;
  }

  // ============================================================================
  // Checkpoint Management
  // ============================================================================

  createCheckpoint(
    goalId: string,
    description: string,
    state: Partial<CheckpointState>,
    summary: string = ''
  ): Checkpoint {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const checkpoint: Checkpoint = {
      id: randomUUID(),
      goalId,
      description,
      timestamp: new Date(),
      state: {
        filesModified: state.filesModified || [],
        testsAdded: state.testsAdded || [],
        decisionsLocked: state.decisionsLocked || [],
        metricsRecorded: state.metricsRecorded || {}
      },
      assistantSummary: summary
    };

    goal.checkpoints.push(checkpoint);

    // Cleanup old checkpoints
    if (goal.checkpoints.length > this.config.maxCheckpointsPerGoal) {
      goal.checkpoints = goal.checkpoints.slice(-this.config.maxCheckpointsPerGoal);
    }

    return checkpoint;
  }

  // ============================================================================
  // Decision Tracking
  // ============================================================================

  recordDecision(
    goalId: string,
    description: string,
    rationale: string,
    alternatives: string[] = []
  ): Decision {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const decision: Decision = {
      id: randomUUID(),
      description,
      rationale,
      alternatives,
      timestamp: new Date(),
      locked: false
    };

    goal.decisions.push(decision);

    return decision;
  }

  lockDecision(goalId: string, decisionId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const decision = goal.decisions.find(d => d.id === decisionId);
    if (!decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    decision.locked = true;
  }

  // ============================================================================
  // Artifact Tracking
  // ============================================================================

  recordArtifact(
    goalId: string,
    type: ArtifactType,
    path: string,
    action: ArtifactAction,
    description?: string
  ): Artifact {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const artifact: Artifact = {
      type,
      path,
      action,
      timestamp: new Date(),
      description
    };

    goal.artifacts.push(artifact);

    return artifact;
  }

  // ============================================================================
  // Blocker Management
  // ============================================================================

  addBlocker(goalId: string, description: string, type: BlockerType): Blocker {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const blocker: Blocker = {
      id: randomUUID(),
      description,
      type,
      createdAt: new Date()
    };

    goal.blockers.push(blocker);

    // Mark goal as blocked if it was active
    if (goal.status === 'active') {
      goal.status = 'blocked';
    }

    return blocker;
  }

  resolveBlocker(goalId: string, blockerId: string, resolution: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) {
      throw new Error(`Goal not found: ${goalId}`);
    }

    const blocker = goal.blockers.find(b => b.id === blockerId);
    if (!blocker) {
      throw new Error(`Blocker not found: ${blockerId}`);
    }

    blocker.resolvedAt = new Date();
    blocker.resolution = resolution;

    // Unblock goal if all blockers resolved
    const hasUnresolvedBlockers = goal.blockers.some(b => !b.resolvedAt);
    if (!hasUnresolvedBlockers && goal.status === 'blocked') {
      goal.status = 'active';
    }
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  getActiveGoal(): Goal | null {
    if (!this.activeGoalId) {
      return null;
    }
    return this.goals.get(this.activeGoalId) || null;
  }

  getGoalById(goalId: string): Goal | null {
    return this.goals.get(goalId) || null;
  }

  getCompletedGoals(): Goal[] {
    return Array.from(this.goals.values()).filter(g => g.status === 'completed');
  }

  getPausedGoals(): Goal[] {
    return Array.from(this.goals.values()).filter(g => g.status === 'paused');
  }

  getGoalProgress(goalId: string): number {
    const goal = this.goals.get(goalId);
    if (!goal) {
      return 0;
    }

    if (goal.subtasks.length === 0) {
      return goal.status === 'completed' ? 100 : 0;
    }

    const completedSubtasks = goal.subtasks.filter(st => st.status === 'completed').length;
    return Math.round((completedSubtasks / goal.subtasks.length) * 100);
  }

  getGoalStack(): GoalStack {
    const allGoals = Array.from(this.goals.values());
    const completedGoals = allGoals.filter(g => g.status === 'completed');
    const pausedGoals = allGoals.filter(g => g.status === 'paused');
    
    const totalCheckpoints = allGoals.reduce((sum, g) => sum + g.checkpoints.length, 0);
    const sessionDuration = Date.now() - this.sessionStartTime.getTime();

    return {
      activeGoal: this.getActiveGoal(),
      goalHistory: allGoals,
      completedGoals,
      pausedGoals,
      stats: {
        totalGoals: allGoals.length,
        completedGoals: completedGoals.length,
        totalCheckpoints,
        sessionDuration
      }
    };
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  toJSON(): string {
    const goalStack = this.getGoalStack();
    return JSON.stringify({
      activeGoalId: this.activeGoalId,
      goals: Array.from(this.goals.entries()),
      sessionStartTime: this.sessionStartTime.toISOString(),
      goalStack
    }, null, 2);
  }

  fromJSON(json: string): void {
    const data = JSON.parse(json);
    
    this.activeGoalId = data.activeGoalId;
    this.sessionStartTime = new Date(data.sessionStartTime);
    
    this.goals.clear();
    for (const [id, goal] of data.goals) {
      // Convert date strings back to Date objects
      const parsedGoal = this.parseGoalDates(goal);
      this.goals.set(id, parsedGoal);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private createSubtaskObject(description: string, dependsOn: string[] = []): Subtask {
    return {
      id: randomUUID(),
      description,
      status: 'pending',
      createdAt: new Date(),
      dependsOn
    };
  }

  private cleanupCompletedGoals(): void {
    const completedGoals = this.getCompletedGoals();
    
    if (completedGoals.length > this.config.maxCompletedGoals) {
      // Sort by completion date (oldest first)
      const sorted = completedGoals.sort((a, b) => 
        (a.completedAt?.getTime() || 0) - (b.completedAt?.getTime() || 0)
      );

      // Remove oldest goals
      const toRemove = sorted.slice(0, sorted.length - this.config.maxCompletedGoals);
      for (const goal of toRemove) {
        this.goals.delete(goal.id);
      }
    }
  }

  private parseGoalDates(goal: Record<string, unknown>): Goal {
    const goalData = goal as {
      createdAt: string;
      completedAt?: string;
      pausedAt?: string;
      subtasks: Array<{ createdAt: string; completedAt?: string; [key: string]: unknown }>;
      checkpoints: Array<{ timestamp: string; [key: string]: unknown }>;
      decisions: Array<{ timestamp: string; [key: string]: unknown }>;
      artifacts: Array<{ timestamp: string; [key: string]: unknown }>;
      blockers: Array<{ createdAt: string; resolvedAt?: string; [key: string]: unknown }>;
      [key: string]: unknown;
    };
    
    return {
      ...goalData,
      createdAt: new Date(goalData.createdAt),
      completedAt: goalData.completedAt ? new Date(goalData.completedAt) : undefined,
      pausedAt: goalData.pausedAt ? new Date(goalData.pausedAt) : undefined,
      subtasks: goalData.subtasks.map((st) => ({
        ...st,
        createdAt: new Date(st.createdAt),
        completedAt: st.completedAt ? new Date(st.completedAt) : undefined
      })) as Subtask[],
      checkpoints: goalData.checkpoints.map((cp) => ({
        ...cp,
        timestamp: new Date(cp.timestamp)
      })) as Checkpoint[],
      decisions: goalData.decisions.map((d) => ({
        ...d,
        timestamp: new Date(d.timestamp)
      })) as Decision[],
      artifacts: goalData.artifacts.map((a) => ({
        ...a,
        timestamp: new Date(a.timestamp)
      })) as Artifact[],
      blockers: goalData.blockers.map((b) => ({
        ...b,
        createdAt: new Date(b.createdAt),
        resolvedAt: b.resolvedAt ? new Date(b.resolvedAt) : undefined
      })) as Blocker[]
    } as Goal;
  }
}

/**
 * Create a new goal manager instance
 */
export function createGoalManager(config: GoalManagementConfig): GoalManager {
  return new GoalManagerImpl(config);
}

/**
 * Default goal management configuration
 */
export const DEFAULT_GOAL_CONFIG: GoalManagementConfig = {
  enabled: true,
  maxCompletedGoals: 10,
  maxCheckpointsPerGoal: 20,
  autoCheckpoint: false,
  autoCheckpointInterval: 15
};
