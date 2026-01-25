import { createLogger } from '../../../core/src/utils/logger.js';

const logger = createLogger('mcpCleanup');
/**
 * MCP Cleanup Service
 * 
 * Handles cleanup of downloaded MCP server packages and cache files
 * when servers are uninstalled.
 */

import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * MCP Cleanup Service
 * 
 * Provides utilities to clean up downloaded packages and cache files
 * for MCP servers when they are uninstalled.
 */
export class MCPCleanupService {
  /**
   * Clean up all resources associated with an MCP server
   * @param serverName - Name of the server to clean up
   * @param command - Command used to run the server (npx, docker, etc.)
   * @param args - Command arguments (contains package name)
   */
  async cleanupServer(serverName: string, command: string, args?: string[]): Promise<void> {
    try {
      if (command === 'npx' && args && args.length > 0) {
        // Clean up npm/npx cache for this package
        await this.cleanupNpxPackage(args);
      } else if (command === 'docker' && args && args.length > 0) {
        // Clean up Docker images
        await this.cleanupDockerImage(args);
      }
      // mcp-remote servers don't need cleanup (no local files)
    } catch (error) {
      logger.warn(`Failed to cleanup ${serverName}:`, error);
      // Don't throw - cleanup is best-effort
    }
  }

  /**
   * Clean up npx package cache
   * @param args - Command arguments containing package name
   */
  private async cleanupNpxPackage(args: string[]): Promise<void> {
    // Extract package name from args (skip flags like -y)
    const packageName = args.find(arg => !arg.startsWith('-'));
    
    if (!packageName) {
      return;
    }

    try {
      // Try to remove from npx cache
      // npx cache is typically in ~/.npm/_npx/
      const npxCachePath = path.join(os.homedir(), '.npm', '_npx');
      
      // Check if cache directory exists
      try {
        await fs.access(npxCachePath);
      } catch {
        // Cache directory doesn't exist, nothing to clean
        return;
      }

      // List cache entries
      const entries = await fs.readdir(npxCachePath);
      
      // Find entries matching the package name
      const matchingEntries = entries.filter(entry => 
        entry.includes(packageName.replace(/[@/]/g, '+'))
      );

      // Remove matching cache entries
      for (const entry of matchingEntries) {
        const entryPath = path.join(npxCachePath, entry);
        try {
          await fs.rm(entryPath, { recursive: true, force: true });
          logger.info(`Cleaned up npx cache: ${entry}`);
        } catch (error) {
          logger.warn(`Failed to remove cache entry ${entry}:`, error);
        }
      }

      // Also try npm cache clean for this specific package
      try {
        await execAsync(`npm cache clean ${packageName} --force`, {
          timeout: 5000,
        });
      } catch {
        // Ignore errors - cache clean is best-effort
      }
    } catch (error) {
      logger.warn(`Failed to cleanup npx package ${packageName}:`, error);
    }
  }

  /**
   * Clean up Docker image
   * @param args - Command arguments containing image name
   */
  private async cleanupDockerImage(args: string[]): Promise<void> {
    // Extract image name from args (skip 'run', '-i', etc.)
    const imageName = args.find(arg => 
      !arg.startsWith('-') && arg !== 'run'
    );
    
    if (!imageName) {
      return;
    }

    try {
      // Remove Docker image
      await execAsync(`docker rmi ${imageName}`, {
        timeout: 10000,
      });
      logger.info(`Cleaned up Docker image: ${imageName}`);
    } catch (error) {
      logger.warn(`Failed to cleanup Docker image ${imageName}:`, error);
    }
  }

  /**
   * Clean up all MCP-related cache and temporary files
   * This is a more aggressive cleanup that removes all npx cache
   */
  async cleanupAllCache(): Promise<void> {
    try {
      // Clean npm cache
      await execAsync('npm cache clean --force', {
        timeout: 30000,
      });
      logger.info('Cleaned up npm cache');
    } catch (error) {
      logger.warn('Failed to clean npm cache:', error);
    }
  }

  /**
   * Get estimated cache size for MCP servers
   * @returns Size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      const npxCachePath = path.join(os.homedir(), '.npm', '_npx');
      
      try {
        await fs.access(npxCachePath);
      } catch {
        return 0;
      }

      // Calculate directory size
      const size = await this.getDirectorySize(npxCachePath);
      return size;
    } catch (error) {
      logger.warn('Failed to calculate cache size:', error);
      return 0;
    }
  }

  /**
   * Get size of a directory recursively
   * @param dirPath - Directory path
   * @returns Size in bytes
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          size += await this.getDirectorySize(entryPath);
        } else {
          const stats = await fs.stat(entryPath);
          size += stats.size;
        }
      }
    } catch {
      // Ignore errors for individual files
    }

    return size;
  }

  /**
   * Format bytes to human-readable size
   * @param bytes - Size in bytes
   * @returns Formatted string (e.g., "1.5 MB")
   */
  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// Singleton instance
export const mcpCleanupService = new MCPCleanupService();
