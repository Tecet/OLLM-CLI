/**
 * Unit and integration tests for HookRunner
 * Tests hook execution, timeout handling, error handling, and security
 *
 * Feature: v0.1.0 Debugging and Polishing
 * Task: 39. Add Hook System Tests
 */

import { writeFile, mkdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { HookRunner } from '../hookRunner.js';
import { TrustedHooks } from '../trustedHooks.js';
import { createTestHook, createTestHookInput } from './test-helpers.js';

describe('HookRunner - Unit Tests', () => {
  let runner: HookRunner;
  let testDir: string;

  beforeEach(async () => {
    runner = new HookRunner(5000); // 5 second timeout for tests

    // Create temporary directory for test hooks
    testDir = join(tmpdir(), `hook-runner-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Hook Execution', () => {
    it('should execute a simple hook successfully', async () => {
      // Create a simple hook script that outputs valid JSON
      const scriptPath = join(testDir, 'simple-hook.js');
      const scriptContent = `
        const input = '';
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Hook executed' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
        source: 'user',
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.systemMessage).toBe('Hook executed');
    });

    it('should pass input data to hook via stdin', async () => {
      const scriptPath = join(testDir, 'echo-hook.js');
      const scriptContent = `
        let inputData = '';
        process.stdin.on('data', (chunk) => {
          inputData += chunk;
        });
        process.stdin.on('end', () => {
          const input = JSON.parse(inputData);
          console.log(JSON.stringify({
            continue: true,
            data: { receivedEvent: input.event }
          }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model', { testData: 'value' });
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.data?.receivedEvent).toBe('before_model');
    });

    it('should handle hook that returns continue: false', async () => {
      const scriptPath = join(testDir, 'abort-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: false, systemMessage: 'Operation aborted' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_tool');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(false);
      expect(output.systemMessage).toBe('Operation aborted');
    });

    it('should execute multiple hooks in sequence', async () => {
      const script1Path = join(testDir, 'hook1.js');
      const script1Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, data: { hook1: 'executed' } }));
        });
      `;
      await writeFile(script1Path, script1Content);

      const script2Path = join(testDir, 'hook2.js');
      const script2Content = `
        let inputData = '';
        process.stdin.on('data', (chunk) => { inputData += chunk; });
        process.stdin.on('end', () => {
          const input = JSON.parse(inputData);
          console.log(JSON.stringify({
            continue: true,
            data: { hook2: 'executed', receivedFromHook1: input.data.hook1 }
          }));
        });
      `;
      await writeFile(script2Path, script2Content);

      const hooks = [
        createTestHook({ id: 'hook-1', command: 'node', args: [script1Path] }),
        createTestHook({ id: 'hook-2', command: 'node', args: [script2Path] }),
      ];

      const input = createTestHookInput('before_model');
      const outputs = await runner.executeHooks(hooks, input);

      expect(outputs).toHaveLength(2);
      expect(outputs[0].data?.hook1).toBe('executed');
      expect(outputs[1].data?.hook2).toBe('executed');
      expect(outputs[1].data?.receivedFromHook1).toBe('executed');
    });

    it('should stop execution when hook returns continue: false', async () => {
      const script1Path = join(testDir, 'hook1.js');
      const script1Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: false, systemMessage: 'Stopped' }));
        });
      `;
      await writeFile(script1Path, script1Content);

      const script2Path = join(testDir, 'hook2.js');
      const script2Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Should not execute' }));
        });
      `;
      await writeFile(script2Path, script2Content);

      const hooks = [
        createTestHook({ id: 'hook-1', command: 'node', args: [script1Path] }),
        createTestHook({ id: 'hook-2', command: 'node', args: [script2Path] }),
      ];

      const input = createTestHookInput('before_model');
      const outputs = await runner.executeHooks(hooks, input);

      expect(outputs).toHaveLength(1);
      expect(outputs[0].continue).toBe(false);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running hooks', async () => {
      const scriptPath = join(testDir, 'slow-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          // Sleep for 10 seconds (longer than timeout)
          setTimeout(() => {
            console.log(JSON.stringify({ continue: true }));
          }, 10000);
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      // Set short timeout for this test
      runner.setTimeout(1000); // 1 second

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      // Hook should return error output on timeout
      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
      expect(output.error).toContain('timed out');
    });

    it('should allow configuring timeout', async () => {
      const scriptPath = join(testDir, 'medium-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          setTimeout(() => {
            console.log(JSON.stringify({ continue: true, systemMessage: 'Completed' }));
          }, 500);
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      // Set timeout longer than script execution time
      runner.setTimeout(2000);

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.systemMessage).toBe('Completed');
    });

    it('should include execution time in metadata', async () => {
      const scriptPath = join(testDir, 'timed-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          setTimeout(() => {
            console.log(JSON.stringify({ continue: true }));
          }, 100);
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const result = await runner.executeHookWithMetadata(hook, input);

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThanOrEqual(100);
      expect(result.timedOut).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle hook that exits with non-zero code', async () => {
      const scriptPath = join(testDir, 'error-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          process.exit(1);
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
      expect(output.error).toContain('exited with code 1');
    });

    it('should handle hook that produces no output', async () => {
      const scriptPath = join(testDir, 'silent-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          // Exit without output
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
      expect(output.error).toContain('no output');
    });

    it('should handle hook that produces invalid JSON', async () => {
      const scriptPath = join(testDir, 'invalid-json-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log('not valid json');
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
    });

    it('should handle hook that throws exception', async () => {
      const scriptPath = join(testDir, 'throw-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          throw new Error('Hook error');
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
    });

    it('should continue with remaining hooks after error', async () => {
      const script1Path = join(testDir, 'error-hook.js');
      const script1Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          process.exit(1);
        });
      `;
      await writeFile(script1Path, script1Content);

      const script2Path = join(testDir, 'success-hook.js');
      const script2Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Success' }));
        });
      `;
      await writeFile(script2Path, script2Content);

      const hooks = [
        createTestHook({ id: 'error', command: 'node', args: [script1Path] }),
        createTestHook({ id: 'success', command: 'node', args: [script2Path] }),
      ];

      const input = createTestHookInput('before_model');
      const outputs = await runner.executeHooks(hooks, input);

      expect(outputs).toHaveLength(2);
      expect(outputs[0].error).toBeDefined();
      expect(outputs[1].systemMessage).toBe('Success');
    });
  });

  describe('Security Validation', () => {
    it('should reject hooks with shell metacharacters in command', async () => {
      const hook = createTestHook({
        command: 'node; rm -rf /',
        args: [],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
      expect(output.error).toContain('Invalid characters');
    });

    it('should reject hooks with pipe characters', async () => {
      const hook = createTestHook({
        command: 'node | cat',
        args: [],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
    });

    it('should reject hooks with backticks', async () => {
      const hook = createTestHook({
        command: 'node `whoami`',
        args: [],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
    });

    it('should allow whitelisted commands without absolute paths', async () => {
      const whitelistedCommands = ['node', 'python', 'python3', 'bash', 'sh', 'npx', 'uvx'];

      for (const command of whitelistedCommands) {
        const scriptPath = join(testDir, 'test-hook.js');
        const scriptContent = `
          process.stdin.on('data', () => {});
          process.stdin.on('end', () => {
            console.log(JSON.stringify({ continue: true }));
          });
        `;
        await writeFile(scriptPath, scriptContent);

        const hook = createTestHook({
          command,
          args: [scriptPath],
        });

        const input = createTestHookInput('before_model');
        const output = await runner.executeHook(hook, input);

        // Should not have validation error
        if (output.error) {
          expect(output.error).not.toContain('Invalid characters');
          expect(output.error).not.toContain('absolute path');
        }
      }
    });

    it('should limit output size to prevent memory exhaustion', async () => {
      const scriptPath = join(testDir, 'large-output-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          // Try to output more than 1MB
          const largeString = 'x'.repeat(2 * 1024 * 1024);
          console.log(largeString);
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toBeDefined();
      expect(output.error).toContain('exceeded');
    });
  });

  describe('Hook Execution Summary', () => {
    it('should aggregate system messages from multiple hooks', async () => {
      const script1Path = join(testDir, 'hook1.js');
      const script1Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Message 1' }));
        });
      `;
      await writeFile(script1Path, script1Content);

      const script2Path = join(testDir, 'hook2.js');
      const script2Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Message 2' }));
        });
      `;
      await writeFile(script2Path, script2Content);

      const hooks = [
        createTestHook({ id: 'hook-1', command: 'node', args: [script1Path] }),
        createTestHook({ id: 'hook-2', command: 'node', args: [script2Path] }),
      ];

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary(hooks, input);

      expect(summary.systemMessages).toEqual(['Message 1', 'Message 2']);
      expect(summary.shouldContinue).toBe(true);
      expect(summary.aborted).toBe(false);
    });

    it('should aggregate data from multiple hooks', async () => {
      const script1Path = join(testDir, 'hook1.js');
      const script1Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, data: { key1: 'value1' } }));
        });
      `;
      await writeFile(script1Path, script1Content);

      const script2Path = join(testDir, 'hook2.js');
      const script2Content = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, data: { key2: 'value2' } }));
        });
      `;
      await writeFile(script2Path, script2Content);

      const hooks = [
        createTestHook({ id: 'hook-1', command: 'node', args: [script1Path] }),
        createTestHook({ id: 'hook-2', command: 'node', args: [script2Path] }),
      ];

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary(hooks, input);

      expect(summary.aggregatedData).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should set aborted flag when hook returns continue: false', async () => {
      const scriptPath = join(testDir, 'abort-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: false }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hooks = [createTestHook({ command: 'node', args: [scriptPath] })];

      const input = createTestHookInput('before_model');
      const summary = await runner.executeHooksWithSummary(hooks, input);

      expect(summary.shouldContinue).toBe(false);
      expect(summary.aborted).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should respect disabled hooks configuration', async () => {
      const runnerWithDisabledHooks = new HookRunner(5000, undefined, { enabled: false });

      const scriptPath = join(testDir, 'test-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Should not execute' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runnerWithDisabledHooks.executeHook(hook, input);

      expect(output.continue).toBe(true);
      expect(output.error).toContain('disabled');
    });

    it('should use configured timeout', async () => {
      const runnerWithShortTimeout = new HookRunner(5000, undefined, { timeout: 500 });

      const scriptPath = join(testDir, 'slow-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          setTimeout(() => {
            console.log(JSON.stringify({ continue: true }));
          }, 2000);
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
      });

      const input = createTestHookInput('before_model');
      const output = await runnerWithShortTimeout.executeHook(hook, input);

      expect(output.error).toBeDefined();
      expect(output.error).toContain('timed out');
    });
  });
});

describe('HookRunner - Integration Tests with TrustedHooks', () => {
  let runner: HookRunner;
  let trustedHooks: TrustedHooks;
  let testDir: string;
  let storageDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `hook-runner-integration-${Date.now()}`);
    storageDir = join(testDir, 'storage');
    await mkdir(testDir, { recursive: true });
    await mkdir(storageDir, { recursive: true });

    trustedHooks = new TrustedHooks({
      storagePath: join(storageDir, 'trusted-hooks.json'),
      trustWorkspace: false,
    });

    runner = new HookRunner(5000, trustedHooks);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('Trust Verification', () => {
    it('should execute builtin hooks without approval', async () => {
      const scriptPath = join(testDir, 'builtin-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Builtin executed' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
        source: 'builtin',
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.systemMessage).toBe('Builtin executed');
    });

    it('should execute user hooks without approval', async () => {
      const scriptPath = join(testDir, 'user-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'User executed' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
        source: 'user',
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.systemMessage).toBe('User executed');
    });

    it('should skip workspace hooks without approval', async () => {
      const scriptPath = join(testDir, 'workspace-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Should not execute' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
        source: 'workspace',
        sourcePath: scriptPath,
      });

      const input = createTestHookInput('before_model');
      const output = await runner.executeHook(hook, input);

      expect(output.error).toContain('not approved');
    });

    it('should execute workspace hooks with trustWorkspace enabled', async () => {
      const trustedHooksWithWorkspace = new TrustedHooks({
        storagePath: join(storageDir, 'trusted-hooks-workspace.json'),
        trustWorkspace: true,
      });

      const runnerWithWorkspaceTrust = new HookRunner(5000, trustedHooksWithWorkspace);

      const scriptPath = join(testDir, 'workspace-hook.js');
      const scriptContent = `
        process.stdin.on('data', () => {});
        process.stdin.on('end', () => {
          console.log(JSON.stringify({ continue: true, systemMessage: 'Workspace executed' }));
        });
      `;
      await writeFile(scriptPath, scriptContent);

      const hook = createTestHook({
        command: 'node',
        args: [scriptPath],
        source: 'workspace',
      });

      const input = createTestHookInput('before_model');
      const output = await runnerWithWorkspaceTrust.executeHook(hook, input);

      expect(output.systemMessage).toBe('Workspace executed');
    });
  });
});
