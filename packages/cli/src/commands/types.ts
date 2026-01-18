/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  action?: 'show-launch-screen' | 'clear-chat' | 'save-session' | 'exit';
  data?: unknown;
}

/**
 * Command context with access to system components
 */
export interface CommandContext {
  /** Command flags (e.g., --flag value) */
  flags?: Record<string, string | boolean>;
  /** Extension manager instance */
  extensionManager?: unknown;
  /** Extension registry instance */
  extensionRegistry?: unknown;
  /** Extension watcher instance */
  extensionWatcher?: unknown;
  /** Extension sandbox instance */
  extensionSandbox?: unknown;
  /** MCP client instance */
  mcpClient?: unknown;
  /** Hook registry instance */
  hookRegistry?: unknown;
  /** Hook debugger instance */
  hookDebugger?: unknown;
}

/**
 * Command handler function
 */
export type CommandHandler = (
  args: string[],
  context?: CommandContext
) => Promise<CommandResult> | CommandResult;

/**
 * Command definition
 */
export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  handler: CommandHandler;
}
