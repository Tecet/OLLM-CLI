/**
 * Workflow Manager for Dynamic Prompt System
 * 
 * Manages predefined mode workflows for common development tasks.
 * Tracks workflow progress and handles step transitions.
 */

import { EventEmitter } from 'events';

import type { ModeType } from './ContextAnalyzer.js';
import type { PromptModeManager } from './PromptModeManager.js';

/**
 * Workflow step definition
 */
export interface WorkflowStep {
  /** Step identifier */
  id: string;
  /** Mode to use for this step */
  mode: ModeType;
  /** Human-readable description of the step */
  description: string;
  /** Optional instructions for this step */
  instructions?: string;
  /** Whether this step can be skipped */
  optional?: boolean;
}

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  /** Unique workflow identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this workflow does */
  description: string;
  /** Ordered list of workflow steps */
  steps: WorkflowStep[];
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Workflow execution state
 */
export interface WorkflowState {
  /** Current workflow being executed */
  workflow: WorkflowDefinition;
  /** Index of current step (0-based) */
  currentStepIndex: number;
  /** Timestamp when workflow started */
  startedAt: Date;
  /** Timestamp when workflow completed (if finished) */
  completedAt?: Date;
  /** Whether workflow is paused */
  paused: boolean;
  /** Steps that have been completed */
  completedSteps: string[];
  /** Steps that have been skipped */
  skippedSteps: string[];
}

/**
 * Workflow progress information
 */
export interface WorkflowProgress {
  /** Workflow name */
  workflowName: string;
  /** Current step number (1-based for display) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Current step description */
  currentStepDescription: string;
  /** Current mode */
  currentMode: ModeType;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Steps completed */
  stepsCompleted: number;
  /** Whether workflow is paused */
  paused: boolean;
}

/**
 * Predefined workflows for common tasks
 */
export const PREDEFINED_WORKFLOWS: Record<string, WorkflowDefinition> = {
  feature_development: {
    id: 'feature_development',
    name: 'Feature Development',
    description: 'Complete workflow for developing a new feature from planning to review',
    tags: ['development', 'feature'],
    steps: [
      {
        id: 'plan',
        mode: 'planning',
        description: 'Plan the feature implementation',
        instructions: 'Research requirements, design architecture, and create implementation plan'
      },
      {
        id: 'implement',
        mode: 'developer',
        description: 'Implement the feature',
        instructions: 'Write code following the plan and existing patterns'
      },
      {
        id: 'review',
        mode: 'reviewer',
        description: 'Review the implementation',
        instructions: 'Check code quality, test coverage, and best practices'
      },
      {
        id: 'refine',
        mode: 'developer',
        description: 'Address review feedback',
        instructions: 'Fix issues identified in review and improve code quality'
      }
    ]
  },
  
  bug_fix: {
    id: 'bug_fix',
    name: 'Bug Fix',
    description: 'Systematic workflow for debugging and fixing issues',
    tags: ['debugging', 'fix'],
    steps: [
      {
        id: 'debug',
        mode: 'debugger',
        description: 'Analyze and debug the issue',
        instructions: 'Reproduce the bug, identify root cause, and plan the fix'
      },
      {
        id: 'fix',
        mode: 'developer',
        description: 'Implement the fix',
        instructions: 'Apply the fix and add tests to prevent regression'
      },
      {
        id: 'verify',
        mode: 'reviewer',
        description: 'Verify the fix',
        instructions: 'Ensure the fix resolves the issue without side effects',
        optional: true
      }
    ]
  },
  
  security_hardening: {
    id: 'security_hardening',
    name: 'Security Hardening',
    description: 'Workflow for identifying and fixing security vulnerabilities',
    tags: ['security', 'audit'],
    steps: [
      {
        id: 'audit',
        mode: 'security',
        description: 'Perform security audit',
        instructions: 'Scan for vulnerabilities and identify security issues'
      },
      {
        id: 'fix',
        mode: 'developer',
        description: 'Fix security issues',
        instructions: 'Implement security fixes and apply best practices'
      },
      {
        id: 'verify',
        mode: 'security',
        description: 'Verify security improvements',
        instructions: 'Re-audit to confirm vulnerabilities are resolved'
      }
    ]
  },
  
  performance_optimization: {
    id: 'performance_optimization',
    name: 'Performance Optimization',
    description: 'Workflow for analyzing and improving performance',
    tags: ['performance', 'optimization'],
    steps: [
      {
        id: 'analyze',
        mode: 'performance',
        description: 'Analyze performance bottlenecks',
        instructions: 'Profile code, identify slow operations, and measure metrics'
      },
      {
        id: 'optimize',
        mode: 'developer',
        description: 'Implement optimizations',
        instructions: 'Apply performance improvements and refactor inefficient code'
      },
      {
        id: 'measure',
        mode: 'performance',
        description: 'Measure improvements',
        instructions: 'Benchmark optimizations and verify performance gains'
      }
    ]
  },
  
  learning_session: {
    id: 'learning_session',
    name: 'Learning Session',
    description: 'Workflow for learning a concept and applying it',
    tags: ['learning', 'education'],
    steps: [
      {
        id: 'learn',
        mode: 'teacher',
        description: 'Learn the concept',
        instructions: 'Understand the fundamentals and best practices'
      },
      {
        id: 'experiment',
        mode: 'prototype',
        description: 'Experiment with the concept',
        instructions: 'Build a quick prototype to validate understanding',
        optional: true
      },
      {
        id: 'implement',
        mode: 'developer',
        description: 'Implement production code',
        instructions: 'Apply the concept in production-quality code'
      }
    ]
  }
};

/**
 * Workflow Manager
 * 
 * Manages workflow execution, progress tracking, and step transitions.
 */
export class WorkflowManager extends EventEmitter {
  private currentWorkflow: WorkflowState | null = null;
  private readonly modeManager: PromptModeManager;
  
  constructor(modeManager: PromptModeManager) {
    super();
    this.modeManager = modeManager;
  }
  
  /**
   * Start a workflow
   */
  startWorkflow(workflowId: string): boolean {
    const workflow = PREDEFINED_WORKFLOWS[workflowId];
    if (!workflow) {
      return false;
    }
    
    // Stop current workflow if any
    if (this.currentWorkflow) {
      this.stopWorkflow();
    }
    
    // Initialize workflow state
    this.currentWorkflow = {
      workflow,
      currentStepIndex: 0,
      startedAt: new Date(),
      paused: false,
      completedSteps: [],
      skippedSteps: []
    };
    
    // Switch to first step's mode
    const firstStep = workflow.steps[0];
    if (firstStep) {
      this.modeManager.switchMode(firstStep.mode, 'manual');
    }
    
    this.emit('workflow-started', {
      workflowId: workflow.id,
      workflowName: workflow.name
    });
    
    this.emit('workflow-step-changed', this.getProgress());
    
    return true;
  }
  
  /**
   * Move to next step in workflow
   */
  nextStep(): boolean {
    if (!this.currentWorkflow) {
      return false;
    }
    
    const currentStep = this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex];
    if (currentStep) {
      this.currentWorkflow.completedSteps.push(currentStep.id);
    }
    
    // Move to next step
    this.currentWorkflow.currentStepIndex++;
    
    // Check if workflow is complete
    if (this.currentWorkflow.currentStepIndex >= this.currentWorkflow.workflow.steps.length) {
      this.completeWorkflow();
      return true;
    }
    
    // Switch to next step's mode
    const nextStep = this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex];
    if (nextStep) {
      this.modeManager.switchMode(nextStep.mode, 'manual');
      this.emit('workflow-step-changed', this.getProgress());
    }
    
    return true;
  }
  
  /**
   * Skip current step (if optional)
   */
  skipStep(): boolean {
    if (!this.currentWorkflow) {
      return false;
    }
    
    const currentStep = this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex];
    if (!currentStep || !currentStep.optional) {
      return false;
    }
    
    this.currentWorkflow.skippedSteps.push(currentStep.id);
    return this.nextStep();
  }
  
  /**
   * Go back to previous step
   */
  previousStep(): boolean {
    if (!this.currentWorkflow || this.currentWorkflow.currentStepIndex === 0) {
      return false;
    }
    
    // Remove from completed steps
    const previousStep = this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex - 1];
    if (previousStep) {
      const index = this.currentWorkflow.completedSteps.indexOf(previousStep.id);
      if (index > -1) {
        this.currentWorkflow.completedSteps.splice(index, 1);
      }
    }
    
    this.currentWorkflow.currentStepIndex--;
    
    // Switch to previous step's mode
    const step = this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex];
    if (step) {
      this.modeManager.switchMode(step.mode, 'manual');
      this.emit('workflow-step-changed', this.getProgress());
    }
    
    return true;
  }
  
  /**
   * Pause workflow
   */
  pauseWorkflow(): boolean {
    if (!this.currentWorkflow || this.currentWorkflow.paused) {
      return false;
    }
    
    this.currentWorkflow.paused = true;
    this.emit('workflow-paused', this.getProgress());
    return true;
  }
  
  /**
   * Resume workflow
   */
  resumeWorkflow(): boolean {
    if (!this.currentWorkflow || !this.currentWorkflow.paused) {
      return false;
    }
    
    this.currentWorkflow.paused = false;
    this.emit('workflow-resumed', this.getProgress());
    return true;
  }
  
  /**
   * Stop/exit workflow
   */
  stopWorkflow(): boolean {
    if (!this.currentWorkflow) {
      return false;
    }
    
    const workflowId = this.currentWorkflow.workflow.id;
    this.currentWorkflow = null;
    
    this.emit('workflow-stopped', { workflowId });
    return true;
  }
  
  /**
   * Complete workflow
   */
  private completeWorkflow(): void {
    if (!this.currentWorkflow) {
      return;
    }
    
    this.currentWorkflow.completedAt = new Date();
    
    this.emit('workflow-completed', {
      workflowId: this.currentWorkflow.workflow.id,
      workflowName: this.currentWorkflow.workflow.name,
      duration: this.currentWorkflow.completedAt.getTime() - this.currentWorkflow.startedAt.getTime(),
      stepsCompleted: this.currentWorkflow.completedSteps.length,
      stepsSkipped: this.currentWorkflow.skippedSteps.length
    });
    
    this.currentWorkflow = null;
  }
  
  /**
   * Get current workflow progress
   */
  getProgress(): WorkflowProgress | null {
    if (!this.currentWorkflow) {
      return null;
    }
    
    const currentStep = this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex];
    const totalSteps = this.currentWorkflow.workflow.steps.length;
    const stepsCompleted = this.currentWorkflow.completedSteps.length;
    
    return {
      workflowName: this.currentWorkflow.workflow.name,
      currentStep: this.currentWorkflow.currentStepIndex + 1,
      totalSteps,
      currentStepDescription: currentStep?.description || '',
      currentMode: currentStep?.mode || 'assistant',
      percentComplete: Math.round((stepsCompleted / totalSteps) * 100),
      stepsCompleted,
      paused: this.currentWorkflow.paused
    };
  }
  
  /**
   * Get current workflow state
   */
  getCurrentWorkflow(): WorkflowState | null {
    return this.currentWorkflow;
  }
  
  /**
   * Check if a workflow is active
   */
  isWorkflowActive(): boolean {
    return this.currentWorkflow !== null;
  }
  
  /**
   * Get list of available workflows
   */
  getAvailableWorkflows(): WorkflowDefinition[] {
    return Object.values(PREDEFINED_WORKFLOWS);
  }
  
  /**
   * Get workflow by ID
   */
  getWorkflow(workflowId: string): WorkflowDefinition | null {
    return PREDEFINED_WORKFLOWS[workflowId] || null;
  }
  
  /**
   * Get current step
   */
  getCurrentStep(): WorkflowStep | null {
    if (!this.currentWorkflow) {
      return null;
    }
    
    return this.currentWorkflow.workflow.steps[this.currentWorkflow.currentStepIndex] || null;
  }
}
