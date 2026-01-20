/**
 * Tests for Workflow Manager
 * 
 * Tests workflow execution, progress tracking, step transitions,
 * and workflow state management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowManager, PREDEFINED_WORKFLOWS } from '../WorkflowManager.js';
import { PromptModeManager } from '../PromptModeManager.js';
import { ContextAnalyzer } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';
import { SystemPromptBuilder } from '../../context/SystemPromptBuilder.js';

describe('WorkflowManager', () => {
  let workflowManager: WorkflowManager;
  let modeManager: PromptModeManager;
  let promptRegistry: PromptRegistry;
  let promptBuilder: SystemPromptBuilder;
  let contextAnalyzer: ContextAnalyzer;

  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    promptBuilder = new SystemPromptBuilder(promptRegistry);
    contextAnalyzer = new ContextAnalyzer();
    modeManager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
    workflowManager = new WorkflowManager(modeManager);
  });

  describe('Workflow Initialization', () => {
    it('should initialize with no active workflow', () => {
      expect(workflowManager.isWorkflowActive()).toBe(false);
      expect(workflowManager.getCurrentWorkflow()).toBeNull();
      expect(workflowManager.getProgress()).toBeNull();
    });

    it('should provide list of available workflows', () => {
      const workflows = workflowManager.getAvailableWorkflows();
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows).toContainEqual(
        expect.objectContaining({
          id: 'feature_development',
          name: 'Feature Development'
        })
      );
    });

    it('should get workflow by ID', () => {
      const workflow = workflowManager.getWorkflow('feature_development');
      expect(workflow).toBeDefined();
      expect(workflow?.id).toBe('feature_development');
      expect(workflow?.name).toBe('Feature Development');
    });

    it('should return null for non-existent workflow', () => {
      const workflow = workflowManager.getWorkflow('non_existent');
      expect(workflow).toBeNull();
    });
  });

  describe('Starting Workflows', () => {
    it('should start a workflow', () => {
      const success = workflowManager.startWorkflow('feature_development');
      expect(success).toBe(true);
      expect(workflowManager.isWorkflowActive()).toBe(true);
    });

    it('should return false for non-existent workflow', () => {
      const success = workflowManager.startWorkflow('non_existent');
      expect(success).toBe(false);
      expect(workflowManager.isWorkflowActive()).toBe(false);
    });

    it('should emit workflow-started event', () => {
      const callback = vi.fn();
      workflowManager.on('workflow-started', callback);
      
      workflowManager.startWorkflow('feature_development');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'feature_development',
          workflowName: 'Feature Development'
        })
      );
    });

    it('should switch to first step mode', () => {
      const switchModeSpy = vi.spyOn(modeManager, 'switchMode');
      
      workflowManager.startWorkflow('feature_development');
      
      expect(switchModeSpy).toHaveBeenCalledWith('planning', 'manual');
    });

    it('should stop current workflow when starting new one', () => {
      workflowManager.startWorkflow('feature_development');
      expect(workflowManager.getCurrentWorkflow()?.workflow.id).toBe('feature_development');
      
      workflowManager.startWorkflow('bug_fix');
      expect(workflowManager.getCurrentWorkflow()?.workflow.id).toBe('bug_fix');
    });
  });

  describe('Workflow Progress', () => {
    beforeEach(() => {
      workflowManager.startWorkflow('feature_development');
    });

    it('should track current step', () => {
      const progress = workflowManager.getProgress();
      expect(progress).toBeDefined();
      expect(progress?.currentStep).toBe(1);
      expect(progress?.totalSteps).toBe(4);
    });

    it('should track workflow name', () => {
      const progress = workflowManager.getProgress();
      expect(progress?.workflowName).toBe('Feature Development');
    });

    it('should track current mode', () => {
      const progress = workflowManager.getProgress();
      expect(progress?.currentMode).toBe('planning');
    });

    it('should calculate percentage complete', () => {
      const progress = workflowManager.getProgress();
      expect(progress?.percentComplete).toBe(0);
      
      workflowManager.nextStep();
      const progress2 = workflowManager.getProgress();
      expect(progress2?.percentComplete).toBe(25);
    });

    it('should track steps completed', () => {
      const progress = workflowManager.getProgress();
      expect(progress?.stepsCompleted).toBe(0);
      
      workflowManager.nextStep();
      const progress2 = workflowManager.getProgress();
      expect(progress2?.stepsCompleted).toBe(1);
    });
  });

  describe('Step Transitions', () => {
    beforeEach(() => {
      workflowManager.startWorkflow('feature_development');
    });

    it('should move to next step', () => {
      const success = workflowManager.nextStep();
      expect(success).toBe(true);
      
      const progress = workflowManager.getProgress();
      expect(progress?.currentStep).toBe(2);
      expect(progress?.currentMode).toBe('developer');
    });

    it('should emit workflow-step-changed event', () => {
      const callback = vi.fn();
      workflowManager.on('workflow-step-changed', callback);
      
      workflowManager.nextStep();
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          currentStep: 2,
          currentMode: 'developer'
        })
      );
    });

    it('should complete workflow at last step', () => {
      const callback = vi.fn();
      workflowManager.on('workflow-completed', callback);
      
      // Move through all steps
      workflowManager.nextStep(); // Step 2
      workflowManager.nextStep(); // Step 3
      workflowManager.nextStep(); // Step 4
      workflowManager.nextStep(); // Complete
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(workflowManager.isWorkflowActive()).toBe(false);
    });

    it('should go back to previous step', () => {
      workflowManager.nextStep(); // Move to step 2
      
      const success = workflowManager.previousStep();
      expect(success).toBe(true);
      
      const progress = workflowManager.getProgress();
      expect(progress?.currentStep).toBe(1);
      expect(progress?.currentMode).toBe('planning');
    });

    it('should not go back from first step', () => {
      const success = workflowManager.previousStep();
      expect(success).toBe(false);
      
      const progress = workflowManager.getProgress();
      expect(progress?.currentStep).toBe(1);
    });

    it('should return false when no workflow active', () => {
      workflowManager.stopWorkflow();
      
      const success = workflowManager.nextStep();
      expect(success).toBe(false);
    });
  });

  describe('Skipping Steps', () => {
    it('should skip optional steps', () => {
      // Bug fix workflow has an optional review step (step 3)
      workflowManager.startWorkflow('bug_fix');
      workflowManager.nextStep(); // Move to fix step (step 2)
      workflowManager.nextStep(); // Move to review step (step 3, optional)
      
      const success = workflowManager.skipStep();
      expect(success).toBe(true);
      
      // Should complete workflow since review was last step
      expect(workflowManager.isWorkflowActive()).toBe(false);
    });

    it('should not skip required steps', () => {
      workflowManager.startWorkflow('feature_development');
      
      const success = workflowManager.skipStep();
      expect(success).toBe(false);
      
      const progress = workflowManager.getProgress();
      expect(progress?.currentStep).toBe(1);
    });

    it('should return false when no workflow active', () => {
      const success = workflowManager.skipStep();
      expect(success).toBe(false);
    });
  });

  describe('Pausing and Resuming', () => {
    beforeEach(() => {
      workflowManager.startWorkflow('feature_development');
    });

    it('should pause workflow', () => {
      const success = workflowManager.pauseWorkflow();
      expect(success).toBe(true);
      
      const progress = workflowManager.getProgress();
      expect(progress?.paused).toBe(true);
    });

    it('should emit workflow-paused event', () => {
      const callback = vi.fn();
      workflowManager.on('workflow-paused', callback);
      
      workflowManager.pauseWorkflow();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not pause already paused workflow', () => {
      workflowManager.pauseWorkflow();
      
      const success = workflowManager.pauseWorkflow();
      expect(success).toBe(false);
    });

    it('should resume paused workflow', () => {
      workflowManager.pauseWorkflow();
      
      const success = workflowManager.resumeWorkflow();
      expect(success).toBe(true);
      
      const progress = workflowManager.getProgress();
      expect(progress?.paused).toBe(false);
    });

    it('should emit workflow-resumed event', () => {
      workflowManager.pauseWorkflow();
      
      const callback = vi.fn();
      workflowManager.on('workflow-resumed', callback);
      
      workflowManager.resumeWorkflow();
      
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not resume non-paused workflow', () => {
      const success = workflowManager.resumeWorkflow();
      expect(success).toBe(false);
    });

    it('should return false when no workflow active', () => {
      workflowManager.stopWorkflow();
      
      const pauseSuccess = workflowManager.pauseWorkflow();
      expect(pauseSuccess).toBe(false);
      
      const resumeSuccess = workflowManager.resumeWorkflow();
      expect(resumeSuccess).toBe(false);
    });
  });

  describe('Stopping Workflows', () => {
    beforeEach(() => {
      workflowManager.startWorkflow('feature_development');
    });

    it('should stop workflow', () => {
      const success = workflowManager.stopWorkflow();
      expect(success).toBe(true);
      expect(workflowManager.isWorkflowActive()).toBe(false);
    });

    it('should emit workflow-stopped event', () => {
      const callback = vi.fn();
      workflowManager.on('workflow-stopped', callback);
      
      workflowManager.stopWorkflow();
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'feature_development'
        })
      );
    });

    it('should return false when no workflow active', () => {
      workflowManager.stopWorkflow();
      
      const success = workflowManager.stopWorkflow();
      expect(success).toBe(false);
    });
  });

  describe('Predefined Workflows', () => {
    it('should have feature_development workflow', () => {
      const workflow = PREDEFINED_WORKFLOWS.feature_development;
      expect(workflow).toBeDefined();
      expect(workflow.steps.length).toBe(4);
      expect(workflow.steps[0].mode).toBe('planning');
      expect(workflow.steps[1].mode).toBe('developer');
      expect(workflow.steps[2].mode).toBe('reviewer');
      expect(workflow.steps[3].mode).toBe('developer');
    });

    it('should have bug_fix workflow', () => {
      const workflow = PREDEFINED_WORKFLOWS.bug_fix;
      expect(workflow).toBeDefined();
      expect(workflow.steps.length).toBe(3);
      expect(workflow.steps[0].mode).toBe('debugger');
      expect(workflow.steps[1].mode).toBe('developer');
      expect(workflow.steps[2].mode).toBe('reviewer');
      expect(workflow.steps[2].optional).toBe(true);
    });

    it('should have security_hardening workflow', () => {
      const workflow = PREDEFINED_WORKFLOWS.security_hardening;
      expect(workflow).toBeDefined();
      expect(workflow.steps.length).toBe(3);
      expect(workflow.steps[0].mode).toBe('security');
      expect(workflow.steps[1].mode).toBe('developer');
      expect(workflow.steps[2].mode).toBe('security');
    });

    it('should have performance_optimization workflow', () => {
      const workflow = PREDEFINED_WORKFLOWS.performance_optimization;
      expect(workflow).toBeDefined();
      expect(workflow.steps.length).toBe(3);
      expect(workflow.steps[0].mode).toBe('performance');
      expect(workflow.steps[1].mode).toBe('developer');
      expect(workflow.steps[2].mode).toBe('performance');
    });

    it('should have learning_session workflow', () => {
      const workflow = PREDEFINED_WORKFLOWS.learning_session;
      expect(workflow).toBeDefined();
      expect(workflow.steps.length).toBe(3);
      expect(workflow.steps[0].mode).toBe('teacher');
      expect(workflow.steps[1].mode).toBe('prototype');
      expect(workflow.steps[1].optional).toBe(true);
      expect(workflow.steps[2].mode).toBe('developer');
    });
  });

  describe('Current Step', () => {
    it('should return null when no workflow active', () => {
      const step = workflowManager.getCurrentStep();
      expect(step).toBeNull();
    });

    it('should return current step', () => {
      workflowManager.startWorkflow('feature_development');
      
      const step = workflowManager.getCurrentStep();
      expect(step).toBeDefined();
      expect(step?.id).toBe('plan');
      expect(step?.mode).toBe('planning');
    });

    it('should update current step on transition', () => {
      workflowManager.startWorkflow('feature_development');
      workflowManager.nextStep();
      
      const step = workflowManager.getCurrentStep();
      expect(step?.id).toBe('implement');
      expect(step?.mode).toBe('developer');
    });
  });

  describe('Workflow State', () => {
    it('should track completed steps', () => {
      workflowManager.startWorkflow('feature_development');
      
      const state = workflowManager.getCurrentWorkflow();
      expect(state?.completedSteps).toEqual([]);
      
      workflowManager.nextStep();
      
      const state2 = workflowManager.getCurrentWorkflow();
      expect(state2?.completedSteps).toContain('plan');
    });

    it('should track skipped steps', () => {
      workflowManager.startWorkflow('bug_fix');
      workflowManager.nextStep(); // Move to fix step
      workflowManager.nextStep(); // Move to review step (optional)
      
      const state = workflowManager.getCurrentWorkflow();
      expect(state?.skippedSteps).toEqual([]);
      
      workflowManager.skipStep(); // Skip review step
      
      // Workflow completed, so state is null
      expect(workflowManager.getCurrentWorkflow()).toBeNull();
    });

    it('should track start time', () => {
      const beforeStart = new Date();
      workflowManager.startWorkflow('feature_development');
      const afterStart = new Date();
      
      const state = workflowManager.getCurrentWorkflow();
      expect(state?.startedAt.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
      expect(state?.startedAt.getTime()).toBeLessThanOrEqual(afterStart.getTime());
    });
  });
});
