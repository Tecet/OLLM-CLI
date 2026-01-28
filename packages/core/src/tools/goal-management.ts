/**
 * Goal Management Tools
 *
 * Tools for LLMs to manage goals, checkpoints, and decisions autonomously.
 * For non-tool models, use structured text markers instead.
 */

import type { DeclarativeTool, ToolSchema, ToolContext } from './types.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { GoalManager } from '../context/goalTypes.js';

export type CreateGoalParams = {
  description: string;
  priority?: 'high' | 'medium' | 'low';
  subtasks?: string[];
};

export type CreateCheckpointParams = {
  description: string;
  filesModified?: string[];
  testsAdded?: string[];
  decisionsLocked?: string[];
};

export type CompleteGoalParams = {
  summary: string;
  artifacts?: string[];
};

export type RecordDecisionParams = {
  description: string;
  rationale: string;
  alternatives?: string[];
  locked?: boolean;
};

export type SwitchGoalParams = {
  action: 'pause' | 'resume' | 'new';
  goalId?: string;
  newGoalDescription?: string;
  priority?: 'high' | 'medium' | 'low';
};

/**
 * Create Goal Tool
 * Allows LLM to create a new goal
 */
export class CreateGoalTool implements DeclarativeTool {
  name = 'create_goal';
  displayName = 'Create Goal';

  schema: ToolSchema = {
    name: 'create_goal',
    description: 'Create a new goal or task to work on. Use this when starting a new objective.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'Clear description of the goal (e.g., "Fix authentication bug in login.ts")',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Priority level (default: medium)',
        },
        subtasks: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of subtasks to complete this goal',
        },
      },
      required: ['description'],
    },
  };

  async execute(
    params: { description: string; priority?: 'high' | 'medium' | 'low'; subtasks?: string[] },
    context: ToolContext
  ) {
    const goalManager = context.goalManager;
    if (!goalManager) {
      throw new Error('Goal manager not available');
    }

    const goal = goalManager.createGoal(
      params.description,
      params.priority || 'medium',
      params.subtasks
    );

    return {
      llmContent: `Created goal: ${goal.description} (ID: ${goal.id})`,
      returnDisplay: `✓ Goal created: ${goal.description}`,
    };
  }
}

/**
 * Create Checkpoint Tool
 * Allows LLM to mark progress on current goal
 */
export class CreateCheckpointTool implements DeclarativeTool {
  name = 'create_checkpoint';
  displayName = 'Create Checkpoint';

  schema: ToolSchema = {
    name: 'create_checkpoint',
    description:
      'Mark progress on the current goal. Use this when you complete a significant step.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'What was accomplished (e.g., "Fixed login validation")',
        },
        filesModified: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files that were modified',
        },
        testsAdded: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tests that were added',
        },
        decisionsLocked: {
          type: 'array',
          items: { type: 'string' },
          description: 'Decisions that should not be changed',
        },
      },
      required: ['description'],
    },
  };

  async execute(
    params: {
      description: string;
      filesModified?: string[];
      testsAdded?: string[];
      decisionsLocked?: string[];
    },
    context: ToolContext
  ) {
    const goalManager = context.goalManager;
    if (!goalManager) {
      throw new Error('Goal manager not available');
    }

    const activeGoal = goalManager.getActiveGoal();
    if (!activeGoal) {
      throw new Error('No active goal. Create a goal first.');
    }

    const checkpoint = goalManager.createCheckpoint(activeGoal.id, params.description, {
      filesModified: params.filesModified || [],
      testsAdded: params.testsAdded || [],
      decisionsLocked: params.decisionsLocked || [],
      metricsRecorded: {},
    });

    return {
      llmContent: `Checkpoint created: ${checkpoint.description}`,
      returnDisplay: `✓ Checkpoint: ${checkpoint.description}`,
    };
  }
}

/**
 * Complete Goal Tool
 * Allows LLM to mark current goal as completed
 */
export class CompleteGoalTool implements DeclarativeTool {
  name = 'complete_goal';
  displayName = 'Complete Goal';

  schema: ToolSchema = {
    name: 'complete_goal',
    description:
      'Mark the current goal as completed. Use this when the goal is fully accomplished.',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Summary of what was accomplished',
        },
        artifacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files created or modified during this goal',
        },
      },
      required: ['summary'],
    },
  };

  async execute(params: { summary: string; artifacts?: string[] }, context: ToolContext) {
    const goalManager = context.goalManager;
    if (!goalManager) {
      throw new Error('Goal manager not available');
    }

    const activeGoal = goalManager.getActiveGoal();
    if (!activeGoal) {
      throw new Error('No active goal to complete');
    }

    goalManager.completeGoal(activeGoal.id, params.summary);

    return {
      llmContent: `Goal completed: ${activeGoal.description}\nSummary: ${params.summary}`,
      returnDisplay: `✓ Goal completed: ${activeGoal.description}`,
    };
  }
}

/**
 * Record Decision Tool
 * Allows LLM to record important decisions
 */
export class RecordDecisionTool implements DeclarativeTool {
  name = 'record_decision';
  displayName = 'Record Decision';

  schema: ToolSchema = {
    name: 'record_decision',
    description: 'Record an important decision made during the current goal.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'The decision made (e.g., "Use JWT for authentication")',
        },
        rationale: {
          type: 'string',
          description: 'Why this decision was made',
        },
        alternatives: {
          type: 'array',
          items: { type: 'string' },
          description: 'Alternative approaches that were considered',
        },
        locked: {
          type: 'boolean',
          description: 'If true, this decision should not be changed (default: false)',
        },
      },
      required: ['description', 'rationale'],
    },
  };

  async execute(
    params: {
      description: string;
      rationale: string;
      alternatives?: string[];
      locked?: boolean;
    },
    context: ToolContext
  ) {
    const goalManager = context.goalManager;
    if (!goalManager) {
      throw new Error('Goal manager not available');
    }

    const activeGoal = goalManager.getActiveGoal();
    if (!activeGoal) {
      throw new Error('No active goal. Create a goal first.');
    }

    const decision = goalManager.recordDecision(
      activeGoal.id,
      params.description,
      params.rationale,
      params.alternatives || []
    );

    if (params.locked) {
      goalManager.lockDecision(activeGoal.id, decision.id);
    }

    return {
      llmContent: `Decision recorded: ${decision.description}\nRationale: ${decision.rationale}${decision.locked ? ' (LOCKED)' : ''}`,
      returnDisplay: `✓ Decision: ${decision.description}${decision.locked ? ' 🔒' : ''}`,
    };
  }
}

/**
 * Switch Goal Tool
 * Allows LLM to pause/resume/create goals
 */
export class SwitchGoalTool implements DeclarativeTool {
  name = 'switch_goal';
  displayName = 'Switch Goal';

  schema: ToolSchema = {
    name: 'switch_goal',
    description: 'Pause current goal, resume a paused goal, or create a new goal.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['pause', 'resume', 'new'],
          description: 'Action to perform',
        },
        goalId: {
          type: 'string',
          description: 'Goal ID (required for resume action)',
        },
        newGoalDescription: {
          type: 'string',
          description: 'Description for new goal (required for new action)',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Priority for new goal (default: medium)',
        },
      },
      required: ['action'],
    },
  };

  async execute(
    params: {
      action: 'pause' | 'resume' | 'new';
      goalId?: string;
      newGoalDescription?: string;
      priority?: 'high' | 'medium' | 'low';
    },
    context: ToolContext
  ) {
    const goalManager = context.goalManager;
    if (!goalManager) {
      throw new Error('Goal manager not available');
    }

    switch (params.action) {
      case 'pause': {
        const activeGoal = goalManager.getActiveGoal();
        if (!activeGoal) {
          throw new Error('No active goal to pause');
        }
        goalManager.pauseGoal(activeGoal.id);
        return {
          llmContent: `Paused goal: ${activeGoal.description}`,
          returnDisplay: `⏸ Paused: ${activeGoal.description}`,
        };
      }

      case 'resume': {
        if (!params.goalId) {
          throw new Error('goalId required for resume action');
        }
        const goal = goalManager.getGoalById(params.goalId);
        if (!goal) {
          throw new Error(`Goal not found: ${params.goalId}`);
        }
        goalManager.resumeGoal(params.goalId);
        return {
          llmContent: `Resumed goal: ${goal.description}`,
          returnDisplay: `▶ Resumed: ${goal.description}`,
        };
      }

      case 'new': {
        if (!params.newGoalDescription) {
          throw new Error('newGoalDescription required for new action');
        }
        const goal = goalManager.createGoal(params.newGoalDescription, params.priority || 'medium');
        return {
          llmContent: `Created new goal: ${goal.description}`,
          returnDisplay: `✓ New goal: ${goal.description}`,
        };
      }

      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }
}

/**
 * All goal management tools
 */
export const GOAL_MANAGEMENT_TOOLS = [
  CreateGoalTool,
  CreateCheckpointTool,
  CompleteGoalTool,
  RecordDecisionTool,
  SwitchGoalTool,
];
