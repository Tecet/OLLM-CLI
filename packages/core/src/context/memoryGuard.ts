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
import type {
  MemoryGuard,
  MemoryThresholds,
  VRAMMonitor,
  ContextPool,
  SnapshotManager,
  ICompressionService,
  ConversationContext,
  MemoryGuardConfig
} from './types.js';

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
  private thresholdCallbacks: Map<MemoryLevel, Array<() => void>> = new Map();
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
  onThreshold(level: MemoryLevel, callback: () => void): void {
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
      callbacks.forEach(cb => cb());
    }

    // Trigger automatic actions based on level
    switch (level) {
      case MemoryLevel.WARNING:
        // 80-90%: Trigger compression
        await this.triggerCompression();
        break;
      case MemoryLevel.CRITICAL:
        // 90-95%: Force context reduction
        await this.forceContextReduction();
        break;
      case MemoryLevel.EMERGENCY:
        // >95%: Emergency actions
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
   * Trigger automatic compression (80% threshold)
   */
  private async triggerCompression(): Promise<void> {
    if (!this.compressionService || !this.currentContext) {
      return;
    }

    try {
      // Trigger compression with default strategy
      const strategy = {
        type: 'hybrid' as const,
        preserveRecent: 4096,
        summaryMaxTokens: 1024
      };

      await this.compressionService.compress(
        this.currentContext.messages,
        strategy
      );

      this.emit('compression-triggered', { level: MemoryLevel.WARNING });
    } catch (error) {
      console.error('Failed to trigger compression:', error);
    }
  }

  /**
   * Force context size reduction (90% threshold)
   */
  private async forceContextReduction(): Promise<void> {
    try {
      const usage = this.contextPool.getUsage();
      
      // Reduce context size by 20%
      const newSize = Math.floor(usage.maxTokens * 0.8);
      
      await this.contextPool.resize(newSize);

      this.emit('context-reduced', { 
        level: MemoryLevel.CRITICAL,
        oldSize: usage.maxTokens,
        newSize
      });
    } catch (error) {
      console.error('Failed to reduce context size:', error);
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
          const snapshot = await this.snapshotManager.createSnapshot(
            this.currentContext
          );
          actions.push(`Created emergency snapshot: ${snapshot.id}`);
        } catch (error) {
          console.error('Failed to create emergency snapshot:', error);
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
      console.error('Emergency actions failed:', error);
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
