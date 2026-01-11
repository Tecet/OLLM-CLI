/**
 * Shell execution tool implementation
 * 
 * Provides a tool for executing shell commands with streaming output,
 * timeouts, and policy-controlled confirmation.
 */

import type {
  DeclarativeTool,
  ToolInvocation,
  ToolResult,
  ToolContext,
  ToolSchema,
  ToolCallConfirmationDetails,
  PolicyEngineInterface,
  MessageBus,
} from './types.js';
import { ShellExecutionService, type ShellExecutionOptions } from '../services/shellExecutionService.js';

/**
 * Parameters for shell command execution
 */
export interface ShellParams {
  /**
   * Shell command to execute
   */
  command: string;

  /**
   * Working directory for command execution
   */
  cwd?: string;

  /**
   * Maximum execution time in milliseconds (default: 30000)
   */
  timeout?: number;

  /**
   * Idle timeout in milliseconds (terminate if no output for this duration)
   */
  idleTimeout?: number;

  /**
   * Execute in background and return immediately
   */
  background?: boolean;
}

/**
 * Tool for executing shell commands
 */
export class ShellTool implements DeclarativeTool<ShellParams, ToolResult> {
  name = 'shell';
  displayName = 'Execute Shell Command';
  schema: ToolSchema = {
    name: 'shell',
    description: 'Execute a shell command with streaming output',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'Shell command to execute',
        },
        cwd: {
          type: 'string',
          description: 'Working directory for command execution',
        },
        timeout: {
          type: 'number',
          description: 'Maximum execution time in milliseconds (default: 30000)',
        },
        idleTimeout: {
          type: 'number',
          description: 'Idle timeout in milliseconds (terminate if no output)',
        },
        background: {
          type: 'boolean',
          description: 'Execute in background and return immediately',
        },
      },
      required: ['command'],
    },
  };

  constructor(private shellService: ShellExecutionService) {}

  createInvocation(
    params: ShellParams,
    context: ToolContext
  ): ToolInvocation<ShellParams, ToolResult> {
    return new ShellInvocation(params, context.messageBus, this.shellService, context.policyEngine);
  }
}

/**
 * Invocation instance for shell command execution
 */
export class ShellInvocation implements ToolInvocation<ShellParams, ToolResult> {
  constructor(
    public params: ShellParams,
    private messageBus: MessageBus,
    private shellService: ShellExecutionService,
    private policyEngine?: PolicyEngineInterface
  ) {}

  getDescription(): string {
    const bg = this.params.background ? ' (background)' : '';
    const cwd = this.params.cwd ? ` in ${this.params.cwd}` : '';
    return `Execute: ${this.params.command}${cwd}${bg}`;
  }

  toolLocations(): string[] {
    return this.params.cwd ? [this.params.cwd] : [];
  }

  async shouldConfirmExecute(abortSignal: AbortSignal): Promise<ToolCallConfirmationDetails | false> {
    // If no policy engine, don't require confirmation
    if (!this.policyEngine) {
      return false;
    }

    const decision = this.policyEngine.evaluate('shell', this.params as unknown as Record<string, unknown>);

    if (decision === 'allow') {
      return false;
    }

    if (decision === 'deny') {
      throw new Error('Shell execution denied by policy');
    }

    // Ask for confirmation - shell commands are high risk
    return {
      toolName: 'shell',
      description: this.getDescription(),
      risk: 'high',
      locations: this.toolLocations(),
    };
  }

  async execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<ToolResult> {
    try {
      // Check if aborted
      if (signal.aborted) {
        throw new Error('Operation cancelled');
      }

      // Prepare execution options
      const options: ShellExecutionOptions = {
        command: this.params.command,
        cwd: this.params.cwd,
        timeout: this.params.timeout ?? 30000,
        idleTimeout: this.params.idleTimeout,
        background: this.params.background,
        abortSignal: signal,
        onOutput: updateOutput,
      };

      // Execute the command
      const result = await this.shellService.execute(options);

      // Format the result
      const displayOutput = result.output.trim();
      const exitCodeMsg = result.exitCode !== 0 
        ? ` (exit code: ${result.exitCode})` 
        : '';
      
      const processIdMsg = result.processId 
        ? ` [PID: ${result.processId}]` 
        : '';

      return {
        llmContent: displayOutput,
        returnDisplay: `${displayOutput}${exitCodeMsg}${processIdMsg}`,
        error: result.exitCode !== 0 ? {
          message: `Command exited with code ${result.exitCode}`,
          type: 'ShellExecutionError',
        } : undefined,
      };
    } catch (error) {
      // Handle cancellation
      if ((error as Error).message.includes('cancelled')) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: 'Command execution cancelled',
            type: 'CancelledError',
          },
        };
      }

      // Handle timeout
      if ((error as Error).message.includes('timed out')) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: (error as Error).message,
            type: 'TimeoutError',
          },
        };
      }

      // Handle idle timeout
      if ((error as Error).message.includes('idle timeout')) {
        return {
          llmContent: '',
          returnDisplay: '',
          error: {
            message: (error as Error).message,
            type: 'IdleTimeoutError',
          },
        };
      }

      // Generic error
      return {
        llmContent: '',
        returnDisplay: '',
        error: {
          message: (error as Error).message,
          type: 'ShellExecutionError',
        },
      };
    }
  }
}
