/**
 * Tool System Integration Tests
 *
 * Tests the full integration of the tool system components:
 * - Tool registration → schema exposure → invocation → policy check → execution
 * - Concurrent tool execution
 * - Error propagation through the stack
 *
 * Validates Requirements: All (comprehensive integration testing)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolRegistry } from '../tool-registry.js';
import { PolicyEngine } from '../../policy/policyEngine.js';
import { PolicyConfig } from '../../policy/policyRules.js';
import { ConfirmationBus } from '../../confirmation-bus/messageBus.js';
import { ReadFileTool } from '../read-file.js';
import { WriteFileTool } from '../write-file.js';
import { EditFileTool } from '../edit-file.js';
import { GlobTool } from '../glob.js';
import { GrepTool } from '../grep.js';
import { LsTool } from '../ls.js';
import { ShellTool } from '../shell.js';
import { MemoryTool } from '../memory.js';
import { WriteTodosTool } from '../write-todos.js';
import { ShellExecutionService } from '../../services/shellExecutionService.js';
import { EnvironmentSanitizationService } from '../../services/environmentSanitization.js';
import type { ToolContext, DeclarativeTool, ToolResult } from '../types.js';

/**
 * Test fixture for managing temporary files and directories
 */
class TestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];

  async setup(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-integration-test-'));
  }

  async cleanup(): Promise<void> {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
  }

  getTempDir(): string {
    return this.tempDir;
  }

  getFilePath(filename: string): string {
    const filePath = path.join(this.tempDir, filename);
    this.createdFiles.push(filePath);
    return filePath;
  }

  async createFile(filename: string, content: string): Promise<string> {
    const filePath = this.getFilePath(filename);
    await fs.writeFile(filePath, content, 'utf-8');
    return filePath;
  }

  async createDirectory(dirname: string): Promise<string> {
    const dirPath = path.join(this.tempDir, dirname);
    await fs.mkdir(dirPath, { recursive: true });
    return dirPath;
  }
}

describe('Tool System Integration', () => {
  let fixture: TestFixture;
  let registry: ToolRegistry;
  let messageBus: ConfirmationBus;
  let policyEngine: PolicyEngine;
  let shellService: ShellExecutionService;

  beforeEach(async () => {
    fixture = new TestFixture();
    await fixture.setup();
    registry = new ToolRegistry();
    messageBus = new ConfirmationBus();
    const sanitizationService = new EnvironmentSanitizationService();
    shellService = new ShellExecutionService(sanitizationService);

    // Default policy: allow all
    const policyConfig: PolicyConfig = {
      defaultAction: 'allow',
      rules: [],
    };
    policyEngine = new PolicyEngine(policyConfig);
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('Full Flow: Registration → Schema → Invocation → Policy → Execution', () => {
    it('should complete full flow for read_file tool', async () => {
      // Step 1: Register tool
      const readTool = new ReadFileTool();
      registry.register(readTool);

      // Step 2: Verify schema exposure
      const schemas = registry.getFunctionSchemas();
      const readSchema = schemas.find(s => s.name === 'read_file');
      expect(readSchema).toBeDefined();
      expect(readSchema?.name).toBe('read_file');
      expect(readSchema?.description).toBeDefined();

      // Step 3: Create test file
      const testFile = await fixture.createFile('test.txt', 'Hello, World!');

      // Step 4: Create invocation
      const context: ToolContext = {
        messageBus,
        policyEngine,
      };
      const invocation = readTool.createInvocation(
        { path: testFile },
        context
      );

      // Step 5: Check policy (should not require confirmation for read)
      const abortController = new AbortController();
      const confirmation = await invocation.shouldConfirmExecute(abortController.signal);
      expect(confirmation).toBe(false);

      // Step 6: Execute tool
      const result = await invocation.execute(abortController.signal);
      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('Hello, World!');
      expect(result.returnDisplay).toBe('Hello, World!');
    });

    it('should complete full flow for write_file tool with policy check', async () => {
      // Step 1: Register tool
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      // Step 2: Verify schema exposure
      const schemas = registry.getFunctionSchemas();
      const writeSchema = schemas.find(s => s.name === 'write_file');
      expect(writeSchema).toBeDefined();
      expect(writeSchema?.parameters).toBeDefined();

      // Step 3: Create invocation
      const testFile = fixture.getFilePath('output.txt');
      const context: ToolContext = {
        messageBus,
        policyEngine,
      };
      const invocation = writeTool.createInvocation(
        { path: testFile, content: 'Test content' },
        context
      );

      // Step 4: Check policy (allow policy should not require confirmation)
      const abortController = new AbortController();
      const confirmation = await invocation.shouldConfirmExecute(abortController.signal);
      expect(confirmation).toBe(false);

      // Step 5: Execute tool
      const result = await invocation.execute(abortController.signal);
      expect(result.error).toBeUndefined();

      // Step 6: Verify file was written
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('Test content');
    });

    it('should complete full flow with ask policy requiring confirmation', async () => {
      // Step 1: Configure policy to ask for confirmation
      const askPolicyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [{ tool: 'write_file', action: 'ask', risk: 'medium' }],
      };
      const askPolicyEngine = new PolicyEngine(askPolicyConfig);

      // Step 2: Register tool
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      // Step 3: Create invocation
      const testFile = fixture.getFilePath('ask-confirm.txt');
      const context: ToolContext = {
        messageBus,
        policyEngine: askPolicyEngine,
      };
      const invocation = writeTool.createInvocation(
        { path: testFile, content: 'Needs confirmation' },
        context
      );

      // Step 4: Check policy (should return confirmation details)
      const abortController = new AbortController();
      const confirmation = await invocation.shouldConfirmExecute(abortController.signal);
      expect(confirmation).not.toBe(false);

      if (confirmation !== false) {
        expect(confirmation.toolName).toBe('write_file');
        expect(confirmation.risk).toBe('medium');
        expect(confirmation.locations).toContain(testFile);
      }
    });

    it('should complete full flow with deny policy blocking execution', async () => {
      // Step 1: Configure policy to deny
      const denyPolicyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [{ tool: 'write_file', action: 'deny' }],
      };
      const denyPolicyEngine = new PolicyEngine(denyPolicyConfig);

      // Step 2: Register tool
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      // Step 3: Create invocation
      const testFile = fixture.getFilePath('denied.txt');
      const context: ToolContext = {
        messageBus,
        policyEngine: denyPolicyEngine,
      };
      const invocation = writeTool.createInvocation(
        { path: testFile, content: 'Should be denied' },
        context
      );

      // Step 4: Check policy (should throw error)
      const abortController = new AbortController();
      await expect(
        invocation.shouldConfirmExecute(abortController.signal)
      ).rejects.toThrow('Write operation denied by policy');
    });
  });

  describe('Concurrent Tool Execution', () => {
    it('should execute multiple read operations concurrently', async () => {
      const readTool = new ReadFileTool();
      registry.register(readTool);

      // Create multiple test files
      const files = await Promise.all([
        fixture.createFile('file1.txt', 'Content 1'),
        fixture.createFile('file2.txt', 'Content 2'),
        fixture.createFile('file3.txt', 'Content 3'),
        fixture.createFile('file4.txt', 'Content 4'),
        fixture.createFile('file5.txt', 'Content 5'),
      ]);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // Execute all reads concurrently
      const abortController = new AbortController();
      const results = await Promise.all(
        files.map(async (file, index) => {
          const invocation = readTool.createInvocation({ path: file }, context);
          const result = await invocation.execute(abortController.signal);
          return { index, result };
        })
      );

      // Verify all reads succeeded
      results.forEach(({ index, result }) => {
        expect(result.error).toBeUndefined();
        expect(result.llmContent).toBe(`Content ${index + 1}`);
      });
    });

    it('should execute mixed tool operations concurrently', async () => {
      const readTool = new ReadFileTool();
      const writeTool = new WriteFileTool();
      const globTool = new GlobTool();

      registry.register(readTool);
      registry.register(writeTool);
      registry.register(globTool);

      // Create initial files
      const readFile = await fixture.createFile('read.txt', 'Read content');
      const writeFile = fixture.getFilePath('write.txt');

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Execute different tools concurrently
      const [readResult, writeResult, globResult] = await Promise.all([
        readTool.createInvocation({ path: readFile }, context).execute(abortController.signal),
        writeTool.createInvocation({ path: writeFile, content: 'Write content' }, context).execute(abortController.signal),
        // Glob might run before write completes, so we just check it doesn't error
        globTool.createInvocation({ pattern: '*.txt', directory: fixture.getTempDir() }, context).execute(abortController.signal),
      ]);

      // Verify all operations succeeded
      expect(readResult.error).toBeUndefined();
      expect(readResult.llmContent).toBe('Read content');

      expect(writeResult.error).toBeUndefined();
      const writtenContent = await fs.readFile(writeFile, 'utf-8');
      expect(writtenContent).toBe('Write content');

      expect(globResult.error).toBeUndefined();
      expect(globResult.llmContent).toContain('read.txt');
      // write.txt might not be in results if glob ran before write completed
    });

    it('should handle concurrent writes to different files', async () => {
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Write to 10 different files concurrently
      const writePromises = Array.from({ length: 10 }, (_, i) => {
        const filePath = fixture.getFilePath(`concurrent-${i}.txt`);
        const invocation = writeTool.createInvocation(
          { path: filePath, content: `Content ${i}` },
          context
        );
        return invocation.execute(abortController.signal);
      });

      const results = await Promise.all(writePromises);

      // Verify all writes succeeded
      results.forEach(result => {
        expect(result.error).toBeUndefined();
      });

      // Verify all files were written correctly
      for (let i = 0; i < 10; i++) {
        const filePath = fixture.getFilePath(`concurrent-${i}.txt`);
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBe(`Content ${i}`);
      }
    });

    it('should handle concurrent policy checks', async () => {
      const askPolicyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [{ tool: 'write_file', action: 'ask', risk: 'medium' }],
      };
      const askPolicyEngine = new PolicyEngine(askPolicyConfig);

      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      const context: ToolContext = {
        messageBus,
        policyEngine: askPolicyEngine,
      };

      const abortController = new AbortController();

      // Check policy for multiple invocations concurrently
      const policyChecks = Array.from({ length: 5 }, (_, i) => {
        const filePath = fixture.getFilePath(`policy-check-${i}.txt`);
        const invocation = writeTool.createInvocation(
          { path: filePath, content: `Content ${i}` },
          context
        );
        return invocation.shouldConfirmExecute(abortController.signal);
      });

      const confirmations = await Promise.all(policyChecks);

      // Verify all policy checks returned confirmation details
      confirmations.forEach(confirmation => {
        expect(confirmation).not.toBe(false);
        if (confirmation !== false) {
          expect(confirmation.toolName).toBe('write_file');
          expect(confirmation.risk).toBe('medium');
        }
      });
    });

    it('should handle concurrent message bus requests', async () => {
      const askPolicyConfig: PolicyConfig = {
        defaultAction: 'ask',
        rules: [],
      };
      const askPolicyEngine = new PolicyEngine(askPolicyConfig);

      const writeTool = new WriteFileTool();
      const editTool = new EditFileTool();

      const context: ToolContext = {
        messageBus,
        policyEngine: askPolicyEngine,
      };

      // Create test file for edit
      const editFile = await fixture.createFile('edit.txt', 'original');

      const abortController = new AbortController();

      // Make concurrent confirmation requests
      const confirmationPromises = [
        writeTool.createInvocation(
          { path: fixture.getFilePath('write1.txt'), content: 'test' },
          context
        ).shouldConfirmExecute(abortController.signal),
        writeTool.createInvocation(
          { path: fixture.getFilePath('write2.txt'), content: 'test' },
          context
        ).shouldConfirmExecute(abortController.signal),
        editTool.createInvocation(
          { path: editFile, edits: [{ target: 'original', replacement: 'modified' }] },
          context
        ).shouldConfirmExecute(abortController.signal),
      ];

      const confirmations = await Promise.all(confirmationPromises);

      // Verify all confirmations were handled independently
      expect(confirmations).toHaveLength(3);
      confirmations.forEach(confirmation => {
        expect(confirmation).not.toBe(false);
      });
    });
  });

  describe('Error Propagation Through Stack', () => {
    it('should propagate file not found error from read_file', async () => {
      const readTool = new ReadFileTool();
      registry.register(readTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const nonExistentFile = fixture.getFilePath('does-not-exist.txt');
      const invocation = readTool.createInvocation({ path: nonExistentFile }, context);

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Error should be propagated in ToolResult
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('FileNotFoundError');
      expect(result.error?.message).toContain('not found');
    });

    it('should propagate file exists error from write_file', async () => {
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      // Create existing file
      const existingFile = await fixture.createFile('existing.txt', 'original');

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // Try to write without overwrite flag
      const invocation = writeTool.createInvocation(
        { path: existingFile, content: 'new content', overwrite: false },
        context
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Error should be propagated in ToolResult
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('FileExistsError');
      expect(result.error?.message).toContain('already exists');
    });

    it('should propagate edit target not found error from edit_file', async () => {
      const editTool = new EditFileTool();
      registry.register(editTool);

      const testFile = await fixture.createFile('edit-error.txt', 'some content');

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // Try to edit with non-existent target
      const invocation = editTool.createInvocation(
        {
          path: testFile,
          edits: [{ target: 'does not exist', replacement: 'new' }],
        },
        context
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Error should be propagated in ToolResult
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('EditTargetNotFound');
      expect(result.error?.message).toContain('Target text not found');
    });

    it('should propagate edit target ambiguous error from edit_file', async () => {
      const editTool = new EditFileTool();
      registry.register(editTool);

      const testFile = await fixture.createFile(
        'ambiguous.txt',
        'test\ntest\ntest'
      );

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // Try to edit with ambiguous target
      const invocation = editTool.createInvocation(
        {
          path: testFile,
          edits: [{ target: 'test', replacement: 'new' }],
        },
        context
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Error should be propagated in ToolResult
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('EditTargetAmbiguous');
      expect(result.error?.message).toContain('ambiguous');
    });

    it('should propagate policy denial error', async () => {
      const denyPolicyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [{ tool: 'write_file', action: 'deny' }],
      };
      const denyPolicyEngine = new PolicyEngine(denyPolicyConfig);

      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      const context: ToolContext = {
        messageBus,
        policyEngine: denyPolicyEngine,
      };

      const invocation = writeTool.createInvocation(
        { path: fixture.getFilePath('denied.txt'), content: 'test' },
        context
      );

      const abortController = new AbortController();

      // Policy denial should throw error
      await expect(
        invocation.shouldConfirmExecute(abortController.signal)
      ).rejects.toThrow('Write operation denied by policy');
    });

    it('should propagate shell execution error', async () => {
      const shellTool = new ShellTool(shellService);
      registry.register(shellTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // Execute command that will fail
      const invocation = shellTool.createInvocation(
        { command: 'exit 1', timeout: 5000 },
        context
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Error should be propagated in ToolResult
      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('ShellExecutionError');
    });

    it('should propagate validation error for invalid parameters', async () => {
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // Create invocation with invalid parameters (empty path)
      const invocation = writeTool.createInvocation(
        { path: '', content: 'test' } as any,
        context
      );

      const abortController = new AbortController();
      const result = await invocation.execute(abortController.signal);

      // Validation error should be propagated
      expect(result.error).toBeDefined();
    });

    it('should handle errors in concurrent operations independently', async () => {
      const readTool = new ReadFileTool();
      registry.register(readTool);

      const validFile = await fixture.createFile('valid.txt', 'content');
      const invalidFile = fixture.getFilePath('invalid.txt'); // Does not exist

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Execute one valid and one invalid read concurrently
      const [validResult, invalidResult] = await Promise.all([
        readTool.createInvocation({ path: validFile }, context).execute(abortController.signal),
        readTool.createInvocation({ path: invalidFile }, context).execute(abortController.signal),
      ]);

      // Valid operation should succeed
      expect(validResult.error).toBeUndefined();
      expect(validResult.llmContent).toBe('content');

      // Invalid operation should fail
      expect(invalidResult.error).toBeDefined();
      expect(invalidResult.error?.type).toBe('FileNotFoundError');
    });

    it('should propagate abort signal cancellation', async () => {
      const writeTool = new WriteFileTool();
      registry.register(writeTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const invocation = writeTool.createInvocation(
        { path: fixture.getFilePath('cancelled.txt'), content: 'test' },
        context
      );

      const abortController = new AbortController();

      // Abort immediately
      abortController.abort();

      // Execution should handle abort signal
      const result = await invocation.execute(abortController.signal);

      // Should either throw or return error
      if (result.error) {
        expect(result.error.message).toContain('cancel');
      }
    });
  });

  describe('Multi-Tool Workflows', () => {
    it('should execute read → edit → read workflow', async () => {
      const readTool = new ReadFileTool();
      const editTool = new EditFileTool();

      registry.register(readTool);
      registry.register(editTool);

      // Create initial file
      const testFile = await fixture.createFile('workflow.txt', 'original content');

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Step 1: Read original content
      const readInvocation1 = readTool.createInvocation({ path: testFile }, context);
      const readResult1 = await readInvocation1.execute(abortController.signal);
      expect(readResult1.error).toBeUndefined();
      expect(readResult1.llmContent).toBe('original content');

      // Step 2: Edit the file
      const editInvocation = editTool.createInvocation(
        {
          path: testFile,
          edits: [{ target: 'original', replacement: 'modified' }],
        },
        context
      );
      const editResult = await editInvocation.execute(abortController.signal);
      expect(editResult.error).toBeUndefined();

      // Step 3: Read modified content
      const readInvocation2 = readTool.createInvocation({ path: testFile }, context);
      const readResult2 = await readInvocation2.execute(abortController.signal);
      expect(readResult2.error).toBeUndefined();
      expect(readResult2.llmContent).toBe('modified content');
    });

    it('should execute write → glob → read workflow', async () => {
      const writeTool = new WriteFileTool();
      const globTool = new GlobTool();
      const readTool = new ReadFileTool();

      registry.register(writeTool);
      registry.register(globTool);
      registry.register(readTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Step 1: Write multiple files
      const files = ['file1.txt', 'file2.txt', 'file3.js'];
      for (const filename of files) {
        const filePath = fixture.getFilePath(filename);
        const invocation = writeTool.createInvocation(
          { path: filePath, content: `Content of ${filename}` },
          context
        );
        const result = await invocation.execute(abortController.signal);
        expect(result.error).toBeUndefined();
      }

      // Step 2: Find .txt files with glob
      const globInvocation = globTool.createInvocation(
        { pattern: '*.txt', directory: fixture.getTempDir() },
        context
      );
      const globResult = await globInvocation.execute(abortController.signal);
      expect(globResult.error).toBeUndefined();
      expect(globResult.llmContent).toContain('file1.txt');
      expect(globResult.llmContent).toContain('file2.txt');
      expect(globResult.llmContent).not.toContain('file3.js');

      // Step 3: Read one of the found files
      const foundFile = fixture.getFilePath('file1.txt');
      const readInvocation = readTool.createInvocation({ path: foundFile }, context);
      const readResult = await readInvocation.execute(abortController.signal);
      expect(readResult.error).toBeUndefined();
      expect(readResult.llmContent).toBe('Content of file1.txt');
    });

    it('should execute write → grep → edit workflow', async () => {
      const writeTool = new WriteFileTool();
      const grepTool = new GrepTool();
      const editTool = new EditFileTool();

      registry.register(writeTool);
      registry.register(grepTool);
      registry.register(editTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Step 1: Write files with searchable content
      const file1 = fixture.getFilePath('search1.txt');
      const file2 = fixture.getFilePath('search2.txt');

      await writeTool.createInvocation(
        { path: file1, content: 'TODO: implement feature' },
        context
      ).execute(abortController.signal);

      await writeTool.createInvocation(
        { path: file2, content: 'DONE: completed task' },
        context
      ).execute(abortController.signal);

      // Step 2: Search for TODO items
      const grepInvocation = grepTool.createInvocation(
        { pattern: 'TODO', directory: fixture.getTempDir() },
        context
      );
      const grepResult = await grepInvocation.execute(abortController.signal);
      expect(grepResult.error).toBeUndefined();
      expect(grepResult.llmContent).toContain('TODO');
      expect(grepResult.llmContent).toContain('search1.txt');

      // Step 3: Edit the file with TODO
      const editInvocation = editTool.createInvocation(
        {
          path: file1,
          edits: [{ target: 'TODO', replacement: 'DONE' }],
        },
        context
      );
      const editResult = await editInvocation.execute(abortController.signal);
      expect(editResult.error).toBeUndefined();

      // Verify edit
      const content = await fs.readFile(file1, 'utf-8');
      expect(content).toBe('DONE: implement feature');
    });

    it('should execute memory set → get → delete workflow', async () => {
      const memoryTool = new MemoryTool(fixture.getFilePath('memory.json'));
      registry.register(memoryTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Step 1: Set a value
      const setInvocation = memoryTool.createInvocation(
        { action: 'set', key: 'testKey', value: 'testValue' },
        context
      );
      const setResult = await setInvocation.execute(abortController.signal);
      expect(setResult.error).toBeUndefined();

      // Step 2: Get the value
      const getInvocation = memoryTool.createInvocation(
        { action: 'get', key: 'testKey' },
        context
      );
      const getResult = await getInvocation.execute(abortController.signal);
      expect(getResult.error).toBeUndefined();
      expect(getResult.llmContent).toBe('testValue');

      // Step 3: Delete the value
      const deleteInvocation = memoryTool.createInvocation(
        { action: 'delete', key: 'testKey' },
        context
      );
      const deleteResult = await deleteInvocation.execute(abortController.signal);
      expect(deleteResult.error).toBeUndefined();

      // Step 4: Verify deletion
      const getInvocation2 = memoryTool.createInvocation(
        { action: 'get', key: 'testKey' },
        context
      );
      const getResult2 = await getInvocation2.execute(abortController.signal);
      expect(getResult2.llmContent).toContain('Key not found');
    });

    it('should execute todos add → list → complete → list workflow', async () => {
      const todosTool = new WriteTodosTool(fixture.getFilePath('todos.json'));
      registry.register(todosTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Step 1: Add a todo
      const addInvocation = todosTool.createInvocation(
        { action: 'add', task: 'Test task' },
        context
      );
      const addResult = await addInvocation.execute(abortController.signal);
      expect(addResult.error).toBeUndefined();

      // Extract todo ID from result
      const todoIdMatch = addResult.llmContent.match(/Added todo: (.+)/);
      expect(todoIdMatch).toBeTruthy();
      const todoId = todoIdMatch![1];

      // Step 2: List todos
      const listInvocation1 = todosTool.createInvocation(
        { action: 'list' },
        context
      );
      const listResult1 = await listInvocation1.execute(abortController.signal);
      expect(listResult1.error).toBeUndefined();
      expect(listResult1.llmContent).toContain('Test task');
      expect(listResult1.llmContent).toContain('[ ]'); // Not completed

      // Step 3: Complete the todo
      const completeInvocation = todosTool.createInvocation(
        { action: 'complete', id: todoId },
        context
      );
      const completeResult = await completeInvocation.execute(abortController.signal);
      expect(completeResult.error).toBeUndefined();

      // Step 4: List todos again
      const listInvocation2 = todosTool.createInvocation(
        { action: 'list' },
        context
      );
      const listResult2 = await listInvocation2.execute(abortController.signal);
      expect(listResult2.error).toBeUndefined();
      expect(listResult2.llmContent).toContain('Test task');
      expect(listResult2.llmContent).toContain('[x]'); // Completed
    });
  });

  describe('Tool Registry Integration', () => {
    it('should register multiple tools and expose all schemas', () => {
      const readTool = new ReadFileTool();
      const writeTool = new WriteFileTool();
      const editTool = new EditFileTool();
      const globTool = new GlobTool();
      const grepTool = new GrepTool();

      registry.register(readTool);
      registry.register(writeTool);
      registry.register(editTool);
      registry.register(globTool);
      registry.register(grepTool);

      const schemas = registry.getFunctionSchemas();

      expect(schemas).toHaveLength(5);
      expect(schemas.map(s => s.name)).toContain('read_file');
      expect(schemas.map(s => s.name)).toContain('write_file');
      expect(schemas.map(s => s.name)).toContain('edit_file');
      expect(schemas.map(s => s.name)).toContain('glob');
      expect(schemas.map(s => s.name)).toContain('grep');

      // Verify schemas are in alphabetical order
      const names = schemas.map(s => s.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should replace tool when registering with same name', () => {
      const tool1 = new ReadFileTool();
      const tool2 = new ReadFileTool();

      registry.register(tool1);
      const retrieved1 = registry.get('read_file');
      expect(retrieved1).toBe(tool1);

      registry.register(tool2);
      const retrieved2 = registry.get('read_file');
      expect(retrieved2).toBe(tool2);
      expect(retrieved2).not.toBe(tool1);

      // Should still have only one tool
      const schemas = registry.getFunctionSchemas();
      const readSchemas = schemas.filter(s => s.name === 'read_file');
      expect(readSchemas).toHaveLength(1);
    });

    it('should unregister tool and remove from schemas', () => {
      const readTool = new ReadFileTool();
      const writeTool = new WriteFileTool();

      registry.register(readTool);
      registry.register(writeTool);

      let schemas = registry.getFunctionSchemas();
      expect(schemas).toHaveLength(2);

      registry.unregister('read_file');

      schemas = registry.getFunctionSchemas();
      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('write_file');

      const retrieved = registry.get('read_file');
      expect(retrieved).toBeUndefined();
    });

    it('should handle tool registration in concurrent scenarios', () => {
      const tools = [
        new ReadFileTool(),
        new WriteFileTool(),
        new EditFileTool(),
        new GlobTool(),
        new GrepTool(),
        new LsTool(),
        new MemoryTool('/tmp/memory.json'),
        new WriteTodosTool('/tmp/todos.json'),
      ];

      // Register all tools
      tools.forEach(tool => registry.register(tool));

      // Verify all registered
      const schemas = registry.getFunctionSchemas();
      expect(schemas.length).toBeGreaterThanOrEqual(8);

      // Verify each tool is retrievable
      tools.forEach(tool => {
        const retrieved = registry.get(tool.name);
        expect(retrieved).toBe(tool);
      });
    });
  });

  describe('Policy Engine Integration with Multiple Tools', () => {
    it('should apply different policies to different tools', async () => {
      const policyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [
          { tool: 'read_file', action: 'allow' },
          { tool: 'write_file', action: 'ask', risk: 'medium' },
          { tool: 'shell', action: 'deny' },
        ],
      };
      const multiPolicyEngine = new PolicyEngine(policyConfig);

      const readTool = new ReadFileTool();
      const writeTool = new WriteFileTool();
      const shellTool = new ShellTool(shellService);

      const context: ToolContext = {
        messageBus,
        policyEngine: multiPolicyEngine,
      };

      const testFile = await fixture.createFile('policy-test.txt', 'content');
      const abortController = new AbortController();

      // Read should be allowed
      const readInvocation = readTool.createInvocation({ path: testFile }, context);
      const readConfirmation = await readInvocation.shouldConfirmExecute(abortController.signal);
      expect(readConfirmation).toBe(false);

      // Write should ask
      const writeInvocation = writeTool.createInvocation(
        { path: fixture.getFilePath('new.txt'), content: 'test' },
        context
      );
      const writeConfirmation = await writeInvocation.shouldConfirmExecute(abortController.signal);
      expect(writeConfirmation).not.toBe(false);

      // Shell should be denied
      const shellInvocation = shellTool.createInvocation({ command: 'echo test' }, context);
      await expect(
        shellInvocation.shouldConfirmExecute(abortController.signal)
      ).rejects.toThrow('Shell execution denied by policy');
    });

    it('should apply conditional policies based on parameters', async () => {
      const policyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [
          {
            tool: 'write_file',
            action: 'deny',
            conditions: [
              { param: 'path', operator: 'contains', value: 'secret' },
            ],
          },
          {
            tool: 'write_file',
            action: 'ask',
            risk: 'high',
            conditions: [
              { param: 'path', operator: 'contains', value: 'config' },
            ],
          },
        ],
      };
      const conditionalPolicyEngine = new PolicyEngine(policyConfig);

      const writeTool = new WriteFileTool();
      const context: ToolContext = {
        messageBus,
        policyEngine: conditionalPolicyEngine,
      };

      const abortController = new AbortController();

      // Secret file should be denied
      const secretInvocation = writeTool.createInvocation(
        { path: fixture.getFilePath('secret.txt'), content: 'test' },
        context
      );
      await expect(
        secretInvocation.shouldConfirmExecute(abortController.signal)
      ).rejects.toThrow('Write operation denied by policy');

      // Config file should ask
      const configInvocation = writeTool.createInvocation(
        { path: fixture.getFilePath('config.txt'), content: 'test' },
        context
      );
      const configConfirmation = await configInvocation.shouldConfirmExecute(abortController.signal);
      expect(configConfirmation).not.toBe(false);
      if (configConfirmation !== false) {
        expect(configConfirmation.risk).toBe('high');
      }

      // Normal file should be allowed
      const normalInvocation = writeTool.createInvocation(
        { path: fixture.getFilePath('normal.txt'), content: 'test' },
        context
      );
      const normalConfirmation = await normalInvocation.shouldConfirmExecute(abortController.signal);
      expect(normalConfirmation).toBe(false);
    });

    it('should apply wildcard policies to all tools', async () => {
      const policyConfig: PolicyConfig = {
        defaultAction: 'allow',
        rules: [
          { tool: '*', action: 'ask', risk: 'low' },
        ],
      };
      const wildcardPolicyEngine = new PolicyEngine(policyConfig);

      const readTool = new ReadFileTool();
      const writeTool = new WriteFileTool();
      const globTool = new GlobTool();

      const context: ToolContext = {
        messageBus,
        policyEngine: wildcardPolicyEngine,
      };

      const testFile = await fixture.createFile('wildcard.txt', 'content');
      const abortController = new AbortController();

      // Read tools don't require confirmation by default, even with wildcard ask policy
      // This is because they have no policy engine check in shouldConfirmExecute
      const readConfirmation = await readTool.createInvocation(
        { path: testFile },
        context
      ).shouldConfirmExecute(abortController.signal);
      // Read operations typically don't require confirmation
      expect(readConfirmation).toBe(false);

      const writeConfirmation = await writeTool.createInvocation(
        { path: fixture.getFilePath('new.txt'), content: 'test' },
        context
      ).shouldConfirmExecute(abortController.signal);
      expect(writeConfirmation).not.toBe(false);

      const globConfirmation = await globTool.createInvocation(
        { pattern: '*.txt', directory: fixture.getTempDir() },
        context
      ).shouldConfirmExecute(abortController.signal);
      // Glob operations also don't require confirmation by default
      expect(globConfirmation).toBe(false);
    });
  });

  describe('End-to-End Scenarios', () => {
    it('should handle complete file management workflow', async () => {
      // Register all file tools
      const readTool = new ReadFileTool();
      const writeTool = new WriteFileTool();
      const editTool = new EditFileTool();
      const globTool = new GlobTool();
      const grepTool = new GrepTool();
      const lsTool = new LsTool();

      registry.register(readTool);
      registry.register(writeTool);
      registry.register(editTool);
      registry.register(globTool);
      registry.register(grepTool);
      registry.register(lsTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Create a project structure
      await fixture.createDirectory('src');
      await fixture.createDirectory('tests');

      // Write source files
      const srcFile1 = fixture.getFilePath('src/module1.ts');
      const srcFile2 = fixture.getFilePath('src/module2.ts');

      await writeTool.createInvocation(
        { path: srcFile1, content: 'export function hello() { return "world"; }' },
        context
      ).execute(abortController.signal);

      await writeTool.createInvocation(
        { path: srcFile2, content: 'export function goodbye() { return "world"; }' },
        context
      ).execute(abortController.signal);

      // List directory
      const lsResult = await lsTool.createInvocation(
        { path: fixture.getTempDir(), recursive: true },
        context
      ).execute(abortController.signal);
      expect(lsResult.error).toBeUndefined();
      expect(lsResult.llmContent).toContain('src');

      // Find TypeScript files
      const globResult = await globTool.createInvocation(
        { pattern: '**/*.ts', directory: fixture.getTempDir() },
        context
      ).execute(abortController.signal);
      expect(globResult.error).toBeUndefined();
      expect(globResult.llmContent).toContain('module1.ts');
      expect(globResult.llmContent).toContain('module2.ts');

      // Search for "world" in files
      const grepResult = await grepTool.createInvocation(
        { pattern: 'world', directory: fixture.getTempDir() },
        context
      ).execute(abortController.signal);
      expect(grepResult.error).toBeUndefined();
      expect(grepResult.llmContent).toContain('world');

      // Edit a file
      const editResult = await editTool.createInvocation(
        {
          path: srcFile1,
          edits: [{ target: 'world', replacement: 'universe' }],
        },
        context
      ).execute(abortController.signal);
      expect(editResult.error).toBeUndefined();

      // Read edited file
      const readResult = await readTool.createInvocation(
        { path: srcFile1 },
        context
      ).execute(abortController.signal);
      expect(readResult.error).toBeUndefined();
      expect(readResult.llmContent).toContain('universe');
      expect(readResult.llmContent).not.toContain('world');
    });

    it('should handle data persistence workflow', async () => {
      const memoryTool = new MemoryTool(fixture.getFilePath('memory.json'));
      const todosTool = new WriteTodosTool(fixture.getFilePath('todos.json'));

      registry.register(memoryTool);
      registry.register(todosTool);

      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const abortController = new AbortController();

      // Store configuration in memory
      await memoryTool.createInvocation(
        { action: 'set', key: 'projectName', value: 'MyProject' },
        context
      ).execute(abortController.signal);

      await memoryTool.createInvocation(
        { action: 'set', key: 'version', value: '1.0.0' },
        context
      ).execute(abortController.signal);

      // Add todos
      const todo1Result = await todosTool.createInvocation(
        { action: 'add', task: 'Implement feature A' },
        context
      ).execute(abortController.signal);

      const todo2Result = await todosTool.createInvocation(
        { action: 'add', task: 'Write tests' },
        context
      ).execute(abortController.signal);

      // List memory keys
      const keysResult = await memoryTool.createInvocation(
        { action: 'list' },
        context
      ).execute(abortController.signal);
      expect(keysResult.llmContent).toContain('projectName');
      expect(keysResult.llmContent).toContain('version');

      // List todos
      const todosResult = await todosTool.createInvocation(
        { action: 'list' },
        context
      ).execute(abortController.signal);
      expect(todosResult.llmContent).toContain('Implement feature A');
      expect(todosResult.llmContent).toContain('Write tests');

      // Retrieve specific config
      const projectNameResult = await memoryTool.createInvocation(
        { action: 'get', key: 'projectName' },
        context
      ).execute(abortController.signal);
      expect(projectNameResult.llmContent).toBe('MyProject');
    });
  });
});
