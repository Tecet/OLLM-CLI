/**
 * Session History Manager
 * 
 * Manages the complete, uncompressed conversation history for a session.
 * This is the source of truth for what actually happened in the conversation.
 * 
 * **Critical Rules:**
 * 1. Messages are NEVER compressed or removed from history
 * 2. History is NEVER sent to the LLM (only for record-keeping)
 * 3. History is append-only (messages never modified)
 * 4. History is persisted to disk for permanent record
 * 
 * @module sessionHistoryManager
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { SessionHistory, CheckpointRecord } from '../types/storageTypes.js';
import type { Message } from '../types.js';

/**
 * Session History Manager
 * 
 * Stores the complete, uncompressed conversation history.
 * This is NEVER sent to the LLM and NEVER compressed.
 * 
 * @example
 * ```typescript
 * const manager = new SessionHistoryManager('session-123', '/path/to/storage');
 * 
 * // Append messages
 * manager.appendMessage(userMessage);
 * manager.appendMessage(assistantMessage);
 * 
 * // Record checkpoint creation
 * manager.recordCheckpoint({
 *   id: 'ckpt-1',
 *   timestamp: Date.now(),
 *   messageRange: [0, 10],
 *   originalTokens: 2500,
 *   compressedTokens: 300,
 *   compressionRatio: 0.12,
 *   level: 3
 * });
 * 
 * // Save to disk
 * await manager.save();
 * 
 * // Export to markdown
 * const markdown = manager.exportToMarkdown();
 * ```
 */
export class SessionHistoryManager {
  private history: SessionHistory;
  private storagePath: string;

  /**
   * Create a new session history manager
   * 
   * @param sessionId - Unique session identifier
   * @param storagePath - Directory path for storing session history
   */
  constructor(sessionId: string, storagePath: string) {
    this.storagePath = storagePath;
    this.history = {
      sessionId,
      messages: [],
      checkpointRecords: [],
      metadata: {
        startTime: Date.now(),
        lastUpdate: Date.now(),
        totalMessages: 0,
        totalTokens: 0,
        compressionCount: 0,
      },
    };
  }

  /**
   * Append message to history
   * 
   * Messages are NEVER compressed or removed from history.
   * This is an append-only operation.
   * 
   * @param message - Message to append
   * 
   * @example
   * ```typescript
   * manager.appendMessage({
   *   id: 'msg-1',
   *   role: 'user',
   *   content: 'Hello!',
   *   timestamp: Date.now()
   * });
   * ```
   */
  appendMessage(message: Message): void {
    this.history.messages.push(message);
    this.history.metadata.totalMessages++;
    this.history.metadata.totalTokens += this.estimateTokens(message);
    this.history.metadata.lastUpdate = Date.now();
  }

  /**
   * Record checkpoint creation
   * 
   * Records metadata about when and how a checkpoint was created.
   * This does NOT include the actual summary (that's in CheckpointSummary).
   * 
   * @param record - Checkpoint record metadata
   * 
   * @example
   * ```typescript
   * manager.recordCheckpoint({
   *   id: 'ckpt-1',
   *   timestamp: Date.now(),
   *   messageRange: [0, 10],
   *   originalTokens: 2500,
   *   compressedTokens: 300,
   *   compressionRatio: 0.12,
   *   level: 3
   * });
   * ```
   */
  recordCheckpoint(record: CheckpointRecord): void {
    this.history.checkpointRecords.push(record);
    this.history.metadata.compressionCount++;
    this.history.metadata.lastUpdate = Date.now();
  }

  /**
   * Get full history
   * 
   * Returns a deep copy of the complete session history.
   * Modifications to the returned object will not affect the internal state.
   * 
   * @returns Complete session history
   * 
   * @example
   * ```typescript
   * const history = manager.getHistory();
   * console.log(`Session has ${history.messages.length} messages`);
   * ```
   */
  getHistory(): SessionHistory {
    return {
      ...this.history,
      messages: this.history.messages.map(msg => ({ ...msg })),
      checkpointRecords: this.history.checkpointRecords.map(rec => ({ ...rec, messageRange: [...rec.messageRange] as [number, number] })),
      metadata: { ...this.history.metadata },
    };
  }

  /**
   * Save history to disk
   * 
   * Persists the complete session history to a JSON file.
   * Creates the storage directory if it doesn't exist.
   * 
   * @throws Error if file write fails
   * 
   * @example
   * ```typescript
   * await manager.save();
   * ```
   */
  async save(): Promise<void> {
    // Ensure storage directory exists
    await fs.mkdir(this.storagePath, { recursive: true });

    const filePath = path.join(
      this.storagePath,
      `${this.history.sessionId}.json`
    );

    await fs.writeFile(
      filePath,
      JSON.stringify(this.history, null, 2),
      'utf-8'
    );
  }

  /**
   * Load history from disk
   * 
   * Loads a session history from a JSON file.
   * Replaces the current history with the loaded data.
   * 
   * @param sessionId - Session ID to load
   * @returns Loaded session history
   * @throws Error if file doesn't exist or is invalid
   * 
   * @example
   * ```typescript
   * const history = await manager.load('session-123');
   * ```
   */
  async load(sessionId: string): Promise<SessionHistory> {
    const filePath = path.join(this.storagePath, `${sessionId}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      this.history = JSON.parse(data);
      return this.getHistory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Session history not found: ${sessionId}`);
      }
      throw new Error(
        `Failed to load session history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Export history to markdown
   * 
   * Generates a human-readable markdown document of the conversation.
   * Includes session metadata, messages, and checkpoint records.
   * 
   * @returns Markdown string
   * 
   * @example
   * ```typescript
   * const markdown = manager.exportToMarkdown();
   * await fs.writeFile('conversation.md', markdown);
   * ```
   */
  exportToMarkdown(): string {
    let md = `# Session ${this.history.sessionId}\n\n`;

    // Session metadata
    md += `## Session Information\n\n`;
    md += `- **Started:** ${new Date(this.history.metadata.startTime).toISOString()}\n`;
    md += `- **Last Updated:** ${new Date(this.history.metadata.lastUpdate).toISOString()}\n`;
    md += `- **Total Messages:** ${this.history.metadata.totalMessages}\n`;
    md += `- **Total Tokens:** ${this.history.metadata.totalTokens}\n`;
    md += `- **Compressions:** ${this.history.metadata.compressionCount}\n\n`;

    // Checkpoint records
    if (this.history.checkpointRecords.length > 0) {
      md += `## Compression History\n\n`;
      for (const record of this.history.checkpointRecords) {
        md += `### Checkpoint ${record.id}\n\n`;
        md += `- **Time:** ${new Date(record.timestamp).toISOString()}\n`;
        md += `- **Message Range:** [${record.messageRange[0]}, ${record.messageRange[1]}]\n`;
        md += `- **Original Tokens:** ${record.originalTokens}\n`;
        md += `- **Compressed Tokens:** ${record.compressedTokens}\n`;
        md += `- **Compression Ratio:** ${(record.compressionRatio * 100).toFixed(1)}%\n`;
        md += `- **Level:** ${record.level} (${this.getLevelName(record.level)})\n\n`;
      }
    }

    // Messages
    md += `## Conversation\n\n`;
    for (const message of this.history.messages) {
      const timestamp = new Date(message.timestamp).toISOString();
      const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);

      md += `### ${role} (${timestamp})\n\n`;
      md += `${message.content}\n\n`;

      // Add separator between messages
      md += `---\n\n`;
    }

    return md;
  }

  /**
   * Get human-readable compression level name
   * 
   * @param level - Compression level (1, 2, or 3)
   * @returns Level name
   */
  private getLevelName(level: 1 | 2 | 3): string {
    switch (level) {
      case 1:
        return 'Compact';
      case 2:
        return 'Moderate';
      case 3:
        return 'Detailed';
    }
  }

  /**
   * Estimate token count for a message
   * 
   * Simple estimation: ~4 characters per token
   * This is just for metadata tracking, not for actual compression decisions.
   * 
   * @param message - Message to estimate
   * @returns Estimated token count
   */
  private estimateTokens(message: Message): number {
    return Math.ceil(message.content.length / 4);
  }
}
