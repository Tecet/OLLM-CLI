/**
 * Tests for hook adapter functions
 */

import { describe, it, expect } from 'vitest';
import type { Hook as CoreHook } from '@ollm/ollm-cli-core/hooks/types.js';
import {
  coreHookToUIHook,
  uiHookToCoreHook,
  validateUIHook,
  createDefaultUIHook,
  formDataToUIHook,
  uiHookToFormData,
} from '../adapter.js';
import type { UIHook } from '../types.js';

describe('Hook Adapter', () => {
  describe('coreHookToUIHook', () => {
    it('should convert a core hook with structured command to UI hook', () => {
      const coreHook: CoreHook = {
        id: 'test-hook',
        name: 'Test Hook',
        command: 'fileEdited:*.ts:askAgent:Review changes',
        args: [],
        source: 'user',
      };

      const uiHook = coreHookToUIHook(coreHook, true);

      expect(uiHook.id).toBe('test-hook');
      expect(uiHook.name).toBe('Test Hook');
      expect(uiHook.when.type).toBe('fileEdited');
      expect(uiHook.when.patterns).toEqual(['*.ts']);
      expect(uiHook.then.type).toBe('askAgent');
      expect(uiHook.then.prompt).toBe('Review changes');
      expect(uiHook.enabled).toBe(true);
      expect(uiHook.source).toBe('user');
    });

    it('should handle core hook without patterns', () => {
      const coreHook: CoreHook = {
        id: 'test-hook',
        name: 'Test Hook',
        command: 'promptSubmit:askAgent:Analyze prompt',
        args: [],
        source: 'builtin',
      };

      const uiHook = coreHookToUIHook(coreHook, false);

      expect(uiHook.when.type).toBe('promptSubmit');
      expect(uiHook.when.patterns).toBeUndefined();
      expect(uiHook.then.type).toBe('askAgent');
      expect(uiHook.then.prompt).toBe('Analyze prompt');
      expect(uiHook.enabled).toBe(false);
    });

    it('should handle runCommand action type', () => {
      const coreHook: CoreHook = {
        id: 'test-hook',
        name: 'Test Hook',
        command: 'fileEdited:*.js:runCommand:npm run lint',
        args: [],
        source: 'user',
      };

      const uiHook = coreHookToUIHook(coreHook);

      expect(uiHook.then.type).toBe('runCommand');
      expect(uiHook.then.command).toBe('npm run lint');
      expect(uiHook.then.prompt).toBeUndefined();
    });

    it('should handle legacy command format gracefully', () => {
      const coreHook: CoreHook = {
        id: 'legacy-hook',
        name: 'Legacy Hook',
        command: 'echo "Hello World"',
        args: [],
        source: 'user',
      };

      const uiHook = coreHookToUIHook(coreHook);

      // Should default to userTriggered and runCommand
      expect(uiHook.when.type).toBe('userTriggered');
      expect(uiHook.then.type).toBe('runCommand');
      expect(uiHook.then.command).toBe('echo "Hello World"');
    });
  });

  describe('uiHookToCoreHook', () => {
    it('should convert a UI hook to core hook', () => {
      const uiHook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        description: 'A test hook',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts', '*.tsx'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      const coreHook = uiHookToCoreHook(uiHook);

      expect(coreHook.id).toBe('test-hook');
      expect(coreHook.name).toBe('Test Hook');
      expect(coreHook.command).toBe('fileEdited:*.ts,*.tsx:askAgent:Review changes');
      expect(coreHook.source).toBe('user');
    });

    it('should handle hook without patterns', () => {
      const uiHook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'promptSubmit',
        },
        then: {
          type: 'askAgent',
          prompt: 'Analyze prompt',
        },
        enabled: true,
        trusted: true,
        source: 'builtin',
      };

      const coreHook = uiHookToCoreHook(uiHook);

      expect(coreHook.command).toBe('promptSubmit:askAgent:Analyze prompt');
    });

    it('should handle runCommand action', () => {
      const uiHook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'fileEdited',
          patterns: ['*.js'],
        },
        then: {
          type: 'runCommand',
          command: 'npm run lint',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      const coreHook = uiHookToCoreHook(uiHook);

      expect(coreHook.command).toBe('fileEdited:*.js:runCommand:npm run lint');
    });
  });

  describe('validateUIHook', () => {
    it('should validate a complete hook with no errors', () => {
      const hook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      const errors = validateUIHook(hook);
      expect(errors).toHaveLength(0);
    });

    it('should require hook name', () => {
      const hook: Partial<UIHook> = {
        name: '',
        when: { type: 'fileEdited', patterns: ['*.ts'] },
        then: { type: 'askAgent', prompt: 'Test' },
      };

      const errors = validateUIHook(hook);
      expect(errors).toContain('Hook name is required');
    });

    it('should require event type', () => {
      const hook: Partial<UIHook> = {
        name: 'Test',
        when: {} as any,
        then: { type: 'askAgent', prompt: 'Test' },
      };

      const errors = validateUIHook(hook);
      expect(errors).toContain('Hook event type is required');
    });

    it('should require action type', () => {
      const hook: Partial<UIHook> = {
        name: 'Test',
        when: { type: 'fileEdited', patterns: ['*.ts'] },
        then: {} as any,
      };

      const errors = validateUIHook(hook);
      expect(errors).toContain('Hook action type is required');
    });

    it('should require patterns for file events', () => {
      const hook: Partial<UIHook> = {
        name: 'Test',
        when: { type: 'fileEdited', patterns: [] },
        then: { type: 'askAgent', prompt: 'Test' },
      };

      const errors = validateUIHook(hook);
      expect(errors).toContain('File events require at least one file pattern');
    });

    it('should require prompt for askAgent action', () => {
      const hook: Partial<UIHook> = {
        name: 'Test',
        when: { type: 'promptSubmit' },
        then: { type: 'askAgent', prompt: '' },
      };

      const errors = validateUIHook(hook);
      expect(errors).toContain('askAgent action requires a prompt');
    });

    it('should require command for runCommand action', () => {
      const hook: Partial<UIHook> = {
        name: 'Test',
        when: { type: 'fileEdited', patterns: ['*.ts'] },
        then: { type: 'runCommand', command: '' },
      };

      const errors = validateUIHook(hook);
      expect(errors).toContain('runCommand action requires a command');
    });
  });

  describe('createDefaultUIHook', () => {
    it('should create a hook with default values', () => {
      const hook = createDefaultUIHook();

      expect(hook.id).toBeDefined();
      expect(hook.name).toBe('');
      expect(hook.version).toBe('1.0.0');
      expect(hook.when.type).toBe('fileEdited');
      expect(hook.then.type).toBe('askAgent');
      expect(hook.enabled).toBe(true);
      expect(hook.trusted).toBe(false);
      expect(hook.source).toBe('user');
    });

    it('should allow overriding default values', () => {
      const hook = createDefaultUIHook({
        name: 'Custom Hook',
        when: { type: 'promptSubmit' },
        enabled: false,
      });

      expect(hook.name).toBe('Custom Hook');
      expect(hook.when.type).toBe('promptSubmit');
      expect(hook.enabled).toBe(false);
    });
  });

  describe('formDataToUIHook', () => {
    it('should convert form data to UI hook', () => {
      const formData = {
        name: 'Test Hook',
        description: 'A test hook',
        eventType: 'fileEdited' as const,
        patterns: ['*.ts', '*.tsx'],
        actionType: 'askAgent' as const,
        promptOrCommand: 'Review changes',
      };

      const hook = formDataToUIHook(formData);

      expect(hook.name).toBe('Test Hook');
      expect(hook.description).toBe('A test hook');
      expect(hook.when.type).toBe('fileEdited');
      expect(hook.when.patterns).toEqual(['*.ts', '*.tsx']);
      expect(hook.then.type).toBe('askAgent');
      expect(hook.then.prompt).toBe('Review changes');
    });

    it('should handle runCommand action', () => {
      const formData = {
        name: 'Test Hook',
        description: '',
        eventType: 'fileEdited' as const,
        patterns: ['*.js'],
        actionType: 'runCommand' as const,
        promptOrCommand: 'npm run lint',
      };

      const hook = formDataToUIHook(formData);

      expect(hook.then.type).toBe('runCommand');
      expect(hook.then.command).toBe('npm run lint');
      expect(hook.then.prompt).toBeUndefined();
    });

    it('should handle empty patterns', () => {
      const formData = {
        name: 'Test Hook',
        description: '',
        eventType: 'promptSubmit' as const,
        patterns: [],
        actionType: 'askAgent' as const,
        promptOrCommand: 'Analyze',
      };

      const hook = formDataToUIHook(formData);

      expect(hook.when.patterns).toBeUndefined();
    });
  });

  describe('uiHookToFormData', () => {
    it('should convert UI hook to form data', () => {
      const hook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        description: 'A test hook',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts', '*.tsx'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      const formData = uiHookToFormData(hook);

      expect(formData.name).toBe('Test Hook');
      expect(formData.description).toBe('A test hook');
      expect(formData.eventType).toBe('fileEdited');
      expect(formData.patterns).toEqual(['*.ts', '*.tsx']);
      expect(formData.actionType).toBe('askAgent');
      expect(formData.promptOrCommand).toBe('Review changes');
    });

    it('should handle runCommand action', () => {
      const hook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'fileEdited',
          patterns: ['*.js'],
        },
        then: {
          type: 'runCommand',
          command: 'npm run lint',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      const formData = uiHookToFormData(hook);

      expect(formData.actionType).toBe('runCommand');
      expect(formData.promptOrCommand).toBe('npm run lint');
    });

    it('should handle missing description and patterns', () => {
      const hook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'promptSubmit',
        },
        then: {
          type: 'askAgent',
          prompt: 'Analyze',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      const formData = uiHookToFormData(hook);

      expect(formData.description).toBe('');
      expect(formData.patterns).toEqual([]);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through UI -> Core -> UI conversion', () => {
      const originalUIHook: UIHook = {
        id: 'test-hook',
        name: 'Test Hook',
        version: '1.0.0',
        description: 'A test hook',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts', '*.tsx'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
        enabled: true,
        trusted: true,
        source: 'user',
      };

      // Convert to core and back
      const coreHook = uiHookToCoreHook(originalUIHook);
      const convertedUIHook = coreHookToUIHook(coreHook, originalUIHook.enabled);

      expect(convertedUIHook.name).toBe(originalUIHook.name);
      expect(convertedUIHook.when.type).toBe(originalUIHook.when.type);
      expect(convertedUIHook.when.patterns).toEqual(originalUIHook.when.patterns);
      expect(convertedUIHook.then.type).toBe(originalUIHook.then.type);
      expect(convertedUIHook.then.prompt).toBe(originalUIHook.then.prompt);
      expect(convertedUIHook.source).toBe(originalUIHook.source);
    });
  });
});
