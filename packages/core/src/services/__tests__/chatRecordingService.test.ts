/**
 * Tests for ChatRecordingService
 * Verifies session recording, auto-save, and data persistence
 */

import { randomUUID } from 'node:crypto';
import { mkdir, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ChatRecordingService } from '../chatRecordingService.js';

import type { SessionMessage, SessionToolCall } from '../types.js';

describe('ChatRecordingService', () => {
  let service: ChatRecordingService;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = join(tmpdir(), `ollm-test-${randomUUID()}`);
    await mkdir(testDir, { recursive: true });

    // Create service with test directory
    service = new ChatRecordingService({
      dataDir: testDir,
      maxSessions: 10,
      autoSave: true,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

      const session = await service.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.model).toBe('test-model');
      expect(session?.provider).toBe('test-provider');
      expect(session?.messages).toEqual([]);
      expect(session?.toolCalls).toEqual([]);
    });

    it('should save session file immediately on creation', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      // Verify file exists
      const filePath = join(testDir, `${sessionId}.json`);
      const fileContent = await readFile(filePath, 'utf-8');
      const session = JSON.parse(fileContent);

      expect(session.sessionId).toBe(sessionId);
      expect(session.model).toBe('test-model');
      expect(session.provider).toBe('test-provider');
    });
  });

  describe('Message Recording', () => {
    it('should record user message', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const message: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Hello, world!' }],
        timestamp: new Date().toISOString(),
      };

      await service.recordMessage(sessionId, message);

      const session = await service.getSession(sessionId);
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0]).toEqual(message);
    });

    it('should record assistant message', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const message: SessionMessage = {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hello! How can I help?' }],
        timestamp: new Date().toISOString(),
      };

      await service.recordMessage(sessionId, message);

      const session = await service.getSession(sessionId);
      expect(session?.messages).toHaveLength(1);
      expect(session?.messages[0]).toEqual(message);
    });

    it('should record multiple messages in order', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const message1: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'First message' }],
        timestamp: new Date().toISOString(),
      };

      const message2: SessionMessage = {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Second message' }],
        timestamp: new Date().toISOString(),
      };

      const message3: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Third message' }],
        timestamp: new Date().toISOString(),
      };

      await service.recordMessage(sessionId, message1);
      await service.recordMessage(sessionId, message2);
      await service.recordMessage(sessionId, message3);

      const session = await service.getSession(sessionId);
      expect(session?.messages).toHaveLength(3);
      expect(session?.messages[0]).toEqual(message1);
      expect(session?.messages[1]).toEqual(message2);
      expect(session?.messages[2]).toEqual(message3);
    });

    it('should auto-save message to disk immediately', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const message: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Test message' }],
        timestamp: new Date().toISOString(),
      };

      await service.recordMessage(sessionId, message);

      // Read directly from disk (bypass cache)
      const filePath = join(testDir, `${sessionId}.json`);
      const fileContent = await readFile(filePath, 'utf-8');
      const session = JSON.parse(fileContent);

      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].parts[0].text).toBe('Test message');
    });

    it('should update lastActivity timestamp', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');
      const session1 = await service.getSession(sessionId);
      const initialTimestamp = session1?.lastActivity;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const message: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
        timestamp: new Date().toISOString(),
      };

      await service.recordMessage(sessionId, message);

      const session2 = await service.getSession(sessionId);
      expect(session2?.lastActivity).not.toBe(initialTimestamp);
    });
  });

  describe('Tool Call Recording', () => {
    it('should record tool call', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const toolCall: SessionToolCall = {
        id: 'tool-1',
        name: 'test_tool',
        args: { param: 'value' },
        result: {
          llmContent: 'Tool result',
          returnDisplay: 'Display result',
        },
        timestamp: new Date().toISOString(),
      };

      await service.recordToolCall(sessionId, toolCall);

      const session = await service.getSession(sessionId);
      expect(session?.toolCalls).toHaveLength(1);
      expect(session?.toolCalls[0]).toEqual(toolCall);
    });

    it('should record multiple tool calls', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const toolCall1: SessionToolCall = {
        id: 'tool-1',
        name: 'tool_one',
        args: {},
        result: { llmContent: 'Result 1' },
        timestamp: new Date().toISOString(),
      };

      const toolCall2: SessionToolCall = {
        id: 'tool-2',
        name: 'tool_two',
        args: {},
        result: { llmContent: 'Result 2' },
        timestamp: new Date().toISOString(),
      };

      await service.recordToolCall(sessionId, toolCall1);
      await service.recordToolCall(sessionId, toolCall2);

      const session = await service.getSession(sessionId);
      expect(session?.toolCalls).toHaveLength(2);
      expect(session?.toolCalls[0]).toEqual(toolCall1);
      expect(session?.toolCalls[1]).toEqual(toolCall2);
    });

    it('should auto-save tool call to disk immediately', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      const toolCall: SessionToolCall = {
        id: 'tool-1',
        name: 'test_tool',
        args: { test: true },
        result: { llmContent: 'Success' },
        timestamp: new Date().toISOString(),
      };

      await service.recordToolCall(sessionId, toolCall);

      // Read directly from disk (bypass cache)
      const filePath = join(testDir, `${sessionId}.json`);
      const fileContent = await readFile(filePath, 'utf-8');
      const session = JSON.parse(fileContent);

      expect(session.toolCalls).toHaveLength(1);
      expect(session.toolCalls[0].name).toBe('test_tool');
    });
  });

  describe('Session Persistence', () => {
    it('should persist full conversation history', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      // Simulate a conversation
      await service.recordMessage(sessionId, {
        role: 'user',
        parts: [{ type: 'text', text: 'User message 1' }],
        timestamp: new Date().toISOString(),
      });

      await service.recordMessage(sessionId, {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Assistant response 1' }],
        timestamp: new Date().toISOString(),
      });

      await service.recordToolCall(sessionId, {
        id: 'tool-1',
        name: 'test_tool',
        args: {},
        result: { llmContent: 'Tool result' },
        timestamp: new Date().toISOString(),
      });

      await service.recordMessage(sessionId, {
        role: 'user',
        parts: [{ type: 'text', text: 'User message 2' }],
        timestamp: new Date().toISOString(),
      });

      await service.recordMessage(sessionId, {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Assistant response 2' }],
        timestamp: new Date().toISOString(),
      });

      // Verify everything is saved
      const filePath = join(testDir, `${sessionId}.json`);
      const fileContent = await readFile(filePath, 'utf-8');
      const session = JSON.parse(fileContent);

      expect(session.messages).toHaveLength(4);
      expect(session.toolCalls).toHaveLength(1);
      expect(session.messages[0].parts[0].text).toBe('User message 1');
      expect(session.messages[1].parts[0].text).toBe('Assistant response 1');
      expect(session.messages[2].parts[0].text).toBe('User message 2');
      expect(session.messages[3].parts[0].text).toBe('Assistant response 2');
      expect(session.toolCalls[0].name).toBe('test_tool');
    });

    it('should handle session interruption gracefully', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      // Record some messages
      await service.recordMessage(sessionId, {
        role: 'user',
        parts: [{ type: 'text', text: 'Message before interruption' }],
        timestamp: new Date().toISOString(),
      });

      // Simulate interruption (no explicit save call)
      // Data should already be on disk due to autoSave

      // Verify data is persisted
      const filePath = join(testDir, `${sessionId}.json`);
      const fileContent = await readFile(filePath, 'utf-8');
      const session = JSON.parse(fileContent);

      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].parts[0].text).toBe('Message before interruption');
    });
  });

  describe('Session Listing', () => {
    it('should list all sessions', async () => {
      const sessionId1 = await service.createSession('model-1', 'provider-1');
      const sessionId2 = await service.createSession('model-2', 'provider-2');

      const sessions = await service.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map((s) => s.sessionId)).toContain(sessionId1);
      expect(sessions.map((s) => s.sessionId)).toContain(sessionId2);
    });

    it('should sort sessions by lastActivity (most recent first)', async () => {
      const sessionId1 = await service.createSession('model-1', 'provider-1');

      // Wait to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const sessionId2 = await service.createSession('model-2', 'provider-2');

      const sessions = await service.listSessions();

      expect(sessions[0].sessionId).toBe(sessionId2); // Most recent
      expect(sessions[1].sessionId).toBe(sessionId1);
    });
  });

  describe('Session Deletion', () => {
    it('should delete session', async () => {
      const sessionId = await service.createSession('test-model', 'test-provider');

      await service.deleteSession(sessionId);

      const session = await service.getSession(sessionId);
      expect(session).toBeNull();
    });

    it('should delete oldest sessions when limit exceeded', async () => {
      // Create service with low limit
      const limitedService = new ChatRecordingService({
        dataDir: testDir,
        maxSessions: 3,
        autoSave: true,
      });

      // Create 5 sessions
      const sessions: string[] = [];
      for (let i = 0; i < 5; i++) {
        const sessionId = await limitedService.createSession(`model-${i}`, 'provider');
        sessions.push(sessionId);
        await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
      }

      // Delete oldest, keep 3
      await limitedService.deleteOldestSessions(3);

      const remaining = await limitedService.listSessions();
      expect(remaining).toHaveLength(3);

      // Verify newest 3 are kept
      expect(remaining.map((s) => s.sessionId)).toContain(sessions[2]);
      expect(remaining.map((s) => s.sessionId)).toContain(sessions[3]);
      expect(remaining.map((s) => s.sessionId)).toContain(sessions[4]);

      // Verify oldest 2 are deleted
      expect(remaining.map((s) => s.sessionId)).not.toContain(sessions[0]);
      expect(remaining.map((s) => s.sessionId)).not.toContain(sessions[1]);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when recording to non-existent session', async () => {
      const message: SessionMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
        timestamp: new Date().toISOString(),
      };

      await expect(service.recordMessage('non-existent-id', message)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should throw error when recording tool call to non-existent session', async () => {
      const toolCall: SessionToolCall = {
        id: 'tool-1',
        name: 'test',
        args: {},
        result: { llmContent: 'Test' },
        timestamp: new Date().toISOString(),
      };

      await expect(service.recordToolCall('non-existent-id', toolCall)).rejects.toThrow(
        'Session not found'
      );
    });
  });
});
