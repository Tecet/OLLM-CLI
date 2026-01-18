/**
 * Unit tests for Remember tool
 * Feature: stage-07-model-management
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { RememberTool, RememberInvocation } from '../remember.js';
import { MemoryService } from '../../services/memoryService.js';
import { ToolRegistry } from '../tool-registry.js';
import { createToolContext, MockMessageBus } from './test-helpers.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Remember Tool', () => {
  let tempDir: string;
  let memoryPath: string;
  let memoryService: MemoryService;
  let tool: RememberTool;

  beforeEach(async () => {
    // Create unique temp directory for each test
    tempDir = join(tmpdir(), `ollm-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    memoryPath = join(tempDir, 'memory.json');

    // Create memory service and tool
    memoryService = new MemoryService({ memoryPath });
    await memoryService.load();
    tool = new RememberTool(memoryService);
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore
    }
  });

  describe('Tool Registration', () => {
    it('should have correct tool name', () => {
      expect(tool.name).toBe('remember');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Remember Information');
    });

    it('should have valid schema', () => {
      expect(tool.schema).toBeDefined();
      expect(tool.schema.name).toBe('remember');
      expect(tool.schema.description).toBeDefined();
      expect(tool.schema.parameters).toBeDefined();
    });

    it('should register successfully in tool registry', () => {
      const registry = new ToolRegistry();
      registry.register(tool);

      const registered = registry.get('remember');
      expect(registered).toBe(tool);
    });

    it('should have required parameters in schema', () => {
      const params = tool.schema.parameters as any;
      expect(params.required).toContain('key');
      expect(params.required).toContain('value');
      expect(params.required).not.toContain('category');
    });
  });

  describe('Tool Execution', () => {
    it('should store memory with llm source', async () => {
      const messageBus = new MockMessageBus();
      const invocation = tool.createInvocation(
        { key: 'test_key', value: 'test_value' },
        createToolContext(messageBus)
      );

      const result = await invocation.execute(new AbortController().signal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('Remembered');

      // Verify memory was stored with llm source
      const recalled = memoryService.recall('test_key');
      expect(recalled).not.toBeNull();
      expect(recalled?.source).toBe('llm');
      expect(recalled?.value).toBe('test_value');
    });

    it('should store memory with specified category', async () => {
      const messageBus = new MockMessageBus();
      const invocation = tool.createInvocation(
        { key: 'test_key', value: 'test_value', category: 'fact' },
        createToolContext(messageBus)
      );

      await invocation.execute(new AbortController().signal);

      const recalled = memoryService.recall('test_key');
      expect(recalled?.category).toBe('fact');
    });

    it('should default to context category if not specified', async () => {
      const messageBus = new MockMessageBus();
      const invocation = tool.createInvocation(
        { key: 'test_key', value: 'test_value' },
        createToolContext(messageBus)
      );

      await invocation.execute(new AbortController().signal);

      const recalled = memoryService.recall('test_key');
      expect(recalled?.category).toBe('context');
    });

    it('should persist memory to disk', async () => {
      const messageBus = new MockMessageBus();
      const invocation = tool.createInvocation(
        { key: 'test_key', value: 'test_value' },
        createToolContext(messageBus)
      );

      await invocation.execute(new AbortController().signal);

      // Create new service and load
      const newService = new MemoryService({ memoryPath });
      await newService.load();

      const recalled = newService.recall('test_key');
      expect(recalled).not.toBeNull();
      expect(recalled?.source).toBe('llm');
    });

    it('should handle cancellation', async () => {
      const messageBus = new MockMessageBus();
      const invocation = tool.createInvocation(
        { key: 'test_key', value: 'test_value' },
        createToolContext(messageBus)
      );

      const controller = new AbortController();
      controller.abort();

      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('cancelled');
    });
  });

  describe('Tool Description', () => {
    it('should provide descriptive text', () => {
      const invocation = new RememberInvocation(
        { key: 'user_name', value: 'Alice' },
        memoryService
      );

      const description = invocation.getDescription();
      expect(description).toContain('user_name');
      expect(description).toContain('Alice');
    });
  });

  describe('Tool Locations', () => {
    it('should return empty array for tool locations', () => {
      const invocation = new RememberInvocation(
        { key: 'test', value: 'test' },
        memoryService
      );

      const locations = invocation.toolLocations();
      expect(locations).toEqual([]);
    });
  });

  describe('Confirmation', () => {
    it('should not require confirmation', async () => {
      const invocation = new RememberInvocation(
        { key: 'test', value: 'test' },
        memoryService
      );

      const shouldConfirm = await invocation.shouldConfirmExecute(
        new AbortController().signal
      );
      expect(shouldConfirm).toBe(false);
    });
  });

  /**
   * Property 27: LLM memory source marking
   * For any memory stored via the remember tool, the source field should be set to 'llm'
   * Validates: Requirements 13.1, 13.2, 13.3
   */
  describe('Property 27: LLM memory source marking', () => {
    it('should mark all memories from remember tool as llm source', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              key: fc.string({ minLength: 1, maxLength: 50 }),
              value: fc.string({ minLength: 1, maxLength: 200 }),
              category: fc.constantFrom('fact' as const, 'preference' as const, 'context' as const),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          async (memories) => {
            const messageBus = new MockMessageBus();
            
            // Store all memories via remember tool
            for (const mem of memories) {
              const invocation = tool.createInvocation(
                {
                  key: mem.key,
                  value: mem.value,
                  category: mem.category,
                },
                createToolContext(messageBus)
              );

              await invocation.execute(new AbortController().signal);
            }

            // Verify all have llm source
            for (const mem of memories) {
              const recalled = memoryService.recall(mem.key);
              expect(recalled).not.toBeNull();
              if (recalled) {
                expect(recalled.source).toBe('llm');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
