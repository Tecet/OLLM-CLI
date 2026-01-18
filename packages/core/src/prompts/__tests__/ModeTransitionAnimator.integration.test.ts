/**
 * Integration Tests for Mode Transition Animator
 * 
 * Tests the integration between PromptModeManager and ModeTransitionAnimator,
 * ensuring animations are properly triggered and managed during mode transitions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptModeManager } from '../PromptModeManager.js';
import { ContextAnalyzer } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';
import { SystemPromptBuilder } from '../../context/SystemPromptBuilder.js';
import type { TransitionAnimation } from '../ModeTransitionAnimator.js';

describe('ModeTransitionAnimator Integration', () => {
  let modeManager: PromptModeManager;
  let contextAnalyzer: ContextAnalyzer;
  let promptRegistry: PromptRegistry;
  let promptBuilder: SystemPromptBuilder;

  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    promptBuilder = new SystemPromptBuilder(promptRegistry);
    contextAnalyzer = new ContextAnalyzer();
    modeManager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
  });

  describe('Animation Lifecycle', () => {
    it('should emit animation-started event on mode switch', () => {
      return new Promise<void>((resolve) => {
        modeManager.once('mode-animation-started', (animation: TransitionAnimation) => {
          expect(animation).toBeDefined();
          expect(animation.transition.from).toBe('assistant');
          expect(animation.transition.to).toBe('developer');
          expect(animation.state).toBe('active');
          resolve();
        });

        modeManager.switchMode('developer', 'manual', 0.8);
      });
    });

    it('should emit animation-completed event after duration', () => {
      vi.useFakeTimers();

      return new Promise<void>((resolve) => {
        let animation: TransitionAnimation | null = null;

        modeManager.once('mode-animation-started', (anim: TransitionAnimation) => {
          animation = anim;
        });

        modeManager.once('mode-animation-completed', (anim: TransitionAnimation) => {
          expect(anim).toBe(animation);
          expect(anim.state).toBe('complete');
          vi.useRealTimers();
          resolve();
        });

        modeManager.switchMode('developer', 'manual', 0.8);

        // Fast-forward time to complete animation
        vi.advanceTimersByTime(500);
      });
    });

    it('should emit mode-changed event alongside animation events', () => {
      return new Promise<void>((resolve) => {
        let animationStarted = false;
        let modeChanged = false;

        modeManager.once('mode-animation-started', () => {
          animationStarted = true;
          checkComplete();
        });

        modeManager.once('mode-changed', () => {
          modeChanged = true;
          checkComplete();
        });

        function checkComplete() {
          if (animationStarted && modeChanged) {
            resolve();
          }
        }

        modeManager.switchMode('developer', 'manual', 0.8);
      });
    });
  });

  describe('Animation Access', () => {
    it('should provide access to animator through getAnimator', () => {
      const animator = modeManager.getAnimator();
      expect(animator).toBeDefined();
      expect(typeof animator.createAnimation).toBe('function');
      expect(typeof animator.getActiveAnimations).toBe('function');
    });

    it('should track animations through animator', () => {
      const animator = modeManager.getAnimator();

      modeManager.switchMode('developer', 'manual', 0.8);

      const activeAnimations = animator.getActiveAnimations();
      expect(activeAnimations.length).toBeGreaterThan(0);
    });
  });

  describe('Multiple Transitions', () => {
    it('should handle rapid mode switches with separate animations', () => {
      vi.useFakeTimers();

      const animations: TransitionAnimation[] = [];

      modeManager.on('mode-animation-started', (animation: TransitionAnimation) => {
        animations.push(animation);
      });

      // Trigger multiple mode switches
      modeManager.switchMode('planning', 'manual', 0.8);
      vi.advanceTimersByTime(100);

      modeManager.switchMode('developer', 'manual', 0.8);
      vi.advanceTimersByTime(100);

      modeManager.switchMode('debugger', 'manual', 0.8);

      expect(animations.length).toBe(3);
      expect(animations[0].transition.to).toBe('planning');
      expect(animations[1].transition.to).toBe('developer');
      expect(animations[2].transition.to).toBe('debugger');

      vi.useRealTimers();
    });

    it('should cleanup completed animations over time', () => {
      vi.useFakeTimers();

      const animator = modeManager.getAnimator();

      modeManager.switchMode('developer', 'manual', 0.8);

      // Animation should be active
      expect(animator.getActiveAnimations().length).toBe(1);

      // Complete animation
      vi.advanceTimersByTime(500);

      // Animation should still exist briefly
      expect(animator.getActiveAnimations().length).toBe(1);

      // After cleanup delay, animation should be removed
      vi.advanceTimersByTime(2000);

      expect(animator.getActiveAnimations().length).toBe(0);

      vi.useRealTimers();
    });
  });

  describe('Animation Messages', () => {
    it('should generate appropriate messages for auto-switch', () => {
      return new Promise<void>((resolve) => {
        modeManager.once('mode-animation-started', (animation: TransitionAnimation) => {
          expect(animation.loadingMessage).toContain('Auto-switching');
          expect(animation.loadingMessage).toContain('Debugger mode');
          resolve();
        });

        modeManager.switchMode('debugger', 'auto', 0.85);
      });
    });

    it('should generate appropriate messages for manual switch', () => {
      return new Promise<void>((resolve) => {
        modeManager.once('mode-animation-started', (animation: TransitionAnimation) => {
          expect(animation.loadingMessage).toContain('Switching to');
          expect(animation.loadingMessage).toContain('Planning mode');
          resolve();
        });

        modeManager.switchMode('planning', 'manual', 0.8);
      });
    });

    it('should include mode icon in messages', () => {
      return new Promise<void>((resolve) => {
        modeManager.once('mode-animation-started', (animation: TransitionAnimation) => {
          expect(animation.icon).toBe('🐛');
          expect(animation.loadingMessage).toContain('🐛');
          resolve();
        });

        modeManager.switchMode('debugger', 'manual', 0.8);
      });
    });
  });

  describe('Focus Mode Integration', () => {
    it('should not create animation when mode switch is blocked', () => {
      const animator = modeManager.getAnimator();

      // Enable focus mode (use 1 minute = 60000ms)
      modeManager.switchMode('developer', 'explicit', 1.0);
      const focusManager = (modeManager as any).focusModeManager;
      focusManager.enableFocusMode('developer', 1);

      const animationsBefore = animator.getActiveAnimations().length;

      // Try to switch mode (should be blocked)
      modeManager.switchMode('planning', 'auto', 0.8);

      const animationsAfter = animator.getActiveAnimations().length;

      // No new animation should be created
      expect(animationsAfter).toBe(animationsBefore);
    });
  });

  describe('Animation Duration', () => {
    it('should use mode-specific animation durations', () => {
      return new Promise<void>((resolve) => {
        modeManager.once('mode-animation-started', (animation: TransitionAnimation) => {
          // Developer mode has 500ms duration
          expect(animation.duration).toBe(500);
          resolve();
        });

        modeManager.switchMode('developer', 'manual', 0.8);
      });
    });

    it('should use longer duration for specialized modes', () => {
      return new Promise<void>((resolve) => {
        modeManager.once('mode-animation-started', (animation: TransitionAnimation) => {
          // Debugger mode has 700ms duration
          expect(animation.duration).toBe(700);
          resolve();
        });

        modeManager.switchMode('debugger', 'manual', 0.8);
      });
    });
  });

  describe('Contextual Messages', () => {
    it('should generate contextual message for developer->debugger transition', () => {
      const animator = modeManager.getAnimator();

      // First switch to developer mode
      modeManager.switchMode('developer', 'manual', 0.8);

      // Then switch to debugger mode
      const transition = {
        from: 'developer' as const,
        to: 'debugger' as const,
        timestamp: new Date(),
        trigger: 'auto' as const,
        confidence: 0.85
      };

      const message = animator.generateContextualMessage(transition);
      expect(message).toContain('🐛 Error detected');
    });

    it('should generate contextual message for debugger->developer transition', () => {
      const animator = modeManager.getAnimator();

      const transition = {
        from: 'debugger' as const,
        to: 'developer' as const,
        timestamp: new Date(),
        trigger: 'auto' as const,
        confidence: 0.7
      };

      const message = animator.generateContextualMessage(transition);
      expect(message).toContain('✓ Bug analysis complete');
    });
  });
});
