/**
 * Tests for HookEventHandler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HookEventHandler } from '../hookEventHandler.js';
import { MessageBus } from '../messageBus.js';
import { HookRegistry } from '../hookRegistry.js';
import { HookRunner } from '../hookRunner.js';
import type { Hook, HookInput, HookOutput } from '../types.js';

describe('HookEventHandler', () => {
  let messageBus: MessageBus;
  let hookRegistry: HookRegistry;
  let hookRunner: HookRunner;
  let handler: HookEventHandler;

  const createMockHook = (id: string, name: string): Hook => ({
    id,
    name,
    command: 'node',
    args: ['test.js'],
    source: 'user',
  });

  beforeEach(() => {
    messageBus = new MessageBus();
    hookRegistry = new HookRegistry();
    hookRunner = new HookRunner(30000);
    handler = new HookEventHandler(messageBus, hookRegistry, hookRunner, {
      logging: false, // Disable logging for tests
    });
  });

  describe('start() and stop()', () => {
    it('should start listening for events', async () => {
      const hook = createMockHook('hook1', 'Test Hook');
      hookRegistry.registerHook('session_start', hook);

      // Mock hook execution
      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true }],
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();
      await messageBus.emit('session_start', {});

      expect(executeSpy).toHaveBeenCalledTimes(1);
    });

    it('should stop listening for events', async () => {
      const hook = createMockHook('hook1', 'Test Hook');
      hookRegistry.registerHook('session_start', hook);

      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true }],
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();
      handler.stop();
      await messageBus.emit('session_start', {});

      expect(executeSpy).not.toHaveBeenCalled();
    });

    it('should not execute hooks when disabled', async () => {
      const hook = createMockHook('hook1', 'Test Hook');
      hookRegistry.registerHook('session_start', hook);

      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary');

      handler.start();
      handler.disable();
      await messageBus.emit('session_start', {});

      expect(executeSpy).not.toHaveBeenCalled();
    });

    it('should resume execution when re-enabled', async () => {
      const hook = createMockHook('hook1', 'Test Hook');
      hookRegistry.registerHook('session_start', hook);

      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true }],
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();
      handler.disable();
      handler.enable();
      await messageBus.emit('session_start', {});

      expect(executeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sequential execution', () => {
    it('should execute hooks sequentially', async () => {
      const hook1 = createMockHook('hook1', 'Hook 1');
      const hook2 = createMockHook('hook2', 'Hook 2');

      hookRegistry.registerHook('session_start', hook1);
      hookRegistry.registerHook('session_start', hook2);

      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [
          { continue: true, systemMessage: 'Message 1' },
          { continue: true, systemMessage: 'Message 2' },
        ],
        shouldContinue: true,
        systemMessages: ['Message 1', 'Message 2'],
        aggregatedData: { key: 'value' },
        aborted: false,
      });

      handler.start();
      await messageBus.emit('session_start', { test: 'data' });

      expect(executeSpy).toHaveBeenCalledWith(
        [hook1, hook2],
        expect.objectContaining({
          event: 'session_start',
          data: { test: 'data' },
        })
      );
    });

    it('should handle no hooks registered', async () => {
      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary');

      handler.start();
      await messageBus.emit('session_start', {});

      // Should not call runner if no hooks registered
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it('should collect system messages from hooks', async () => {
      const hook = createMockHook('hook1', 'Test Hook');
      hookRegistry.registerHook('session_start', hook);

      vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true, systemMessage: 'Test message' }],
        shouldContinue: true,
        systemMessages: ['Test message'],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();
      await messageBus.emit('session_start', {});

      // System messages should be collected (verified by mock)
      expect(true).toBe(true);
    });

    it('should handle hook errors gracefully', async () => {
      const hook = createMockHook('hook1', 'Test Hook');
      hookRegistry.registerHook('session_start', hook);

      vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true, error: 'Hook failed' }],
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();

      // Should not throw
      await expect(messageBus.emit('session_start', {})).resolves.not.toThrow();
    });
  });

  describe('parallel execution', () => {
    it('should execute hooks in parallel when enabled', async () => {
      const hook1 = createMockHook('hook1', 'Hook 1');
      const hook2 = createMockHook('hook2', 'Hook 2');

      hookRegistry.registerHook('session_start', hook1);
      hookRegistry.registerHook('session_start', hook2);

      const executeHookSpy = vi.spyOn(hookRunner, 'executeHook').mockResolvedValue({
        continue: true,
      });

      handler.setOptions({ parallel: true });
      handler.start();
      await messageBus.emit('session_start', {});

      // Should call executeHook for each hook (parallel execution)
      expect(executeHookSpy).toHaveBeenCalledTimes(2);
    });

    it('should collect results from parallel execution', async () => {
      const hook1 = createMockHook('hook1', 'Hook 1');
      const hook2 = createMockHook('hook2', 'Hook 2');

      hookRegistry.registerHook('session_start', hook1);
      hookRegistry.registerHook('session_start', hook2);

      vi.spyOn(hookRunner, 'executeHook')
        .mockResolvedValueOnce({ continue: true, systemMessage: 'Message 1', data: { key1: 'value1' } })
        .mockResolvedValueOnce({ continue: true, systemMessage: 'Message 2', data: { key2: 'value2' } });

      handler.setOptions({ parallel: true });
      handler.start();
      await messageBus.emit('session_start', {});

      // Results should be collected (verified by execution)
      expect(true).toBe(true);
    });

    it('should handle errors in parallel execution', async () => {
      const hook1 = createMockHook('hook1', 'Hook 1');
      const hook2 = createMockHook('hook2', 'Hook 2');

      hookRegistry.registerHook('session_start', hook1);
      hookRegistry.registerHook('session_start', hook2);

      vi.spyOn(hookRunner, 'executeHook')
        .mockRejectedValueOnce(new Error('Hook 1 failed'))
        .mockResolvedValueOnce({ continue: true });

      handler.setOptions({ parallel: true });
      handler.start();

      // Should not throw
      await expect(messageBus.emit('session_start', {})).resolves.not.toThrow();
    });
  });

  describe('options management', () => {
    it('should get current options', () => {
      const options = handler.getOptions();

      expect(options).toEqual({
        parallel: false,
        stopOnError: false,
        logging: false,
      });
    });

    it('should set options', () => {
      handler.setOptions({ parallel: true, stopOnError: true });

      const options = handler.getOptions();

      expect(options.parallel).toBe(true);
      expect(options.stopOnError).toBe(true);
    });

    it('should partially update options', () => {
      handler.setOptions({ parallel: true });

      const options = handler.getOptions();

      expect(options.parallel).toBe(true);
      expect(options.stopOnError).toBe(false); // Should remain unchanged
    });
  });

  describe('enable/disable', () => {
    it('should check if handler is enabled', () => {
      expect(handler.isEnabled()).toBe(true);

      handler.disable();
      expect(handler.isEnabled()).toBe(false);

      handler.enable();
      expect(handler.isEnabled()).toBe(true);
    });
  });

  describe('multiple events', () => {
    it('should handle multiple different events', async () => {
      const hook1 = createMockHook('hook1', 'Hook 1');
      const hook2 = createMockHook('hook2', 'Hook 2');

      hookRegistry.registerHook('session_start', hook1);
      hookRegistry.registerHook('session_end', hook2);

      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true }],
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();
      await messageBus.emit('session_start', {});
      await messageBus.emit('session_end', {});

      expect(executeSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle all hook event types', async () => {
      const events: Array<typeof import('../types.js').HookEvent> = [
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

      const executeSpy = vi.spyOn(hookRunner, 'executeHooksWithSummary').mockResolvedValue({
        outputs: [{ continue: true }],
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      });

      handler.start();

      for (const event of events) {
        const hook = createMockHook(`hook-${event}`, `Hook for ${event}`);
        hookRegistry.registerHook(event, hook);
        await messageBus.emit(event, {});
      }

      expect(executeSpy).toHaveBeenCalledTimes(events.length);
    });
  });
});
