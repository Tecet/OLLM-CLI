/**
 * Tests for Checkpoint Aging Consistency (Phase 6)
 * Verifies that checkpoint aging is called consistently and works correctly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckpointManager } from '../checkpointManager.js';
import type {
  ConversationContext,
  CompressionCheckpoint,
  TokenCounter,
  Message,
} from '../types.js';

describe('Checkpoint Aging (Phase 6)', () => {
  let checkpointManager: CheckpointManager;
  let context: ConversationContext;
  let mockTokenCounter: TokenCounter;
  let mockEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create mock context
    context = {
      messages: [],
      tokenCount: 0,
      checkpoints: [],
      metadata: {
        compressionHistory: [],
        sessionStart: new Date(),
        lastActivity: new Date(),
      },
    };

    // Create mock token counter
    mockTokenCounter = {
      countTokens: vi.fn().mockResolvedValue(100),
      countConversationTokens: vi.fn().mockReturnValue(100),
      countMessagesTokens: vi.fn().mockReturnValue(100),
    };

    // Create mock emit function
    mockEmit = vi.fn();

    // Create checkpoint manager
    checkpointManager = new CheckpointManager({
      getContext: () => context,
      tokenCounter: mockTokenCounter,
      emit: mockEmit,
    });
  });

  describe('Checkpoint Aging Logic', () => {
    it('should age Level 3 checkpoint to Level 2 after 3 compressions', async () => {
      // Create a Level 3 checkpoint
      const checkpoint: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 3,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: 'Detailed summary of conversation\nLine 2\nLine 3\nLine 4\nLine 5',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        compressionNumber: 0, // Created at compression 0
      };

      context.checkpoints = [checkpoint];

      // Simulate 3 compressions
      context.metadata.compressionHistory = [
        { timestamp: new Date(), strategy: 'summarize', originalTokens: 1000, compressedTokens: 500, ratio: 0.5 },
        { timestamp: new Date(), strategy: 'summarize', originalTokens: 1000, compressedTokens: 500, ratio: 0.5 },
        { timestamp: new Date(), strategy: 'summarize', originalTokens: 1000, compressedTokens: 500, ratio: 0.5 },
      ];

      // Run aging
      await checkpointManager.compressOldCheckpoints();

      // Verify checkpoint was aged to Level 2
      expect(context.checkpoints[0].level).toBe(2);
      expect(context.checkpoints[0].compressionCount).toBe(1);
      expect(context.checkpoints[0].summary.content).toContain('[Checkpoint Messages 1-10]');
    });

    it('should age Level 2 checkpoint to Level 1 after 6 compressions', async () => {
      // Create a Level 2 checkpoint
      const checkpoint: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 2,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: '[Checkpoint Messages 1-10]\nModerate summary\nLine 2\nLine 3',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 300,
        compressionCount: 1,
        compressionNumber: 0, // Created at compression 0
      };

      context.checkpoints = [checkpoint];

      // Simulate 6 compressions
      context.metadata.compressionHistory = Array(6).fill(null).map(() => ({
        timestamp: new Date(),
        strategy: 'summarize' as const,
        originalTokens: 1000,
        compressedTokens: 500,
        ratio: 0.5,
      }));

      // Run aging
      await checkpointManager.compressOldCheckpoints();

      // Verify checkpoint was aged to Level 1
      expect(context.checkpoints[0].level).toBe(1);
      expect(context.checkpoints[0].compressionCount).toBe(2);
      expect(context.checkpoints[0].summary.content).toContain('[Checkpoint Messages 1-10]');
      expect(context.checkpoints[0].summary.content.length).toBeLessThan(150); // Compact summary
    });

    it('should not age Level 1 checkpoint further', async () => {
      // Create a Level 1 checkpoint
      const checkpoint: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 1,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: '[Checkpoint Messages 1-10] Compact summary...',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 100,
        compressionCount: 2,
        compressionNumber: 0,
      };

      context.checkpoints = [checkpoint];

      // Simulate 10 compressions
      context.metadata.compressionHistory = Array(10).fill(null).map(() => ({
        timestamp: new Date(),
        strategy: 'summarize' as const,
        originalTokens: 1000,
        compressedTokens: 500,
        ratio: 0.5,
      }));

      // Run aging
      await checkpointManager.compressOldCheckpoints();

      // Verify checkpoint stayed at Level 1
      expect(context.checkpoints[0].level).toBe(1);
      expect(context.checkpoints[0].compressionCount).toBe(2); // No additional compression
    });

    it('should age multiple checkpoints independently', async () => {
      // Create checkpoints at different ages
      const checkpoint1: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 3,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: 'Old checkpoint\nLine 2\nLine 3\nLine 4\nLine 5',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        compressionNumber: 0, // Age: 6
      };

      const checkpoint2: CompressionCheckpoint = {
        id: 'checkpoint-2',
        level: 3,
        range: 'Messages 11-20',
        summary: {
          id: 'summary-2',
          role: 'system',
          content: 'Newer checkpoint\nLine 2\nLine 3\nLine 4\nLine 5',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        compressionNumber: 3, // Age: 3
      };

      const checkpoint3: CompressionCheckpoint = {
        id: 'checkpoint-3',
        level: 3,
        range: 'Messages 21-30',
        summary: {
          id: 'summary-3',
          role: 'system',
          content: 'Recent checkpoint\nLine 2\nLine 3\nLine 4\nLine 5',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        compressionNumber: 5, // Age: 1
      };

      context.checkpoints = [checkpoint1, checkpoint2, checkpoint3];

      // Simulate 6 compressions
      context.metadata.compressionHistory = Array(6).fill(null).map(() => ({
        timestamp: new Date(),
        strategy: 'summarize' as const,
        originalTokens: 1000,
        compressedTokens: 500,
        ratio: 0.5,
      }));

      // Run aging
      await checkpointManager.compressOldCheckpoints();

      // Verify aging:
      // checkpoint1: age 6 → Level 1 (compact)
      // checkpoint2: age 3 → Level 2 (moderate)
      // checkpoint3: age 1 → Level 3 (no change)
      expect(context.checkpoints[0].level).toBe(1); // Aged to compact
      expect(context.checkpoints[1].level).toBe(2); // Aged to moderate
      expect(context.checkpoints[2].level).toBe(3); // No change
    });

    it('should preserve key decisions in moderate summary', async () => {
      // Create a Level 3 checkpoint with key decisions
      const checkpoint: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 3,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: 'Detailed summary\nLine 2\nLine 3\nLine 4\nLine 5',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        compressionNumber: 0,
        keyDecisions: [
          'Use TypeScript for type safety',
          'Implement caching layer',
          'Add error handling',
        ],
      };

      context.checkpoints = [checkpoint];

      // Simulate 3 compressions
      context.metadata.compressionHistory = Array(3).fill(null).map(() => ({
        timestamp: new Date(),
        strategy: 'summarize' as const,
        originalTokens: 1000,
        compressedTokens: 500,
        ratio: 0.5,
      }));

      // Run aging
      await checkpointManager.compressOldCheckpoints();

      // Verify key decisions are preserved in moderate summary
      expect(context.checkpoints[0].level).toBe(2);
      expect(context.checkpoints[0].summary.content).toContain('Key Decisions:');
      expect(context.checkpoints[0].summary.content).toContain('Use TypeScript for type safety');
    });

    it('should update token count after aging', async () => {
      // Create a Level 3 checkpoint
      const checkpoint: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 3,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: 'Very long detailed summary with lots of content\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        compressionNumber: 0,
      };

      context.checkpoints = [checkpoint];

      // Simulate 6 compressions
      context.metadata.compressionHistory = Array(6).fill(null).map(() => ({
        timestamp: new Date(),
        strategy: 'summarize' as const,
        originalTokens: 1000,
        compressedTokens: 500,
        ratio: 0.5,
      }));

      // Mock token counter to return different values
      mockTokenCounter.countTokens = vi.fn().mockResolvedValue(50);

      // Run aging
      await checkpointManager.compressOldCheckpoints();

      // Verify token count was updated
      expect(mockTokenCounter.countTokens).toHaveBeenCalled();
      expect(context.checkpoints[0].currentTokens).toBe(50);
    });
  });

  describe('Checkpoint Merging', () => {
    it('should merge multiple checkpoints correctly', () => {
      const oldCheckpoint1: CompressionCheckpoint = {
        id: 'checkpoint-1',
        level: 2,
        range: 'Messages 1-10',
        summary: {
          id: 'summary-1',
          role: 'system',
          content: 'First checkpoint summary',
          timestamp: new Date(),
        },
        createdAt: new Date('2026-01-01'),
        originalTokens: 1000,
        currentTokens: 300,
        compressionCount: 1,
        keyDecisions: ['Decision 1', 'Decision 2'],
        filesModified: ['file1.ts', 'file2.ts'],
      };

      const oldCheckpoint2: CompressionCheckpoint = {
        id: 'checkpoint-2',
        level: 2,
        range: 'Messages 11-20',
        summary: {
          id: 'summary-2',
          role: 'system',
          content: 'Second checkpoint summary',
          timestamp: new Date(),
        },
        createdAt: new Date('2026-01-02'),
        originalTokens: 1000,
        currentTokens: 300,
        compressionCount: 1,
        keyDecisions: ['Decision 3'],
        filesModified: ['file3.ts'],
      };

      const targetCheckpoint: CompressionCheckpoint = {
        id: 'checkpoint-3',
        level: 3,
        range: 'Messages 21-30',
        summary: {
          id: 'summary-3',
          role: 'system',
          content: 'Target checkpoint summary',
          timestamp: new Date(),
        },
        createdAt: new Date('2026-01-03'),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        keyDecisions: ['Decision 4'],
        filesModified: ['file4.ts'],
      };

      const merged = checkpointManager.mergeCheckpoints(
        [oldCheckpoint1, oldCheckpoint2],
        targetCheckpoint
      );

      // Verify merged checkpoint
      expect(merged.id).toContain('merged-');
      expect(merged.level).toBe(2); // Min level
      expect(merged.range).toContain('Messages 1-10 to Messages 21-30');
      expect(merged.summary.content).toContain('[MERGED CHECKPOINT]');
      expect(merged.summary.content).toContain('First checkpoint summary');
      expect(merged.summary.content).toContain('Second checkpoint summary');
      expect(merged.summary.content).toContain('Target checkpoint summary');
      expect(merged.originalTokens).toBe(3000); // Sum of all
      expect(merged.currentTokens).toBe(1100); // Sum of all
      expect(merged.compressionCount).toBe(2); // Max + 1
      expect(merged.keyDecisions).toContain('Decision 1');
      expect(merged.keyDecisions).toContain('Decision 4');
      expect(merged.filesModified).toContain('file1.ts');
      expect(merged.filesModified).toContain('file4.ts');
    });

    it('should limit merged key decisions to 10', () => {
      const oldCheckpoints: CompressionCheckpoint[] = Array(5).fill(null).map((_, i) => ({
        id: `checkpoint-${i}`,
        level: 2,
        range: `Messages ${i * 10 + 1}-${(i + 1) * 10}`,
        summary: {
          id: `summary-${i}`,
          role: 'system' as const,
          content: `Summary ${i}`,
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 300,
        compressionCount: 1,
        keyDecisions: [`Decision ${i * 3 + 1}`, `Decision ${i * 3 + 2}`, `Decision ${i * 3 + 3}`],
        filesModified: [],
      }));

      const targetCheckpoint: CompressionCheckpoint = {
        id: 'checkpoint-target',
        level: 3,
        range: 'Messages 51-60',
        summary: {
          id: 'summary-target',
          role: 'system',
          content: 'Target summary',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        keyDecisions: ['Decision 16', 'Decision 17'],
        filesModified: [],
      };

      const merged = checkpointManager.mergeCheckpoints(oldCheckpoints, targetCheckpoint);

      // Verify key decisions are limited to 10
      expect(merged.keyDecisions).toBeDefined();
      expect(merged.keyDecisions!.length).toBeLessThanOrEqual(10);
    });

    it('should limit merged files to 20', () => {
      const oldCheckpoints: CompressionCheckpoint[] = Array(5).fill(null).map((_, i) => ({
        id: `checkpoint-${i}`,
        level: 2,
        range: `Messages ${i * 10 + 1}-${(i + 1) * 10}`,
        summary: {
          id: `summary-${i}`,
          role: 'system' as const,
          content: `Summary ${i}`,
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 300,
        compressionCount: 1,
        keyDecisions: [],
        filesModified: Array(6).fill(null).map((_, j) => `file${i * 6 + j}.ts`),
      }));

      const targetCheckpoint: CompressionCheckpoint = {
        id: 'checkpoint-target',
        level: 3,
        range: 'Messages 51-60',
        summary: {
          id: 'summary-target',
          role: 'system',
          content: 'Target summary',
          timestamp: new Date(),
        },
        createdAt: new Date(),
        originalTokens: 1000,
        currentTokens: 500,
        compressionCount: 0,
        keyDecisions: [],
        filesModified: ['file30.ts', 'file31.ts'],
      };

      const merged = checkpointManager.mergeCheckpoints(oldCheckpoints, targetCheckpoint);

      // Verify files are limited to 20
      expect(merged.filesModified).toBeDefined();
      expect(merged.filesModified!.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Never-Compressed Sections', () => {
    it('should preserve task definition', () => {
      context.taskDefinition = {
        goal: 'Build a feature',
        constraints: ['Use TypeScript'],
        timestamp: new Date(),
      };

      const preserved = checkpointManager.preserveNeverCompressed(context);

      expect(preserved).toHaveLength(1);
      expect(preserved[0].type).toBe('task_definition');
      expect(preserved[0].content).toContain('Build a feature');
    });

    it('should preserve architecture decisions', () => {
      context.architectureDecisions = [
        {
          id: 'decision-1',
          description: 'Use React for UI',
          rationale: 'Better ecosystem',
          timestamp: new Date(),
        },
        {
          id: 'decision-2',
          description: 'Use PostgreSQL',
          rationale: 'ACID compliance',
          timestamp: new Date(),
        },
      ];

      const preserved = checkpointManager.preserveNeverCompressed(context);

      expect(preserved).toHaveLength(2);
      expect(preserved[0].type).toBe('architecture_decision');
      expect(preserved[0].content).toContain('Use React for UI');
      expect(preserved[1].type).toBe('architecture_decision');
      expect(preserved[1].content).toContain('Use PostgreSQL');
    });

    it('should reconstruct never-compressed sections as system messages', () => {
      const sections = [
        {
          type: 'task_definition' as const,
          content: '{"goal":"Build feature","constraints":[]}',
          timestamp: new Date(),
        },
        {
          type: 'architecture_decision' as const,
          content: '{"id":"decision-1","description":"Use TypeScript"}',
          timestamp: new Date(),
          metadata: { id: 'decision-1' },
        },
      ];

      const messages = checkpointManager.reconstructNeverCompressed(sections);

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[0].content).toContain('[task_definition]');
      expect(messages[1].role).toBe('system');
      expect(messages[1].content).toContain('[architecture_decision]');
    });
  });

  describe('Critical Info Extraction', () => {
    it('should extract file modifications from messages', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'I created file1.ts and modified file2.js',
          timestamp: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Updated config.json and changed utils.ts',
          timestamp: new Date(),
        },
      ];

      const modeProfile = {
        name: 'code',
        extractionRules: {},
        neverCompress: [],
      };

      const { files } = checkpointManager.extractCriticalInfo(messages, modeProfile);

      expect(files).toContain('file1.ts');
      expect(files).toContain('file2.js');
      expect(files).toContain('config.json');
      expect(files).toContain('utils.ts');
    });

    it('should limit extracted files to 10', () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: Array(15).fill(null).map((_, i) => `modified file${i}.ts`).join(' and '),
          timestamp: new Date(),
        },
      ];

      const modeProfile = {
        name: 'code',
        extractionRules: {},
        neverCompress: [],
      };

      const { files } = checkpointManager.extractCriticalInfo(messages, modeProfile);

      expect(files.length).toBeLessThanOrEqual(10);
    });
  });
});
