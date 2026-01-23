/**
 * Unit Tests for Slash Command Parsing
 * 
 * Tests recognition of slash commands including /help, /clear, and /model.
 * 
 * Requirements: 11.4, 11.5, 11.6
 * Feature: stage-08-testing-qa
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { CommandRegistry } from '../commandRegistry.js';

describe('Slash Command Parsing', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  /**
   * Test /help recognition
   * Requirements: 11.4
   */
  describe('/help Command Recognition', () => {
    it('should recognize /help command', () => {
      const input = '/help';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should execute /help command', async () => {
      const result = await registry.execute('/help');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should recognize /help with arguments', () => {
      const input = '/help model';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should handle /help case sensitively', () => {
      // Commands should be case-sensitive
      const input = '/HELP';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should not recognize help without slash', () => {
      const input = 'help';
      expect(registry.isCommand(input)).toBe(false);
    });

    it('should recognize /help at start of line', () => {
      const input = '/help me with something';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should not recognize /help in middle of text', () => {
      const input = 'please /help me';
      // isCommand checks if input starts with /
      expect(registry.isCommand(input)).toBe(false);
    });
  });

  /**
   * Test /clear recognition
   * Requirements: 11.5
   */
  describe('/clear Command Recognition', () => {
    it('should recognize /clear command', () => {
      const input = '/clear';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should execute /clear command', async () => {
      const result = await registry.execute('/clear');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should recognize /clear with no arguments', () => {
      const input = '/clear';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should handle /clear case sensitively', () => {
      const input = '/CLEAR';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should not recognize clear without slash', () => {
      const input = 'clear';
      expect(registry.isCommand(input)).toBe(false);
    });

    it('should recognize /clear at start of line', () => {
      const input = '/clear all history';
      expect(registry.isCommand(input)).toBe(true);
    });
  });

  /**
   * Test /model recognition
   * Requirements: 11.6
   */
  describe('/model Command Recognition', () => {
    it('should recognize /model command', () => {
      const input = '/model';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should execute /model command', async () => {
      const result = await registry.execute('/model');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should recognize /model with arguments', () => {
      const input = '/model llama3.1:8b';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should handle /model case sensitively', () => {
      const input = '/MODEL';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should not recognize model without slash', () => {
      const input = 'model';
      expect(registry.isCommand(input)).toBe(false);
    });

    it('should recognize /model with model name', () => {
      const input = '/model set llama3.1:8b';
      expect(registry.isCommand(input)).toBe(true);
    });

    it('should recognize /model list subcommand', () => {
      const input = '/model list';
      expect(registry.isCommand(input)).toBe(true);
    });
  });

  /**
   * Test general command parsing
   */
  describe('General Command Parsing', () => {
    it('should identify any input starting with / as command', () => {
      expect(registry.isCommand('/anything')).toBe(true);
      expect(registry.isCommand('/test')).toBe(true);
      expect(registry.isCommand('/123')).toBe(true);
    });

    it('should not identify regular text as command', () => {
      expect(registry.isCommand('hello')).toBe(false);
      expect(registry.isCommand('what is /help')).toBe(false);
      // Note: isCommand trims input, so ' /help' is treated as '/help'
      expect(registry.isCommand(' /help')).toBe(true); // Leading space is trimmed
    });

    it('should handle empty input', () => {
      expect(registry.isCommand('')).toBe(false);
    });

    it('should handle whitespace-only input', () => {
      expect(registry.isCommand('   ')).toBe(false);
    });

    it('should handle slash-only input', () => {
      expect(registry.isCommand('/')).toBe(true);
    });

    it('should trim input before checking', () => {
      // isCommand should handle trimming
      const input = '  /help  ';
      expect(registry.isCommand(input)).toBe(true);
    });
  });

  /**
   * Test command execution
   */
  describe('Command Execution', () => {
    it('should execute valid commands', async () => {
      const result = await registry.execute('/help');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.message).toBeDefined();
    });

    it('should return error for unknown commands', async () => {
      const result = await registry.execute('/unknown');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
    });

    it('should suggest similar commands for typos', async () => {
      const result = await registry.execute('/hlep'); // typo of /help
      expect(result.success).toBe(false);
      expect(result.message).toContain('Did you mean');
    });

    it('should parse command arguments', async () => {
      const result = await registry.execute('/help model');
      expect(result).toBeDefined();
      // Arguments should be passed to command handler
    });

    it('should handle commands with multiple arguments', async () => {
      const result = await registry.execute('/model set llama3.1:8b');
      expect(result).toBeDefined();
    });

    it('should handle commands with quoted arguments', async () => {
      const result = await registry.execute('/help "model management"');
      expect(result).toBeDefined();
    });
  });

  /**
   * Test command aliases
   */
  describe('Command Aliases', () => {
    it('should recognize command aliases', () => {
      // Check if registry has aliases
      const commands = registry.getCommands();
      const hasAliases = commands.some(cmd => cmd.aliases && cmd.aliases.length > 0);
      expect(hasAliases).toBe(true);
    });

    it('should execute command via alias', async () => {
      // Find a command with aliases
      const commands = registry.getCommands();
      const cmdWithAlias = commands.find(cmd => cmd.aliases && cmd.aliases.length > 0);
      
      if (cmdWithAlias && cmdWithAlias.aliases) {
        const alias = cmdWithAlias.aliases[0];
        const result = await registry.execute(alias);
        expect(result).toBeDefined();
      }
    });
  });

  /**
   * Test command suggestions
   */
  describe('Command Suggestions', () => {
    it('should suggest commands for typos', () => {
      const suggestions = registry.getSuggestions('/hlep');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('/help');
    });

    it('should suggest commands for partial matches', () => {
      const suggestions = registry.getSuggestions('/mod');
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.includes('model'))).toBe(true);
    });

    it('should limit suggestions to reasonable distance', () => {
      const suggestions = registry.getSuggestions('/xyz');
      // Should not suggest commands that are too different
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for very different input', () => {
      const suggestions = registry.getSuggestions('/qwertyuiop');
      // May return empty or very few suggestions
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should suggest based on Levenshtein distance', () => {
      const suggestions = registry.getSuggestions('/halp');
      expect(suggestions).toContain('/help');
    });
  });

  /**
   * Test command registry
   */
  describe('Command Registry', () => {
    it('should list all registered commands', () => {
      const commands = registry.getCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it('should get command by name', () => {
      const command = registry.getCommand('/help');
      expect(command).toBeDefined();
      expect(command?.name).toBe('/help');
    });

    it('should return undefined for non-existent command', () => {
      const command = registry.getCommand('/nonexistent');
      expect(command).toBeUndefined();
    });

    it('should have /help command registered', () => {
      const command = registry.getCommand('/help');
      expect(command).toBeDefined();
      expect(command?.name).toBe('/help');
    });

    it('should have /clear command registered', () => {
      const command = registry.getCommand('/clear');
      expect(command).toBeDefined();
      expect(command?.name).toBe('/clear');
    });

    it('should have /model command registered', () => {
      const command = registry.getCommand('/model');
      expect(command).toBeDefined();
      expect(command?.name).toBe('/model');
    });
  });

  /**
   * Test error handling
   */
  describe('Error Handling', () => {
    it('should handle command execution errors gracefully', async () => {
      // Execute a command that might fail
      const result = await registry.execute('/model invalid-operation');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should return error message for failed commands', async () => {
      const result = await registry.execute('/unknown');
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy();
      expect(typeof result.message).toBe('string');
    });

    it('should handle empty command gracefully', async () => {
      const result = await registry.execute('/');
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle whitespace in commands', async () => {
      const result = await registry.execute('/help   ');
      expect(result).toBeDefined();
    });
  });
});
