/**
 * Context Pool Service
 * 
 * Manages dynamic context sizing based on available VRAM, quantization types,
 * and user configuration. Coordinates with provider for context resizing.
 */

import type {
  ContextPool,
  ContextPoolConfig,
  ContextUsage,
  VRAMInfo,
  ModelInfo,
  KVQuantization
} from './types.js';

/**
 * Default context pool configuration
 */
const DEFAULT_CONFIG: ContextPoolConfig = {
  minContextSize: 2048,
  maxContextSize: 131072,
  targetContextSize: 8192,
  reserveBuffer: 512 * 1024 * 1024, // 512MB
  kvCacheQuantization: 'q8_0',
  autoSize: true
};

/**
 * Context Pool implementation
 */
export class ContextPoolImpl implements ContextPool {
  public config: ContextPoolConfig;
  public currentSize: number;
  private currentTokens: number = 0;
  private vramInfo: VRAMInfo | null = null;
  private resizeCallback?: (newSize: number) => Promise<void>;
  private activeRequests: number = 0;
  private resizePending: boolean = false;

  constructor(
    config: Partial<ContextPoolConfig> = {},
    resizeCallback?: (newSize: number) => Promise<void>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentSize = this.config.targetContextSize;
    this.resizeCallback = resizeCallback;
  }

  /**
   * Track active request start
   */
  beginRequest(): void {
    this.activeRequests++;
  }

  /**
   * Track active request end
   */
  endRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  /**
   * Check if there are active requests
   */
  hasActiveRequests(): boolean {
    return this.activeRequests > 0;
  }

  /**
   * Calculate optimal context size based on available VRAM
   * Formula: floor((availableVRAM - safetyBuffer) / bytesPerToken)
   */
  calculateOptimalSize(vramInfo: VRAMInfo, modelInfo: ModelInfo): number {
    // Store VRAM info for usage calculations
    this.vramInfo = vramInfo;

    // If auto-sizing is disabled, use target size
    if (!this.config.autoSize) {
      return this.clampSize(this.config.targetContextSize);
    }

    // Calculate bytes per token based on quantization
    const bytesPerToken = this.getBytesPerToken(
      modelInfo.parameters,
      this.config.kvCacheQuantization
    );

    // Calculate usable VRAM
    const usableVRAM = vramInfo.available - this.config.reserveBuffer;

    // Ensure we have positive usable VRAM
    if (usableVRAM <= 0) {
      return this.config.minContextSize;
    }

    // Calculate optimal size
    const optimalSize = Math.floor(usableVRAM / bytesPerToken);

    // Clamp to min/max and model limit
    return this.clampSize(Math.min(optimalSize, modelInfo.contextLimit));
  }

  /**
   * Calculate bytes per token for KV cache
   * Formula: 2 (K+V) × layers × hidden_dim × bytes_per_value
   * Simplified: params × multiplier × bytes
   */
  private getBytesPerToken(
    modelParams: number,
    quantization: KVQuantization
  ): number {
    // Bytes per value based on quantization type
    const bytesPerValue: Record<KVQuantization, number> = {
      'f16': 2,    // 2 bytes per value
      'q8_0': 1,   // 1 byte per value
      'q4_0': 0.5  // 0.5 bytes per value
    };

    // KV cache has 2 components (K and V)
    // Approximate formula based on model parameters
    const bytes = bytesPerValue[quantization];
    return (modelParams * 2 * bytes) / 1e9;
  }

  /**
   * Clamp size to configured min/max bounds
   */
  private clampSize(size: number): number {
    return Math.max(
      this.config.minContextSize,
      Math.min(size, this.config.maxContextSize)
    );
  }

  /**
   * Resize context to new size
   * Coordinates with provider and preserves existing data
   * Waits for active requests to complete before resizing
   */
  async resize(newSize: number): Promise<void> {
    // Clamp to valid range
    const clampedSize = this.clampSize(newSize);

    // No-op if size hasn't changed
    if (clampedSize === this.currentSize) {
      return;
    }

    // Mark resize as pending
    this.resizePending = true;

    // Wait for active requests to complete (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.hasActiveRequests() && (Date.now() - startTime) < maxWaitTime) {
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // If still have active requests after timeout, log warning but proceed
    if (this.hasActiveRequests()) {
      console.warn(`Context resize proceeding with ${this.activeRequests} active requests still in flight`);
    }

    // Call resize callback if provided (coordinates with provider)
    if (this.resizeCallback) {
      await this.resizeCallback(clampedSize);
    }

    // Update current size
    this.currentSize = clampedSize;
    this.resizePending = false;
  }

  /**
   * Get current usage statistics
   */
  getUsage(): ContextUsage {
    const percentage = this.currentSize > 0
      ? (this.currentTokens / this.currentSize) * 100
      : 0;

    return {
      currentTokens: this.currentTokens,
      maxTokens: this.currentSize,
      percentage: Math.min(100, Math.max(0, percentage)),
      vramUsed: this.vramInfo?.used ?? 0,
      vramTotal: this.vramInfo?.total ?? 0
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ContextPoolConfig>): void {
    this.config = { ...this.config, ...config };

    // If target size changed and auto-size is off, resize to target
    if (config.targetContextSize !== undefined && !this.config.autoSize) {
      this.currentSize = this.clampSize(config.targetContextSize);
    }
  }

  /**
   * Update current token count (for usage tracking)
   */
  setCurrentTokens(tokens: number): void {
    this.currentTokens = Math.max(0, tokens);
  }

  /**
   * Update VRAM info (for usage tracking)
   */
  updateVRAMInfo(vramInfo: VRAMInfo): void {
    this.vramInfo = vramInfo;
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
