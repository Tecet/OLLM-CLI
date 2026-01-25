/**
 * CheckpointManager
 *
 * Manages never-compressed sections and checkpoint compaction rules.
 */
import type {
  ArchitectureDecision,
  CompressionCheckpoint,
  ConversationContext,
  Message,
  ModeProfile,
  NeverCompressedSection,
  TaskDefinition,
  TokenCounter,
} from './types.js';

type EmitFn = (event: string, payload?: unknown) => void;

interface CheckpointManagerOptions {
  getContext: () => ConversationContext;
  tokenCounter: TokenCounter;
  emit: EmitFn;
}

export class CheckpointManager {
  private readonly getContext: () => ConversationContext;
  private readonly tokenCounter: TokenCounter;
  private readonly emit: EmitFn;

  constructor(options: CheckpointManagerOptions) {
    this.getContext = options.getContext;
    this.tokenCounter = options.tokenCounter;
    this.emit = options.emit;
  }

  setTaskDefinition(task: TaskDefinition): void {
    const context = this.getContext();
    if (!context.taskDefinition) {
      context.taskDefinition = task;
      this.emit('task-defined', { task });
    }
  }

  addArchitectureDecision(decision: ArchitectureDecision): void {
    const context = this.getContext();
    if (!context.architectureDecisions) {
      context.architectureDecisions = [];
    }
    context.architectureDecisions.push(decision);
    this.emit('architecture-decision', { decision });
  }

  addNeverCompressed(section: NeverCompressedSection): void {
    const context = this.getContext();
    if (!context.neverCompressed) {
      context.neverCompressed = [];
    }
    context.neverCompressed.push(section);
    this.emit('never-compressed-added', { section });
  }

  /**
   * Serialize never-compressed sections for later reconstruction.
   */
  preserveNeverCompressed(context: ConversationContext): NeverCompressedSection[] {
    const preserved: NeverCompressedSection[] = [];

    if (context.taskDefinition) {
      preserved.push({
        type: 'task_definition',
        content: JSON.stringify(context.taskDefinition),
        timestamp: context.taskDefinition.timestamp
      });
    }

    if (context.architectureDecisions) {
      for (const decision of context.architectureDecisions) {
        preserved.push({
          type: 'architecture_decision',
          content: JSON.stringify(decision),
          timestamp: decision.timestamp,
          metadata: { id: decision.id }
        });
      }
    }

    if (context.neverCompressed) {
      preserved.push(...context.neverCompressed);
    }

    return preserved;
  }

  /**
   * Rehydrate serialized sections into system messages.
   */
  reconstructNeverCompressed(sections: NeverCompressedSection[]): Message[] {
    return sections.map(section => ({
      id: `never-compressed-${section.type}-${section.timestamp?.getTime() || Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      role: 'system' as const,
      content: `[${section.type}]\n${section.content}`,
      timestamp: section.timestamp || new Date()
    }));
  }

  /**
   * Merge multiple checkpoints into a compact summary checkpoint.
   */
  mergeCheckpoints(
    oldCheckpoints: CompressionCheckpoint[],
    targetCheckpoint: CompressionCheckpoint
  ): CompressionCheckpoint {
    const allSummaries = [
      ...oldCheckpoints.map(cp => cp.summary.content),
      targetCheckpoint.summary.content
    ].join('\n\n---\n\n');

    const allDecisions = [
      ...oldCheckpoints.flatMap(cp => cp.keyDecisions || []),
      ...(targetCheckpoint.keyDecisions || [])
    ];
    const allFiles = [
      ...oldCheckpoints.flatMap(cp => cp.filesModified || []),
      ...(targetCheckpoint.filesModified || [])
    ];

    const firstRange = oldCheckpoints[0]?.range || targetCheckpoint.range;
    const lastRange = targetCheckpoint.range;
    const combinedRange = `${firstRange} to ${lastRange}`;

    const totalOriginalTokens = oldCheckpoints.reduce((sum, cp) => sum + cp.originalTokens, 0) + targetCheckpoint.originalTokens;
    const totalCurrentTokens = oldCheckpoints.reduce((sum, cp) => sum + cp.currentTokens, 0) + targetCheckpoint.currentTokens;

    return {
      id: `merged-${Date.now()}`,
      level: Math.min(...oldCheckpoints.map(cp => cp.level), targetCheckpoint.level),
      range: combinedRange,
      summary: {
        id: `merged-summary-${Date.now()}`,
        role: 'system' as const,
        content: `[MERGED CHECKPOINT]\n${allSummaries}`,
        timestamp: oldCheckpoints[oldCheckpoints.length - 1]?.summary.timestamp || new Date()
      },
      createdAt: oldCheckpoints[0]?.createdAt || targetCheckpoint.createdAt,
      compressedAt: new Date(),
      originalTokens: totalOriginalTokens,
      currentTokens: totalCurrentTokens,
      compressionCount: Math.max(...oldCheckpoints.map(cp => cp.compressionCount), targetCheckpoint.compressionCount) + 1,
      keyDecisions: Array.from(new Set(allDecisions)).slice(0, 10),
      filesModified: Array.from(new Set(allFiles)).slice(0, 20)
    };
  }

  /**
   * Extract mode-specific highlights to persist across compression.
   */
  extractCriticalInfo(messages: Message[], modeProfile: ModeProfile): { decisions: string[]; files: string[] } {
    const decisions: string[] = [];
    const files: string[] = [];

    const rules = modeProfile.extractionRules;
    if (!rules) {
      return { decisions, files };
    }

    for (const message of messages) {
      for (const [type, pattern] of Object.entries(rules)) {
        const matches = message.content.match(pattern);
        if (matches && modeProfile.neverCompress.includes(type)) {
          decisions.push(matches[0]);
        }
      }

      const filePattern = /(?:created|modified|updated|changed)\s+([^\s]+\.\w+)/gi;
      let fileMatch;
      while ((fileMatch = filePattern.exec(message.content)) !== null) {
        files.push(fileMatch[1]);
      }
    }

    return {
      decisions: Array.from(new Set(decisions)).slice(0, 5),
      files: Array.from(new Set(files)).slice(0, 10)
    };
  }

  /**
   * Downgrade older checkpoints to moderate/compact summaries.
   */
  async compressOldCheckpoints(): Promise<void> {
    const context = this.getContext();
    if (!context.checkpoints || context.checkpoints.length === 0) {
      return;
    }

    const MODERATE_AGE = 3;
    const COMPACT_AGE = 6;
    const totalCompressions = context.metadata.compressionHistory.length;

    console.log('[ContextManager] compressOldCheckpoints:', {
      totalCompressions,
      checkpointCount: context.checkpoints.length
    });

    for (const checkpoint of context.checkpoints) {
      let age = 0;

      if (checkpoint.compressionNumber !== undefined) {
        age = totalCompressions - checkpoint.compressionNumber;
      } else {
        const checkpointIndex = context.metadata.compressionHistory.findIndex(
          h => h.timestamp >= checkpoint.createdAt
        );
        age = checkpointIndex >= 0 ? totalCompressions - checkpointIndex : totalCompressions;
      }

      console.log('[ContextManager] Checkpoint age:', {
        checkpointId: checkpoint.id,
        level: checkpoint.level,
        age,
        compressionNumber: checkpoint.compressionNumber,
        totalCompressions
      });

      if (age >= COMPACT_AGE && checkpoint.level !== 1) {
        console.log('[ContextManager] Compressing checkpoint to COMPACT:', checkpoint.id);
        checkpoint.level = 1;
        checkpoint.compressedAt = new Date();
        checkpoint.compressionCount++;

        const originalContent = checkpoint.summary.content;
        checkpoint.summary.content = this.createCompactSummary(originalContent, checkpoint);

        const newTokens = await this.tokenCounter.countTokens(checkpoint.summary.content);
        checkpoint.currentTokens = newTokens;
      } else if (age >= MODERATE_AGE && checkpoint.level === 3) {
        console.log('[ContextManager] Compressing checkpoint to MODERATE:', checkpoint.id);
        checkpoint.level = 2;
        checkpoint.compressedAt = new Date();
        checkpoint.compressionCount++;

        const originalContent = checkpoint.summary.content;
        checkpoint.summary.content = this.createModerateSummary(originalContent, checkpoint);

        const newTokens = await this.tokenCounter.countTokens(checkpoint.summary.content);
        checkpoint.currentTokens = newTokens;
      }
    }
  }

  private createCompactSummary(originalContent: string, checkpoint: CompressionCheckpoint): string {
    const lines = originalContent.split('\n');
    const firstLine = lines[0] || '';
    return `[Checkpoint ${checkpoint.range}] ${firstLine.substring(0, 100)}...`;
  }

  private createModerateSummary(originalContent: string, checkpoint: CompressionCheckpoint): string {
    const lines = originalContent.split('\n');
    const summary = lines.slice(0, 5).join('\n');

    let result = `[Checkpoint ${checkpoint.range}]\n${summary}`;

    if (checkpoint.keyDecisions && checkpoint.keyDecisions.length > 0) {
      result += `\n\nKey Decisions:\n${checkpoint.keyDecisions.slice(0, 3).join('\n')}`;
    }

    return result;
  }
}
