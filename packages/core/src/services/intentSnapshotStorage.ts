/**
 * Intent Snapshot Storage Service
 * 
 * Stores intent snapshots for RAG and memory retrieval.
 * Snapshots capture user intent extraction for future reference.
 */

import { promises as fs } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { IntentSnapshot } from './inputPreprocessor.js';

/**
 * Intent Snapshot Storage
 * 
 * Manages persistent storage of intent snapshots
 */
export class IntentSnapshotStorage {
  private basePath: string;

  constructor(basePath?: string) {
    // Default to ~/.ollm/intent-snapshots/
    this.basePath = basePath || join(homedir(), '.ollm', 'intent-snapshots');
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (_error) {
      // Directory might already exist, ignore
    }
  }

  /**
   * Get snapshot file path
   */
  private getSnapshotPath(snapshotId: string): string {
    return join(this.basePath, `${snapshotId}.json`);
  }

  /**
   * Save intent snapshot
   */
  async save(snapshot: IntentSnapshot): Promise<void> {
    await this.ensureDirectory();
    
    const filePath = this.getSnapshotPath(snapshot.id);
    const data = JSON.stringify(snapshot, null, 2);
    
    await fs.writeFile(filePath, data, 'utf-8');
  }

  /**
   * Load intent snapshot
   */
  async load(snapshotId: string): Promise<IntentSnapshot | null> {
    try {
      const filePath = this.getSnapshotPath(snapshotId);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as IntentSnapshot;
    } catch (_error) {
      // Snapshot not found
      return null;
    }
  }

  /**
   * List all snapshots
   */
  async list(): Promise<IntentSnapshot[]> {
    try {
      await this.ensureDirectory();
      const files = await fs.readdir(this.basePath);
      
      const snapshots: IntentSnapshot[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const snapshotId = file.replace('.json', '');
          const snapshot = await this.load(snapshotId);
          if (snapshot) {
            snapshots.push(snapshot);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      return snapshots.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (_error) {
      return [];
    }
  }

  /**
   * Delete intent snapshot
   */
  async delete(snapshotId: string): Promise<void> {
    try {
      const filePath = this.getSnapshotPath(snapshotId);
      await fs.unlink(filePath);
    } catch (_error) {
      // Snapshot not found, ignore
    }
  }

  /**
   * Search snapshots by intent text
   */
  async search(query: string): Promise<IntentSnapshot[]> {
    const allSnapshots = await this.list();
    const lowerQuery = query.toLowerCase();
    
    return allSnapshots.filter(snapshot => 
      snapshot.extracted.intent.toLowerCase().includes(lowerQuery) ||
      snapshot.extracted.keyPoints.some(point => 
        point.toLowerCase().includes(lowerQuery)
      )
    );
  }

  /**
   * Get recent snapshots
   */
  async getRecent(limit: number = 10): Promise<IntentSnapshot[]> {
    const allSnapshots = await this.list();
    return allSnapshots.slice(0, limit);
  }

  /**
   * Clean up old snapshots (keep last N)
   */
  async cleanup(keepCount: number = 100): Promise<number> {
    const allSnapshots = await this.list();
    
    if (allSnapshots.length <= keepCount) {
      return 0;
    }
    
    const toDelete = allSnapshots.slice(keepCount);
    
    for (const snapshot of toDelete) {
      await this.delete(snapshot.id);
    }
    
    return toDelete.length;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalSnapshots: number;
    totalSize: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  }> {
    const snapshots = await this.list();
    
    if (snapshots.length === 0) {
      return {
        totalSnapshots: 0,
        totalSize: 0,
        oldestSnapshot: null,
        newestSnapshot: null,
      };
    }
    
    // Calculate total size
    let totalSize = 0;
    for (const snapshot of snapshots) {
      try {
        const filePath = this.getSnapshotPath(snapshot.id);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch (_error) {
        // Ignore errors
      }
    }
    
    return {
      totalSnapshots: snapshots.length,
      totalSize,
      oldestSnapshot: new Date(snapshots[snapshots.length - 1].timestamp),
      newestSnapshot: new Date(snapshots[0].timestamp),
    };
  }
}

/**
 * Create intent snapshot storage instance
 */
export function createIntentSnapshotStorage(basePath?: string): IntentSnapshotStorage {
  return new IntentSnapshotStorage(basePath);
}
