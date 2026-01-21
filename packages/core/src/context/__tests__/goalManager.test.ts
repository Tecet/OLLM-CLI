/**
 * Goal Manager Tests
 * 
 * Tests for goal management functionality including:
 * - Goal lifecycle (create, complete, pause, resume, abandon)
 * - Subtask management
 * - Checkpoint creation
 * - Decision tracking
 * - Artifact recording
 * - Blocker management
 * - Serialization (toJSON/fromJSON)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoalManagerImpl } from '../goalManager.js';
import type { GoalManagementConfig } from '../goalTypes.js';

describe('GoalManager', () => {
  let goalManager: GoalManagerImpl;
  const config: GoalManagementConfig = {
    enabled: true,
    maxCompletedGoals: 10,
    maxCheckpointsPerGoal: 20,
    autoCheckpoint: false,
    autoCheckpointInterval: 15
  };

  beforeEach(() => {
    goalManager = new GoalManagerImpl(config);
  });

  describe('Goal Lifecycle', () => {
    it('should create a new goal', () => {
      const goal = goalManager.createGoal('Fix authentication bug', 'high');
      
      expect(goal).toBeDefined();
      expect(goal.description).toBe('Fix authentication bug');
      expect(goal.priority).toBe('high');
      expect(goal.status).toBe('active');
      expect(goal.subtasks).toEqual([]);
      expect(goal.checkpoints).toEqual([]);
    });

    it('should create a goal with subtasks', () => {
      const goal = goalManager.createGoal(
        'Implement feature',
        'medium',
        ['Design API', 'Write code', 'Add tests']
      );
      
      expect(goal.subtasks).toHaveLength(3);
      expect(goal.subtasks[0].description).toBe('Design API');
      expect(goal.subtasks[0].status).toBe('pending');
    });

    it('should set new goal as active', () => {
      const goal = goalManager.createGoal('First goal', 'medium');
      const activeGoal = goalManager.getActiveGoal();
      
      expect(activeGoal).toBeDefined();
      expect(activeGoal?.id).toBe(goal.id);
    });

    it('should pause previous goal when creating new one', () => {
      const goal1 = goalManager.createGoal('First goal', 'medium');
      const goal2 = goalManager.createGoal('Second goal', 'high');
      
      const pausedGoal = goalManager.getGoalById(goal1.id);
      expect(pausedGoal?.status).toBe('paused');
      expect(pausedGoal?.pausedAt).toBeDefined();
      
      const activeGoal = goalManager.getActiveGoal();
      expect(activeGoal?.id).toBe(goal2.id);
    });

    it('should complete a goal', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      goalManager.completeGoal(goal.id, 'Successfully completed');
      
      const completedGoal = goalManager.getGoalById(goal.id);
      expect(completedGoal?.status).toBe('completed');
      expect(completedGoal?.completedAt).toBeDefined();
      expect(completedGoal?.actualEffort).toBeDefined();
    });

    it('should clear active goal when completing it', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      goalManager.completeGoal(goal.id);
      
      const activeGoal = goalManager.getActiveGoal();
      expect(activeGoal).toBeNull();
    });

    it('should pause a goal', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      goalManager.pauseGoal(goal.id);
      
      const pausedGoal = goalManager.getGoalById(goal.id);
      expect(pausedGoal?.status).toBe('paused');
      expect(pausedGoal?.pausedAt).toBeDefined();
    });

    it('should resume a paused goal', () => {
      const goal1 = goalManager.createGoal('First goal', 'medium');
      const goal2 = goalManager.createGoal('Second goal', 'high');
      
      goalManager.resumeGoal(goal1.id);
      
      const resumedGoal = goalManager.getGoalById(goal1.id);
      expect(resumedGoal?.status).toBe('active');
      expect(resumedGoal?.pausedAt).toBeUndefined();
      
      const pausedGoal = goalManager.getGoalById(goal2.id);
      expect(pausedGoal?.status).toBe('paused');
    });

    it('should abandon a goal with reason', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      goalManager.abandonGoal(goal.id, 'Requirements changed');
      
      const abandonedGoal = goalManager.getGoalById(goal.id);
      expect(abandonedGoal?.status).toBe('abandoned');
      expect(abandonedGoal?.checkpoints.length).toBeGreaterThan(0);
    });
  });

  describe('Subtask Management', () => {
    it('should add subtask to goal', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const subtask = goalManager.addSubtask(goal.id, 'New subtask');
      
      expect(subtask).toBeDefined();
      expect(subtask.description).toBe('New subtask');
      expect(subtask.status).toBe('pending');
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      expect(updatedGoal?.subtasks).toHaveLength(1);
    });

    it('should complete subtask', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const subtask = goalManager.addSubtask(goal.id, 'Test subtask');
      
      goalManager.completeSubtask(goal.id, subtask.id);
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      const completedSubtask = updatedGoal?.subtasks.find(st => st.id === subtask.id);
      expect(completedSubtask?.status).toBe('completed');
      expect(completedSubtask?.completedAt).toBeDefined();
    });

    it('should update subtask status', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const subtask = goalManager.addSubtask(goal.id, 'Test subtask');
      
      goalManager.updateSubtaskStatus(goal.id, subtask.id, 'in-progress');
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      const updatedSubtask = updatedGoal?.subtasks.find(st => st.id === subtask.id);
      expect(updatedSubtask?.status).toBe('in-progress');
    });

    it('should calculate goal progress based on subtasks', () => {
      const goal = goalManager.createGoal('Test goal', 'medium', [
        'Subtask 1',
        'Subtask 2',
        'Subtask 3'
      ]);
      
      expect(goalManager.getGoalProgress(goal.id)).toBe(0);
      
      goalManager.completeSubtask(goal.id, goal.subtasks[0].id);
      expect(goalManager.getGoalProgress(goal.id)).toBe(33);
      
      goalManager.completeSubtask(goal.id, goal.subtasks[1].id);
      expect(goalManager.getGoalProgress(goal.id)).toBe(67);
      
      goalManager.completeSubtask(goal.id, goal.subtasks[2].id);
      expect(goalManager.getGoalProgress(goal.id)).toBe(100);
    });
  });

  describe('Checkpoint Management', () => {
    it('should create checkpoint', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const checkpoint = goalManager.createCheckpoint(
        goal.id,
        'Completed phase 1',
        { filesModified: ['file1.ts', 'file2.ts'] },
        'Phase 1 summary'
      );
      
      expect(checkpoint).toBeDefined();
      expect(checkpoint.description).toBe('Completed phase 1');
      expect(checkpoint.state.filesModified).toEqual(['file1.ts', 'file2.ts']);
      expect(checkpoint.assistantSummary).toBe('Phase 1 summary');
    });

    it('should limit checkpoints per goal', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      
      // Create more checkpoints than the limit
      for (let i = 0; i < 25; i++) {
        goalManager.createCheckpoint(goal.id, `Checkpoint ${i}`, {});
      }
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      expect(updatedGoal?.checkpoints.length).toBe(config.maxCheckpointsPerGoal);
    });
  });

  describe('Decision Tracking', () => {
    it('should record decision', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const decision = goalManager.recordDecision(
        goal.id,
        'Use TypeScript',
        'Better type safety',
        ['JavaScript', 'Flow']
      );
      
      expect(decision).toBeDefined();
      expect(decision.description).toBe('Use TypeScript');
      expect(decision.rationale).toBe('Better type safety');
      expect(decision.alternatives).toEqual(['JavaScript', 'Flow']);
      expect(decision.locked).toBe(false);
    });

    it('should lock decision', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const decision = goalManager.recordDecision(
        goal.id,
        'Use TypeScript',
        'Better type safety'
      );
      
      goalManager.lockDecision(goal.id, decision.id);
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      const lockedDecision = updatedGoal?.decisions.find(d => d.id === decision.id);
      expect(lockedDecision?.locked).toBe(true);
    });
  });

  describe('Artifact Recording', () => {
    it('should record artifact', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const artifact = goalManager.recordArtifact(
        goal.id,
        'file',
        'src/auth.ts',
        'modified',
        'Updated authentication logic'
      );
      
      expect(artifact).toBeDefined();
      expect(artifact.type).toBe('file');
      expect(artifact.path).toBe('src/auth.ts');
      expect(artifact.action).toBe('modified');
      expect(artifact.description).toBe('Updated authentication logic');
    });
  });

  describe('Blocker Management', () => {
    it('should add blocker', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const blocker = goalManager.addBlocker(
        goal.id,
        'Waiting for API documentation',
        'external-dependency'
      );
      
      expect(blocker).toBeDefined();
      expect(blocker.description).toBe('Waiting for API documentation');
      expect(blocker.type).toBe('external-dependency');
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      expect(updatedGoal?.status).toBe('blocked');
    });

    it('should resolve blocker', () => {
      const goal = goalManager.createGoal('Test goal', 'medium');
      const blocker = goalManager.addBlocker(
        goal.id,
        'Waiting for API documentation',
        'external-dependency'
      );
      
      goalManager.resolveBlocker(goal.id, blocker.id, 'Documentation received');
      
      const updatedGoal = goalManager.getGoalById(goal.id);
      const resolvedBlocker = updatedGoal?.blockers.find(b => b.id === blocker.id);
      expect(resolvedBlocker?.resolvedAt).toBeDefined();
      expect(resolvedBlocker?.resolution).toBe('Documentation received');
      expect(updatedGoal?.status).toBe('active');
    });
  });

  describe('Query Methods', () => {
    it('should get completed goals', () => {
      goalManager.createGoal('Goal 1', 'medium');
      const goal2 = goalManager.createGoal('Goal 2', 'high');
      goalManager.completeGoal(goal2.id);
      
      const completedGoals = goalManager.getCompletedGoals();
      expect(completedGoals).toHaveLength(1);
      expect(completedGoals[0].id).toBe(goal2.id);
    });

    it('should get paused goals', () => {
      const goal1 = goalManager.createGoal('Goal 1', 'medium');
      goalManager.createGoal('Goal 2', 'high');
      
      const pausedGoals = goalManager.getPausedGoals();
      expect(pausedGoals).toHaveLength(1);
      expect(pausedGoals[0].id).toBe(goal1.id);
    });

    it('should get goal stack', () => {
      goalManager.createGoal('Goal 1', 'medium');
      const goal2 = goalManager.createGoal('Goal 2', 'high');
      goalManager.completeGoal(goal2.id);
      
      const stack = goalManager.getGoalStack();
      expect(stack.activeGoal).toBeNull();
      expect(stack.goalHistory).toHaveLength(2);
      expect(stack.completedGoals).toHaveLength(1);
      expect(stack.pausedGoals).toHaveLength(1);
      expect(stack.stats.totalGoals).toBe(2);
      expect(stack.stats.completedGoals).toBe(1);
    });
  });

  describe('Serialization', () => {
    it('should serialize to JSON', () => {
      goalManager.createGoal('Test goal', 'high');
      const json = goalManager.toJSON();
      
      expect(json).toBeDefined();
      expect(typeof json).toBe('string');
      
      const parsed = JSON.parse(json);
      expect(parsed.goals).toBeDefined();
      expect(parsed.activeGoalId).toBeDefined();
    });

    it('should deserialize from JSON', () => {
      const goal = goalManager.createGoal('Test goal', 'high', ['Subtask 1']);
      goalManager.createCheckpoint(goal.id, 'Checkpoint 1', {});
      
      const json = goalManager.toJSON();
      
      const newManager = new GoalManagerImpl(config);
      newManager.fromJSON(json);
      
      const restoredGoal = newManager.getActiveGoal();
      expect(restoredGoal).toBeDefined();
      expect(restoredGoal?.description).toBe('Test goal');
      expect(restoredGoal?.subtasks).toHaveLength(1);
      expect(restoredGoal?.checkpoints).toHaveLength(1);
    });

    it('should preserve dates after serialization', () => {
      goalManager.createGoal('Test goal', 'high');
      const json = goalManager.toJSON();
      
      const newManager = new GoalManagerImpl(config);
      newManager.fromJSON(json);
      
      const restoredGoal = newManager.getActiveGoal();
      expect(restoredGoal?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old completed goals', () => {
      // Create more completed goals than the limit
      for (let i = 0; i < 15; i++) {
        const goal = goalManager.createGoal(`Goal ${i}`, 'medium');
        goalManager.completeGoal(goal.id);
      }
      
      const completedGoals = goalManager.getCompletedGoals();
      expect(completedGoals.length).toBeLessThanOrEqual(config.maxCompletedGoals);
    });
  });
});
