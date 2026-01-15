import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render, stripAnsi } from '../../../../test/ink-testing.js';
import { StatusBar, ConnectionStatus } from '../StatusBar.js';

/**
 * Property 17: Token Usage Format
 * Feature: stage-06-cli-ui, Property 17: Token Usage Format
 * Validates: Requirements 6.3
 * 
 * For any token usage display, the format should be "current/max"
 * where both values are integers.
 */
describe('Property 17: Token Usage Format', () => {
  const defaultTheme = {
    text: {
      primary: '#d4d4d4',
      secondary: '#858585',
      accent: '#4ec9b0',
    },
    status: {
      success: '#4ec9b0',
      warning: '#ce9178',
      error: '#f48771',
      info: '#569cd6',
    },
  };

  const defaultConnection: ConnectionStatus = {
    status: 'connected',
    provider: 'ollama',
  };

  const defaultProps = {
    connection: defaultConnection,
    model: 'llama3.2:3b',
    git: null,
    gpu: null,
    reviews: 0,
    cost: 0,
    theme: defaultTheme,
  };

  it('should display token usage in "current/max" format', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        (current, max) => {
          const tokens = { current, max };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const output = lastFrame();
          
          // Property: Token usage should be in "current/max" format
          const expectedFormat = `${current}/${max}`;
          expect(output).toContain(expectedFormat);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display both values as integers without decimals', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        (current, max) => {
          const tokens = { current, max };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const output = lastFrame();
          
          // Property: Both values should be integers (no decimal points)
          const tokenPattern = new RegExp(`${current}/${max}`);
          expect(output).toMatch(tokenPattern);
          
          // Extract just the token usage portion to check for decimals
          // Token usage appears before any git/gpu/review/cost info
          // Look for the pattern "number/number" and verify it's not followed by a decimal
          const tokenUsageMatch = output.match(new RegExp(`(${current}/${max})(?![\\d.])`));
          expect(tokenUsageMatch).toBeTruthy();
          
          // Verify the matched token usage doesn't have decimals in the numbers
          if (tokenUsageMatch) {
            const tokenUsageStr = tokenUsageMatch[1];
            // The token usage itself should not contain decimal points
            expect(tokenUsageStr).toBe(`${current}/${max}`);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero current tokens correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (max) => {
          const tokens = { current: 0, max };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const output = lastFrame();
          
          // Property: Zero current tokens should display as "0/max"
          expect(output).toContain(`0/${max}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle current equal to max correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        (value) => {
          const tokens = { current: value, max: value };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const output = lastFrame();
          
          // Property: When current equals max, format should be "value/value"
          expect(output).toContain(`${value}/${value}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain format consistency across re-renders', () => {
    fc.assert(
      fc.property(
        fc.record({
          current: fc.integer({ min: 0, max: 100000 }),
          max: fc.integer({ min: 1, max: 100000 }),
        }),
        ({ current, max }) => {
          const tokens = { current, max };

          // First render
          const { lastFrame: firstFrame, rerender } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const firstOutput = firstFrame();
          const expectedFormat = `${current}/${max}`;
          expect(firstOutput).toContain(expectedFormat);

          // Re-render with same tokens
          rerender(<StatusBar {...defaultProps} tokens={tokens} />);

          const secondOutput = firstFrame();
          
          // Property: Format should remain consistent across re-renders
          expect(secondOutput).toContain(expectedFormat);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use forward slash as separator', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        (current, max) => {
          const tokens = { current, max };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const output = lastFrame();
          
          // Property: Separator must be forward slash "/"
          expect(output).toContain(`${current}/${max}`);
          
          // Ensure no other separators are used
          expect(output).not.toContain(`${current} / ${max}`);
          expect(output).not.toContain(`${current}\\${max}`);
          expect(output).not.toContain(`${current}-${max}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle large token values correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50000, max: 1000000 }),
        fc.integer({ min: 50000, max: 1000000 }),
        (current, max) => {
          const tokens = { current, max };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} tokens={tokens} />
          );

          const output = lastFrame();
          
          // Property: Large values should still use integer format
          expect(output).toContain(`${current}/${max}`);
          
          // No thousand separators or scientific notation
          expect(output).not.toContain('e+');
          expect(output).not.toContain('E+');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
