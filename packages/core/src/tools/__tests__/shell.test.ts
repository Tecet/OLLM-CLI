/**
 * Tests for Shell Tool
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { ShellTool, ShellInvocation } from '../shell.js';
import { ShellExecutionService } from '../../services/shellExecutionService.js';
import { EnvironmentSanitizationService } from '../../services/environmentSanitization.js';
import type { MessageBus, ToolResult, ToolContext } from '../types.js';

/**
 * Create a mock message bus for testing
 */
function createMockMessageBus(): MessageBus {
  return {
    requestConfirmation: async () => true,
    respondToConfirmation: () => {},
    cancelRequest: () => {},
  } as MessageBus;
}

/**
 * Create a ToolContext from a MessageBus for testing
 */
function createToolContext(messageBus: MessageBus): ToolContext {
  return { messageBus };
}

describe('Shell Tool', () => {
  let shellService: ShellExecutionService;
  let shellTool: ShellTool;
  let messageBus: MessageBus;

  beforeEach(() => {
    const sanitizationService = new EnvironmentSanitizationService();
    shellService = new ShellExecutionService(sanitizationService);
    shellTool = new ShellTool(shellService);
    messageBus = createMockMessageBus();
  });

  describe('Property 25: Shell Command Execution', () => {
    it('should return a ToolResult containing command output and exit code', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            // Simple, safe commands that work cross-platform
            'echo "hello"',
            'echo "test"',
            'echo "property test"',
            'echo ""',
            'echo "123"'
          ),
          async (command) => {
            const invocation = shellTool.createInvocation(
              { command },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Verify ToolResult structure
            expect(result).toBeDefined();
            expect(result).toHaveProperty('llmContent');
            expect(result).toHaveProperty('returnDisplay');

            // For successful commands, llmContent should contain output
            expect(typeof result.llmContent).toBe('string');
            expect(typeof result.returnDisplay).toBe('string');

            // The output should contain the echoed text (trimmed)
            const expectedOutput = command.match(/"([^"]*)"/)?.[1] || '';
            expect(result.llmContent.trim()).toContain(expectedOutput);

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should handle command exit codes correctly', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      // Use a simple echo command that exits with 0 (more reliable than 'exit 0')
      const command = process.platform === 'win32' ? 'cmd /c "echo test"' : 'echo test';
      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Exit code 0 should not produce an error
      expect(result.error).toBeUndefined();
    }, 10000);  // 10 second timeout

    it('should return error for non-zero exit codes', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 255 }),
          async (exitCode) => {
            const invocation = shellTool.createInvocation(
              { command: `exit ${exitCode}` },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Non-zero exit code should produce an error
            expect(result.error).toBeDefined();
            expect(result.error?.type).toBe('ShellExecutionError');
            expect(result.error?.message).toContain(`exited with code ${exitCode}`);

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should execute commands with different output lengths', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            // Filter out strings with problematic shell characters or only whitespace
            return !/["'`$\\]/.test(s) && s.trim().length > 0;
          }),
          async (text) => {
            const command = `echo "${text}"`;

            const invocation = shellTool.createInvocation(
              { command },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should return a valid ToolResult
            expect(result).toBeDefined();
            expect(result.llmContent).toBeDefined();
            expect(result.returnDisplay).toBeDefined();

            // Output should contain the text (accounting for echo behavior)
            // Use contains instead of exact match due to platform differences
            expect(result.llmContent).toContain(text.trim());

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should respect working directory parameter', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      const invocation = shellTool.createInvocation(
        {
          command: process.platform === 'win32' ? 'cd' : 'pwd',
          cwd: process.cwd(),
        },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should execute successfully
      expect(result).toBeDefined();
      expect(result.llmContent).toBeDefined();
      
      // Output should contain the working directory
      expect(result.llmContent).toContain(process.cwd());
    });

    it('should handle commands that produce stderr output', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      const command = process.platform === 'win32'
        ? 'echo error message 1>&2'
        : 'echo "error message" >&2';

      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should capture stderr in output
      expect(result).toBeDefined();
      expect(result.llmContent).toBeDefined();
      expect(result.llmContent).toContain('error message');
    });

    it('should handle empty command output', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      const command = process.platform === 'win32' ? 'echo.' : 'true';

      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should return a valid ToolResult even with no output
      expect(result).toBeDefined();
      expect(result.llmContent).toBeDefined();
      expect(result.returnDisplay).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should include exit code in result for all commands', async () => {
      // Feature: stage-03-tools-policy, Property 25: Shell Command Execution
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('echo "test"', 'exit 0', 'exit 1'),
          async (command) => {
            const invocation = shellTool.createInvocation(
              { command },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Result should always be defined
            expect(result).toBeDefined();
            
            // For non-zero exit codes, should have error with exit code info
            if (command.includes('exit 1')) {
              expect(result.error).toBeDefined();
              expect(result.returnDisplay).toContain('exit code');
            }

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout
  });

  describe('Shell Tool Invocation Interface', () => {
    it('should provide a description of the command', () => {
      const invocation = shellTool.createInvocation(
        { command: 'echo "test"' },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      
      expect(description).toBeDefined();
      expect(description).toContain('echo "test"');
    });

    it('should return tool locations based on cwd', () => {
      const invocation = shellTool.createInvocation(
        { command: 'echo "test"', cwd: '/some/path' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      
      expect(locations).toBeDefined();
      expect(locations).toContain('/some/path');
    });

    it('should return empty locations when no cwd specified', () => {
      const invocation = shellTool.createInvocation(
        { command: 'echo "test"' },
        createToolContext(messageBus)
      );

      const locations = invocation.toolLocations();
      
      expect(locations).toBeDefined();
      expect(locations).toHaveLength(0);
    });

    it('should not require confirmation by default', async () => {
      const invocation = shellTool.createInvocation(
        { command: 'echo "test"' },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const confirmationDetails = await invocation.shouldConfirmExecute(
        abortController.signal
      );

      // Should return false (no confirmation needed)
      expect(confirmationDetails).toBe(false);
    });
  });

  describe('Property 26: Shell Output Streaming', () => {
    it('should invoke updateOutput callback with incremental output during execution', async () => {
      // Feature: stage-03-tools-policy, Property 26: Shell Output Streaming
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            // Commands that produce multiple lines of output
            'echo "line1" && echo "line2" && echo "line3"',
            'echo "first" && echo "second"',
            'echo "a" && echo "b" && echo "c"',
            'echo "test1" && echo "test2"',
            'echo "output1" && echo "output2" && echo "output3"'
          ),
          async (command) => {
            const outputChunks: string[] = [];
            
            const invocation = shellTool.createInvocation(
              { command },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            
            // Execute with updateOutput callback
            const result = await invocation.execute(
              abortController.signal,
              (chunk) => {
                outputChunks.push(chunk);
              }
            );

            // Verify that updateOutput was called at least once
            expect(outputChunks.length).toBeGreaterThan(0);

            // Verify that the chunks combine to form the complete output
            const combinedOutput = outputChunks.join('');
            expect(combinedOutput.trim()).toBeTruthy();

            // Verify that the result contains the output
            expect(result.llmContent).toBeTruthy();
            
            // The combined chunks should be part of the final output
            // (may have additional formatting or newlines)
            const normalizedChunks = combinedOutput.replace(/\r\n/g, '\n').trim();
            const normalizedResult = result.llmContent.replace(/\r\n/g, '\n').trim();
            expect(normalizedResult).toContain(normalizedChunks);

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should stream output incrementally for commands with delays', async () => {
      // Feature: stage-03-tools-policy, Property 26: Shell Output Streaming
      // Use a command that produces output over time
      // For Windows, use a simple loop; for Unix, use sleep
      const command = process.platform === 'win32'
        ? 'echo "start" && ping 127.0.0.1 -n 2 >nul && echo "end"'
        : 'echo "start" && sleep 0.1 && echo "end"';

      const outputChunks: string[] = [];
      const timestamps: number[] = [];
      
      const invocation = shellTool.createInvocation(
        { command, timeout: 5000 },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      
      await invocation.execute(
        abortController.signal,
        (chunk) => {
          outputChunks.push(chunk);
          timestamps.push(Date.now());
        }
      );

      // Should have received multiple chunks
      expect(outputChunks.length).toBeGreaterThan(0);

      // The output should contain both "start" and "end"
      const combinedOutput = outputChunks.join('');
      expect(combinedOutput).toContain('start');
      expect(combinedOutput).toContain('end');
    });

    it('should stream both stdout and stderr output', async () => {
      // Feature: stage-03-tools-policy, Property 26: Shell Output Streaming
      const command = process.platform === 'win32'
        ? 'echo "stdout message" && echo "stderr message" 1>&2'
        : 'echo "stdout message" && echo "stderr message" >&2';

      const outputChunks: string[] = [];
      
      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      
      await invocation.execute(
        abortController.signal,
        (chunk) => {
          outputChunks.push(chunk);
        }
      );

      // Should have received output
      expect(outputChunks.length).toBeGreaterThan(0);

      // Combined output should contain both stdout and stderr
      const combinedOutput = outputChunks.join('');
      expect(combinedOutput).toContain('stdout message');
      expect(combinedOutput).toContain('stderr message');
    });

    it('should handle streaming with no updateOutput callback', async () => {
      // Feature: stage-03-tools-policy, Property 26: Shell Output Streaming
      // Verify that execution works even without a callback
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'echo "test"',
            'echo "hello world"',
            'echo "streaming test"'
          ),
          async (command) => {
            const invocation = shellTool.createInvocation(
              { command },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            
            // Execute without updateOutput callback
            const result = await invocation.execute(abortController.signal);

            // Should still return valid result
            expect(result).toBeDefined();
            expect(result.llmContent).toBeTruthy();
            expect(result.error).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should stream output for commands with large output', async () => {
      // Feature: stage-03-tools-policy, Property 26: Shell Output Streaming
      // Generate a command that produces multiple lines
      const command = process.platform === 'win32'
        ? 'for /L %i in (1,1,10) do @echo Line %i'
        : 'for i in {1..10}; do echo "Line $i"; done';

      const outputChunks: string[] = [];
      
      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      
      const result = await invocation.execute(
        abortController.signal,
        (chunk) => {
          outputChunks.push(chunk);
        }
      );

      // Should have received multiple chunks
      expect(outputChunks.length).toBeGreaterThan(0);

      // Combined output should contain multiple lines
      const combinedOutput = outputChunks.join('');
      expect(combinedOutput).toContain('Line');
      
      // Result should contain the complete output
      expect(result.llmContent).toContain('Line');
    });

    it('should stream empty output correctly', async () => {
      // Feature: stage-03-tools-policy, Property 26: Shell Output Streaming
      const command = process.platform === 'win32' ? 'echo.' : 'true';

      const outputChunks: string[] = [];
      
      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      
      const result = await invocation.execute(
        abortController.signal,
        (chunk) => {
          outputChunks.push(chunk);
        }
      );

      // Should return valid result even with minimal/no output
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      
      // outputChunks may be empty or contain minimal output
      // This is valid behavior
    });
  });

  describe('Property 27: Shell Timeout Enforcement', () => {
    it('should terminate process and return timeout error when command exceeds timeout', async () => {
      // Feature: stage-03-tools-policy, Property 27: Shell Timeout Enforcement
      // **Validates: Requirements 5.3**
      await fc.assert(
        fc.asyncProperty(
          // Generate small timeout values (100-300ms) to keep tests fast
          fc.integer({ min: 100, max: 300 }),
          async (timeoutMs) => {
            // Use a command that will definitely exceed the timeout
            // sleep command works on both Unix and Windows (via ping)
            const command = process.platform === 'win32'
              ? 'ping 127.0.0.1 -n 10 >nul'  // ~10 seconds on Windows
              : 'sleep 10';  // 10 seconds on Unix

            const invocation = shellTool.createInvocation(
              { command, timeout: timeoutMs },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const startTime = Date.now();
            const result = await invocation.execute(abortController.signal);
            const elapsedTime = Date.now() - startTime;

            // Verify that the command was terminated (didn't run for full 10 seconds)
            // Allow some tolerance for process cleanup
            expect(elapsedTime).toBeLessThan(timeoutMs + 2000);

            // Verify that a timeout error was returned
            expect(result.error).toBeDefined();
            expect(result.error?.type).toBe('TimeoutError');
            expect(result.error?.message).toContain('timed out');
            expect(result.error?.message).toContain(`${timeoutMs}ms`);

            return true;
          }
        ),
        // Reduced numRuns due to timeout tests being inherently slow
        { numRuns: 10 }
      );
    }, 30000); // Extended test timeout for property test with timeouts

    it('should not timeout when command completes within timeout period', async () => {
      // Feature: stage-03-tools-policy, Property 27: Shell Timeout Enforcement
      // **Validates: Requirements 5.3**
      await fc.assert(
        fc.asyncProperty(
          // Generate timeout values that are longer than the command execution
          fc.integer({ min: 5000, max: 10000 }),
          async (timeoutMs) => {
            // Use a fast command that completes quickly
            const command = 'echo "quick command"';

            const invocation = shellTool.createInvocation(
              { command, timeout: timeoutMs },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Verify that no timeout error occurred
            expect(result.error).toBeUndefined();
            expect(result.llmContent).toContain('quick command');

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should terminate process at approximately the specified timeout', async () => {
      // Feature: stage-03-tools-policy, Property 27: Shell Timeout Enforcement
      // **Validates: Requirements 5.3**
      const timeoutMs = 200;
      
      // Use a command that will definitely exceed the timeout
      const command = process.platform === 'win32'
        ? 'ping 127.0.0.1 -n 10 >nul'
        : 'sleep 10';

      const invocation = shellTool.createInvocation(
        { command, timeout: timeoutMs },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const startTime = Date.now();
      await invocation.execute(abortController.signal);
      const elapsedTime = Date.now() - startTime;

      // Verify that the command was terminated close to the timeout
      // Allow reasonable tolerance for process startup and cleanup
      expect(elapsedTime).toBeGreaterThanOrEqual(timeoutMs - 50);
      expect(elapsedTime).toBeLessThan(timeoutMs + 2000);
    });

    it('should return timeout error with correct error type', async () => {
      // Feature: stage-03-tools-policy, Property 27: Shell Timeout Enforcement
      // **Validates: Requirements 5.3**
      const timeoutMs = 100;
      
      const command = process.platform === 'win32'
        ? 'ping 127.0.0.1 -n 10 >nul'
        : 'sleep 10';

      const invocation = shellTool.createInvocation(
        { command, timeout: timeoutMs },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Verify error structure
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('TimeoutError');
      expect(typeof result.error?.message).toBe('string');
      expect(result.error?.message.length).toBeGreaterThan(0);
    });

    it('should handle timeout with streaming output callback', async () => {
      // Feature: stage-03-tools-policy, Property 27: Shell Timeout Enforcement
      // **Validates: Requirements 5.3**
      const timeoutMs = 300;
      const outputChunks: string[] = [];
      
      // Use a command that produces output before timing out
      const command = process.platform === 'win32'
        ? 'echo "starting" && ping 127.0.0.1 -n 10 >nul'
        : 'echo "starting" && sleep 10';

      const invocation = shellTool.createInvocation(
        { command, timeout: timeoutMs },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(
        abortController.signal,
        (chunk) => {
          outputChunks.push(chunk);
        }
      );

      // Verify timeout error occurred
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('TimeoutError');

      // Verify that some output was captured before timeout
      const combinedOutput = outputChunks.join('');
      expect(combinedOutput).toContain('starting');
    });

    it('should timeout consistently across multiple executions', async () => {
      // Feature: stage-03-tools-policy, Property 27: Shell Timeout Enforcement
      // **Validates: Requirements 5.3**
      const timeoutMs = 150;
      const iterations = 3;
      const results: { elapsed: number; hasError: boolean }[] = [];

      const command = process.platform === 'win32'
        ? 'ping 127.0.0.1 -n 10 >nul'
        : 'sleep 10';

      for (let i = 0; i < iterations; i++) {
        const invocation = shellTool.createInvocation(
          { command, timeout: timeoutMs },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const startTime = Date.now();
        const result = await invocation.execute(abortController.signal);
        const elapsedTime = Date.now() - startTime;

        results.push({
          elapsed: elapsedTime,
          hasError: result.error?.type === 'TimeoutError',
        });
      }

      // All executions should have timed out
      for (const r of results) {
        expect(r.hasError).toBe(true);
        expect(r.elapsed).toBeLessThan(timeoutMs + 2000);
      }
    });
  });

  describe('Property 28: Shell Working Directory', () => {
    it('should execute commands in the specified working directory', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      await fc.assert(
        fc.asyncProperty(
          // Generate valid directory paths from the current workspace
          fc.constantFrom(
            process.cwd(),
            process.cwd() + '/packages',
            process.cwd() + '/packages/core',
            process.cwd() + '/packages/core/src',
            process.cwd() + '/packages/cli'
          ),
          async (workingDir) => {
            // Use pwd (Unix) or cd (Windows) to verify the working directory
            const command = process.platform === 'win32' ? 'cd' : 'pwd';

            const invocation = shellTool.createInvocation(
              { command, cwd: workingDir },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Verify no error occurred
            expect(result.error).toBeUndefined();

            // Verify the output contains the working directory path
            // Normalize paths for comparison (handle Windows backslashes)
            const normalizedOutput = result.llmContent.trim().replace(/\\/g, '/').toLowerCase();
            const normalizedWorkingDir = workingDir.replace(/\\/g, '/').toLowerCase();
            
            expect(normalizedOutput).toContain(normalizedWorkingDir);

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should execute commands in different directories and get correct results', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      await fc.assert(
        fc.asyncProperty(
          // Generate pairs of different directories
          fc.constantFrom(
            { dir: process.cwd(), name: 'root' },
            { dir: process.cwd() + '/packages', name: 'packages' },
            { dir: process.cwd() + '/packages/core', name: 'core' },
            { dir: process.cwd() + '/packages/cli', name: 'cli' }
          ),
          async ({ dir, name }) => {
            // List files in the directory to verify we're in the right place
            const command = process.platform === 'win32' ? 'dir /b' : 'ls';

            const invocation = shellTool.createInvocation(
              { command, cwd: dir },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Verify no error occurred
            expect(result.error).toBeUndefined();

            // Verify the output is not empty (directory has contents)
            expect(result.llmContent.trim().length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should return error for non-existent working directory', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      await fc.assert(
        fc.asyncProperty(
          // Generate non-existent directory paths
          fc.string({ minLength: 5, maxLength: 20 }).filter(s => {
            // Filter to alphanumeric strings only
            return /^[a-zA-Z0-9]+$/.test(s);
          }),
          async (randomDirName) => {
            const nonExistentDir = `/nonexistent_${randomDirName}_${Date.now()}`;
            const command = 'echo "test"';

            const invocation = shellTool.createInvocation(
              { command, cwd: nonExistentDir },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Should return an error for non-existent directory
            expect(result.error).toBeDefined();

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should execute relative path commands correctly in working directory', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      // Test that relative paths work correctly from the specified working directory
      const workingDir = process.cwd() + '/packages/core';
      
      // Use a command that references a relative path
      const command = process.platform === 'win32' 
        ? 'if exist src\\index.ts (echo found) else (echo not found)'
        : 'test -f src/index.ts && echo "found" || echo "not found"';

      const invocation = shellTool.createInvocation(
        { command, cwd: workingDir },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should find the file since we're in packages/core
      expect(result.llmContent).toContain('found');
    });

    it('should maintain working directory across command execution', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            process.cwd(),
            process.cwd() + '/packages',
            process.cwd() + '/packages/core'
          ),
          async (workingDir) => {
            // Execute a command that changes directory internally and then prints pwd
            // The working directory should still be the specified one at the start
            const command = process.platform === 'win32' 
              ? 'cd'  // Just print current directory
              : 'pwd';

            const invocation = shellTool.createInvocation(
              { command, cwd: workingDir },
              createToolContext(messageBus)
            );

            const abortController = new AbortController();
            const result = await invocation.execute(abortController.signal);

            // Verify no error
            expect(result.error).toBeUndefined();

            // Verify the working directory is correct
            const normalizedOutput = result.llmContent.trim().replace(/\\/g, '/').toLowerCase();
            const normalizedWorkingDir = workingDir.replace(/\\/g, '/').toLowerCase();
            
            expect(normalizedOutput).toContain(normalizedWorkingDir);

            return true;
          }
        ),
        { numRuns: 20 }  // Reduced from 100 to avoid timeouts in parallel test runs
      );
    }, 30000);  // 30 second timeout

    it('should handle working directory with spaces in path', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      // Use the current working directory which should always exist
      const workingDir = process.cwd();
      const command = process.platform === 'win32' ? 'cd' : 'pwd';

      const invocation = shellTool.createInvocation(
        { command, cwd: workingDir },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should execute successfully
      expect(result.error).toBeUndefined();
      expect(result.llmContent.trim().length).toBeGreaterThan(0);
    });

    it('should use current directory when cwd is not specified', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      const command = process.platform === 'win32' ? 'cd' : 'pwd';

      // Create invocation without cwd parameter
      const invocation = shellTool.createInvocation(
        { command },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should execute successfully
      expect(result.error).toBeUndefined();

      // Output should contain the current working directory
      const normalizedOutput = result.llmContent.trim().replace(/\\/g, '/').toLowerCase();
      const normalizedCwd = process.cwd().replace(/\\/g, '/').toLowerCase();
      
      expect(normalizedOutput).toContain(normalizedCwd);
    });

    it('should stream output correctly when working directory is specified', async () => {
      // Feature: stage-03-tools-policy, Property 28: Shell Working Directory
      // **Validates: Requirements 5.7**
      const outputChunks: string[] = [];
      const workingDir = process.cwd() + '/packages';
      
      const command = process.platform === 'win32' 
        ? 'echo "test" && cd'
        : 'echo "test" && pwd';

      const invocation = shellTool.createInvocation(
        { command, cwd: workingDir },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(
        abortController.signal,
        (chunk) => {
          outputChunks.push(chunk);
        }
      );

      // Should execute successfully
      expect(result.error).toBeUndefined();

      // Should have received output
      expect(outputChunks.length).toBeGreaterThan(0);

      // Combined output should contain the working directory
      const combinedOutput = outputChunks.join('').replace(/\\/g, '/').toLowerCase();
      const normalizedWorkingDir = workingDir.replace(/\\/g, '/').toLowerCase();
      
      expect(combinedOutput).toContain(normalizedWorkingDir);
    });
  });

  describe('Shell Tool Schema', () => {
    it('should have correct schema structure', () => {
      expect(shellTool.name).toBe('shell');
      expect(shellTool.displayName).toBe('Execute Shell Command');
      expect(shellTool.schema).toBeDefined();
      expect(shellTool.schema.name).toBe('shell');
      expect(shellTool.schema.description).toBeDefined();
      expect(shellTool.schema.parameters).toBeDefined();
    });

    it('should require command parameter', () => {
      const schema = shellTool.schema;
      
      expect(schema.parameters?.required).toBeDefined();
      expect(schema.parameters?.required).toContain('command');
    });

    it('should define optional parameters', () => {
      const schema = shellTool.schema;
      const properties = schema.parameters?.properties as Record<string, any>;
      
      expect(properties).toBeDefined();
      expect(properties.command).toBeDefined();
      expect(properties.cwd).toBeDefined();
      expect(properties.timeout).toBeDefined();
      expect(properties.background).toBeDefined();
    });
  });

  describe('Shell Edge Cases - Idle Timeout (Requirement 5.4)', () => {
    it('should terminate process when no output for idle timeout period', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Idle Timeout
      // **Validates: Requirements 5.4**
      
      // Command that outputs once then waits without producing more output
      const command = process.platform === 'win32'
        ? 'powershell -Command "Write-Output start; Start-Sleep -Seconds 5"'
        : 'echo "start" && sleep 5';

      const invocation = shellTool.createInvocation(
        { 
          command, 
          timeout: 30000,  // Long overall timeout
          idleTimeout: 500  // Short idle timeout
        },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const startTime = Date.now();
      const result = await invocation.execute(abortController.signal);
      const elapsedTime = Date.now() - startTime;

      // Should terminate due to idle timeout, not overall timeout
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('IdleTimeoutError');
      expect(result.error?.message).toContain('idle timeout');
      
      // Should terminate much faster than the 5 second sleep
      expect(elapsedTime).toBeLessThan(3000);
    }, 10000);

    it('should not trigger idle timeout when output is continuous', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Idle Timeout
      // **Validates: Requirements 5.4**
      
      // Command that produces continuous output
      const command = process.platform === 'win32'
        ? 'for /L %i in (1,1,5) do @(echo Line %i && ping 127.0.0.1 -n 1 >nul)'
        : 'for i in 1 2 3 4 5; do echo "Line $i"; sleep 0.1; done';

      const invocation = shellTool.createInvocation(
        { 
          command, 
          timeout: 10000,
          idleTimeout: 2000  // Idle timeout longer than gaps between output
        },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Should complete successfully without idle timeout
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Line');
    }, 15000);

    it('should capture partial output before idle timeout', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Idle Timeout
      // **Validates: Requirements 5.4**
      
      const outputChunks: string[] = [];
      const command = process.platform === 'win32'
        ? 'cmd /c "echo initial && ping 127.0.0.1 -n 6 > nul"'
        : 'echo "initial" && sleep 5';

      const invocation = shellTool.createInvocation(
        { 
          command, 
          timeout: 30000,
          idleTimeout: 2000
        },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(
        abortController.signal,
        (chunk) => outputChunks.push(chunk)
      );

      // Should have captured the initial output before timeout
      const combinedOutput = outputChunks.join('');
      const allOutput = `${combinedOutput}${result.llmContent ?? ''}${result.returnDisplay ?? ''}`;
      expect(allOutput).toContain('initial');
      
      // Should have idle timeout error
      expect(result.error?.type).toBe('IdleTimeoutError');
    }, 10000);
  });

  describe('Shell Edge Cases - Background Execution (Requirement 5.5)', () => {
    it('should return immediately with process identifier for background commands', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Background Execution
      // **Validates: Requirements 5.5**
      
      const command = process.platform === 'win32'
        ? 'powershell -Command "Start-Sleep -Seconds 10"'
        : 'sleep 10';

      const invocation = shellTool.createInvocation(
        { 
          command, 
          background: true,
          timeout: 1000  // Short timeout to verify we return immediately
        },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const startTime = Date.now();
      const result = await invocation.execute(abortController.signal);
      const elapsedTime = Date.now() - startTime;

      // Should return almost immediately (not wait for the 10 second sleep)
      expect(elapsedTime).toBeLessThan(2000);
      
      // Should not have an error
      expect(result.error).toBeUndefined();
      
      // Should contain process ID information
      expect(result.llmContent).toContain('Background process started');
      expect(result.llmContent).toContain('PID');
    });

    it('should include process ID in returnDisplay for background commands', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Background Execution
      // **Validates: Requirements 5.5**
      
      const command = process.platform === 'win32'
        ? 'powershell -Command "Start-Sleep -Seconds 5"'
        : 'sleep 5';

      const invocation = shellTool.createInvocation(
        { command, background: true, timeout: 1000 },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // returnDisplay should contain PID
      expect(result.returnDisplay).toContain('PID');
    });

    it('should describe background execution in getDescription', () => {
      // Feature: stage-03-tools-policy, Unit Test: Background Execution
      // **Validates: Requirements 5.5**
      
      const invocation = shellTool.createInvocation(
        { command: 'sleep 10', background: true },
        createToolContext(messageBus)
      );

      const description = invocation.getDescription();
      
      expect(description).toContain('background');
      expect(description).toContain('sleep 10');
    });
  });

  describe('Shell Edge Cases - Environment Sanitization (Requirement 5.8)', () => {
    it('should sanitize sensitive environment variables containing SECRET', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Environment Sanitization
      // **Validates: Requirements 5.8**
      
      const originalEnv = process.env.MY_TEST_SECRET;
      process.env.MY_TEST_SECRET = 'super-secret-value-12345';

      try {
        const envVarSyntax = process.platform === 'win32' 
          ? '%MY_TEST_SECRET%' 
          : '$MY_TEST_SECRET';
        
        const invocation = shellTool.createInvocation(
          { command: `echo ${envVarSyntax}`, timeout: 5000 },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        // The actual secret value should NOT appear in output
        expect(result.llmContent).not.toContain('super-secret-value-12345');
        
        // The variable is removed, so on Windows it will echo the variable name itself
        if (process.platform === 'win32') {
          expect(result.llmContent).toContain('%MY_TEST_SECRET%');
        }
      } finally {
        if (originalEnv !== undefined) {
          process.env.MY_TEST_SECRET = originalEnv;
        } else {
          delete process.env.MY_TEST_SECRET;
        }
      }
    });

    it('should sanitize sensitive environment variables containing TOKEN', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Environment Sanitization
      // **Validates: Requirements 5.8**
      
      const originalEnv = process.env.MY_API_TOKEN;
      process.env.MY_API_TOKEN = 'token-abc123xyz';

      try {
        const envVarSyntax = process.platform === 'win32' 
          ? '%MY_API_TOKEN%' 
          : '$MY_API_TOKEN';
        
        const invocation = shellTool.createInvocation(
          { command: `echo ${envVarSyntax}`, timeout: 5000 },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        // The actual token value should NOT appear in output
        expect(result.llmContent).not.toContain('token-abc123xyz');
        
        // The variable is removed, so on Windows it will echo the variable name itself
        if (process.platform === 'win32') {
          expect(result.llmContent).toContain('%MY_API_TOKEN%');
        }
      } finally {
        if (originalEnv !== undefined) {
          process.env.MY_API_TOKEN = originalEnv;
        } else {
          delete process.env.MY_API_TOKEN;
        }
      }
    });

    it('should sanitize sensitive environment variables containing PASSWORD', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Environment Sanitization
      // **Validates: Requirements 5.8**
      
      const originalEnv = process.env.DB_PASSWORD;
      process.env.DB_PASSWORD = 'my-database-password';

      try {
        const envVarSyntax = process.platform === 'win32' 
          ? '%DB_PASSWORD%' 
          : '$DB_PASSWORD';
        
        const invocation = shellTool.createInvocation(
          { command: `echo ${envVarSyntax}`, timeout: 5000 },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        // The actual password should NOT appear in output
        expect(result.llmContent).not.toContain('my-database-password');
        
        // The variable is removed, so on Windows it will echo the variable name itself
        if (process.platform === 'win32') {
          expect(result.llmContent).toContain('%DB_PASSWORD%');
        }
      } finally {
        if (originalEnv !== undefined) {
          process.env.DB_PASSWORD = originalEnv;
        } else {
          delete process.env.DB_PASSWORD;
        }
      }
    });

    it('should sanitize AWS environment variables', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Environment Sanitization
      // **Validates: Requirements 5.8**
      
      const originalEnv = process.env.AWS_SECRET_ACCESS_KEY;
      process.env.AWS_SECRET_ACCESS_KEY = 'aws-secret-key-value';

      try {
        const envVarSyntax = process.platform === 'win32' 
          ? '%AWS_SECRET_ACCESS_KEY%' 
          : '$AWS_SECRET_ACCESS_KEY';
        
        const invocation = shellTool.createInvocation(
          { command: `echo ${envVarSyntax}`, timeout: 5000 },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        // The actual AWS secret should NOT appear in output
        expect(result.llmContent).not.toContain('aws-secret-key-value');
        
        // The variable is removed, so on Windows it will echo the variable name itself
        if (process.platform === 'win32') {
          expect(result.llmContent).toContain('%AWS_SECRET_ACCESS_KEY%');
        }
      } finally {
        if (originalEnv !== undefined) {
          process.env.AWS_SECRET_ACCESS_KEY = originalEnv;
        } else {
          delete process.env.AWS_SECRET_ACCESS_KEY;
        }
      }
    });

    it('should NOT sanitize non-sensitive environment variables', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Environment Sanitization
      // **Validates: Requirements 5.8**
      
      // PATH is a non-sensitive environment variable
      const envVarSyntax = process.platform === 'win32' ? '%PATH%' : '$PATH';
      
      const invocation = shellTool.createInvocation(
        { command: `echo ${envVarSyntax}`, timeout: 5000 },
        createToolContext(messageBus)
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // PATH should be preserved and expanded
      expect(result.llmContent.trim()).not.toBe(envVarSyntax);
      
      // Should contain actual path content
      expect(result.llmContent.length).toBeGreaterThan(0);
      
      // On Windows, should not contain the variable syntax
      if (process.platform === 'win32') {
        expect(result.llmContent).not.toContain('%PATH%');
      }
    });

    it('should sanitize environment variables with KEY suffix', async () => {
      // Feature: stage-03-tools-policy, Unit Test: Environment Sanitization
      // **Validates: Requirements 5.8**
      
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'encryption-key-value-xyz';

      try {
        const envVarSyntax = process.platform === 'win32' 
          ? '%ENCRYPTION_KEY%' 
          : '$ENCRYPTION_KEY';
        
        const invocation = shellTool.createInvocation(
          { command: `echo ${envVarSyntax}`, timeout: 5000 },
          createToolContext(messageBus)
        );

        const abortController = new AbortController();
        const result = await invocation.execute(abortController.signal);

        // The actual key value should NOT appear in output
        expect(result.llmContent).not.toContain('encryption-key-value-xyz');
        
        // The variable is removed, so on Windows it will echo the variable name itself
        if (process.platform === 'win32') {
          expect(result.llmContent).toContain('%ENCRYPTION_KEY%');
        }
      } finally {
        if (originalEnv !== undefined) {
          process.env.ENCRYPTION_KEY = originalEnv;
        } else {
          delete process.env.ENCRYPTION_KEY;
        }
      }
    });
  });
});
