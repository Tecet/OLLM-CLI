/**
 * Tests for hook system types
 */

import { describe, it, expect } from 'vitest';
import type { Hook, HookEvent, HookInput, HookOutput, HookSource } from '../types.js';

describe('Hook Types', () => {
  describe('Hook interface', () => {
    it('should allow creating a valid hook', () => {
      const hook: Hook = {
        id: 'test-hook-1',
        name: 'Test Hook',
        command: 'node',
        args: ['script.js'],
        source: 'user',
      };

      expect(hook.id).toBe('test-hook-1');
      expect(hook.name).toBe('Test Hook');
      expect(hook.command).toBe('node');
      expect(hook.args).toEqual(['script.js']);
      expect(hook.source).toBe('user');
    });

    it('should allow creating a hook without args', () => {
      const hook: Hook = {
        id: 'test-hook-2',
        name: 'Simple Hook',
        command: 'echo',
        source: 'builtin',
      };

      expect(hook.args).toBeUndefined();
    });

    it('should allow creating a hook with extension name', () => {
      const hook: Hook = {
        id: 'test-hook-3',
        name: 'Extension Hook',
        command: 'node',
        source: 'downloaded',
        extensionName: 'my-extension',
      };

      expect(hook.extensionName).toBe('my-extension');
    });
  });

  describe('HookEvent type', () => {
    it('should accept all valid event types', () => {
      const events: HookEvent[] = [
        'session_start',
        'session_end',
        'before_agent',
        'after_agent',
        'before_model',
        'after_model',
        'before_tool_selection',
        'before_tool',
        'after_tool',
      ];

      expect(events).toHaveLength(9);
    });
  });

  describe('HookSource type', () => {
    it('should accept all valid source types', () => {
      const sources: HookSource[] = ['builtin', 'user', 'workspace', 'downloaded'];

      expect(sources).toHaveLength(4);
    });
  });

  describe('HookInput interface', () => {
    it('should allow creating valid hook input', () => {
      const input: HookInput = {
        event: 'before_model',
        data: {
          sessionId: 'abc123',
          model: 'llama2',
          messages: [],
        },
      };

      expect(input.event).toBe('before_model');
      expect(input.data.sessionId).toBe('abc123');
    });
  });

  describe('HookOutput interface', () => {
    it('should allow creating minimal hook output', () => {
      const output: HookOutput = {
        continue: true,
      };

      expect(output.continue).toBe(true);
      expect(output.systemMessage).toBeUndefined();
      expect(output.data).toBeUndefined();
      expect(output.error).toBeUndefined();
    });

    it('should allow creating hook output with system message', () => {
      const output: HookOutput = {
        continue: true,
        systemMessage: 'Additional context',
      };

      expect(output.systemMessage).toBe('Additional context');
    });

    it('should allow creating hook output with data', () => {
      const output: HookOutput = {
        continue: true,
        data: {
          customField: 'value',
        },
      };

      expect(output.data?.customField).toBe('value');
    });

    it('should allow creating hook output with error', () => {
      const output: HookOutput = {
        continue: false,
        error: 'Hook failed',
      };

      expect(output.continue).toBe(false);
      expect(output.error).toBe('Hook failed');
    });
  });
});
