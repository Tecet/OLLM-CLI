/**
 * Extension Watcher for hot-reload functionality
 * 
 * Watches extension directories for changes and triggers reload
 * without requiring CLI restart.
 */

import { watch, type FSWatcher } from 'fs';

import { createLogger } from '../utils/logger.js';
import type { ExtensionManager } from './extensionManager.js';

const logger = createLogger('extensionWatcher');

/**
 * File change event
 */
export interface FileChangeEvent {
  /** Event type */
  type: 'change' | 'rename';
  /** File path */
  path: string;
  /** Extension name */
  extensionName: string;
}

/**
 * Watcher configuration
 */
export interface WatcherConfig {
  /** Debounce delay in milliseconds */
  debounceDelay?: number;
  /** Whether to watch recursively */
  recursive?: boolean;
  /** File patterns to watch (default: manifest.json, hooks/, mcp/) */
  watchPatterns?: string[];
}

/**
 * Extension watcher for hot-reload
 */
export class ExtensionWatcher {
  private extensionManager: ExtensionManager;
  private watchers: Map<string, FSWatcher>;
  private debounceTimers: Map<string, NodeJS.Timeout>;
  private config: Required<WatcherConfig>;
  private enabled: boolean;

  constructor(
    extensionManager: ExtensionManager,
    config: WatcherConfig = {}
  ) {
    this.extensionManager = extensionManager;
    this.watchers = new Map();
    this.debounceTimers = new Map();
    this.config = {
      debounceDelay: config.debounceDelay ?? 1000,
      recursive: config.recursive ?? true,
      watchPatterns: config.watchPatterns ?? [
        'manifest.json',
        'hooks',
        'mcp',
      ],
    };
    this.enabled = false;
  }

  /**
   * Start watching all loaded extensions
   */
  start(): void {
    if (this.enabled) {
      return;
    }

    const extensions = this.extensionManager.getAllExtensions();

    for (const extension of extensions) {
      this.watchExtension(extension.name, extension.path);
    }

    this.enabled = true;
    
    logger.info(`Extension watcher started (watching ${extensions.length} extensions)`);
  }

  /**
   * Stop watching all extensions
   */
  stop(): void {
    if (!this.enabled) {
      return;
    }

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const [name, watcher] of this.watchers.entries()) {
      watcher.close();
      logger.info(`Stopped watching extension: ${name}`);
    }
    this.watchers.clear();

    this.enabled = false;
    logger.info('Extension watcher stopped');
  }

  /**
   * Watch a specific extension
   * 
   * @param name - Extension name
   * @param path - Extension directory path
   */
  watchExtension(name: string, path: string): void {
    // Don't watch if already watching
    if (this.watchers.has(name)) {
      return;
    }

    try {
      // Create file system watcher
      const watcher = watch(
        path,
        {
          recursive: this.config.recursive,
          persistent: true,
        },
        (eventType, filename) => {
          if (!filename) {
            return;
          }

          // Check if file matches watch patterns
          if (!this.shouldWatch(filename)) {
            return;
          }

          // Handle file change with debouncing
          this.handleFileChange(name, path, eventType, filename);
        }
      );

      // Handle watcher errors
      watcher.on('error', (error) => {
        logger.error(`Watcher error for extension '${name}':`, { error: error instanceof Error ? error.message : String(error) });
      });

      this.watchers.set(name, watcher);
      logger.info(`Started watching extension: ${name}`);
    } catch (error) {
      logger.error(`Failed to watch extension '${name}':`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  /**
   * Stop watching a specific extension
   * 
   * @param name - Extension name
   */
  unwatchExtension(name: string): void {
    const watcher = this.watchers.get(name);
    if (!watcher) {
      return;
    }

    // Clear debounce timer
    const timer = this.debounceTimers.get(name);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(name);
    }

    // Close watcher
    watcher.close();
    this.watchers.delete(name);

    logger.info(`Stopped watching extension: ${name}`);
  }

  /**
   * Check if file should be watched based on patterns
   * 
   * @param filename - File name or path
   * @returns True if file should be watched
   */
  private shouldWatch(filename: string): boolean {
    return this.config.watchPatterns.some((pattern) =>
      filename.includes(pattern)
    );
  }

  /**
   * Handle file change event with debouncing
   * 
   * @param name - Extension name
   * @param path - Extension path
   * @param eventType - Event type
   * @param filename - Changed file name
   */
  private handleFileChange(
    name: string,
    path: string,
    eventType: 'change' | 'rename',
    filename: string
  ): void {
    // Clear existing debounce timer
    const existingTimer = this.debounceTimers.get(name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Create new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(name);

      logger.info(`File ${eventType} detected in extension '${name}': ${filename}`);

      try {
        // Reload the extension
        await this.reloadExtension(name);
      } catch (error) {
        logger.error(`Failed to reload extension '${name}':`, { error: error instanceof Error ? error.message : String(error) });
      }
    }, this.config.debounceDelay);

    this.debounceTimers.set(name, timer);
  }

  /**
   * Reload an extension
   * 
   * @param name - Extension name
   */
  private async reloadExtension(name: string): Promise<void> {
    logger.info(`Reloading extension: ${name}`);

    try {
      // Use extension manager to reload
      await this.extensionManager.reloadExtension(name);

      logger.info(`Successfully reloaded extension: ${name}`);
    } catch (error) {
      throw new Error(
        `Failed to reload extension: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if watcher is enabled
   * 
   * @returns True if watcher is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get list of watched extension names
   * 
   * @returns Array of extension names being watched
   */
  getWatchedExtensions(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Update watcher configuration
   * 
   * @param config - New configuration
   */
  updateConfig(config: Partial<WatcherConfig>): void {
    if (config.debounceDelay !== undefined) {
      this.config.debounceDelay = config.debounceDelay;
    }
    if (config.recursive !== undefined) {
      this.config.recursive = config.recursive;
    }
    if (config.watchPatterns !== undefined) {
      this.config.watchPatterns = config.watchPatterns;
    }

    // Restart watchers if enabled
    if (this.enabled) {
      this.stop();
      this.start();
    }
  }
}
