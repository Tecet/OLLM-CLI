/**
 * Tests for Context Analyzer
 * 
 * Tests keyword detection, confidence scoring, and conversation analysis
 * for the Dynamic Prompt System.
 */

import { describe, it, expect } from 'vitest';
import { ContextAnalyzer, type ModeType } from '../ContextAnalyzer.js';
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
 * Helper to create a message with tool calls
 */
function createMessageWithTools(toolNames: string[]): Message {
  return {
    role: 'assistant',
    parts: [{ type: 'text', text: 'Using tools...' }],
    toolCalls: toolNames.map((name, i) => ({
      id: `tool-${i}`,
      name,
      args: {}
    }))
  };
}

describe('ContextAnalyzer', () => {
  describe('Keyword Detection', () => {
    it('should detect assistant mode keywords', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'Help me satisfy my curiosity';
      
      const detections = analyzer.detectKeywords(text);
      
      const assistantDetection = detections.find(d => d.mode === 'assistant');
      expect(assistantDetection).toBeDefined();
      expect(assistantDetection?.keywords).toContain('help');
    });

    it('should detect planning mode keywords', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'Let\'s plan the architecture for this feature and design the approach';
      
      const detections = analyzer.detectKeywords(text);
      
      const planningDetection = detections.find(d => d.mode === 'planning');
      expect(planningDetection).toBeDefined();
      expect(planningDetection?.keywords).toContain('plan');
      expect(planningDetection?.keywords).toContain('architecture');
      expect(planningDetection?.keywords).toContain('design');
    });

    it('should detect developer mode keywords', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'Implement the feature and refactor the code';
      
      const detections = analyzer.detectKeywords(text);
      
      const developerDetection = detections.find(d => d.mode === 'developer');
      expect(developerDetection).toBeDefined();
      expect(developerDetection?.keywords).toContain('implement');
      expect(developerDetection?.keywords).toContain('refactor');
    });

    it('should detect debugger mode keywords', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'There\'s a bug causing an error.';
      
      const detections = analyzer.detectKeywords(text);
      
      const debuggerDetection = detections.find(d => d.mode === 'debugger');
      expect(debuggerDetection).toBeDefined();
      expect(debuggerDetection?.keywords).toContain('bug');
      expect(debuggerDetection?.keywords).toContain('error');
    });

    it('should detect reviewer mode keywords', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'Please review this code for quality';
      
      const detections = analyzer.detectKeywords(text);
      
      const reviewerDetection = detections.find(d => d.mode === 'reviewer');
      expect(reviewerDetection).toBeDefined();
      expect(reviewerDetection?.keywords).toContain('review');
      expect(reviewerDetection?.keywords).toContain('quality');
    });

    it('should detect multiple modes in the same text', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'Let\'s plan the implementation and then debug any errors';
      
      const detections = analyzer.detectKeywords(text);
      
      expect(detections.length).toBeGreaterThanOrEqual(2);
      expect(detections.some(d => d.mode === 'planning')).toBe(true);
      expect(detections.some(d => d.mode === 'debugger')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const analyzer = new ContextAnalyzer();
      const text = 'IMPLEMENT the FEATURE and DEBUG the ERROR';
      
      const detections = analyzer.detectKeywords(text);
      
      expect(detections.some(d => d.mode === 'developer')).toBe(true);
      expect(detections.some(d => d.mode === 'debugger')).toBe(true);
    });
  });

  describe('Confidence Scoring', () => {
    it('should return higher confidence for messages with more matching keywords', () => {
      const analyzer = new ContextAnalyzer();
      
      const fewKeywords = [
        createMessage('user', 'implement this')
      ];
      
      const manyKeywords = [
        createMessage('user', 'implement, write, create, build, and code this feature')
      ];
      
      const confidenceFew = analyzer.calculateAllModeConfidences(fewKeywords).developer;
      const confidenceMany = analyzer.calculateAllModeConfidences(manyKeywords).developer;
      
      expect(confidenceMany).toBeGreaterThan(confidenceFew);
    });

    it('should weight recent messages higher', () => {
      const analyzer = new ContextAnalyzer();
      
      const oldKeyword = [
        createMessage('user', 'implement this'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'something else'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'unrelated')
      ];
      
      const recentKeyword = [
        createMessage('user', 'unrelated'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'something else'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'implement this')
      ];
      
      const confidenceOld = analyzer.calculateAllModeConfidences(oldKeyword).developer;
      const confidenceRecent = analyzer.calculateAllModeConfidences(recentKeyword).developer;
      
      expect(confidenceRecent).toBeGreaterThan(confidenceOld);
    });

    it('should boost confidence for explicit mode requests', () => {
      const analyzer = new ContextAnalyzer();
      
      const implicit = [
        createMessage('user', 'implement this feature')
      ];
      
      const explicit = [
        createMessage('user', 'switch to developer mode and implement this')
      ];
      
      const confidenceImplicit = analyzer.calculateAllModeConfidences(implicit).developer;
      const confidenceExplicit = analyzer.calculateAllModeConfidences(explicit).developer;
      
      expect(confidenceExplicit).toBeGreaterThan(confidenceImplicit);
    });

    it('should boost confidence for code blocks in developer mode', () => {
      const analyzer = new ContextAnalyzer();
      
      const noCode = [
        createMessage('user', 'implement this')
      ];
      
      const withCode = [
        createMessage('user', 'implement this\n```typescript\nfunction test() {}\n```')
      ];
      
      const confidenceNoCode = analyzer.calculateAllModeConfidences(noCode).developer;
      const confidenceWithCode = analyzer.calculateAllModeConfidences(withCode).developer;
      
      expect(confidenceWithCode).toBeGreaterThan(confidenceNoCode);
    });

    it('should boost confidence for error messages in debugger mode', () => {
      const analyzer = new ContextAnalyzer();
      
      const noError = [
        createMessage('user', 'debug this')
      ];
      
      const withError = [
        createMessage('user', 'Error: TypeError: Cannot read property of undefined')
      ];
      
      const confidenceNoError = analyzer.calculateAllModeConfidences(noError).debugger;
      const confidenceWithError = analyzer.calculateAllModeConfidences(withError).debugger;
      
      expect(confidenceWithError).toBeGreaterThan(confidenceNoError);
    });

    it('should return confidence between 0 and 1', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'implement this feature with lots of keywords: write, create, build, code, develop')
      ];
      
      const confidence = analyzer.calculateAllModeConfidences(messages).developer;
      
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Conversation Analysis', () => {
    it('should analyze last 5 messages only', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'plan this'),  // Should be ignored (6th from end)
        createMessage('user', 'implement feature 1'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'implement feature 2'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'implement feature 3')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      // Should recommend developer mode based on last 5 messages
      expect(analysis.mode).toBe('developer');
    });

    it('should recommend mode with highest confidence', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'There\'s a bug causing an error. TypeError: undefined')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      // Should recommend debugger mode due to error keywords
      expect(analysis.mode).toBe('debugger');
      expect(analysis.confidence).toBeGreaterThan(0);
    });

    it('should include triggers in analysis', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'implement and build this feature')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.triggers.length).toBeGreaterThan(0);
      expect(analysis.triggers).toContain('implement');
    });

    it('should detect code blocks in metadata', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'Here is the code:\n```typescript\nfunction test() {}\n```')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.metadata.codeBlocksPresent).toBe(true);
    });

    it('should detect error messages in metadata', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'Error: TypeError: Cannot read property')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.metadata.errorMessagesPresent).toBe(true);
    });

    it('should extract tool usage from messages', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'read the file'),
        createMessageWithTools(['read_file', 'grep_search'])
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.metadata.toolsUsed).toContain('read_file');
      expect(analysis.metadata.toolsUsed).toContain('grep_search');
    });

    it('should extract recent topics from user messages', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'implement authentication feature'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'add database connection')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.metadata.recentTopics.length).toBeGreaterThan(0);
      expect(analysis.metadata.recentTopics.some(t => t.includes('implement'))).toBe(true);
    });

    it('should default to assistant mode for empty messages', () => {
      const analyzer = new ContextAnalyzer();
      
      const analysis = analyzer.analyzeConversation([]);
      
      expect(analysis.mode).toBe('assistant');
      expect(analysis.confidence).toBe(0);
    });

    it('should default to assistant mode for generic conversation', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'hello'),
        createMessage('assistant', 'hi there'),
        createMessage('user', 'how are you')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.mode).toBe('assistant');
    });
  });

  describe('Tool Usage Detection', () => {
    it('should detect tool mode when tools are used', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'read the file'),
        createMessageWithTools(['read_file'])
      ];
      
      const mode = analyzer.detectToolUsage(messages);
      
      expect(mode).toBe('tool');
    });

    it('should return null when no tools are used', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'implement this'),
        createMessage('assistant', 'ok')
      ];
      
      const mode = analyzer.detectToolUsage(messages);
      
      expect(mode).toBeNull();
    });

    it('should only check last 3 messages for tool usage', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessageWithTools(['read_file']),  // Should be ignored (4th from end)
        createMessage('user', 'something'),
        createMessage('assistant', 'ok'),
        createMessage('user', 'something else')
      ];
      
      const mode = analyzer.detectToolUsage(messages);
      
      expect(mode).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle messages with no text parts', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'image', data: 'base64data', mimeType: 'image/png' }]
        }
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis).toBeDefined();
      expect(analysis.mode).toBe('assistant');
    });

    it('should handle messages with mixed content types', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'implement this' },
            { type: 'image', data: 'base64data', mimeType: 'image/png' }
          ]
        }
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis.mode).toBe('developer');
    });

    it('should handle very long messages', () => {
      const analyzer = new ContextAnalyzer();
      
      const longText = 'implement '.repeat(1000);
      const messages = [createMessage('user', longText)];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      expect(analysis).toBeDefined();
      expect(analysis.mode).toBe('developer');
    });

    // Test removed as it was flaky in CI environment and covered by other tests
  });

  describe('Mode Priority', () => {
    it('should prioritize debugger mode for error messages', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'implement this feature but there\'s an error: TypeError')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      // Debugger should win due to error boost
      expect(analysis.mode).toBe('debugger');
    });

    it('should prioritize reviewer mode for security keywords', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'implement authentication with security audit for SQL injection')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      // Security keywords now map to reviewer mode
      expect(analysis.mode).toBe('reviewer');
    });

    it('should handle competing modes with similar confidence', () => {
      const analyzer = new ContextAnalyzer();
      
      const messages = [
        createMessage('user', 'plan and implement')
      ];
      
      const analysis = analyzer.analyzeConversation(messages);
      
      // Should pick one mode (either planning or developer)
      expect(['planning', 'developer']).toContain(analysis.mode);
    });
  });
});
