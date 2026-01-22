/**
 * Workflow Management Commands
 * 
 * Implements commands for managing mode workflows:
 * - /workflow start <workflow_id> - Start a workflow
 * - /workflow status - Show current workflow progress
 * - /workflow next - Move to next step
 * - /workflow prev - Go back to previous step
 * - /workflow skip - Skip current step (if optional)
 * - /workflow pause - Pause workflow
 * - /workflow resume - Resume paused workflow
 * - /workflow exit - Exit current workflow
 * - /workflow list - List available workflows
 */

import type { Command, CommandResult } from './types.js';
import { getGlobalContextManager } from '../features/context/ContextManagerContext.js';
import type { WorkflowDefinition, WorkflowProgress } from '@ollm/ollm-cli-core';

/**
 * Helper to check if context manager is available
 */
function ensureContextManager() {
  const manager = getGlobalContextManager();
  if (!manager) {
    throw new Error('Context Manager is not initialized. Please wait for the application to fully load.');
  }
  return manager;
}

/**
 * Helper to get workflow manager
 */
function ensureWorkflowManager() {
  const manager = ensureContextManager();
  const workflowManager = manager.getWorkflowManager();
  if (!workflowManager) {
    throw new Error('Workflow Manager is not initialized. Please wait for the application to fully load.');
  }
  return workflowManager;
}

/**
 * Mode icons for display
 */
const MODE_ICONS: Record<string, string> = {
  assistant: '💬',
  planning: '📋',
  developer: '👨‍💻',
  tool: '🔧',
  debugger: '🐛',
  security: '🔒',
  reviewer: '👀',
  performance: '⚡',
  prototype: '⚡🔬',
  teacher: '👨‍🏫',
};

/**
 * Get progress bar
 */
function getProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format workflow progress for display
 */
function formatProgress(progress: WorkflowProgress): string {
  const modeIcon = MODE_ICONS[progress.currentMode] || '📝';
  const pausedText = progress.paused ? ' ⏸ PAUSED' : '';
  
  return [
    `Workflow: ${progress.workflowName}${pausedText}`,
    `Progress: ${getProgressBar(progress.percentComplete)} ${progress.percentComplete}%`,
    `Step ${progress.currentStep}/${progress.totalSteps}: ${progress.currentStepDescription}`,
    `Mode: ${modeIcon} ${progress.currentMode}`,
    `Completed: ${progress.stepsCompleted}/${progress.totalSteps} steps`
  ].join('\n');
}

/**
 * Format workflow definition for display
 */
function formatWorkflowDefinition(workflow: WorkflowDefinition): string {
  const steps = workflow.steps.map((step: any, index: number) => {
    const modeIcon = MODE_ICONS[step.mode] || '📝';
    const optional = step.optional ? ' (optional)' : '';
    return `  ${index + 1}. ${modeIcon} ${step.mode}: ${step.description}${optional}`;
  }).join('\n');
  
  return [
    `${workflow.name} (${workflow.id})`,
    `  ${workflow.description}`,
    `  Steps:`,
    steps
  ].join('\n');
}

/**
 * /workflow start command - Start a workflow
 */
export const workflowStartCommand: Command = {
  name: '/workflow start',
  description: 'Start a workflow',
  usage: '/workflow start <workflow_id>',
  
  async execute(args: string[]): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (args.length === 0) {
        return {
          success: false,
          message: 'Please specify a workflow ID. Use /workflow list to see available workflows.'
        };
      }
      
      const workflowId = args[0];
      const success = workflowManager.startWorkflow(workflowId);
      
      if (!success) {
        return {
          success: false,
          message: `Workflow "${workflowId}" not found. Use /workflow list to see available workflows.`
        };
      }
      
      const progress = workflowManager.getProgress();
      if (!progress) {
        return {
          success: false,
          message: 'Failed to start workflow.'
        };
      }
      
      return {
        success: true,
        message: `Started workflow: ${progress.workflowName}\n\n${formatProgress(progress)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error starting workflow: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow status command - Show current workflow progress
 */
export const workflowStatusCommand: Command = {
  name: '/workflow status',
  description: 'Show current workflow progress',
  usage: '/workflow status',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      const progress = workflowManager.getProgress();
      
      if (!progress) {
        return {
          success: true,
          message: 'No active workflow. Use /workflow start <workflow_id> to start one.'
        };
      }
      
      return {
        success: true,
        message: formatProgress(progress)
      };
    } catch (error) {
      return {
        success: false,
        message: `Error getting workflow status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow next command - Move to next step
 */
export const workflowNextCommand: Command = {
  name: '/workflow next',
  description: 'Move to next workflow step',
  usage: '/workflow next',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (!workflowManager.isWorkflowActive()) {
        return {
          success: false,
          message: 'No active workflow. Use /workflow start <workflow_id> to start one.'
        };
      }
      
      const success = workflowManager.nextStep();
      
      if (!success) {
        return {
          success: false,
          message: 'Failed to move to next step.'
        };
      }
      
      const progress = workflowManager.getProgress();
      
      if (!progress) {
        return {
          success: true,
          message: 'Workflow completed! 🎉'
        };
      }
      
      return {
        success: true,
        message: `Moved to next step:\n\n${formatProgress(progress)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error moving to next step: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow prev command - Go back to previous step
 */
export const workflowPrevCommand: Command = {
  name: '/workflow prev',
  description: 'Go back to previous workflow step',
  usage: '/workflow prev',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (!workflowManager.isWorkflowActive()) {
        return {
          success: false,
          message: 'No active workflow. Use /workflow start <workflow_id> to start one.'
        };
      }
      
      const success = workflowManager.previousStep();
      
      if (!success) {
        return {
          success: false,
          message: 'Cannot go back. Already at first step.'
        };
      }
      
      const progress = workflowManager.getProgress();
      
      if (!progress) {
        return {
          success: false,
          message: 'Failed to get workflow progress.'
        };
      }
      
      return {
        success: true,
        message: `Moved to previous step:\n\n${formatProgress(progress)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error moving to previous step: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow skip command - Skip current step (if optional)
 */
export const workflowSkipCommand: Command = {
  name: '/workflow skip',
  description: 'Skip current workflow step (if optional)',
  usage: '/workflow skip',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (!workflowManager.isWorkflowActive()) {
        return {
          success: false,
          message: 'No active workflow. Use /workflow start <workflow_id> to start one.'
        };
      }
      
      const success = workflowManager.skipStep();
      
      if (!success) {
        return {
          success: false,
          message: 'Cannot skip this step. Only optional steps can be skipped.'
        };
      }
      
      const progress = workflowManager.getProgress();
      
      if (!progress) {
        return {
          success: true,
          message: 'Workflow completed! 🎉'
        };
      }
      
      return {
        success: true,
        message: `Skipped step. Moved to next:\n\n${formatProgress(progress)}`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error skipping step: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow pause command - Pause workflow
 */
export const workflowPauseCommand: Command = {
  name: '/workflow pause',
  description: 'Pause current workflow',
  usage: '/workflow pause',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (!workflowManager.isWorkflowActive()) {
        return {
          success: false,
          message: 'No active workflow. Use /workflow start <workflow_id> to start one.'
        };
      }
      
      const success = workflowManager.pauseWorkflow();
      
      if (!success) {
        return {
          success: false,
          message: 'Workflow is already paused.'
        };
      }
      
      return {
        success: true,
        message: 'Workflow paused. Use /workflow resume to continue.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error pausing workflow: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow resume command - Resume paused workflow
 */
export const workflowResumeCommand: Command = {
  name: '/workflow resume',
  description: 'Resume paused workflow',
  usage: '/workflow resume',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (!workflowManager.isWorkflowActive()) {
        return {
          success: false,
          message: 'No active workflow. Use /workflow start <workflow_id> to start one.'
        };
      }
      
      const success = workflowManager.resumeWorkflow();
      
      if (!success) {
        return {
          success: false,
          message: 'Workflow is not paused.'
        };
      }
      
      return {
        success: true,
        message: 'Workflow resumed.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error resuming workflow: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow exit command - Exit current workflow
 */
export const workflowExitCommand: Command = {
  name: '/workflow exit',
  description: 'Exit current workflow',
  usage: '/workflow exit',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      
      if (!workflowManager.isWorkflowActive()) {
        return {
          success: false,
          message: 'No active workflow.'
        };
      }
      
      const success = workflowManager.stopWorkflow();
      
      if (!success) {
        return {
          success: false,
          message: 'Failed to exit workflow.'
        };
      }
      
      return {
        success: true,
        message: 'Exited workflow.'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error exiting workflow: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow list command - List available workflows
 */
export const workflowListCommand: Command = {
  name: '/workflow list',
  description: 'List available workflows',
  usage: '/workflow list',
  
  async execute(): Promise<CommandResult> {
    try {
      const workflowManager = ensureWorkflowManager();
      const workflows = workflowManager.getAvailableWorkflows();
      
      if (workflows.length === 0) {
        return {
          success: true,
          message: 'No workflows available.'
        };
      }
      
      const workflowList = workflows.map(w => formatWorkflowDefinition(w)).join('\n\n');
      
      return {
        success: true,
        message: `Available Workflows:\n\n${workflowList}\n\nUse /workflow start <workflow_id> to start a workflow.`
      };
    } catch (error) {
      return {
        success: false,
        message: `Error listing workflows: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
};

/**
 * /workflow command - Main workflow command with subcommands
 */
export const workflowCommand: Command = {
  name: '/workflow',
  aliases: ['/wf'],
  description: 'Manage mode workflows (usage: /workflow [start|status|next|prev|skip|pause|resume|exit|list])',
  usage: '/workflow [subcommand]',
  
  async execute(args: string[]): Promise<CommandResult> {
    if (args.length === 0) {
      return {
        success: true,
        message: [
          'Workflow Commands:',
          '  /workflow start <workflow_id> - Start a workflow',
          '  /workflow status - Show current workflow progress',
          '  /workflow next - Move to next step',
          '  /workflow prev - Go back to previous step',
          '  /workflow skip - Skip current step (if optional)',
          '  /workflow pause - Pause workflow',
          '  /workflow resume - Resume paused workflow',
          '  /workflow exit - Exit current workflow',
          '  /workflow list - List available workflows',
          '',
          'Available Workflows:',
          '  - feature_development: Planning → Developer → Reviewer → Developer',
          '  - bug_fix: Debugger → Developer → Reviewer',
          '  - security_hardening: Security → Developer → Security',
          '  - performance_optimization: Performance → Developer → Performance',
          '  - learning_session: Teacher → Prototype → Developer'
        ].join('\n')
      };
    }
    
    const subcommand = args[0];
    const subArgs = args.slice(1);
    
    switch (subcommand) {
        case 'start':
          return workflowStartCommand.execute!(subArgs, {} as any);
        case 'status':
          return workflowStatusCommand.execute!(subArgs, {} as any);
        case 'next':
          return workflowNextCommand.execute!(subArgs, {} as any);
        case 'prev':
        case 'previous':
          return workflowPrevCommand.execute!(subArgs, {} as any);
        case 'skip':
          return workflowSkipCommand.execute!(subArgs, {} as any);
        case 'pause':
          return workflowPauseCommand.execute!(subArgs, {} as any);
        case 'resume':
          return workflowResumeCommand.execute!(subArgs, {} as any);
        case 'exit':
        case 'stop':
          return workflowExitCommand.execute!(subArgs, {} as any);
        case 'list':
          return workflowListCommand.execute!(subArgs, {} as any);
      default:
        return {
          success: false,
          message: `Unknown workflow subcommand: ${subcommand}. Use /workflow to see available commands.`
        };
    }
  }
};
