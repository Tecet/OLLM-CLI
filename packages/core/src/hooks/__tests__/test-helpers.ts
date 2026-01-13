/**
 * Test helpers and generators for property-based testing
 */

import fc from 'fast-check';
import type { Hook, HookEvent, HookInput, HookOutput, HookSource } from '../types.js';

/**
 * Arbitrary generator for HookEvent
 */
export const arbHookEvent = (): fc.Arbitrary<HookEvent> =>
  fc.constantFrom<HookEvent>(
    'session_start',
    'session_end',
    'before_agent',
    'after_agent',
    'before_model',
    'after_model',
    'before_tool_selection',
    'before_tool',
    'after_tool'
  );

/**
 * Arbitrary generator for HookSource
 */
export const arbHookSource = (): fc.Arbitrary<HookSource> =>
  fc.constantFrom<HookSource>('builtin', 'user', 'workspace', 'downloaded');

/**
 * Arbitrary generator for Hook
 */
export const arbHook = (): fc.Arbitrary<Hook> =>
  fc.record({
    id: fc.string({ minLength: 1 }),
    name: fc.string({ minLength: 1 }),
    command: fc.string({ minLength: 1 }),
    args: fc.option(fc.array(fc.string())),
    source: arbHookSource(),
    extensionName: fc.option(fc.string({ minLength: 1 })),
  });

/**
 * Arbitrary generator for HookInput
 */
export const arbHookInput = (): fc.Arbitrary<HookInput> =>
  fc.record({
    event: fc.string({ minLength: 1 }),
    data: fc.dictionary(fc.string(), fc.anything()),
  });

/**
 * Arbitrary generator for HookOutput
 */
export const arbHookOutput = (): fc.Arbitrary<HookOutput> =>
  fc.record({
    continue: fc.boolean(),
    systemMessage: fc.option(fc.string()),
    data: fc.option(fc.dictionary(fc.string(), fc.anything())),
    error: fc.option(fc.string()),
  });

/**
 * Create a hook with specific properties for testing
 */
export function createTestHook(overrides: Partial<Hook> = {}): Hook {
  return {
    id: 'test-hook-' + Math.random().toString(36).substring(7),
    name: 'Test Hook',
    command: 'node',
    args: ['test.js'],
    source: 'user',
    ...overrides,
  };
}

/**
 * Create hook input for testing
 */
export function createTestHookInput(
  event: string = 'before_model',
  data: Record<string, unknown> = {}
): HookInput {
  return {
    event,
    data: {
      sessionId: 'test-session',
      ...data,
    },
  };
}

/**
 * Create hook output for testing
 */
export function createTestHookOutput(overrides: Partial<HookOutput> = {}): HookOutput {
  return {
    continue: true,
    ...overrides,
  };
}
