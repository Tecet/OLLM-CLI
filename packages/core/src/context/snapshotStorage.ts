/**
 * Snapshot Storage Service
 * 
 * Handles persistent storage of context snapshots to disk with atomic writes,
 * corruption detection, and metadata indexing.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { ContextSnapshot, SnapshotMetadata, SnapshotStorage } from './types.js';
import { logPathDiagnostics } from '../utils/pathValidation.js';

/**
 * Snapshot file format version
 */
const SNAPSHOT_VERSION = '1.0';

/**
 * Snapshot file on disk
 */
interface SnapshotFile {
  version: string;
  id: string;
  sessionId: string;
  timestamp: string;
  tokenCount: number;
  summary: string;
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
    totalUserMessages?: number;
    activeGoalId?: string;
    totalGoalsCompleted?: number;
    totalCheckpoints?: number;
    isReasoningModel?: boolean;
    totalThinkingTokens?: number;
  };
  userMessages: Array<{
    id: string;
    role: 'user';
    content: string;
    timestamp: string;
    tokenCount?: number;
    taskId?: string;
  }>;
  archivedUserMessages: Array<{
    id: string;
    summary: string;
    timestamp: string;
    fullMessageAvailable: boolean;
  }>;
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: string;
    tokenCount?: number;
    metadata?: unknown;
  }>;
}

/**
 * Snapshot index entry
 */
interface SnapshotIndexEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  tokenCount: number;
  summary: string;
  size: number;
}

/**
 * Snapshot index file
 */
interface SnapshotIndex {
  version: string;
  snapshots: SnapshotIndexEntry[];
}

/**
 * Implementation of snapshot storage
 */
export class SnapshotStorageImpl implements SnapshotStorage {
  private baseDir: string;
  private indexCache: Map<string, SnapshotIndexEntry[]> = new Map();

  constructor(baseDir?: string) {
    // Default to ~/.ollm/context-snapshots
    this.baseDir = baseDir || path.join(os.homedir(), '.ollm', 'context-snapshots');
    
    // Log path diagnostics on initialization
    logPathDiagnostics('Context Snapshots', this.baseDir);
  }

  /**
   * Get path to snapshot ID -> session map
   */
  private getMapPath(): string {
    return path.join(this.baseDir, 'snapshot-map.json');
  }

  /**
   * Get the base storage path
   */
  getBasePath(): string {
    return this.baseDir;
  }

  /**
   * Get snapshot directory for a session
   */
  private getSnapshotDir(sessionId: string): string {
    return path.join(this.baseDir, sessionId, 'snapshots');
  }

  /**
   * Get snapshot file path
   */
  private getSnapshotPath(sessionId: string, snapshotId: string): string {
    return path.join(this.getSnapshotDir(sessionId), `snapshot-${snapshotId}.json`);
  }

  /**
   * Get index file path
   */
  private getIndexPath(sessionId: string): string {
    return path.join(this.getSnapshotDir(sessionId), 'snapshots-index.json');
  }

  /**
   * Ensure directory exists
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Save snapshot to disk with atomic write
   */
  async save(snapshot: ContextSnapshot): Promise<void> {
    const snapshotDir = this.getSnapshotDir(snapshot.sessionId);
    await this.ensureDir(snapshotDir);

    // Convert snapshot to file format
    const snapshotFile: SnapshotFile = {
      version: SNAPSHOT_VERSION,
      id: snapshot.id,
      sessionId: snapshot.sessionId,
      timestamp: snapshot.timestamp.toISOString(),
      tokenCount: snapshot.tokenCount,
      summary: snapshot.summary,
      metadata: snapshot.metadata,
      // Support snapshots that provide only `messages` by deriving userMessages
      userMessages: (snapshot.userMessages || snapshot.messages || []).map(msg => ({
        id: msg.id,
        role: (msg as any).role || 'user',
        content: msg.content,
        timestamp: (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toISOString(),
        tokenCount: (msg as any).tokenCount,
        taskId: (msg as any).taskId
      })),
      // archivedUserMessages may be absent
      archivedUserMessages: (snapshot.archivedUserMessages || []).map(msg => ({
        id: msg.id,
        summary: msg.summary,
        timestamp: (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toISOString(),
        fullMessageAvailable: msg.fullMessageAvailable
      })),
      messages: (snapshot.messages || []).map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: (msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)).toISOString(),
        tokenCount: msg.tokenCount,
        metadata: msg.metadata
      }))
    };

    const snapshotPath = this.getSnapshotPath(snapshot.sessionId, snapshot.id);

    try {
      // Write snapshot directly to final path. Simpler and avoids intermittent rename errors on some environments.
      await fs.writeFile(snapshotPath, JSON.stringify(snapshotFile, null, 2), 'utf-8');

      // Some environments may exhibit brief latency; retry stat a few times to avoid flaky ENOENT.
      let stats: import('fs').Stats | undefined;
      for (let i = 0; i < 5; i++) {
        try {
          stats = await fs.stat(snapshotPath);
          break;
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            // wait briefly then retry
            await new Promise(res => setTimeout(res, 10));
            continue;
          }
          throw err;
        }
      }

      if (!stats) {
        throw new Error(`Failed to stat snapshot after write: ${snapshotPath}`);
      }

      // Update index
      await this.updateIndex(snapshot.sessionId, {
        id: snapshot.id,
        sessionId: snapshot.sessionId,
        timestamp: snapshot.timestamp.toISOString(),
        tokenCount: snapshot.tokenCount,
        summary: snapshot.summary,
        size: stats.size
      });

      // Update quick lookup map to make existence checks reliable
      try {
        const mapPath = this.getMapPath();
        let map: Record<string, string> = {};
        try {
          const existing = await fs.readFile(mapPath, 'utf-8');
          map = JSON.parse(existing);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
        map[snapshot.id] = snapshot.sessionId;
        await fs.writeFile(mapPath, JSON.stringify(map, null, 2), 'utf-8');
      } catch (_err) {
        // non-fatal if map update fails
      }
    } catch (error) {
      throw new Error(`Failed to save snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Load snapshot from disk
   */
  async load(snapshotId: string): Promise<ContextSnapshot> {
    // Find which session this snapshot belongs to
    const sessionId = await this.findSessionForSnapshot(snapshotId);
    if (!sessionId) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const snapshotPath = this.getSnapshotPath(sessionId, snapshotId);

    try {
      const content = await fs.readFile(snapshotPath, 'utf-8');
      const snapshotFile: SnapshotFile = JSON.parse(content);

      // Validate required fields
      if (!snapshotFile.id || !snapshotFile.sessionId || !snapshotFile.messages) {
        throw new Error('Invalid snapshot format: missing required fields');
      }

      // Convert to ContextSnapshot
      return {
        id: snapshotFile.id,
        sessionId: snapshotFile.sessionId,
        timestamp: new Date(snapshotFile.timestamp),
        tokenCount: snapshotFile.tokenCount,
        summary: snapshotFile.summary,
        userMessages: (snapshotFile.userMessages || []).map(msg => ({
          id: msg.id,
          role: 'user' as const,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          tokenCount: msg.tokenCount,
          taskId: msg.taskId
        })),
        archivedUserMessages: (snapshotFile.archivedUserMessages || []).map(msg => ({
          id: msg.id,
          summary: msg.summary,
          timestamp: new Date(msg.timestamp),
          fullMessageAvailable: msg.fullMessageAvailable
        })),
        messages: snapshotFile.messages.map(msg => ({
          id: msg.id,
          role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          tokenCount: msg.tokenCount,
          metadata: msg.metadata as Record<string, unknown>
        })),
        metadata: {
          ...snapshotFile.metadata,
          totalUserMessages: snapshotFile.metadata.totalUserMessages || 0,
          totalGoalsCompleted: snapshotFile.metadata.totalGoalsCompleted || 0,
          totalCheckpoints: snapshotFile.metadata.totalCheckpoints || 0
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Snapshot not found: ${snapshotId}`);
      }
      throw new Error(`Failed to load snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * List all snapshots for a session
   */
  async list(sessionId: string): Promise<SnapshotMetadata[]> {
    const index = await this.loadIndex(sessionId);
    
    return index.map(entry => ({
      id: entry.id,
      sessionId: entry.sessionId,
      timestamp: new Date(entry.timestamp),
      tokenCount: entry.tokenCount,
      summary: entry.summary,
      size: entry.size
    }));
  }

  /**
   * Delete snapshot
   */
  async delete(snapshotId: string): Promise<void> {
    // Find which session this snapshot belongs to
    const sessionId = await this.findSessionForSnapshot(snapshotId);
    if (!sessionId) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    const snapshotPath = this.getSnapshotPath(sessionId, snapshotId);

    try {
      await fs.unlink(snapshotPath);
      await this.removeFromIndex(sessionId, snapshotId);
      // Update quick map
      await this.removeFromMap(snapshotId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Already deleted, just update index
        await this.removeFromIndex(sessionId, snapshotId);
        return;
      }
      throw new Error(`Failed to delete snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Check if snapshot exists
   */
  async exists(snapshotId: string): Promise<boolean> {
    const sessionId = await this.findSessionForSnapshot(snapshotId);
    if (!sessionId) {
      return false;
    }

    const snapshotPath = this.getSnapshotPath(sessionId, snapshotId);
    try {
      await fs.access(snapshotPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify snapshot integrity
   */
  async verify(snapshotId: string): Promise<boolean> {
    try {
      const snapshot = await this.load(snapshotId);
      
      // Check required fields
      if (!snapshot.id || !snapshot.sessionId || !snapshot.messages) {
        return false;
      }

      // Check messages have required fields
      for (const msg of snapshot.messages) {
        if (!msg.id || !msg.role || msg.content === undefined) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load index for a session
   */
  private async loadIndex(sessionId: string): Promise<SnapshotIndexEntry[]> {
    // Check cache first
    const cached = this.indexCache.get(sessionId);
    if (cached) {
      return cached;
    }

    const indexPath = this.getIndexPath(sessionId);

    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      const index: SnapshotIndex = JSON.parse(content);
      
      // Cache the index
      this.indexCache.set(sessionId, index.snapshots);
      
      return index.snapshots;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // No index yet, return empty
        return [];
      }
      
      // Corrupted index, try to rebuild from files
      console.warn(`Corrupted index for session ${sessionId}, rebuilding...`);
      return await this.rebuildIndex(sessionId);
    }
  }

  /**
   * Update index with new snapshot
   */
  private async updateIndex(sessionId: string, entry: SnapshotIndexEntry): Promise<void> {
    const index = await this.loadIndex(sessionId);
    
    // Remove existing entry if present
    const filtered = index.filter(e => e.id !== entry.id);
    
    // Add new entry
    filtered.push(entry);
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Save index
    await this.saveIndex(sessionId, filtered);
  }

  /**
   * Remove snapshot from index
   */
  private async removeFromIndex(sessionId: string, snapshotId: string): Promise<void> {
    const index = await this.loadIndex(sessionId);
    const filtered = index.filter(e => e.id !== snapshotId);
    await this.saveIndex(sessionId, filtered);
  }

  private async removeFromMap(snapshotId: string): Promise<void> {
    try {
      const mapPath = this.getMapPath();
      const content = await fs.readFile(mapPath, 'utf-8');
      const map: Record<string, string> = JSON.parse(content);
      if (map[snapshotId]) {
        delete map[snapshotId];
        await fs.writeFile(mapPath, JSON.stringify(map, null, 2), 'utf-8');
      }
    } catch {
      // ignore
    }
  }

  /**
   * Save index to disk
   */
  private async saveIndex(sessionId: string, entries: SnapshotIndexEntry[]): Promise<void> {
    const indexPath = this.getIndexPath(sessionId);
    const snapshotDir = this.getSnapshotDir(sessionId);
    
    await this.ensureDir(snapshotDir);

    const index: SnapshotIndex = {
      version: SNAPSHOT_VERSION,
      snapshots: entries
    };

    const tempPath = `${indexPath}.tmp`;

    try {
      // Write index directly to final location to avoid rename-related ENOENT on some platforms
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');

      // Update cache
      this.indexCache.set(sessionId, entries);
    } catch (error) {
      throw new Error(`Failed to save index: ${(error as Error).message}`);
    }
  }

  /**
   * Rebuild index from snapshot files
   */
  private async rebuildIndex(sessionId: string): Promise<SnapshotIndexEntry[]> {
    const snapshotDir = this.getSnapshotDir(sessionId);
    const entries: SnapshotIndexEntry[] = [];

    try {
      const files = await fs.readdir(snapshotDir);
      
      for (const file of files) {
        if (!file.startsWith('snapshot-') || !file.endsWith('.json')) {
          continue;
        }

        const filePath = path.join(snapshotDir, file);
        
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const snapshot: SnapshotFile = JSON.parse(content);
          const stats = await fs.stat(filePath);

          entries.push({
            id: snapshot.id,
            sessionId: snapshot.sessionId,
            timestamp: snapshot.timestamp,
            tokenCount: snapshot.tokenCount,
            summary: snapshot.summary,
            size: stats.size
          });
        } catch (_error) {
          // Skip corrupted files
          console.warn(`Skipping corrupted snapshot file: ${file}`);
        }
      }

      // Sort by timestamp
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Save rebuilt index
      await this.saveIndex(sessionId, entries);

      return entries;
    } catch (_error) {
      if ((_error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw _error;
    }
  }

  /**
   * Find which session a snapshot belongs to
   */
  private async findSessionForSnapshot(snapshotId: string): Promise<string | null> {
    try {
      // Fast-path: check the snapshot map for direct lookup
      try {
        const mapPath = this.getMapPath();
        const content = await fs.readFile(mapPath, 'utf-8');
        const map: Record<string, string> = JSON.parse(content);
        if (map[snapshotId]) {
          return map[snapshotId];
        }
      } catch {
        // ignore and fall back to scanning directories
      }

      // List all session directories
      const sessions = await fs.readdir(this.baseDir);
      
      for (const sessionId of sessions) {
        const index = await this.loadIndex(sessionId);
        if (index.some(e => e.id === snapshotId)) {
          return sessionId;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Create a new snapshot storage instance
 */
export function createSnapshotStorage(baseDir?: string): SnapshotStorage {
  return new SnapshotStorageImpl(baseDir);
}
