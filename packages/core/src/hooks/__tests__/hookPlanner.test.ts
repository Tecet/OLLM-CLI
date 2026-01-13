/**
 * Tests for HookPlanner
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HookPlanner } from '../hookPlanner.js';
import { HookRegistry } from '../hookRegistry.js';
import type { Hook, HookEvent, HookContext } from '../types.js';

describe('HookPlanner', () => {
  let registry: HookRegistry;
  let planner: HookPlanner;

  beforeEach(() => {
    registry = new HookRegistry();
    planner = new HookPlanner(registry);
  });

  describe('planExecution', () => {
    it('should return empty plan when no hooks registered', () => {
      const context: HookContext = {
        sessionId: 'test-session',
        event: 'session_start',
        data: {},
      };

      const plan = planner.planExecution('session_start', context);

      expect(plan.hooks).toEqual([]);
      expect(plan.order).toBe('priority');
      expect(plan.parallel).toBe(false);
    });

    it('should return all hooks for an event', () => {
      const hook1: Hook = {
        id: 'hook1',
        name: 'Test Hook 1',
        command: 'node',
        args: ['script1.js'],
        source: 'user',
      };

      const hook2: Hook = {
        id: 'hook2',
        name: 'Test Hook 2',
        command: 'node',
        args: ['script2.js'],
        source: 'user',
      };

      registry.registerHook('session_start', hook1);
      registry.registerHook('session_start', hook2);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'session_start',
        data: {},
      };

      const plan = planner.planExecution('session_start', context);

      expect(plan.hooks).toHaveLength(2);
      expect(plan.hooks).toContainEqual(hook1);
      expect(plan.hooks).toContainEqual(hook2);
    });

    it('should order user hooks before workspace hooks', () => {
      const userHook: Hook = {
        id: 'user-hook',
        name: 'User Hook',
        command: 'node',
        args: ['user.js'],
        source: 'user',
      };

      const workspaceHook: Hook = {
        id: 'workspace-hook',
        name: 'Workspace Hook',
        command: 'node',
        args: ['workspace.js'],
        source: 'workspace',
      };

      // Register workspace hook first
      registry.registerHook('before_model', workspaceHook);
      registry.registerHook('before_model', userHook);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'before_model',
        data: {},
      };

      const plan = planner.planExecution('before_model', context);

      expect(plan.hooks).toHaveLength(2);
      // User hook should come first despite being registered second
      expect(plan.hooks[0]).toEqual(userHook);
      expect(plan.hooks[1]).toEqual(workspaceHook);
    });

    it('should order hooks by source priority: builtin > user > workspace > downloaded', () => {
      const builtinHook: Hook = {
        id: 'builtin-hook',
        name: 'Builtin Hook',
        command: 'node',
        args: ['builtin.js'],
        source: 'builtin',
      };

      const userHook: Hook = {
        id: 'user-hook',
        name: 'User Hook',
        command: 'node',
        args: ['user.js'],
        source: 'user',
      };

      const workspaceHook: Hook = {
        id: 'workspace-hook',
        name: 'Workspace Hook',
        command: 'node',
        args: ['workspace.js'],
        source: 'workspace',
      };

      const downloadedHook: Hook = {
        id: 'downloaded-hook',
        name: 'Downloaded Hook',
        command: 'node',
        args: ['downloaded.js'],
        source: 'downloaded',
      };

      // Register in reverse order
      registry.registerHook('after_tool', downloadedHook);
      registry.registerHook('after_tool', workspaceHook);
      registry.registerHook('after_tool', userHook);
      registry.registerHook('after_tool', builtinHook);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'after_tool',
        data: {},
      };

      const plan = planner.planExecution('after_tool', context);

      expect(plan.hooks).toHaveLength(4);
      expect(plan.hooks[0]).toEqual(builtinHook);
      expect(plan.hooks[1]).toEqual(userHook);
      expect(plan.hooks[2]).toEqual(workspaceHook);
      expect(plan.hooks[3]).toEqual(downloadedHook);
    });

    it('should maintain registration order within same source type', () => {
      const userHook1: Hook = {
        id: 'user-hook-1',
        name: 'User Hook 1',
        command: 'node',
        args: ['user1.js'],
        source: 'user',
      };

      const userHook2: Hook = {
        id: 'user-hook-2',
        name: 'User Hook 2',
        command: 'node',
        args: ['user2.js'],
        source: 'user',
      };

      const userHook3: Hook = {
        id: 'user-hook-3',
        name: 'User Hook 3',
        command: 'node',
        args: ['user3.js'],
        source: 'user',
      };

      // Register in specific order
      registry.registerHook('before_agent', userHook1);
      registry.registerHook('before_agent', userHook2);
      registry.registerHook('before_agent', userHook3);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'before_agent',
        data: {},
      };

      const plan = planner.planExecution('before_agent', context);

      expect(plan.hooks).toHaveLength(3);
      // Should maintain registration order
      expect(plan.hooks[0]).toEqual(userHook1);
      expect(plan.hooks[1]).toEqual(userHook2);
      expect(plan.hooks[2]).toEqual(userHook3);
    });

    it('should handle mixed sources while maintaining order within each source', () => {
      const user1: Hook = {
        id: 'user-1',
        name: 'User 1',
        command: 'node',
        args: ['user1.js'],
        source: 'user',
      };

      const workspace1: Hook = {
        id: 'workspace-1',
        name: 'Workspace 1',
        command: 'node',
        args: ['workspace1.js'],
        source: 'workspace',
      };

      const user2: Hook = {
        id: 'user-2',
        name: 'User 2',
        command: 'node',
        args: ['user2.js'],
        source: 'user',
      };

      const workspace2: Hook = {
        id: 'workspace-2',
        name: 'Workspace 2',
        command: 'node',
        args: ['workspace2.js'],
        source: 'workspace',
      };

      // Register in interleaved order
      registry.registerHook('session_end', user1);
      registry.registerHook('session_end', workspace1);
      registry.registerHook('session_end', user2);
      registry.registerHook('session_end', workspace2);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'session_end',
        data: {},
      };

      const plan = planner.planExecution('session_end', context);

      expect(plan.hooks).toHaveLength(4);
      // User hooks first, in registration order
      expect(plan.hooks[0]).toEqual(user1);
      expect(plan.hooks[1]).toEqual(user2);
      // Workspace hooks second, in registration order
      expect(plan.hooks[2]).toEqual(workspace1);
      expect(plan.hooks[3]).toEqual(workspace2);
    });

    it('should return plan with parallel set to false', () => {
      const hook: Hook = {
        id: 'test-hook',
        name: 'Test Hook',
        command: 'node',
        args: ['test.js'],
        source: 'user',
      };

      registry.registerHook('before_tool', hook);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'before_tool',
        data: {},
      };

      const plan = planner.planExecution('before_tool', context);

      expect(plan.parallel).toBe(false);
    });

    it('should return plan with order set to priority', () => {
      const hook: Hook = {
        id: 'test-hook',
        name: 'Test Hook',
        command: 'node',
        args: ['test.js'],
        source: 'user',
      };

      registry.registerHook('after_agent', hook);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'after_agent',
        data: {},
      };

      const plan = planner.planExecution('after_agent', context);

      expect(plan.order).toBe('priority');
    });

    it('should not modify the registry when planning', () => {
      const hook: Hook = {
        id: 'test-hook',
        name: 'Test Hook',
        command: 'node',
        args: ['test.js'],
        source: 'user',
      };

      registry.registerHook('before_tool_selection', hook);

      const context: HookContext = {
        sessionId: 'test-session',
        event: 'before_tool_selection',
        data: {},
      };

      const countBefore = registry.getHookCount();
      planner.planExecution('before_tool_selection', context);
      const countAfter = registry.getHookCount();

      expect(countAfter).toBe(countBefore);
    });
  });
});
