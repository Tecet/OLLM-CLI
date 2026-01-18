/**
 * Tests for Mode Transition Animator
 * 
 * Tests animation creation, state management, message generation,
 * and lifecycle management for mode transitions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModeTransitionAnimator, type TransitionAnimation } from '../ModeTransitionAnimator.js';
import type { ModeTransition } from '../PromptModeManager.js';

describe('ModeTransitionAnimator', () => {
  let animator: ModeTransitionAnimator;

  beforeEach(() => {
    animator = new ModeTransitionAnimator();
  });

  describe('Animation Creation', () => {
    it('should create animation for mode transition', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const animation = animator.createAnimation(transition);

      expect(animation).toBeDefined();
      expect(animation.id).toMatch(/^anim-\d+$/);
      expect(animation.transition).toBe(transition);
      expect(animation.state).toBe('pending');
      expect(animation.loadingMessage).toBeTruthy();
      expect(animation.completionMessage).toBeTruthy();
      expect(animation.icon).toBe('👨‍💻');
      expect(animation.duration).toBeGreaterThan(0);
    });

    it('should generate unique IDs for each animation', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const anim1 = animator.createAnimation(transition);
      const anim2 = animator.createAnimation(transition);

      expect(anim1.id).not.toBe(anim2.id);
    });

    it('should use correct icon for each mode', () => {
      const modes = [
        { mode: 'assistant', icon: '💬' },
        { mode: 'planning', icon: '📋' },
        { mode: 'developer', icon: '👨‍💻' },
        { mode: 'tool', icon: '🔧' },
        { mode: 'debugger', icon: '🐛' },
        { mode: 'security', icon: '🔒' },
        { mode: 'reviewer', icon: '👀' },
        { mode: 'performance', icon: '⚡' },
        { mode: 'prototype', icon: '🔬' },
        { mode: 'teacher', icon: '👨‍🏫' }
      ] as const;

      modes.forEach(({ mode, icon }) => {
        const transition: ModeTransition = {
          from: 'assistant',
          to: mode,
          timestamp: new Date(),
          trigger: 'manual',
          confidence: 0.8
        };

        const animation = animator.createAnimation(transition);
        expect(animation.icon).toBe(icon);
      });
    });
  });

  describe('Animation State Management', () => {
    it('should start animation', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const animation = animator.createAnimation(transition);
      expect(animation.state).toBe('pending');

      animator.startAnimation(animation.id);

      const updated = animator.getAnimation(animation.id);
      expect(updated?.state).toBe('active');
      expect(updated?.startTime).toBeDefined();
    });

    it('should complete animation', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const animation = animator.createAnimation(transition);
      animator.startAnimation(animation.id);
      animator.completeAnimation(animation.id);

      const updated = animator.getAnimation(animation.id);
      expect(updated?.state).toBe('complete');
      expect(updated?.endTime).toBeDefined();
    });

    it('should handle non-existent animation gracefully', () => {
      expect(() => animator.startAnimation('non-existent')).not.toThrow();
      expect(() => animator.completeAnimation('non-existent')).not.toThrow();
    });

    it('should auto-cleanup completed animations', () => {
      vi.useFakeTimers();

      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const animation = animator.createAnimation(transition);
      animator.completeAnimation(animation.id);

      expect(animator.getAnimation(animation.id)).toBeDefined();

      vi.advanceTimersByTime(2000);

      expect(animator.getAnimation(animation.id)).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe('Message Generation', () => {
    it('should generate loading message for explicit trigger', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'explicit',
        confidence: 1.0
      };

      const animation = animator.createAnimation(transition);
      expect(animation.loadingMessage).toContain('👨‍💻');
      expect(animation.loadingMessage).toContain('Activating development tools');
    });

    it('should generate loading message for manual trigger', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'debugger',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const animation = animator.createAnimation(transition);
      expect(animation.loadingMessage).toContain('Switching to Debugger mode');
    });

    it('should generate loading message for auto trigger', () => {
      const transition: ModeTransition = {
        from: 'developer',
        to: 'debugger',
        timestamp: new Date(),
        trigger: 'auto',
        confidence: 0.85
      };

      const animation = animator.createAnimation(transition);
      expect(animation.loadingMessage).toContain('Auto-switching to Debugger mode');
    });

    it('should generate completion message', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const animation = animator.createAnimation(transition);
      expect(animation.completionMessage).toContain('✓');
      expect(animation.completionMessage).toContain('Development mode ready');
    });

    it('should generate contextual messages for specific transitions', () => {
      const transitions = [
        {
          from: 'developer',
          to: 'debugger',
          expected: '🐛 Error detected'
        },
        {
          from: 'debugger',
          to: 'developer',
          expected: '✓ Bug analysis complete'
        },
        {
          from: 'developer',
          to: 'security',
          expected: '🔒 Security concern detected'
        },
        {
          from: 'assistant',
          to: 'planning',
          expected: '📋 Switching to planning mode'
        }
      ] as const;

      transitions.forEach(({ from, to, expected }) => {
        const transition: ModeTransition = {
          from,
          to,
          timestamp: new Date(),
          trigger: 'auto',
          confidence: 0.85
        };

        const message = animator.generateContextualMessage(transition);
        expect(message).toContain(expected);
      });
    });
  });

  describe('Active Animations', () => {
    it('should track active animations', () => {
      const transition1: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      const transition2: ModeTransition = {
        from: 'developer',
        to: 'debugger',
        timestamp: new Date(),
        trigger: 'auto',
        confidence: 0.85
      };

      animator.createAnimation(transition1);
      animator.createAnimation(transition2);

      const active = animator.getActiveAnimations();
      expect(active).toHaveLength(2);
    });

    it('should clear all animations', () => {
      const transition: ModeTransition = {
        from: 'assistant',
        to: 'developer',
        timestamp: new Date(),
        trigger: 'manual',
        confidence: 0.8
      };

      animator.createAnimation(transition);
      animator.createAnimation(transition);

      expect(animator.getActiveAnimations()).toHaveLength(2);

      animator.clearAnimations();

      expect(animator.getActiveAnimations()).toHaveLength(0);
    });
  });

  describe('Animation Duration', () => {
    it('should use mode-specific durations', () => {
      const modes = [
        { mode: 'assistant', duration: 500 },
        { mode: 'planning', duration: 600 },
        { mode: 'developer', duration: 500 },
        { mode: 'tool', duration: 400 },
        { mode: 'debugger', duration: 700 },
        { mode: 'security', duration: 700 }
      ] as const;

      modes.forEach(({ mode, duration }) => {
        const transition: ModeTransition = {
          from: 'assistant',
          to: mode,
          timestamp: new Date(),
          trigger: 'manual',
          confidence: 0.8
        };

        const animation = animator.createAnimation(transition);
        expect(animation.duration).toBe(duration);
      });
    });
  });
});
