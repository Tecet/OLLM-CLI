/**
 * Property 29: Reasoning Box Toggle
 * Feature: stage-06-cli-ui, Property 29: Reasoning Box Toggle
 * Validates: Requirements 16.6
 * 
 * For any reasoning box expand/collapse action (click or Ctrl+R),
 * the visibility state should toggle.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '../../../../test/ink-testing.js';
import { ReasoningBox } from '../ReasoningBox.js';
import type { ReasoningBlock } from '../../../../../../core/src/services/reasoningParser.js';
import React from 'react';

describe('Property 29: Reasoning Box Toggle', () => {
  const defaultTheme = {
    text: {
      primary: '#d4d4d4',
      secondary: '#858585',
      accent: '#4ec9b0',
    },
    bg: {
      secondary: '#1e1e1e',
    },
  };

  // Arbitrary for generating reasoning blocks
  const reasoningBlockArbitrary = fc.record({
    content: fc.stringOf(fc.char(), { minLength: 10, maxLength: 500 }),
    tokenCount: fc.integer({ min: 1, max: 1000 }),
    duration: fc.float({ min: 0, max: 60, noNaN: true }),
    complete: fc.boolean(),
  }).map((raw): ReasoningBlock => ({
    ...raw,
  }));

  it('should toggle from expanded to collapsed', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        let expanded = true;
        const onToggle = () => {
          expanded = !expanded;
        };

        const { lastFrame, rerender } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        // Property: Initially expanded should show content
        const initialOutput = lastFrame();
        expect(initialOutput).toContain('Reasoning');
        expect(initialOutput).toContain('Collapse');

        // Simulate toggle
        onToggle();

        // Re-render with new state
        rerender(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        // Property: After toggle, should be collapsed
        const collapsedOutput = lastFrame();
        expect(collapsedOutput).toContain('Expand');
        expect(collapsedOutput).toContain(`${reasoning.tokenCount} tokens`);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should toggle from collapsed to expanded', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        let expanded = false;
        const onToggle = () => {
          expanded = !expanded;
        };

        const { lastFrame, rerender } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        // Property: Initially collapsed should show summary
        const initialOutput = lastFrame();
        expect(initialOutput).toContain('Expand');
        expect(initialOutput).toContain(`${reasoning.tokenCount} tokens`);

        // Simulate toggle
        onToggle();

        // Re-render with new state
        rerender(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        // Property: After toggle, should be expanded
        const expandedOutput = lastFrame();
        expect(expandedOutput).toContain('Collapse');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should toggle multiple times correctly', () => {
    fc.assert(
      fc.property(
        reasoningBlockArbitrary,
        fc.integer({ min: 1, max: 10 }),
        (reasoning, toggleCount) => {
          let expanded = true;
          const onToggle = () => {
            expanded = !expanded;
          };

          const { lastFrame, rerender } = render(
            <ReasoningBox
              reasoning={reasoning}
              expanded={expanded}
              onToggle={onToggle}
              theme={defaultTheme}
            />
          );

          // Property: Toggle multiple times
          for (let i = 0; i < toggleCount; i++) {
            onToggle();
            rerender(
              <ReasoningBox
                reasoning={reasoning}
                expanded={expanded}
                onToggle={onToggle}
                theme={defaultTheme}
              />
            );
          }

          const finalOutput = lastFrame();

          // Property: Final state should match expected state after toggles
          const expectedExpanded = toggleCount % 2 === 1 ? false : true;
          if (expectedExpanded) {
            expect(finalOutput).toContain('Collapse');
          } else {
            expect(finalOutput).toContain('Expand');
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show token count when collapsed', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        const { lastFrame } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={false}
            theme={defaultTheme}
          />
        );

        const output = lastFrame();

        // Property: Collapsed state should always show token count
        expect(output).toContain(`${reasoning.tokenCount} tokens`);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should show duration when collapsed and duration > 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          content: fc.string(),
          tokenCount: fc.integer({ min: 1, max: 1000 }),
          duration: fc.float({ min: Math.fround(0.1), max: 60, noNaN: true }),
          complete: fc.boolean(),
        }),
        (reasoning) => {
          const { lastFrame } = render(
            <ReasoningBox
              reasoning={reasoning}
              expanded={false}
              theme={defaultTheme}
            />
          );

          const output = lastFrame();

          // Property: Should show duration when > 0
          if (reasoning.duration > 0) {
            expect(output).toMatch(/\d+\.\d+s/);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not show content when collapsed', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        const { lastFrame } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={false}
            theme={defaultTheme}
          />
        );

        const output = lastFrame();

        // Property: Collapsed state should not show the actual content
        // (only summary with token count and duration)
        const lines = output.split('\n');

        // Should be compact (few lines)
        expect(lines.length).toBeLessThan(5);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should show expand indicator when collapsed', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        const { lastFrame } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={false}
            theme={defaultTheme}
          />
        );

        const output = lastFrame();

        // Property: Collapsed state should show expand indicator
        expect(output).toContain('Expand');
        expect(output).not.toContain('Collapse');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should show collapse indicator when expanded', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        const { lastFrame } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={true}
            theme={defaultTheme}
          />
        );

        const output = lastFrame();

        // Property: Expanded state should show collapse indicator
        expect(output).toContain('Collapse');
        expect(output).not.toContain('Expand');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain reasoning content across toggle', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        let expanded = true;
        const onToggle = () => {
          expanded = !expanded;
        };

        const { lastFrame, rerender } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        // Get initial content
        lastFrame();

        // Toggle to collapsed
        onToggle();
        rerender(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        // Toggle back to expanded
        onToggle();
        rerender(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={defaultTheme}
          />
        );

        const finalOutput = lastFrame();

        // Property: Content should be the same after toggle cycle
        // (both should show collapse indicator and reasoning header)
        expect(finalOutput).toContain('Collapse');
        expect(finalOutput).toContain('Reasoning');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should work with controlled expanded state', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, fc.boolean(), (reasoning, initialExpanded) => {
        // Test component with controlled expanded prop
        const { lastFrame } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={initialExpanded}
            theme={defaultTheme}
          />
        );

        const output = lastFrame();

        // Property: Component should respect controlled state
        if (initialExpanded) {
          expect(output).toContain('Collapse');
        } else {
          expect(output).toContain('Expand');
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve theme colors across toggle', () => {
    fc.assert(
      fc.property(reasoningBlockArbitrary, (reasoning) => {
        let expanded = true;
        const onToggle = () => {
          expanded = !expanded;
        };

        const customTheme = {
          text: {
            primary: '#ff0000',
            secondary: '#00ff00',
            accent: '#0000ff',
          },
          bg: {
            secondary: '#ffffff',
          },
        };

        const { lastFrame, rerender } = render(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={customTheme}
          />
        );

        // Get initial output
        lastFrame();

        // Toggle
        onToggle();
        rerender(
          <ReasoningBox
            reasoning={reasoning}
            expanded={expanded}
            onToggle={onToggle}
            theme={customTheme}
          />
        );

        // Property: Theme should be applied consistently
        // (we can't directly test colors in terminal output, but structure should be consistent)
        const output = lastFrame();
        expect(output).toContain('Reasoning');

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
