/**
 * Tests for CLI entry point
 * Feature: stage-01-foundation
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fc from 'fast-check';
import { createTestMessage, TEST_UTILS_VERSION } from '@ollm/test-utils';

const CLI_PATH = 'packages/cli/dist/cli.js';

/**
 * Cross-package import verification
 * Validates: Requirements 6.5
 */
describe('Cross-package imports', () => {
  it('should successfully import from test-utils package', () => {
    // Verify we can import and use test-utils functions
    const message = createTestMessage('Hello');
    expect(message).toBe('[TEST] Hello');

    // Verify we can access exported constants
    expect(TEST_UTILS_VERSION).toBe('0.1.0');
  });
});

/**
 * Unit Tests for CLI version and help
 * Validates: Requirements 5.1, 5.2
 */
describe('CLI version and help', () => {
  it('should output version string on --version', () => {
    const output = execSync(`node ${CLI_PATH} --version`, {
      encoding: 'utf-8',
    });

    // Should output version number (e.g., "0.1.0")
    expect(output.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should output usage information on --help', () => {
    const output = execSync(`node ${CLI_PATH} --help`, {
      encoding: 'utf-8',
    });

    // Should contain key help text elements
    expect(output).toContain('OLLM CLI');
    expect(output).toContain('Usage:');
    // The help output uses section headers like "Execution Mode:", "Model Selection:", etc.
    // instead of a single "Options:" header
    expect(output).toContain('Execution Mode:');
    expect(output).toContain('--version');
    expect(output).toContain('--help');
  });
});

/**
 * Property 3: Unknown CLI Flag Rejection
 * Validates: Requirements 5.4
 *
 * For any command-line flag that is not recognized by the CLI,
 * the CLI SHALL exit with a non-zero exit code and display an error message.
 */
describe('Property 3: Unknown CLI Flag Rejection', () => {
  it('should reject any unknown flag with non-zero exit code', () => {
    // List of known valid flags that should not be tested as "unknown"
    const knownFlags = [
      'version', 'v', 'help', 'h', 'prompt', 'p', 'model', 'm', 'provider',
      'host', 'list-models', 'pull-model', 'remove-model', 'model-info',
      'output', 'o', 'review-diffs', 'no-review', 'debug', 'no-color',
      'config', 'c', 'session', 's'
    ];
    
    fc.assert(
      fc.property(
        // Generate random flag names that are not in the known flags list
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => !knownFlags.includes(s) && /^[a-zA-Z0-9-_]+$/.test(s)),
        (flagName) => {
          try {
            // Execute CLI with unknown flag
            execSync(`node ${CLI_PATH} --${flagName}`, {
              encoding: 'utf-8',
              stdio: 'pipe',
            });
            // If we reach here, the command succeeded (exit code 0), which is wrong
            return false;
          } catch (error: unknown) {
            // Command failed (non-zero exit code), which is expected
            // Verify exit code is non-zero
            const err = error as {
              status?: number;
              stderr?: { toString: () => string };
              stdout?: { toString: () => string };
            };
            const exitCode = err.status;
            // Verify error message is present
            const stderr = err.stderr?.toString() || '';
            const stdout = err.stdout?.toString() || '';
            const output = stderr + stdout;

            return exitCode !== 0 && output.includes('Error');
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
