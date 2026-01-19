/**
 * MCP Configuration Backup and Restore Service
 * 
 * Handles automatic backup creation and restoration of MCP configuration files
 * to prevent data loss from corruption or errors.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { MCPConfigFile } from './mcpConfigService.js';

/**
 * Backup metadata
 */
export interface BackupMetadata {
  /** Timestamp when backup was created */
  timestamp: number;
  /** Original file path */
  originalPath: string;
  /** Backup file path */
  backupPath: string;
  /** Reason for backup */
  reason: string;
}

/**
 * MCP Configuration Backup Service
 */
export class MCPConfigBackupService {
  private backupDir: string;
  private maxBackups: number;

  constructor(maxBackups: number = 10) {
    // Store backups in ~/.ollm/mcp/backups/
    this.backupDir = path.join(
      os.homedir(),
      '.ollm',
      'mcp',
      'backups'
    );
    this.maxBackups = maxBackups;
  }

  /**
   * Create a backup of the configuration file
   * @param configPath - Path to the configuration file
   * @param reason - Reason for creating the backup
   * @returns Backup metadata
   */
  async createBackup(configPath: string, reason: string): Promise<BackupMetadata> {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirExists();

      // Check if source file exists
      if (!fs.existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      // Generate backup filename with timestamp
      const timestamp = Date.now();
      const basename = path.basename(configPath, '.json');
      const backupFilename = `${basename}-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupFilename);

      // Copy file to backup location
      await fs.promises.copyFile(configPath, backupPath);

      // Create metadata file
      const metadata: BackupMetadata = {
        timestamp,
        originalPath: configPath,
        backupPath,
        reason,
      };

      const metadataPath = `${backupPath}.meta`;
      await fs.promises.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      // Clean up old backups
      await this.cleanupOldBackups();

      return metadata;
    } catch (error) {
      throw new Error(
        `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Restore configuration from the most recent backup
   * @param configPath - Path to the configuration file to restore
   * @returns True if restoration was successful
   */
  async restoreFromBackup(configPath: string): Promise<boolean> {
    try {
      // Find the most recent backup for this config file
      const backup = await this.findMostRecentBackup(configPath);

      if (!backup) {
        console.warn('No backup found for restoration');
        return false;
      }

      // Verify backup file exists and is valid JSON
      const backupContent = await fs.promises.readFile(backup.backupPath, 'utf-8');
      JSON.parse(backupContent); // Validate JSON

      // Create a backup of the current (corrupted) file before restoring
      const corruptedBackupPath = `${configPath}.corrupted-${Date.now()}`;
      if (fs.existsSync(configPath)) {
        await fs.promises.copyFile(configPath, corruptedBackupPath);
      }

      // Restore from backup
      await fs.promises.copyFile(backup.backupPath, configPath);

      console.log(`Configuration restored from backup: ${backup.backupPath}`);
      console.log(`Corrupted file saved to: ${corruptedBackupPath}`);

      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  /**
   * Restore configuration from a specific backup
   * @param backupPath - Path to the backup file
   * @param configPath - Path to the configuration file to restore
   * @returns True if restoration was successful
   */
  async restoreFromSpecificBackup(
    backupPath: string,
    configPath: string
  ): Promise<boolean> {
    try {
      // Verify backup file exists and is valid JSON
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      const backupContent = await fs.promises.readFile(backupPath, 'utf-8');
      JSON.parse(backupContent); // Validate JSON

      // Create a backup of the current file before restoring
      if (fs.existsSync(configPath)) {
        const currentBackupPath = `${configPath}.before-restore-${Date.now()}`;
        await fs.promises.copyFile(configPath, currentBackupPath);
      }

      // Restore from backup
      await fs.promises.copyFile(backupPath, configPath);

      console.log(`Configuration restored from: ${backupPath}`);

      return true;
    } catch (error) {
      console.error('Failed to restore from specific backup:', error);
      return false;
    }
  }

  /**
   * List all available backups for a configuration file
   * @param configPath - Path to the configuration file
   * @returns Array of backup metadata, sorted by timestamp (newest first)
   */
  async listBackups(configPath: string): Promise<BackupMetadata[]> {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      // Read all files in backup directory
      const files = await fs.promises.readdir(this.backupDir);

      // Filter for metadata files
      const metadataFiles = files.filter(f => f.endsWith('.meta'));

      // Read and parse metadata
      const backups: BackupMetadata[] = [];
      for (const metaFile of metadataFiles) {
        try {
          const metaPath = path.join(this.backupDir, metaFile);
          const content = await fs.promises.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(content) as BackupMetadata;

          // Filter by original path
          if (metadata.originalPath === configPath) {
            backups.push(metadata);
          }
        } catch (error) {
          console.warn(`Failed to read metadata file ${metaFile}:`, error);
        }
      }

      // Sort by timestamp (newest first)
      backups.sort((a, b) => b.timestamp - a.timestamp);

      return backups;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Validate a configuration file
   * @param configPath - Path to the configuration file
   * @returns True if valid, false otherwise
   */
  async validateConfig(configPath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(configPath)) {
        return false;
      }

      const content = await fs.promises.readFile(configPath, 'utf-8');
      const config = JSON.parse(content) as MCPConfigFile;

      // Basic validation
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to recover from a corrupted configuration file
   * @param configPath - Path to the corrupted configuration file
   * @returns True if recovery was successful
   */
  async recoverFromCorruption(configPath: string): Promise<boolean> {
    console.log('Attempting to recover from configuration corruption...');

    // First, try to restore from the most recent backup
    const restored = await this.restoreFromBackup(configPath);

    if (restored) {
      console.log('Configuration successfully restored from backup');
      return true;
    }

    // If no backup available, check if the current file is actually corrupted
    // Don't overwrite a valid config just because backups don't exist!
    try {
      if (fs.existsSync(configPath)) {
        const content = await fs.promises.readFile(configPath, 'utf-8');
        const data = JSON.parse(content);
        
        // If we can parse it and it has the right structure, it's not corrupted
        if (data && typeof data === 'object' && data.mcpServers && typeof data.mcpServers === 'object') {
          console.log('Current configuration is valid, not overwriting');
          return true; // File is fine, no need to create empty config
        }
      }
    } catch (_checkError) {
      // File is truly corrupted or missing, proceed to create empty config
      console.log('Configuration is truly corrupted or missing');
    }

    // Only create empty config if file is missing or truly corrupted
    console.log('No backup available and file is corrupted/missing, creating new empty configuration');

    try {
      const emptyConfig: MCPConfigFile = {
        mcpServers: {},
      };

      // Ensure directory exists
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      // Write empty configuration
      await fs.promises.writeFile(
        configPath,
        JSON.stringify(emptyConfig, null, 2),
        'utf-8'
      );

      console.log('New empty configuration created');
      return true;
    } catch (error) {
      console.error('Failed to create new configuration:', error);
      return false;
    }
  }

  /**
   * Find the most recent backup for a configuration file
   * @param configPath - Path to the configuration file
   * @returns Most recent backup metadata, or null if none found
   */
  private async findMostRecentBackup(
    configPath: string
  ): Promise<BackupMetadata | null> {
    const backups = await this.listBackups(configPath);
    return backups.length > 0 ? backups[0] : null;
  }

  /**
   * Clean up old backups, keeping only the most recent ones
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      // Read all files in backup directory
      const files = await fs.promises.readdir(this.backupDir);

      // Filter for metadata files
      const metadataFiles = files.filter(f => f.endsWith('.meta'));

      // Read and parse metadata
      const backups: BackupMetadata[] = [];
      for (const metaFile of metadataFiles) {
        try {
          const metaPath = path.join(this.backupDir, metaFile);
          const content = await fs.promises.readFile(metaPath, 'utf-8');
          const metadata = JSON.parse(content) as BackupMetadata;
          backups.push(metadata);
        } catch (error) {
          console.warn(`Failed to read metadata file ${metaFile}:`, error);
        }
      }

      // Sort by timestamp (oldest first)
      backups.sort((a, b) => a.timestamp - b.timestamp);

      // Delete old backups if we exceed the limit
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(0, backups.length - this.maxBackups);

        for (const backup of toDelete) {
          try {
            // Delete backup file
            if (fs.existsSync(backup.backupPath)) {
              await fs.promises.unlink(backup.backupPath);
            }

            // Delete metadata file
            const metaPath = `${backup.backupPath}.meta`;
            if (fs.existsSync(metaPath)) {
              await fs.promises.unlink(metaPath);
            }
          } catch (error) {
            console.warn(`Failed to delete old backup ${backup.backupPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDirExists(): Promise<void> {
    if (!fs.existsSync(this.backupDir)) {
      await fs.promises.mkdir(this.backupDir, { recursive: true });
    }
  }
}

// Singleton instance
export const mcpConfigBackup = new MCPConfigBackupService();
