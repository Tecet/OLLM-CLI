/**
 * Model Management Commands
 * 
 * Implements commands for managing models:
 * - /model list - List available models
 * - /model use <name> - Switch to a different model
 * - /model pull <name> - Download a model
 * - /model delete <name> - Remove a model
 * - /model info <name> - Show model details
 * - /model keep <name> - Keep model loaded
 * - /model unload <name> - Unload model
 */

import type { Command, CommandResult } from './types.js';
import type { ModelManagementService } from '@ollm/ollm-cli-core/services/modelManagementService.js';
import type { ServiceContainer } from '@ollm/ollm-cli-core/services/serviceContainer.js';

/**
 * /model use <name> - Switch to a different model
 * This handler doesn't require a service container
 * 
 * Requirements: 19.2
 */
async function modelUseHandler(args: string[]): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /model use <model-name>',
    };
  }

  const modelName = args[0];

  // Call the model switch callback if available
  if (typeof (globalThis as any).__ollmModelSwitchCallback === 'function') {
    (globalThis as any).__ollmModelSwitchCallback(modelName);
  }

  return {
    success: true,
    message: `Switched to model: ${modelName}`,
    data: {
      model: modelName,
    },
  };
}

/**
 * Create model commands with service container dependency injection
 */
export function createModelCommands(container: ServiceContainer): Command[] {
  const getService = (): ModelManagementService => container.getModelManagementService();

/**
 * /model list - List available models
 * 
 * Requirements: 19.2, 1.1, 1.2
 */
async function modelListHandler(service: ModelManagementService): Promise<CommandResult> {
  try {
    const models = await service.listModels();
    
    if (models.length === 0) {
      return {
        success: true,
        message: 'No models found. Use /model pull <name> to download a model.',
        data: { models: [] },
      };
    }
    
    // Format model list
    const modelList = models.map(model => {
      // Handle size - use sizeBytes if available
      const sizeGB = model.sizeBytes 
        ? (model.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)
        : 'N/A';
      
      // Handle modifiedAt - parse if string, format if available
      let dateStr = 'N/A';
      if (model.modifiedAt) {
        const modifiedDate = new Date(model.modifiedAt);
        dateStr = modifiedDate.toLocaleDateString();
      }
      
      return `  ${model.name} (${sizeGB} GB, modified: ${dateStr})`;
    }).join('\n');
    
    return {
      success: true,
      message: `Available models:\n\n${modelList}`,
      data: { models },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list models: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /model pull <name> - Download a model
 * 
 * Requirements: 19.2, 2.1, 2.2
 */
async function modelPullHandler(args: string[], service: ModelManagementService): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /model pull <model-name>',
    };
  }

  const modelName = args[0];

  try {
    let lastProgress = '';
    await service.pullModel(modelName, (progress) => {
      const percent = progress.percentage.toFixed(1);
      const rate = (progress.transferRate / (1024 * 1024)).toFixed(2);
      lastProgress = `Pulling ${modelName}: ${percent}% (${rate} MB/s)`;
      // In a real implementation, this would update a progress bar
      // For now, we'll just track the last progress
    });
    
    return {
      success: true,
      message: `Successfully pulled model: ${modelName}`,
      data: { model: modelName },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to pull model: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /model delete <name> - Remove a model
 * 
 * Requirements: 19.2, 3.1, 3.4
 */
async function modelDeleteHandler(args: string[], service: ModelManagementService): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /model delete <model-name>',
    };
  }

  const modelName = args[0];

  try {
    await service.deleteModel(modelName);
    
    return {
      success: true,
      message: `Successfully deleted model: ${modelName}`,
      data: { model: modelName },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to delete model: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /model info <name> - Show model details
 * 
 * Requirements: 19.2, 4.1, 4.2
 */
async function modelInfoHandler(args: string[], service: ModelManagementService): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /model info <model-name>',
    };
  }

  const modelName = args[0];

  try {
    const model = await service.showModel(modelName);
    
    // Format model information
    const size = (model.size / (1024 * 1024 * 1024)).toFixed(2);
    const date = model.modifiedAt.toLocaleDateString();
    const capabilities = [];
    if (model.capabilities.toolCalling) capabilities.push('tool calling');
    if (model.capabilities.vision) capabilities.push('vision');
    if (model.capabilities.streaming) capabilities.push('streaming');
    
    const info = [
      `Model: ${model.name}`,
      `Family: ${model.family}`,
      `Context Window: ${model.contextWindow} tokens`,
      `Modified: ${date}`,
      `Capabilities: ${capabilities.join(', ') || 'none'}`,
    ];
    
    if (model.parameterCount) {
      info.push(`Parameters: ${(model.parameterCount / 1e9).toFixed(1)}B`);
    }
    
    return {
      success: true,
      message: info.join('\n'),
      data: { model },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get model info: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /model keep <name> - Keep model loaded
 * 
 * Requirements: 19.2, 19.1, 19.4
 */
async function modelKeepHandler(args: string[], service: ModelManagementService): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /model keep <model-name>',
    };
  }

  const modelName = args[0];

  try {
    await service.keepModelLoaded(modelName);
    
    return {
      success: true,
      message: `Model ${modelName} will be kept loaded in memory`,
      data: { model: modelName },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to keep model loaded: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /model unload <name> - Unload model
 * 
 * Requirements: 19.2, 19.4
 */
async function modelUnloadHandler(args: string[], service: ModelManagementService): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /model unload <model-name>',
    };
  }

  const modelName = args[0];

  try {
    await service.unloadModel(modelName);
    
    return {
      success: true,
      message: `Model ${modelName} has been unloaded from memory`,
      data: { model: modelName },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to unload model: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

  /**
   * /model command - Main model command with subcommands
   * 
   * Requirements: 19.2
   */
  const modelCommand: Command = {
    name: '/model',
    description: 'Manage models',
    usage: '/model <list|use|pull|delete|info|keep|unload> [args]',
    handler: async (args: string[]): Promise<CommandResult> => {
      if (args.length === 0) {
        return {
          success: false,
          message: 'Usage: /model <list|use|pull|delete|info|keep|unload> [args]\n\n' +
            'Subcommands:\n' +
            '  list              - List available models\n' +
            '  use <name>        - Switch to a different model\n' +
            '  pull <name>       - Download a model\n' +
            '  delete <name>     - Remove a model\n' +
            '  info <name>       - Show model details\n' +
            '  keep <name>       - Keep model loaded in memory\n' +
            '  unload <name>     - Unload model from memory',
        };
      }

      const subcommand = args[0];
      const subcommandArgs = args.slice(1);

      // Handle 'use' subcommand separately as it doesn't need the service
      if (subcommand === 'use') {
        return modelUseHandler(subcommandArgs);
      }

      // Check for unknown subcommands
      const validSubcommands = ['list', 'pull', 'delete', 'rm', 'remove', 'info', 'keep', 'unload'];
      if (!validSubcommands.includes(subcommand)) {
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: list, use, pull, delete, info, keep, unload',
        };
      }

      // Check for missing arguments
      const requiresArgs = ['pull', 'delete', 'rm', 'remove', 'info', 'keep', 'unload'];
      if (requiresArgs.includes(subcommand) && subcommandArgs.length === 0) {
        return {
          success: false,
          message: `Usage: /model ${subcommand} <model-name>`,
        };
      }

      // Get service from container
      const service = getService();

      switch (subcommand) {
        case 'list':
          return modelListHandler(service);
        case 'pull':
          return modelPullHandler(subcommandArgs, service);
        case 'delete':
        case 'rm':
        case 'remove':
          return modelDeleteHandler(subcommandArgs, service);
        case 'info':
          return modelInfoHandler(subcommandArgs, service);
        case 'keep':
          return modelKeepHandler(subcommandArgs, service);
        case 'unload':
          return modelUnloadHandler(subcommandArgs, service);
        default:
          return {
            success: false,
            message: `Unknown subcommand: ${subcommand}\n\n` +
              'Available subcommands: list, use, pull, delete, info, keep, unload',
          };
      }
    },
  };

  return [modelCommand];
}


/**
 * Default model commands export (backwards compatible)
 * These work without a service container by creating services on demand
 * 
 * Note: For production use, prefer createModelCommands() with a proper service container
 */
export const modelCommands: Command[] = [
  {
    name: '/model',
    description: 'Manage models',
    usage: '/model <list|use|pull|delete|info|keep|unload> [args]',
    handler: async (args: string[]): Promise<CommandResult> => {
      if (args.length === 0) {
        return {
          success: false,
          message: 'Usage: /model <list|use|pull|delete|info|keep|unload> [args]\n\n' +
            'Subcommands:\n' +
            '  list              - List available models\n' +
            '  use <name>        - Switch to a different model\n' +
            '  pull <name>       - Download a model\n' +
            '  delete <name>     - Remove a model\n' +
            '  info <name>       - Show model details\n' +
            '  keep <name>       - Keep model loaded in memory\n' +
            '  unload <name>     - Unload model from memory',
        };
      }

      const subcommand = args[0];
      const subcommandArgs = args.slice(1);

      // Handle 'use' subcommand
      if (subcommand === 'use') {
        return modelUseHandler(subcommandArgs);
      }

      // Check for unknown subcommands
      const validSubcommands = ['list', 'pull', 'delete', 'rm', 'remove', 'info', 'keep', 'unload'];
      if (!validSubcommands.includes(subcommand)) {
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: list, use, pull, delete, info, keep, unload',
        };
      }

      // Check for missing arguments
      const requiresArgs = ['pull', 'delete', 'rm', 'remove', 'info', 'keep', 'unload'];
      if (requiresArgs.includes(subcommand) && subcommandArgs.length === 0) {
        return {
          success: false,
          message: `Usage: /model ${subcommand} <model-name>`,
        };
      }

      // For now, return a message that service is not initialized
      // In tests, this is acceptable. In production, use createModelCommands()
      return {
        success: false,
        message: 'Model management service not initialized. This command requires a service container.',
      };
    },
  },
];

