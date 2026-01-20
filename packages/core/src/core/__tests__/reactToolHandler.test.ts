/**
 * Property-based tests for ReAct Tool Handler.
 * These tests validate the correctness properties defined in the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ReActToolHandler } from '../reactToolHandler.js';
import type { ToolSchema } from '../../provider/types.js';

/**
 * Arbitraries (generators) for property-based testing
 */

// Generate a tool schema
const toolSchemaArbitrary = fc.record({
  name: fc.string({ minLength: 1 }),
  description: fc.option(fc.string(), { nil: undefined }),
  parameters: fc.option(
    fc.dictionary(fc.string(), fc.anything()),
    { nil: undefined }
  ),
}) as fc.Arbitrary<ToolSchema>;

// Generate a valid JSON object
const jsonObjectArbitrary = fc.dictionary(
  fc.string({ minLength: 1 }),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.array(fc.string())
  )
);

describe('ReAct Tool Handler - Property-Based Tests', () => {
  describe('Property 17: ReAct Instruction Formatting', () => {
    it('should format tool schemas as text instructions with all tool information', () => {
      // Feature: stage-02-core-provider, Property 17: ReAct Instruction Formatting
      // Validates: Requirements 6.1
      fc.assert(
        fc.property(
          fc.array(toolSchemaArbitrary, { minLength: 1, maxLength: 5 }),
          (tools: ToolSchema[]) => {
            const instructions = ReActToolHandler.formatToolsAsInstructions(tools);

            // Should be a non-empty string
            expect(instructions).toBeTruthy();
            expect(typeof instructions).toBe('string');

            // Should contain all tool names
            for (const tool of tools) {
              expect(instructions).toContain(tool.name);
            }

            // Should contain the ReAct format instructions
            expect(instructions).toContain('Thought:');
            expect(instructions).toContain('Action:');
            expect(instructions).toContain('Action Input:');
            expect(instructions).toContain('Observation:');
            expect(instructions).toContain('Final Answer:');

            // Should contain parameter information
            expect(instructions).toContain('Parameters:');

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include tool descriptions when provided', () => {
      // Feature: stage-02-core-provider, Property 17: ReAct Instruction Formatting
      // Validates: Requirements 6.1
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1 }),
              description: fc.string({ minLength: 1 }),
              parameters: fc.option(fc.dictionary(fc.string(), fc.anything()), {
                nil: undefined,
              }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (tools: ToolSchema[]) => {
            const instructions = ReActToolHandler.formatToolsAsInstructions(tools);

            // Should contain all tool descriptions
            for (const tool of tools) {
              if (tool.description) {
                expect(instructions).toContain(tool.description);
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 18: ReAct Output Parsing', () => {
    it('should correctly extract Thought, Action, Action Input, and Final Answer fields', () => {
      // Feature: stage-02-core-provider, Property 18: ReAct Output Parsing
      // Validates: Requirements 6.2
      fc.assert(
        fc.property(
          // Filter out whitespace-only strings since they get normalized to undefined
          fc.record({
            thought: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
            action: fc.option(
              fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
              { nil: undefined }
            ),
            actionInput: fc.option(jsonObjectArbitrary, { nil: undefined }),
            finalAnswer: fc.option(
              fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
              { nil: undefined }
            ),
          }),
          (reactData) => {
            // Build a ReAct-formatted string
            let output = `Thought: ${reactData.thought}\n`;

            if (reactData.action) {
              output += `Action: ${reactData.action}\n`;
            }

            if (reactData.actionInput) {
              output += `Action Input: ${JSON.stringify(reactData.actionInput)}\n`;
            }

            if (reactData.finalAnswer) {
              output += `Final Answer: ${reactData.finalAnswer}`;
            }

            // Parse the output
            const parsed = ReActToolHandler.parseReActOutput(output);

            // Should extract the thought (trimmed)
            expect(parsed.thought).toBe(reactData.thought.trim());

            // Should extract action if present (trimmed)
            if (reactData.action) {
              expect(parsed.action).toBe(reactData.action.trim());
            }

            // Should extract action input if present
            if (reactData.actionInput) {
              expect(parsed.actionInput).toEqual(reactData.actionInput);
            }

            // Should extract final answer if present (trimmed)
            if (reactData.finalAnswer) {
              expect(parsed.finalAnswer).toBe(reactData.finalAnswer.trim());
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty object for non-ReAct formatted strings', () => {
      // Feature: stage-02-core-provider, Property 18: ReAct Output Parsing
      // Validates: Requirements 6.2
      fc.assert(
        fc.property(
          fc.string().filter((s) => !s.includes('Thought:')),
          (randomString: string) => {
            const parsed = ReActToolHandler.parseReActOutput(randomString);

            // Should return an empty object or object with undefined fields
            expect(
              !parsed.thought &&
                !parsed.action &&
                !parsed.actionInput &&
                !parsed.finalAnswer
            ).toBe(true);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 19: ReAct JSON Validation', () => {
    it('should validate valid JSON objects as action input', () => {
      // Feature: stage-02-core-provider, Property 19: ReAct JSON Validation
      // Validates: Requirements 6.3, 6.4
      fc.assert(
        fc.property(jsonObjectArbitrary, (jsonObj) => {
          const isValid = ReActToolHandler.validateActionInput(jsonObj);

          // Should return true for valid JSON objects
          expect(isValid).toBe(true);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject non-object values as action input', () => {
      // Feature: stage-02-core-provider, Property 19: ReAct JSON Validation
      // Validates: Requirements 6.3, 6.4
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.constant(undefined),
            fc.array(fc.anything())
          ),
          (nonObject) => {
            const isValid = ReActToolHandler.validateActionInput(nonObject);

            // Should return false for non-objects
            expect(isValid).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle invalid JSON in Action Input gracefully', () => {
      // Feature: stage-02-core-provider, Property 19: ReAct JSON Validation
      // Validates: Requirements 6.3, 6.4
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false; // Skip valid JSON
            } catch {
              return true; // Keep invalid JSON
            }
          }),
          (thought: string, invalidJson: string) => {
            const output = `Thought: ${thought}\nAction: test\nAction Input: ${invalidJson}\n`;

            const parsed = ReActToolHandler.parseReActOutput(output);

            // Should parse thought and action (trimmed)
            expect(parsed.thought).toBe(thought.trim());
            expect(parsed.action).toBe('test');

            // Action input should be undefined due to invalid JSON
            expect(parsed.actionInput).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 20: ReAct Observation Formatting', () => {
    it('should format tool results as Observation with JSON serialization', () => {
      // Feature: stage-02-core-provider, Property 20: ReAct Observation Formatting
      // Validates: Requirements 6.5
      fc.assert(
        fc.property(
          // Filter out undefined values since JSON.stringify converts them to null
          fc.anything().filter((val) => {
            // Recursively check for undefined in arrays
            const hasUndefined = (obj: any): boolean => {
              if (obj === undefined) return true;
              if (Array.isArray(obj)) return obj.some(hasUndefined);
              if (obj && typeof obj === 'object') {
                return Object.values(obj).some(hasUndefined);
              }
              return false;
            };
            return !hasUndefined(val);
          }),
          (result) => {
            const observation = ReActToolHandler.formatObservation(result);

            // Should start with "Observation: "
            expect(observation).toMatch(/^Observation: /);

            // Should contain JSON serialization of the result
            const jsonPart = observation.replace(/^Observation: /, '');
            const parsed = JSON.parse(jsonPart);
            
            // Compare via JSON serialization to handle -0/+0 edge case
            // JSON doesn't preserve the sign of zero, so -0 becomes 0
            expect(JSON.stringify(parsed)).toEqual(JSON.stringify(result));

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various result types in observation formatting', () => {
      // Feature: stage-02-core-provider, Property 20: ReAct Observation Formatting
      // Validates: Requirements 6.5
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            jsonObjectArbitrary,
            fc.array(fc.string())
          ),
          (result) => {
            const observation = ReActToolHandler.formatObservation(result);

            // Should be a valid observation format
            expect(observation).toContain('Observation:');

            // Should be parseable back to the original result
            const jsonPart = observation.replace(/^Observation: /, '');
            const parsed = JSON.parse(jsonPart);
            expect(parsed).toEqual(result);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 21: ReAct Turn Completion', () => {
    it('should detect Final Answer in ReAct output', () => {
      // Feature: stage-02-core-provider, Property 21: ReAct Turn Completion
      // Validates: Requirements 6.6
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (thought: string, finalAnswer: string) => {
            const output = `Thought: ${thought}\nFinal Answer: ${finalAnswer}`;

            const parsed = ReActToolHandler.parseReActOutput(output);

            // Should extract the final answer (trimmed)
            expect(parsed.finalAnswer).toBe(finalAnswer.trim());

            // When final answer is present, it indicates turn completion
            expect(parsed.finalAnswer).toBeTruthy();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should distinguish between tool calls and final answers', () => {
      // Feature: stage-02-core-provider, Property 21: ReAct Turn Completion
      // Validates: Requirements 6.6
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          jsonObjectArbitrary,
          (thought: string, action: string, actionInput) => {
            // Output with tool call (no final answer)
            const toolCallOutput = `Thought: ${thought}\nAction: ${action}\nAction Input: ${JSON.stringify(actionInput)}\n`;

            const toolCallParsed = ReActToolHandler.parseReActOutput(toolCallOutput);

            // Should have action but no final answer (trimmed)
            expect(toolCallParsed.action).toBe(action.trim());
            expect(toolCallParsed.finalAnswer).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle output with both action and final answer', () => {
      // Feature: stage-02-core-provider, Property 21: ReAct Turn Completion
      // Validates: Requirements 6.6
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          (thought: string, action: string, finalAnswer: string) => {
            const output = `Thought: ${thought}\nAction: ${action}\nFinal Answer: ${finalAnswer}`;

            const parsed = ReActToolHandler.parseReActOutput(output);

            // Should extract both action and final answer (trimmed)
            expect(parsed.thought).toBe(thought.trim());
            expect(parsed.action).toBe(action.trim());
            expect(parsed.finalAnswer).toBe(finalAnswer.trim());

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 33: ReAct JSON Error Recovery', () => {
    it('should detect invalid JSON and flag it for correction', () => {
      // Feature: stage-02-core-provider, Property 33: ReAct JSON Error Recovery
      // Validates: Requirements 10.3
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false; // Skip valid JSON
            } catch {
              return true; // Keep invalid JSON
            }
          }),
          (thought: string, action: string, invalidJson: string) => {
            const output = `Thought: ${thought}\nAction: ${action}\nAction Input: ${invalidJson}\n`;

            const parsed = ReActToolHandler.parseReActOutput(output);

            // Should parse thought and action
            expect(parsed.thought).toBe(thought.trim());
            expect(parsed.action).toBe(action.trim());

            // Should flag invalid JSON
            expect(parsed.hasInvalidJson).toBe(true);
            expect(parsed.actionInput).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create correction message for invalid JSON', () => {
      // Feature: stage-02-core-provider, Property 33: ReAct JSON Error Recovery
      // Validates: Requirements 10.3
      fc.assert(
        fc.property(
          fc.string().filter((s) => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          (invalidJson: string) => {
            const correctionMessage = ReActToolHandler.createJsonCorrectionMessage(invalidJson);

            // Should be a user message
            expect(correctionMessage.role).toBe('user');

            // Should contain the invalid input
            expect(correctionMessage.parts[0].type).toBe('text');
            if (correctionMessage.parts[0].type === 'text') {
              expect(correctionMessage.parts[0].text).toContain(invalidJson);
              expect(correctionMessage.parts[0].text).toContain('Error');
              expect(correctionMessage.parts[0].text).toContain('valid JSON');
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not flag valid JSON as invalid', () => {
      // Feature: stage-02-core-provider, Property 33: ReAct JSON Error Recovery
      // Validates: Requirements 10.3
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          jsonObjectArbitrary,
          (thought: string, action: string, validJson) => {
            const output = `Thought: ${thought}\nAction: ${action}\nAction Input: ${JSON.stringify(validJson)}\n`;

            const parsed = ReActToolHandler.parseReActOutput(output);

            // Should parse successfully
            expect(parsed.thought).toBe(thought.trim());
            expect(parsed.action).toBe(action.trim());
            expect(parsed.actionInput).toEqual(validJson);

            // Should NOT flag as invalid
            expect(parsed.hasInvalidJson).toBe(false);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


/**
 * Unit tests for ReAct Tool Handler edge cases.
 * These tests validate specific examples and error conditions.
 */

describe('ReAct Tool Handler - Unit Tests (Edge Cases)', () => {
  describe('Parsing with missing fields', () => {
    it('should handle output with only Thought', () => {
      const output = 'Thought: I need to think about this\n';
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('I need to think about this');
      expect(parsed.action).toBeUndefined();
      expect(parsed.actionInput).toBeUndefined();
      expect(parsed.finalAnswer).toBeUndefined();
    });

    it('should handle output with Thought and Action but no Action Input', () => {
      const output = 'Thought: I will use a tool\nAction: search\n';
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('I will use a tool');
      expect(parsed.action).toBe('search');
      expect(parsed.actionInput).toBeUndefined();
      expect(parsed.finalAnswer).toBeUndefined();
    });

    it('should handle output with only Final Answer', () => {
      const output = 'Final Answer: Here is the result';
      const parsed = ReActToolHandler.parseReActOutput(output);

      // Without Thought, the pattern may not match
      // This tests the actual behavior of the regex
      expect(parsed.finalAnswer).toBeUndefined();
    });

    it('should handle completely empty output', () => {
      const output = '';
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBeUndefined();
      expect(parsed.action).toBeUndefined();
      expect(parsed.actionInput).toBeUndefined();
      expect(parsed.finalAnswer).toBeUndefined();
    });

    it('should handle output with no ReAct markers', () => {
      const output = 'This is just regular text without any ReAct formatting';
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBeUndefined();
      expect(parsed.action).toBeUndefined();
      expect(parsed.actionInput).toBeUndefined();
      expect(parsed.finalAnswer).toBeUndefined();
    });
  });

  describe('Parsing with malformed JSON', () => {
    it('should handle Action Input with invalid JSON syntax', () => {
      const output = `Thought: I will search
Action: search
Action Input: {query: "test", invalid json}
`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('I will search');
      expect(parsed.action).toBe('search');
      expect(parsed.actionInput).toBeUndefined(); // Invalid JSON should result in undefined
    });

    it('should handle Action Input with missing quotes', () => {
      const output = `Thought: Testing
Action: test
Action Input: {key: value}
`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Testing');
      expect(parsed.action).toBe('test');
      expect(parsed.actionInput).toBeUndefined();
    });

    it('should handle Action Input with trailing comma', () => {
      const output = `Thought: Testing
Action: test
Action Input: {"key": "value",}
`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Testing');
      expect(parsed.action).toBe('test');
      expect(parsed.actionInput).toBeUndefined();
    });

    it('should handle Action Input with single quotes instead of double quotes', () => {
      const output = `Thought: Testing
Action: test
Action Input: {'key': 'value'}
`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Testing');
      expect(parsed.action).toBe('test');
      expect(parsed.actionInput).toBeUndefined();
    });

    it('should handle Action Input that is not an object', () => {
      const output = `Thought: Testing
Action: test
Action Input: "just a string"
`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Testing');
      expect(parsed.action).toBe('test');
      // The JSON is valid but it's a string, not an object
      expect(parsed.actionInput).toBe('just a string');
    });

    it('should handle Action Input that is an array', () => {
      const output = `Thought: Testing
Action: test
Action Input: ["item1", "item2"]
`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Testing');
      expect(parsed.action).toBe('test');
      // The JSON is valid but it's an array, not an object
      expect(parsed.actionInput).toEqual(['item1', 'item2']);
    });
  });

  describe('Final Answer detection', () => {
    it('should detect Final Answer at the end of output', () => {
      const output = `Thought: I have the answer
Final Answer: The result is 42`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('I have the answer');
      expect(parsed.finalAnswer).toBe('The result is 42');
    });

    it('should detect Final Answer with multiline content', () => {
      const output = `Thought: Concluding
Final Answer: The answer is:
Line 1
Line 2`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Concluding');
      expect(parsed.finalAnswer).toContain('The answer is:');
    });

    it('should handle Final Answer with special characters', () => {
      const output = `Thought: Done
Final Answer: Result: $100.50 (50% off!)`;
      const parsed = ReActToolHandler.parseReActOutput(output);

      expect(parsed.thought).toBe('Done');
      expect(parsed.finalAnswer).toBe('Result: $100.50 (50% off!)');
    });

    it('should distinguish between Action and Final Answer', () => {
      const outputWithAction = `Thought: Need to search
Action: search
Action Input: {"query": "test"}
`;
      const parsedAction = ReActToolHandler.parseReActOutput(outputWithAction);

      expect(parsedAction.action).toBe('search');
      expect(parsedAction.finalAnswer).toBeUndefined();

      const outputWithFinal = `Thought: I have the answer
Final Answer: Here it is`;
      const parsedFinal = ReActToolHandler.parseReActOutput(outputWithFinal);

      expect(parsedFinal.action).toBeUndefined();
      expect(parsedFinal.finalAnswer).toBe('Here it is');
    });
  });

  describe('Observation formatting', () => {
    it('should format simple string results', () => {
      const observation = ReActToolHandler.formatObservation('result');
      expect(observation).toBe('Observation: "result"');
    });

    it('should format object results', () => {
      const observation = ReActToolHandler.formatObservation({ key: 'value' });
      expect(observation).toBe('Observation: {"key":"value"}');
    });

    it('should format null results', () => {
      const observation = ReActToolHandler.formatObservation(null);
      expect(observation).toBe('Observation: null');
    });

    it('should format error results', () => {
      const observation = ReActToolHandler.formatObservation({
        error: 'Something went wrong',
      });
      expect(observation).toBe('Observation: {"error":"Something went wrong"}');
    });
  });

  describe('Action Input validation', () => {
    it('should validate plain objects', () => {
      expect(ReActToolHandler.validateActionInput({ key: 'value' })).toBe(true);
      expect(ReActToolHandler.validateActionInput({})).toBe(true);
    });

    it('should reject null', () => {
      expect(ReActToolHandler.validateActionInput(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(ReActToolHandler.validateActionInput(undefined)).toBe(false);
    });

    it('should reject arrays', () => {
      expect(ReActToolHandler.validateActionInput([])).toBe(false);
      expect(ReActToolHandler.validateActionInput(['item'])).toBe(false);
    });

    it('should reject primitives', () => {
      expect(ReActToolHandler.validateActionInput('string')).toBe(false);
      expect(ReActToolHandler.validateActionInput(123)).toBe(false);
      expect(ReActToolHandler.validateActionInput(true)).toBe(false);
    });
  });

  describe('Tool instruction formatting', () => {
    it('should format single tool', () => {
      const tools: ToolSchema[] = [
        {
          name: 'search',
          description: 'Search for information',
          parameters: { query: { type: 'string' } },
        },
      ];

      const instructions = ReActToolHandler.formatToolsAsInstructions(tools);

      expect(instructions).toContain('search');
      expect(instructions).toContain('Search for information');
      expect(instructions).toContain('Thought:');
      expect(instructions).toContain('Action:');
      expect(instructions).toContain('Action Input:');
      expect(instructions).toContain('Observation:');
      expect(instructions).toContain('Final Answer:');
    });

    it('should format multiple tools', () => {
      const tools: ToolSchema[] = [
        { name: 'search', description: 'Search' },
        { name: 'calculate', description: 'Calculate' },
        { name: 'read', description: 'Read file' },
      ];

      const instructions = ReActToolHandler.formatToolsAsInstructions(tools);

      expect(instructions).toContain('search');
      expect(instructions).toContain('calculate');
      expect(instructions).toContain('read');
    });

    it('should handle tools without descriptions', () => {
      const tools: ToolSchema[] = [{ name: 'test' }];

      const instructions = ReActToolHandler.formatToolsAsInstructions(tools);

      expect(instructions).toContain('test');
      expect(instructions).toContain('No description');
    });

    it('should handle tools without parameters', () => {
      const tools: ToolSchema[] = [{ name: 'test', description: 'Test tool' }];

      const instructions = ReActToolHandler.formatToolsAsInstructions(tools);

      expect(instructions).toContain('test');
      expect(instructions).toContain('Test tool');
    });
  });
});
