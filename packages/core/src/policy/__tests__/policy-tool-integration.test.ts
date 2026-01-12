/**
 * Policy-Tool Integration Tests
 *
 * Tests the integration between the PolicyEngine and tool invocations.
 * Validates that:
 * - Allow policy bypasses confirmation (Requirement 7.1)
 * - Deny policy blocks execution (Requirement 7.2)
 * - Ask policy requests confirmation (Requirement 7.3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { PolicyEngine } from '../policyEngine.js';
import { PolicyConfig } from '../policyRules.js';
import { WriteFileTool, WriteFileInvocation } from '../../tools/write-file.js';
import { EditFileTool, EditFileInvocation } from '../../tools/edit-file.js';
import { ShellTool, ShellInvocation } from '../../tools/shell.js';
import { ShellExecutionService } from '../../services/shellExecutionService.js';
import { EnvironmentSanitizationService } from '../../services/environmentSanitization.js';
import type { MessageBus, ToolContext, ToolCallConfirmationDetails } from '../../tools/types.js';

/**
 * Create a mock message bus for testing
 */
function createMockMessageBus(): MessageBus {
  return {
    requestConfirmation: async () => true,
  };
}

/**
 * Create a mock abort signal
 */
function createMockAbortSignal(): AbortSignal {
  return new AbortController().signal;
}

/**
 * Test fixture for managing temporary files
 */
class TestFixture {
  private tempDir: string = '';
  private createdFiles: string[] = [];

  async setup(): Promise<void> {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'policy-tool-test-'));
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
}

describe('Policy-Tool Integration', () => {
  let fixture: TestFixture;
  let messageBus: MessageBus;

  beforeEach(async () => {
    fixture = new TestFixture();
    await fixture.setup();
    messageBus = createMockMessageBus();
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  describe('WriteFileTool with PolicyEngine', () => {
    let tool: WriteFileTool;

    beforeEach(() => {
      tool = new WriteFileTool();
    });

    describe('Allow policy bypasses confirmation (Requirement 7.1)', () => {
      it('should return false from shouldConfirmExecute when policy is allow', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'write_file', action: 'allow' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('test.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'test content' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).toBe(false);
      });

      it('should allow execution without confirmation when policy allows', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'write_file', action: 'allow' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('allowed-write.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'allowed content' },
          context
        );

        // Should not require confirmation
        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );
        expect(confirmation).toBe(false);

        // Should execute successfully
        const result = await invocation.execute(createMockAbortSignal());
        expect(result.error).toBeUndefined();

        // Verify file was written
        const content = await fs.readFile(filePath, 'utf-8');
        expect(content).toBe('allowed content');
      });

      it('should allow based on conditional rules', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'ask',
          rules: [
            {
              tool: 'write_file',
              action: 'allow',
              conditions: [
                { param: 'path', operator: 'startsWith', value: fixture.getTempDir() },
              ],
            },
          ],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('conditional-allow.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'conditional content' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).toBe(false);
      });
    });

    describe('Deny policy blocks execution (Requirement 7.2)', () => {
      it('should throw error from shouldConfirmExecute when policy is deny', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'allow',
          rules: [{ tool: 'write_file', action: 'deny' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('denied.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'denied content' },
          context
        );

        await expect(
          invocation.shouldConfirmExecute(createMockAbortSignal())
        ).rejects.toThrow('Write operation denied by policy');
      });

      it('should deny based on conditional rules', async () => {
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
          ],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('secret-file.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'secret content' },
          context
        );

        await expect(
          invocation.shouldConfirmExecute(createMockAbortSignal())
        ).rejects.toThrow('Write operation denied by policy');
      });

      it('should not deny when condition does not match', async () => {
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
          ],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('normal-file.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'normal content' },
          context
        );

        // Should not throw - condition doesn't match, falls to default allow
        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );
        expect(confirmation).toBe(false);
      });
    });

    describe('Ask policy requests confirmation (Requirement 7.3)', () => {
      it('should return confirmation details when policy is ask', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'write_file', action: 'ask', risk: 'medium' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('ask-confirm.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'content requiring confirmation' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).not.toBe(false);
        const details = confirmation as ToolCallConfirmationDetails;
        expect(details.toolName).toBe('write_file');
        expect(details.description).toContain('Write to');
        expect(details.risk).toBe('medium');
        expect(details.locations).toContain(filePath);
      });

      it('should use inferred risk level when not specified in rule', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'write_file', action: 'ask' }], // No risk specified
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = fixture.getFilePath('inferred-risk.txt');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { path: filePath, content: 'content' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).not.toBe(false);
        const details = confirmation as ToolCallConfirmationDetails;
        // write_file should infer medium risk
        expect(details.risk).toBe('medium');
      });
    });
  });

  describe('EditFileTool with PolicyEngine', () => {
    let tool: EditFileTool;

    beforeEach(() => {
      tool = new EditFileTool();
    });

    describe('Allow policy bypasses confirmation (Requirement 7.1)', () => {
      it('should return false from shouldConfirmExecute when policy is allow', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'ask',
          rules: [{ tool: 'edit_file', action: 'allow' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = await fixture.createFile('edit-allow.txt', 'original content');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          {
            path: filePath,
            edits: [{ target: 'original', replacement: 'modified' }],
          },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).toBe(false);
      });
    });

    describe('Deny policy blocks execution (Requirement 7.2)', () => {
      it('should throw error from shouldConfirmExecute when policy is deny', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'allow',
          rules: [{ tool: 'edit_file', action: 'deny' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = await fixture.createFile('edit-deny.txt', 'content');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          {
            path: filePath,
            edits: [{ target: 'content', replacement: 'new' }],
          },
          context
        );

        await expect(
          invocation.shouldConfirmExecute(createMockAbortSignal())
        ).rejects.toThrow('Edit operation denied by policy');
      });
    });

    describe('Ask policy requests confirmation (Requirement 7.3)', () => {
      it('should return confirmation details when policy is ask', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'edit_file', action: 'ask', risk: 'medium' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const filePath = await fixture.createFile('edit-ask.txt', 'content');
        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          {
            path: filePath,
            edits: [{ target: 'content', replacement: 'new' }],
          },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).not.toBe(false);
        const details = confirmation as ToolCallConfirmationDetails;
        expect(details.toolName).toBe('edit_file');
        expect(details.description).toContain('Edit');
        expect(details.risk).toBe('medium');
        expect(details.locations).toContain(filePath);
      });
    });
  });

  describe('ShellTool with PolicyEngine', () => {
    let tool: ShellTool;
    let shellService: ShellExecutionService;

    beforeEach(() => {
      const sanitizationService = new EnvironmentSanitizationService();
      shellService = new ShellExecutionService(sanitizationService);
      tool = new ShellTool(shellService);
    });

    describe('Allow policy bypasses confirmation (Requirement 7.1)', () => {
      it('should return false from shouldConfirmExecute when policy is allow', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'ask',
          rules: [{ tool: 'shell', action: 'allow' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { command: 'echo hello' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).toBe(false);
      });

      it('should allow specific commands via conditional rules', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'ask',
          rules: [
            {
              tool: 'shell',
              action: 'allow',
              conditions: [
                { param: 'command', operator: 'startsWith', value: 'echo' },
              ],
            },
          ],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { command: 'echo safe command' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).toBe(false);
      });
    });

    describe('Deny policy blocks execution (Requirement 7.2)', () => {
      it('should throw error from shouldConfirmExecute when policy is deny', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'allow',
          rules: [{ tool: 'shell', action: 'deny' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { command: 'rm -rf /' },
          context
        );

        await expect(
          invocation.shouldConfirmExecute(createMockAbortSignal())
        ).rejects.toThrow('Shell execution denied by policy');
      });

      it('should deny dangerous commands via conditional rules', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'allow',
          rules: [
            {
              tool: 'shell',
              action: 'deny',
              conditions: [
                { param: 'command', operator: 'contains', value: 'rm' },
              ],
            },
          ],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { command: 'rm -rf /tmp/test' },
          context
        );

        await expect(
          invocation.shouldConfirmExecute(createMockAbortSignal())
        ).rejects.toThrow('Shell execution denied by policy');
      });
    });

    describe('Ask policy requests confirmation (Requirement 7.3)', () => {
      it('should return confirmation details when policy is ask', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'shell', action: 'ask', risk: 'high' }],
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { command: 'npm install' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).not.toBe(false);
        const details = confirmation as ToolCallConfirmationDetails;
        expect(details.toolName).toBe('shell');
        expect(details.description).toContain('Execute');
        expect(details.description).toContain('npm install');
        expect(details.risk).toBe('high');
      });

      it('should use high risk for shell commands by default', async () => {
        const policyConfig: PolicyConfig = {
          defaultAction: 'deny',
          rules: [{ tool: 'shell', action: 'ask' }], // No risk specified
        };
        const policyEngine = new PolicyEngine(policyConfig);

        const context: ToolContext = {
          messageBus,
          policyEngine,
        };

        const invocation = tool.createInvocation(
          { command: 'ls -la' },
          context
        );

        const confirmation = await invocation.shouldConfirmExecute(
          createMockAbortSignal()
        );

        expect(confirmation).not.toBe(false);
        const details = confirmation as ToolCallConfirmationDetails;
        // Shell tool always returns high risk in shouldConfirmExecute
        expect(details.risk).toBe('high');
      });
    });
  });

  describe('Policy precedence with tools', () => {
    it('should apply tool-specific rule over wildcard for write_file', async () => {
      const policyConfig: PolicyConfig = {
        defaultAction: 'deny',
        rules: [
          { tool: '*', action: 'deny' },
          { tool: 'write_file', action: 'allow' },
        ],
      };
      const policyEngine = new PolicyEngine(policyConfig);

      const tool = new WriteFileTool();
      const filePath = fixture.getFilePath('precedence-test.txt');
      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      const invocation = tool.createInvocation(
        { path: filePath, content: 'test' },
        context
      );

      // Tool-specific allow should take precedence over wildcard deny
      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });

    it('should apply conditional rule over unconditional rule', async () => {
      const policyConfig: PolicyConfig = {
        defaultAction: 'deny',
        rules: [
          {
            tool: 'write_file',
            action: 'allow',
            conditions: [
              { param: 'path', operator: 'matches', value: '\\.txt$' },
            ],
          },
          { tool: 'write_file', action: 'ask' },
        ],
      };
      const policyEngine = new PolicyEngine(policyConfig);

      const tool = new WriteFileTool();
      const context: ToolContext = {
        messageBus,
        policyEngine,
      };

      // .txt file should be allowed
      const txtInvocation = tool.createInvocation(
        { path: fixture.getFilePath('test.txt'), content: 'test' },
        context
      );
      const txtConfirmation = await txtInvocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(txtConfirmation).toBe(false);

      // .js file should require confirmation (falls to second rule)
      const jsInvocation = tool.createInvocation(
        { path: fixture.getFilePath('test.js'), content: 'test' },
        context
      );
      const jsConfirmation = await jsInvocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(jsConfirmation).not.toBe(false);
    });
  });

  describe('No policy engine behavior', () => {
    it('should not require confirmation when no policy engine is provided', async () => {
      const tool = new WriteFileTool();
      const filePath = fixture.getFilePath('no-policy.txt');
      const context: ToolContext = {
        messageBus,
        // No policyEngine provided
      };

      const invocation = tool.createInvocation(
        { path: filePath, content: 'test' },
        context
      );

      const confirmation = await invocation.shouldConfirmExecute(
        createMockAbortSignal()
      );
      expect(confirmation).toBe(false);
    });

    it('should execute successfully without policy engine', async () => {
      const tool = new WriteFileTool();
      const filePath = fixture.getFilePath('no-policy-exec.txt');
      const context: ToolContext = {
        messageBus,
        // No policyEngine provided
      };

      const invocation = tool.createInvocation(
        { path: filePath, content: 'no policy content' },
        context
      );

      const result = await invocation.execute(createMockAbortSignal());
      expect(result.error).toBeUndefined();

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('no policy content');
    });
  });
});
