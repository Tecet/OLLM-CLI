/**
 * Example property-based tests to verify test infrastructure
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  arbHook,
  arbHookEvent,
  arbHookInput,
  arbHookOutput,
  arbHookSource,
} from './test-helpers.js';

describe('Property-Based Test Infrastructure', () => {
  it('should generate valid hooks', () => {
    fc.assert(
      fc.property(arbHook(), (hook) => {
        // All generated hooks should have required fields
        expect(hook.id).toBeTruthy();
        expect(hook.name).toBeTruthy();
        expect(hook.command).toBeTruthy();
        expect(['builtin', 'user', 'workspace', 'downloaded']).toContain(hook.source);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid hook events', () => {
    fc.assert(
      fc.property(arbHookEvent(), (event) => {
        // All generated events should be valid
        const validEvents = [
          'session_start',
          'session_end',
          'before_agent',
          'after_agent',
          'before_model',
          'after_model',
          'before_tool_selection',
          'before_tool',
          'after_tool',
        ];
        expect(validEvents).toContain(event);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid hook sources', () => {
    fc.assert(
      fc.property(arbHookSource(), (source) => {
        // All generated sources should be valid
        expect(['builtin', 'user', 'workspace', 'downloaded']).toContain(source);
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid hook inputs', () => {
    fc.assert(
      fc.property(arbHookInput(), (input) => {
        // All generated inputs should have required fields
        expect(input.event).toBeTruthy();
        expect(input.data).toBeDefined();
        expect(typeof input.data).toBe('object');
      }),
      { numRuns: 100 }
    );
  });

  it('should generate valid hook outputs', () => {
    fc.assert(
      fc.property(arbHookOutput(), (output) => {
        // All generated outputs should have continue field
        expect(typeof output.continue).toBe('boolean');
      }),
      { numRuns: 100 }
    );
  });
});
