/**
 * Property-Based Tests for Missing Argument Help
 * 
 * Tests universal properties of missing argument error messages
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CommandRegistry } from '../commandRegistry.js';

/**
 * Property 34: Missing Argument Help
 * 
 * Feature: stage-06-cli-ui, Property 34: Missing Argument Help
 * 
 * For any slash command executed with missing required arguments, 
 * the CLI should display usage information for that command.
 * 
 * Validates: Requirements 22.3
 */
describe('Property 34: Missing Argument Help', () => {
  it('should display usage for commands requiring arguments when none provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/model use',
          '/model pull',
          '/model rm',
          '/model info',
          '/provider use',
          '/session resume',
          '/session delete',
          '/session export',
          // Note: /git commit has optional args, so excluded
          '/theme use',
          '/theme preview',
          '/extensions enable',
          '/extensions disable',
        ),
        async (commandWithoutArgs) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(commandWithoutArgs);

          // Property: Command without required args should fail
          expect(result.success).toBe(false);

          // Property: Error message should contain "Usage"
          expect(result.message).toContain('Usage');

          // Property: Error message should show the command syntax
          expect(result.message.toLowerCase()).toMatch(/usage|syntax|required/i);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show specific usage for model subcommands', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('use', 'pull', 'rm', 'info'),
        async (subcommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(`/model ${subcommand}`);

          // Property: Should fail without model name
          expect(result.success).toBe(false);

          // Property: Should show usage with model-name placeholder
          expect(result.message).toContain('Usage');
          expect(result.message).toContain('model-name');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show specific usage for provider subcommands', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('use'),
        async (subcommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(`/provider ${subcommand}`);

          // Property: Should fail without provider name
          expect(result.success).toBe(false);

          // Property: Should show usage with provider-name placeholder
          expect(result.message).toContain('Usage');
          expect(result.message).toContain('provider-name');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show specific usage for session subcommands', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('resume', 'delete', 'export'),
        async (subcommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(`/session ${subcommand}`);

          // Property: Should fail without session ID
          expect(result.success).toBe(false);

          // Property: Should show usage with session-id placeholder
          expect(result.message).toContain('Usage');
          expect(result.message).toContain('session-id');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show specific usage for theme subcommands', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('use', 'preview'),
        async (subcommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(`/theme ${subcommand}`);

          // Property: Should fail without theme name
          expect(result.success).toBe(false);

          // Property: Should show usage with theme-name placeholder
          expect(result.message).toContain('Usage');
          expect(result.message).toContain('theme-name');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show specific usage for extension subcommands', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('enable', 'disable'),
        async (subcommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(`/extensions ${subcommand}`);

          // Property: Should fail without extension name
          expect(result.success).toBe(false);

          // Property: Should show usage with extension-name placeholder
          expect(result.message).toContain('Usage');
          expect(result.message).toContain('extension-name');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show subcommand list when main command called without subcommand', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/model',
          '/provider',
          '/session',
          '/git',
          '/review',
          '/extensions',
          '/theme',
          // Note: /metrics shows current metrics when called without subcommand, so excluded
          '/reasoning',
        ),
        async (mainCommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(mainCommand);

          // Property: Should fail without subcommand
          expect(result.success).toBe(false);

          // Property: Should show usage with subcommand list
          expect(result.message).toContain('Usage');
          expect(result.message).toContain('Subcommands');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include command name in usage message', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { command: '/model use', expectedInMessage: '/model' },
          { command: '/provider use', expectedInMessage: '/provider' },
          { command: '/session resume', expectedInMessage: '/session' },
          { command: '/theme use', expectedInMessage: '/theme' },
          { command: '/extensions enable', expectedInMessage: '/extensions' },
        ),
        async (testCase) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(testCase.command);

          // Property: Should fail
          expect(result.success).toBe(false);

          // Property: Usage message should include the command name
          expect(result.message).toContain(testCase.expectedInMessage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide clear error for any command with missing required args', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          command: fc.constantFrom(
            '/model',
            '/provider',
            '/session',
            '/git',
            '/theme',
            '/extensions',
          ),
          subcommand: fc.constantFrom('use', 'enable', 'resume', 'pull'),
        }),
        async ({ command, subcommand }) => {
          const registry = new CommandRegistry();
          const fullCommand = `${command} ${subcommand}`;
          const result = await registry.execute(fullCommand);

          // Property: Should have a message
          expect(result.message).toBeDefined();
          expect(result.message.length).toBeGreaterThan(0);

          // Property: Message should be helpful (contains usage or error info)
          const isHelpful = 
            result.message.includes('Usage') ||
            result.message.includes('required') ||
            result.message.includes('Unknown subcommand');
          
          expect(isHelpful).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle commands with optional arguments gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/git commit',    // commit message is optional
          '/help',          // command name is optional
        ),
        async (command) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(command);

          // Property: Commands with optional args should succeed or provide clear guidance
          expect(result).toBeDefined();
          expect(result.message).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should differentiate between missing subcommand and missing argument', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          const registry = new CommandRegistry();

          // Test missing subcommand
          const noSubcommand = await registry.execute('/model');
          expect(noSubcommand.success).toBe(false);
          expect(noSubcommand.message).toContain('Subcommands');

          // Test missing argument
          const noArgument = await registry.execute('/model use');
          expect(noArgument.success).toBe(false);
          expect(noArgument.message).toContain('model-name');

          // Property: Messages should be different
          expect(noSubcommand.message).not.toBe(noArgument.message);
        }
      ),
      { numRuns: 100 }
    );
  });
});
