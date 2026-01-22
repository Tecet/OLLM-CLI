/**
 * Memory Management Commands
 * 
 * Implements commands for managing cross-session memory:
 * - /memory list - Show all memories
 * - /memory add <key> <value> - Add memory
 * - /memory forget <key> - Remove memory
 * - /memory clear - Clear all memories
 */

import type { Command, CommandResult } from './types.js';
import { MemoryService } from '@ollm/core';

/**
 * /memory list - Show all memories
 * 
 * Requirements: 12.5
 */
async function memoryListHandler(service: MemoryService): Promise<CommandResult> {
  try {
    const memories = service.listAll();
    
    if (memories.length === 0) {
      return {
        success: true,
        message: 'No memories stored. Use /memory add <key> <value> to add one.',
        data: { memories: [] },
      };
    }
    
    // Format memory list
    const memoryList = memories.map(memory => {
      const category = memory.category ? ` [${memory.category}]` : '';
      const source = memory.source ? ` (${memory.source})` : '';
      return `  ${memory.key}: ${memory.value}${category}${source}`;
    }).join('\n');
    
    return {
      success: true,
      message: `Stored memories:\n\n${memoryList}`,
      data: { memories },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to list memories: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /memory add <key> <value> - Add memory
 * 
 * Requirements: 12.1
 */
async function memoryAddHandler(args: string[], service: MemoryService): Promise<CommandResult> {
  if (args.length < 2) {
    return {
      success: false,
      message: 'Usage: /memory add <key> <value>',
    };
  }

  const key = args[0];
  const value = args.slice(1).join(' ');

  try {
    service.remember(key, value, { source: 'user' });
    await service.save();
    
    return {
      success: true,
      message: `Memory added: ${key} = ${value}`,
      data: { key, value },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to add memory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /memory forget <key> - Remove memory
 * 
 * Requirements: 12.4
 */
async function memoryForgetHandler(args: string[], service: MemoryService): Promise<CommandResult> {
  if (args.length === 0) {
    return {
      success: false,
      message: 'Usage: /memory forget <key>',
    };
  }

  const key = args[0];

  try {
    const memory = service.recall(key);
    if (!memory) {
      return {
        success: false,
        message: `Memory not found: ${key}`,
      };
    }
    
    service.forget(key);
    await service.save();
    
    return {
      success: true,
      message: `Memory forgotten: ${key}`,
      data: { key },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to forget memory: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /memory clear - Clear all memories
 * 
 * Requirements: 12.4
 */
async function memoryClearHandler(service: MemoryService): Promise<CommandResult> {
  try {
    const memories = service.listAll();
    const count = memories.length;
    
    // Forget all memories
    for (const memory of memories) {
      service.forget(memory.key);
    }
    await service.save();
    
    return {
      success: true,
      message: `Cleared ${count} ${count === 1 ? 'memory' : 'memories'}`,
      data: { count },
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to clear memories: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * /memory command - Main memory command with subcommands
 * 
 * Requirements: 12.1, 12.4, 12.5
 */
export const memoryCommand: Command = {
  name: '/memory',
  description: 'Manage cross-session memory',
  usage: '/memory <list|add|forget|clear> [args]',
  handler: async (args: string[]): Promise<CommandResult> => {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /memory <list|add|forget|clear> [args]\n\n' +
          'Subcommands:\n' +
          '  list              - Show all memories\n' +
          '  add <key> <value> - Add a memory\n' +
          '  forget <key>      - Remove a memory\n' +
          '  clear             - Clear all memories',
      };
    }

    const subcommand = args[0];
    const subcommandArgs = args.slice(1);

    // Create service instance
    // TODO: This should be injected via dependency injection
    const service = new MemoryService({
      memoryPath: undefined, // Will use default
      tokenBudget: 500,
    });
    
    // Load memories from disk
    await service.load();

    switch (subcommand) {
      case 'list':
        return memoryListHandler(service);
      case 'add':
        return memoryAddHandler(subcommandArgs, service);
      case 'forget':
        return memoryForgetHandler(subcommandArgs, service);
      case 'clear':
        return memoryClearHandler(service);
      default:
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}\n\n` +
            'Available subcommands: list, add, forget, clear',
        };
    }
  },
};

/**
 * All memory-related commands
 */
export const memoryCommands: Command[] = [
  memoryCommand,
];


/**
 * Create memory commands with service container dependency injection
 */
export function createMemoryCommands(_container: unknown): Command[] {
  // TODO: Implement with service container
  return memoryCommands;
}

// Keep original export for backwards compatibility
// Export is already defined above as memoryCommands
