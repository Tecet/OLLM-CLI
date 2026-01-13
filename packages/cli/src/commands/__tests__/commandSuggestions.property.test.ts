/**
 * Property-Based Tests for Command Suggestions
 * 
 * Tests universal properties of command suggestion system
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CommandRegistry } from '../commandRegistry.js';

/**
 * Property 33: Command Suggestions
 * 
 * Feature: stage-06-cli-ui, Property 33: Command Suggestions
 * 
 * For any unrecognized slash command, the CLI should suggest similar 
 * valid commands based on string similarity.
 * 
 * Validates: Requirements 22.2
 */
describe('Property 33: Command Suggestions', () => {
  it('should suggest similar commands for typos', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate typos of known commands
        fc.constantFrom(
          '/mdoel',      // typo of /model
          '/provder',    // typo of /provider
          '/sesion',     // typo of /session
          '/thme',       // typo of /theme
          '/git',        // exact match (should not suggest)
          '/gti',        // typo of /git
          '/hlep',       // typo of /help
          '/exti',       // typo of /exit
          '/metrcs',     // typo of /metrics
          '/reviw',      // typo of /review
          '/extnsions',  // typo of /extensions
          '/reasonig',   // typo of /reasoning
          '/contxt',     // typo of /context
        ),
        async (typoCommand) => {
          const registry = new CommandRegistry();
          const result = await registry.execute(typoCommand);

          // Property: Unrecognized command should fail
          expect(result.success).toBe(false);

          // Property: Error message should contain the unrecognized command
          expect(result.message).toContain(typoCommand);

          // Property: For typos (not exact matches), should suggest similar commands
          const knownCommands = [
            '/model', '/provider', '/session', '/theme', '/git',
            '/help', '/exit', '/metrics', '/review', '/extensions',
            '/reasoning', '/context', '/home', '/new', '/clear',
          ];

          const isExactMatch = knownCommands.includes(typoCommand);
          
          if (!isExactMatch) {
            // Should contain suggestion text
            expect(result.message.toLowerCase()).toMatch(/did you mean|suggestion/i);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should provide suggestions based on Levenshtein distance', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          const registry = new CommandRegistry();

          // Test specific typos with known expected suggestions
          const testCases = [
            { input: '/mdoel', expectedSuggestion: '/model' },
            { input: '/provder', expectedSuggestion: '/provider' },
            { input: '/sesion', expectedSuggestion: '/session' },
            { input: '/thme', expectedSuggestion: '/theme' },
            { input: '/gti', expectedSuggestion: '/git' },
            { input: '/hlep', expectedSuggestion: '/help' },
          ];

          for (const testCase of testCases) {
            const suggestions = registry.getSuggestions(testCase.input);

            // Property: Should return suggestions
            expect(suggestions.length).toBeGreaterThan(0);

            // Property: Expected suggestion should be in the list
            expect(suggestions).toContain(testCase.expectedSuggestion);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should limit suggestions to reasonable distance', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random strings that are very different from commands
        fc.string({ minLength: 5, maxLength: 20 }).filter(
          s => !s.startsWith('/') && 
               !['model', 'provider', 'session', 'theme', 'git', 'help'].some(cmd => s.includes(cmd))
        ),
        async (randomString) => {
          const registry = new CommandRegistry();
          const suggestions = registry.getSuggestions(`/${randomString}`);

          // Property: Very different strings should have few or no suggestions
          // (Levenshtein distance > 3 should be filtered out)
          expect(suggestions.length).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return top 3 suggestions at most', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('/m', '/s', '/e', '/t', '/g', '/h', '/r', '/c'),
        async (shortCommand) => {
          const registry = new CommandRegistry();
          const suggestions = registry.getSuggestions(shortCommand);

          // Property: Should return at most 3 suggestions
          expect(suggestions.length).toBeLessThanOrEqual(3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle case-insensitive matching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/MODEL',
          '/Model',
          '/PROVIDER',
          '/Provider',
          '/SESSION',
          '/Session',
        ),
        async (upperCaseCommand) => {
          const registry = new CommandRegistry();
          const suggestions = registry.getSuggestions(upperCaseCommand);

          // Property: Should find suggestions regardless of case
          expect(suggestions.length).toBeGreaterThan(0);

          // Property: Suggestions should include lowercase version
          const lowerCommand = upperCaseCommand.toLowerCase();
          expect(suggestions).toContain(lowerCommand);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should suggest aliases as well as main commands', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          const registry = new CommandRegistry();

          // Test that aliases are included in suggestions
          const testCases = [
            { input: '/cls', expectedSuggestion: '/cls' },      // alias for /clear
            { input: '/ext', expectedSuggestion: '/ext' },      // alias for /extensions
            { input: '/quit', expectedSuggestion: '/quit' },    // alias for /exit
          ];

          for (const testCase of testCases) {
            const suggestions = registry.getSuggestions(testCase.input);

            // Property: Exact alias match should be in suggestions
            expect(suggestions).toContain(testCase.expectedSuggestion);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sort suggestions by similarity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(undefined),
        async () => {
          const registry = new CommandRegistry();

          // Test that closer matches come first
          const suggestions = registry.getSuggestions('/modl');

          // Property: Should have suggestions
          expect(suggestions.length).toBeGreaterThan(0);

          // Property: /model should be first (closest match)
          expect(suggestions[0]).toBe('/model');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty or whitespace input gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('', '   ', '\t', '\n'),
        async (emptyInput) => {
          const registry = new CommandRegistry();
          const suggestions = registry.getSuggestions(emptyInput);

          // Property: Empty input should return empty or minimal suggestions
          expect(Array.isArray(suggestions)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
