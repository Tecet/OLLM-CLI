/**
 * Write File Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WriteFileTool } from '../write-file.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('WriteFileTool', () => {
  let tool: WriteFileTool;
  let mockMessageBus: MockMessageBus;
  let abortSignal: AbortSignal;
  let testDir: string;
  
  beforeEach(async () => {
    tool = new WriteFileTool();
    mockMessageBus = new MockMessageBus();
    abortSignal = createMockAbortSignal();
    
    // Create temporary test directory in .ollm/temp
    const homeDir = os.homedir();
    const ollmTempDir = path.join(homeDir, '.ollm', 'temp');
    await fs.mkdir(ollmTempDir, { recursive: true });
    
    testDir = path.join(ollmTempDir, `test-write-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
      expect(tool.name).toBe('write_file');
    });
    
    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Write File');
    });
    
    it('should have path and content as required parameters', () => {
      expect(tool.schema.parameters.required).toContain('path');
      expect(tool.schema.parameters.required).toContain('content');
    });
  });
  
  describe('execute', () => {
    it('should write content to file', async () => {
      const testFile = path.join(testDir, 'test.txt');
      
      const context = createToolContext(mockMessageBus);
      mockMessageBus.setNextResponse(true); // Approve write
      
      const invocation = tool.createInvocation(
        { path: testFile, content: 'Hello World' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Created');
      
      // Verify file was actually written
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Hello World');
    });
    
    it('should create parent directories', async () => {
      const testFile = path.join(testDir, 'dir', 'subdir', 'test.txt');
      
      const context = createToolContext(mockMessageBus);
      mockMessageBus.setNextResponse(true);
      
      const invocation = tool.createInvocation(
        { path: testFile, content: 'Hello' },
        context
      );
      await invocation.execute(abortSignal);
      
      // Verify parent directories were created
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Hello');
    });
    
    it('should require confirmation for write', async () => {
      // Create a mock policy engine
      const mockPolicyEngine = {
        evaluate: () => 'ask',
        getRiskLevel: () => 'medium',
      };
      
      const context = {
        ...createToolContext(mockMessageBus),
        policyEngine: mockPolicyEngine as any,
      };
      
      const invocation = tool.createInvocation(
        { path: path.join(testDir, 'test.txt'), content: 'Hello' },
        context
      );
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);
      
      expect(confirmation).not.toBe(false);
      if (confirmation !== false) {
        expect(confirmation).toHaveProperty('toolName', 'write_file');
      }
    });
    
    it('should handle permission denied', async () => {
      // Skip on Windows as permission handling is different
      if (process.platform === 'win32') {
        return;
      }
      
      // Create a directory with no write permissions
      const protectedDir = path.join(testDir, 'protected');
      await fs.mkdir(protectedDir);
      await fs.chmod(protectedDir, 0o444); // Read-only
      
      const testFile = path.join(protectedDir, 'test.txt');
      
      const context = createToolContext(mockMessageBus);
      mockMessageBus.setNextResponse(true);
      
      const invocation = tool.createInvocation(
        { path: testFile, content: 'Hello' },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      // Restore permissions for cleanup
      await fs.chmod(protectedDir, 0o755);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('PermissionError');
    });
    
    it('should handle abort signal', async () => {
      const controller = new AbortController();
      controller.abort();
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: path.join(testDir, 'test.txt'), content: 'Hello' },
        context
      );
      const result = await invocation.execute(controller.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });
  });
});
