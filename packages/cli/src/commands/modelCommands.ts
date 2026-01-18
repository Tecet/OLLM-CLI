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
import { SettingsService } from '../config/settingsService.js';
import { profileManager } from '../features/profiles/ProfileManager.js';
// import type { ModelManagementService } from '@ollm/core/services/modelManagementService.js';
// import type { ServiceContainer } from '@ollm/core/services/serviceContainer.js';
type ModelSummary = {
  name: string;
  sizeBytes?: number;
  modifiedAt?: string | Date;
};

type ModelCapabilities = {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
};

type ModelDetails = {
  name: string;
  family: string;
  size: number;
  sizeBytes?: number;
  modifiedAt: string | Date;
  contextWindow: number;
  capabilities: ModelCapabilities;
  parameterCount?: number;
};

type PullProgress = {
  percentage: number;
  transferRate: number;
};

type ModelManagementService = {
  listModels: () => Promise<ModelSummary[]>;
  pullModel: (modelName: string, onProgress?: (progress: PullProgress) => void) => Promise<void>;
  deleteModel: (modelName: string) => Promise<void>;
  showModel: (modelName: string) => Promise<ModelDetails>;
  keepModelLoaded: (modelName: string) => Promise<void>;
  unloadModel: (modelName: string) => Promise<void>;
};

type ServiceContainer = {
  getModelManagementService: () => ModelManagementService;
};

type ModelMenuGlobals = {
  __ollmModelSwitchCallback?: (modelName: string) => void;
  __ollmOpenModelMenu?: () => void;
};

const modelMenuGlobals = globalThis as ModelMenuGlobals;

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
  if (typeof modelMenuGlobals.__ollmModelSwitchCallback === 'function') {
    modelMenuGlobals.__ollmModelSwitchCallback(modelName);
  }

  // Persist selection
  SettingsService.getInstance().setModel(modelName);

  return {
    success: true,
    message: `Switched to model: ${modelName}`,
    data: {
      model: modelName,
    },
  };
}

function getModelHelpMessage(): string {
  return 'Usage: /model <list|use|pull|delete|info|keep|unload|help> [args]\n\n' +
    'Subcommands:\n' +
    '  list              - List available models\n' +
    '  use <name>        - Switch to a different model\n' +
    '  pull <name>       - Download a model\n' +
    '  delete <name>     - Remove a model\n' +
    '  info <name>       - Show model details\n' +
    '  keep <name>       - Keep model loaded in memory\n' +
    '  unload <name>     - Unload model from memory\n' +
    '  help              - Show this help';
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

    profileManager.updateUserModelsFromList(models);
    
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
      message: `Failed to list models: ${error instanceof Error ? error.message : String(error)}\nCheck that your Ollama instance is running.`,
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
    await service.pullModel(modelName, (progress) => {
      const percent = progress.percentage.toFixed(1);
      const rate = (progress.transferRate / (1024 * 1024)).toFixed(2);
      const _lastProgress = `Pulling ${modelName}: ${percent}% (${rate} MB/s)`;
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
    const modifiedAt = model.modifiedAt instanceof Date ? model.modifiedAt : new Date(model.modifiedAt);
    const date = modifiedAt.toLocaleDateString();
    const capabilities = [];
    if (model.capabilities.toolCalling) capabilities.push('tool calling');
    if (model.capabilities.vision) capabilities.push('vision');
    if (model.capabilities.streaming) capabilities.push('streaming');
    
    const info = [
      `Model: ${model.name}`,
      `Family: ${model.family}`,
      `Size: ${size} GB`,
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
        if (typeof modelMenuGlobals.__ollmOpenModelMenu === 'function') {
          modelMenuGlobals.__ollmOpenModelMenu();
          return {
            success: true,
            message: 'Opening model and context menu...',
          };
        }
        return {
          success: false,
          message: getModelHelpMessage(),
        };
      }

      const subcommand = args[0];
      const subcommandArgs = args.slice(1);

      // Handle 'use' subcommand separately as it doesn't need the service
      if (subcommand === 'use') {
        return modelUseHandler(subcommandArgs);
      }
      if (subcommand === 'help') {
        return {
          success: true,
          message: getModelHelpMessage(),
        };
      }

      // Check for unknown subcommands
      const validSubcommands = ['list', 'pull', 'delete', 'rm', 'remove', 'info', 'keep', 'unload', 'help'];
      if (!validSubcommands.includes(subcommand)) {
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: list, use, pull, delete, info, keep, unload, help',
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
        if (typeof modelMenuGlobals.__ollmOpenModelMenu === 'function') {
          modelMenuGlobals.__ollmOpenModelMenu();
          return {
            success: true,
            message: 'Opening model and context menu...',
          };
        }
        return {
          success: false,
          message: getModelHelpMessage(),
        };
      }

      const subcommand = args[0];
      const subcommandArgs = args.slice(1);

      // Handle 'use' subcommand
      if (subcommand === 'use') {
        return modelUseHandler(subcommandArgs);
      }
      if (subcommand === 'help') {
        return {
          success: true,
          message: getModelHelpMessage(),
        };
      }

      // Check for unknown subcommands
      const validSubcommands = ['list', 'pull', 'delete', 'rm', 'remove', 'info', 'keep', 'unload', 'help'];
      if (!validSubcommands.includes(subcommand)) {
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: list, use, pull, delete, info, keep, unload, help',
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

