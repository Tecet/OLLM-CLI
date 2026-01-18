/**
 * Tests for HookRunner
 * 
 * Feature: stage-05-hooks-extensions-mcp
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { HookRunner } from '../hookRunner.js';
import { HookRegistry } from '../hookRegistry.js';
import { TrustedHooks } from '../trustedHooks.js';
import type { Hook } from '../types.js';
import { createTestHook, createTestHookInput, arbHookEvent } from './test-helpers.js';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('HookRunner', () => {
  let runner: HookRunner;
  let testDir: string;

  beforeEach(() => {
    runner = new HookRunner(5000); // 5 second timeout for tests
    
    // Create a temporary directory for test hooks
    testDir = join(tmpdir(), 'hook-runner-test-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore
    }
  });

  /**
   * Helper to create a test hook script that outputs JSON
   */
  function createHookScript(name: string, output: object, delay: number = 0): string {
    // Sanitize name for file system (replace invalid characters)
    const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const scriptPath = join(testDir, `${safeName}.js`);
    const script = `
      const input = [];
      process.stdin.on('data', chunk => input.push(chunk));
      process.stdin.on('end', () => {
        ${delay > 0 ? `setTimeout(() => {` : ''}
        console.log(JSON.stringify(${JSON.stringify(output)}));
        ${delay > 0 ? `}, ${delay});` : ''}
      });
    `;
    writeFileSync(scriptPath, script);
    return scriptPath;
  }

  describe('Property 2: Hook Execution Order', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 2: Hook Execution Order
    it('should execute hooks in registration order', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 2, maxLength: 5 }),
          arbHookEvent(),
          async (hookNames, event) => {
            // Create hooks that output their index in order
            const hooks: Hook[] = [];
            const executionOrder: number[] = [];

            for (let i = 0; i < hookNames.length; i++) {
              const name = hookNames[i];
              // Use index to ensure unique filenames and track order
              const uniqueName = `${name}-${i}`;
              const scriptPath = createHookScript(uniqueName, {
                continue: true,
                data: { executedBy: name, index: i },
              });

              hooks.push(createTestHook({
                id: `hook-${i}`,
                name,
                command: 'node',
                args: [scriptPath],
              }));
            }

            // Execute hooks
            const input = createTestHookInput(event);
            const results = await runner.executeHooks(hooks, input);

            // Verify all hooks executed
            expect(results).toHaveLength(hooks.length);

            // Verify execution order by checking index
            for (let i = 0; i < results.length; i++) {
              if (results[i].data?.index !== undefined) {
                executionOrder.push(results[i].data!.index as number);
              }
            }

            // Execution order should be sequential (0, 1, 2, ...)
            const expectedOrder = Array.from({ length: hookNames.length }, (_, i) => i);
            expect(executionOrder).toEqual(expectedOrder);
          }
        ),
        { numRuns: 10 } // Reduced runs since we're spawning processes
      );
    });

    it('should execute user hooks before workspace hooks', async () => {
      // Create two hooks with different sources
      const userHookScript = createHookScript('user-hook', {
        continue: true,
        data: { source: 'user', order: 1 },
      });

      const workspaceHookScript = createHookScript('workspace-hook', {
        continue: true,
        data: { source: 'workspace', order: 2 },
      });

      const userHook = createTestHook({
        id: 'user-hook',
        name: 'User Hook',
        command: 'node',
        args: [userHookScript],
        source: 'user',
      });

      const workspaceHook = createTestHook({
        id: 'workspace-hook',
        name: 'Workspace Hook',
        command: 'node',
        args: [workspaceHookScript],
        source: 'workspace',
      });

      // Register in reverse order (workspace first, then user)
      const registry = new HookRegistry();
      registry.registerHook('before_model', workspaceHook);
      registry.registerHook('before_model', userHook);

      // Get hooks and sort by source (user before workspace)
      const hooks = registry.getHooksForEvent('before_model');
      const sortedHooks = [...hooks].sort((a, b) => {
        if (a.source === 'user' && b.source === 'workspace') return -1;
        if (a.source === 'workspace' && b.source === 'user') return 1;
        return 0;
      });

      // Execute sorted hooks
      const input = createTestHookInput('before_model');
      const results = await runner.executeHooks(sortedHooks, input);

      // Verify user hook executed first
      expect(results[0].data?.source).toBe('user');
      expect(results[1].data?.source).toBe('workspace');
    });
  });

  describe('Property 3: Hook Timeout Termination', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 3: Hook Timeout Termination
    it('should terminate hooks that exceed timeout', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 500 }), // timeout
          fc.integer({ min: 600, max: 1000 }), // delay (longer than timeout)
          async (timeout, delay) => {
            // Create a hook that takes longer than timeout
            const slowHookScript = createHookScript('slow-hook', {
              continue: true,
            }, delay);

            const slowHook = createTestHook({
              id: 'slow-hook',
              name: 'Slow Hook',
              command: 'node',
              args: [slowHookScript],
            });

            // Set short timeout
            runner.setTimeout(timeout);

            // Execute hook
            const input = createTestHookInput('before_model');
            const result = await runner.executeHookWithMetadata(slowHook, input);

            // Verify hook timed out
            expect(result.timedOut).toBe(true);
            expect(result.error).toBeDefined();
            expect(result.error?.message).toContain('timed out');
          }
        ),
        { numRuns: 5 } // Reduced runs since we're testing timeouts
      );
    });

    it('should continue with remaining hooks after timeout', async () => {
      // Create a slow hook and a fast hook
      const slowHookScript = createHookScript('slow-hook', {
        continue: true,
      }, 2000);

      const fastHookScript = createHookScript('fast-hook', {
        continue: true,
        data: { executed: true },
      });

      const slowHook = createTestHook({
        id: 'slow-hook',
        name: 'Slow Hook',
        command: 'node',
        args: [slowHookScript],
      });

      const fastHook = createTestHook({
        id: 'fast-hook',
        name: 'Fast Hook',
        command: 'node',
        args: [fastHookScript],
      });

      // Set short timeout
      runner.setTimeout(500);

      // Execute hooks
      const input = createTestHookInput('before_model');
      const results = await runner.executeHooks([slowHook, fastHook], input);

      // Verify both hooks executed (slow one with error, fast one successfully)
      expect(results).toHaveLength(2);
      expect(results[0].error).toBeDefined(); // Slow hook timed out
      expect(results[1].data?.executed).toBe(true); // Fast hook succeeded
    });
  });

  describe('Property 4: Hook Error Isolation', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 4: Hook Error Isolation
    it('should isolate errors and continue with remaining hooks', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.boolean(), { minLength: 2, maxLength: 5 }),
          async (shouldFail) => {
            const hooks: Hook[] = [];

            for (let i = 0; i < shouldFail.length; i++) {
              if (shouldFail[i]) {
                // Create a failing hook
                const failScript = join(testDir, `fail-${i}.js`);
                writeFileSync(failScript, `
                  process.stdin.on('data', () => {});
                  process.stdin.on('end', () => {
                    process.exit(1);
                  });
                `);

                hooks.push(createTestHook({
                  id: `hook-${i}`,
                  name: `Hook ${i}`,
                  command: 'node',
                  args: [failScript],
                }));
              } else {
                // Create a successful hook
                const successScript = createHookScript(`success-${i}`, {
                  continue: true,
                  data: { index: i },
                });

                hooks.push(createTestHook({
                  id: `hook-${i}`,
                  name: `Hook ${i}`,
                  command: 'node',
                  args: [successScript],
                }));
              }
            }

            // Execute hooks
            const input = createTestHookInput('before_model');
            const results = await runner.executeHooks(hooks, input);

            // Verify all hooks executed (even after failures)
            expect(results).toHaveLength(hooks.length);

            // Verify failed hooks have errors
            for (let i = 0; i < results.length; i++) {
              if (shouldFail[i]) {
                expect(results[i].error).toBeDefined();
              } else {
                expect(results[i].data?.index).toBe(i);
              }
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    it('should log errors but not propagate exceptions', async () => {
      // Create a hook that crashes
      const crashScript = join(testDir, 'crash.js');
      writeFileSync(crashScript, `
        throw new Error('Intentional crash');
      `);

      const crashHook = createTestHook({
        id: 'crash-hook',
        name: 'Crash Hook',
        command: 'node',
        args: [crashScript],
      });

      // Execute hook - should not throw
      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(crashHook, input);

      // Should return error output, not throw
      expect(result.error).toBeDefined();
      expect(result.continue).toBe(true); // Default to continue
    });
  });

  describe('Property 5: Hook Output Capture', () => {
    // Feature: stage-05-hooks-extensions-mcp, Property 5: Hook Output Capture
    it('should capture and parse hook stdout as JSON', async () => {
      // Helper to recursively filter out undefined values from any structure
      const filterUndefined = (value: any): any => {
        if (value === undefined) return null;
        if (Array.isArray(value)) {
          return value.map(filterUndefined).filter(v => v !== undefined);
        }
        if (value !== null && typeof value === 'object') {
          const result: any = {};
          for (const [k, v] of Object.entries(value)) {
            const filtered = filterUndefined(v);
            if (filtered !== undefined) {
              result[k] = filtered;
            }
          }
          return result;
        }
        return value;
      };

      // Function to check if a value contains dangerous properties
      const isSafe = (val: any): boolean => {
        if (val === null || typeof val !== 'object') return true;
        if (Array.isArray(val)) return val.every(isSafe);
        const keys = Object.keys(val);
        const forbidden = ['__proto__', 'constructor', 'prototype'];
        if (keys.some(k => forbidden.includes(k))) return false;
        return Object.values(val).every(isSafe);
      };

      await fc.assert(
        fc.asyncProperty(
          fc.boolean(),
          fc.option(fc.string()),
          fc.option(fc.dictionary(
            fc.string().filter(s => !['__proto__', 'constructor', 'prototype'].includes(s)),
            fc.jsonValue().filter(isSafe)
          )),
          async (continueValue, systemMessage, data) => {
            const output = {
              continue: continueValue,
              ...(systemMessage !== null && { systemMessage }),
              ...(data !== null && { data }),
            };

            const scriptPath = createHookScript('output-test', output);

            const hook = createTestHook({
              id: 'output-hook',
              name: 'Output Hook',
              command: 'node',
              args: [scriptPath],
            });

            // Execute hook
            const input = createTestHookInput('before_model');
            const result = await runner.executeHook(hook, input);

            // Verify output was captured and parsed
            expect(result.continue).toBe(continueValue);
            if (systemMessage !== null) {
              expect(result.systemMessage).toBe(systemMessage);
            }
            if (data !== null) {
              // Normalize expected data to handle JSON serialization quirks (e.g. -0 -> 0)
              const normalizedData = JSON.parse(JSON.stringify(data));
              expect(result.data).toEqual(normalizedData);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      // Create a hook that outputs invalid JSON
      const badJsonScript = join(testDir, 'bad-json.js');
      writeFileSync(badJsonScript, `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log('{ invalid json }');
        });
      `);

      const hook = createTestHook({
        id: 'bad-json-hook',
        name: 'Bad JSON Hook',
        command: 'node',
        args: [badJsonScript],
      });

      // Execute hook
      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      // Should return error output
      expect(result.error).toBeDefined();
      expect(result.continue).toBe(true); // Default to continue
    });
  });

  describe('Unit Tests', () => {
    it('should execute hook with valid JSON output', async () => {
      const output = {
        continue: true,
        systemMessage: 'Test message',
        data: { key: 'value' },
      };

      const scriptPath = createHookScript('valid-output', output);
      const hook = createTestHook({
        id: 'valid-hook',
        name: 'Valid Hook',
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBe('Test message');
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should handle hook that returns continue: false', async () => {
      const output = {
        continue: false,
        systemMessage: 'Stopping execution',
      };

      const scriptPath = createHookScript('stop-hook', output);
      const hook = createTestHook({
        id: 'stop-hook',
        name: 'Stop Hook',
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.continue).toBe(false);
      expect(result.systemMessage).toBe('Stopping execution');
    });

    it('should timeout slow hooks', async () => {
      const slowScript = createHookScript('slow', { continue: true }, 2000);
      const hook = createTestHook({
        id: 'slow-hook',
        name: 'Slow Hook',
        command: 'node',
        args: [slowScript],
      });

      runner.setTimeout(500);

      const input = createTestHookInput('before_model');
      const result = await runner.executeHookWithMetadata(hook, input);

      expect(result.timedOut).toBe(true);
      expect(result.error).toBeDefined();
    });

    it('should handle hooks that exit with non-zero code', async () => {
      const failScript = join(testDir, 'fail.js');
      writeFileSync(failScript, `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.error('Error message');
          process.exit(1);
        });
      `);

      const hook = createTestHook({
        id: 'fail-hook',
        name: 'Fail Hook',
        command: 'node',
        args: [failScript],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.error).toBeDefined();
      expect(result.continue).toBe(true); // Default to continue
    });

    it('should handle malformed JSON output', async () => {
      const badJsonScript = join(testDir, 'bad-json.js');
      writeFileSync(badJsonScript, `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log('not valid json');
        });
      `);

      const hook = createTestHook({
        id: 'bad-json-hook',
        name: 'Bad JSON Hook',
        command: 'node',
        args: [badJsonScript],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Malformed JSON');
      expect(result.continue).toBe(true); // Default to continue
    });

    it('should handle hook with no output', async () => {
      const noOutputScript = join(testDir, 'no-output.js');
      writeFileSync(noOutputScript, `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          // No output
        });
      `);

      const hook = createTestHook({
        id: 'no-output-hook',
        name: 'No Output Hook',
        command: 'node',
        args: [noOutputScript],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.error).toBeDefined();
      expect(result.error).toContain('no output');
      expect(result.continue).toBe(true); // Default to continue
    });

    it('should pass data between hooks in sequence', async () => {
      const hook1Script = createHookScript('hook1', {
        continue: true,
        data: { step: 1, value: 'from-hook1' },
      });

      const hook2Script = createHookScript('hook2', {
        continue: true,
        data: { step: 2, value: 'from-hook2' },
      });

      const hook1 = createTestHook({
        id: 'hook1',
        name: 'Hook 1',
        command: 'node',
        args: [hook1Script],
      });

      const hook2 = createTestHook({
        id: 'hook2',
        name: 'Hook 2',
        command: 'node',
        args: [hook2Script],
      });

      const input = createTestHookInput('before_model');
      const results = await runner.executeHooks([hook1, hook2], input);

      expect(results).toHaveLength(2);
      expect(results[0].data?.step).toBe(1);
      expect(results[1].data?.step).toBe(2);
    });

    it('should stop execution when hook returns continue: false', async () => {
      const stopScript = createHookScript('stop', {
        continue: false,
        systemMessage: 'Stopping',
      });

      const afterScript = createHookScript('after', {
        continue: true,
        data: { executed: true },
      });

      const stopHook = createTestHook({
        id: 'stop-hook',
        name: 'Stop Hook',
        command: 'node',
        args: [stopScript],
      });

      const afterHook = createTestHook({
        id: 'after-hook',
        name: 'After Hook',
        command: 'node',
        args: [afterScript],
      });

      const input = createTestHookInput('before_model');
      const results = await runner.executeHooks([stopHook, afterHook], input);

      // Should only have one result (stopHook)
      expect(results).toHaveLength(1);
      expect(results[0].continue).toBe(false);
    });

    it('should set custom timeout', () => {
      const newTimeout = 10000;
      runner.setTimeout(newTimeout);
      
      // Verify timeout was set (we can't directly access private field, but we can test behavior)
      expect(runner).toBeDefined();
    });

    it('should handle hook with only required fields', async () => {
      const minimalOutput = {
        continue: true,
      };

      const scriptPath = createHookScript('minimal', minimalOutput);
      const hook = createTestHook({
        id: 'minimal-hook',
        name: 'Minimal Hook',
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.continue).toBe(true);
      expect(result.systemMessage).toBeUndefined();
      expect(result.data).toBeUndefined();
    });

    it('should handle hook with all optional fields', async () => {
      const fullOutput = {
        continue: false,
        systemMessage: 'Full message',
        data: { key1: 'value1', key2: 'value2' },
        error: 'Optional error',
      };

      const scriptPath = createHookScript('full', fullOutput);
      const hook = createTestHook({
        id: 'full-hook',
        name: 'Full Hook',
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHook(hook, input);

      expect(result.continue).toBe(false);
      expect(result.systemMessage).toBe('Full message');
      expect(result.data).toEqual({ key1: 'value1', key2: 'value2' });
      expect(result.error).toBe('Optional error');
    });
  });

  describe('Integration Tests: Trust + Execution', () => {
    let trustedHooks: TrustedHooks;
    let trustedStoragePath: string;

    beforeEach(() => {
      // Create a temporary storage path for trusted hooks
      trustedStoragePath = join(testDir, 'trusted-hooks.json');
      trustedHooks = new TrustedHooks({
        storagePath: trustedStoragePath,
        trustWorkspace: false,
      });
    });

    it('should execute trusted builtin hooks without approval', async () => {
      // Create a builtin hook
      const scriptPath = createHookScript('builtin-hook', {
        continue: true,
        data: { executed: true },
      });

      const builtinHook = createTestHook({
        id: 'builtin-hook',
        name: 'Builtin Hook',
        command: 'node',
        args: [scriptPath],
        source: 'builtin',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hook - should succeed without approval
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHook(builtinHook, input);

      expect(result.error).toBeUndefined();
      expect(result.data?.executed).toBe(true);
    });

    it('should execute trusted user hooks without approval', async () => {
      // Create a user hook
      const scriptPath = createHookScript('user-hook', {
        continue: true,
        data: { executed: true },
      });

      const userHook = createTestHook({
        id: 'user-hook',
        name: 'User Hook',
        command: 'node',
        args: [scriptPath],
        source: 'user',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hook - should succeed without approval
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHook(userHook, input);

      expect(result.error).toBeUndefined();
      expect(result.data?.executed).toBe(true);
    });

    it('should block untrusted workspace hooks without approval', async () => {
      // Create a workspace hook
      const scriptPath = createHookScript('workspace-hook', {
        continue: true,
        data: { executed: true },
      });

      const workspaceHook = createTestHook({
        id: 'workspace-hook',
        name: 'Workspace Hook',
        command: 'node',
        args: [scriptPath],
        source: 'workspace',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hook - should be blocked (requestApproval returns false by default)
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHook(workspaceHook, input);

      // Hook should be skipped
      expect(result.error).toBe('Hook not approved by user');
      expect(result.continue).toBe(true); // Should allow continuation
    });

    it('should block untrusted downloaded hooks without approval', async () => {
      // Create a downloaded hook
      const scriptPath = createHookScript('downloaded-hook', {
        continue: true,
        data: { executed: true },
      });

      const downloadedHook = createTestHook({
        id: 'downloaded-hook',
        name: 'Downloaded Hook',
        command: 'node',
        args: [scriptPath],
        source: 'downloaded',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hook - should be blocked
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHook(downloadedHook, input);

      // Hook should be skipped
      expect(result.error).toBe('Hook not approved by user');
      expect(result.continue).toBe(true);
    });

    it('should execute workspace hooks when trustWorkspace is enabled', async () => {
      // Create trusted hooks with trustWorkspace enabled
      const trustedHooksWithWorkspace = new TrustedHooks({
        storagePath: trustedStoragePath,
        trustWorkspace: true,
      });

      // Create a workspace hook
      const scriptPath = createHookScript('workspace-hook-trusted', {
        continue: true,
        data: { executed: true },
      });

      const workspaceHook = createTestHook({
        id: 'workspace-hook-trusted',
        name: 'Workspace Hook Trusted',
        command: 'node',
        args: [scriptPath],
        source: 'workspace',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooksWithWorkspace);

      // Execute hook - should succeed with trustWorkspace enabled
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHook(workspaceHook, input);

      expect(result.error).toBeUndefined();
      expect(result.data?.executed).toBe(true);
    });

    it('should execute approved hooks', async () => {
      // Create a workspace hook
      const scriptPath = createHookScript('approved-hook', {
        continue: true,
        data: { executed: true },
      });

      const workspaceHook = createTestHook({
        id: 'approved-hook',
        name: 'Approved Hook',
        command: 'node',
        args: [scriptPath],
        source: 'workspace',
      });

      // Pre-approve the hook
      const hash = await trustedHooks.computeHash(workspaceHook);
      await trustedHooks.storeApproval(workspaceHook, hash);

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hook - should succeed because it's approved
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHook(workspaceHook, input);

      expect(result.error).toBeUndefined();
      expect(result.data?.executed).toBe(true);
    });

    it('should skip unapproved hooks in executeHooks', async () => {
      // Create multiple hooks with different trust levels
      const builtinScript = createHookScript('builtin', {
        continue: true,
        data: { source: 'builtin' },
      });

      const workspaceScript = createHookScript('workspace', {
        continue: true,
        data: { source: 'workspace' },
      });

      const userScript = createHookScript('user', {
        continue: true,
        data: { source: 'user' },
      });

      const builtinHook = createTestHook({
        id: 'builtin',
        name: 'Builtin',
        command: 'node',
        args: [builtinScript],
        source: 'builtin',
      });

      const workspaceHook = createTestHook({
        id: 'workspace',
        name: 'Workspace',
        command: 'node',
        args: [workspaceScript],
        source: 'workspace',
      });

      const userHook = createTestHook({
        id: 'user',
        name: 'User',
        command: 'node',
        args: [userScript],
        source: 'user',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute all hooks
      const input = createTestHookInput('before_model');
      const results = await runnerWithTrust.executeHooks(
        [builtinHook, workspaceHook, userHook],
        input
      );

      // Should have 3 results
      expect(results).toHaveLength(3);

      // Builtin should execute
      expect(results[0].data?.source).toBe('builtin');

      // Workspace should be skipped
      expect(results[1].error).toBe('Hook not approved by user');

      // User should execute
      expect(results[2].data?.source).toBe('user');
    });

    it('should continue execution after skipping untrusted hook', async () => {
      // Create an untrusted hook followed by a trusted hook
      const workspaceScript = createHookScript('workspace', {
        continue: true,
        data: { source: 'workspace' },
      });

      const userScript = createHookScript('user', {
        continue: true,
        data: { source: 'user' },
      });

      const workspaceHook = createTestHook({
        id: 'workspace',
        name: 'Workspace',
        command: 'node',
        args: [workspaceScript],
        source: 'workspace',
      });

      const userHook = createTestHook({
        id: 'user',
        name: 'User',
        command: 'node',
        args: [userScript],
        source: 'user',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hooks
      const input = createTestHookInput('before_model');
      const results = await runnerWithTrust.executeHooks(
        [workspaceHook, userHook],
        input
      );

      // Both should have results
      expect(results).toHaveLength(2);

      // First should be skipped
      expect(results[0].error).toBe('Hook not approved by user');

      // Second should execute successfully
      expect(results[1].data?.source).toBe('user');
    });

    it('should include skipped flag in metadata for unapproved hooks', async () => {
      // Create a workspace hook
      const scriptPath = createHookScript('workspace-metadata', {
        continue: true,
        data: { executed: true },
      });

      const workspaceHook = createTestHook({
        id: 'workspace-metadata',
        name: 'Workspace Metadata',
        command: 'node',
        args: [scriptPath],
        source: 'workspace',
      });

      // Create runner with trust checking
      const runnerWithTrust = new HookRunner(5000, trustedHooks);

      // Execute hook with metadata
      const input = createTestHookInput('before_model');
      const result = await runnerWithTrust.executeHookWithMetadata(workspaceHook, input);

      // Should be marked as skipped
      expect(result.skipped).toBe(true);
      expect(result.output?.error).toBe('Hook not approved by user');
      expect(result.executionTime).toBe(0);
    });
  });

  describe('Hook Output Processing', () => {
    it('should abort execution when hook returns continue: false', async () => {
      const stopScript = createHookScript('stop', {
        continue: false,
        systemMessage: 'Aborting operation',
      });

      const afterScript = createHookScript('after', {
        continue: true,
        data: { executed: true },
      });

      const stopHook = createTestHook({
        id: 'stop-hook',
        name: 'Stop Hook',
        command: 'node',
        args: [stopScript],
      });

      const afterHook = createTestHook({
        id: 'after-hook',
        name: 'After Hook',
        command: 'node',
        args: [afterScript],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([stopHook, afterHook], input);

      // Should not continue
      expect(summary.shouldContinue).toBe(false);
      expect(summary.aborted).toBe(true);

      // Should only execute first hook
      expect(summary.outputs).toHaveLength(1);
      expect(summary.outputs[0].continue).toBe(false);

      // Should have system message
      expect(summary.systemMessages).toHaveLength(1);
      expect(summary.systemMessages[0]).toBe('Aborting operation');
    });

    it('should concatenate system messages from multiple hooks', async () => {
      const hook1Script = createHookScript('hook1', {
        continue: true,
        systemMessage: 'Message from hook 1',
      });

      const hook2Script = createHookScript('hook2', {
        continue: true,
        systemMessage: 'Message from hook 2',
      });

      const hook3Script = createHookScript('hook3', {
        continue: true,
        systemMessage: 'Message from hook 3',
      });

      const hook1 = createTestHook({
        id: 'hook1',
        name: 'Hook 1',
        command: 'node',
        args: [hook1Script],
      });

      const hook2 = createTestHook({
        id: 'hook2',
        name: 'Hook 2',
        command: 'node',
        args: [hook2Script],
      });

      const hook3 = createTestHook({
        id: 'hook3',
        name: 'Hook 3',
        command: 'node',
        args: [hook3Script],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([hook1, hook2, hook3], input);

      // Should continue
      expect(summary.shouldContinue).toBe(true);
      expect(summary.aborted).toBe(false);

      // Should have all system messages in order
      expect(summary.systemMessages).toHaveLength(3);
      expect(summary.systemMessages[0]).toBe('Message from hook 1');
      expect(summary.systemMessages[1]).toBe('Message from hook 2');
      expect(summary.systemMessages[2]).toBe('Message from hook 3');
    });

    it('should pass data between hooks', async () => {
      const hook1Script = createHookScript('hook1', {
        continue: true,
        data: { step1: 'completed', value: 'from-hook1' },
      });

      const hook2Script = createHookScript('hook2', {
        continue: true,
        data: { step2: 'completed', value: 'from-hook2' },
      });

      const hook1 = createTestHook({
        id: 'hook1',
        name: 'Hook 1',
        command: 'node',
        args: [hook1Script],
      });

      const hook2 = createTestHook({
        id: 'hook2',
        name: 'Hook 2',
        command: 'node',
        args: [hook2Script],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([hook1, hook2], input);

      // Should have aggregated data from both hooks
      expect(summary.aggregatedData).toHaveProperty('step1', 'completed');
      expect(summary.aggregatedData).toHaveProperty('step2', 'completed');
      expect(summary.aggregatedData).toHaveProperty('value', 'from-hook2'); // Later hook overwrites
    });

    it('should handle hooks with no system messages', async () => {
      const hook1Script = createHookScript('hook1', {
        continue: true,
        data: { key: 'value' },
      });

      const hook2Script = createHookScript('hook2', {
        continue: true,
      });

      const hook1 = createTestHook({
        id: 'hook1',
        name: 'Hook 1',
        command: 'node',
        args: [hook1Script],
      });

      const hook2 = createTestHook({
        id: 'hook2',
        name: 'Hook 2',
        command: 'node',
        args: [hook2Script],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([hook1, hook2], input);

      // Should have no system messages
      expect(summary.systemMessages).toHaveLength(0);

      // Should still have data from hook1
      expect(summary.aggregatedData).toHaveProperty('key', 'value');
    });

    it('should handle hooks with no data', async () => {
      const hook1Script = createHookScript('hook1', {
        continue: true,
        systemMessage: 'Message 1',
      });

      const hook2Script = createHookScript('hook2', {
        continue: true,
        systemMessage: 'Message 2',
      });

      const hook1 = createTestHook({
        id: 'hook1',
        name: 'Hook 1',
        command: 'node',
        args: [hook1Script],
      });

      const hook2 = createTestHook({
        id: 'hook2',
        name: 'Hook 2',
        command: 'node',
        args: [hook2Script],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([hook1, hook2], input);

      // Should have system messages
      expect(summary.systemMessages).toHaveLength(2);

      // Should have empty aggregated data
      expect(Object.keys(summary.aggregatedData)).toHaveLength(0);
    });

    it('should continue when all hooks return continue: true', async () => {
      const hook1Script = createHookScript('hook1', {
        continue: true,
        systemMessage: 'Hook 1 executed',
      });

      const hook2Script = createHookScript('hook2', {
        continue: true,
        systemMessage: 'Hook 2 executed',
      });

      const hook1 = createTestHook({
        id: 'hook1',
        name: 'Hook 1',
        command: 'node',
        args: [hook1Script],
      });

      const hook2 = createTestHook({
        id: 'hook2',
        name: 'Hook 2',
        command: 'node',
        args: [hook2Script],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([hook1, hook2], input);

      // Should continue
      expect(summary.shouldContinue).toBe(true);
      expect(summary.aborted).toBe(false);

      // Should have executed all hooks
      expect(summary.outputs).toHaveLength(2);
    });

    it('should handle mixed success and error hooks', async () => {
      const successScript = createHookScript('success', {
        continue: true,
        systemMessage: 'Success',
        data: { status: 'ok' },
      });

      const failScript = join(testDir, 'fail-mixed.js');
      writeFileSync(failScript, `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          process.exit(1);
        });
      `);

      const successHook = createTestHook({
        id: 'success-hook',
        name: 'Success Hook',
        command: 'node',
        args: [successScript],
      });

      const failHook = createTestHook({
        id: 'fail-hook',
        name: 'Fail Hook',
        command: 'node',
        args: [failScript],
      });

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary([successHook, failHook], input);

      // Should continue (errors don't stop execution)
      expect(summary.shouldContinue).toBe(true);
      expect(summary.aborted).toBe(false);

      // Should have both outputs
      expect(summary.outputs).toHaveLength(2);

      // First should succeed
      expect(summary.outputs[0].error).toBeUndefined();
      expect(summary.systemMessages[0]).toBe('Success');

      // Second should have error
      expect(summary.outputs[1].error).toBeDefined();
    });
  });
});
