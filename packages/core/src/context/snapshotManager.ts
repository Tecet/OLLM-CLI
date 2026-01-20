/**
 * Snapshot Manager Service
 * 
 * Manages context snapshots including creation, restoration, listing, deletion,
 * automatic snapshot triggers, and rolling cleanup.
 */

import { randomUUID } from 'crypto';
import type {
  SnapshotManager,
  ContextSnapshot,
  ConversationContext,
  SnapshotStorage,
  SnapshotConfig
} from './types.js';

/**
 * Threshold callback function
 */
type ThresholdCallback = () => void;

/**
 * Implementation of snapshot manager
 */
export class SnapshotManagerImpl implements SnapshotManager {
  private storage: SnapshotStorage;
  private config: SnapshotConfig;
  private thresholdCallbacks: Map<number, ThresholdCallback[]> = new Map();
  private overflowCallbacks: ThresholdCallback[] = [];
  private currentSessionId: string | null = null;

  constructor(storage: SnapshotStorage, config: SnapshotConfig) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * Set the current session ID
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Get the current session ID
   */
  private getSessionId(): string {
    if (!this.currentSessionId) {
      throw new Error('Session ID not set. Call setSessionId() first.');
    }
    return this.currentSessionId;
  }

  /**
   * Create snapshot from current context
   */
  async createSnapshot(context: ConversationContext): Promise<ContextSnapshot> {
    if (!this.config.enabled) {
      throw new Error('Snapshots are disabled in configuration');
    }

    // Generate unique ID
    const id = randomUUID();

    // Create summary from first and last messages
    const summary = this.generateSummary(context);

    // Create snapshot
    const snapshot: ContextSnapshot = {
      id,
      sessionId: context.sessionId,
      timestamp: new Date(),
      tokenCount: context.tokenCount,
      summary,
      messages: [...context.messages], // Clone messages
      metadata: {
        model: context.metadata.model,
        contextSize: context.metadata.contextSize,
        compressionRatio: this.calculateCompressionRatio(context)
      }
    };

    // Save to storage
    await this.storage.save(snapshot);

    // Perform rolling cleanup if needed
    if (this.config.maxCount > 0) {
      await this.cleanupOldSnapshots(this.config.maxCount);
    }

    return snapshot;
  }

  /**
   * Restore context from snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<ConversationContext> {
    // Load snapshot from storage
    const snapshot = await this.storage.load(snapshotId);

    // Reconstruct conversation context
    const context: ConversationContext = {
      sessionId: snapshot.sessionId,
      messages: [...snapshot.messages], // Clone messages
      systemPrompt: snapshot.messages.find(m => m.role === 'system') || {
        id: randomUUID(),
        role: 'system',
        content: '',
        timestamp: new Date()
      },
      tokenCount: snapshot.tokenCount,
      maxTokens: snapshot.metadata.contextSize,
      metadata: {
        model: snapshot.metadata.model,
        contextSize: snapshot.metadata.contextSize,
        compressionHistory: []
      }
    };

    return context;
  }

  /**
   * List snapshots for a session
   */
  async listSnapshots(sessionId: string): Promise<ContextSnapshot[]> {
    const metadata = await this.storage.list(sessionId);
    
    // Load full snapshots
    const snapshots: ContextSnapshot[] = [];
    for (const meta of metadata) {
      try {
        const snapshot = await this.storage.load(meta.id);
        snapshots.push(snapshot);
      } catch (error) {
        // Skip corrupted snapshots
        console.warn(`Failed to load snapshot ${meta.id}: ${(error as Error).message}`);
      }
    }

    return snapshots;
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.storage.delete(snapshotId);
  }

  /**
   * Register threshold callback
   */
  onContextThreshold(threshold: number, callback: ThresholdCallback): void {
    if (!this.thresholdCallbacks.has(threshold)) {
      this.thresholdCallbacks.set(threshold, []);
    }
    this.thresholdCallbacks.get(threshold)!.push(callback);
  }

  /**
   * Register pre-overflow callback
   */
  onBeforeOverflow(callback: ThresholdCallback): void {
    this.overflowCallbacks.push(callback);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SnapshotConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): SnapshotConfig {
    return { ...this.config };
  }

  /**
   * Check context usage and trigger callbacks if needed
   */
  checkThresholds(currentTokens: number, maxTokens: number): void {
    const usage = currentTokens / maxTokens;
    // Check pre-overflow threshold (95%)
    if (usage >= 0.95) {
      this.overflowCallbacks.forEach(cb => cb());
    }

    // Check all registered thresholds (this includes autoThreshold if configured)
    for (const [threshold, callbacks] of this.thresholdCallbacks.entries()) {
      if (this.config.autoCreate === false && threshold === this.config.autoThreshold) {
        // Skip autoThreshold if autoCreate is disabled
        continue;
      }

      if (usage >= threshold) {
        callbacks.forEach(cb => cb());
      }
    }
  }

  /**
   * Cleanup old snapshots, keeping only the most recent maxCount
   */
  async cleanupOldSnapshots(maxCount: number): Promise<void> {
    const sessionId = this.getSessionId();
    const metadata = await this.storage.list(sessionId);

    // Sort by timestamp (newest first)
    const sorted = [...metadata].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Delete snapshots beyond maxCount
    if (sorted.length > maxCount) {
      const toDelete = sorted.slice(maxCount);
      
      for (const meta of toDelete) {
        try {
          await this.storage.delete(meta.id);
        } catch (error) {
          console.warn(`Failed to delete snapshot ${meta.id}: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Generate summary from context
   */
  private generateSummary(context: ConversationContext): string {
    const userMessages = context.messages.filter(m => m.role === 'user');
    
    if (userMessages.length === 0) {
      return 'Empty conversation';
    }

    if (userMessages.length === 1) {
      return this.truncateText(userMessages[0].content, 100);
    }

    // Use first and last user messages
    const first = this.truncateText(userMessages[0].content, 50);
    const last = this.truncateText(userMessages[userMessages.length - 1].content, 50);
    
    return `${first} ... ${last}`;
  }

  /**
   * Truncate text to max length
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Calculate compression ratio from context
   */
  private calculateCompressionRatio(context: ConversationContext): number {
    if (context.metadata.compressionHistory.length === 0) {
      return 1.0;
    }

    // Use the most recent compression ratio
    const lastCompression = context.metadata.compressionHistory[
      context.metadata.compressionHistory.length - 1
    ];
    
    return lastCompression.ratio;
  }
}

/**
 * Create a new snapshot manager instance
 */
export function createSnapshotManager(
  storage: SnapshotStorage,
  config: SnapshotConfig
): SnapshotManager {
  return new SnapshotManagerImpl(storage, config);
}
