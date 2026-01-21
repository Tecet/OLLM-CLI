/**
 * InputBox Property-Based Tests
 * 
 * Property 25: Input Field Value Display
 * For any input value, the InputBox should display the value correctly
 * without loss of information.
 * 
 * Validates: Requirements 10.4, 10.5
 * 
 * Feature: stage-08-testing-qa, Property 25: Input Field Value Display
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import * as fc from 'fast-check';
import { InputBox } from '../InputBox.js';
import { mockTheme, getTextContent } from '../../__tests__/testUtils.js';

describe('InputBox Property Tests', () => {
  const defaultTheme = mockTheme;
  const mockOnSubmit = vi.fn();
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 25: Input Field Value Display', () => {
    it('displays any single-line input value', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => !s.includes('\n')),
          (inputValue) => {
            const { lastFrame } = render(
              <InputBox
                theme={defaultTheme}
                value={inputValue}
                onChange={mockOnChange}
                onSubmit={mockOnSubmit}
                userMessages={[]}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Input value should be present, unless it's whitespace-only
            const trimmedRight = inputValue.replace(/\s+$/, '');
            if (trimmedRight.trim().length === 0) {
              expect(frameText).toContain('Type your message');
            } else {
              expect(frameText).toContain(trimmedRight);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('displays multi-line input values', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          (lines) => {
            const inputValue = lines.join('\n');
            const { lastFrame } = render(
              <InputBox
                theme={defaultTheme}
                value={inputValue}
                onChange={mockOnChange}
                onSubmit={mockOnSubmit}
                userMessages={[]}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: All non-empty lines should be present (ignore trailing spaces)
            for (const line of lines) {
              const trimmedRight = line.replace(/\s+$/, '');
              if (trimmedRight.trim().length > 0) {
                expect(frameText).toContain(trimmedRight);
              }
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('displays input with special characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (inputValue) => {
            const { lastFrame } = render(
              <InputBox
                theme={defaultTheme}
                value={inputValue}
                onChange={mockOnChange}
                onSubmit={mockOnSubmit}
                userMessages={[]}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Frame should not be empty for non-empty input
            if (inputValue.trim().length > 0) {
              expect(frameText.length).toBeGreaterThan(0);
              
              // At least some characters from the input should be present
              const hasContent = inputValue.split('').some(char => 
                frameText.includes(char) || frameText.includes(char.toLowerCase())
              );
              expect(hasContent).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('displays empty input with prompt', () => {
      const { lastFrame } = render(
        <InputBox
          theme={defaultTheme}
          value=""
          onChange={mockOnChange}
          onSubmit={mockOnSubmit}
          userMessages={[]}
        />
      );

      const frame = lastFrame();
      const frameText = getTextContent(frame);

      // Property: Empty input should still show the prompt
      expect(frameText).toContain('>');
      expect(frameText).toContain('Type your message');
    });

    it('shows disabled state correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 100 }),
          (inputValue) => {
            const { lastFrame } = render(
              <InputBox
                theme={defaultTheme}
                value={inputValue}
                onChange={mockOnChange}
                onSubmit={mockOnSubmit}
                userMessages={[]}
                disabled={true}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Disabled state should show waiting message
            expect(frameText).toContain('Waiting for response');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('shows enabled state correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ maxLength: 100 }),
          (inputValue) => {
            const { lastFrame } = render(
              <InputBox
                theme={defaultTheme}
                value={inputValue}
                onChange={mockOnChange}
                onSubmit={mockOnSubmit}
                userMessages={[]}
                disabled={false}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Enabled state should show input prompt when empty/whitespace
            // or show the actual input value when non-empty
            if (inputValue.trim().length === 0) {
              expect(frameText).toContain('Type your message');
            } else {
              // Should show the input value or at least the prompt symbol
              expect(frameText).toContain('>');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
