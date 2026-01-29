/**
 * Goal-Aware Compression Integration Tests
 *
 * Tests for FR-15: Goal System Integration
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import {
  GoalAwareCompression,
  type GoalUpdate,
} from '../goalAwareCompression.js';

import type {
  Goal,
  GoalManager,
  Subtask,
  Decision,
  Artifact,
  Checkpoint,
  GoalStack,
  GoalStatus,
  GoalPriority,
} from '../../goalTypes.js';
import type { Message } from '../../types.js';

// Mock GoalManager for testing
class MockGoalManager implements GoalManager {
  private activeGoal: Goal | null = null;
  private goals: Map<string, Goal> = new Map();

  setActiveGoal(goal: Goal | null): void {
    this.activeGoal = goal;
    if (goal) {
      this.goals.set(goal.id, goal);
    }
  }

  createGoal(description: string, priority?: GoalPriority, subtasks?: string[]): Goal {
    const goal: Goal = {
      id: this.generateId(),
      description,
      status: 'active',
      createdAt: new Date(),
      subtasks: (subtasks || []).map((desc) => ({
        id: this.generateId(),
        description: desc,
        status: 'pending',
        createdAt: new Date(),
        dependsOn: [],
      })),
      checkpoints: [],
      decisions: [],
      artifacts: [],
      blockers: [],
      priority: priority || 'medium',
      tags: [],
    };
    this.goals.set(goal.id, goal);
    this.activeGoal = goal;
    return goal;
  }

  completeGoal(goalId: string, summary?: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = 'completed';
      goal.completedAt = new Date();
    }
  }

  pauseGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = 'paused';
      goal.pausedAt = new Date();
    }
  }

  resumeGoal(goalId: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = 'active';
      goal.pausedAt = undefined;
    }
  }

  abandonGoal(goalId: string, reason: string): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.status = 'abandoned';
    }
  }

  addSubtask(goalId: string, description: string, dependsOn?: string[]): Subtask {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error('Goal not found');

    const subtask: Subtask = {
      id: this.generateId(),
      description,
      status: 'pending',
      createdAt: new Date(),
      dependsOn: dependsOn || [],
    };

    goal.subtasks.push(subtask);
    return subtask;
  }

  completeSubtask(goalId: string, subtaskId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const subtask = goal.subtasks.find((st) => st.id === subtaskId);
    if (subtask) {
      subtask.status = 'completed';
      subtask.completedAt = new Date();
    }
  }

  updateSubtaskStatus(goalId: string, subtaskId: string, status: 'pending' | 'in-progress' | 'completed' | 'blocked'): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const subtask = goal.subtasks.find((st) => st.id === subtaskId);
    if (subtask) {
      subtask.status = status;
    }
  }

  createCheckpoint(goalId: string, description: string, state: any, summary?: string): Checkpoint {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error('Goal not found');

    const checkpoint: Checkpoint = {
      id: this.generateId(),
      goalId,
      description,
      timestamp: new Date(),
      state: state || { filesModified: [], testsAdded: [], decisionsLocked: [], metricsRecorded: {} },
      assistantSummary: summary || '',
    };

    goal.checkpoints.push(checkpoint);
    return checkpoint;
  }

  recordDecision(goalId: string, description: string, rationale: string, alternatives?: string[]): Decision {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error('Goal not found');

    const decision: Decision = {
      id: this.generateId(),
      description,
      rationale,
      alternatives: alternatives || [],
      timestamp: new Date(),
      locked: false,
    };

    goal.decisions.push(decision);
    return decision;
  }

  lockDecision(goalId: string, decisionId: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const decision = goal.decisions.find((d) => d.id === decisionId);
    if (decision) {
      decision.locked = true;
    }
  }

  recordArtifact(goalId: string, type: 'file' | 'test' | 'documentation' | 'configuration', path: string, action: 'created' | 'modified' | 'deleted', description?: string): Artifact {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error('Goal not found');

    const artifact: Artifact = {
      type,
      path,
      action,
      timestamp: new Date(),
      description,
    };

    goal.artifacts.push(artifact);
    return artifact;
  }

  addBlocker(goalId: string, description: string, type: 'missing-info' | 'external-dependency' | 'technical-issue'): any {
    const goal = this.goals.get(goalId);
    if (!goal) throw new Error('Goal not found');

    const blocker = {
      id: this.generateId(),
      description,
      type,
      createdAt: new Date(),
    };

    goal.blockers.push(blocker);
    return blocker;
  }

  resolveBlocker(goalId: string, blockerId: string, resolution: string): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const blocker = goal.blockers.find((b) => b.id === blockerId);
    if (blocker) {
      blocker.resolvedAt = new Date();
      blocker.resolution = resolution;
    }
  }

  getActiveGoal(): Goal | null {
    return this.activeGoal;
  }

  getGoalById(goalId: string): Goal | null {
    return this.goals.get(goalId) || null;
  }

  getCompletedGoals(): Goal[] {
    return Array.from(this.goals.values()).filter((g) => g.status === 'completed');
  }

  getPausedGoals(): Goal[] {
    return Array.from(this.goals.values()).filter((g) => g.status === 'paused');
  }

  getGoalProgress(goalId: string): number {
    const goal = this.goals.get(goalId);
    if (!goal || goal.subtasks.length === 0) return 0;

    const completed = goal.subtasks.filter((st) => st.status === 'completed').length;
    return (completed / goal.subtasks.length) * 100;
  }

  getGoalStack(): GoalStack {
    const allGoals = Array.from(this.goals.values());
    return {
      activeGoal: this.activeGoal,
      goalHistory: allGoals,
      completedGoals: allGoals.filter((g) => g.status === 'completed'),
      pausedGoals: allGoals.filter((g) => g.status === 'paused'),
      stats: {
        totalGoals: allGoals.length,
        completedGoals: allGoals.filter((g) => g.status === 'completed').length,
        totalCheckpoints: allGoals.reduce((sum, g) => sum + g.checkpoints.length, 0),
        sessionDuration: 0,
      },
    };
  }

  toJSON(): string {
    return JSON.stringify({
      activeGoal: this.activeGoal,
      goals: Array.from(this.goals.entries()),
    });
  }

  fromJSON(json: string): void {
    const data = JSON.parse(json);
    this.activeGoal = data.activeGoal;
    this.goals = new Map(data.goals);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Helper to create test goals
function createTestGoal(description: string, options?: Partial<Goal>): Goal {
  return {
    id: `goal-${Date.now()}`,
    description,
    status: 'active',
    createdAt: new Date(),
    subtasks: [],
    checkpoints: [],
    decisions: [],
    artifacts: [],
    blockers: [],
    priority: 'medium',
    tags: [],
    ...options,
  };
}

// Helper to create test messages
function createTestMessage(role: 'user' | 'assistant', content: string): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    timestamp: new Date(),
  };
}

describe('GoalAwareCompression', () => {
  let goalManager: MockGoalManager;
  let compression: GoalAwareCompression;

  beforeEach(() => {
    goalManager = new MockGoalManager();
    compression = new GoalAwareCompression(goalManager);
  });

  describe('getActiveGoal', () => {
    it('should return null when no goal is active', () => {
      expect(compression.getActiveGoal()).toBeNull();
    });

    it('should return active goal when set', () => {
      const goal = createTestGoal('Implement user authentication');
      goalManager.setActiveGoal(goal);

      const activeGoal = compression.getActiveGoal();
      expect(activeGoal).not.toBeNull();
      expect(activeGoal?.description).toBe('Implement user authentication');
    });
  });

  describe('buildGoalAwarePrompt', () => {
    it('should use base prompt when no goal is active', () => {
      const messages = [
        createTestMessage('user', 'Hello'),
        createTestMessage('assistant', 'Hi there!'),
      ];
      const basePrompt = 'Summarize the following conversation:';

      const prompt = compression.buildGoalAwarePrompt(messages, null, basePrompt);

      expect(prompt).toContain(basePrompt);
      expect(prompt).toContain('USER: Hello');
      expect(prompt).toContain('ASSISTANT: Hi there!');
      expect(prompt).not.toContain('ACTIVE GOAL');
    });

    it('should include goal context when goal is active', () => {
      const goal = createTestGoal('Implement user authentication', {
        priority: 'high',
        subtasks: [
          {
            id: 'st1',
            description: 'Create auth service',
            status: 'completed',
            createdAt: new Date(),
            dependsOn: [],
            completedAt: new Date(),
          },
          {
            id: 'st2',
            description: 'Add JWT tokens',
            status: 'in-progress',
            createdAt: new Date(),
            dependsOn: [],
          },
        ],
      });

      const messages = [createTestMessage('user', 'Let\'s continue')];
      const basePrompt = 'Summarize:';

      const prompt = compression.buildGoalAwarePrompt(messages, goal, basePrompt);

      expect(prompt).toContain('ACTIVE GOAL CONTEXT');
      expect(prompt).toContain('Implement user authentication');
      expect(prompt).toContain('Priority: high');
      expect(prompt).toContain('Create auth service');
      expect(prompt).toContain('Add JWT tokens');
      expect(prompt).toContain('[CHECKPOINT]');
      expect(prompt).toContain('[DECISION]');
      expect(prompt).toContain('[ARTIFACT]');
    });

    it('should include locked decisions in prompt', () => {
      const goal = createTestGoal('Build API', {
        decisions: [
          {
            id: 'd1',
            description: 'Use REST instead of GraphQL',
            rationale: 'Simpler for our use case',
            alternatives: ['GraphQL'],
            timestamp: new Date(),
            locked: true,
          },
        ],
      });

      const messages = [createTestMessage('user', 'Continue')];
      const prompt = compression.buildGoalAwarePrompt(messages, goal, 'Summarize:');

      expect(prompt).toContain('Key Decisions (Locked)');
      expect(prompt).toContain('Use REST instead of GraphQL');
    });
  });

  describe('parseGoalMarkers', () => {
    it('should parse checkpoint markers', () => {
      const summary = `
        Some text here
        [CHECKPOINT] Implemented authentication - COMPLETED
        [CHECKPOINT] Added tests - IN-PROGRESS
        More text
      `;

      const updates = compression.parseGoalMarkers(summary);

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        type: 'checkpoint',
        description: 'Implemented authentication',
        status: 'completed',
      });
      expect(updates[1]).toEqual({
        type: 'checkpoint',
        description: 'Added tests',
        status: 'in-progress',
      });
    });

    it('should parse decision markers', () => {
      const summary = `
        [DECISION] Use JWT tokens - LOCKED
        [DECISION] Store sessions in Redis - UNLOCKED
      `;

      const updates = compression.parseGoalMarkers(summary);

      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({
        type: 'decision',
        decisionDescription: 'Use JWT tokens',
        locked: true,
      });
      expect(updates[1]).toEqual({
        type: 'decision',
        decisionDescription: 'Store sessions in Redis',
        locked: false,
      });
    });

    it('should parse artifact markers', () => {
      const summary = `
        [ARTIFACT] Created auth.ts
        [ARTIFACT] Modified user.service.ts
        [ARTIFACT] Deleted old-auth.ts
      `;

      const updates = compression.parseGoalMarkers(summary);

      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({
        type: 'artifact',
        action: 'created',
        path: 'auth.ts',
      });
      expect(updates[1]).toEqual({
        type: 'artifact',
        action: 'modified',
        path: 'user.service.ts',
      });
      expect(updates[2]).toEqual({
        type: 'artifact',
        action: 'deleted',
        path: 'old-auth.ts',
      });
    });

    it('should handle mixed markers', () => {
      const summary = `
        [CHECKPOINT] Setup complete - COMPLETED
        [DECISION] Use TypeScript - LOCKED
        [ARTIFACT] Created tsconfig.json
      `;

      const updates = compression.parseGoalMarkers(summary);

      expect(updates).toHaveLength(3);
      expect(updates[0].type).toBe('checkpoint');
      expect(updates[1].type).toBe('decision');
      expect(updates[2].type).toBe('artifact');
    });
  });

  describe('verifyGoalsNotCompressed', () => {
    it('should pass when no goal is active', () => {
      const messages = [
        createTestMessage('user', 'Hello'),
        createTestMessage('assistant', 'Hi'),
      ];

      expect(() => compression.verifyGoalsNotCompressed(messages, null)).not.toThrow();
    });

    it('should pass when messages do not contain goal information', () => {
      const goal = createTestGoal('Implement feature X');
      const messages = [
        createTestMessage('user', 'Let\'s work on something else'),
        createTestMessage('assistant', 'Sure, what would you like to do?'),
      ];

      expect(() => compression.verifyGoalsNotCompressed(messages, goal)).not.toThrow();
    });

    it('should throw when messages contain goal description', () => {
      const goal = createTestGoal('Implement user authentication');
      const messages = [
        createTestMessage('user', 'Let\'s continue with implement user authentication'),
      ];

      expect(() => compression.verifyGoalsNotCompressed(messages, goal)).toThrow(
        'Goal information found in messages to compress'
      );
    });

    it('should throw when messages contain goal markers', () => {
      const goal = createTestGoal('Build API');
      const messages = [
        createTestMessage('assistant', '[CHECKPOINT] API endpoint created - COMPLETED'),
      ];

      expect(() => compression.verifyGoalsNotCompressed(messages, goal)).toThrow(
        'Goal information found in messages to compress'
      );
    });

    it('should throw when messages contain goal context keywords', () => {
      const goal = createTestGoal('Build API');
      const messages = [
        createTestMessage('assistant', 'Based on the active goal: we should...'),
      ];

      expect(() => compression.verifyGoalsNotCompressed(messages, goal)).toThrow(
        'Goal information found in messages to compress'
      );
    });
  });

  describe('getPreservationStrategy', () => {
    it('should return false for all when no goal is active', () => {
      const strategy = compression.getPreservationStrategy(null);

      expect(strategy.preserveDecisions).toBe(false);
      expect(strategy.preserveCheckpoints).toBe(false);
      expect(strategy.preserveArtifacts).toBe(false);
      expect(strategy.preserveBlockers).toBe(false);
      expect(strategy.preserveTechnicalDetails).toBe(false);
    });

    it('should preserve all relevant info when goal is active', () => {
      const goal = createTestGoal('Build feature');
      const strategy = compression.getPreservationStrategy(goal);

      expect(strategy.preserveDecisions).toBe(true);
      expect(strategy.preserveCheckpoints).toBe(true);
      expect(strategy.preserveArtifacts).toBe(true);
      expect(strategy.preserveTechnicalDetails).toBe(true);
    });

    it('should preserve blockers when goal has blockers', () => {
      const goal = createTestGoal('Build feature', {
        blockers: [
          {
            id: 'b1',
            description: 'Waiting for API access',
            type: 'external-dependency',
            createdAt: new Date(),
          },
        ],
      });

      const strategy = compression.getPreservationStrategy(goal);
      expect(strategy.preserveBlockers).toBe(true);
    });
  });

  // ============================================================================
  // Property-Based Tests
  // ============================================================================

  describe('Property 27: Goal Never Compressed', () => {
    it('should never allow goal information in messages to be compressed', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // goalDescription
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }), // messages
          fc.boolean(), // includeGoalInfo
          (goalDescription, messageContents, includeGoalInfo) => {
            const goal = createTestGoal(goalDescription);
            goalManager.setActiveGoal(goal);

            // Create messages
            const messages = messageContents.map((content, index) => {
              let finalContent = content;
              
              // Conditionally inject goal information
              if (includeGoalInfo && index === 0) {
                finalContent = `${content} ${goalDescription}`;
              }

              return createTestMessage(
                index % 2 === 0 ? 'user' : 'assistant',
                finalContent
              );
            });

            // Property: If goal info is in messages, verification must fail
            if (includeGoalInfo) {
              expect(() => compression.verifyGoalsNotCompressed(messages, goal)).toThrow();
            } else {
              // Property: If no goal info in messages, verification must pass
              expect(() => compression.verifyGoalsNotCompressed(messages, goal)).not.toThrow();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should detect goal markers in any message', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          fc.constantFrom('[CHECKPOINT]', '[DECISION]', '[ARTIFACT]', 'active goal:', 'goal context:'),
          (messageContents, marker) => {
            const goal = createTestGoal('Test goal');
            
            // Ensure markerPosition is within bounds
            const markerPosition = messageContents.length > 0 ? 
              Math.floor(Math.random() * messageContents.length) : 0;
            
            // Create messages with marker at specific position
            const messages = messageContents.map((content, index) => {
              const finalContent = index === markerPosition ? `${content} ${marker}` : content;
              return createTestMessage(
                index % 2 === 0 ? 'user' : 'assistant',
                finalContent
              );
            });

            // Property: Any goal marker in messages must be detected
            expect(() => compression.verifyGoalsNotCompressed(messages, goal)).toThrow(
              'Goal information found in messages to compress'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow compression when no goal is active', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 20 }),
          (messageContents) => {
            const messages = messageContents.map((content, index) =>
              createTestMessage(index % 2 === 0 ? 'user' : 'assistant', content)
            );

            // Property: With no active goal, any messages can be compressed
            expect(() => compression.verifyGoalsNotCompressed(messages, null)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 28: Goal-Aware Summarization', () => {
    it('should always include goal context when goal is active', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // goalDescription
          fc.constantFrom('high', 'medium', 'low'), // priority
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 5 }), // subtasks
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }), // messages
          (goalDescription, priority, subtaskDescriptions, messageContents) => {
            const goal = createTestGoal(goalDescription, {
              priority: priority as GoalPriority,
              subtasks: subtaskDescriptions.map((desc) => ({
                id: `st-${Math.random()}`,
                description: desc,
                status: 'pending',
                createdAt: new Date(),
                dependsOn: [],
              })),
            });

            const messages = messageContents.map((content, index) =>
              createTestMessage(index % 2 === 0 ? 'user' : 'assistant', content)
            );

            const prompt = compression.buildGoalAwarePrompt(messages, goal, 'Summarize:');

            // Property: Prompt must include goal description
            expect(prompt).toContain(goalDescription);

            // Property: Prompt must include priority
            expect(prompt).toContain(`Priority: ${priority}`);

            // Property: Prompt must include all subtasks
            for (const subtask of subtaskDescriptions) {
              expect(prompt).toContain(subtask);
            }

            // Property: Prompt must include marker instructions
            expect(prompt).toContain('[CHECKPOINT]');
            expect(prompt).toContain('[DECISION]');
            expect(prompt).toContain('[ARTIFACT]');

            // Property: Prompt must include all messages
            for (const content of messageContents) {
              expect(prompt).toContain(content);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve goal-relevant information in summarization instructions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // goalDescription
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }), // messages
          fc.boolean(), // hasDecisions
          fc.boolean(), // hasCheckpoints
          fc.boolean(), // hasBlockers
          (goalDescription, messageContents, hasDecisions, hasCheckpoints, hasBlockers) => {
            const goal = createTestGoal(goalDescription, {
              decisions: hasDecisions
                ? [
                    {
                      id: 'd1',
                      description: 'Test decision',
                      rationale: 'Test rationale',
                      alternatives: [],
                      timestamp: new Date(),
                      locked: true,
                    },
                  ]
                : [],
              checkpoints: hasCheckpoints
                ? [
                    {
                      id: 'cp1',
                      goalId: 'g1',
                      description: 'Test checkpoint',
                      timestamp: new Date(),
                      state: { filesModified: [], testsAdded: [], decisionsLocked: [], metricsRecorded: {} },
                      assistantSummary: 'Test',
                    },
                  ]
                : [],
              blockers: hasBlockers
                ? [
                    {
                      id: 'b1',
                      description: 'Test blocker',
                      type: 'technical-issue',
                      createdAt: new Date(),
                    },
                  ]
                : [],
            });

            const messages = messageContents.map((content, index) =>
              createTestMessage(index % 2 === 0 ? 'user' : 'assistant', content)
            );

            const prompt = compression.buildGoalAwarePrompt(messages, goal, 'Summarize:');

            // Property: Prompt must include preservation instructions
            expect(prompt).toContain('Decisions made toward the goal');
            expect(prompt).toContain('Checkpoints completed');
            expect(prompt).toContain('Files created, modified, or deleted');
            expect(prompt).toContain('Blockers encountered');

            // Property: If goal has decisions, they must appear in prompt
            if (hasDecisions) {
              expect(prompt).toContain('Test decision');
            }

            // Property: If goal has checkpoints, they must appear in prompt
            if (hasCheckpoints) {
              expect(prompt).toContain('Test checkpoint');
            }

            // Property: If goal has blockers, they must appear in prompt
            if (hasBlockers) {
              expect(prompt).toContain('Test blocker');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should correctly parse and apply goal updates from summaries', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // goalDescription
          fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 5 }), // checkpointDescriptions
          fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 5 }), // decisionDescriptions
          fc.array(fc.string({ minLength: 5, maxLength: 30 }), { minLength: 1, maxLength: 5 }), // artifactPaths
          (goalDescription, checkpointDescs, decisionDescs, artifactPaths) => {
            const goal = createTestGoal(goalDescription);

            // Build summary with markers
            const summary = `
              ${checkpointDescs.map((desc) => `[CHECKPOINT] ${desc} - COMPLETED`).join('\n')}
              ${decisionDescs.map((desc) => `[DECISION] ${desc} - LOCKED`).join('\n')}
              ${artifactPaths.map((path) => `[ARTIFACT] Created ${path}`).join('\n')}
            `;

            const updates = compression.parseGoalMarkers(summary);

            // Property: Must parse all checkpoints
            const checkpointUpdates = updates.filter((u) => u.type === 'checkpoint');
            expect(checkpointUpdates.length).toBe(checkpointDescs.length);

            // Property: Must parse all decisions
            const decisionUpdates = updates.filter((u) => u.type === 'decision');
            expect(decisionUpdates.length).toBe(decisionDescs.length);

            // Property: Must parse all artifacts
            const artifactUpdates = updates.filter((u) => u.type === 'artifact');
            expect(artifactUpdates.length).toBe(artifactPaths.length);

            // Property: All updates must have correct type
            for (const update of updates) {
              expect(['checkpoint', 'decision', 'artifact']).toContain(update.type);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use base prompt when no goal is active', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 10, maxLength: 100 }), // basePrompt
          fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 10 }), // messages
          (basePrompt, messageContents) => {
            const messages = messageContents.map((content, index) =>
              createTestMessage(index % 2 === 0 ? 'user' : 'assistant', content)
            );

            const prompt = compression.buildGoalAwarePrompt(messages, null, basePrompt);

            // Property: Must include base prompt
            expect(prompt).toContain(basePrompt);

            // Property: Must include all messages
            for (const content of messageContents) {
              expect(prompt).toContain(content);
            }

            // Property: Must NOT include goal context
            expect(prompt).not.toContain('ACTIVE GOAL CONTEXT');
            expect(prompt).not.toContain('SUMMARIZATION INSTRUCTIONS');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
