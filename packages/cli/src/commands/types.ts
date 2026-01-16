/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  action?: 'show-launch-screen' | 'clear-chat' | 'save-session' | 'exit';
  data?: any;
}

/**
 * Command context with access to system components
 */
export interface CommandContext {
  /** Command flags (e.g., --flag value) */
  flags?: Record<string, string | boolean>;
  /** Extension manager instance */
  extensionManager?: any;
  /** Extension registry instance */
  extensionRegistry?: any;
  /** Extension watcher instance */
  extensionWatcher?: any;
  /** Extension sandbox instance */
  extensionSandbox?: any;
  /** MCP client instance */
  mcpClient?: any;
  /** Hook registry instance */
  hookRegistry?: any;
  /** Hook debugger instance */
  hookDebugger?: any;
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
