/**
 * Unit tests for HookRegistry
 * Tests hook registration, retrieval, unregistration, and organization
 *
 * Feature: v0.1.0 Debugging and Polishing
 * Task: 39. Add Hook System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { HookRegistry } from '../hookRegistry.js';
import { createTestHook } from './test-helpers.js';

import type { Hook, HookEvent } from '../types.js';

describe('HookRegistry - Unit Tests', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe('Hook Registration', () => {
    it('should register a hook for an event', () => {
      const hook = createTestHook({ id: 'test-hook', name: 'Test Hook' });

      registry.registerHook('before_model', hook);

      const hooks = registry.getHooksForEvent('before_model');
      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toBe(hook);
    });

    it('should register multiple hooks for the same event', () => {
      const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
      const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });
      const hook3 = createTestHook({ id: 'hook-3', name: 'Hook 3' });

      registry.registerHook('before_model', hook1);
      registry.registerHook('before_model', hook2);
      registry.registerHook('before_model', hook3);

      const hooks = registry.getHooksForEvent('before_model');
      expect(hooks).toHaveLength(3);
      expect(hooks[0]).toBe(hook1);
      expect(hooks[1]).toBe(hook2);
      expect(hooks[2]).toBe(hook3);
    });

    it('should register hooks for different events', () => {
      const hook1 = createTestHook({ id: 'hook-1' });
      const hook2 = createTestHook({ id: 'hook-2' });

      registry.registerHook('before_model', hook1);
      registry.registerHook('after_model', hook2);

      expect(registry.getHooksForEvent('before_model')).toHaveLength(1);
      expect(registry.getHooksForEvent('after_model')).toHaveLength(1);
    });

    it('should preserve registration order', () => {
      const hooks: Hook[] = [];
      for (let i = 0; i < 10; i++) {
        const hook = createTestHook({ id: `hook-${i}`, name: `Hook ${i}` });
        hooks.push(hook);
        registry.registerHook('before_model', hook);
      }

      const registered = registry.getHooksForEvent('before_model');
      expect(registered).toEqual(hooks);
    });

    it('should allow same hook to be registered for multiple events', () => {
      const hook = createTestHook({ id: 'multi-event-hook' });

      registry.registerHook('before_model', hook);
      registry.registerHook('after_model', hook);
      registry.registerHook('before_tool', hook);

      expect(registry.getHooksForEvent('before_model')).toContain(hook);
      expect(registry.getHooksForEvent('after_model')).toContain(hook);
      expect(registry.getHooksForEvent('before_tool')).toContain(hook);
    });
  });

  describe('Hook Retrieval', () => {
    it('should return empty array for event with no hooks', () => {
      const hooks = registry.getHooksForEvent('before_model');

      expect(hooks).toEqual([]);
    });

    it('should retrieve hook by ID', () => {
      const hook = createTestHook({ id: 'test-hook' });
      registry.registerHook('before_model', hook);

      const retrieved = registry.getHook('test-hook');

      expect(retrieved).toBe(hook);
    });

    it('should return undefined for non-existent hook ID', () => {
      const retrieved = registry.getHook('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should check if hook exists', () => {
      const hook = createTestHook({ id: 'exists' });
      registry.registerHook('before_model', hook);

      expect(registry.hasHook('exists')).toBe(true);
      expect(registry.hasHook('does-not-exist')).toBe(false);
    });

    it('should get total hook count', () => {
      expect(registry.getHookCount()).toBe(0);

      registry.registerHook('before_model', createTestHook({ id: 'hook-1' }));
      expect(registry.getHookCount()).toBe(1);

      registry.registerHook('after_model', createTestHook({ id: 'hook-2' }));
      expect(registry.getHookCount()).toBe(2);

      registry.registerHook('before_tool', createTestHook({ id: 'hook-3' }));
      expect(registry.getHookCount()).toBe(3);
    });

    it('should get all hooks organized by event', () => {
      const hook1 = createTestHook({ id: 'hook-1' });
      const hook2 = createTestHook({ id: 'hook-2' });
      const hook3 = createTestHook({ id: 'hook-3' });

      registry.registerHook('before_model', hook1);
      registry.registerHook('before_model', hook2);
      registry.registerHook('after_model', hook3);

      const allHooks = registry.getAllHooks();

      expect(allHooks.get('before_model')).toEqual([hook1, hook2]);
      expect(allHooks.get('after_model')).toEqual([hook3]);
    });

    it('should return array of hooks for event', () => {
      const hook = createTestHook({ id: 'hook-1' });
      registry.registerHook('before_model', hook);

      const hooks = registry.getHooksForEvent('before_model');

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toBe(hook);
    });
  });

  describe('Hook Unregistration', () => {
    it('should unregister hook by ID', () => {
      const hook = createTestHook({ id: 'to-remove' });
      registry.registerHook('before_model', hook);

      const result = registry.unregisterHook('to-remove');

      expect(result).toBe(true);
      expect(registry.hasHook('to-remove')).toBe(false);
      expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
    });

    it('should return false when unregistering non-existent hook', () => {
      const result = registry.unregisterHook('non-existent');

      expect(result).toBe(false);
    });

    it('should remove hook from all events', () => {
      const hook = createTestHook({ id: 'multi-event' });

      registry.registerHook('before_model', hook);
      registry.registerHook('after_model', hook);
      registry.registerHook('before_tool', hook);

      registry.unregisterHook('multi-event');

      expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
      expect(registry.getHooksForEvent('after_model')).toHaveLength(0);
      expect(registry.getHooksForEvent('before_tool')).toHaveLength(0);
    });

    it('should not affect other hooks when unregistering one', () => {
      const hook1 = createTestHook({ id: 'keep-1' });
      const hook2 = createTestHook({ id: 'remove' });
      const hook3 = createTestHook({ id: 'keep-2' });

      registry.registerHook('before_model', hook1);
      registry.registerHook('before_model', hook2);
      registry.registerHook('before_model', hook3);

      registry.unregisterHook('remove');

      const hooks = registry.getHooksForEvent('before_model');
      expect(hooks).toHaveLength(2);
      expect(hooks).toContain(hook1);
      expect(hooks).toContain(hook3);
      expect(hooks).not.toContain(hook2);
    });

    it('should update hook count after unregistration', () => {
      registry.registerHook('before_model', createTestHook({ id: 'hook-1' }));
      registry.registerHook('after_model', createTestHook({ id: 'hook-2' }));

      expect(registry.getHookCount()).toBe(2);

      registry.unregisterHook('hook-1');

      expect(registry.getHookCount()).toBe(1);
    });
  });

  describe('Event Management', () => {
    it('should clear all hooks for an event', () => {
      registry.registerHook('before_model', createTestHook({ id: 'hook-1' }));
      registry.registerHook('before_model', createTestHook({ id: 'hook-2' }));
      registry.registerHook('after_model', createTestHook({ id: 'hook-3' }));

      registry.clearEvent('before_model');

      expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
      expect(registry.getHooksForEvent('after_model')).toHaveLength(1);
      expect(registry.getHookCount()).toBe(1);
    });

    it('should clear all hooks from registry', () => {
      registry.registerHook('before_model', createTestHook({ id: 'hook-1' }));
      registry.registerHook('after_model', createTestHook({ id: 'hook-2' }));
      registry.registerHook('before_tool', createTestHook({ id: 'hook-3' }));

      registry.clear();

      expect(registry.getHookCount()).toBe(0);
      expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
      expect(registry.getHooksForEvent('after_model')).toHaveLength(0);
      expect(registry.getHooksForEvent('before_tool')).toHaveLength(0);
    });

    it('should handle clearing empty event', () => {
      expect(() => registry.clearEvent('before_model')).not.toThrow();
      expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
    });
  });

  describe('Hook Organization', () => {
    it('should get hooks by category (same as getAllHooks)', () => {
      const hook1 = createTestHook({ id: 'hook-1' });
      const hook2 = createTestHook({ id: 'hook-2' });

      registry.registerHook('before_model', hook1);
      registry.registerHook('after_model', hook2);

      const byCategory = registry.getHooksByCategory();

      expect(byCategory.get('before_model')).toEqual([hook1]);
      expect(byCategory.get('after_model')).toEqual([hook2]);
    });

    it('should filter user hooks', () => {
      const userHook1 = createTestHook({ id: 'user-1', source: 'user' });
      const userHook2 = createTestHook({ id: 'user-2', source: 'user' });
      const builtinHook = createTestHook({ id: 'builtin-1', source: 'builtin' });
      const workspaceHook = createTestHook({ id: 'workspace-1', source: 'workspace' });

      registry.registerHook('before_model', userHook1);
      registry.registerHook('before_model', userHook2);
      registry.registerHook('before_model', builtinHook);
      registry.registerHook('before_model', workspaceHook);

      const userHooks = registry.getUserHooks();

      expect(userHooks).toHaveLength(2);
      expect(userHooks).toContain(userHook1);
      expect(userHooks).toContain(userHook2);
    });

    it('should filter builtin hooks', () => {
      const builtinHook1 = createTestHook({ id: 'builtin-1', source: 'builtin' });
      const builtinHook2 = createTestHook({ id: 'builtin-2', source: 'builtin' });
      const userHook = createTestHook({ id: 'user-1', source: 'user' });

      registry.registerHook('before_model', builtinHook1);
      registry.registerHook('before_model', builtinHook2);
      registry.registerHook('before_model', userHook);

      const builtinHooks = registry.getBuiltinHooks();

      expect(builtinHooks).toHaveLength(2);
      expect(builtinHooks).toContain(builtinHook1);
      expect(builtinHooks).toContain(builtinHook2);
    });

    it('should return empty array when no hooks match filter', () => {
      const builtinHook = createTestHook({ id: 'builtin-1', source: 'builtin' });
      registry.registerHook('before_model', builtinHook);

      expect(registry.getUserHooks()).toHaveLength(0);
    });
  });

  describe('Hook Editability', () => {
    it('should allow editing user hooks', () => {
      const userHook = createTestHook({ id: 'user-hook', source: 'user' });
      registry.registerHook('before_model', userHook);

      expect(registry.isEditable('user-hook')).toBe(true);
    });

    it('should not allow editing builtin hooks', () => {
      const builtinHook = createTestHook({ id: 'builtin-hook', source: 'builtin' });
      registry.registerHook('before_model', builtinHook);

      expect(registry.isEditable('builtin-hook')).toBe(false);
    });

    it('should not allow editing workspace hooks', () => {
      const workspaceHook = createTestHook({ id: 'workspace-hook', source: 'workspace' });
      registry.registerHook('before_model', workspaceHook);

      expect(registry.isEditable('workspace-hook')).toBe(false);
    });

    it('should not allow editing downloaded hooks', () => {
      const downloadedHook = createTestHook({ id: 'downloaded-hook', source: 'downloaded' });
      registry.registerHook('before_model', downloadedHook);

      expect(registry.isEditable('downloaded-hook')).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      expect(registry.isEditable('non-existent')).toBe(false);
    });
  });

  describe('Hook Deletability', () => {
    it('should allow deleting user hooks', () => {
      const userHook = createTestHook({ id: 'user-hook', source: 'user' });
      registry.registerHook('before_model', userHook);

      expect(registry.isDeletable('user-hook')).toBe(true);
    });

    it('should not allow deleting builtin hooks', () => {
      const builtinHook = createTestHook({ id: 'builtin-hook', source: 'builtin' });
      registry.registerHook('before_model', builtinHook);

      expect(registry.isDeletable('builtin-hook')).toBe(false);
    });

    it('should not allow deleting workspace hooks', () => {
      const workspaceHook = createTestHook({ id: 'workspace-hook', source: 'workspace' });
      registry.registerHook('before_model', workspaceHook);

      expect(registry.isDeletable('workspace-hook')).toBe(false);
    });

    it('should not allow deleting downloaded hooks', () => {
      const downloadedHook = createTestHook({ id: 'downloaded-hook', source: 'downloaded' });
      registry.registerHook('before_model', downloadedHook);

      expect(registry.isDeletable('downloaded-hook')).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      expect(registry.isDeletable('non-existent')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle hooks with special characters in ID', () => {
      const specialIds = [
        'hook-with-dash',
        'hook_with_underscore',
        'hook.with.dot',
        'hook:with:colon',
        'hook/with/slash',
      ];

      for (const id of specialIds) {
        const hook = createTestHook({ id });
        registry.registerHook('before_model', hook);

        expect(registry.hasHook(id)).toBe(true);
        expect(registry.getHook(id)).toBe(hook);
      }
    });

    it('should handle very long hook IDs', () => {
      const longId = 'hook-' + 'a'.repeat(1000);
      const hook = createTestHook({ id: longId });

      registry.registerHook('before_model', hook);

      expect(registry.hasHook(longId)).toBe(true);
      expect(registry.getHook(longId)).toBe(hook);
    });

    it('should handle unicode characters in hook IDs', () => {
      const unicodeIds = [
        'hook-日本語',
        'hook-中文',
        'hook-한국어',
        'hook-العربية',
        'hook-emoji-🚀',
      ];

      for (const id of unicodeIds) {
        const hook = createTestHook({ id });
        registry.registerHook('before_model', hook);

        expect(registry.hasHook(id)).toBe(true);
        expect(registry.getHook(id)).toBe(hook);
      }
    });

    it('should handle all event types', () => {
      const events: HookEvent[] = [
        'session_start',
        'session_end',
        'session_saved',
        'before_agent',
        'after_agent',
        'before_model',
        'after_model',
        'before_tool_selection',
        'before_tool',
        'after_tool',
        'pre_compress',
        'post_compress',
        'notification',
      ];

      for (const event of events) {
        const hook = createTestHook({ id: `hook-${event}` });
        registry.registerHook(event, hook);

        expect(registry.getHooksForEvent(event)).toContain(hook);
      }
    });

    it('should maintain hook state across operations', () => {
      const hook = createTestHook({
        id: 'stateful-hook',
        name: 'Stateful Hook',
        command: '/usr/bin/node',
        args: ['script.js', '--flag'],
        source: 'user',
        extensionName: 'my-extension',
        sourcePath: '/path/to/script.js',
      });

      registry.registerHook('before_model', hook);

      const retrieved = registry.getHook('stateful-hook');

      expect(retrieved).toBe(hook);
      expect(retrieved?.name).toBe('Stateful Hook');
      expect(retrieved?.command).toBe('/usr/bin/node');
      expect(retrieved?.args).toEqual(['script.js', '--flag']);
      expect(retrieved?.source).toBe('user');
      expect(retrieved?.extensionName).toBe('my-extension');
      expect(retrieved?.sourcePath).toBe('/path/to/script.js');
    });
  });
});
