/**
 * Context Pool - Stateful Context Coordinator
 *
 * Manages context state and coordinates resize operations.
 * All calculations delegated to ContextSizeCalculator.
 *
 * Responsibilities:
 * - Track current size, tokens, VRAM info
 * - Track active requests
 * - Coordinate resize operations with provider
 * - Return usage statistics
 *
 * Does NOT:
 * - Calculate sizes (ContextSizeCalculator does this)
 * - Make decisions about when to resize (ContextManager does this)
 */

import { clampContextSize, calculateOptimalContextSize } from './ContextSizeCalculator.js';

import type { ContextPool, ContextPoolConfig, ContextUsage, VRAMInfo, ModelInfo } from './types.js';

/**
 * Default context pool configuration
 */
const DEFAULT_CONFIG: ContextPoolConfig = {
  minContextSize: 2048,
  maxContextSize: 131072,
  targetContextSize: 8192,
  reserveBuffer: 512 * 1024 * 1024, // 512MB
  kvCacheQuantization: 'q8_0',
  autoSize: true,
};

/**
 * Context Pool implementation
 */
export class ContextPoolImpl implements ContextPool {
  public config: ContextPoolConfig;

  // State tracking (public as required by interface)
  public currentSize: number; // Ollama context size (85% pre-calculated)
  public userContextSize: number; // User's selected size (for UI display)

  // Private state
  private currentTokens: number = 0;
  private vramInfo: VRAMInfo | null = null;
  private activeRequests: number = 0;

  // Coordination
  private resizeCallback?: (newSize: number) => Promise<void>;

  constructor(
    config: Partial<ContextPoolConfig> = {},
    resizeCallback?: (newSize: number) => Promise<void>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentSize = this.config.targetContextSize;
    this.userContextSize = this.config.targetContextSize;
    this.resizeCallback = resizeCallback;
  }

  /**
   * Track active request lifecycle
   */
  beginRequest(): void {
    this.activeRequests++;
  }

  endRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  hasActiveRequests(): boolean {
    return this.activeRequests > 0;
  }

  /**
   * Calculate optimal context size based on available VRAM
   * Delegates to ContextSizeCalculator for pure calculation
   */
  calculateOptimalSize(vramInfo: VRAMInfo, modelInfo: ModelInfo): number {
    // Store VRAM info for usage calculations
    this.vramInfo = vramInfo;

    // If auto-sizing is disabled, use target size
    if (!this.config.autoSize) {
      return clampContextSize(
        this.config.targetContextSize,
        this.config.minContextSize,
        this.config.maxContextSize
      );
    }

    // Delegate to ContextSizeCalculator for pure calculation
    return calculateOptimalContextSize(
      vramInfo.available,
      this.config.reserveBuffer,
      modelInfo.parameters,
      this.config.kvCacheQuantization,
      modelInfo.contextLimit,
      this.config.minContextSize,
      this.config.maxContextSize
    );
  }

  /**
   * Resize context to new size
   * Waits for active requests to complete before resizing
   *
   * @param newSize - The Ollama context size (85% pre-calculated)
   * @param userSize - Optional user-facing size for UI display
   */
  async resize(newSize: number, userSize?: number): Promise<void> {
    // Clamp to valid range
    const clampedSize = clampContextSize(
      newSize,
      this.config.minContextSize,
      this.config.maxContextSize
    );

    // No-op if size hasn't changed
    if (clampedSize === this.currentSize) {
      return;
    }

    // Wait for active requests to complete (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.hasActiveRequests() && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // If still have active requests after timeout, log warning but proceed
    if (this.hasActiveRequests()) {
      console.warn(`[ContextPool] Resize proceeding with ${this.activeRequests} active requests`);
    }

    // Call resize callback if provided (coordinates with provider)
    if (this.resizeCallback) {
      await this.resizeCallback(clampedSize);
    }

    // Update sizes
    this.currentSize = clampedSize;
    this.userContextSize = userSize !== undefined ? userSize : clampedSize;
  }

  /**
   * Get current Ollama context size (actual limit sent to Ollama)
   */
  getCurrentSize(): number {
    return this.currentSize;
  }

  /**
   * Get current usage statistics
   */
  getUsage(): ContextUsage {
    // Calculate percentage against currentSize (Ollama limit)
    const percentage = this.currentSize > 0 ? (this.currentTokens / this.currentSize) * 100 : 0;

    return {
      currentTokens: this.currentTokens,
      maxTokens: this.userContextSize, // Show user's selected size in UI
      percentage: Math.min(100, Math.max(0, percentage)),
      vramUsed: this.vramInfo?.used ?? 0,
      vramTotal: this.vramInfo?.total ?? 0,
    };
  }

  /**
   * Update state
   */
  setCurrentTokens(tokens: number): void {
    this.currentTokens = Math.max(0, tokens);
  }

  setUserContextSize(size: number): void {
    this.userContextSize = size;
  }

  updateVRAMInfo(vramInfo: VRAMInfo): void {
    this.vramInfo = vramInfo;
  }

  updateConfig(config: Partial<ContextPoolConfig>): void {
    this.config = { ...this.config, ...config };

    // If target size changed and auto-size is off, update current size
    if (config.targetContextSize !== undefined && !this.config.autoSize) {
      this.currentSize = clampContextSize(
        config.targetContextSize,
        this.config.minContextSize,
        this.config.maxContextSize
      );
    }
  }
}

/**
 * Create a new context pool instance
 */
export function createContextPool(
  config?: Partial<ContextPoolConfig>,
  resizeCallback?: (newSize: number) => Promise<void>
): ContextPool {
  return new ContextPoolImpl(config, resizeCallback);
}
