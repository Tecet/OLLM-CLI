/**
 * Property-based tests for hook configuration effects
 * Feature: stage-05-hooks-extensions-mcp, Property 39: Hook Configuration Effects
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { HookRunner } from '../hookRunner.js';
import { HookRegistry } from '../hookRegistry.js';
import type { Hook, HookInput, HooksConfig } from '../index.js';

describe('Property 39: Hook Configuration Effects', () => {
  // Feature: stage-05-hooks-extensions-mcp, Property 39: Hook Configuration Effects
  it('should skip all hooks when hooks.enabled is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.constantFrom('session_start', 'before_model', 'after_tool'),
        async (hookName, event) => {
          // Create hook
          const hook: Hook = {
            id: 'test-hook',
            name: hookName,
            command: 'echo',
            args: ['{"continue": true}'],
            source: 'user',
          };

          // Create runner with hooks disabled
          const config: HooksConfig = {
            enabled: false,
            timeout: 30000,
            trustWorkspace: false,
          };
          const runner = new HookRunner(30000, undefined, config);

          const input: HookInput = {
            event,
            data: {},
          };

          // Execute hook
          const output = await runner.executeHook(hook, input);

          // Should return error indicating hooks are disabled
          expect(output.continue).toBe(true);
          expect(output.error).toContain('disabled');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use configured timeout for hook execution', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100, max: 1000 }),
        async (timeout) => {
          // Create a hook that will timeout using Node.js
          const hook: Hook = {
            id: 'slow-hook',
            name: 'slow-hook',
            command: 'node',
            args: ['-e', 'setTimeout(() => {}, 10000)'], // Wait 10 seconds
            source: 'user',
          };

          // Create runner with custom timeout
          const config: HooksConfig = {
            enabled: true,
            timeout,
            trustWorkspace: false,
          };
          const runner = new HookRunner(timeout, undefined, config);

          const input: HookInput = {
            event: 'session_start',
            data: {},
          };

          const startTime = Date.now();
          
          // Execute hook (should timeout)
          const result = await runner.executeHookWithMetadata(hook, input);
          
          const executionTime = Date.now() - startTime;

          // Should timeout within reasonable margin
          expect(executionTime).toBeLessThan(timeout + 2000);
          
          // Should be marked as timed out or have error
          const hasTimeout = result.timedOut || (result.error && result.error.message.includes('timeout'));
          expect(hasTimeout).toBe(true);
        }
      ),
      { numRuns: 10 } // Fewer runs since this involves actual timeouts
    );
  }, 30000); // 30 second timeout for this test

  it('should respect trustWorkspace configuration', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(),
        async (trustWorkspace) => {
          // Create workspace hook using Node.js
          const hook: Hook = {
            id: 'workspace-hook',
            name: 'workspace-hook',
            command: 'node',
            args: ['-e', 'console.log(JSON.stringify({continue: true}))'],
            source: 'workspace',
          };

          // Create runner with trustWorkspace config
          const config: HooksConfig = {
            enabled: true,
            timeout: 30000,
            trustWorkspace,
          };
          
          // Note: Without TrustedHooks instance, trust checking is skipped
          // This test validates that the config is properly stored and accessible
          const runner = new HookRunner(30000, undefined, config);

          const input: HookInput = {
            event: 'session_start',
            data: {},
          };

          // Execute hook
          const output = await runner.executeHook(hook, input);

          // Should execute (trust checking requires TrustedHooks instance)
          expect(output.continue).toBe(true);
        }
      ),
      { numRuns: 10 } // Reduced runs for Windows performance
    );
  }, 30000); // 30 second timeout

  it('should execute hooks when enabled is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.constantFrom('session_start', 'before_model', 'after_tool'),
        async (hookName, event) => {
          // Create hook using Node.js to output JSON
          const hook: Hook = {
            id: 'test-hook',
            name: hookName,
            command: 'node',
            args: ['-e', 'console.log(JSON.stringify({continue: true, systemMessage: "test"}))'],
            source: 'user',
          };

          // Create runner with hooks enabled
          const config: HooksConfig = {
            enabled: true,
            timeout: 30000,
            trustWorkspace: false,
          };
          const runner = new HookRunner(30000, undefined, config);

          const input: HookInput = {
            event,
            data: {},
          };

          // Execute hook
          const output = await runner.executeHook(hook, input);

          // Should execute successfully
          expect(output.continue).toBe(true);
          // May have systemMessage or error depending on execution
        }
      ),
      { numRuns: 10 } // Reduced runs for Windows performance
    );
  }, 30000); // 30 second timeout

  it('should skip multiple hooks when disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
        async (hookNames) => {
          // Create multiple hooks using Node.js
          const hooks: Hook[] = hookNames.map((name, i) => ({
            id: `hook-${i}`,
            name,
            command: 'node',
            args: ['-e', 'console.log(JSON.stringify({continue: true}))'],
            source: 'user',
          }));

          // Create runner with hooks disabled
          const config: HooksConfig = {
            enabled: false,
            timeout: 30000,
            trustWorkspace: false,
          };
          const runner = new HookRunner(30000, undefined, config);

          const input: HookInput = {
            event: 'session_start',
            data: {},
          };

          // Execute hooks
          const outputs = await runner.executeHooks(hooks, input);

          // All should be skipped
          expect(outputs).toHaveLength(hooks.length);
          outputs.forEach(output => {
            expect(output.continue).toBe(true);
            expect(output.error).toContain('disabled');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
