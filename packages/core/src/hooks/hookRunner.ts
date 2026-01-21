/**
 * HookRunner executes hooks with timeout and error handling
 * 
 * Spawns hook processes, communicates via stdin/stdout using JSON protocol,
 * and ensures proper error isolation and timeout enforcement.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import type { Hook, HookEvent, HookInput, HookOutput } from './types.js';
import { HookTranslator } from './hookTranslator.js';
import type { TrustedHooks } from './trustedHooks.js';
import type { HooksConfig } from './config.js';
import { DEFAULT_HOOKS_CONFIG } from './config.js';
import { getHookDebugger } from './hookDebugger.js';

/**
 * Result of hook execution including metadata
 */
export interface HookExecutionResult {
  /** The hook that was executed */
  hook: Hook;
  /** The output from the hook (if successful) */
  output?: HookOutput;
  /** Error that occurred during execution (if any) */
  error?: Error;
  /** Whether the hook timed out */
  timedOut: boolean;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether the hook was skipped due to lack of trust */
  skipped?: boolean;
}

/**
 * Aggregated result from executing multiple hooks
 */
export interface HookExecutionSummary {
  /** Individual hook outputs */
  outputs: HookOutput[];
  /** Whether execution should continue (false if any hook returned continue: false) */
  shouldContinue: boolean;
  /** Concatenated system messages from all hooks */
  systemMessages: string[];
  /** Aggregated data from all hooks */
  aggregatedData: Record<string, unknown>;
  /** Whether any hook was aborted */
  aborted: boolean;
}

/**
 * Runner for executing hooks with timeout and error handling
 */
export class HookRunner {
  private translator: HookTranslator;
  private timeout: number;
  private trustedHooks?: TrustedHooks;
  private config: Required<HooksConfig>;

  /**
   * Create a new HookRunner
   * 
   * @param timeout - Timeout in milliseconds (default: 30000)
   * @param trustedHooks - Optional TrustedHooks instance for trust verification
   * @param config - Optional hooks configuration
   */
  constructor(timeout: number = 30000, trustedHooks?: TrustedHooks, config?: Partial<HooksConfig>) {
    this.translator = new HookTranslator();
    this.timeout = timeout;
    this.trustedHooks = trustedHooks;
    this.config = {
      enabled: config?.enabled ?? DEFAULT_HOOKS_CONFIG.enabled,
      timeout: config?.timeout ?? DEFAULT_HOOKS_CONFIG.timeout,
      trustWorkspace: config?.trustWorkspace ?? DEFAULT_HOOKS_CONFIG.trustWorkspace,
    };
    
    // Use config timeout if provided
    if (config?.timeout) {
      this.timeout = config.timeout;
    }
  }

  /**
   * Set the timeout for hook execution
   * 
   * @param ms - Timeout in milliseconds
   */
  setTimeout(ms: number): void {
    this.timeout = ms;
  }

  /**
   * Validate hook command for security
   * 
   * @param command - Command to validate
   * @throws Error if command is invalid
   */
  private validateCommand(command: string): void {
    // Ensure command doesn't contain shell metacharacters
    if (/[;&|`$(){}[\]<>]/.test(command)) {
      throw new Error(`Invalid characters in hook command: ${command}`);
    }
    
    // Ensure command is an absolute path or whitelisted command
    if (!path.isAbsolute(command) && !this.isWhitelistedCommand(command)) {
      throw new Error(`Hook command must be absolute path or whitelisted: ${command}`);
    }
  }

  /**
   * Check if command is whitelisted
   * 
   * Whitelisted commands are considered safe to execute without absolute paths.
   * These are standard system commands and package managers:
   * - node: Node.js runtime
   * - python/python3: Python interpreters
   * - bash/sh: Shell interpreters
   * - npx: Node package executor
   * - uvx: UV package executor (used for MCP servers)
   * 
   * @param command - Command to check
   * @returns true if command is whitelisted
   */
  private isWhitelistedCommand(command: string): boolean {
    const whitelist = ['node', 'python', 'python3', 'bash', 'sh', 'npx', 'uvx'];
    return whitelist.includes(command);
  }

  /**
   * Execute a single hook (internal method, trust checking should be done by caller)
   * 
   * @param hook - The hook to execute
   * @param input - Input data for the hook
   * @returns Promise resolving to hook output
   */
  private async executeHookInternal(hook: Hook, input: HookInput): Promise<HookOutput> {
    const hookDebugger = getHookDebugger();
    const traceId = hookDebugger.startTrace(hook, input.event as HookEvent, input);
    
    let child: ReturnType<typeof spawn> | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Validate command for security
      this.validateCommand(hook.command);
      
      // Spawn the hook process
      child = spawn(hook.command, hook.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      // Set up timeout
      timeoutId = setTimeout(() => {
        child?.kill('SIGTERM');
        // Force kill after grace period
        setTimeout(() => {
          if (child && !child.killed) {
            child.kill('SIGKILL');
          }
        }, 1000);
      }, this.timeout);

      // Collect stdout and stderr with size limits
      const MAX_OUTPUT_SIZE = 1024 * 1024; // 1MB
      let stdout = '';
      let stderr = '';
      let outputSize = 0;
      let outputExceeded = false;

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize > MAX_OUTPUT_SIZE) {
          child?.kill('SIGTERM');
          outputExceeded = true;
          return;
        }
        
        stdout += chunk;
      });

      child.stderr?.on('data', (data) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize > MAX_OUTPUT_SIZE) {
          child?.kill('SIGTERM');
          outputExceeded = true;
          return;
        }
        
        stderr += chunk;
      });

      // Send input to hook via stdin
      const inputJson = this.translator.serializeInput(input);
      child.stdin?.write(inputJson);
      child.stdin?.end();

      // Wait for process to complete
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        if (!child) {
          return reject(new Error('Failed to spawn child process'));
        }

        child.on('exit', (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(code);
        });

        child.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        });
      });

      // Check if output size was exceeded
      if (outputExceeded) {
        throw new Error(`Hook output exceeded ${MAX_OUTPUT_SIZE} bytes`);
      }

      // Check if process was killed (timeout)
      if (child.killed) {
        throw new Error(`Hook timed out after ${this.timeout}ms`);
      }

      // Check exit code
      if (exitCode !== 0) {
        throw new Error(`Hook exited with code ${exitCode}${stderr ? `: ${stderr}` : ''}`);
      }

      // Parse output
      if (!stdout.trim()) {
        throw new Error('Hook produced no output');
      }

      const output = this.translator.parseHookOutput(stdout.trim());
      
      hookDebugger.endTrace(traceId, output, undefined, exitCode ?? 0);
      
      return output;
    } catch (error) {
      // Log error but don't propagate - return error output instead
      // Only log error if not in a test environment
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const extensionInfo = hook.extensionName ? ` (from extension '${hook.extensionName}')` : '';
        console.error(`Hook execution failed for '${hook.name}'${extensionInfo}: ${errorMessage}`);
      }
      
      hookDebugger.endTrace(traceId, undefined, error instanceof Error ? error : new Error(String(error)));
      
      // Return a default output that allows continuation
      return {
        continue: true,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      // Ensure cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (child && !child.killed) {
        child.kill('SIGTERM');
      }
    }
  }

  /**
   * Check trust and request approval if needed
   * 
   * @param hook - The hook to check
   * @returns true if hook is trusted or approved, false if denied
   */
  private async checkTrustAndApprove(hook: Hook): Promise<boolean> {
    if (!this.trustedHooks) {
      return true;
    }

    const isTrusted = await this.trustedHooks.isTrusted(hook);
    
    if (!isTrusted) {
      // Request approval for untrusted hooks
      const approved = await this.trustedHooks.requestApproval(hook);
      
      if (approved) {
        // Store approval with hash
        const hash = await this.trustedHooks.computeHash(hook);
        await this.trustedHooks.storeApproval(hook, hash);
        return true;
      } else {
        // Skip hook if not approved
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          console.warn(`Hook ${hook.name} was not approved and will be skipped`);
        }
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a single hook
   * 
   * @param hook - The hook to execute
   * @param input - Input data for the hook
   * @returns Promise resolving to hook output
   */
  async executeHook(hook: Hook, input: HookInput): Promise<HookOutput> {
    // Check if hooks are enabled
    if (!this.config.enabled) {
      return {
        continue: true,
        error: 'Hooks are disabled in configuration',
      };
    }

    // Check trust before execution
    const approved = await this.checkTrustAndApprove(hook);
    if (!approved) {
      return {
        continue: true,
        error: 'Hook not approved by user',
      };
    }

    return this.executeHookInternal(hook, input);
  }

  /**
   * Execute multiple hooks in sequence
   * 
   * @param hooks - Array of hooks to execute
   * @param input - Input data for the hooks
   * @returns Promise resolving to array of hook outputs
   */
  async executeHooks(hooks: Hook[], input: HookInput): Promise<HookOutput[]> {
    // Check if hooks are enabled
    if (!this.config.enabled) {
      return hooks.map(() => ({
        continue: true,
        error: 'Hooks are disabled in configuration',
      }));
    }

    const results: HookOutput[] = [];
    let currentInput = input;

    for (const hook of hooks) {
      // Check trust before execution
      const approved = await this.checkTrustAndApprove(hook);
      if (!approved) {
        results.push({
          continue: true,
          error: 'Hook not approved by user',
        });
        continue;
      }

      try {
        const output = await this.executeHookInternal(hook, currentInput);
        results.push(output);

        // If hook returns continue: false, stop execution
        if (!output.continue) {
          break;
        }

        // Pass data from this hook to the next hook
        if (output.data) {
          currentInput = {
            ...currentInput,
            data: {
              ...currentInput.data,
              ...output.data,
            },
          };
        }
      } catch (error) {
        // Log error and continue with remaining hooks
        // Only log error if not in a test environment
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const extensionInfo = hook.extensionName ? ` (from extension '${hook.extensionName}')` : '';
          console.error(`Hook '${hook.name}'${extensionInfo} failed: ${errorMessage}`);
        }
        
        // Add error result
        results.push({
          continue: true,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Execute multiple hooks in sequence and return aggregated summary
   * 
   * @param hooks - Array of hooks to execute
   * @param input - Input data for the hooks
   * @returns Promise resolving to execution summary with aggregated results
   */
  async executeHooksWithSummary(hooks: Hook[], input: HookInput): Promise<HookExecutionSummary> {
    // Check if hooks are enabled
    if (!this.config.enabled) {
      return {
        outputs: hooks.map(() => ({
          continue: true,
          error: 'Hooks are disabled in configuration',
        })),
        shouldContinue: true,
        systemMessages: [],
        aggregatedData: {},
        aborted: false,
      };
    }

    const outputs: HookOutput[] = [];
    const systemMessages: string[] = [];
    let aggregatedData: Record<string, unknown> = {};
    let shouldContinue = true;
    let aborted = false;
    let currentInput = input;

    for (const hook of hooks) {
      // Check trust before execution
      const approved = await this.checkTrustAndApprove(hook);
      if (!approved) {
        const skipOutput: HookOutput = {
          continue: true,
          error: 'Hook not approved by user',
        };
        outputs.push(skipOutput);
        continue;
      }

      try {
        const output = await this.executeHookInternal(hook, currentInput);
        outputs.push(output);

        // Collect system messages
        if (output.systemMessage) {
          systemMessages.push(output.systemMessage);
        }

        // If hook returns continue: false, abort and stop execution
        if (!output.continue) {
          shouldContinue = false;
          aborted = true;
          break;
        }

        // Pass data from this hook to the next hook
        if (output.data) {
          // Merge data into aggregated data
          aggregatedData = {
            ...aggregatedData,
            ...output.data,
          };

          // Update input for next hook
          currentInput = {
            ...currentInput,
            data: {
              ...currentInput.data,
              ...output.data,
            },
          };
        }
      } catch (error) {
        // Log error and continue with remaining hooks
        // Only log error if not in a test environment
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const extensionInfo = hook.extensionName ? ` (from extension '${hook.extensionName}')` : '';
          console.error(`Hook '${hook.name}'${extensionInfo} failed: ${errorMessage}`);
        }
        
        // Add error result
        const errorOutput: HookOutput = {
          continue: true,
          error: error instanceof Error ? error.message : String(error),
        };
        outputs.push(errorOutput);
      }
    }

    return {
      outputs,
      shouldContinue,
      systemMessages,
      aggregatedData,
      aborted,
    };
  }

  /**
   * Execute a single hook and return detailed execution result
   * 
   * @param hook - The hook to execute
   * @param input - Input data for the hook
   * @returns Promise resolving to detailed execution result
   */
  async executeHookWithMetadata(hook: Hook, input: HookInput): Promise<HookExecutionResult> {
    // Check if hooks are enabled
    if (!this.config.enabled) {
      return {
        hook,
        output: {
          continue: true,
          error: 'Hooks are disabled in configuration',
        },
        timedOut: false,
        executionTime: 0,
        skipped: true,
      };
    }

    // Check trust before execution
    const approved = await this.checkTrustAndApprove(hook);
    if (!approved) {
      return {
        hook,
        output: {
          continue: true,
          error: 'Hook not approved by user',
        },
        timedOut: false,
        executionTime: 0,
        skipped: true,
      };
    }

    const startTime = Date.now();
    let timedOut = false;

    try {
      // Spawn the hook process
      const child = spawn(hook.command, hook.args || [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        // Force kill after grace period
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 1000);
      }, this.timeout);

      // Collect stdout and stderr
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Send input to hook via stdin
      const inputJson = this.translator.serializeInput(input);
      child.stdin?.write(inputJson);
      child.stdin?.end();

      // Wait for process to complete
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        child.on('exit', (code) => {
          if (timeoutId) clearTimeout(timeoutId);
          resolve(code);
        });

        child.on('error', (error) => {
          if (timeoutId) clearTimeout(timeoutId);
          reject(error);
        });
      });

      const executionTime = Date.now() - startTime;

      // Check if process was killed (timeout)
      if (timedOut) {
        return {
          hook,
          error: new Error(`Hook timed out after ${this.timeout}ms`),
          timedOut: true,
          executionTime,
        };
      }

      // Check exit code
      if (exitCode !== 0) {
        return {
          hook,
          error: new Error(`Hook exited with code ${exitCode}${stderr ? `: ${stderr}` : ''}`),
          timedOut: false,
          executionTime,
        };
      }

      // Parse output
      if (!stdout.trim()) {
        return {
          hook,
          error: new Error('Hook produced no output'),
          timedOut: false,
          executionTime,
        };
      }

      const output = this.translator.parseHookOutput(stdout.trim());
      
      return {
        hook,
        output,
        timedOut: false,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      return {
        hook,
        error: error instanceof Error ? error : new Error(String(error)),
        timedOut,
        executionTime,
      };
    }
  }
}
