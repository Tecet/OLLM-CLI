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
  SnapshotConfig,
  Message
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
  
  // Epsilon for floating-point threshold comparisons
  private static readonly THRESHOLD_EPSILON = 0.0001;

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

    // DEBUG: Write debug info to file
    try {
      const fs = await import('fs/promises');
      const debugInfo = {
        timestamp: new Date().toISOString(),
        snapshotId: id,
        contextMessages: {
          total: context.messages.length,
          byRole: {
            user: context.messages.filter(m => m.role === 'user').length,
            assistant: context.messages.filter(m => m.role === 'assistant').length,
            system: context.messages.filter(m => m.role === 'system').length,
            tool: context.messages.filter(m => m.role === 'tool').length
          },
          details: context.messages.map(m => ({
            role: m.role,
            id: m.id,
            contentLength: m.content.length,
            preview: m.content.substring(0, 100)
          }))
        }
      };
      await fs.writeFile('snapshot-debug.json', JSON.stringify(debugInfo, null, 2));
    } catch {
      // Ignore debug errors
    }

    // CRITICAL FIX: Keep ALL user messages in full (never compress!)
    const allUserMessages = context.messages
      .filter(m => m.role === 'user')
      .map(m => ({
        id: m.id,
        role: 'user' as const,
        content: m.content, // FULL content - never truncate!
        timestamp: m.timestamp,
        tokenCount: m.tokenCount,
        taskId: undefined
      }));

    // Other messages (system, assistant, tool) - exclude user messages
    const otherMessages = context.messages.filter(m => m.role !== 'user');

    // Create summary from first and last messages
    const summary = this.generateSummary(context);

    // Create snapshot
    const snapshot: ContextSnapshot = {
      id,
      sessionId: context.sessionId,
      timestamp: new Date(),
      tokenCount: context.tokenCount,
      summary,
      userMessages: allUserMessages, // ALL user messages, not just recent 10
      archivedUserMessages: [], // No archiving - keep everything
      messages: [...otherMessages], // Clone messages (no user messages)
      goalStack: context.goalStack, // Include goal stack
      reasoningStorage: context.reasoningStorage, // Include reasoning traces
      metadata: {
        model: context.metadata.model,
        contextSize: context.metadata.contextSize,
        compressionRatio: this.calculateCompressionRatio(context),
        totalUserMessages: allUserMessages.length,
        // Add goal-related metadata
        activeGoalId: context.goalStack?.activeGoal?.id,
        totalGoalsCompleted: context.goalStack?.stats.completedGoals || 0,
        totalCheckpoints: context.goalStack?.stats.totalCheckpoints || 0,
        // Add reasoning-related metadata
        isReasoningModel: !!context.reasoningStorage,
        totalThinkingTokens: context.reasoningStorage?.totalThinkingTokens || 0,
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

    // Handle old snapshots without userMessages field (migration)
    let userMessages: Message[] = [];
    let otherMessages: Message[] = [];

    if ('userMessages' in snapshot && snapshot.userMessages) {
      // New format: user messages separated
      userMessages = snapshot.userMessages.map(um => ({
        id: um.id,
        role: 'user' as const,
        content: um.content,
        timestamp: um.timestamp,
        tokenCount: um.tokenCount
      }));
      otherMessages = snapshot.messages;
    } else {
      // Old format: extract user messages from mixed messages
      userMessages = snapshot.messages.filter(m => m.role === 'user');
      otherMessages = snapshot.messages.filter(m => m.role !== 'user');
    }

    // Merge user messages + other messages in chronological order
    const allMessages = [...userMessages, ...otherMessages]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Reconstruct conversation context
    const context: ConversationContext = {
      sessionId: snapshot.sessionId,
      messages: allMessages,
      systemPrompt: allMessages.find(m => m.role === 'system') || {
        id: randomUUID(),
        role: 'system',
        content: '',
        timestamp: new Date()
      },
      tokenCount: snapshot.tokenCount,
      maxTokens: snapshot.metadata.contextSize,
      goalStack: snapshot.goalStack, // Restore goal stack
      reasoningStorage: snapshot.reasoningStorage, // Restore reasoning traces
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
    const callbacks = this.thresholdCallbacks.get(threshold)!;
    // Deduplicate: only add if not already registered
    if (!callbacks.includes(callback)) {
      callbacks.push(callback);
    }
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
    for (const [threshold, callbacks] of Array.from(this.thresholdCallbacks.entries())) {
      // Use epsilon comparison for floating-point thresholds to avoid precision issues
      if (this.config.autoCreate === false && 
          Math.abs(threshold - this.config.autoThreshold) < SnapshotManagerImpl.THRESHOLD_EPSILON) {
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
