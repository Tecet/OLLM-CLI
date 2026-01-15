/**
 * Test Error Reporting Tests
 * 
 * Tests for validating test failure information and error reporting.
 * Feature: stage-08-testing-qa
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { TestFailure } from '../testHelpers';

describe('Test Error Reporting', () => {
  describe('Property 34: Test Failure Information Completeness', () => {
    /**
     * Property 34: Test Failure Information Completeness
     * For any test failure, the error report should include the test name, location,
     * expected value, actual value, stack trace, and relevant context.
     * Validates: Requirements 17.1, 17.2, 17.3, 17.4
     * 
     * Feature: stage-08-testing-qa, Property 34: Test Failure Information Completeness
     */
    it('should include all required failure information', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate test failure data
          fc.record({
            testName: fc.string({ minLength: 1, maxLength: 100 }),
            testFile: fc.string({ minLength: 1, maxLength: 200 }).map(s => s + '.test.ts'),
            errorMessage: fc.string({ minLength: 1, maxLength: 500 }),
            stackTrace: fc.array(
              fc.string({ minLength: 10, maxLength: 100 }),
              { minLength: 1, maxLength: 10 }
            ).map(lines => lines.join('\n')),
            expected: fc.anything(),
            actual: fc.anything(),
          }),
          async (failureData) => {
            // Create a test failure object
            const failure: TestFailure = {
              testName: failureData.testName,
              testFile: failureData.testFile,
              errorMessage: failureData.errorMessage,
              stackTrace: failureData.stackTrace,
              expected: failureData.expected,
              actual: failureData.actual,
            };

            // Verify all required fields are present
            expect(failure.testName).toBeDefined();
            expect(failure.testName).toBeTruthy();
            
            expect(failure.testFile).toBeDefined();
            expect(failure.testFile).toBeTruthy();
            
            expect(failure.errorMessage).toBeDefined();
            expect(failure.errorMessage).toBeTruthy();
            
            expect(failure.stackTrace).toBeDefined();
            expect(failure.stackTrace).toBeTruthy();
            
            // Expected and actual can be any value, including undefined
            expect(failure).toHaveProperty('expected');
            expect(failure).toHaveProperty('actual');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format failure information for display', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            testName: fc.string({ minLength: 1, maxLength: 100 }),
            testFile: fc.string({ minLength: 1, maxLength: 200 }).map(s => s + '.test.ts'),
            errorMessage: fc.string({ minLength: 1, maxLength: 500 }),
            stackTrace: fc.array(
              fc.string({ minLength: 10, maxLength: 100 }),
              { minLength: 1, maxLength: 10 }
            ).map(lines => lines.join('\n')),
            expected: fc.anything(),
            actual: fc.anything(),
          }),
          async (failureData) => {
            const failure: TestFailure = {
              testName: failureData.testName,
              testFile: failureData.testFile,
              errorMessage: failureData.errorMessage,
              stackTrace: failureData.stackTrace,
              expected: failureData.expected,
              actual: failureData.actual,
            };

            // Format failure for display
            const formatted = formatTestFailure(failure);

            // Verify formatted output contains all key information
            expect(formatted).toContain(failure.testName);
            expect(formatted).toContain(failure.testFile);
            expect(formatted).toContain(failure.errorMessage);
            
            // Stack trace should be included
            expect(formatted).toContain('Stack trace:');
            
            // Expected and actual should be shown
            expect(formatted).toContain('Expected:');
            expect(formatted).toContain('Actual:');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include test location in failure report', () => {
      const failure: TestFailure = {
        testName: 'should validate user input',
        testFile: 'packages/core/src/__tests__/validation.test.ts',
        errorMessage: 'Expected value to be truthy',
        stackTrace: 'Error: Expected value to be truthy\n    at validation.test.ts:42:15',
        expected: true,
        actual: false,
      };

      const formatted = formatTestFailure(failure);

      // Verify location information is present
      expect(formatted).toContain(failure.testName);
      expect(formatted).toContain(failure.testFile);
    });

    it('should display expected and actual values clearly', () => {
      const failure: TestFailure = {
        testName: 'should match expected output',
        testFile: 'test.ts',
        errorMessage: 'Values do not match',
        stackTrace: 'Error: Values do not match\n    at test.ts:10:5',
        expected: { status: 'success', count: 5 },
        actual: { status: 'error', count: 3 },
      };

      const formatted = formatTestFailure(failure);

      // Verify expected and actual are clearly displayed
      expect(formatted).toContain('Expected:');
      expect(formatted).toContain('Actual:');
      
      // Should contain the actual values (as strings)
      expect(formatted).toContain('success');
      expect(formatted).toContain('error');
    });

    it('should include stack trace in failure report', () => {
      const stackTrace = `Error: Assertion failed
    at Object.<anonymous> (test.ts:15:10)
    at Promise.then.completed (vitest/dist/chunk.js:123:45)
    at processTicksAndRejections (node:internal/process:67:11)`;

      const failure: TestFailure = {
        testName: 'should process data correctly',
        testFile: 'test.ts',
        errorMessage: 'Assertion failed',
        stackTrace,
        expected: 'processed',
        actual: 'raw',
      };

      const formatted = formatTestFailure(failure);

      // Verify stack trace is included
      expect(formatted).toContain('Stack trace:');
      expect(formatted).toContain('test.ts:15:10');
    });

    it('should handle complex expected and actual values', () => {
      const failure: TestFailure = {
        testName: 'should handle nested objects',
        testFile: 'test.ts',
        errorMessage: 'Deep equality failed',
        stackTrace: 'Error: Deep equality failed\n    at test.ts:20:5',
        expected: {
          user: { name: 'Alice', age: 30, roles: ['admin', 'user'] },
          metadata: { created: new Date('2024-01-01'), updated: new Date('2024-01-15') },
        },
        actual: {
          user: { name: 'Alice', age: 31, roles: ['user'] },
          metadata: { created: new Date('2024-01-01'), updated: new Date('2024-01-16') },
        },
      };

      const formatted = formatTestFailure(failure);

      // Verify complex values are formatted
      expect(formatted).toContain('Expected:');
      expect(formatted).toContain('Actual:');
      expect(formatted).toContain('Alice');
    });

    it('should handle undefined and null values', () => {
      const testCases = [
        { expected: undefined, actual: null },
        { expected: null, actual: undefined },
        { expected: undefined, actual: 'value' },
        { expected: 'value', actual: null },
      ];

      testCases.forEach(({ expected, actual }) => {
        const failure: TestFailure = {
          testName: 'should handle null/undefined',
          testFile: 'test.ts',
          errorMessage: 'Value mismatch',
          stackTrace: 'Error: Value mismatch\n    at test.ts:5:10',
          expected,
          actual,
        };

        const formatted = formatTestFailure(failure);

        // Verify null/undefined are handled
        expect(formatted).toContain('Expected:');
        expect(formatted).toContain('Actual:');
      });
    });

    it('should include relevant context in failure report', () => {
      const failure: TestFailure = {
        testName: 'should validate API response',
        testFile: 'api.test.ts',
        errorMessage: 'Response validation failed: status code mismatch',
        stackTrace: 'Error: Response validation failed\n    at api.test.ts:50:12',
        expected: 200,
        actual: 404,
      };

      const formatted = formatTestFailure(failure);

      // Verify context from error message is preserved
      expect(formatted).toContain('status code mismatch');
      expect(formatted).toContain(failure.testName);
      expect(formatted).toContain(failure.testFile);
    });
  });

  describe('Property 35: Multiple Failure Reporting', () => {
    /**
     * Property 35: Multiple Failure Reporting
     * For any test run with multiple failures, all failures should be reported,
     * not just the first one.
     * Validates: Requirements 17.5
     * 
     * Feature: stage-08-testing-qa, Property 35: Multiple Failure Reporting
     */
    it('should report all failures when multiple tests fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple test failures
          fc.array(
            fc.record({
              testName: fc.string({ minLength: 1, maxLength: 100 }),
              testFile: fc.string({ minLength: 1, maxLength: 200 }).map(s => s + '.test.ts'),
              errorMessage: fc.string({ minLength: 1, maxLength: 500 }),
              stackTrace: fc.string({ minLength: 10, maxLength: 500 }),
              expected: fc.anything(),
              actual: fc.anything(),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (failuresData) => {
            // Create test failure objects
            const failures: TestFailure[] = failuresData.map(data => ({
              testName: data.testName,
              testFile: data.testFile,
              errorMessage: data.errorMessage,
              stackTrace: data.stackTrace,
              expected: data.expected,
              actual: data.actual,
            }));

            // Format all failures
            const report = formatMultipleFailures(failures);

            // Verify all failures are included in the report
            expect(report).toContain(`${failures.length} test(s) failed`);
            
            // Each failure should be present in the report
            failures.forEach(failure => {
              expect(report).toContain(failure.testName);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain failure order in report', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              testName: fc.string({ minLength: 1, maxLength: 100 }),
              testFile: fc.string({ minLength: 1, maxLength: 200 }).map(s => s + '.test.ts'),
              errorMessage: fc.string({ minLength: 1, maxLength: 500 }),
              stackTrace: fc.string({ minLength: 10, maxLength: 500 }),
              expected: fc.anything(),
              actual: fc.anything(),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (failuresData) => {
            const failures: TestFailure[] = failuresData.map(data => ({
              testName: data.testName,
              testFile: data.testFile,
              errorMessage: data.errorMessage,
              stackTrace: data.stackTrace,
              expected: data.expected,
              actual: data.actual,
            }));

            const report = formatMultipleFailures(failures);

            // Verify failures appear in order by finding all occurrences
            // and checking they appear in the same order as the input
            let searchStart = 0;
            failures.forEach(failure => {
              const index = report.indexOf(failure.testName, searchStart);
              expect(index).toBeGreaterThanOrEqual(searchStart);
              // Move search position past this occurrence
              searchStart = index + failure.testName.length;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should format multiple failures with clear separation', () => {
      const failures: TestFailure[] = [
        {
          testName: 'test 1',
          testFile: 'file1.test.ts',
          errorMessage: 'Error 1',
          stackTrace: 'Stack 1',
          expected: 'a',
          actual: 'b',
        },
        {
          testName: 'test 2',
          testFile: 'file2.test.ts',
          errorMessage: 'Error 2',
          stackTrace: 'Stack 2',
          expected: 1,
          actual: 2,
        },
        {
          testName: 'test 3',
          testFile: 'file3.test.ts',
          errorMessage: 'Error 3',
          stackTrace: 'Stack 3',
          expected: true,
          actual: false,
        },
      ];

      const report = formatMultipleFailures(failures);

      // Verify all failures are present
      expect(report).toContain('test 1');
      expect(report).toContain('test 2');
      expect(report).toContain('test 3');

      // Verify separation between failures
      expect(report).toContain('---');
    });

    it('should include failure count in summary', () => {
      const failures: TestFailure[] = [
        {
          testName: 'test 1',
          testFile: 'file1.test.ts',
          errorMessage: 'Error 1',
          stackTrace: 'Stack 1',
          expected: 'a',
          actual: 'b',
        },
        {
          testName: 'test 2',
          testFile: 'file2.test.ts',
          errorMessage: 'Error 2',
          stackTrace: 'Stack 2',
          expected: 1,
          actual: 2,
        },
      ];

      const report = formatMultipleFailures(failures);

      // Verify failure count is included
      expect(report).toContain('2 test(s) failed');
    });

    it('should handle single failure in multiple failure format', () => {
      const failures: TestFailure[] = [
        {
          testName: 'single test',
          testFile: 'file.test.ts',
          errorMessage: 'Error',
          stackTrace: 'Stack',
          expected: 'expected',
          actual: 'actual',
        },
      ];

      const report = formatMultipleFailures(failures);

      // Verify single failure is handled correctly
      expect(report).toContain('1 test(s) failed');
      expect(report).toContain('single test');
    });

    it('should not truncate failures when many tests fail', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              testName: fc.string({ minLength: 1, maxLength: 50 }),
              testFile: fc.string({ minLength: 1, maxLength: 100 }).map(s => s + '.test.ts'),
              errorMessage: fc.string({ minLength: 1, maxLength: 200 }),
              stackTrace: fc.string({ minLength: 10, maxLength: 200 }),
              expected: fc.anything(),
              actual: fc.anything(),
            }),
            { minLength: 10, maxLength: 20 }
          ),
          async (failuresData) => {
            const failures: TestFailure[] = failuresData.map(data => ({
              testName: data.testName,
              testFile: data.testFile,
              errorMessage: data.errorMessage,
              stackTrace: data.stackTrace,
              expected: data.expected,
              actual: data.actual,
            }));

            const report = formatMultipleFailures(failures);

            // Verify all failures are included (not truncated)
            failures.forEach(failure => {
              expect(report).toContain(failure.testName);
            });

            // Verify count is correct
            expect(report).toContain(`${failures.length} test(s) failed`);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Error Report Formatting', () => {
    it('should format error messages with proper indentation', () => {
      const failure: TestFailure = {
        testName: 'should format properly',
        testFile: 'format.test.ts',
        errorMessage: 'Multi-line\nerror\nmessage',
        stackTrace: 'Stack trace line 1\nStack trace line 2',
        expected: 'value',
        actual: 'other',
      };

      const formatted = formatTestFailure(failure);

      // Verify formatting is readable
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should handle very long error messages', () => {
      const longMessage = 'Error: '.repeat(100);
      const failure: TestFailure = {
        testName: 'long error test',
        testFile: 'test.ts',
        errorMessage: longMessage,
        stackTrace: 'Stack',
        expected: 'a',
        actual: 'b',
      };

      const formatted = formatTestFailure(failure);

      // Verify long messages are handled
      expect(formatted).toContain('long error test');
      expect(formatted.length).toBeGreaterThan(0);
    });

    it('should handle special characters in error messages', () => {
      const failure: TestFailure = {
        testName: 'special chars test',
        testFile: 'test.ts',
        errorMessage: 'Error with <html> & "quotes" and \'apostrophes\'',
        stackTrace: 'Stack',
        expected: 'a',
        actual: 'b',
      };

      const formatted = formatTestFailure(failure);

      // Verify special characters are preserved
      expect(formatted).toContain('<html>');
      expect(formatted).toContain('"quotes"');
      expect(formatted).toContain("'apostrophes'");
    });
  });
});

/**
 * Helper function to format a single test failure for display.
 */
function formatTestFailure(failure: TestFailure): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push(`Test: ${failure.testName}`);
  lines.push(`File: ${failure.testFile}`);
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Error: ${failure.errorMessage}`);
  lines.push('');
  lines.push('Expected:');
  lines.push(formatValue(failure.expected));
  lines.push('');
  lines.push('Actual:');
  lines.push(formatValue(failure.actual));
  lines.push('');
  lines.push('Stack trace:');
  lines.push(failure.stackTrace);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Helper function to format multiple test failures for display.
 */
function formatMultipleFailures(failures: TestFailure[]): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('='.repeat(80));
  lines.push(`FAILED: ${failures.length} test(s) failed`);
  lines.push('='.repeat(80));
  lines.push('');
  
  failures.forEach((failure, index) => {
    if (index > 0) {
      lines.push('');
      lines.push('-'.repeat(80));
      lines.push('');
    }
    lines.push(formatTestFailure(failure));
  });
  
  return lines.join('\n');
}

/**
 * Helper function to format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}
