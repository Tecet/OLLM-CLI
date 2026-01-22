/**
 * Mode Transition Animator
 * 
 * Generates transition messages and manages animation state for mode switches.
 * Provides visual feedback to users when modes change.
 */

import type { ModeType } from './ContextAnalyzer.js';
import type { ModeTransition } from './PromptModeManager.js';

/**
 * Animation data for a mode transition
 */
export interface TransitionAnimation {
  /** Unique ID for this animation */
  id: string;
  /** The mode transition being animated */
  transition: ModeTransition;
  /** Loading message to display */
  loadingMessage: string;
  /** Completion message to display */
  completionMessage: string;
  /** Icon to display during transition */
  icon: string;
  /** Duration of animation in milliseconds */
  duration: number;
  /** Current state of the animation */
  state: 'pending' | 'active' | 'complete';
  /** Timestamp when animation started */
  startTime?: Date;
  /** Timestamp when animation completed */
  endTime?: Date;
}

/**
 * Mode-specific animation configuration
 */
interface ModeAnimationConfig {
  icon: string;
  loadingVerb: string;
  completionVerb: string;
  duration: number;
}

import { MODE_METADATA } from './templates/modes/index.js';

/**
 * Animation configurations for each mode
 *
 * Use a relaxed string-keyed record because we don't enumerate every
 * `ModeType` member in this literal; callers may index by `ModeType`.
 */
const MODE_ANIMATIONS: Record<ModeType, ModeAnimationConfig> = {
  assistant: {
    icon: MODE_METADATA.assistant.icon,
    loadingVerb: 'Switching to conversation mode',
    completionVerb: 'Ready for conversation',
    duration: 500
  },
  planning: {
    icon: MODE_METADATA.planning.icon,
    loadingVerb: 'Entering planning mode',
    completionVerb: 'Planning mode active',
    duration: 600
  },
  developer: {
    icon: MODE_METADATA.developer.icon,
    loadingVerb: 'Activating development tools',
    completionVerb: 'Development mode ready',
    duration: 500
  },
  debugger: {
    icon: MODE_METADATA.debugger.icon,
    loadingVerb: 'Analyzing error patterns',
    completionVerb: 'Debugger mode active',
    duration: 700
  },
  reviewer: {
    icon: MODE_METADATA.reviewer.icon,
    loadingVerb: 'Loading review checklist',
    completionVerb: 'Review mode active',
    duration: 600
  },
  tool: {
    icon: MODE_METADATA.tool.icon,
    loadingVerb: 'Activating tool expert mode',
    completionVerb: 'Tool expert mode active',
    duration: 500
  },
  security: {
    icon: MODE_METADATA.security.icon,
    loadingVerb: 'Initializing security audit',
    completionVerb: 'Security mode active',
    duration: 700
  },
  performance: {
    icon: MODE_METADATA.performance.icon,
    loadingVerb: 'Starting performance analysis',
    completionVerb: 'Performance mode active',
    duration: 600
  },
  prototype: {
    icon: MODE_METADATA.prototype.icon,
    loadingVerb: 'Enabling rapid prototyping',
    completionVerb: 'Prototyper mode active',
    duration: 500
  },
  teacher: {
    icon: MODE_METADATA.teacher.icon,
    loadingVerb: 'Activating teacher persona',
    completionVerb: 'Teacher mode active',
    duration: 500
  }
};

/**
 * Mode Transition Animator
 * 
 * Manages animation state and generates transition messages for mode switches.
 */
export class ModeTransitionAnimator {
  private activeAnimations: Map<string, TransitionAnimation> = new Map();
  private animationIdCounter = 0;
  
  /**
   * Create a new transition animation
   * 
   * @param transition - The mode transition to animate
   * @returns Animation data for the transition
   */
  createAnimation(transition: ModeTransition): TransitionAnimation {
    const id = `anim-${++this.animationIdCounter}`;
    const config = MODE_ANIMATIONS[transition.to];
    
    const animation: TransitionAnimation = {
      id,
      transition,
      loadingMessage: this.generateLoadingMessage(transition, config),
      completionMessage: this.generateCompletionMessage(transition, config),
      icon: config.icon,
      duration: config.duration,
      state: 'pending'
    };
    
    this.activeAnimations.set(id, animation);
    
    return animation;
  }
  
  /**
   * Start an animation
   * 
   * @param animationId - ID of the animation to start
   */
  startAnimation(animationId: string): void {
    const animation = this.activeAnimations.get(animationId);
    if (!animation) {
      return;
    }
    
    animation.state = 'active';
    animation.startTime = new Date();
  }
  
  /**
   * Complete an animation
   * 
   * @param animationId - ID of the animation to complete
   */
  completeAnimation(animationId: string): void {
    const animation = this.activeAnimations.get(animationId);
    if (!animation) {
      return;
    }
    
    animation.state = 'complete';
    animation.endTime = new Date();
    
    // Clean up after a delay
    setTimeout(() => {
      this.activeAnimations.delete(animationId);
    }, 2000);
  }
  
  /**
   * Get an active animation by ID
   * 
   * @param animationId - ID of the animation
   * @returns The animation data, or undefined if not found
   */
  getAnimation(animationId: string): TransitionAnimation | undefined {
    return this.activeAnimations.get(animationId);
  }
  
  /**
   * Get all active animations
   * 
   * @returns Array of active animations
   */
  getActiveAnimations(): TransitionAnimation[] {
    return Array.from(this.activeAnimations.values());
  }
  
  /**
   * Clear all animations
   */
  clearAnimations(): void {
    this.activeAnimations.clear();
  }
  
  /**
   * Generate loading message for a transition
   * 
   * @param transition - The mode transition
   * @param config - Animation configuration for the target mode
   * @returns Loading message string
   */
  private generateLoadingMessage(
    transition: ModeTransition,
    config: ModeAnimationConfig
  ): string {
    const { trigger, to } = transition;
    
    // Different messages based on trigger type
    switch (trigger) {
      case 'explicit':
        return `${config.icon} ${config.loadingVerb}...`;
      
      case 'manual':
        return `${config.icon} Switching to ${this.getModeName(to)} mode...`;
      
      case 'auto':
        return `${config.icon} Auto-switching to ${this.getModeName(to)} mode...`;
      
      case 'tool':
        return `${config.icon} ${config.loadingVerb} for tool execution...`;
      
      default:
        return `${config.icon} ${config.loadingVerb}...`;
    }
  }
  
  /**
   * Generate completion message for a transition
   * 
   * @param transition - The mode transition
   * @param config - Animation configuration for the target mode
   * @returns Completion message string
   */
  private generateCompletionMessage(
    transition: ModeTransition,
    config: ModeAnimationConfig
  ): string {
    return `✓ ${config.completionVerb}`;
  }
  
  /**
   * Get human-readable mode name
   * 
   * @param mode - The mode type
   * @returns Human-readable mode name
   */
  private getModeName(mode: ModeType): string {
    const names: Record<ModeType, string> = {
      assistant: 'Assistant',
      planning: 'Planning',
      developer: 'Developer',
      debugger: 'Debugger',
      reviewer: 'Reviewer',
      tool: 'Tool Expert',
      security: 'Security',
      performance: 'Performance',
      prototype: 'Prototyper',
      teacher: 'Teacher'
    };

    return names[mode] || mode;
  }
  
  /**
   * Generate a mode-specific transition message with context
   * 
   * @param transition - The mode transition
   * @returns Contextual transition message
   */
  generateContextualMessage(transition: ModeTransition): string {
    const { from, to, trigger, confidence } = transition;
    
    // Special messages for specific transitions
    const transitionKey = `${from}->${to}`;
    const contextualMessages: Record<string, string> = {
      'developer->debugger': `${MODE_METADATA.debugger.icon} Error detected. Switching to systematic debugging...`,
      'debugger->developer': '✓ Bug analysis complete. Returning to development...',
      'developer->reviewer': `${MODE_METADATA.reviewer.icon} Code ready for review. Switching to review mode...`,
      'reviewer->developer': '✓ Review complete. Returning to development...',
      'assistant->planning': `${MODE_METADATA.planning.icon} Switching to planning mode for design work...`,
      'planning->developer': `${MODE_METADATA.developer.icon} Plan complete. Ready to implement...`,
      'developer->planning': `${MODE_METADATA.planning.icon} Stepping back to planning mode...`
    };
    
    if (transitionKey in contextualMessages) {
      return contextualMessages[transitionKey];
    }
    
    // Default message based on trigger
    const config = MODE_ANIMATIONS[to];
    if (trigger === 'auto' && confidence > 0.8) {
      return `${config.icon} High confidence detected (${(confidence * 100).toFixed(0)}%). ${config.loadingVerb}...`;
    }
    
    return this.generateLoadingMessage(transition, config);
  }
}
