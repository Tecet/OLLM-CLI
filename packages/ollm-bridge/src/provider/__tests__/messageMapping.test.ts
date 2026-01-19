/**
 * Tests for message part concatenation in LocalProvider
 * Verifies that message parts are properly separated with delimiters
 */

import { describe, it, expect } from 'vitest';
import type { Message, MessagePart } from '@ollm/core';

// Mock the LocalProvider's mapMessages method behavior
function mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
  const mapped = [];

  if (systemPrompt) {
    mapped.push({ role: 'system', content: systemPrompt });
  }

  // Configuration for message part concatenation
  const PART_SEPARATOR = '\n\n'; // Double newline for clear separation
  const IMAGE_PLACEHOLDER = '[image]';

  for (const msg of messages) {
    const content = msg.parts
      .map((part: MessagePart) => (part.type === 'text' ? part.text : IMAGE_PLACEHOLDER))
      .join(PART_SEPARATOR);

    mapped.push({
      role: msg.role === 'tool' ? 'tool' : msg.role,
      content,
      ...(msg.name && { name: msg.name }),
      ...(msg.toolCalls && {
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: tc.args
          }
        }))
      }),
      ...(msg.toolCallId && { tool_call_id: msg.toolCallId })
    });
  }

  return mapped;
}

describe('Message Part Concatenation', () => {
  describe('Single Part Messages', () => {
    it('should handle single text part', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello, world!' }]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'Hello, world!'
      });
    });

    it('should handle single image part', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'image', data: 'base64data' }]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: '[image]'
      });
    });
  });

  describe('Multi-Part Messages', () => {
    it('should separate text parts with double newline', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'First part' },
            { type: 'text', text: 'Second part' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'First part\n\nSecond part'
      });
    });

    it('should separate text and image parts with double newline', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Look at this image:' },
            { type: 'image', data: 'base64data' },
            { type: 'text', text: 'What do you see?' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'Look at this image:\n\n[image]\n\nWhat do you see?'
      });
    });

    it('should handle multiple images with text', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Compare these images:' },
            { type: 'image', data: 'image1' },
            { type: 'image', data: 'image2' },
            { type: 'text', text: 'Which is better?' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'Compare these images:\n\n[image]\n\n[image]\n\nWhich is better?'
      });
    });

    it('should preserve structure with three text parts', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' },
            { type: 'text', text: 'Part 3' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'Part 1\n\nPart 2\n\nPart 3'
      });
    });
  });

  describe('Multiple Messages', () => {
    it('should handle multiple messages with multi-part content', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'First message' },
            { type: 'text', text: 'with two parts' }
          ]
        },
        {
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Response part 1' },
            { type: 'text', text: 'Response part 2' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'First message\n\nwith two parts'
      });
      expect(result[1]).toMatchObject({
        role: 'assistant',
        content: 'Response part 1\n\nResponse part 2'
      });
    });
  });

  describe('System Prompt', () => {
    it('should include system prompt as first message', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      ];

      const result = mapMessages(messages, 'You are a helpful assistant.');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        role: 'system',
        content: 'You are a helpful assistant.'
      });
      expect(result[1]).toMatchObject({
        role: 'user',
        content: 'Hello'
      });
    });

    it('should handle system prompt with multi-part user message', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Part 1' },
            { type: 'text', text: 'Part 2' }
          ]
        }
      ];

      const result = mapMessages(messages, 'System prompt');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        role: 'system',
        content: 'System prompt'
      });
      expect(result[1]).toMatchObject({
        role: 'user',
        content: 'Part 1\n\nPart 2'
      });
    });
  });

  describe('Tool Messages', () => {
    it('should handle tool role messages with multi-part content', () => {
      const messages: Message[] = [
        {
          role: 'tool',
          parts: [
            { type: 'text', text: 'Tool result part 1' },
            { type: 'text', text: 'Tool result part 2' }
          ],
          toolCallId: 'call_123'
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'tool',
        content: 'Tool result part 1\n\nTool result part 2',
        tool_call_id: 'call_123'
      });
    });

    it('should handle assistant message with tool calls and multi-part content', () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Let me check that' },
            { type: 'text', text: 'for you' }
          ],
          toolCalls: [
            {
              id: 'call_123',
              name: 'search',
              args: { query: 'test' }
            }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'assistant',
        content: 'Let me check that\n\nfor you',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'search',
              arguments: { query: 'test' }
            }
          }
        ]
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty parts array', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: []
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: ''
      });
    });

    it('should handle empty text parts', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: '' },
            { type: 'text', text: 'Non-empty' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: '\n\nNon-empty'
      });
    });

    it('should handle whitespace-only text parts', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: '   ' },
            { type: 'text', text: 'Text' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: '   \n\nText'
      });
    });

    it('should preserve newlines within text parts', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'Line 1\nLine 2' },
            { type: 'text', text: 'Line 3\nLine 4' }
          ]
        }
      ];

      const result = mapMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        role: 'user',
        content: 'Line 1\nLine 2\n\nLine 3\nLine 4'
      });
    });
  });

  describe('Separator Behavior', () => {
    it('should use double newline as separator', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [
            { type: 'text', text: 'A' },
            { type: 'text', text: 'B' }
          ]
        }
      ];

      const result = mapMessages(messages);
      const content = (result[0] as any).content;

      // Verify separator is exactly '\n\n'
      expect(content).toBe('A\n\nB');
      expect(content.split('\n\n')).toEqual(['A', 'B']);
    });

    it('should not add separator for single part', () => {
      const messages: Message[] = [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Single' }]
        }
      ];

      const result = mapMessages(messages);
      const content = (result[0] as any).content;

      // No separator should be present
      expect(content).toBe('Single');
      expect(content).not.toContain('\n\n');
    });
  });
});
