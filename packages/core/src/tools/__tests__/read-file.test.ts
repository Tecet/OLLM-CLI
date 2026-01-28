/**
 * Read File Tool Tests
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ReadFileTool } from '../read-file.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

describe('ReadFileTool', () => {
  let tool: ReadFileTool;
  let mockMessageBus: MockMessageBus;
  let abortSignal: AbortSignal;
  let testDir: string;

  beforeEach(async () => {
    tool = new ReadFileTool();
    mockMessageBus = new MockMessageBus();
    abortSignal = createMockAbortSignal();

    // Create temporary test directory with unique timestamp
    testDir = path.join(
      os.tmpdir(),
      `ollm-test-read-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Tool Schema', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('read_file');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Read File');
    });

    it('should have path as required parameter', () => {
      expect(tool.schema.parameters.required).toContain('path');
    });

    it('should have optional line range parameters', () => {
      const properties = tool.schema.parameters?.properties as Record<string, unknown>;
      expect(properties?.startLine).toBeDefined();
      expect(properties?.endLine).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should read entire file', async () => {
      const mockContent = 'Line 1\nLine 2\nLine 3';
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, mockContent);

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ path: testFile }, context);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe(mockContent);
    });

    it('should read file with line range', async () => {
      const mockContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, mockContent);

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: testFile, startLine: 2, endLine: 4 },
        context
      );
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('Line 2\nLine 3\nLine 4');
    });

    it('should handle file not found', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: path.join(testDir, 'nonexistent.txt') },
        context
      );
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('FileNotFoundError');
    });

    it('should handle permission denied', async () => {
      // Skip on Windows as permission handling is different
      if (process.platform === 'win32') {
        return;
      }

      const testFile = path.join(testDir, 'protected.txt');
      await fs.writeFile(testFile, 'content');
      await fs.chmod(testFile, 0o000); // Remove all permissions

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ path: testFile }, context);
      const result = await invocation.execute(abortSignal);

      // Restore permissions for cleanup
      await fs.chmod(testFile, 0o644);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('PermissionError');
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ path: 'test.txt' }, context);
      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });

    it('should not require confirmation', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ path: 'test.txt' }, context);
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);

      expect(confirmation).toBe(false);
    });
  });
});
