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
 * Command handler function
 */
export type CommandHandler = (args: string[]) => Promise<CommandResult> | CommandResult;

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
