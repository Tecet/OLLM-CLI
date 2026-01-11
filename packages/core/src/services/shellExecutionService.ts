import { spawn, ChildProcess } from 'child_process';

export interface ShellExecutionOptions {
  command: string;
  cwd?: string;
  timeout: number;
  idleTimeout?: number;
  background?: boolean;
  abortSignal?: AbortSignal;
  onOutput?: (output: string) => void;
}

export interface ShellExecutionResult {
  exitCode: number;
  output: string;
  error?: string;
  processId?: number;
}

/**
 * Service for executing shell commands with streaming output, timeouts, and abort signal support.
 * Handles environment variable sanitization to prevent secret leakage.
 */
export class ShellExecutionService {
  /**
   * Execute a shell command with the specified options.
   * 
   * @param options - Execution options including command, timeouts, and callbacks
   * @returns Promise resolving to execution result with output and exit code
   * @throws Error if command times out, is cancelled, or fails to start
   */
  async execute(options: ShellExecutionOptions): Promise<ShellExecutionResult> {
    // For background execution, return immediately with process ID
    if (options.background) {
      return this.executeBackground(options);
    }

    return new Promise((resolve, reject) => {
      // Sanitize environment variables to prevent secret leakage
      const sanitizedEnv = this.sanitizeEnvironment(process.env);

      // Spawn the process
      const proc = spawn(options.command, {
        cwd: options.cwd,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: sanitizedEnv,
      });

      let output = '';
      let error = '';
      let lastOutputTime = Date.now();

      // Collect stdout
      proc.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        lastOutputTime = Date.now();
        options.onOutput?.(chunk);
      });

      // Collect stderr
      proc.stderr?.on('data', (data) => {
        const chunk = data.toString();
        error += chunk;
        lastOutputTime = Date.now();
        options.onOutput?.(chunk);
      });

      // Handle timeout
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        // Give it a moment to terminate gracefully, then force kill
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 1000);
        reject(new Error(`Command timed out after ${options.timeout}ms`));
      }, options.timeout);

      // Handle idle timeout
      let idleTimeoutId: NodeJS.Timeout | undefined;
      if (options.idleTimeout) {
        const checkIdleTimeout = () => {
          const idleTime = Date.now() - lastOutputTime;
          if (idleTime >= options.idleTimeout!) {
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) {
                proc.kill('SIGKILL');
              }
            }, 1000);
            clearTimeout(timeoutId);
            reject(new Error(`Command idle timeout after ${options.idleTimeout}ms of no output`));
          } else {
            idleTimeoutId = setTimeout(checkIdleTimeout, Math.min(1000, options.idleTimeout! - idleTime));
          }
        };
        idleTimeoutId = setTimeout(checkIdleTimeout, options.idleTimeout);
      }

      // Handle abort signal
      const abortHandler = () => {
        proc.kill('SIGTERM');
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill('SIGKILL');
          }
        }, 1000);
        clearTimeout(timeoutId);
        if (idleTimeoutId) {
          clearTimeout(idleTimeoutId);
        }
        reject(new Error('Command cancelled'));
      };

      if (options.abortSignal) {
        if (options.abortSignal.aborted) {
          // Already aborted, don't start
          proc.kill('SIGKILL');
          reject(new Error('Command cancelled'));
          return;
        }
        options.abortSignal.addEventListener('abort', abortHandler);
      }

      // Handle completion
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        if (idleTimeoutId) {
          clearTimeout(idleTimeoutId);
        }
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortHandler);
        }

        resolve({
          exitCode: code ?? 0,
          output: output + error,
          error: error || undefined,
        });
      });

      // Handle process errors (e.g., command not found)
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        if (idleTimeoutId) {
          clearTimeout(idleTimeoutId);
        }
        if (options.abortSignal) {
          options.abortSignal.removeEventListener('abort', abortHandler);
        }
        reject(err);
      });
    });
  }

  /**
   * Execute a command in the background and return immediately with process ID.
   * 
   * @param options - Execution options
   * @returns Promise resolving to result with process ID
   */
  private async executeBackground(options: ShellExecutionOptions): Promise<ShellExecutionResult> {
    const sanitizedEnv = this.sanitizeEnvironment(process.env);

    const proc = spawn(options.command, {
      cwd: options.cwd,
      shell: true,
      stdio: 'ignore',
      detached: true,
      env: sanitizedEnv,
    });

    // Unref so the parent process can exit
    proc.unref();

    return {
      exitCode: 0,
      output: `Background process started with PID ${proc.pid}`,
      processId: proc.pid,
    };
  }

  /**
   * Sanitize environment variables to prevent secret leakage.
   * Removes or redacts sensitive environment variables.
   * 
   * @param env - Original environment variables
   * @returns Sanitized environment variables
   */
  private sanitizeEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
    const sanitized: NodeJS.ProcessEnv = {};

    // List of sensitive environment variable patterns
    const sensitivePatterns = [
      /^.*_TOKEN$/i,
      /^.*_SECRET$/i,
      /^.*_KEY$/i,
      /^.*_PASSWORD$/i,
      /^.*_CREDENTIAL$/i,
      /^AWS_.*$/i,
      /^GITHUB_TOKEN$/i,
      /^NPM_TOKEN$/i,
      /^API_KEY$/i,
    ];

    // Copy environment variables, redacting sensitive ones
    for (const [key, value] of Object.entries(env)) {
      const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
      
      if (isSensitive) {
        // Redact sensitive values
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}
