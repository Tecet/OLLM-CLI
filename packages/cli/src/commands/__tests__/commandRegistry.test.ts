import { describe, it, expect, beforeEach } from 'vitest';

import { CommandRegistry } from '../commandRegistry.js';

import type { Command } from '../types.js';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  it('should register home command by default', () => {
    const commands = registry.getCommands();
    expect(commands.length).toBeGreaterThan(0);

    const homeCmd = registry.getCommand('/home');
    expect(homeCmd).toBeDefined();
    expect(homeCmd?.name).toBe('/home');
  });

  it('should register new commands', () => {
    const testCommand: Command = {
      name: '/test',
      description: 'Test command',
      handler: async () => ({ success: true }),
    };

    registry.register(testCommand);

    const cmd = registry.getCommand('/test');
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe('/test');
  });

  it('should register command aliases', () => {
    const testCommand: Command = {
      name: '/test',
      aliases: ['/t'],
      description: 'Test command',
      handler: async () => ({ success: true }),
    };

    registry.register(testCommand);

    const cmd = registry.getCommand('/t');
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe('/test');
  });

  it('should detect commands starting with /', () => {
    expect(registry.isCommand('/home')).toBe(true);
    expect(registry.isCommand('/test command')).toBe(true);
    expect(registry.isCommand('not a command')).toBe(false);
    expect(registry.isCommand('  /home')).toBe(true);
  });

  it('should execute registered commands', async () => {
    const result = await registry.execute('/home');

    expect(result.success).toBe(true);
    expect(result.action).toBe('show-launch-screen');
  });

  it('should return error for unknown commands', async () => {
    const result = await registry.execute('/unknown');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown command');
  });

  it('should pass arguments to command handler', async () => {
    let receivedArgs: string[] = [];

    const testCommand: Command = {
      name: '/test',
      description: 'Test command',
      handler: async (args) => {
        receivedArgs = args;
        return { success: true };
      },
    };

    registry.register(testCommand);
    await registry.execute('/test arg1 arg2');

    expect(receivedArgs).toEqual(['arg1', 'arg2']);
  });

  it('should handle command execution errors', async () => {
    const testCommand: Command = {
      name: '/error',
      description: 'Error command',
      handler: async () => {
        throw new Error('Test error');
      },
    };

    registry.register(testCommand);
    const result = await registry.execute('/error');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Test error');
  });

  it('should get all registered commands', () => {
    const commands = registry.getCommands();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });
});
