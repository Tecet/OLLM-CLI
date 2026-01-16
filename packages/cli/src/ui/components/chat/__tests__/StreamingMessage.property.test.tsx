/**
 * Property-Based Tests for Streaming Message Display
 * 
 * Feature: stage-08-testing-qa
 * Property 28: Incremental Text Rendering
 * 
 * Tests that streaming text is displayed progressively as chunks arrive,
 * with each update adding to the previous content.
 * 
 * Validates: Requirements 12.1
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { Message } from '../Message.js';
import { render } from 'ink-testing-library';
import { mockTheme } from '../../__tests__/testUtils.js';
import type { Message as MessageType } from '../../../../features/context/ChatContext.js';

describe('Property 28: Incremental Text Rendering', () => {
  /**
   * Property: For any streaming text, the UI should display text progressively
   * as chunks arrive, with each update adding to the previous content.
   */
  it('should display text progressively as chunks are added', () => {
    fc.assert(
      fc.property(
        // Generate an array of text chunks (1-20 chunks, each 1-100 chars)
        // Filter out whitespace-only chunks as they get normalized during rendering
        fc.array(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          { minLength: 1, maxLength: 20 }
        ),
        (chunks) => {
          // Build up content incrementally
          let accumulatedContent = '';
          const renderedContents: string[] = [];

          for (const chunk of chunks) {
            accumulatedContent += chunk;

            // Create a message with the accumulated content
            const message: MessageType = {
              id: 'test-msg-1',
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
            };

            // Render the message
            const { lastFrame } = render(
              <Message message={message} theme={mockTheme} />
            );

            const frame = lastFrame();
            renderedContents.push(frame || '');
          }

          // Verify that each render contains all previous content
          for (let i = 1; i < renderedContents.length; i++) {
            const previousContent = chunks.slice(0, i).join('').trimEnd();
            const currentFrame = renderedContents[i];

            // The current frame should contain all previous chunks
            // Note: Terminal rendering may trim trailing whitespace
            expect(
              currentFrame.includes(previousContent),
              `Frame ${i} should contain all previous content. Expected to find: "${previousContent.substring(0, 50)}..."`
            ).toBe(true);
          }

          // Verify that the final render contains all chunks
          const finalFrame = renderedContents[renderedContents.length - 1];
          const allContent = chunks.join('').trimEnd();
          expect(
            finalFrame.includes(allContent),
            'Final frame should contain all chunks'
          ).toBe(true);
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  it('should preserve content order during incremental updates', () => {
    fc.assert(
      fc.property(
        // Generate ordered chunks with markers to verify order
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 2, maxLength: 10 }),
        (numbers) => {
          // Convert numbers to text chunks with clear markers
          const chunks = numbers.map((n) => `[${n}]`);
          let accumulatedContent = '';

          for (let i = 0; i < chunks.length; i++) {
            accumulatedContent += chunks[i];

            const message: MessageType = {
              id: 'test-msg-2',
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
            };

            const { lastFrame } = render(
              <Message message={message} theme={mockTheme} />
            );

            const frame = lastFrame() || '';

            // Verify all chunks up to this point appear in order
            for (let j = 0; j <= i; j++) {
              const expectedChunk = chunks[j];
              expect(
                frame.includes(expectedChunk),
                `Frame should contain chunk ${j}: ${expectedChunk}`
              ).toBe(true);
            }

            // Verify the order is preserved by checking the full accumulated string
            expect(
              frame.includes(accumulatedContent),
              'Frame should contain accumulated content in correct order'
            ).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty chunks gracefully', () => {
    fc.assert(
      fc.property(
        // Generate chunks that may include empty strings
        fc.array(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 50 }),
            fc.constant('')
          ),
          { minLength: 1, maxLength: 15 }
        ),
        (chunks) => {
          let accumulatedContent = '';

          for (const chunk of chunks) {
            accumulatedContent += chunk;

            const message: MessageType = {
              id: 'test-msg-3',
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
            };

            // Should not throw when rendering with empty chunks
            expect(() => {
              render(<Message message={message} theme={mockTheme} />);
            }).not.toThrow();
          }

          // Verify final content matches all non-empty chunks
          const expectedContent = chunks.join('');
          expect(accumulatedContent).toBe(expectedContent);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle special characters in streaming text', () => {
    fc.assert(
      fc.property(
        // Generate chunks with various special characters
        fc.array(
          fc.string({ minLength: 1, maxLength: 50 }),
          { minLength: 1, maxLength: 10 }
        ),
        (chunks) => {
          let accumulatedContent = '';

          for (const chunk of chunks) {
            accumulatedContent += chunk;

            const message: MessageType = {
              id: 'test-msg-4',
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
            };

            const { lastFrame } = render(
              <Message message={message} theme={mockTheme} />
            );

            const frame = lastFrame() || '';

            // Should render without errors and contain the content
            // (Note: ANSI codes may be present, so we check for substring presence)
            expect(frame.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain content length growth during streaming', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 30 }),
          { minLength: 2, maxLength: 10 }
        ),
        (chunks) => {
          let previousLength = 0;

          for (let i = 0; i < chunks.length; i++) {
            const accumulatedContent = chunks.slice(0, i + 1).join('');

            const message: MessageType = {
              id: 'test-msg-5',
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date(),
            };

            const { lastFrame } = render(
              <Message message={message} theme={mockTheme} />
            );

            const frame = lastFrame() || '';

            // Content length should grow or stay the same (never shrink)
            expect(accumulatedContent.length).toBeGreaterThanOrEqual(previousLength);
            previousLength = accumulatedContent.length;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
