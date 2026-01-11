/**
 * Tests for Output Helpers
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { OutputFormatter } from '../output-helpers.js';

describe('Output Helpers', () => {
  describe('Property 43: Output Truncation Behavior', () => {
    it('should truncate output exceeding maxChars and append indicator', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.integer({ min: 1, max: 500 }),
          (output, maxChars) => {
            // Only test when output exceeds maxChars
            if (output.length <= maxChars) return true;

            const result = OutputFormatter.truncate(output, { maxChars });

            // Should be truncated
            expect(result.truncated).toBe(true);

            // Should have omitted info
            expect(result.omitted).toBeDefined();
            expect(result.omitted).toContain('characters');

            // Content should include truncation indicator
            expect(result.content).toContain('[Output truncated:');
            expect(result.content).toContain('omitted]');

            // Content should specify how much was omitted
            const expectedOmitted = output.length - maxChars;
            expect(result.content).toContain(`${expectedOmitted} characters`);

            // The actual content (without indicator) should be at most maxChars
            const contentWithoutIndicator = result.content.split(
              '\n\n[Output truncated:'
            )[0];
            expect(contentWithoutIndicator.length).toBeLessThanOrEqual(
              maxChars
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate output exceeding maxLines and append indicator', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 0, maxLength: 50 }), {
            minLength: 1,
            maxLength: 100,
          }),
          fc.integer({ min: 1, max: 50 }),
          (lines, maxLines) => {
            // Only test when output exceeds maxLines
            if (lines.length <= maxLines) return true;

            const output = lines.join('\n');
            const result = OutputFormatter.truncate(output, { maxLines });

            // Should be truncated
            expect(result.truncated).toBe(true);

            // Should have omitted info
            expect(result.omitted).toBeDefined();
            expect(result.omitted).toContain('lines');

            // Content should include truncation indicator
            expect(result.content).toContain('[Output truncated:');
            expect(result.content).toContain('omitted]');

            // Content should specify how much was omitted
            const expectedOmitted = lines.length - maxLines;
            expect(result.content).toContain(`${expectedOmitted} lines`);

            // The actual content (without indicator) should have at most maxLines
            const contentWithoutIndicator = result.content.split(
              '\n\n[Output truncated:'
            )[0];
            const resultLines = contentWithoutIndicator.split('\n');
            expect(resultLines.length).toBeLessThanOrEqual(maxLines);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate by both lines and chars when both limits are exceeded', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 10, maxLength: 50 }), {
            minLength: 10,
            maxLength: 100,
          }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 10, max: 100 }),
          (lines, maxLines, maxChars) => {
            const output = lines.join('\n');

            // Only test when both limits are exceeded
            if (lines.length <= maxLines && output.length <= maxChars) {
              return true;
            }

            const result = OutputFormatter.truncate(output, {
              maxLines,
              maxChars,
            });

            // If either limit was exceeded, should be truncated
            if (lines.length > maxLines || output.length > maxChars) {
              expect(result.truncated).toBe(true);
              expect(result.omitted).toBeDefined();
              expect(result.content).toContain('[Output truncated:');
            }

            // Check what actually got truncated
            // Lines are truncated first, then characters
            const lineTruncated = lines.length > maxLines;
            const afterLineTruncation = lineTruncated
              ? lines.slice(0, maxLines).join('\n')
              : output;
            const charTruncated = afterLineTruncation.length > maxChars;

            // Verify the omitted message matches what was actually truncated
            if (lineTruncated && charTruncated) {
              expect(result.omitted).toContain('lines');
              expect(result.omitted).toContain('characters');
              expect(result.omitted).toContain('and');
            } else if (lineTruncated) {
              expect(result.omitted).toContain('lines');
            } else if (charTruncated) {
              expect(result.omitted).toContain('characters');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not truncate output within limits', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 100 }),
          fc.integer({ min: 100, max: 1000 }),
          (output, maxChars) => {
            // Ensure output is within limit
            if (output.length > maxChars) return true;

            const result = OutputFormatter.truncate(output, { maxChars });

            // Should not be truncated
            expect(result.truncated).toBe(false);

            // Should not have omitted info
            expect(result.omitted).toBeUndefined();

            // Content should be exactly the same as input
            expect(result.content).toBe(output);

            // Should not contain truncation indicator
            expect(result.content).not.toContain('[Output truncated:');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty output', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 100 }),
          (maxChars, maxLines) => {
            const result = OutputFormatter.truncate('', {
              maxChars,
              maxLines,
            });

            // Empty output should not be truncated
            expect(result.truncated).toBe(false);
            expect(result.omitted).toBeUndefined();
            expect(result.content).toBe('');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle output exactly at the limit', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (limit) => {
            // Create output exactly at the character limit
            const output = 'a'.repeat(limit);
            const result = OutputFormatter.truncate(output, {
              maxChars: limit,
            });

            // Should not be truncated
            expect(result.truncated).toBe(false);
            expect(result.omitted).toBeUndefined();
            expect(result.content).toBe(output);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should truncate lines before characters', () => {
      // Feature: stage-03-tools-policy, Property 43: Output Truncation Behavior
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 20, maxLength: 30 }), {
            minLength: 10,
            maxLength: 20,
          }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 50, max: 100 }),
          (lines, maxLines, maxChars) => {
            const output = lines.join('\n');

            // Only test when both limits would be exceeded
            if (lines.length <= maxLines || output.length <= maxChars) {
              return true;
            }

            const result = OutputFormatter.truncate(output, {
              maxLines,
              maxChars,
            });

            // Lines should be truncated first
            const contentWithoutIndicator = result.content.split(
              '\n\n[Output truncated:'
            )[0];
            const resultLines = contentWithoutIndicator.split('\n');

            // Should have at most maxLines
            expect(resultLines.length).toBeLessThanOrEqual(maxLines);

            // Then characters should be truncated
            expect(contentWithoutIndicator.length).toBeLessThanOrEqual(
              maxChars
            );

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('formatForLLM', () => {
    it('should trim whitespace from output', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 10 }).filter((s) =>
            /^\s*$/.test(s)
          ),
          fc.string({ minLength: 0, maxLength: 10 }).filter((s) =>
            /^\s*$/.test(s)
          ),
          (content, leadingWhitespace, trailingWhitespace) => {
            const output = leadingWhitespace + content + trailingWhitespace;
            const formatted = OutputFormatter.formatForLLM(output);

            // Should be trimmed
            expect(formatted).toBe(content.trim());

            // Should not have leading or trailing whitespace
            if (formatted.length > 0) {
              expect(formatted[0]).not.toMatch(/\s/);
              expect(formatted[formatted.length - 1]).not.toMatch(/\s/);
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('formatForDisplay', () => {
    it('should return output as-is', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 100 }), (output) => {
          const formatted = OutputFormatter.formatForDisplay(output);

          // Should be unchanged
          expect(formatted).toBe(output);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
