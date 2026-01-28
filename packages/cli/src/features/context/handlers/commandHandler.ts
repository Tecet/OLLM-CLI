/**
 * Command Handler
 *
 * Handles slash command execution and special command actions.
 * Extracted from ChatContext.tsx for better separation of concerns.
 *
 * Commands are registered in the command registry and can trigger various actions:
 * - UI actions (show launch screen, clear chat)
 * - Model management (unload model)
 * - System actions (exit)
 */

import type { Message } from '../types/chatTypes.js';
import type { ProviderAdapter } from '@ollm/core';

/**
 * Dependencies required by command handler
 */
export interface CommandHandlerDependencies {
  /** Add a message to the UI */
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;

  /** Set launch screen visibility */
  setLaunchScreenVisible: (visible: boolean) => void;

  /** Clear all chat messages */
  clearChat: () => void;

  /** Current provider adapter */
  provider: ProviderAdapter | null;

  /** Current model name */
  currentModel: string;
}

/**
 * Result of command execution
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  action?: 'show-launch-screen' | 'clear-chat' | 'exit' | string;
}

/**
 * Handle slash command execution
 *
 * @param content - Command string to execute
 * @param deps - Dependencies required by handler
 * @returns Promise that resolves when command completes
 */
export async function handleCommand(
  content: string,
  deps: CommandHandlerDependencies
): Promise<void> {
  const { addMessage, setLaunchScreenVisible, clearChat, provider, currentModel } = deps;

  // Import command registry dynamically to avoid circular dependencies
  const { commandRegistry } = await import('../../../commands/index.js');

  try {
    const result = (await commandRegistry.execute(content)) as CommandResult;

    // Handle special actions
    if (result.action === 'show-launch-screen') {
      setLaunchScreenVisible(true);
    }

    if (result.action === 'clear-chat') {
      clearChat();
    }

    if (result.action === 'exit') {
      await handleExitCommand(provider, currentModel, addMessage);
    }

    // Show result message
    addMessage({
      role: 'system',
      content:
        result.message || (result.success ? 'Command executed successfully' : 'Command failed'),
      excludeFromContext: true,
    });
  } catch (error) {
    addMessage({
      role: 'system',
      content: `Command error: ${error instanceof Error ? error.message : String(error)}`,
      excludeFromContext: true,
    });
  }
}

/**
 * Handle exit command with model unloading
 *
 * @param provider - Current provider adapter
 * @param currentModel - Current model name
 * @param addMessage - Function to add messages to UI
 */
async function handleExitCommand(
  provider: ProviderAdapter | null,
  currentModel: string,
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
): Promise<void> {
  if (provider?.unloadModel && currentModel) {
    try {
      addMessage({
        role: 'system',
        content: `Unloading model "${currentModel}"...`,
        excludeFromContext: true,
      });

      await provider.unloadModel(currentModel);

      addMessage({
        role: 'system',
        content: `Model "${currentModel}" unloaded.`,
        excludeFromContext: true,
      });

      // Brief delay to show message before exit
      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      addMessage({
        role: 'system',
        content: `Failed to unload model "${currentModel}": ${error instanceof Error ? error.message : String(error)}`,
        excludeFromContext: true,
      });
    }
  }

  process.exit(0);
}

/**
 * Check if content is a command
 *
 * @param content - Content to check
 * @returns True if content is a command
 */
export async function isCommand(content: string): Promise<boolean> {
  const { commandRegistry } = await import('../../../commands/index.js');
  return commandRegistry.isCommand(content);
}
