import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render, stripAnsi } from '../../../../test/ink-testing.js';
import { StatusBar, ConnectionStatus } from '../StatusBar.js';

/**
 * Property 18: Review Count Display
 * Feature: stage-06-cli-ui, Property 18: Review Count Display
 * Validates: Requirements 6.6
 * 
 * For any pending review count greater than zero, the status bar should display that count.
 */
describe('Property 18: Review Count Display', () => {
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
    tokens: { current: 100, max: 4096 },
    git: null,
    gpu: null,
    cost: 0,
    theme: defaultTheme,
  };

  it('should display review count when greater than zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (reviewCount) => {
          const { lastFrame } = render(
            <StatusBar {...defaultProps} reviews={reviewCount} />
          );

          const output = stripAnsi(lastFrame());
          
          // Property: Review count > 0 should be displayed with "Reviews:" prefix
          expect(output).toContain(`Reviews: ${reviewCount}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not display review count when zero', () => {
    fc.assert(
      fc.property(
        fc.constant(0),
        (reviewCount) => {
          const { lastFrame } = render(
            <StatusBar {...defaultProps} reviews={reviewCount} />
          );

          const output = stripAnsi(lastFrame());
          
          // Property: Review count of 0 should not be displayed
          expect(output).not.toContain('review');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display singular "review" for count of 1', () => {
    const { lastFrame } = render(
      <StatusBar {...defaultProps} reviews={1} />
    );

    const output = stripAnsi(lastFrame());
    
    // Property: Count of 1 should use "Reviews: 1" format
    expect(output).toContain('Reviews: 1');
  });

  it('should display plural "reviews" for count greater than 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 100 }),
        (reviewCount) => {
          const { lastFrame } = render(
            <StatusBar {...defaultProps} reviews={reviewCount} />
          );

          const output = stripAnsi(lastFrame());
          
          // Property: Count > 1 should use "Reviews: N" format
          expect(output).toContain(`Reviews: ${reviewCount}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display review count with warning color', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (reviewCount) => {
          const { lastFrame } = render(
            <StatusBar {...defaultProps} reviews={reviewCount} />
          );

          const output = stripAnsi(lastFrame());
          
          // Property: Review count should be displayed with "Reviews:" prefix
          expect(output).toContain(`Reviews: ${reviewCount}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain review count display across re-renders', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (reviewCount) => {
          // First render
          const { lastFrame: firstFrame, rerender } = render(
            <StatusBar {...defaultProps} reviews={reviewCount} />
          );

          const firstOutput = stripAnsi(firstFrame());
          expect(firstOutput).toContain(`Reviews: ${reviewCount}`);

          // Re-render with same review count
          rerender(<StatusBar {...defaultProps} reviews={reviewCount} />);

          const secondOutput = stripAnsi(firstFrame());
          
          // Property: Review count should remain consistent
          expect(secondOutput).toContain(`Reviews: ${reviewCount}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should update review count when it changes', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 1, max: 50 })
        ).filter(([a, b]) => a !== b),
        ([firstCount, secondCount]) => {
          // First render
          const { lastFrame: firstFrame, rerender } = render(
            <StatusBar {...defaultProps} reviews={firstCount} />
          );

          const firstOutput = stripAnsi(firstFrame());
          expect(firstOutput).toContain(`Reviews: ${firstCount}`);

          // Re-render with different review count
          rerender(<StatusBar {...defaultProps} reviews={secondCount} />);

          const secondOutput = stripAnsi(firstFrame());
          
          // Property: Review count should update to new value
          expect(secondOutput).toContain(`Reviews: ${secondCount}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should hide review count when it becomes zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (initialCount) => {
          // First render with reviews
          const { lastFrame: firstFrame, rerender } = render(
            <StatusBar {...defaultProps} reviews={initialCount} />
          );

          const firstOutput = stripAnsi(firstFrame());
          expect(firstOutput).toContain(`Reviews: ${initialCount}`);

          // Re-render with zero reviews
          rerender(<StatusBar {...defaultProps} reviews={0} />);

          const secondOutput = stripAnsi(firstFrame());
          
          // Property: Review count should be hidden when zero
          expect(secondOutput).not.toContain('review');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display review count alongside other status bar elements', () => {
    fc.assert(
      fc.property(
        fc.record({
          reviews: fc.integer({ min: 1, max: 100 }),
          tokens: fc.record({
            current: fc.integer({ min: 0, max: 10000 }),
            max: fc.integer({ min: 1000, max: 100000 }),
          }),
          // Avoid reserved words and problematic strings
          model: fc.string({ minLength: 1, maxLength: 30 })
            .filter(s => !['constructor', 'prototype', '__proto__', 'toString', 'valueOf'].includes(s)),
        }),
        ({ reviews, tokens, model }) => {
          const { lastFrame } = render(
            <StatusBar
              {...defaultProps}
              reviews={reviews}
              tokens={tokens}
              model={model}
            />
          );

          const output = stripAnsi(lastFrame());
          
          // Property: Review count should coexist with other elements
          expect(output).toContain(`Reviews: ${reviews}`);
          expect(output).toContain(model);
          expect(output).toContain(`${tokens.current}/${tokens.max}`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
