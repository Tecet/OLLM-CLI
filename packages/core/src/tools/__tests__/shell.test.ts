/**
 * Shell Tool Tests
 */

import { EventEmitter } from 'node:events';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ShellTool } from '../shell.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

// Mock child_process with spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

describe('ShellTool', () => {
  let tool: ShellTool;
  let mockMessageBus: MockMessageBus;
  let abortSignal: AbortSignal;

  beforeEach(() => {
    tool = new ShellTool();
    mockMessageBus = new MockMessageBus();
    abortSignal = createMockAbortSignal();
    vi.clearAllMocks();
  });

  describe('Tool Schema', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('shell');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Execute Shell Command');
    });

    it('should have command as required parameter', () => {
      expect(tool.schema.parameters.required).toContain('command');
    });

    it('should have optional cwd parameter', () => {
      expect(tool.schema.parameters.properties.cwd).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute shell command', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);

      // Create mock process
      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = vi.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const context = createToolContext(mockMessageBus);
      mockMessageBus.setNextResponse(true); // Approve execution

      const invocation = tool.createInvocation({ command: 'echo "Hello"' }, context);

      // Execute and emit output
      const resultPromise = invocation.execute(abortSignal);

      // Simulate command output
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Command output'));
        mockProcess.emit('close', 0);
      }, 10);

      const result = await resultPromise;

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Command output');
    });

    it('should require confirmation', async () => {
      // Create a mock policy engine
      const mockPolicyEngine = {
        evaluate: vi.fn().mockReturnValue('ask'),
        getRiskLevel: vi.fn().mockReturnValue('high'),
      };

      const context = {
        ...createToolContext(mockMessageBus),
        policyEngine: mockPolicyEngine as any,
      };

      const invocation = tool.createInvocation({ command: 'echo "Hello"' }, context);
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);

      expect(confirmation).not.toBe(false);
      if (confirmation !== false) {
        expect(confirmation).toHaveProperty('toolName', 'shell');
      }
    });

    it('should handle command errors', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = vi.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const context = createToolContext(mockMessageBus);
      mockMessageBus.setNextResponse(true);

      const invocation = tool.createInvocation({ command: 'invalid-command' }, context);

      const resultPromise = invocation.execute(abortSignal);

      // Simulate command error
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Error message'));
        mockProcess.emit('close', 1);
      }, 10);

      const result = await resultPromise;

      expect(result.error).toBeDefined();
    });

    it('should use specified working directory', async () => {
      const { spawn } = await import('node:child_process');
      const mockSpawn = vi.mocked(spawn);

      const mockProcess = new EventEmitter() as any;
      mockProcess.stdout = new EventEmitter();
      mockProcess.stderr = new EventEmitter();
      mockProcess.kill = vi.fn();
      mockProcess.killed = false;

      mockSpawn.mockReturnValue(mockProcess);

      const context = createToolContext(mockMessageBus);
      mockMessageBus.setNextResponse(true);

      const invocation = tool.createInvocation({ command: 'pwd', cwd: '/test/dir' }, context);

      const resultPromise = invocation.execute(abortSignal);

      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Output'));
        mockProcess.emit('close', 0);
      }, 10);

      await resultPromise;

      expect(mockSpawn).toHaveBeenCalledWith('pwd', expect.objectContaining({ cwd: '/test/dir' }));
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ command: 'echo "Hello"' }, context);
      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });
  });
});
