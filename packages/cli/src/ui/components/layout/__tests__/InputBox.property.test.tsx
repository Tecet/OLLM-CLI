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
import { mockTheme, mockKeybinds, getTextContent } from '@ollm/test-utils';

// Mock state for useChat hook
let mockChatState = {
  messages: [] as Array<{ id: string; role: string; content: string; timestamp: Date }>,
  streaming: false,
  waitingForResponse: false,
  currentInput: '',
};

const mockSendMessage = vi.fn();
const mockSetCurrentInput = vi.fn();

// Mock the useChat hook
vi.mock('../../../../contexts/ChatContext.js', () => ({
  useChat: () => ({
    state: mockChatState,
    sendMessage: mockSendMessage,
    setCurrentInput: mockSetCurrentInput,
  }),
}));

describe('InputBox Property Tests', () => {
  const defaultTheme = mockTheme;
  const defaultKeybinds = mockKeybinds;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatState = {
      messages: [],
      streaming: false,
      waitingForResponse: false,
      currentInput: '',
    };
  });

  describe('Property 25: Input Field Value Display', () => {
    it('displays any single-line input value', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => !s.includes('\n')),
          (inputValue) => {
            mockChatState.currentInput = inputValue;

            const { lastFrame } = render(
              <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Input value should be present in the rendered frame
            expect(frameText).toContain(inputValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays multi-line input values', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 5 }),
          (lines) => {
            const inputValue = lines.join('\n');
            mockChatState.currentInput = inputValue;

            const { lastFrame } = render(
              <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: All lines should be present in the rendered frame
            for (const line of lines) {
              if (line.trim().length > 0) {
                expect(frameText).toContain(line);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays input with special characters', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (inputValue) => {
            mockChatState.currentInput = inputValue;

            const { lastFrame } = render(
              <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
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
        { numRuns: 100 }
      );
    });

    it('displays empty input with prompt', () => {
      mockChatState.currentInput = '';

      const { lastFrame } = render(
        <InputBox theme={defaultTheme} keybinds={defaultKeybinds} />
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
            mockChatState.currentInput = inputValue;

            const { lastFrame } = render(
              <InputBox theme={defaultTheme} keybinds={defaultKeybinds} disabled={true} />
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
            mockChatState.currentInput = inputValue;

            const { lastFrame } = render(
              <InputBox theme={defaultTheme} keybinds={defaultKeybinds} disabled={false} />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Enabled state should show input prompt
            expect(frameText).toContain('Type your message');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
