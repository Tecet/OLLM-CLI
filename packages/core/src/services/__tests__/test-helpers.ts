/**
 * Test helpers and utilities for service tests
 */

import * as fc from 'fast-check';

import type {
  SessionMessage,
  SessionToolCall,
  Session,
  ContextEntry,
  MessagePart,
} from '../types.js';

/**
 * Arbitrary for message parts
 */
export const messagePart = (): fc.Arbitrary<MessagePart> =>
  fc.record({
    type: fc.constant('text' as const),
    text: fc.string({ minLength: 1, maxLength: 1000 }),
  });

/**
 * Arbitrary for session messages
 */
export const sessionMessage = (): fc.Arbitrary<SessionMessage> =>
  fc.record({
    role: fc.constantFrom('user' as const, 'assistant' as const, 'system' as const),
    parts: fc.array(messagePart(), { minLength: 1, maxLength: 5 }),
    timestamp: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
      .map((d) => d.toISOString()),
  });

/**
 * Arbitrary for tool call results
 */
export const toolCallResult = () =>
  fc.record({
    llmContent: fc.string({ minLength: 1, maxLength: 500 }),
    returnDisplay: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
  });

/**
 * Arbitrary for session tool calls
 */
export const sessionToolCall = (): fc.Arbitrary<SessionToolCall> =>
  fc.record({
    id: fc.uuid(),
    name: fc.constantFrom('read_file', 'write_file', 'shell', 'grep', 'glob'),
    args: fc.dictionary(
      fc.string({ minLength: 1 }),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.array(fc.string()))
    ),
    result: toolCallResult(),
    timestamp: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
      .map((d) => d.toISOString()),
  });

/**
 * Arbitrary for session metadata
 */
export const sessionMetadata = () =>
  fc.record({
    tokenCount: fc.integer({ min: 0, max: 100000 }),
    compressionCount: fc.integer({ min: 0, max: 10 }),
  });

/**
 * Arbitrary for complete sessions
 */
export const session = (): fc.Arbitrary<Session> =>
  fc.record({
    sessionId: fc.uuid(),
    startTime: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
      .map((d) => d.toISOString()),
    lastActivity: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
      .map((d) => d.toISOString()),
    model: fc.constantFrom('llama3.1:8b', 'mistral:7b', 'codellama:13b', 'qwen2.5:7b'),
    provider: fc.constantFrom('ollama', 'openai', 'anthropic'),
    messages: fc.array(sessionMessage(), { minLength: 1, maxLength: 100 }),
    toolCalls: fc.array(sessionToolCall(), { maxLength: 50 }),
    metadata: sessionMetadata(),
  });

/**
 * Arbitrary for context entries
 */
export const contextEntry = (): fc.Arbitrary<ContextEntry> =>
  fc.record({
    key: fc.string({ minLength: 1, maxLength: 50 }),
    content: fc.string({ minLength: 1, maxLength: 5000 }),
    priority: fc.integer({ min: 0, max: 100 }),
    source: fc.constantFrom(
      'hook' as const,
      'extension' as const,
      'user' as const,
      'system' as const
    ),
    timestamp: fc
      .date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') })
      .map((d) => d.toISOString()),
  });

/**
 * Arbitrary for environment variables
 */
export const environmentVariables = () =>
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[A-Z_][A-Z0-9_]*$/.test(s)),
    fc.string({ maxLength: 200 })
  );

/**
 * Arbitrary for sensitive environment variable names
 */
export const sensitiveEnvVarName = () =>
  fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => `${s}_KEY`),
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => `${s}_SECRET`),
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => `${s}_TOKEN`),
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => `${s}_PASSWORD`),
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => `AWS_${s}`),
    fc.string({ minLength: 1, maxLength: 20 }).map((s) => `GITHUB_${s}`)
  );

/**
 * Arbitrary for safe environment variable names
 */
export const safeEnvVarName = () =>
  fc.constantFrom('PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG', 'LC_ALL', 'LC_CTYPE');

/**
 * Helper to validate ISO 8601 timestamp format
 */
export function isValidISO8601(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Helper to validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Helper to create a mock file system structure for testing
 */
export interface MockFileSystem {
  [path: string]: string | MockFileSystem;
}

/**
 * Helper to count tokens (simple approximation for testing)
 */
export function countTokens(text: string): number {
  // Simple approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Helper to count tokens in messages
 */
export function countMessageTokens(messages: SessionMessage[]): number {
  return messages.reduce((total, msg) => {
    const textContent = msg.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join(' ');
    return total + countTokens(textContent);
  }, 0);
}
