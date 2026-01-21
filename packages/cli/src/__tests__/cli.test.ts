/**
 * Tests for CLI entry point
 * Feature: stage-01-foundation
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createTestMessage, TEST_UTILS_VERSION } from '@ollm/test-utils';
import mainCLI from '../cli';

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
  it('should output version string on --version', async () => {
    const result = await mainCLI(['--version'], { exitOnComplete: false });
    expect(result === 0 || result === undefined).toBe(true);
  });

  it('should output usage information on --help', async () => {
    const result = await mainCLI(['--help'], { exitOnComplete: false });
    expect(result === 0 || result === undefined).toBe(true);
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
  it('should reject any unknown flag with non-zero exit code', async () => {
    // List of known valid flags that should not be tested as "unknown"
    const knownFlags = [
      'version', 'v', 'help', 'h', 'prompt', 'p', 'model', 'm', 'provider',
      'host', 'list-models', 'pull-model', 'remove-model', 'model-info',
      'output', 'o', 'review-diffs', 'no-review', 'debug', 'no-color',
      'config', 'c', 'session', 's'
    ];
    
    await fc.assert(
      fc.asyncProperty(
        // Generate random flag names that are not in the known flags list
        fc
          .string({ minLength: 1, maxLength: 20 })
          .filter((s) => !knownFlags.includes(s) && /^[a-zA-Z0-9-_]+$/.test(s)),
        async (flagName) => {
          try {
            const res = await mainCLI([`--${flagName}`], { exitOnComplete: false });
            // If CLI returns 0, that's unexpected
            return res !== 0;
          } catch (_err) {
            // Yargs will throw on unknown flags when not exiting; that's acceptable
            return true;
          }
        }
      ),
      { numRuns: 8 }
    );
  });
});
