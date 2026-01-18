/**
 * Tests for ContextAnalyzer confidence calculation and suggested modes
 */

import { describe, it, expect } from 'vitest';
import { ContextAnalyzer } from '../ContextAnalyzer.js';
import type { Message } from '../../provider/types.js';

describe('ContextAnalyzer - Confidence Display', () => {
  const analyzer = new ContextAnalyzer();

  describe('calculateAllModeConfidences', () => {
    it('should calculate confidence scores for all modes', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'I need to implement a new feature' }]
        }
      ];

      const confidences = analyzer.calculateAllModeConfidences(messages);

      // Should have confidence for all modes
      expect(confidences).toHaveProperty('assistant');
      expect(confidences).toHaveProperty('planning');
      expect(confidences).toHaveProperty('developer');
      expect(confidences).toHaveProperty('tool');
      expect(confidences).toHaveProperty('debugger');
      expect(confidences).toHaveProperty('security');
      expect(confidences).toHaveProperty('reviewer');
      expect(confidences).toHaveProperty('performance');
      expect(confidences).toHaveProperty('prototype');
      expect(confidences).toHaveProperty('teacher');

      // All confidences should be between 0 and 1
      Object.values(confidences).forEach(confidence => {
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(1);
      });

      // Developer mode should have higher confidence for "implement" keyword
      expect(confidences.developer).toBeGreaterThan(confidences.assistant);
    });

    it('should return higher confidence for debugger mode with error messages', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'I have an error: TypeError: Cannot read property of undefined' }]
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'Let me help debug that error' }]
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'The error occurs when I try to access user.name' }]
        }
      ];

      const confidences = analyzer.calculateAllModeConfidences(messages);

      // Debugger mode should have higher confidence than developer
      expect(confidences.debugger).toBeGreaterThan(confidences.developer);
      expect(confidences.debugger).toBeGreaterThan(confidences.assistant);
    });

    it('should return higher confidence for security mode with security keywords', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Check for SQL injection vulnerabilities' }]
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'I will audit the security' }]
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Also check for XSS and CSRF vulnerabilities' }]
        }
      ];

      const confidences = analyzer.calculateAllModeConfidences(messages);

      // Security mode should have higher confidence than developer
      expect(confidences.security).toBeGreaterThan(confidences.developer);
      expect(confidences.security).toBeGreaterThan(confidences.assistant);
    });

    it('should return higher confidence for planning mode with planning keywords', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Let\'s design the architecture for this feature' }]
        },
        {
          role: 'assistant',
          parts: [{ type: 'text', text: 'I will help you plan' }]
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'We need to research the best approach and create a roadmap' }]
        }
      ];

      const confidences = analyzer.calculateAllModeConfidences(messages);

      // Planning mode should have higher confidence than assistant
      expect(confidences.planning).toBeGreaterThan(confidences.assistant);
      expect(confidences.planning).toBeGreaterThan(0);
    });
  });

  describe('getSuggestedModes', () => {
    it('should return top N suggested modes excluding current mode', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'I need to implement a feature and check for bugs' }]
        }
      ];

      const suggestions = analyzer.getSuggestedModes(messages, 'assistant', 3);

      // Should return 3 suggestions
      expect(suggestions).toHaveLength(3);

      // Should not include current mode (assistant)
      expect(suggestions.every(s => s.mode !== 'assistant')).toBe(true);

      // Each suggestion should have required fields
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('mode');
        expect(suggestion).toHaveProperty('icon');
        expect(suggestion).toHaveProperty('confidence');
        expect(suggestion).toHaveProperty('reason');
        expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
        expect(suggestion.confidence).toBeLessThanOrEqual(1);
        expect(suggestion.reason).toBeTruthy();
      });
    });

    it('should return suggestions sorted by confidence', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Debug this error and implement a fix' }]
        }
      ];

      const suggestions = analyzer.getSuggestedModes(messages, 'assistant', 5);

      // Suggestions should be sorted by confidence (descending)
      for (let i = 0; i < suggestions.length - 1; i++) {
        expect(suggestions[i].confidence).toBeGreaterThanOrEqual(suggestions[i + 1].confidence);
      }
    });

    it('should generate appropriate reasons for debugger mode', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Error: Cannot read property "user" of undefined' }]
        }
      ];

      const suggestions = analyzer.getSuggestedModes(messages, 'developer', 3);

      // Find debugger suggestion
      const debuggerSuggestion = suggestions.find(s => s.mode === 'debugger');
      
      if (debuggerSuggestion) {
        expect(debuggerSuggestion.reason).toContain('error');
      }
    });

    it('should generate appropriate reasons for security mode', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Check for security vulnerabilities in the authentication code' }]
        }
      ];

      const suggestions = analyzer.getSuggestedModes(messages, 'developer', 3);

      // Find security suggestion
      const securitySuggestion = suggestions.find(s => s.mode === 'security');
      
      if (securitySuggestion) {
        expect(securitySuggestion.reason).toMatch(/security|vulnerability/i);
      }
    });

    it('should generate appropriate reasons for planning mode', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Let\'s plan the architecture for this feature' }]
        }
      ];

      const suggestions = analyzer.getSuggestedModes(messages, 'developer', 3);

      // Find planning suggestion
      const planningSuggestion = suggestions.find(s => s.mode === 'planning');
      
      if (planningSuggestion) {
        expect(planningSuggestion.reason).toMatch(/plan/i);
      }
    });

    it('should include mode icons in suggestions', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Implement and test this feature' }]
        }
      ];

      const suggestions = analyzer.getSuggestedModes(messages, 'assistant', 3);

      // All suggestions should have icons
      suggestions.forEach(suggestion => {
        expect(suggestion.icon).toBeTruthy();
        expect(suggestion.icon.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty messages gracefully', () => {
      const messages: Message[] = [];

      const suggestions = analyzer.getSuggestedModes(messages, 'assistant', 3);

      // Should still return suggestions (based on zero confidence)
      expect(suggestions).toHaveLength(3);
      suggestions.forEach(suggestion => {
        expect(suggestion.confidence).toBe(0);
      });
    });

    it('should respect topN parameter', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Implement a feature' }]
        }
      ];

      const suggestions1 = analyzer.getSuggestedModes(messages, 'assistant', 1);
      expect(suggestions1).toHaveLength(1);

      const suggestions2 = analyzer.getSuggestedModes(messages, 'assistant', 2);
      expect(suggestions2).toHaveLength(2);

      const suggestions5 = analyzer.getSuggestedModes(messages, 'assistant', 5);
      expect(suggestions5).toHaveLength(5);
    });
  });

  describe('Mode-specific confidence calculations', () => {
    it('should boost developer mode confidence for code blocks', () => {
      const messagesWithCode: Message[] = [
        {
          role: 'user',
          parts: [{ 
            type: 'text', 
            text: 'Here is my code:\n```typescript\nfunction test() {}\n```' 
          }]
        }
      ];

      const messagesWithoutCode: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Here is my code' }]
        }
      ];

      const confidencesWithCode = analyzer.calculateAllModeConfidences(messagesWithCode);
      const confidencesWithoutCode = analyzer.calculateAllModeConfidences(messagesWithoutCode);

      // Developer mode should have higher confidence with code blocks
      expect(confidencesWithCode.developer).toBeGreaterThan(confidencesWithoutCode.developer);
    });

    it('should boost debugger mode confidence for error patterns', () => {
      const messagesWithError: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'ReferenceError: x is not defined' }]
        }
      ];

      const messagesWithoutError: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Check this code' }]
        }
      ];

      const confidencesWithError = analyzer.calculateAllModeConfidences(messagesWithError);
      const confidencesWithoutError = analyzer.calculateAllModeConfidences(messagesWithoutError);

      // Debugger mode should have higher confidence with error messages
      expect(confidencesWithError.debugger).toBeGreaterThan(confidencesWithoutError.debugger);
    });

    it('should boost security mode confidence for security patterns', () => {
      const messagesWithSecurity: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Check for XSS vulnerabilities' }]
        }
      ];

      const messagesWithoutSecurity: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Check this code' }]
        }
      ];

      const confidencesWithSecurity = analyzer.calculateAllModeConfidences(messagesWithSecurity);
      const confidencesWithoutSecurity = analyzer.calculateAllModeConfidences(messagesWithoutSecurity);

      // Security mode should have higher confidence with security keywords
      expect(confidencesWithSecurity.security).toBeGreaterThan(confidencesWithoutSecurity.security);
    });
  });
});
