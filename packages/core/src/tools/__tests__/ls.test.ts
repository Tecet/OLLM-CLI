/**
 * List Directory Tool Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LsTool } from '../ls.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('LsTool', () => {
  let tool: LsTool;
  let mockMessageBus: MockMessageBus;
  let abortSignal: AbortSignal;
  let testDir: string;
  
  beforeEach(async () => {
    tool = new LsTool();
    mockMessageBus = new MockMessageBus();
    abortSignal = createMockAbortSignal();
    
    // Create temporary test directory in .ollm/temp
    const homeDir = os.homedir();
    const ollmTempDir = path.join(homeDir, '.ollm', 'temp');
    await fs.mkdir(ollmTempDir, { recursive: true });
    
    testDir = path.join(ollmTempDir, `test-ls-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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
      expect(tool.name).toBe('ls');
    });
    
    it('should have correct display name', () => {
      expect(tool.displayName).toBe('List Directory');
    });
    
    it('should have path as required parameter', () => {
      expect(tool.schema.parameters.required).toContain('path');
    });
    
    it('should have optional recursive parameter', () => {
      const properties = tool.schema.parameters?.properties as Record<string, unknown>;
      expect(properties?.recursive).toBeDefined();
    });
  });
  
  describe('execute', () => {
    it('should list directory contents', async () => {
      // Create test files and directories
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir'));
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: testDir },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('file1.txt');
      expect(result.llmContent).toContain('file2.txt');
      expect(result.llmContent).toContain('subdir');
    });
    
    it('should handle empty directory', async () => {
      const emptyDir = path.join(testDir, 'empty');
      await fs.mkdir(emptyDir);
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: emptyDir },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeUndefined();
      expect(result.returnDisplay).toContain('0 entr');
    });
    
    it('should handle directory not found', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: path.join(testDir, 'nonexistent') },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('DirectoryNotFoundError');
    });
    
    it('should handle permission denied', async () => {
      // Skip on Windows as permission handling is different
      if (process.platform === 'win32') {
        return;
      }
      
      const protectedDir = path.join(testDir, 'protected');
      await fs.mkdir(protectedDir);
      await fs.chmod(protectedDir, 0o000); // No permissions
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: protectedDir },
        context
      );
      const result = await invocation.execute(abortSignal);
      
      // Restore permissions for cleanup
      await fs.chmod(protectedDir, 0o755);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('PermissionError');
    });
    
    it('should not require confirmation', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: testDir },
        context
      );
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);
      
      expect(confirmation).toBe(false);
    });
    
    it('should handle abort signal', async () => {
      const controller = new AbortController();
      controller.abort();
      
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { path: testDir },
        context
      );
      const result = await invocation.execute(controller.signal);
      
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });
  });
});
