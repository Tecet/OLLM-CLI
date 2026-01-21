/**
 * Goal-Oriented Context Management Types
 * 
 * Provides structured goal tracking, checkpoints, and decision management
 * for long-running sessions without losing context.
 */

/**
 * Goal status
 */
export type GoalStatus = 'active' | 'completed' | 'paused' | 'blocked' | 'abandoned';

/**
 * Subtask status
 */
export type SubtaskStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';

/**
 * Goal priority
 */
export type GoalPriority = 'high' | 'medium' | 'low';

/**
 * Blocker type
 */
export type BlockerType = 'missing-info' | 'external-dependency' | 'technical-issue';

/**
 * Artifact type
 */
export type ArtifactType = 'file' | 'test' | 'documentation' | 'configuration';

/**
 * Artifact action
 */
export type ArtifactAction = 'created' | 'modified' | 'deleted';

/**
 * Subtask within a goal
 */
export interface Subtask {
  /** Unique ID */
  id: string;
  /** Subtask description */
  description: string;
  /** Current status */
  status: SubtaskStatus;
  /** When created */
  createdAt: Date;
  /** When completed */
  completedAt?: Date;
  /** Dependencies on other subtasks */
  dependsOn: string[];
  /** Blocker ID if blocked */
  blockedBy?: string;
}

/**
 * Checkpoint state snapshot
 */
export interface CheckpointState {
  /** Files modified at this checkpoint */
  filesModified: string[];
  /** Tests added at this checkpoint */
  testsAdded: string[];
  /** Decisions that are locked (shouldn't be changed) */
  decisionsLocked: string[];
  /** Metrics recorded at this checkpoint */
  metricsRecorded: Record<string, number>;
}

/**
 * Progress checkpoint within a goal
 */
export interface Checkpoint {
  /** Unique ID */
  id: string;
  /** Goal this checkpoint belongs to */
  goalId: string;
  /** Checkpoint description */
  description: string;
  /** When created */
  timestamp: Date;
  /** State snapshot at this checkpoint */
  state: CheckpointState;
  /** User message ID that triggered this checkpoint */
  userMessageId?: string;
  /** Brief summary of what was done */
  assistantSummary: string;
}

/**
 * Decision made during goal execution
 */
export interface Decision {
  /** Unique ID */
  id: string;
  /** Decision description */
  description: string;
  /** Rationale for this decision */
  rationale: string;
  /** Alternative approaches considered */
  alternatives: string[];
  /** When decision was made */
  timestamp: Date;
  /** If true, this decision shouldn't be changed */
  locked: boolean;
}

/**
 * Artifact created/modified during goal execution
 */
export interface Artifact {
  /** Type of artifact */
  type: ArtifactType;
  /** File path or identifier */
  path: string;
  /** Action performed */
  action: ArtifactAction;
  /** When created/modified */
  timestamp: Date;
  /** Optional description */
  description?: string;
}

/**
 * Blocker preventing goal progress
 */
export interface Blocker {
  /** Unique ID */
  id: string;
  /** Blocker description */
  description: string;
  /** Type of blocker */
  type: BlockerType;
  /** When blocker was identified */
  createdAt: Date;
  /** When blocker was resolved */
  resolvedAt?: Date;
  /** How blocker was resolved */
  resolution?: string;
}

/**
 * Goal representing a task or objective
 */
export interface Goal {
  // Identity
  /** Unique ID */
  id: string;
  /** Goal description */
  description: string;
  
  // Status
  /** Current status */
  status: GoalStatus;
  /** When created */
  createdAt: Date;
  /** When completed */
  completedAt?: Date;
  /** When paused */
  pausedAt?: Date;
  
  // Hierarchy
  /** Parent goal ID for sub-goals */
  parentGoalId?: string;
  /** Subtasks within this goal */
  subtasks: Subtask[];
  
  // Progress tracking
  /** Checkpoints marking progress */
  checkpoints: Checkpoint[];
  /** Decisions made */
  decisions: Decision[];
  /** Artifacts created/modified */
  artifacts: Artifact[];
  /** Blockers encountered */
  blockers: Blocker[];
  
  // Metadata
  /** Priority level */
  priority: GoalPriority;
  /** Estimated effort */
  estimatedEffort?: string;
  /** Actual effort spent */
  actualEffort?: string;
  /** Tags for categorization */
  tags: string[];
}

/**
 * Goal stack statistics
 */
export interface GoalStackStats {
  /** Total number of goals */
  totalGoals: number;
  /** Number of completed goals */
  completedGoals: number;
  /** Total checkpoints across all goals */
  totalCheckpoints: number;
  /** Session duration in milliseconds */
  sessionDuration: number;
}

/**
 * Goal stack managing all goals in a session
 */
export interface GoalStack {
  /** Currently active goal */
  activeGoal: Goal | null;
  /** All goals (active + completed + paused) */
  goalHistory: Goal[];
  /** Completed goals (quick access) */
  completedGoals: Goal[];
  /** Paused goals (quick access) */
  pausedGoals: Goal[];
  /** Statistics */
  stats: GoalStackStats;
}

/**
 * Goal manager interface
 */
export interface GoalManager {
  // Goal lifecycle
  /** Create a new goal */
  createGoal(description: string, priority?: GoalPriority, subtasks?: string[]): Goal;
  /** Mark goal as completed */
  completeGoal(goalId: string, summary?: string): void;
  /** Pause a goal */
  pauseGoal(goalId: string): void;
  /** Resume a paused goal */
  resumeGoal(goalId: string): void;
  /** Abandon a goal */
  abandonGoal(goalId: string, reason: string): void;
  
  // Subtask management
  /** Add subtask to goal */
  addSubtask(goalId: string, description: string, dependsOn?: string[]): Subtask;
  /** Mark subtask as completed */
  completeSubtask(goalId: string, subtaskId: string): void;
  /** Update subtask status */
  updateSubtaskStatus(goalId: string, subtaskId: string, status: SubtaskStatus): void;
  
  // Checkpoint management
  /** Create a checkpoint */
  createCheckpoint(goalId: string, description: string, state: Partial<CheckpointState>, summary?: string): Checkpoint;
  
  // Decision tracking
  /** Record a decision */
  recordDecision(goalId: string, description: string, rationale: string, alternatives?: string[]): Decision;
  /** Lock a decision to prevent changes */
  lockDecision(goalId: string, decisionId: string): void;
  
  // Artifact tracking
  /** Record an artifact */
  recordArtifact(goalId: string, type: ArtifactType, path: string, action: ArtifactAction, description?: string): Artifact;
  
  // Blocker management
  /** Add a blocker */
  addBlocker(goalId: string, description: string, type: BlockerType): Blocker;
  /** Resolve a blocker */
  resolveBlocker(goalId: string, blockerId: string, resolution: string): void;
  
  // Query
  /** Get active goal */
  getActiveGoal(): Goal | null;
  /** Get goal by ID */
  getGoalById(goalId: string): Goal | null;
  /** Get all completed goals */
  getCompletedGoals(): Goal[];
  /** Get all paused goals */
  getPausedGoals(): Goal[];
  /** Get goal progress (0-100%) */
  getGoalProgress(goalId: string): number;
  /** Get goal stack */
  getGoalStack(): GoalStack;
  
  // Serialization
  /** Export goal stack to JSON */
  toJSON(): string;
  /** Import goal stack from JSON */
  fromJSON(json: string): void;
}

/**
 * Goal management configuration
 */
export interface GoalManagementConfig {
  /** Enable goal tracking */
  enabled: boolean;
  /** Keep last N completed goals (default: 10) */
  maxCompletedGoals: number;
  /** Keep last N checkpoints per goal (default: 20) */
  maxCheckpointsPerGoal: number;
  /** Auto-create checkpoints (default: false) */
  autoCheckpoint: boolean;
  /** Minutes between auto-checkpoints (default: 15) */
  autoCheckpointInterval: number;
}
