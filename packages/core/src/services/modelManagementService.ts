/**
 * Model Management Service
 * Manages model lifecycle operations (list, pull, delete, info) and keep-alive functionality.
 */

import type { ProviderAdapter, ModelInfo, PullProgress } from '../provider/types.js';

/**
 * Extended model information with additional metadata.
 */
export interface ExtendedModelInfo extends ModelInfo {
  family?: string;
  contextWindow?: number;
  capabilities?: ModelCapabilities;
  parameterCount?: number;
}

/**
 * Model capabilities flags.
 */
export interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
}

/**
 * Model status information.
 */
export interface ModelStatus {
  exists: boolean;
  loaded: boolean;
  lastUsed?: Date;
}

/**
 * Progress event for model operations.
 */
export interface ProgressEvent {
  percentage: number;
  transferRate: number;
  bytesDownloaded: number;
  totalBytes: number;
}

/**
 * Progress callback type.
 */
export type ProgressCallback = (progress: ProgressEvent) => void;

/**
 * Configuration for the Model Management Service.
 */
export interface ModelManagementServiceConfig {
  /** Cache TTL in milliseconds (default: 30 seconds) */
  cacheTTL?: number;
  /** Keep-alive enabled */
  keepAliveEnabled?: boolean;
  /** Keep-alive timeout in seconds (default: 300) */
  keepAliveTimeout?: number;
  /** Models to always keep loaded */
  keepAliveModels?: string[];
}

/**
 * Cache entry for model list.
 */
interface CacheEntry {
  data: ModelInfo[];
  timestamp: number;
}

/**
 * Model Management Service
 * Provides model lifecycle management with caching and keep-alive support.
 */
export class ModelManagementService {
  private cache: CacheEntry | null = null;
  private readonly cacheTTL: number;
  private readonly keepAliveEnabled: boolean;
  private readonly keepAliveTimeout: number;
  private readonly keepAliveModels: Set<string>;
  private loadedModels: Map<string, Date> = new Map();
  // Note: keepAliveIntervals removed - Ollama handles keep-alive automatically
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(
    private provider: ProviderAdapter,
    config: ModelManagementServiceConfig = {}
  ) {
    this.cacheTTL = config.cacheTTL ?? 30 * 1000; // 30 seconds (reduced from 5 minutes)
    this.keepAliveEnabled = config.keepAliveEnabled ?? true;
    this.keepAliveTimeout = config.keepAliveTimeout ?? 300; // 5 minutes
    this.keepAliveModels = new Set(config.keepAliveModels ?? []);
  }

  /**
   * List all available models.
   * Uses cache if available and not expired.
   * @param forceRefresh Force a fresh fetch, bypassing cache
   * @returns Array of model information
   */
  async listModels(forceRefresh: boolean = false): Promise<ModelInfo[]> {
    // Check cache (skip if forceRefresh is true)
    if (!forceRefresh && this.cache && Date.now() - this.cache.timestamp < this.cacheTTL) {
      return this.cache.data;
    }

    try {
      // Check if provider supports listing models
      if (!this.provider.listModels) {
        throw new Error(
          `Provider "${this.provider.name}" does not support listing models`
        );
      }

      const models = await this.provider.listModels();
      
      // Update cache
      this.cache = {
        data: models,
        timestamp: Date.now(),
      };

      return models;
    } catch (error) {
      // If provider is unavailable and we have cached data, return it
      if (this.cache) {
        return this.cache.data;
      }

      // Otherwise, throw a descriptive error
      if (error instanceof Error) {
        throw new Error(
          `Failed to list models: ${error.message}. ` +
          `Ensure the provider is running and accessible.`
        );
      }
      throw error;
    }
  }

  /**
   * Pull/download a model.
   * Emits progress events during download.
   * @param name Model name
   * @param onProgress Progress callback
   */
  async pullModel(name: string, onProgress?: ProgressCallback): Promise<void> {
    try {
      // Check if provider supports pulling models
      if (!this.provider.pullModel) {
        throw new Error(
          `Provider "${this.provider.name}" does not support pulling models`
        );
      }

      // Create abort controller for cancellation
      const abortController = new AbortController();
      this.abortControllers.set(name, abortController);

      try {
        // Wrap progress callback to convert format
        const wrappedProgress = onProgress
          ? (progress: PullProgress) => {
              const percentage =
                progress.completed && progress.total
                  ? (progress.completed / progress.total) * 100
                  : 0;
              
              const transferRate = 0; // Ollama doesn't provide this
              
              onProgress({
                percentage,
                transferRate,
                bytesDownloaded: progress.completed ?? 0,
                totalBytes: progress.total ?? 0,
              });
            }
          : undefined;

        await this.provider.pullModel(name, wrappedProgress);

        // Invalidate cache after successful pull
        this.invalidateCache();
      } finally {
        this.abortControllers.delete(name);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Model pull cancelled: ${name}`);
        }
        throw new Error(
          `Failed to pull model "${name}": ${error.message}. ` +
          `Check the model name and network connection.`
        );
      }
      throw error;
    }
  }

  /**
   * Cancel an in-progress model pull.
   * @param name Model name
   */
  cancelPull(name: string): void {
    const controller = this.abortControllers.get(name);
    if (controller) {
      controller.abort();
    }
  }

  /**
   * Delete a model.
   * Unloads the model first if it's currently loaded.
   * @param name Model name
   */
  async deleteModel(name: string): Promise<void> {
    try {
      // Check if provider supports deleting models
      if (!this.provider.deleteModel) {
        throw new Error(
          `Provider "${this.provider.name}" does not support deleting models`
        );
      }

      // Unload model first if it's loaded
      if (this.loadedModels.has(name)) {
        await this.unloadModel(name);
      }

      await this.provider.deleteModel(name);

      // Invalidate cache after successful deletion
      this.invalidateCache();
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to delete model "${name}": ${error.message}. ` +
          `Ensure the model exists and is not in use.`
        );
      }
      throw error;
    }
  }

  /**
   * Get detailed information about a model.
   * @param name Model name
   * @returns Model information
   */
  async showModel(name: string): Promise<ModelInfo> {
    try {
      // Check if provider supports showing model info
      if (!this.provider.showModel) {
        throw new Error(
          `Provider "${this.provider.name}" does not support showing model information`
        );
      }

      return await this.provider.showModel(name);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to get information for model "${name}": ${error.message}. ` +
          `Ensure the model exists.`
        );
      }
      throw error;
    }
  }

  /**
   * Get the status of a model.
   * @param name Model name
   * @returns Model status
   */
  async getModelStatus(name: string): Promise<ModelStatus> {
    try {
      const models = await this.listModels();
      const exists = models.some((m) => m.name === name);
      const loaded = this.loadedModels.has(name);
      const lastUsed = this.loadedModels.get(name);

      return {
        exists,
        loaded,
        lastUsed,
      };
    } catch {
      return {
        exists: false,
        loaded: false,
      };
    }
  }

  /**
   * Keep a model loaded in memory.
   * 
   * NOTE: This is primarily a tracking mechanism. Ollama handles keep-alive automatically,
   * so no actual keep-alive requests are sent. This method simply marks the model as "loaded"
   * for tracking purposes.
   * 
   * @param name Model name
   */
  async keepModelLoaded(name: string): Promise<void> {
    if (!this.keepAliveEnabled) {
      return;
    }

    // Mark model as loaded (for tracking only)
    this.loadedModels.set(name, new Date());
    
    // Note: No actual keep-alive requests are sent to Ollama
    // Ollama manages model lifecycle automatically based on usage
  }

  /**
   * Unload a model from memory.
   * 
   * NOTE: This is primarily a tracking mechanism. Ollama handles model unloading automatically,
   * so this method simply removes the model from our tracking.
   * 
   * @param name Model name
   */
  async unloadModel(name: string): Promise<void> {
    // Remove from loaded models tracking
    this.loadedModels.delete(name);
    
    // Note: No actual unload request is sent to Ollama
    // Ollama manages model lifecycle automatically
  }

  /**
   * Get list of currently loaded models.
   * @returns Array of model names
   */
  getLoadedModels(): string[] {
    // Check for idle models that should be unloaded
    const now = new Date();
    const timeoutMs = this.keepAliveTimeout * 1000;

    for (const [name, lastUsed] of this.loadedModels.entries()) {
      if (now.getTime() - lastUsed.getTime() > timeoutMs) {
        // Don't unload models in the keep-alive list
        if (!this.keepAliveModels.has(name)) {
          this.unloadModel(name);
        }
      }
    }

    return Array.from(this.loadedModels.keys());
  }

  /**
   * Invalidate the model list cache.
   * Forces the next listModels call to fetch fresh data.
   */
  invalidateCache(): void {
    this.cache = null;
  }

  /**
   * Clean up resources.
   * Clears model tracking and abort controllers.
   */
  dispose(): void {
    this.loadedModels.clear();
    this.abortControllers.clear();
  }
}
