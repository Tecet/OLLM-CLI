/**
 * Glob Tool Tests
 */

import { glob } from 'glob';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { GlobTool } from '../glob.js';
import { MockMessageBus, createMockAbortSignal, createToolContext } from './test-helpers.js';

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

describe('GlobTool', () => {
  let tool: GlobTool;
  let mockMessageBus: MockMessageBus;
  let abortSignal: AbortSignal;

  beforeEach(() => {
    tool = new GlobTool();
    mockMessageBus = new MockMessageBus();
    abortSignal = createMockAbortSignal();
    vi.clearAllMocks();
  });

  describe('Tool Schema', () => {
    it('should have correct name', () => {
      expect(tool.name).toBe('glob');
    });

    it('should have correct display name', () => {
      expect(tool.displayName).toBe('Find Files by Pattern');
    });

    it('should have pattern as required parameter', () => {
      expect(tool.schema.parameters.required).toContain('pattern');
    });

    it('should have optional parameters', () => {
      const properties = tool.schema.parameters?.properties as Record<string, unknown>;
      expect(properties?.directory).toBeDefined();
      expect(properties?.maxResults).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should find files matching pattern', async () => {
      const mockFiles = ['file1.ts', 'file2.ts', 'file3.ts'];
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ pattern: '**/*.ts' }, context);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toContain('file1.ts');
      expect(result.llmContent).toContain('file2.ts');
      expect(result.llmContent).toContain('file3.ts');
    });

    it('should respect maxResults limit', async () => {
      const mockFiles = Array.from({ length: 100 }, (_, i) => `file${i}.ts`);
      vi.mocked(glob).mockResolvedValue(mockFiles);

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ pattern: '**/*.ts', maxResults: 10 }, context);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      // Check that only 10 files are returned
      const lines = result.llmContent?.split('\n') || [];
      expect(lines.length).toBeLessThanOrEqual(10);
    });

    it('should handle no matches', async () => {
      vi.mocked(glob).mockResolvedValue([]);

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ pattern: '**/*.xyz' }, context);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeUndefined();
      expect(result.llmContent).toBe('');
      expect(result.returnDisplay).toContain('No files found');
    });

    it('should use specified working directory', async () => {
      vi.mocked(glob).mockResolvedValue(['file.ts']);

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation(
        { pattern: '*.ts', directory: '/test/dir' },
        context
      );
      await invocation.execute(abortSignal);

      expect(glob).toHaveBeenCalledWith('*.ts', expect.objectContaining({ cwd: '/test/dir' }));
    });

    it('should not require confirmation', async () => {
      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ pattern: '**/*.ts' }, context);
      const confirmation = await invocation.shouldConfirmExecute(abortSignal);

      expect(confirmation).toBe(false);
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      controller.abort();

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ pattern: '**/*.ts' }, context);
      const result = await invocation.execute(controller.signal);

      expect(result.error).toBeDefined();
      expect(result.error?.type).toBe('CancelledError');
    });

    it('should handle glob errors', async () => {
      vi.mocked(glob).mockRejectedValue(new Error('Glob error'));

      const context = createToolContext(mockMessageBus);
      const invocation = tool.createInvocation({ pattern: '**/*.ts' }, context);
      const result = await invocation.execute(abortSignal);

      expect(result.error).toBeDefined();
    });
  });
});
