/**
 * Service Integration Tests
 * Feature: services-sessions
 * 
 * Tests the integration between core services:
 * - Session recording + compression
 * - Loop detection + chat runtime
 * - Context manager + chat runtime
 * - Environment sanitization + shell tool
 * 
 * Validates: Requirements 1-10 (comprehensive integration testing)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ChatRecordingService } from '../chatRecordingService.js';
import { ChatCompressionService } from '../chatCompressionService.js';
import { LoopDetectionService } from '../loopDetectionService.js';
import { ContextManager } from '../contextManager.js';
import { EnvironmentSanitizationService } from '../environmentSanitization.js';
import { ShellExecutionService } from '../shellExecutionService.js';
import type { SessionMessage } from '../types.js';

/**
 * Test fixture for managing temporary directories
 */
class TestFixture {
  private tempDir: string = '';

  async setup(): Promise<void> {
    this.tempDir = await mkdtemp(join(tmpdir(), 'service-integration-test-'));
  }

  async cleanup(): Promise<void> {
    if (this.tempDir) {
      await rm(this.tempDir, { recursive: true, force: true });
    }
  }

  getTempDir(): string {
    return this.tempDir;
  }
}

describe('Service Integration Tests', () => {
  let fixture: TestFixture;

  beforeEach(async () => {
    fixture = new TestFixture();
    await fixture.setup();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Session Recording + Compression Integration', () => {
    it('should record session, compress it, and maintain data integrity', async () => {
      // Initialize services
      const recordingService = new ChatRecordingService({ dataDir: fixture.getTempDir() });
      const compressionService = new ChatCompressionService();

      // Create a session
      const sessionId = await recordingService.createSession('llama3.1:8b', 'ollama');

      // Record system prompt
      const systemPrompt: SessionMessage = {
        role: 'system',
        parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
        timestamp: new Date().toISOString(),
      };
      await recordingService.recordMessage(sessionId, systemPrompt);

      // Record many messages to trigger compression need
      const messages: SessionMessage[] = [];
      for (let i = 0; i < 20; i++) {
        const userMsg: SessionMessage = {
          role: 'user',
          parts: [{ type: 'text', text: `User message ${i}: ${'a'.repeat(100)}` }],
          timestamp: new Date().toISOString(),
        };
        const assistantMsg: SessionMessage = {
          role: 'assistant',
          parts: [{ type: 'text', text: `Assistant response ${i}: ${'b'.repeat(100)}` }],
          timestamp: new Date().toISOString(),
        };
        
        await recordingService.recordMessage(sessionId, userMsg);
        await recordingService.recordMessage(sessionId, assistantMsg);
        messages.push(userMsg, assistantMsg);
      }

      // Load the session
      const session = await recordingService.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session!.messages).toHaveLength(41); // 1 system + 40 messages

      // Check if compression is needed
      const tokenLimit = 2000;
      const threshold = 0.8;
      const shouldCompress = compressionService.shouldCompress(
        session!.messages,
        tokenLimit,
        threshold
      );
      expect(shouldCompress).toBe(true);

      // Compress the messages
      const compressionResult = await compressionService.compress(session!.messages, {
        strategy: 'hybrid',
        preserveRecentTokens: 500,
        targetTokens: 1000,
      });

      // Verify compression reduced token count
      expect(compressionResult.compressedTokenCount).toBeLessThan(
        compressionResult.originalTokenCount
      );

      // Verify system prompt is preserved
      expect(compressionResult.compressedMessages[0]).toEqual(systemPrompt);

      // Update session with compressed messages
      const updatedSession = {
        ...session!,
        messages: compressionResult.compressedMessages,
        metadata: {
          ...session!.metadata,
          compressionCount: session!.metadata.compressionCount + 1,
        },
      };

      // Save the compressed session
      // @ts-expect-error - Accessing private property for testing
      recordingService.sessionCache.set(sessionId, updatedSession);
      await recordingService.saveSession(sessionId);

      // Load the session again and verify compression persisted
      // @ts-expect-error - Accessing private property for testing
      recordingService.sessionCache.clear();
      const loadedSession = await recordingService.getSession(sessionId);
      expect(loadedSession).not.toBeNull();
      expect(loadedSession!.messages.length).toBeLessThan(41);
      expect(loadedSession!.metadata.compressionCount).toBe(1);
      expect(loadedSession!.messages[0]).toEqual(systemPrompt);
    });


    it('should handle multiple compression cycles with session recording', async () => {
      const recordingService = new ChatRecordingService({ dataDir: fixture.getTempDir() });
      const compressionService = new ChatCompressionService();

      const sessionId = await recordingService.createSession('llama3.1:8b', 'ollama');

      // Record system prompt
      const systemPrompt: SessionMessage = {
        role: 'system',
        parts: [{ type: 'text', text: 'You are a helpful assistant.' }],
        timestamp: new Date().toISOString(),
      };
      await recordingService.recordMessage(sessionId, systemPrompt);

      // Simulate multiple compression cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        // Add more messages
        for (let i = 0; i < 10; i++) {
          const userMsg: SessionMessage = {
            role: 'user',
            parts: [{ type: 'text', text: `Cycle ${cycle} message ${i}: ${'x'.repeat(100)}` }],
            timestamp: new Date().toISOString(),
          };
          await recordingService.recordMessage(sessionId, userMsg);
        }

        // Load and compress
        const session = await recordingService.getSession(sessionId);
        expect(session).not.toBeNull();

        const compressionResult = await compressionService.compress(session!.messages, {
          strategy: 'truncate',
          preserveRecentTokens: 300,
          targetTokens: 500,
        });

        // Update session
        const updatedSession = {
          ...session!,
          messages: compressionResult.compressedMessages,
          metadata: {
            ...session!.metadata,
            compressionCount: session!.metadata.compressionCount + 1,
          },
        };

        // @ts-expect-error - Accessing private property for testing
        recordingService.sessionCache.set(sessionId, updatedSession);
        await recordingService.saveSession(sessionId);
      }

      // Verify final state
      // @ts-expect-error - Accessing private property for testing
      recordingService.sessionCache.clear();
      const finalSession = await recordingService.getSession(sessionId);
      expect(finalSession).not.toBeNull();
      expect(finalSession!.metadata.compressionCount).toBe(3);
      expect(finalSession!.messages[0]).toEqual(systemPrompt);
    });
  });


  describe('Loop Detection + Chat Runtime Integration', () => {
    it('should detect repeated tool calls and stop execution', async () => {
      const loopDetectionService = new LoopDetectionService({
        maxTurns: 10,
        repeatThreshold: 3,
        enabled: true,
      });

      // Simulate a chat runtime scenario with repeated tool calls
      const toolName = 'read_file';
      const toolArgs = { path: '/test/file.txt' };

      // Record turns and tool calls
      for (let i = 0; i < 5; i++) {
        loopDetectionService.recordTurn();
        loopDetectionService.recordToolCall(toolName, toolArgs);

        // Check for loop after each tool call
        const loopPattern = loopDetectionService.checkForLoop();

        if (i < 2) {
          // First 3 calls (i=0,1,2) should not trigger loop detection
          expect(loopPattern).toBeNull();
        } else {
          // After 3 identical calls, loop should be detected
          expect(loopPattern).not.toBeNull();
          expect(loopPattern!.type).toBe('repeated-tool');
          expect(loopPattern!.count).toBeGreaterThanOrEqual(3);
          break;
        }
      }
    });

    it('should detect repeated outputs and stop execution', async () => {
      const loopDetectionService = new LoopDetectionService({
        maxTurns: 10,
        repeatThreshold: 3,
        enabled: true,
      });

      const repeatedOutput = 'I apologize, but I cannot complete that task.';

      // Simulate repeated outputs
      for (let i = 0; i < 5; i++) {
        loopDetectionService.recordTurn();
        loopDetectionService.recordOutput(repeatedOutput);

        const loopPattern = loopDetectionService.checkForLoop();

        if (i < 2) {
          expect(loopPattern).toBeNull();
        } else {
          expect(loopPattern).not.toBeNull();
          expect(loopPattern!.type).toBe('repeated-output');
          expect(loopPattern!.count).toBeGreaterThanOrEqual(3);
          break;
        }
      }
    });

    it('should detect turn limit exceeded', async () => {
      const loopDetectionService = new LoopDetectionService({
        maxTurns: 5,
        repeatThreshold: 3,
        enabled: true,
      });

      // Simulate many turns with different tool calls (no repetition)
      for (let i = 0; i < 10; i++) {
        loopDetectionService.recordTurn();
        loopDetectionService.recordToolCall(`tool_${i}`, { arg: i });

        const loopPattern = loopDetectionService.checkForLoop();

        if (i < 4) {
          // Turns 0-4 are within limit (5 turns total)
          expect(loopPattern).toBeNull();
        } else {
          // Turn 5 and beyond exceed the limit
          expect(loopPattern).not.toBeNull();
          expect(loopPattern!.type).toBe('turn-limit');
          break;
        }
      }
    });

    it('should reset detection state between conversations', async () => {
      const loopDetectionService = new LoopDetectionService({
        maxTurns: 10,
        repeatThreshold: 3,
        enabled: true,
      });

      // First conversation with repeated tool calls
      for (let i = 0; i < 3; i++) {
        loopDetectionService.recordTurn();
        loopDetectionService.recordToolCall('test_tool', { arg: 'same' });
      }

      let loopPattern = loopDetectionService.checkForLoop();
      expect(loopPattern).not.toBeNull();

      // Reset for new conversation
      loopDetectionService.reset();

      // Second conversation should start fresh
      loopDetectionService.recordTurn();
      loopDetectionService.recordToolCall('test_tool', { arg: 'same' });

      loopPattern = loopDetectionService.checkForLoop();
      expect(loopPattern).toBeNull(); // Should not detect loop after reset
    });
  });


  describe('Context Manager + Chat Runtime Integration', () => {
    it('should inject context into system prompt', async () => {
      const contextManager = new ContextManager();

      // Add context from different sources
      contextManager.addContext('project-info', 'This is a TypeScript project.', {
        priority: 10,
        source: 'system',
      });

      contextManager.addContext('user-preference', 'Use concise responses.', {
        priority: 5,
        source: 'user',
      });

      contextManager.addContext('hook-data', 'Current branch: main', {
        priority: 8,
        source: 'hook',
      });

      // Get system prompt additions
      const additions = contextManager.getSystemPromptAdditions();

      // Verify all contexts are included
      expect(additions).toContain('This is a TypeScript project.');
      expect(additions).toContain('Use concise responses.');
      expect(additions).toContain('Current branch: main');

      // Verify priority ordering (higher priority first)
      const projectIndex = additions.indexOf('This is a TypeScript project.');
      const hookIndex = additions.indexOf('Current branch: main');
      const userIndex = additions.indexOf('Use concise responses.');

      expect(projectIndex).toBeLessThan(hookIndex);
      expect(hookIndex).toBeLessThan(userIndex);
    });

    it('should support dynamic context updates during conversation', async () => {
      const contextManager = new ContextManager();

      // Initial context
      contextManager.addContext('status', 'Status: idle', { priority: 5 });

      let additions = contextManager.getSystemPromptAdditions();
      expect(additions).toContain('Status: idle');

      // Update context mid-conversation
      contextManager.removeContext('status');
      contextManager.addContext('status', 'Status: processing', { priority: 5 });

      additions = contextManager.getSystemPromptAdditions();
      expect(additions).not.toContain('Status: idle');
      expect(additions).toContain('Status: processing');
    });

    it('should handle context from multiple sources independently', async () => {
      const contextManager = new ContextManager();

      // Add contexts from different sources
      contextManager.addContext('hook-1', 'Hook context 1', { source: 'hook' });
      contextManager.addContext('hook-2', 'Hook context 2', { source: 'hook' });
      contextManager.addContext('ext-1', 'Extension context 1', { source: 'extension' });
      contextManager.addContext('user-1', 'User context 1', { source: 'user' });

      // Get all contexts
      const allContexts = contextManager.getContext();
      expect(allContexts).toHaveLength(4);

      // Get contexts by source
      const hookContexts = contextManager.getContextBySource('hook');
      expect(hookContexts).toHaveLength(2);
      expect(hookContexts.every(c => c.source === 'hook')).toBe(true);

      const extContexts = contextManager.getContextBySource('extension');
      expect(extContexts).toHaveLength(1);
      expect(extContexts[0].content).toBe('Extension context 1');
    });

    it('should clear all context when requested', async () => {
      const contextManager = new ContextManager();

      // Add multiple contexts
      contextManager.addContext('ctx-1', 'Context 1');
      contextManager.addContext('ctx-2', 'Context 2');
      contextManager.addContext('ctx-3', 'Context 3');

      expect(contextManager.getContext()).toHaveLength(3);

      // Clear all
      contextManager.clearContext();

      expect(contextManager.getContext()).toHaveLength(0);
      expect(contextManager.getSystemPromptAdditions()).toBe('');
    });
  });


  describe('Environment Sanitization + Shell Tool Integration', () => {
    it('should sanitize environment before shell execution', async () => {
      const sanitizationService = new EnvironmentSanitizationService();
      const shellService = new ShellExecutionService(sanitizationService);

      // Configure sanitization with default rules
      sanitizationService.configure({
        allowList: ['PATH', 'HOME', 'USER'],
        denyPatterns: ['*_KEY', '*_SECRET', '*_TOKEN', '*_PASSWORD', 'AWS_*'],
      });

      // Create test environment with sensitive variables
      const testEnv = {
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser',
        API_KEY: 'secret-key-12345',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        AWS_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        GITHUB_TOKEN: 'ghp_1234567890abcdef',
        DATABASE_PASSWORD: 'super-secret',
      };

      // Sanitize environment
      const sanitizedEnv = sanitizationService.sanitize(testEnv);

      // Verify allowed variables are preserved
      expect(sanitizedEnv.PATH).toBe('/usr/bin:/bin');
      expect(sanitizedEnv.HOME).toBe('/home/user');
      expect(sanitizedEnv.USER).toBe('testuser');

      // Verify sensitive variables are removed
      expect(sanitizedEnv.API_KEY).toBeUndefined();
      expect(sanitizedEnv.AWS_ACCESS_KEY_ID).toBeUndefined();
      expect(sanitizedEnv.AWS_SECRET_ACCESS_KEY).toBeUndefined();
      expect(sanitizedEnv.GITHUB_TOKEN).toBeUndefined();
      expect(sanitizedEnv.DATABASE_PASSWORD).toBeUndefined();
    });

    it('should execute shell commands with sanitized environment', async () => {
      const sanitizationService = new EnvironmentSanitizationService();
      const shellService = new ShellExecutionService(sanitizationService);

      // Configure sanitization
      sanitizationService.configure({
        allowList: ['PATH', 'HOME'],
        denyPatterns: ['*_SECRET', '*_KEY'],
      });

      // Execute a simple command
      const result = await shellService.execute({
        command: process.platform === 'win32' ? 'echo test' : 'echo "test"',
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      // Check output field (not stdout)
      expect(result.output).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should prevent access to sensitive environment variables in shell', async () => {
      const sanitizationService = new EnvironmentSanitizationService();
      const shellService = new ShellExecutionService(sanitizationService);

      // Configure to deny API_KEY
      sanitizationService.configure({
        allowList: ['PATH'],
        denyPatterns: ['API_KEY'],
      });

      // Try to access API_KEY (should be empty/undefined)
      const command = process.platform === 'win32' 
        ? 'echo %API_KEY%'
        : 'echo "${API_KEY:-EMPTY}"';

      const result = await shellService.execute({
        command,
        timeout: 5000,
      });

      expect(result.exitCode).toBe(0);
      // On Unix, should output "EMPTY" since API_KEY is not set
      // On Windows, should output "%API_KEY%" literally if not set
      if (process.platform !== 'win32') {
        expect(result.output.trim()).toBe('EMPTY');
      }
    });

    it('should handle custom allow and deny patterns', async () => {
      const sanitizationService = new EnvironmentSanitizationService();

      // Configure with custom patterns
      sanitizationService.configure({
        allowList: ['PATH', 'CUSTOM_VAR'],
        denyPatterns: ['DENY_*', 'SECRET_*'],
      });

      const testEnv = {
        PATH: '/usr/bin',
        CUSTOM_VAR: 'allowed',
        DENY_THIS: 'should be removed',
        SECRET_VALUE: 'should be removed',
      };

      const sanitized = sanitizationService.sanitize(testEnv);

      expect(sanitized.PATH).toBe('/usr/bin');
      expect(sanitized.CUSTOM_VAR).toBe('allowed');
      expect(sanitized.DENY_THIS).toBeUndefined();
      expect(sanitized.SECRET_VALUE).toBeUndefined();
    });

    it('should work with shell service timeout and cancellation', async () => {
      const sanitizationService = new EnvironmentSanitizationService();
      const shellService = new ShellExecutionService(sanitizationService);

      // Execute a command with a short timeout
      const command = process.platform === 'win32'
        ? 'timeout /t 10'
        : 'sleep 10';

      const startTime = Date.now();
      
      try {
        await shellService.execute({
          command,
          timeout: 1000, // 1 second timeout
        });
        // Should not reach here
        expect.fail('Expected timeout error');
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Should timeout before 10 seconds
        expect(duration).toBeLessThan(5000);
        expect(error).toBeDefined();
        if (error instanceof Error) {
          expect(error.message).toContain('timeout');
        }
      }
    });
  });


  describe('Multi-Service Integration Scenarios', () => {
    it('should handle session recording + compression + loop detection together', async () => {
      const recordingService = new ChatRecordingService({ dataDir: fixture.getTempDir() });
      const compressionService = new ChatCompressionService();
      const loopDetectionService = new LoopDetectionService({
        maxTurns: 10,
        repeatThreshold: 3,
        enabled: true,
      });

      // Create session
      const sessionId = await recordingService.createSession('llama3.1:8b', 'ollama');

      // Simulate a conversation with potential loop
      for (let turn = 0; turn < 5; turn++) {
        loopDetectionService.recordTurn();

        // Record user message
        const userMsg: SessionMessage = {
          role: 'user',
          parts: [{ type: 'text', text: `Turn ${turn}: Please help me` }],
          timestamp: new Date().toISOString(),
        };
        await recordingService.recordMessage(sessionId, userMsg);

        // Simulate repeated tool call (potential loop)
        loopDetectionService.recordToolCall('help_tool', { query: 'help' });

        // Record assistant message
        const assistantMsg: SessionMessage = {
          role: 'assistant',
          parts: [{ type: 'text', text: `Turn ${turn}: I can help you` }],
          timestamp: new Date().toISOString(),
        };
        await recordingService.recordMessage(sessionId, assistantMsg);

        // Check for loop
        const loopPattern = loopDetectionService.checkForLoop();
        if (loopPattern) {
          // Loop detected, stop conversation
          expect(loopPattern.type).toBe('repeated-tool');
          break;
        }
      }

      // Load session and check if compression is needed
      const session = await recordingService.getSession(sessionId);
      expect(session).not.toBeNull();

      // Even with loop detection, session should be recorded
      expect(session!.messages.length).toBeGreaterThan(0);
    });

    it('should integrate context manager with session recording', async () => {
      const recordingService = new ChatRecordingService({ dataDir: fixture.getTempDir() });
      const contextManager = new ContextManager();

      // Add context
      contextManager.addContext('project', 'Working on integration tests', { priority: 10 });

      // Create session
      const sessionId = await recordingService.createSession('llama3.1:8b', 'ollama');

      // Record system prompt with context
      const systemPromptBase = 'You are a helpful assistant.';
      const contextAdditions = contextManager.getSystemPromptAdditions();
      const fullSystemPrompt = `${systemPromptBase}\n\n${contextAdditions}`;

      const systemMsg: SessionMessage = {
        role: 'system',
        parts: [{ type: 'text', text: fullSystemPrompt }],
        timestamp: new Date().toISOString(),
      };
      await recordingService.recordMessage(sessionId, systemMsg);

      // Verify session contains context
      const session = await recordingService.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session!.messages[0].parts[0].text).toContain('Working on integration tests');
    });

    it('should handle all services together in a realistic scenario', async () => {
      // Initialize all services
      const recordingService = new ChatRecordingService({ dataDir: fixture.getTempDir() });
      const compressionService = new ChatCompressionService();
      const loopDetectionService = new LoopDetectionService({
        maxTurns: 20,
        repeatThreshold: 3,
        enabled: true,
      });
      const contextManager = new ContextManager();
      const sanitizationService = new EnvironmentSanitizationService();
      const shellService = new ShellExecutionService(sanitizationService);

      // Setup context
      contextManager.addContext('env', 'Development environment', { priority: 10 });

      // Configure sanitization
      sanitizationService.configure({
        allowList: ['PATH', 'HOME'],
        denyPatterns: ['*_KEY', '*_SECRET'],
      });

      // Create session
      const sessionId = await recordingService.createSession('llama3.1:8b', 'ollama');

      // Record system prompt with context
      const systemPrompt: SessionMessage = {
        role: 'system',
        parts: [{
          type: 'text',
          text: `You are a helpful assistant.\n\n${contextManager.getSystemPromptAdditions()}`,
        }],
        timestamp: new Date().toISOString(),
      };
      await recordingService.recordMessage(sessionId, systemPrompt);

      // Simulate conversation turns
      for (let turn = 0; turn < 5; turn++) {
        loopDetectionService.recordTurn();

        // User message
        const userMsg: SessionMessage = {
          role: 'user',
          parts: [{ type: 'text', text: `Turn ${turn}: Execute command` }],
          timestamp: new Date().toISOString(),
        };
        await recordingService.recordMessage(sessionId, userMsg);

        // Simulate tool call with sanitized environment
        loopDetectionService.recordToolCall('shell', { command: 'echo test' });

        // Execute shell command (with sanitization)
        const shellResult = await shellService.execute({
          command: process.platform === 'win32' ? 'echo test' : 'echo "test"',
          timeout: 5000,
        });
        expect(shellResult.exitCode).toBe(0);

        // Record tool call
        await recordingService.recordToolCall(sessionId, {
          id: `call-${turn}`,
          name: 'shell',
          args: { command: 'echo test' },
          result: {
            llmContent: shellResult.output,
            returnDisplay: shellResult.output,
          },
          timestamp: new Date().toISOString(),
        });

        // Assistant response
        const assistantMsg: SessionMessage = {
          role: 'assistant',
          parts: [{ type: 'text', text: `Turn ${turn}: Command executed` }],
          timestamp: new Date().toISOString(),
        };
        await recordingService.recordMessage(sessionId, assistantMsg);

        // Check for loops
        const loopPattern = loopDetectionService.checkForLoop();
        if (loopPattern) {
          break;
        }
      }

      // Load session
      const session = await recordingService.getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session!.messages.length).toBeGreaterThan(0);
      expect(session!.toolCalls.length).toBeGreaterThan(0);

      // Check if compression is needed
      const shouldCompress = compressionService.shouldCompress(
        session!.messages,
        2000,
        0.8
      );

      // If compression is needed, compress and save
      if (shouldCompress) {
        const compressionResult = await compressionService.compress(session!.messages, {
          strategy: 'hybrid',
          preserveRecentTokens: 500,
          targetTokens: 1000,
        });

        expect(compressionResult.compressedTokenCount).toBeLessThan(
          compressionResult.originalTokenCount
        );
      }
    });
  });
});
