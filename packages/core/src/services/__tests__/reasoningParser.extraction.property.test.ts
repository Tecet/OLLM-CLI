/**
 * Property 28: Reasoning Block Extraction
 * Feature: stage-06-cli-ui, Property 28: Reasoning Block Extraction
 * Validates: Requirements 16.1
 * 
 * For any model output containing <think>...</think> blocks, the reasoning parser
 * should extract the thinking content and separate it from the response content.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ReasoningParser } from '../reasoningParser.js';

describe('Property 28: Reasoning Block Extraction', () => {
  const parser = new ReasoningParser();

  // Arbitrary for generating text content (alphanumeric with spaces and punctuation)
  const textContentArbitrary = fc.stringOf(
    fc.oneof(
      fc.char(),
      fc.constantFrom(' ', '.', ',', '!', '?', '\n', '-', ':', ';')
    ),
    { minLength: 1, maxLength: 500 }
  );

  it('should extract thinking content from complete think blocks', () => {
    fc.assert(
      fc.property(textContentArbitrary, textContentArbitrary, (thinkContent, responseContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        // Generate text with think block
        const text = `${responseContent}<think>${thinkContent}</think>`;
        
        const result = parser.parse(text);

        // Property: Thinking content should be extracted
        expect(result.reasoning).not.toBeNull();
        expect(result.reasoning?.content.trim()).toBe(thinkContent.trim());
        
        // Property: Response should not contain think tags
        expect(result.response).not.toContain('<think>');
        expect(result.response).not.toContain('</think>');
        
        // Property: Response should contain the response content
        expect(result.response.trim()).toBe(responseContent.trim());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should extract thinking content when think block is at the start', () => {
    fc.assert(
      fc.property(textContentArbitrary, textContentArbitrary, (thinkContent, responseContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        const text = `<think>${thinkContent}</think>${responseContent}`;
        
        const result = parser.parse(text);

        // Property: Thinking content should be extracted
        expect(result.reasoning).not.toBeNull();
        expect(result.reasoning?.content.trim()).toBe(thinkContent.trim());
        
        // Property: Response should be the content after think block
        expect(result.response.trim()).toBe(responseContent.trim());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should extract thinking content when think block is in the middle', () => {
    fc.assert(
      fc.property(
        textContentArbitrary,
        textContentArbitrary,
        textContentArbitrary,
        (beforeContent, thinkContent, afterContent) => {
          // Skip if think content is only whitespace
          if (thinkContent.trim().length === 0) {
            return true;
          }
          
          const text = `${beforeContent}<think>${thinkContent}</think>${afterContent}`;
          
          const result = parser.parse(text);

          // Property: Thinking content should be extracted
          expect(result.reasoning).not.toBeNull();
          expect(result.reasoning?.content.trim()).toBe(thinkContent.trim());
          
          // Property: Response should contain before and after content
          const expectedResponse = `${beforeContent}${afterContent}`.trim();
          expect(result.response.trim()).toBe(expectedResponse);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple think blocks by concatenating them', () => {
    fc.assert(
      fc.property(
        textContentArbitrary,
        textContentArbitrary,
        textContentArbitrary,
        (thinkContent1, thinkContent2, responseContent) => {
          const text = `<think>${thinkContent1}</think>${responseContent}<think>${thinkContent2}</think>`;
          
          const result = parser.parse(text);

          // Property: Both thinking contents should be extracted
          expect(result.reasoning).not.toBeNull();
          const extractedThinking = result.reasoning?.content || '';
          expect(extractedThinking).toContain(thinkContent1.trim());
          expect(extractedThinking).toContain(thinkContent2.trim());
          
          // Property: Response should not contain think tags
          expect(result.response).not.toContain('<think>');
          expect(result.response).not.toContain('</think>');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return null reasoning when no think blocks present', () => {
    fc.assert(
      fc.property(textContentArbitrary, (content) => {
        // Ensure content doesn't accidentally contain think tags
        const text = content.replace(/<think>/g, '').replace(/<\/think>/g, '');
        
        const result = parser.parse(text);

        // Property: No reasoning should be extracted
        expect(result.reasoning).toBeNull();
        
        // Property: Response should be the original text
        expect(result.response).toBe(text);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should mark reasoning as complete when think block is closed', () => {
    fc.assert(
      fc.property(textContentArbitrary, (thinkContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        const text = `<think>${thinkContent}</think>`;
        
        const result = parser.parse(text);

        // Property: Complete think blocks should be marked as complete
        expect(result.reasoning).not.toBeNull();
        expect(result.reasoning?.complete).toBe(true);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should estimate token count for thinking content', () => {
    fc.assert(
      fc.property(textContentArbitrary, (thinkContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        const text = `<think>${thinkContent}</think>`;
        
        const result = parser.parse(text);

        // Property: Token count should be estimated (roughly 1 token per 4 characters)
        expect(result.reasoning).not.toBeNull();
        const estimatedTokens = result.reasoning?.tokenCount || 0;
        const expectedTokens = Math.ceil(thinkContent.trim().length / 4);
        
        expect(estimatedTokens).toBeGreaterThan(0);
        expect(estimatedTokens).toBeCloseTo(expectedTokens, 1);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle nested think blocks correctly', () => {
    fc.assert(
      fc.property(
        textContentArbitrary,
        textContentArbitrary,
        textContentArbitrary,
        (outerContent, innerContent, responseContent) => {
          const text = `${responseContent}<think>${outerContent}<think>${innerContent}</think>${outerContent}</think>`;
          
          const result = parser.parseNested(text);

          // Property: All thinking content should be extracted
          expect(result.reasoning).not.toBeNull();
          const extractedThinking = result.reasoning?.content || '';
          expect(extractedThinking).toContain(outerContent.trim());
          expect(extractedThinking).toContain(innerContent.trim());
          
          // Property: Response should not contain think tags
          expect(result.response).not.toContain('<think>');
          expect(result.response).not.toContain('</think>');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle malformed blocks with missing closing tag', () => {
    fc.assert(
      fc.property(textContentArbitrary, textContentArbitrary, (thinkContent, responseContent) => {
        const text = `${responseContent}<think>${thinkContent}`;
        
        const result = parser.parseMalformed(text);

        // Property: Should extract thinking content even without closing tag
        expect(result.reasoning).not.toBeNull();
        expect(result.reasoning?.content.trim()).toBe(thinkContent.trim());
        
        // Property: Should mark as incomplete
        expect(result.reasoning?.complete).toBe(false);
        
        // Property: Response should be the content before think tag
        expect(result.response.trim()).toBe(responseContent.trim());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle malformed blocks with missing opening tag', () => {
    fc.assert(
      fc.property(textContentArbitrary, textContentArbitrary, (thinkContent, responseContent) => {
        const text = `${thinkContent}</think>${responseContent}`;
        
        const result = parser.parseMalformed(text);

        // Property: Should extract thinking content even without opening tag
        expect(result.reasoning).not.toBeNull();
        expect(result.reasoning?.content.trim()).toBe(thinkContent.trim());
        
        // Property: Should mark as complete (has closing tag)
        expect(result.reasoning?.complete).toBe(true);
        
        // Property: Response should be the content after closing tag
        expect(result.response.trim()).toBe(responseContent.trim());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle streaming parsing with complete chunks', () => {
    fc.assert(
      fc.property(textContentArbitrary, textContentArbitrary, (thinkContent, responseContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        const text = `${responseContent}<think>${thinkContent}</think>`;
        
        // Simulate streaming by splitting into chunks
        const chunkSize = Math.max(1, Math.floor(text.length / 5));
        let state = parser.createInitialState();
        
        for (let i = 0; i < text.length; i += chunkSize) {
          const chunk = text.slice(i, i + chunkSize);
          state = parser.parseStreaming(chunk, state);
        }
        
        const result = parser.extractResult(state);

        // Property: Final result should match non-streaming parse
        const directResult = parser.parse(text);
        expect(result.reasoning?.content.trim()).toBe(directResult.reasoning?.content.trim());
        expect(result.response.trim()).toBe(directResult.response.trim());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain state correctly during streaming', () => {
    fc.assert(
      fc.property(textContentArbitrary, (thinkContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        const text = `<think>${thinkContent}</think>`;
        
        let state = parser.createInitialState();
        
        // Stream one character at a time
        for (const char of text) {
          state = parser.parseStreaming(char, state);
        }

        // Property: State should reflect complete think block
        expect(state.thinkContent.trim()).toBe(thinkContent.trim());
        expect(state.inThinkBlock).toBe(false);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle empty think blocks', () => {
    fc.assert(
      fc.property(textContentArbitrary, (responseContent) => {
        const text = `${responseContent}<think></think>`;
        
        const result = parser.parse(text);

        // Property: Empty think blocks should return null reasoning
        expect(result.reasoning).toBeNull();
        
        // Property: Response should be the original content
        expect(result.response.trim()).toBe(responseContent.trim());

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle think blocks with special characters', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.oneof(fc.char(), fc.constantFrom('<', '>', '&', '"', "'", '\n', '\t')), {
          minLength: 1,
          maxLength: 200,
        }),
        (thinkContent) => {
          // Ensure we don't accidentally create nested tags
          const safeThinkContent = thinkContent
            .replace(/<think>/g, '')
            .replace(/<\/think>/g, '');
          
          // Skip if content is only whitespace
          if (safeThinkContent.trim().length === 0) {
            return true;
          }
          
          const text = `<think>${safeThinkContent}</think>`;
          
          const result = parser.parse(text);

          // Property: Should extract thinking content with special characters
          expect(result.reasoning).not.toBeNull();
          expect(result.reasoning?.content.trim()).toBe(safeThinkContent.trim());

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should separate thinking from response in all cases', () => {
    fc.assert(
      fc.property(textContentArbitrary, textContentArbitrary, (thinkContent, responseContent) => {
        // Skip if think content is only whitespace
        if (thinkContent.trim().length === 0) {
          return true;
        }
        
        // Skip if response content is only whitespace
        if (responseContent.trim().length === 0) {
          return true;
        }
        
        // Skip cases where content naturally overlaps (one is substring of the other)
        const trimmedThink = thinkContent.trim();
        const trimmedResponse = responseContent.trim();
        if (trimmedThink.includes(trimmedResponse) || trimmedResponse.includes(trimmedThink)) {
          return true;
        }
        
        const text = `${responseContent}<think>${thinkContent}</think>`;
        
        const result = parser.parse(text);

        // Property: Thinking and response should be completely separated
        if (result.reasoning) {
          // Thinking should not contain response content
          expect(result.reasoning.content).not.toContain(trimmedResponse);
          
          // Response should not contain thinking content
          expect(result.response).not.toContain(trimmedThink);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
