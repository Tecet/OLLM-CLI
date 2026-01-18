/**
 * Tests for HookRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { HookRegistry } from '../hookRegistry.js';
import { arbHook, arbHookEvent, createTestHook } from './test-helpers.js';
import type { Hook, HookEvent } from '../types.js';

describe('HookRegistry', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe('Property-Based Tests', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 1: Hook Registration and Retrieval
    it('should retrieve registered hooks for any hook and event', () => {
      fc.assert(
        fc.property(arbHook(), arbHookEvent(), (hook: Hook, event: HookEvent) => {
          const registry = new HookRegistry();

          // Register the hook for the event
          registry.registerHook(event, hook);

          // Retrieve hooks for that event
          const retrieved = registry.getHooksForEvent(event);

          // The hook should be in the retrieved list
          expect(retrieved).toContainEqual(hook);
          expect(retrieved.length).toBeGreaterThanOrEqual(1);
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain insertion order for multiple hooks on same event', () => {
      fc.assert(
        fc.property(
          arbHookEvent(),
          fc.array(arbHook(), { minLength: 2, maxLength: 10 }),
          (event: HookEvent, hooks: Hook[]) => {
            const registry = new HookRegistry();

            // Make hooks unique by ID to avoid duplicates
            const uniqueHooks = hooks.map((hook, index) => ({
              ...hook,
              id: `${hook.id}-${index}`,
            }));

            // Register all hooks in order
            for (const hook of uniqueHooks) {
              registry.registerHook(event, hook);
            }

            // Retrieve hooks
            const retrieved = registry.getHooksForEvent(event);

            // Should have all hooks in the same order
            expect(retrieved).toHaveLength(uniqueHooks.length);
            for (let i = 0; i < uniqueHooks.length; i++) {
              expect(retrieved[i].id).toBe(uniqueHooks[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should isolate hooks between different events', () => {
      fc.assert(
        fc.property(
          arbHookEvent(),
          arbHookEvent(),
          arbHook(),
          arbHook(),
          (event1: HookEvent, event2: HookEvent, hook1: Hook, hook2: Hook) => {
            // Skip if events are the same
            if (event1 === event2) return;

            const registry = new HookRegistry();

            // Make hooks unique
            const uniqueHook1 = { ...hook1, id: `${hook1.id}-1` };
            const uniqueHook2 = { ...hook2, id: `${hook2.id}-2` };

            // Register hooks for different events
            registry.registerHook(event1, uniqueHook1);
            registry.registerHook(event2, uniqueHook2);

            // Each event should only have its own hook
            const retrieved1 = registry.getHooksForEvent(event1);
            const retrieved2 = registry.getHooksForEvent(event2);

            expect(retrieved1).toContainEqual(uniqueHook1);
            expect(retrieved1).not.toContainEqual(uniqueHook2);
            expect(retrieved2).toContainEqual(uniqueHook2);
            expect(retrieved2).not.toContainEqual(uniqueHook1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    describe('registerHook', () => {
      it('should register a hook for an event', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Test Hook' });
        registry.registerHook('before_model', hook);

        const hooks = registry.getHooksForEvent('before_model');
        expect(hooks).toHaveLength(1);
        expect(hooks[0]).toEqual(hook);
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
        expect(hooks[0]).toEqual(hook1);
        expect(hooks[1]).toEqual(hook2);
        expect(hooks[2]).toEqual(hook3);
      });

      it('should register the same hook for multiple events', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Multi-event Hook' });

        registry.registerHook('before_model', hook);
        registry.registerHook('after_model', hook);

        const beforeHooks = registry.getHooksForEvent('before_model');
        const afterHooks = registry.getHooksForEvent('after_model');

        expect(beforeHooks).toContainEqual(hook);
        expect(afterHooks).toContainEqual(hook);
      });
    });

    describe('getHooksForEvent', () => {
      it('should return empty array for event with no hooks', () => {
        const hooks = registry.getHooksForEvent('before_model');
        expect(hooks).toEqual([]);
      });

      it('should return hooks in registration order', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'First' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Second' });
        const hook3 = createTestHook({ id: 'hook-3', name: 'Third' });

        registry.registerHook('session_start', hook1);
        registry.registerHook('session_start', hook2);
        registry.registerHook('session_start', hook3);

        const hooks = registry.getHooksForEvent('session_start');
        expect(hooks[0].id).toBe('hook-1');
        expect(hooks[1].id).toBe('hook-2');
        expect(hooks[2].id).toBe('hook-3');
      });
    });

    describe('unregisterHook', () => {
      it('should remove a hook by ID', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Test Hook' });
        registry.registerHook('before_model', hook);

        const removed = registry.unregisterHook('hook-1');
        expect(removed).toBe(true);

        const hooks = registry.getHooksForEvent('before_model');
        expect(hooks).toHaveLength(0);
      });

      it('should return false when removing non-existent hook', () => {
        const removed = registry.unregisterHook('non-existent');
        expect(removed).toBe(false);
      });

      it('should remove hook from all events it was registered for', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Multi-event Hook' });

        registry.registerHook('before_model', hook);
        registry.registerHook('after_model', hook);
        registry.registerHook('before_tool', hook);

        registry.unregisterHook('hook-1');

        expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
        expect(registry.getHooksForEvent('after_model')).toHaveLength(0);
        expect(registry.getHooksForEvent('before_tool')).toHaveLength(0);
      });

      it('should not affect other hooks when removing one', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });
        const hook3 = createTestHook({ id: 'hook-3', name: 'Hook 3' });

        registry.registerHook('before_model', hook1);
        registry.registerHook('before_model', hook2);
        registry.registerHook('before_model', hook3);

        registry.unregisterHook('hook-2');

        const hooks = registry.getHooksForEvent('before_model');
        expect(hooks).toHaveLength(2);
        expect(hooks[0]).toEqual(hook1);
        expect(hooks[1]).toEqual(hook3);
      });
    });

    describe('getAllHooks', () => {
      it('should return empty map when no hooks registered', () => {
        const allHooks = registry.getAllHooks();
        expect(allHooks.size).toBe(0);
      });

      it('should return all hooks organized by event', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });
        const hook3 = createTestHook({ id: 'hook-3', name: 'Hook 3' });

        registry.registerHook('before_model', hook1);
        registry.registerHook('before_model', hook2);
        registry.registerHook('after_model', hook3);

        const allHooks = registry.getAllHooks();
        expect(allHooks.size).toBe(2);
        expect(allHooks.get('before_model')).toHaveLength(2);
        expect(allHooks.get('after_model')).toHaveLength(1);
      });

      it('should return a copy that does not affect internal state', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Test Hook' });
        registry.registerHook('before_model', hook);

        const allHooks = registry.getAllHooks();
        const beforeModelHooks = allHooks.get('before_model')!;
        beforeModelHooks.push(createTestHook({ id: 'hook-2', name: 'Injected' }));

        // Original registry should not be affected
        const originalHooks = registry.getHooksForEvent('before_model');
        expect(originalHooks).toHaveLength(1);
      });
    });

    describe('clearEvent', () => {
      it('should remove all hooks for a specific event', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });

        registry.registerHook('before_model', hook1);
        registry.registerHook('before_model', hook2);
        registry.registerHook('after_model', hook1);

        registry.clearEvent('before_model');

        expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
        expect(registry.getHooksForEvent('after_model')).toHaveLength(1);
      });

      it('should not error when clearing event with no hooks', () => {
        expect(() => registry.clearEvent('before_model')).not.toThrow();
      });
    });

    describe('clear', () => {
      it('should remove all hooks from registry', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });

        registry.registerHook('before_model', hook1);
        registry.registerHook('after_model', hook2);

        registry.clear();

        expect(registry.getHookCount()).toBe(0);
        expect(registry.getHooksForEvent('before_model')).toHaveLength(0);
        expect(registry.getHooksForEvent('after_model')).toHaveLength(0);
      });
    });

    describe('getHookCount', () => {
      it('should return 0 for empty registry', () => {
        expect(registry.getHookCount()).toBe(0);
      });

      it('should return total number of unique hooks', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });

        registry.registerHook('before_model', hook1);
        registry.registerHook('after_model', hook2);
        registry.registerHook('before_tool', hook1); // Same hook, different event

        // Should count unique hooks, not registrations
        expect(registry.getHookCount()).toBe(2);
      });
    });

    describe('hasHook', () => {
      it('should return true for registered hook', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Test Hook' });
        registry.registerHook('before_model', hook);

        expect(registry.hasHook('hook-1')).toBe(true);
      });

      it('should return false for unregistered hook', () => {
        expect(registry.hasHook('non-existent')).toBe(false);
      });
    });

    describe('getHook', () => {
      it('should return hook by ID', () => {
        const hook = createTestHook({ id: 'hook-1', name: 'Test Hook' });
        registry.registerHook('before_model', hook);

        const retrieved = registry.getHook('hook-1');
        expect(retrieved).toEqual(hook);
      });

      it('should return undefined for non-existent hook', () => {
        const retrieved = registry.getHook('non-existent');
        expect(retrieved).toBeUndefined();
      });
    });

    describe('getHooksByCategory', () => {
      it('should return hooks organized by event type', () => {
        const hook1 = createTestHook({ id: 'hook-1', name: 'Hook 1' });
        const hook2 = createTestHook({ id: 'hook-2', name: 'Hook 2' });
        const hook3 = createTestHook({ id: 'hook-3', name: 'Hook 3' });

        registry.registerHook('before_model', hook1);
        registry.registerHook('before_model', hook2);
        registry.registerHook('after_model', hook3);

        const categories = registry.getHooksByCategory();
        expect(categories.size).toBe(2);
        expect(categories.get('before_model')).toHaveLength(2);
        expect(categories.get('after_model')).toHaveLength(1);
      });

      it('should return empty map when no hooks registered', () => {
        const categories = registry.getHooksByCategory();
        expect(categories.size).toBe(0);
      });
    });

    describe('getUserHooks', () => {
      it('should return only user-created hooks', () => {
        const userHook1 = createTestHook({ id: 'user-1', name: 'User Hook 1', source: 'user' });
        const userHook2 = createTestHook({ id: 'user-2', name: 'User Hook 2', source: 'user' });
        const builtinHook = createTestHook({ id: 'builtin-1', name: 'Builtin Hook', source: 'builtin' });
        const workspaceHook = createTestHook({ id: 'workspace-1', name: 'Workspace Hook', source: 'workspace' });

        registry.registerHook('before_model', userHook1);
        registry.registerHook('after_model', userHook2);
        registry.registerHook('before_tool', builtinHook);
        registry.registerHook('after_tool', workspaceHook);

        const userHooks = registry.getUserHooks();
        expect(userHooks).toHaveLength(2);
        expect(userHooks).toContainEqual(userHook1);
        expect(userHooks).toContainEqual(userHook2);
        expect(userHooks).not.toContainEqual(builtinHook);
        expect(userHooks).not.toContainEqual(workspaceHook);
      });

      it('should return empty array when no user hooks exist', () => {
        const builtinHook = createTestHook({ id: 'builtin-1', name: 'Builtin Hook', source: 'builtin' });
        registry.registerHook('before_model', builtinHook);

        const userHooks = registry.getUserHooks();
        expect(userHooks).toHaveLength(0);
      });
    });

    describe('getBuiltinHooks', () => {
      it('should return only built-in hooks', () => {
        const builtinHook1 = createTestHook({ id: 'builtin-1', name: 'Builtin Hook 1', source: 'builtin' });
        const builtinHook2 = createTestHook({ id: 'builtin-2', name: 'Builtin Hook 2', source: 'builtin' });
        const userHook = createTestHook({ id: 'user-1', name: 'User Hook', source: 'user' });
        const workspaceHook = createTestHook({ id: 'workspace-1', name: 'Workspace Hook', source: 'workspace' });

        registry.registerHook('before_model', builtinHook1);
        registry.registerHook('after_model', builtinHook2);
        registry.registerHook('before_tool', userHook);
        registry.registerHook('after_tool', workspaceHook);

        const builtinHooks = registry.getBuiltinHooks();
        expect(builtinHooks).toHaveLength(2);
        expect(builtinHooks).toContainEqual(builtinHook1);
        expect(builtinHooks).toContainEqual(builtinHook2);
        expect(builtinHooks).not.toContainEqual(userHook);
        expect(builtinHooks).not.toContainEqual(workspaceHook);
      });

      it('should return empty array when no builtin hooks exist', () => {
        const userHook = createTestHook({ id: 'user-1', name: 'User Hook', source: 'user' });
        registry.registerHook('before_model', userHook);

        const builtinHooks = registry.getBuiltinHooks();
        expect(builtinHooks).toHaveLength(0);
      });
    });

    describe('isEditable', () => {
      it('should return true for user hooks', () => {
        const userHook = createTestHook({ id: 'user-1', name: 'User Hook', source: 'user' });
        registry.registerHook('before_model', userHook);

        expect(registry.isEditable('user-1')).toBe(true);
      });

      it('should return false for builtin hooks', () => {
        const builtinHook = createTestHook({ id: 'builtin-1', name: 'Builtin Hook', source: 'builtin' });
        registry.registerHook('before_model', builtinHook);

        expect(registry.isEditable('builtin-1')).toBe(false);
      });

      it('should return false for workspace hooks', () => {
        const workspaceHook = createTestHook({ id: 'workspace-1', name: 'Workspace Hook', source: 'workspace' });
        registry.registerHook('before_model', workspaceHook);

        expect(registry.isEditable('workspace-1')).toBe(false);
      });

      it('should return false for non-existent hooks', () => {
        expect(registry.isEditable('non-existent')).toBe(false);
      });
    });

    describe('isDeletable', () => {
      it('should return true for user hooks', () => {
        const userHook = createTestHook({ id: 'user-1', name: 'User Hook', source: 'user' });
        registry.registerHook('before_model', userHook);

        expect(registry.isDeletable('user-1')).toBe(true);
      });

      it('should return false for builtin hooks', () => {
        const builtinHook = createTestHook({ id: 'builtin-1', name: 'Builtin Hook', source: 'builtin' });
        registry.registerHook('before_model', builtinHook);

        expect(registry.isDeletable('builtin-1')).toBe(false);
      });

      it('should return false for workspace hooks', () => {
        const workspaceHook = createTestHook({ id: 'workspace-1', name: 'Workspace Hook', source: 'workspace' });
        registry.registerHook('before_model', workspaceHook);

        expect(registry.isDeletable('workspace-1')).toBe(false);
      });

      it('should return false for non-existent hooks', () => {
        expect(registry.isDeletable('non-existent')).toBe(false);
      });
    });
  });
});
