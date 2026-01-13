/**
 * Tests for ChatRecordingService
 * Feature: services-sessions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatRecordingService } from '../chatRecordingService.js';
import { session } from './test-helpers.js';
import type { Session, SessionMessage, SessionToolCall } from '../types.js';

describe('ChatRecordingService', () => {
  let tempDir: string;
  let service: ChatRecordingService;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'ollm-test-'));
    service = new ChatRecordingService({ dataDir: tempDir });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Property 1: Session persistence round-trip', () => {
    /**
     * Feature: services-sessions, Property 1: Session persistence round-trip
     * 
     * For any session with messages and tool calls, saving the session and then 
     * loading it should produce an equivalent session with all data intact.
     * 
     * Validates: Requirements 1.1, 1.2, 1.3, 1.5
     */
    it('should preserve all session data through save and load cycle', async () => {
      await fc.assert(
        fc.asyncProperty(session(), async (generatedSession: Session) => {
          // Create a session with the generated data
          const sessionId = await service.createSession(
            generatedSession.model,
            generatedSession.provider
          );

          // Get the created session and replace its data with generated data
          const createdSession = await service.getSession(sessionId);
          expect(createdSession).not.toBeNull();

          // Update the session with generated messages and tool calls
          const updatedSession: Session = {
            ...createdSession!,
            messages: generatedSession.messages,
            toolCalls: generatedSession.toolCalls,
            metadata: generatedSession.metadata,
          };

          // Manually update the cache and save
          // @ts-expect-error - Accessing private property for testing
          service.sessionCache.set(sessionId, updatedSession);
          await service.saveSession(sessionId);

          // Clear the cache to force loading from disk
          // @ts-expect-error - Accessing private property for testing
          service.sessionCache.clear();

          // Load the session from disk
          const loadedSession = await service.getSession(sessionId);

          // Verify the session was loaded
          expect(loadedSession).not.toBeNull();

          // Verify all fields are preserved
          expect(loadedSession!.sessionId).toBe(updatedSession.sessionId);
          expect(loadedSession!.model).toBe(updatedSession.model);
          expect(loadedSession!.provider).toBe(updatedSession.provider);
          expect(loadedSession!.startTime).toBe(updatedSession.startTime);
          expect(loadedSession!.lastActivity).toBe(updatedSession.lastActivity);

          // Verify messages are preserved
          expect(loadedSession!.messages).toHaveLength(updatedSession.messages.length);
          for (let i = 0; i < updatedSession.messages.length; i++) {
            const original = updatedSession.messages[i];
            const loaded = loadedSession!.messages[i];

            expect(loaded.role).toBe(original.role);
            expect(loaded.timestamp).toBe(original.timestamp);
            expect(loaded.parts).toHaveLength(original.parts.length);

            for (let j = 0; j < original.parts.length; j++) {
              expect(loaded.parts[j].type).toBe(original.parts[j].type);
              expect(loaded.parts[j].text).toBe(original.parts[j].text);
            }
          }

          // Verify tool calls are preserved
          expect(loadedSession!.toolCalls).toHaveLength(updatedSession.toolCalls.length);
          for (let i = 0; i < updatedSession.toolCalls.length; i++) {
            const original = updatedSession.toolCalls[i];
            const loaded = loadedSession!.toolCalls[i];

            expect(loaded.id).toBe(original.id);
            expect(loaded.name).toBe(original.name);
            expect(loaded.timestamp).toBe(original.timestamp);
            expect(loaded.args).toEqual(original.args);
            expect(loaded.result.llmContent).toBe(original.result.llmContent);
            expect(loaded.result.returnDisplay).toBe(original.result.returnDisplay);
          }

          // Verify metadata is preserved
          expect(loadedSession!.metadata.tokenCount).toBe(updatedSession.metadata.tokenCount);
          expect(loadedSession!.metadata.compressionCount).toBe(
            updatedSession.metadata.compressionCount
          );
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 2: Session file format completeness', () => {
    /**
     * Feature: services-sessions, Property 2: Session file format completeness
     * 
     * For any saved session, the JSON file should contain all required fields 
     * (sessionId, startTime, lastActivity, model, provider, messages, toolCalls, metadata) 
     * and all nested structures should have their required fields (messages have 
     * role/parts/timestamp, tool calls have id/name/args/result/timestamp).
     * 
     * Validates: Requirements 1.7, 1.8, 2.1, 2.2, 2.3
     */
    it('should include all required fields in saved session files', async () => {
      await fc.assert(
        fc.asyncProperty(session(), async (generatedSession: Session) => {
          // Create a session with the generated data
          const sessionId = await service.createSession(
            generatedSession.model,
            generatedSession.provider
          );

          // Get the created session and replace its data with generated data
          const createdSession = await service.getSession(sessionId);
          expect(createdSession).not.toBeNull();

          // Update the session with generated messages and tool calls
          const updatedSession: Session = {
            ...createdSession!,
            messages: generatedSession.messages,
            toolCalls: generatedSession.toolCalls,
            metadata: generatedSession.metadata,
          };

          // Manually update the cache and save
          // @ts-expect-error - Accessing private property for testing
          service.sessionCache.set(sessionId, updatedSession);
          await service.saveSession(sessionId);

          // Read the raw JSON file from disk
          const { readFile } = await import('node:fs/promises');
          const sessionFilePath = join(tempDir, `${sessionId}.json`);
          const fileContent = await readFile(sessionFilePath, 'utf-8');
          const parsedSession = JSON.parse(fileContent);

          // Verify top-level required fields exist
          expect(parsedSession).toHaveProperty('sessionId');
          expect(parsedSession).toHaveProperty('startTime');
          expect(parsedSession).toHaveProperty('lastActivity');
          expect(parsedSession).toHaveProperty('model');
          expect(parsedSession).toHaveProperty('provider');
          expect(parsedSession).toHaveProperty('messages');
          expect(parsedSession).toHaveProperty('toolCalls');
          expect(parsedSession).toHaveProperty('metadata');

          // Verify top-level fields have correct types
          expect(typeof parsedSession.sessionId).toBe('string');
          expect(typeof parsedSession.startTime).toBe('string');
          expect(typeof parsedSession.lastActivity).toBe('string');
          expect(typeof parsedSession.model).toBe('string');
          expect(typeof parsedSession.provider).toBe('string');
          expect(Array.isArray(parsedSession.messages)).toBe(true);
          expect(Array.isArray(parsedSession.toolCalls)).toBe(true);
          expect(typeof parsedSession.metadata).toBe('object');

          // Verify each message has required fields
          for (const message of parsedSession.messages) {
            expect(message).toHaveProperty('role');
            expect(message).toHaveProperty('parts');
            expect(message).toHaveProperty('timestamp');

            expect(typeof message.role).toBe('string');
            expect(['user', 'assistant', 'system']).toContain(message.role);
            expect(Array.isArray(message.parts)).toBe(true);
            expect(typeof message.timestamp).toBe('string');

            // Verify each message part has required fields
            for (const part of message.parts) {
              expect(part).toHaveProperty('type');
              expect(part).toHaveProperty('text');
              expect(typeof part.type).toBe('string');
              expect(part.type).toBe('text');
              expect(typeof part.text).toBe('string');
            }
          }

          // Verify each tool call has required fields
          for (const toolCall of parsedSession.toolCalls) {
            expect(toolCall).toHaveProperty('id');
            expect(toolCall).toHaveProperty('name');
            expect(toolCall).toHaveProperty('args');
            expect(toolCall).toHaveProperty('result');
            expect(toolCall).toHaveProperty('timestamp');

            expect(typeof toolCall.id).toBe('string');
            expect(typeof toolCall.name).toBe('string');
            expect(typeof toolCall.args).toBe('object');
            expect(typeof toolCall.result).toBe('object');
            expect(typeof toolCall.timestamp).toBe('string');

            // Verify tool call result has required fields
            expect(toolCall.result).toHaveProperty('llmContent');
            expect(typeof toolCall.result.llmContent).toBe('string');
            // returnDisplay is optional, but if present should be a string
            if (toolCall.result.returnDisplay !== undefined) {
              expect(typeof toolCall.result.returnDisplay).toBe('string');
            }
          }

          // Verify metadata has required fields
          expect(parsedSession.metadata).toHaveProperty('tokenCount');
          expect(parsedSession.metadata).toHaveProperty('compressionCount');
          expect(typeof parsedSession.metadata.tokenCount).toBe('number');
          expect(typeof parsedSession.metadata.compressionCount).toBe('number');
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 3: Timestamp format validity', () => {
    /**
     * Feature: services-sessions, Property 3: Timestamp format validity
     * 
     * For any timestamp field in any session file, it should parse as a valid 
     * ISO 8601 formatted string.
     * 
     * Validates: Requirements 2.4
     */
    it('should store all timestamps in valid ISO 8601 format', async () => {
      await fc.assert(
        fc.asyncProperty(session(), async (generatedSession: Session) => {
          // Create a session with the generated data
          const sessionId = await service.createSession(
            generatedSession.model,
            generatedSession.provider
          );

          // Get the created session and update it with generated data
          const createdSession = await service.getSession(sessionId);
          expect(createdSession).not.toBeNull();

          // Update the session with generated messages and tool calls
          const updatedSession: Session = {
            ...createdSession!,
            messages: generatedSession.messages,
            toolCalls: generatedSession.toolCalls,
            metadata: generatedSession.metadata,
          };

          // Manually update the cache and save
          // @ts-expect-error - Accessing private property for testing
          service.sessionCache.set(sessionId, updatedSession);
          await service.saveSession(sessionId);

          // Read the raw JSON file from disk
          const { readFile } = await import('node:fs/promises');
          const sessionFilePath = join(tempDir, `${sessionId}.json`);
          const fileContent = await readFile(sessionFilePath, 'utf-8');
          const parsedSession = JSON.parse(fileContent);

          // Import the validation helper
          const { isValidISO8601 } = await import('./test-helpers.js');

          // Verify top-level timestamps are valid ISO 8601
          expect(isValidISO8601(parsedSession.startTime)).toBe(true);
          expect(isValidISO8601(parsedSession.lastActivity)).toBe(true);

          // Verify all message timestamps are valid ISO 8601
          for (const message of parsedSession.messages) {
            expect(isValidISO8601(message.timestamp)).toBe(true);
          }

          // Verify all tool call timestamps are valid ISO 8601
          for (const toolCall of parsedSession.toolCalls) {
            expect(isValidISO8601(toolCall.timestamp)).toBe(true);
          }
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 4: Session ID uniqueness and format', () => {
    /**
     * Feature: services-sessions, Property 4: Session ID uniqueness and format
     * 
     * For any created session, the session ID should be a valid UUID format and 
     * should be unique across all sessions.
     * 
     * Validates: Requirements 1.7, 2.5
     */
    it('should generate unique session IDs in valid UUID format', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple sessions to test uniqueness
          fc.array(
            fc.record({
              model: fc.constantFrom('llama3.1:8b', 'mistral:7b', 'codellama:13b'),
              provider: fc.constantFrom('ollama', 'openai', 'anthropic'),
            }),
            { minLength: 2, maxLength: 20 }
          ),
          async (sessionConfigs) => {
            // Clean up any existing sessions from previous iterations
            const existingSessions = await service.listSessions();
            for (const existingSession of existingSessions) {
              await service.deleteSession(existingSession.sessionId);
            }

            // Import the validation helper
            const { isValidUUID } = await import('./test-helpers.js');

            // Create sessions and collect their IDs
            const sessionIds: string[] = [];

            for (const config of sessionConfigs) {
              const sessionId = await service.createSession(config.model, config.provider);
              
              // Verify the session ID is a valid UUID
              expect(isValidUUID(sessionId)).toBe(true);
              
              // Verify the session ID is unique (not in our list yet)
              expect(sessionIds).not.toContain(sessionId);
              
              sessionIds.push(sessionId);
            }

            // Double-check: all session IDs should be unique
            const uniqueIds = new Set(sessionIds);
            expect(uniqueIds.size).toBe(sessionIds.length);

            // Verify that the session IDs in the saved files are also valid UUIDs
            for (const sessionId of sessionIds) {
              const { readFile } = await import('node:fs/promises');
              const sessionFilePath = join(tempDir, `${sessionId}.json`);
              const fileContent = await readFile(sessionFilePath, 'utf-8');
              const parsedSession = JSON.parse(fileContent);

              // Verify the sessionId field in the file is a valid UUID
              expect(isValidUUID(parsedSession.sessionId)).toBe(true);
              
              // Verify it matches the returned session ID
              expect(parsedSession.sessionId).toBe(sessionId);
            }
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    }, 30000); // 30 second timeout for property-based test
  });

  describe('Property 5: Session listing completeness', () => {
    /**
     * Feature: services-sessions, Property 5: Session listing completeness
     * 
     * For any set of saved sessions, listing sessions should return summaries 
     * for all sessions with correct counts and metadata.
     * 
     * Validates: Requirements 1.4
     */
    it('should return summaries for all saved sessions with correct counts', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(session(), { minLength: 1, maxLength: 20 }),
          async (generatedSessions: Session[]) => {
            // Clean up any existing sessions from previous iterations
            const existingSessions = await service.listSessions();
            for (const existingSession of existingSessions) {
              await service.deleteSession(existingSession.sessionId);
            }

            // Create sessions with the generated data
            const sessionIds: string[] = [];

            for (const generatedSession of generatedSessions) {
              const sessionId = await service.createSession(
                generatedSession.model,
                generatedSession.provider
              );
              sessionIds.push(sessionId);

              // Get the created session and update it with generated data
              const createdSession = await service.getSession(sessionId);
              expect(createdSession).not.toBeNull();

              // Update the session with generated messages and tool calls
              const updatedSession: Session = {
                ...createdSession!,
                messages: generatedSession.messages,
                toolCalls: generatedSession.toolCalls,
                metadata: generatedSession.metadata,
              };

              // Manually update the cache and save
              // @ts-expect-error - Accessing private property for testing
              service.sessionCache.set(sessionId, updatedSession);
              await service.saveSession(sessionId);
            }

            // Clear the cache to force loading from disk
            // @ts-expect-error - Accessing private property for testing
            service.sessionCache.clear();

            // List all sessions
            const summaries = await service.listSessions();

            // Verify we got summaries for all sessions
            expect(summaries).toHaveLength(generatedSessions.length);

            // Verify each session has a corresponding summary
            for (const sessionId of sessionIds) {
              const summary = summaries.find(s => s.sessionId === sessionId);
              expect(summary).toBeDefined();

              // Load the full session to verify counts
              const fullSession = await service.getSession(sessionId);
              expect(fullSession).not.toBeNull();

              // Verify summary fields match the full session
              expect(summary!.sessionId).toBe(fullSession!.sessionId);
              expect(summary!.startTime).toBe(fullSession!.startTime);
              expect(summary!.lastActivity).toBe(fullSession!.lastActivity);
              expect(summary!.model).toBe(fullSession!.model);
              expect(summary!.messageCount).toBe(fullSession!.messages.length);
              expect(summary!.tokenCount).toBe(fullSession!.metadata.tokenCount);
            }

            // Verify summaries are sorted by lastActivity (most recent first)
            for (let i = 0; i < summaries.length - 1; i++) {
              const currentTime = new Date(summaries[i].lastActivity).getTime();
              const nextTime = new Date(summaries[i + 1].lastActivity).getTime();
              expect(currentTime).toBeGreaterThanOrEqual(nextTime);
            }
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 6: Session deletion removes file', () => {
    /**
     * Feature: services-sessions, Property 6: Session deletion removes file
     * 
     * For any session, deleting it should remove the session file from the 
     * file system and the session should no longer appear in the session list.
     * 
     * Validates: Requirements 1.6
     */
    it('should remove session file and exclude from listing after deletion', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(session(), async (generatedSession: Session) => {
          // Create a session with the generated data
          const sessionId = await service.createSession(
            generatedSession.model,
            generatedSession.provider
          );

          // Get the created session and update it with generated data
          const createdSession = await service.getSession(sessionId);
          expect(createdSession).not.toBeNull();

          // Update the session with generated messages and tool calls
          const updatedSession: Session = {
            ...createdSession!,
            messages: generatedSession.messages,
            toolCalls: generatedSession.toolCalls,
            metadata: generatedSession.metadata,
          };

          // Manually update the cache and save
          // @ts-expect-error - Accessing private property for testing
          service.sessionCache.set(sessionId, updatedSession);
          await service.saveSession(sessionId);

          // Verify the session file exists on disk
          const { access } = await import('node:fs/promises');
          const sessionFilePath = join(tempDir, `${sessionId}.json`);
          
          // File should exist before deletion
          await expect(access(sessionFilePath)).resolves.toBeUndefined();

          // Verify session appears in listing before deletion
          const sessionsBeforeDeletion = await service.listSessions();
          const sessionInListBefore = sessionsBeforeDeletion.find(s => s.sessionId === sessionId);
          expect(sessionInListBefore).toBeDefined();

          // Delete the session
          await service.deleteSession(sessionId);

          // Verify the session file no longer exists on disk
          await expect(access(sessionFilePath)).rejects.toThrow();

          // Clear the cache to force loading from disk
          // @ts-expect-error - Accessing private property for testing
          service.sessionCache.clear();

          // Verify session no longer appears in listing
          const sessionsAfterDeletion = await service.listSessions();
          const sessionInListAfter = sessionsAfterDeletion.find(s => s.sessionId === sessionId);
          expect(sessionInListAfter).toBeUndefined();

          // Verify getSession returns null for deleted session
          const deletedSession = await service.getSession(sessionId);
          expect(deletedSession).toBeNull();
        }),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 7: Session auto-save durability', () => {
    /**
     * Feature: services-sessions, Property 7: Session auto-save durability
     * 
     * For any sequence of messages and tool calls recorded to a session, all recorded 
     * data should be persisted to disk and recoverable even if the process terminates 
     * unexpectedly.
     * 
     * Validates: Requirements 9.3, 9.6
     */
    it('should persist all recorded data to disk immediately and survive process termination', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a sequence of messages
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>,
              parts: fc.array(
                fc.record({
                  type: fc.constant('text' as const),
                  text: fc.string({ minLength: 1, maxLength: 500 }),
                }),
                { minLength: 1, maxLength: 3 }
              ),
              timestamp: fc.date().map(d => d.toISOString()),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          // Generate a sequence of tool calls
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.constantFrom('read_file', 'write_file', 'shell', 'grep'),
              args: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(
                  fc.string({ maxLength: 100 }),
                  fc.integer(),
                  fc.boolean()
                )
              ),
              result: fc.record({
                llmContent: fc.string({ minLength: 1, maxLength: 500 }),
                returnDisplay: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              }),
              timestamp: fc.date().map(d => d.toISOString()),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          async (messages: SessionMessage[], toolCalls: SessionToolCall[]) => {
            // Create a new session
            const sessionId = await service.createSession('llama3.1:8b', 'ollama');

            // Record messages one by one (simulating real usage)
            for (const message of messages) {
              await service.recordMessage(sessionId, message);
              
              // Clear the cache to simulate process termination
              // This forces the next read to come from disk
              // @ts-expect-error - Accessing private property for testing
              service.sessionCache.clear();
              
              // Verify the message was persisted to disk
              const loadedSession = await service.getSession(sessionId);
              expect(loadedSession).not.toBeNull();
              
              // Verify all messages up to this point are present
              const expectedMessageCount = messages.indexOf(message) + 1;
              expect(loadedSession!.messages).toHaveLength(expectedMessageCount);
              
              // Verify the last message matches what we just recorded
              const lastMessage = loadedSession!.messages[loadedSession!.messages.length - 1];
              expect(lastMessage.role).toBe(message.role);
              expect(lastMessage.timestamp).toBe(message.timestamp);
              expect(lastMessage.parts).toHaveLength(message.parts.length);
              
              for (let i = 0; i < message.parts.length; i++) {
                expect(lastMessage.parts[i].type).toBe(message.parts[i].type);
                expect(lastMessage.parts[i].text).toBe(message.parts[i].text);
              }
            }

            // Record tool calls one by one (simulating real usage)
            for (const toolCall of toolCalls) {
              await service.recordToolCall(sessionId, toolCall);
              
              // Clear the cache to simulate process termination
              // @ts-expect-error - Accessing private property for testing
              service.sessionCache.clear();
              
              // Verify the tool call was persisted to disk
              const loadedSession = await service.getSession(sessionId);
              expect(loadedSession).not.toBeNull();
              
              // Verify all tool calls up to this point are present
              const expectedToolCallCount = toolCalls.indexOf(toolCall) + 1;
              expect(loadedSession!.toolCalls).toHaveLength(expectedToolCallCount);
              
              // Verify the last tool call matches what we just recorded
              const lastToolCall = loadedSession!.toolCalls[loadedSession!.toolCalls.length - 1];
              expect(lastToolCall.id).toBe(toolCall.id);
              expect(lastToolCall.name).toBe(toolCall.name);
              expect(lastToolCall.timestamp).toBe(toolCall.timestamp);
              expect(lastToolCall.args).toEqual(toolCall.args);
              expect(lastToolCall.result.llmContent).toBe(toolCall.result.llmContent);
              expect(lastToolCall.result.returnDisplay).toBe(toolCall.result.returnDisplay);
            }

            // Final verification: load the complete session from disk
            // @ts-expect-error - Accessing private property for testing
            service.sessionCache.clear();
            
            const finalSession = await service.getSession(sessionId);
            expect(finalSession).not.toBeNull();
            
            // Verify all messages are present
            expect(finalSession!.messages).toHaveLength(messages.length);
            
            // Verify all tool calls are present
            expect(finalSession!.toolCalls).toHaveLength(toolCalls.length);
            
            // Verify the session can be loaded even after "process termination"
            // This demonstrates durability - data survives cache clearing
            expect(finalSession!.sessionId).toBe(sessionId);
            expect(finalSession!.messages.length).toBe(messages.length);
            expect(finalSession!.toolCalls.length).toBe(toolCalls.length);
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    });
  });

  describe('Property 8: Session count limit enforcement', () => {
    /**
     * Feature: services-sessions, Property 8: Session count limit enforcement
     * 
     * For any session count exceeding the configured maximum, the oldest sessions 
     * should be automatically deleted until the count is at or below the maximum.
     * 
     * Validates: Requirements 9.4
     */
    it('should delete oldest sessions when count exceeds maximum', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a keepCount between 1 and 10
          fc.integer({ min: 1, max: 10 }),
          // Generate sessions (more than keepCount)
          fc.integer({ min: 1, max: 15 }),
          async (keepCount: number, extraSessions: number) => {
            const totalSessions = keepCount + extraSessions;

            // Clean up any existing sessions from previous iterations
            const existingSessions = await service.listSessions();
            for (const existingSession of existingSessions) {
              await service.deleteSession(existingSession.sessionId);
            }

            // Create sessions with different lastActivity timestamps
            const sessionIds: string[] = [];
            const baseTime = new Date('2024-01-01T00:00:00Z').getTime();

            for (let i = 0; i < totalSessions; i++) {
              const sessionId = await service.createSession('llama3.1:8b', 'ollama');
              sessionIds.push(sessionId);

              // Get the created session
              const createdSession = await service.getSession(sessionId);
              expect(createdSession).not.toBeNull();

              // Update lastActivity to create a clear ordering
              // Earlier sessions have older lastActivity timestamps
              const lastActivity = new Date(baseTime + i * 1000).toISOString();
              const updatedSession: Session = {
                ...createdSession!,
                lastActivity,
              };

              // Manually update the cache and save
              // @ts-expect-error - Accessing private property for testing
              service.sessionCache.set(sessionId, updatedSession);
              await service.saveSession(sessionId);
            }

            // Clear the cache to force loading from disk
            // @ts-expect-error - Accessing private property for testing
            service.sessionCache.clear();

            // Verify we have the expected number of sessions before deletion
            const sessionsBeforeDeletion = await service.listSessions();
            expect(sessionsBeforeDeletion).toHaveLength(totalSessions);

            // Call deleteOldestSessions with keepCount
            await service.deleteOldestSessions(keepCount);

            // Clear the cache again to force loading from disk
            // @ts-expect-error - Accessing private property for testing
            service.sessionCache.clear();

            // Verify the session count is now at or below keepCount
            const sessionsAfterDeletion = await service.listSessions();
            expect(sessionsAfterDeletion.length).toBeLessThanOrEqual(keepCount);
            expect(sessionsAfterDeletion.length).toBe(Math.min(keepCount, totalSessions));

            // Verify that the most recent sessions were kept
            // Sessions are sorted by lastActivity (most recent first)
            // So the first keepCount sessions should be the ones we kept
            const expectedKeptSessions = sessionsBeforeDeletion.slice(0, keepCount);
            
            for (const expectedSession of expectedKeptSessions) {
              const keptSession = sessionsAfterDeletion.find(
                s => s.sessionId === expectedSession.sessionId
              );
              expect(keptSession).toBeDefined();
            }

            // Verify that the oldest sessions were deleted
            const expectedDeletedSessions = sessionsBeforeDeletion.slice(keepCount);
            
            for (const expectedDeleted of expectedDeletedSessions) {
              const deletedSession = sessionsAfterDeletion.find(
                s => s.sessionId === expectedDeleted.sessionId
              );
              expect(deletedSession).toBeUndefined();

              // Verify the session file no longer exists
              const { access } = await import('node:fs/promises');
              const sessionFilePath = join(tempDir, `${expectedDeleted.sessionId}.json`);
              await expect(access(sessionFilePath)).rejects.toThrow();
            }
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    }, 30000); // 30 second timeout for property-based test
  });

  describe('Property 9: Last activity timestamp updates', () => {
    /**
     * Feature: services-sessions, Property 9: Last activity timestamp updates
     * 
     * For any message or tool call recorded to a session, the lastActivity timestamp 
     * should be updated to a value greater than or equal to the previous lastActivity 
     * timestamp.
     * 
     * Validates: Requirements 9.5
     */
    it('should update lastActivity timestamp when recording messages or tool calls', { timeout: 60000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate a sequence of messages
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system') as fc.Arbitrary<'user' | 'assistant' | 'system'>,
              parts: fc.array(
                fc.record({
                  type: fc.constant('text' as const),
                  text: fc.string({ minLength: 1, maxLength: 500 }),
                }),
                { minLength: 1, maxLength: 3 }
              ),
              timestamp: fc.date().map(d => d.toISOString()),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          // Generate a sequence of tool calls
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.constantFrom('read_file', 'write_file', 'shell', 'grep'),
              args: fc.dictionary(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.oneof(
                  fc.string({ maxLength: 100 }),
                  fc.integer(),
                  fc.boolean()
                )
              ),
              result: fc.record({
                llmContent: fc.string({ minLength: 1, maxLength: 500 }),
                returnDisplay: fc.option(fc.string({ maxLength: 200 }), { nil: undefined }),
              }),
              timestamp: fc.date().map(d => d.toISOString()),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          async (messages: SessionMessage[], toolCalls: SessionToolCall[]) => {
            // Create a new session
            const sessionId = await service.createSession('llama3.1:8b', 'ollama');

            // Get the initial session to capture the initial lastActivity
            const initialSession = await service.getSession(sessionId);
            expect(initialSession).not.toBeNull();
            
            let previousLastActivity = initialSession!.lastActivity;

            // Record messages one by one and verify timestamp updates
            for (const message of messages) {
              await service.recordMessage(sessionId, message);
              
              // Load the session from disk to verify persistence
              // @ts-expect-error - Accessing private property for testing
              service.sessionCache.clear();
              
              const updatedSession = await service.getSession(sessionId);
              expect(updatedSession).not.toBeNull();
              
              // Verify lastActivity was updated
              const currentLastActivity = updatedSession!.lastActivity;
              
              // Parse timestamps to compare
              const previousTime = new Date(previousLastActivity).getTime();
              const currentTime = new Date(currentLastActivity).getTime();
              
              // Current timestamp should be >= previous timestamp
              expect(currentTime).toBeGreaterThanOrEqual(previousTime);
              
              // Update previous for next iteration
              previousLastActivity = currentLastActivity;
            }

            // Record tool calls one by one and verify timestamp updates
            for (const toolCall of toolCalls) {
              await service.recordToolCall(sessionId, toolCall);
              
              // Load the session from disk to verify persistence
              // @ts-expect-error - Accessing private property for testing
              service.sessionCache.clear();
              
              const updatedSession = await service.getSession(sessionId);
              expect(updatedSession).not.toBeNull();
              
              // Verify lastActivity was updated
              const currentLastActivity = updatedSession!.lastActivity;
              
              // Parse timestamps to compare
              const previousTime = new Date(previousLastActivity).getTime();
              const currentTime = new Date(currentLastActivity).getTime();
              
              // Current timestamp should be >= previous timestamp
              expect(currentTime).toBeGreaterThanOrEqual(previousTime);
              
              // Update previous for next iteration
              previousLastActivity = currentLastActivity;
            }

            // Final verification: the final lastActivity should be >= initial lastActivity
            const finalSession = await service.getSession(sessionId);
            expect(finalSession).not.toBeNull();
            
            const initialTime = new Date(initialSession!.lastActivity).getTime();
            const finalTime = new Date(finalSession!.lastActivity).getTime();
            
            expect(finalTime).toBeGreaterThanOrEqual(initialTime);
          }
        ),
        {
          numRuns: 100, // Run 100 iterations as specified in the design
          verbose: true,
        }
      );
    }, 30000); // 30 second timeout for property-based test
  });

  describe('Unit Tests: Error Handling', () => {
    /**
     * Test write failure recovery
     * Validates: Requirements 10.1
     */
    it('should throw error when session file writing fails due to invalid path', async () => {
      // Create a service with an invalid data directory path (contains null byte on Unix, or invalid chars on Windows)
      // We'll use a path that will cause mkdir to fail
      const invalidService = new ChatRecordingService({ 
        dataDir: join(tempDir, 'invalid\x00path') 
      });

      // Try to create a session - this should fail when trying to ensure the data directory
      await expect(invalidService.createSession('llama3.1:8b', 'ollama')).rejects.toThrow();
    });

    /**
     * Test read failure handling
     * Validates: Requirements 10.2
     */
    it('should return null when session file cannot be read', async () => {
      // Try to get a non-existent session
      const nonExistentSession = await service.getSession('non-existent-id');
      expect(nonExistentSession).toBeNull();

      // Create a session
      const sessionId = await service.createSession('llama3.1:8b', 'ollama');
      
      // Verify it exists
      let session = await service.getSession(sessionId);
      expect(session).not.toBeNull();

      // Delete the file but keep it in cache
      const { unlink } = await import('node:fs/promises');
      const sessionFilePath = join(tempDir, `${sessionId}.json`);
      await unlink(sessionFilePath);

      // Clear cache to force disk read
      // @ts-expect-error - Accessing private property for testing
      service.sessionCache.clear();

      // Try to get the session - should return null since file is gone
      session = await service.getSession(sessionId);
      expect(session).toBeNull();
    });

    /**
     * Test corrupted file recovery
     * Validates: Requirements 10.2
     */
    it('should handle corrupted session files gracefully', async () => {
      // Create a session
      const sessionId = await service.createSession('llama3.1:8b', 'ollama');
      
      // Verify it exists
      let session = await service.getSession(sessionId);
      expect(session).not.toBeNull();

      // Corrupt the session file by writing invalid JSON
      const { writeFile } = await import('node:fs/promises');
      const sessionFilePath = join(tempDir, `${sessionId}.json`);
      await writeFile(sessionFilePath, 'this is not valid JSON{{{', 'utf-8');

      // Clear cache to force disk read
      // @ts-expect-error - Accessing private property for testing
      service.sessionCache.clear();

      // Try to get the session - should throw an error for corrupted file
      await expect(service.getSession(sessionId)).rejects.toThrow();
    });

    /**
     * Test listSessions skips corrupted files
     * Validates: Requirements 10.2
     */
    it('should skip corrupted session files when listing sessions', async () => {
      // Clean up any existing sessions from previous tests
      const existingSessions = await service.listSessions();
      for (const existingSession of existingSessions) {
        await service.deleteSession(existingSession.sessionId);
      }

      // Wait a bit for file system operations to complete on Windows
      await new Promise(resolve => setTimeout(resolve, 100));

      // Clear cache after cleanup
      // @ts-expect-error - Accessing private property for testing
      service.sessionCache.clear();

      // Verify cleanup worked
      const sessionsAfterCleanup = await service.listSessions();
      expect(sessionsAfterCleanup).toHaveLength(0);

      // Create two valid sessions
      const sessionId1 = await service.createSession('llama3.1:8b', 'ollama');
      const sessionId2 = await service.createSession('mistral:7b', 'ollama');

      // Verify both exist
      const sessions = await service.listSessions();
      expect(sessions).toHaveLength(2);

      // Corrupt the first session file
      const { writeFile } = await import('node:fs/promises');
      const sessionFilePath1 = join(tempDir, `${sessionId1}.json`);
      await writeFile(sessionFilePath1, 'corrupted data', 'utf-8');

      // Clear cache to force disk read
      // @ts-expect-error - Accessing private property for testing
      service.sessionCache.clear();

      // List sessions - should only return the valid session
      const sessionsAfterCorruption = await service.listSessions();
      expect(sessionsAfterCorruption).toHaveLength(1);
      expect(sessionsAfterCorruption[0].sessionId).toBe(sessionId2);
    });

    /**
     * Test deleteSession handles missing files gracefully
     * Validates: Requirements 10.1
     */
    it('should not throw when deleting a non-existent session', async () => {
      // Try to delete a non-existent session - should not throw
      await expect(service.deleteSession('non-existent-id')).resolves.toBeUndefined();
    });

    /**
     * Test saveSession throws when session not in cache
     * Validates: Requirements 10.1
     */
    it('should throw error when trying to save a session not in cache', async () => {
      // Try to save a session that doesn't exist in cache
      await expect(service.saveSession('non-existent-id')).rejects.toThrow(
        'Session not in cache: non-existent-id'
      );
    });

    /**
     * Test recordMessage throws when session not found
     * Validates: Requirements 10.1
     */
    it('should throw error when recording message to non-existent session', async () => {
      const message: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello' }],
        timestamp: new Date().toISOString(),
      };

      await expect(service.recordMessage('non-existent-id', message)).rejects.toThrow(
        'Session not found: non-existent-id'
      );
    });

    /**
     * Test recordToolCall throws when session not found
     * Validates: Requirements 10.1
     */
    it('should throw error when recording tool call to non-existent session', async () => {
      const toolCall: SessionToolCall = {
        id: 'call_123',
        name: 'read_file',
        args: { path: 'test.txt' },
        result: {
          llmContent: 'File contents',
          returnDisplay: 'Read test.txt',
        },
        timestamp: new Date().toISOString(),
      };

      await expect(service.recordToolCall('non-existent-id', toolCall)).rejects.toThrow(
        'Session not found: non-existent-id'
      );
    });
  });
});
