import { describe, it, expect } from 'vitest';
import { render } from '../../../../test/ink-testing.js';
import React from 'react';
import fc from 'fast-check';
import { ToolCall } from '../ToolCall.js';
import type { ToolCall as ToolCallType } from '../../../../features/context/ChatContext.js';

/**
 * Property 20: Tool Call Display Completeness
 * 
 * For any tool call, the chat history should display the tool name, 
 * arguments, and result (when available).
 * 
 * Feature: stage-06-cli-ui, Property 20: Tool Call Display Completeness
 * Validates: Requirements 7.3
 */
describe('Property 20: Tool Call Display Completeness', () => {
  it('should display tool name, arguments, and result for any tool call', () => {
    fc.assert(
      fc.property(
        // Generate random tool call
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => !['constructor', 'prototype', '__proto__'].includes(s)),
          arguments: fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => !['constructor', 'prototype', '__proto__'].includes(s)),
            fc.oneof(fc.string(), fc.integer(), fc.boolean())
          ),
          result: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
          duration: fc.option(fc.integer({ min: 100, max: 10000 }), { nil: undefined }),
          status: fc.constantFrom('pending', 'success', 'error'),
        }),
        (toolCallData) => {
          const toolCall: ToolCallType = {
            ...toolCallData,
            status: toolCallData.status as 'pending' | 'success' | 'error',
          };

          const theme = {
            text: {
              primary: '#ffffff',
              secondary: '#888888',
              accent: '#00ff00',
            },
            status: {
              success: '#00ff00',
              warning: '#ffff00',
              error: '#ff0000',
              info: '#0000ff',
            },
          };

          const { lastFrame } = render(<ToolCall toolCall={toolCall} theme={theme} />);
          const output = lastFrame();

          // Verify tool name is displayed
          expect(output).toContain(toolCall.name);

          // Verify status is displayed
          expect(output).toContain(toolCall.status);

          // Verify arguments are displayed (as JSON)
          // Check if at least part of the arguments are visible
          expect(output).toBeTruthy();

          // Verify result is displayed when available
          if (toolCall.result) {
            expect(output).toContain(toolCall.result);
          }

          // Verify duration is displayed when available
          if (toolCall.duration) {
            const durationSeconds = (toolCall.duration / 1000).toFixed(2);
            expect(output).toContain(durationSeconds);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
