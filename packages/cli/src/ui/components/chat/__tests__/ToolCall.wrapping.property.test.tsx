import { describe, it, expect } from 'vitest';
import { render, stripAnsi } from '../../../../test/ink-testing.js';
import React from 'react';
import fc from 'fast-check';
import { ToolCall } from '../ToolCall.js';
import { ToolCall as ToolCallType } from '../../../../contexts/ChatContext.js';

/**
 * Property 21: Long Argument Wrapping
 * 
 * For any tool call with arguments exceeding 80 characters, 
 * the chat history should wrap the arguments and provide an expand option.
 * 
 * Feature: stage-06-cli-ui, Property 21: Long Argument Wrapping
 * Validates: Requirements 7.4
 */
describe('Property 21: Long Argument Wrapping', () => {
  it('should wrap arguments exceeding 80 characters and provide expand option', () => {
    fc.assert(
      fc.property(
        // Generate tool calls with varying argument lengths
        fc.record({
          id: fc.uuid(),
          name: fc.string({ minLength: 1, maxLength: 20 }),
          // Generate arguments that will produce JSON strings of varying lengths
          arguments: fc.oneof(
            // Short arguments (< 80 chars when stringified)
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 10 }),
            }),
            // Long arguments (> 80 chars when stringified)
            fc.record({
              longKey1: fc.string({ minLength: 50, maxLength: 100 }),
              longKey2: fc.string({ minLength: 50, maxLength: 100 }),
              longKey3: fc.string({ minLength: 50, maxLength: 100 }),
            })
          ),
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

          // Calculate the length of the JSON-stringified arguments
          const argsString = JSON.stringify(toolCall.arguments, null, 2);
          const argsLength = argsString.length;

          if (argsLength > 80) {
            // For long arguments, should show truncated version with expand option
            expect(output).toContain('...');
            expect(output).toContain('expand');
          } else {
            // For short arguments, should show full arguments without expand option
            expect(output).not.toContain('expand');
          }

          // Should always display the tool name
          expect(output).toContain(toolCall.name);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should show full arguments when expanded', () => {
    // Create a tool call with long arguments
    const toolCall: ToolCallType = {
      id: 'test-id',
      name: 'test-tool',
      arguments: {
        longArgument1: 'This is a very long argument that exceeds 80 characters when stringified',
        longArgument2: 'Another long argument to ensure we exceed the threshold',
        longArgument3: 'Yet another long argument for good measure',
      },
      status: 'success',
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

    // Render with expanded=true
    const { lastFrame } = render(<ToolCall toolCall={toolCall} expanded={true} theme={theme} />);
    const output = lastFrame();

    // Should show full arguments
    expect(output).toContain('longArgument1');
    expect(output).toContain('longArgument2');
    expect(output).toContain('longArgument3');
    
    // Should show collapse option
    expect(output).toContain('collapse');
  });
});
