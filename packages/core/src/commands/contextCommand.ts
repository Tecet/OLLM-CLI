/**
 * Context Command Handler
 *
 * Implements the /context command and its subcommands for managing
 * context size, snapshots, compression, and displaying status.
 *
 * Commands:
 * - /context - Show status
 * - /context size <tokens> - Set target size
 * - /context auto - Enable auto-sizing
 * - /context snapshot - Create manual snapshot
 * - /context restore <id> - Restore from snapshot
 * - /context list - List snapshots
 * - /context clear - Clear context
 * - /context compress - Manual compression
 * - /context stats - Detailed statistics
 */

import type { ContextManager, ContextSnapshot, VRAMInfo } from '../context/types.js';

export interface ContextCommandResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ContextStatusData {
  model: string;
  tokens: {
    current: number;
    max: number;
    percentage: number;
  };
  vram: {
    used: number;
    total: number;
    percentage: number;
  };
  kvCache: {
    quantization: string;
    size: number;
  };
  snapshots: {
    count: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
  };
}

export interface ContextStatsData extends ContextStatusData {
  memory: {
    modelWeights: number;
    kvCache: number;
    totalVRAM: number;
    safetyBuffer: number;
  };
  session: {
    duration: number;
    messageCount: number;
    snapshotCount: number;
  };
  compressionHistory: Array<{
    timestamp: Date;
    strategy: string;
    originalTokens: number;
    compressedTokens: number;
    ratio: number;
  }>;
}

/**
 * Context Command Handler
 *
 * Handles all /context commands and subcommands
 */
export class ContextCommandHandler {
  constructor(
    private contextManager: ContextManager,
    private getVRAMInfo: () => Promise<VRAMInfo>,
    private sessionStartTime: Date = new Date()
  ) {}

  /**
   * Handle /context command
   */
  async handleCommand(args: string[]): Promise<ContextCommandResult> {
    if (args.length === 0) {
      return await this.showStatus();
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'size':
        return await this.setSize(args.slice(1));

      case 'auto':
        return await this.enableAutoSize();

      case 'snapshot':
        return await this.createSnapshot();

      case 'restore':
        return await this.restoreSnapshot(args.slice(1));

      case 'list':
        return await this.listSnapshots();

      case 'clear':
        return await this.clearContext();

      case 'compress':
        return await this.compressContext();

      case 'stats':
        return await this.showStats();

      default:
        return {
          success: false,
          message: `Unknown subcommand: ${subcommand}. Use /context, /context size, /context auto, /context snapshot, /context restore, /context list, /context clear, /context compress, or /context stats`,
        };
    }
  }

  /**
   * Show context status
   * Implements: /context
   */
  private async showStatus(): Promise<ContextCommandResult> {
    const usage = this.contextManager.getUsage();
    const vramInfo = await this.getVRAMInfo();
    const snapshots = await this.contextManager.listSnapshots();

    const statusData: ContextStatusData = {
      model: 'unknown', // Will be provided by caller or from config
      tokens: {
        current: usage.currentTokens,
        max: usage.maxTokens,
        percentage: usage.percentage,
      },
      vram: {
        used: vramInfo.used,
        total: vramInfo.total,
        percentage: (vramInfo.used / vramInfo.total) * 100,
      },
      kvCache: {
        quantization: this.contextManager.config.kvQuantization,
        size: vramInfo.modelLoaded,
      },
      snapshots: {
        count: snapshots.length,
      },
      compression: {
        enabled: this.contextManager.config.compression.enabled,
        threshold: this.contextManager.config.compression.threshold,
      },
    };

    const message = this.formatStatus(statusData);

    return {
      success: true,
      message,
      data: statusData,
    };
  }

  /**
   * Set target context size
   * Implements: /context size <tokens>
   */
  private async setSize(args: string[]): Promise<ContextCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /context size <tokens>',
      };
    }

    const targetSize = parseInt(args[0], 10);

    if (isNaN(targetSize) || targetSize <= 0) {
      return {
        success: false,
        message: 'Invalid token count. Must be a positive number.',
      };
    }

    // Check if size is within bounds
    if (targetSize < this.contextManager.config.minSize) {
      return {
        success: false,
        message: `Target size ${targetSize} is below minimum ${this.contextManager.config.minSize}`,
      };
    }

    if (targetSize > this.contextManager.config.maxSize) {
      return {
        success: false,
        message: `Target size ${targetSize} exceeds maximum ${this.contextManager.config.maxSize}`,
      };
    }

    // Update configuration
    this.contextManager.updateConfig({
      targetSize,
      autoSize: false, // Disable auto-sizing when manually setting size
    });

    return {
      success: true,
      message: `Context size set to ${targetSize} tokens. Auto-sizing disabled.`,
    };
  }

  /**
   * Enable automatic context sizing
   * Implements: /context auto
   */
  private async enableAutoSize(): Promise<ContextCommandResult> {
    this.contextManager.updateConfig({
      autoSize: true,
    });

    const usage = this.contextManager.getUsage();

    return {
      success: true,
      message: `Auto-sizing enabled. Context will adjust based on available VRAM. Current size: ${usage.maxTokens} tokens.`,
    };
  }

  /**
   * Create manual snapshot
   * Implements: /context snapshot
   */
  private async createSnapshot(): Promise<ContextCommandResult> {
    try {
      const snapshot = await this.contextManager.createSnapshot();

      return {
        success: true,
        message: `Snapshot created: ${snapshot.id}\nTokens: ${snapshot.tokenCount} | Messages: ${snapshot.messages.length}`,
        data: snapshot,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Restore from snapshot
   * Implements: /context restore <id>
   */
  private async restoreSnapshot(args: string[]): Promise<ContextCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /context restore <snapshot-id>',
      };
    }

    const snapshotId = args[0];

    try {
      await this.contextManager.restoreSnapshot(snapshotId);

      const usage = this.contextManager.getUsage();

      return {
        success: true,
        message: `Restored snapshot ${snapshotId}\nTokens: ${usage.currentTokens}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to restore snapshot: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * List available snapshots
   * Implements: /context list
   */
  private async listSnapshots(): Promise<ContextCommandResult> {
    try {
      const snapshots = await this.contextManager.listSnapshots();

      if (snapshots.length === 0) {
        return {
          success: true,
          message: 'No snapshots available.',
          data: [],
        };
      }

      const message = this.formatSnapshotList(snapshots);

      return {
        success: true,
        message,
        data: snapshots,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to list snapshots: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Clear context (except system prompt)
   * Implements: /context clear
   */
  private async clearContext(): Promise<ContextCommandResult> {
    try {
      await this.contextManager.clear();

      return {
        success: true,
        message: 'Context cleared. System prompt preserved.',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear context: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Manually trigger compression
   * Implements: /context compress
   */
  private async compressContext(): Promise<ContextCommandResult> {
    try {
      const beforeTokens = this.contextManager.getUsage().currentTokens;

      await this.contextManager.compress();

      const afterTokens = this.contextManager.getUsage().currentTokens;
      const reduction = beforeTokens - afterTokens;
      const percentage = ((reduction / beforeTokens) * 100).toFixed(1);

      return {
        success: true,
        message: `Compressed: ${beforeTokens} → ${afterTokens} tokens (${percentage}% reduction)`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to compress context: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Show detailed statistics
   * Implements: /context stats
   */
  private async showStats(): Promise<ContextCommandResult> {
    const usage = this.contextManager.getUsage();
    const vramInfo = await this.getVRAMInfo();
    const snapshots = await this.contextManager.listSnapshots();

    const sessionDuration = Date.now() - this.sessionStartTime.getTime();

    const statsData: ContextStatsData = {
      model: 'unknown', // Will be provided by caller or from config
      tokens: {
        current: usage.currentTokens,
        max: usage.maxTokens,
        percentage: usage.percentage,
      },
      vram: {
        used: vramInfo.used,
        total: vramInfo.total,
        percentage: (vramInfo.used / vramInfo.total) * 100,
      },
      kvCache: {
        quantization: this.contextManager.config.kvQuantization,
        size: vramInfo.modelLoaded,
      },
      snapshots: {
        count: snapshots.length,
      },
      compression: {
        enabled: this.contextManager.config.compression.enabled,
        threshold: this.contextManager.config.compression.threshold,
      },
      memory: {
        modelWeights: vramInfo.modelLoaded,
        kvCache: vramInfo.used - vramInfo.modelLoaded,
        totalVRAM: vramInfo.used,
        safetyBuffer: this.contextManager.config.vramBuffer,
      },
      session: {
        duration: sessionDuration,
        messageCount: 0, // Not available without getContext
        snapshotCount: snapshots.length,
      },
      compressionHistory: [], // Not available without getContext
    };

    const message = this.formatStats(statsData);

    return {
      success: true,
      message,
      data: statsData,
    };
  }

  /**
   * Format status display
   */
  private formatStatus(data: ContextStatusData): string {
    const lines = [
      'Context Status:',
      `  Model: ${data.model}`,
      `  Tokens: ${data.tokens.current.toLocaleString()} / ${data.tokens.max.toLocaleString()} (${data.tokens.percentage.toFixed(1)}%)`,
      `  VRAM: ${this.formatBytes(data.vram.used)} / ${this.formatBytes(data.vram.total)} (${data.vram.percentage.toFixed(1)}%)`,
      `  KV Cache: ${data.kvCache.quantization} (${this.formatBytes(data.kvCache.size)})`,
      `  Snapshots: ${data.snapshots.count} available`,
      `  Auto-compress: ${data.compression.enabled ? `enabled at ${(data.compression.threshold * 100).toFixed(0)}%` : 'disabled'}`,
    ];

    return lines.join('\n');
  }

  /**
   * Format snapshot list
   */
  private formatSnapshotList(snapshots: ContextSnapshot[]): string {
    const lines = ['Snapshots:'];

    snapshots.forEach((snapshot, index) => {
      const timeAgo = this.formatTimeAgo(snapshot.timestamp);
      lines.push(
        `  ${index + 1}. ${snapshot.id} - ${timeAgo} (${snapshot.tokenCount.toLocaleString()} tokens)`
      );
    });

    return lines.join('\n');
  }

  /**
   * Format detailed statistics
   */
  private formatStats(data: ContextStatsData): string {
    const lines = [
      'Detailed Context Statistics:',
      '',
      'Memory:',
      `  Model Weights: ${this.formatBytes(data.memory.modelWeights)}`,
      `  KV Cache: ${this.formatBytes(data.memory.kvCache)} (${data.kvCache.quantization})`,
      `  Total VRAM: ${this.formatBytes(data.memory.totalVRAM)} / ${this.formatBytes(data.vram.total)}`,
      `  Safety Buffer: ${this.formatBytes(data.memory.safetyBuffer)} reserved`,
      '',
      'Context:',
      `  Current: ${data.tokens.current.toLocaleString()} tokens`,
      `  Maximum: ${data.tokens.max.toLocaleString()} tokens`,
      `  Usage: ${data.tokens.percentage.toFixed(1)}%`,
      '',
      'Session:',
      `  Duration: ${this.formatDuration(data.session.duration)}`,
      `  Messages: ${data.session.messageCount}`,
      `  Snapshots: ${data.session.snapshotCount}`,
    ];

    if (data.compressionHistory.length > 0) {
      const lastCompression = data.compressionHistory[data.compressionHistory.length - 1];
      const timeAgo = this.formatTimeAgo(lastCompression.timestamp);
      const reduction = ((1 - lastCompression.ratio) * 100).toFixed(0);

      lines.push(
        '',
        'Compression History:',
        `  Last compressed: ${timeAgo}`,
        `  Ratio: ${lastCompression.originalTokens.toLocaleString()} → ${lastCompression.compressedTokens.toLocaleString()} (${reduction}% reduction)`
      );
    }

    return lines.join('\n');
  }

  /**
   * Format bytes to human-readable string
   */
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Format duration to human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format time ago to human-readable string
   */
  private formatTimeAgo(date: Date): string {
    const now = Date.now();
    const then = date.getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return days === 1 ? 'yesterday' : `${days} days ago`;
    } else if (hours > 0) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else if (minutes > 0) {
      return minutes === 1 ? '1 min ago' : `${minutes} min ago`;
    } else {
      return 'just now';
    }
  }
}

/**
 * Create a context command handler
 */
export function createContextCommandHandler(
  contextManager: ContextManager,
  getVRAMInfo: () => Promise<VRAMInfo>,
  sessionStartTime?: Date
): ContextCommandHandler {
  return new ContextCommandHandler(contextManager, getVRAMInfo, sessionStartTime);
}
