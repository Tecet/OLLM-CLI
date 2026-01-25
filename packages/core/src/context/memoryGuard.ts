/**
 * Memory Guard Service
 * 
 * Monitors memory thresholds and prevents out-of-memory errors by triggering
 * appropriate actions at different memory levels (80%, 90%, 95%).
 */

import { EventEmitter } from 'events';

import {
  MemoryLevel
} from './types.js';
import { createLogger } from '../utils/logger.js';

import type {
  MemoryGuard,
  VRAMMonitor,
  ContextPool,
  SnapshotManager,
  ICompressionService,
  ConversationContext,
  MemoryGuardConfig
} from './types.js';

const logger = createLogger('memoryGuard');

/**
 * Default memory guard configuration
 */
const DEFAULT_CONFIG: MemoryGuardConfig = {
  safetyBuffer: 512 * 1024 * 1024, // 512MB
  thresholds: {
    soft: 0.8,      // 80% - Trigger compression
    hard: 0.9,      // 90% - Force context reduction
    critical: 0.95  // 95% - Emergency snapshot + clear
  }
};

/**
 * Memory Guard Implementation
 * 
 * Monitors memory usage and triggers actions at different threshold levels:
 * - 80% (soft): Trigger automatic compression
 * - 90% (hard): Force context size reduction
 * - 95% (critical): Create emergency snapshot and clear context
 */
export class MemoryGuardImpl extends EventEmitter implements MemoryGuard {
  private config: MemoryGuardConfig;
  private vramMonitor: VRAMMonitor;
  private contextPool: ContextPool;
  private snapshotManager?: SnapshotManager;
  private compressionService?: ICompressionService;
  private thresholdCallbacks: Map<MemoryLevel, Array<() => void | Promise<void>>> = new Map();
  private currentContext?: ConversationContext;

  constructor(
    vramMonitor: VRAMMonitor,
    contextPool: ContextPool,
    config: Partial<MemoryGuardConfig> = {}
  ) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.vramMonitor = vramMonitor;
    this.contextPool = contextPool;

    // Initialize callback maps
    this.thresholdCallbacks.set(MemoryLevel.NORMAL, []);
    this.thresholdCallbacks.set(MemoryLevel.WARNING, []);
    this.thresholdCallbacks.set(MemoryLevel.CRITICAL, []);
    this.thresholdCallbacks.set(MemoryLevel.EMERGENCY, []);
  }

  /**
   * Set optional services for advanced memory management
   */
  setServices(services: { compression: ICompressionService; snapshot: SnapshotManager }): void {
    this.snapshotManager = services.snapshot;
    this.compressionService = services.compression;
  }

  /**
   * Set current conversation context (needed for emergency actions)
   */
  setContext(context: ConversationContext): void {
    this.currentContext = context;
  }

  /**
   * Check if allocation is safe
   * Returns true only if allocation would not exceed the soft limit (80%)
   */
  canAllocate(requestedTokens: number): boolean {
    const usage = this.contextPool.getUsage();
    const newTokenCount = usage.currentTokens + requestedTokens;
    const newPercentage = (newTokenCount / usage.maxTokens);

    // Include safety buffer in calculation
    const safeLimit = this.getSafeLimit();
    const wouldExceedSafeLimit = newTokenCount > safeLimit;

    return !wouldExceedSafeLimit && newPercentage < this.config.thresholds.soft;
  }

  /**
   * Get safe allocation limit
   * Applies soft threshold (80%) and safety buffer
   */
  getSafeLimit(): number {
    const usage = this.contextPool.getUsage();
    
    // Calculate soft limit based on max tokens
    const softLimitTokens = Math.floor(usage.maxTokens * this.config.thresholds.soft);
    
    // The safety buffer is already accounted for in the context pool's calculations
    // (it's subtracted from available VRAM when calculating optimal size)
    // So we just return the soft limit here
    return softLimitTokens;
  }

  /**
   * Handle memory threshold events
   * Register callbacks for different memory levels
   */
  onThreshold(level: MemoryLevel, callback: () => void | Promise<void>): void {
    const callbacks = this.thresholdCallbacks.get(level);
    if (callbacks) {
      callbacks.push(callback);
    }
  }

  /**
   * Check current memory level and return it
   */
  checkMemoryLevel(): MemoryLevel {
    const usage = this.contextPool.getUsage();
    const percentage = usage.percentage / 100; // Convert to 0-1 range
    return this.determineMemoryLevel(percentage);
  }

  /**
   * Check current memory level and trigger appropriate actions
   */
  async checkMemoryLevelAndAct(): Promise<void> {
    const level = this.checkMemoryLevel();

    // Trigger callbacks for this level
    const callbacks = this.thresholdCallbacks.get(level);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          await cb();
        } catch (error) {
          logger.error(`Error in memory guard threshold callback for ${level}:`, error);
        }
      }
    }

    // Trigger automatic actions based on level
    switch (level) {
      case MemoryLevel.WARNING:
        // Attempt automatic compression when available
        this.emit('threshold-reached', { level, percentage: this.contextPool.getUsage().percentage });
        if (this.compressionService && this.currentContext) {
          try {
            const strategy = { type: 'hybrid', preserveRecent: Math.floor(this.currentContext.maxTokens ? this.currentContext.maxTokens * 0.3 : 4096), summaryMaxTokens: 1024 } as any;
            const compressed = await this.compressionService.compress(this.currentContext.messages, strategy as any);
            // Apply compression results if successful
            if (compressed && compressed.preserved) {
              // Rebuild messages: preserved messages + summary as assistant/system if present
              const preserved = compressed.preserved || [];
              const summaryMsg = compressed.summary ? [{ id: compressed.summary.id || 'summary', role: compressed.summary.role || 'assistant', content: compressed.summary.content || '', timestamp: compressed.summary.timestamp || new Date() }] : [];
              this.currentContext.messages = [...preserved, ...summaryMsg];
              this.currentContext.tokenCount = compressed.compressedTokens || this.currentContext.messages.length;
              // Sync context pool tokens
              try {
                this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
              } catch {
                // best-effort
              }
              this.emit('compressed', { level: MemoryLevel.WARNING, result: compressed });
            }
          } catch (err) {
            logger.error('Compression failed during memory warning handling:', err);
          }
        }
        break;
      case MemoryLevel.CRITICAL:
        this.emit('threshold-reached', { level, percentage: this.contextPool.getUsage().percentage });
        // Force context reduction at hard threshold
        await this.forceContextReduction();
        break;
      case MemoryLevel.EMERGENCY:
        // >95%: Emergency actions only
        await this.executeEmergencyActions();
        break;
      case MemoryLevel.NORMAL:
      default:
        // No action needed
        break;
    }
  }

  /**
   * Determine memory level based on usage percentage
   */
  private determineMemoryLevel(percentage: number): MemoryLevel {
    if (percentage >= this.config.thresholds.critical) {
      return MemoryLevel.EMERGENCY;
    } else if (percentage >= this.config.thresholds.hard) {
      return MemoryLevel.CRITICAL;
    } else if (percentage >= this.config.thresholds.soft) {
      return MemoryLevel.WARNING;
    } else {
      return MemoryLevel.NORMAL;
    }
  }



  /**
   * Force context size reduction (90% threshold)
   */
  private async forceContextReduction(): Promise<void> {
    try {
      const usage = this.contextPool.getUsage();
      
      // Emit warning that resize is pending
      let hasActive = false;
      try {
        hasActive = typeof (this.contextPool as any).hasActiveRequests === 'function'
          ? (this.contextPool as any).hasActiveRequests()
          : false;
      } catch {
        hasActive = false;
      }

      this.emit('context-resize-pending', {
        level: MemoryLevel.CRITICAL,
        currentSize: usage.maxTokens,
        hasActiveRequests: hasActive
      });
      
      // Reduce context size by 20%
      const newSize = Math.floor(usage.maxTokens * 0.8);
      
      await this.contextPool.resize(newSize);

      this.emit('context-reduced', { 
        level: MemoryLevel.CRITICAL,
        oldSize: usage.maxTokens,
        newSize
      });
    } catch (error) {
      logger.error('Failed to reduce context size:', error);
      this.emit('context-resize-failed', {
        level: MemoryLevel.CRITICAL,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Execute emergency actions (95% threshold)
   * Creates snapshot, clears context, and notifies user
   */
  async executeEmergencyActions(): Promise<void> {
    const actions: string[] = [];

    try {
      // 1. Create emergency snapshot if possible
      if (this.snapshotManager && this.currentContext) {
        try {
          const hasUserMessages = this.currentContext.messages.some(
            m => m.role === 'user'
          );
          if (hasUserMessages) {
            const snapshot = await this.snapshotManager.createSnapshot(
              this.currentContext
            );
            if (snapshot && snapshot.id) {
              actions.push(`Created emergency snapshot: ${snapshot.id}`);
            } else {
              actions.push('Snapshot created but no ID returned');
            }
          } else {
            actions.push('Skipped snapshot (no user messages)');
          }
        } catch (error) {
          logger.error('Failed to create emergency snapshot:', error);
          actions.push('Failed to create snapshot');
        }
      }

      // 2. Clear context (except system prompt)
      if (this.currentContext) {
        const systemPrompt = this.currentContext.messages.find(
          m => m.role === 'system'
        );
        
        this.currentContext.messages = systemPrompt ? [systemPrompt] : [];
        this.currentContext.tokenCount = systemPrompt?.tokenCount || 0;
        
        // Synchronize with context pool
        this.contextPool.setCurrentTokens(this.currentContext.tokenCount);
        
        actions.push('Cleared context to prevent OOM');
      }

      // 3. Get current memory stats for notification
      const vramInfo = await this.vramMonitor.getInfo();
      const usage = this.contextPool.getUsage();

      // 4. Emit emergency event with recovery options
      this.emit('emergency', {
        level: MemoryLevel.EMERGENCY,
        actions,
        vramInfo,
        usage,
        recoveryOptions: [
          'Use /context restore <id> to restore from snapshot',
          'Reduce context size with /context size <tokens>',
          'Enable auto-compression with /context auto'
        ]
      });

    } catch (error) {
      logger.error('Emergency actions failed:', error);
      this.emit('emergency-failed', { error });
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryGuardConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryGuardConfig {
    return { ...this.config };
  }
}

/**
 * Create a new memory guard instance
 */
export function createMemoryGuard(
  vramMonitor: VRAMMonitor,
  contextPool: ContextPool,
  config?: Partial<MemoryGuardConfig>
): MemoryGuard {
  return new MemoryGuardImpl(vramMonitor, contextPool, config);
}
