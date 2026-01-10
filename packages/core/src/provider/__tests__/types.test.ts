/**
 * Property-based tests for provider types.
 * These tests validate the correctness properties defined in the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Message, Role, MessagePart } from '../types.js';

/**
 * Arbitraries (generators) for property-based testing
 */

// Generate valid Role values
const roleArbitrary = fc.constantFrom<Role>(
  'system',
  'user',
  'assistant',
  'tool'
);

// Generate valid MessagePart values
const messagePartArbitrary = fc.oneof(
  // Text part
  fc.record({
    type: fc.constant('text' as const),
    text: fc.string(),
  }),
  // Image part
  fc.record({
    type: fc.constant('image' as const),
    data: fc.string(),
    mimeType: fc.string(),
  })
);

// Generate valid Message values
const messageArbitrary = fc.record({
  role: roleArbitrary,
  parts: fc.array(messagePartArbitrary, { minLength: 1 }),
  name: fc.option(fc.string(), { nil: undefined }),
});

// Generate tool messages (role='tool' with name field)
const toolMessageArbitrary = fc.record({
  role: fc.constant('tool' as const),
  parts: fc.array(messagePartArbitrary, { minLength: 1 }),
  name: fc.string({ minLength: 1 }),
});

describe('Provider Types - Property-Based Tests', () => {
  describe('Property 30: Message Structure Validity', () => {
    it('should have a valid role field', () => {
      // Feature: stage-02-core-provider, Property 30: Message Structure Validity
      // Validates: Requirements 9.1, 9.2
      fc.assert(
        fc.property(messageArbitrary, (message: Message) => {
          // Every message should have a role field
          expect(message.role).toBeDefined();

          // Role should be one of the valid values
          const validRoles: Role[] = ['system', 'user', 'assistant', 'tool'];
          expect(validRoles).toContain(message.role);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should have a parts array with at least one part', () => {
      // Feature: stage-02-core-provider, Property 30: Message Structure Validity
      // Validates: Requirements 9.1, 9.2
      fc.assert(
        fc.property(messageArbitrary, (message: Message) => {
          // Every message should have a parts array
          expect(message.parts).toBeDefined();
          expect(Array.isArray(message.parts)).toBe(true);

          // Parts array should contain at least one part
          expect(message.parts.length).toBeGreaterThan(0);

          // Each part should have a valid type
          for (const part of message.parts) {
            expect(['text', 'image']).toContain(part.type);

            if (part.type === 'text') {
              expect(part).toHaveProperty('text');
              expect(typeof part.text).toBe('string');
            } else if (part.type === 'image') {
              expect(part).toHaveProperty('data');
              expect(part).toHaveProperty('mimeType');
              expect(typeof part.data).toBe('string');
              expect(typeof part.mimeType).toBe('string');
            }
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 31: Tool Message Name Field', () => {
    it('should include a name field for tool messages', () => {
      // Feature: stage-02-core-provider, Property 31: Tool Message Name Field
      // Validates: Requirements 9.3
      fc.assert(
        fc.property(toolMessageArbitrary, (message: Message) => {
          // Tool messages must have role='tool'
          expect(message.role).toBe('tool');

          // Tool messages must include a name field
          expect(message.name).toBeDefined();
          expect(typeof message.name).toBe('string');
          expect(message.name!.length).toBeGreaterThan(0);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should identify the tool that produced the result', () => {
      // Feature: stage-02-core-provider, Property 31: Tool Message Name Field
      // Validates: Requirements 9.3
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.array(messagePartArbitrary, { minLength: 1 }),
          (toolName: string, parts: MessagePart[]) => {
            const toolMessage: Message = {
              role: 'tool',
              parts,
              name: toolName,
            };

            // The name field should identify the tool
            expect(toolMessage.name).toBe(toolName);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
