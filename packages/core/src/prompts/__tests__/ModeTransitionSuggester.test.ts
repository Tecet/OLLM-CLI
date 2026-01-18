/**
 * Tests for Mode Transition Suggester
 * 
 * Tests suggestion logic, confidence scoring, auto-switch behavior,
 * and preference management for the Dynamic Prompt System.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ModeTransitionSuggester, type ConversationContext } from '../ModeTransitionSuggester.js';
import type { ModeType } from '../ContextAnalyzer.js';
import type { Message } from '../../provider/types.js';

/**
 * Helper to create a text message
 */
function createMessage(role: 'user' | 'assistant' | 'system', text: string): Message {
  return {
    role,
    parts: [{ type: 'text', text }]
  };
}

/**
 * Helper to create a basic conversation context
 */
function createContext(
  currentMode: ModeType,
  messages: Message[],
  overrides?: Partial<ConversationContext>
): ConversationContext {
  return {
    messages,
    currentMode,
    timeInMode: 60000, // 1 minute
    errorCount: 0,
    hasTechnicalTerms: false,
    planComplete: false,
    hasSecurityKeywords: false,
    hasPerformanceKeywords: false,
    hasReviewKeywords: false,
    codeBlockCount: 0,
    ...overrides
  };
}

describe('ModeTransitionSuggester', () => {
  let suggester: ModeTransitionSuggester;

  beforeEach(() => {
    suggester = new ModeTransitionSuggester();
  });

  describe('Debugger Mode Suggestions', () => {
    it('should suggest debugger mode when multiple errors detected', () => {
      const context = createContext('developer', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('debugger');
      expect(suggestion?.currentMode).toBe('developer');
      expect(suggestion?.confidence).toBe(0.90);
      expect(suggestion?.autoSwitch).toBe(true);
      expect(suggestion?.reason).toContain('Multiple errors detected');
    });

    it('should suggest debugger mode with lower confidence for single error', () => {
      const context = createContext('developer', [], {
        errorCount: 1
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('debugger');
      expect(suggestion?.confidence).toBe(0.75);
      expect(suggestion?.autoSwitch).toBe(false);
    });

    it('should not suggest debugger mode from non-developer modes', () => {
      const context = createContext('planning', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('debugger');
    });
  });

  describe('Security Mode Suggestions', () => {
    it('should suggest security mode when security keywords detected', () => {
      const context = createContext('developer', [], {
        hasSecurityKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('security');
      expect(suggestion?.confidence).toBe(0.85);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('Security concerns detected');
    });

    it('should not suggest security mode when already in security mode', () => {
      const context = createContext('security', [], {
        hasSecurityKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('security');
    });
  });

  describe('Performance Mode Suggestions', () => {
    it('should suggest performance mode when performance keywords detected', () => {
      const context = createContext('developer', [], {
        hasPerformanceKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('performance');
      expect(suggestion?.confidence).toBe(0.80);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('Performance concerns detected');
    });

    it('should not suggest performance mode when already in performance mode', () => {
      const context = createContext('performance', [], {
        hasPerformanceKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('performance');
    });
  });

  describe('Reviewer Mode Suggestions', () => {
    it('should suggest reviewer mode when review keywords detected', () => {
      const context = createContext('developer', [], {
        hasReviewKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('reviewer');
      expect(suggestion?.confidence).toBe(0.80);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('Code review requested');
    });

    it('should only suggest reviewer mode from developer mode', () => {
      const context = createContext('planning', [], {
        hasReviewKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('reviewer');
    });
  });

  describe('Planning Mode Suggestions', () => {
    it('should suggest planning mode from assistant mode with technical terms', () => {
      const context = createContext('assistant', [], {
        hasTechnicalTerms: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('planning');
      expect(suggestion?.currentMode).toBe('assistant');
      expect(suggestion?.confidence).toBe(0.75);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('plan an implementation');
    });

    it('should not suggest planning mode from non-assistant modes', () => {
      const context = createContext('developer', [], {
        hasTechnicalTerms: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('planning');
    });
  });

  describe('Developer Mode Suggestions', () => {
    it('should suggest developer mode when plan is complete', () => {
      const context = createContext('planning', [], {
        planComplete: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('developer');
      expect(suggestion?.currentMode).toBe('planning');
      expect(suggestion?.confidence).toBe(0.85);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('plan is complete');
    });

    it('should suggest developer mode after extended planning time', () => {
      const context = createContext('planning', [], {
        timeInMode: 400000 // > 5 minutes
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('developer');
      expect(suggestion?.confidence).toBe(0.70);
      expect(suggestion?.autoSwitch).toBe(false);
    });

    it('should only suggest developer mode from planning mode', () => {
      const context = createContext('assistant', [], {
        planComplete: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('developer');
    });
  });

  describe('Prototype Mode Suggestions', () => {
    it('should suggest prototype mode when experiment keywords detected', () => {
      const messages = [
        createMessage('user', 'Let\'s do a quick experiment to test this idea')
      ];
      const context = createContext('developer', messages);

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('prototype');
      expect(suggestion?.confidence).toBe(0.75);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('Quick experiment detected');
    });

    it('should not suggest prototype mode when already in prototype mode', () => {
      const messages = [
        createMessage('user', 'Let\'s prototype this')
      ];
      const context = createContext('prototype', messages);

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('prototype');
    });
  });

  describe('Teacher Mode Suggestions', () => {
    it('should suggest teacher mode for learning questions', () => {
      const messages = [
        createMessage('user', 'Can you explain how async/await works?')
      ];
      const context = createContext('assistant', messages);

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
      expect(suggestion?.suggestedMode).toBe('teacher');
      expect(suggestion?.confidence).toBe(0.70);
      expect(suggestion?.autoSwitch).toBe(false);
      expect(suggestion?.reason).toContain('Learning question detected');
    });

    it('should only suggest teacher mode from assistant mode', () => {
      const messages = [
        createMessage('user', 'Teach me about TypeScript')
      ];
      const context = createContext('developer', messages);

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).not.toBe('teacher');
    });
  });

  describe('Preference Management', () => {
    it('should respect disabled suggestions', () => {
      suggester.disableSuggestionForMode('debugger');

      const context = createContext('developer', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeNull();
    });

    it('should respect disabled transitions', () => {
      suggester.disableTransition('developer', 'debugger');

      const context = createContext('developer', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeNull();
    });

    it('should respect minimum confidence threshold', () => {
      suggester.updatePreferences({ minConfidence: 0.90 });

      const context = createContext('developer', [], {
        errorCount: 1 // Confidence 0.75
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeNull();
    });

    it('should allow suggestions when enabled', () => {
      suggester.updatePreferences({ enabled: true });

      const context = createContext('developer', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeDefined();
    });

    it('should block all suggestions when disabled', () => {
      suggester.updatePreferences({ enabled: false });

      const context = createContext('developer', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion).toBeNull();
    });

    it('should get current preferences', () => {
      suggester.updatePreferences({
        minConfidence: 0.80,
        enabled: true
      });

      const prefs = suggester.getPreferences();

      expect(prefs.minConfidence).toBe(0.80);
      expect(prefs.enabled).toBe(true);
    });
  });

  describe('Context Building', () => {
    it('should build context from messages', () => {
      const messages = [
        createMessage('user', 'There is an error in the code'),
        createMessage('assistant', 'Let me help debug that'),
        createMessage('user', 'TypeError: Cannot read property')
      ];

      const context = suggester.buildContext(
        messages,
        'developer',
        new Date(Date.now() - 60000)
      );

      expect(context.currentMode).toBe('developer');
      expect(context.errorCount).toBeGreaterThan(0);
      expect(context.messages.length).toBe(3);
    });

    it('should detect technical terms', () => {
      const messages = [
        createMessage('user', 'Implement a React component with TypeScript')
      ];

      const context = suggester.buildContext(
        messages,
        'assistant',
        new Date()
      );

      expect(context.hasTechnicalTerms).toBe(true);
    });

    it('should detect plan completion', () => {
      const messages = [
        createMessage('user', 'The plan is complete, ready to implement')
      ];

      const context = suggester.buildContext(
        messages,
        'planning',
        new Date()
      );

      expect(context.planComplete).toBe(true);
    });

    it('should detect security keywords', () => {
      const messages = [
        createMessage('user', 'Check for SQL injection vulnerability')
      ];

      const context = suggester.buildContext(
        messages,
        'developer',
        new Date()
      );

      expect(context.hasSecurityKeywords).toBe(true);
    });

    it('should detect performance keywords', () => {
      const messages = [
        createMessage('user', 'This is too slow, need to optimize performance')
      ];

      const context = suggester.buildContext(
        messages,
        'developer',
        new Date()
      );

      expect(context.hasPerformanceKeywords).toBe(true);
    });

    it('should detect review keywords', () => {
      const messages = [
        createMessage('user', 'Please review this code for quality')
      ];

      const context = suggester.buildContext(
        messages,
        'developer',
        new Date()
      );

      expect(context.hasReviewKeywords).toBe(true);
    });

    it('should count code blocks', () => {
      const messages = [
        createMessage('user', 'Here is the code:\n```typescript\nconst x = 1;\n```')
      ];

      const context = suggester.buildContext(
        messages,
        'developer',
        new Date()
      );

      expect(context.codeBlockCount).toBe(1);
    });

    it('should calculate time in mode', () => {
      const modeEntryTime = new Date(Date.now() - 120000); // 2 minutes ago

      const context = suggester.buildContext(
        [],
        'planning',
        modeEntryTime
      );

      expect(context.timeInMode).toBeGreaterThanOrEqual(120000);
    });

    it('should limit to last 5 messages', () => {
      const messages = Array.from({ length: 10 }, (_, i) =>
        createMessage('user', `Message ${i}`)
      );

      const context = suggester.buildContext(
        messages,
        'developer',
        new Date()
      );

      expect(context.messages.length).toBe(5);
    });
  });

  describe('Suggestion Priority', () => {
    it('should prioritize debugger over other suggestions', () => {
      const context = createContext('developer', [], {
        errorCount: 3,
        hasSecurityKeywords: true,
        hasPerformanceKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).toBe('debugger');
    });

    it('should prioritize security over performance', () => {
      const context = createContext('developer', [], {
        hasSecurityKeywords: true,
        hasPerformanceKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).toBe('security');
    });

    it('should prioritize performance over reviewer', () => {
      const context = createContext('developer', [], {
        hasPerformanceKeywords: true,
        hasReviewKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.suggestedMode).toBe('performance');
    });
  });

  describe('Auto-Switch Behavior', () => {
    it('should auto-switch for multiple errors', () => {
      const context = createContext('developer', [], {
        errorCount: 3
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.autoSwitch).toBe(true);
    });

    it('should ask user for single error', () => {
      const context = createContext('developer', [], {
        errorCount: 1
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.autoSwitch).toBe(false);
    });

    it('should ask user for security suggestions', () => {
      const context = createContext('developer', [], {
        hasSecurityKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.autoSwitch).toBe(false);
    });

    it('should ask user for performance suggestions', () => {
      const context = createContext('developer', [], {
        hasPerformanceKeywords: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.autoSwitch).toBe(false);
    });

    it('should ask user for mode transitions', () => {
      const context = createContext('planning', [], {
        planComplete: true
      });

      const suggestion = suggester.suggestTransition(context);

      expect(suggestion?.autoSwitch).toBe(false);
    });
  });
});
