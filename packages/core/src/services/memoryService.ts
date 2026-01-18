/**
 * Memory Service for cross-session persistence
 * Stores facts, preferences, and context across sessions
 * Feature: stage-07-model-management
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Category of memory entry
 */
export type MemoryCategory = 'fact' | 'preference' | 'context';

/**
 * Source of memory entry
 */
export type MemorySource = 'user' | 'llm' | 'system';

/**
 * A single memory entry
 */
export interface MemoryEntry {
  key: string;
  value: string;
  category: MemoryCategory;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
  source: MemorySource;
}

/**
 * Options for remembering a value
 */
export interface RememberOptions {
  category?: MemoryCategory;
  source?: MemorySource;
}

/**
 * Storage format for memory file
 */
interface MemoryStorage {
  version: number;
  memories: Array<{
    key: string;
    value: string;
    category: MemoryCategory;
    createdAt: string;
    updatedAt: string;
    accessCount: number;
    source: MemorySource;
  }>;
}

/**
 * Configuration for MemoryService
 */
export interface MemoryServiceConfig {
  /**
   * Path to memory file (default: ~/.ollm/memory.json)
   */
  memoryPath?: string;

  /**
   * Token budget for system prompt injection (default: 500)
   */
  tokenBudget?: number;

  /**
   * Whether to enable memory service (default: true)
   */
  enabled?: boolean;
}

/**
 * Service for managing cross-session memory
 */
export class MemoryService {
  private memories: Map<string, MemoryEntry> = new Map();
  private memoryPath: string;
  private tokenBudget: number;
  private enabled: boolean;
  private loaded: boolean = false;
  private savePromise: Promise<void> | null = null;

  constructor(config: MemoryServiceConfig = {}) {
    this.memoryPath =
      config.memoryPath || join(homedir(), '.ollm', 'memory.json');
    this.tokenBudget = config.tokenBudget ?? 500;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Load memories from disk
   */
  async load(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const data = await fs.readFile(this.memoryPath, 'utf-8');
      const storage: MemoryStorage = JSON.parse(data);

      // Validate version
      if (storage.version !== 1) {
        throw new Error(`Unsupported memory file version: ${storage.version}`);
      }

      // Load memories
      this.memories.clear();
      for (const mem of storage.memories) {
        this.memories.set(mem.key, {
          key: mem.key,
          value: mem.value,
          category: mem.category,
          createdAt: new Date(mem.createdAt),
          updatedAt: new Date(mem.updatedAt),
          accessCount: mem.accessCount,
          source: mem.source,
        });
      }

      this.loaded = true;
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // File doesn't exist yet, that's okay
        this.loaded = true;
        return;
      }
      const message = err.message || String(error);
      throw new Error(`Failed to load memories: ${message}`);
    }
  }

  /**
   * Save memories to disk
   * Serializes concurrent saves to prevent race conditions
   */
  async save(): Promise<void> {
    if (!this.enabled) {
      return;
    }

    // Serialize saves to prevent race conditions
    if (this.savePromise) {
      await this.savePromise;
    }

    this.savePromise = this.performSave();
    try {
      await this.savePromise;
    } finally {
      this.savePromise = null;
    }
  }

  /**
   * Perform the actual save operation
   */
  private async performSave(): Promise<void> {
    const storage: MemoryStorage = {
      version: 1,
      memories: Array.from(this.memories.values()).map((mem) => ({
        key: mem.key,
        value: mem.value,
        category: mem.category,
        createdAt: mem.createdAt.toISOString(),
        updatedAt: mem.updatedAt.toISOString(),
        accessCount: mem.accessCount,
        source: mem.source,
      })),
    };

    try {
      // Ensure directory exists
      await fs.mkdir(dirname(this.memoryPath), { recursive: true });

      // Write atomically by writing to temp file then renaming
      // Use unique temp file name to avoid race conditions with concurrent saves
      const tempPath = `${this.memoryPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 9)}`;
      await fs.writeFile(tempPath, JSON.stringify(storage, null, 2), 'utf-8');
      await fs.rename(tempPath, this.memoryPath);
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException;
      const message = err.message || String(error);
      throw new Error(`Failed to save memories: ${message}`);
    }
  }

  /**
   * Store a memory
   */
  remember(key: string, value: string, options: RememberOptions = {}): void {
    if (!this.enabled) {
      return;
    }

    const now = new Date();
    const existing = this.memories.get(key);

    if (existing) {
      // Update existing memory
      existing.value = value;
      existing.updatedAt = now;
      if (options.category) {
        existing.category = options.category;
      }
      if (options.source) {
        existing.source = options.source;
      }
    } else {
      // Create new memory
      this.memories.set(key, {
        key,
        value,
        category: options.category || 'context',
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        source: options.source || 'user',
      });
    }
  }

  /**
   * Retrieve a memory
   */
  recall(key: string): MemoryEntry | null {
    if (!this.enabled) {
      return null;
    }

    const memory = this.memories.get(key);
    if (memory) {
      // Update access count and timestamp
      memory.accessCount++;
      memory.updatedAt = new Date();
      return memory;
    }
    return null;
  }

  /**
   * Search memories by key or value
   */
  search(query: string): MemoryEntry[] {
    if (!this.enabled) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: MemoryEntry[] = [];

    for (const memory of Array.from(this.memories.values())) {
      if (
        memory.key.toLowerCase().includes(lowerQuery) ||
        memory.value.toLowerCase().includes(lowerQuery)
      ) {
        results.push(memory);
      }
    }

    return results;
  }

  /**
   * Delete a memory
   */
  forget(key: string): void {
    if (!this.enabled) {
      return;
    }

    this.memories.delete(key);
  }

  /**
   * List all memories
   */
  listAll(): MemoryEntry[] {
    if (!this.enabled) {
      return [];
    }

    return Array.from(this.memories.values());
  }

  /**
   * Get system prompt addition with memories
   * Respects token budget and prioritizes by access count and recency
   */
  getSystemPromptAddition(): string {
    if (!this.enabled || this.memories.size === 0) {
      return '';
    }

    // Sort memories by priority (access count desc, then recency desc)
    const sortedMemories = Array.from(this.memories.values()).sort((a, b) => {
      // First by access count
      if (b.accessCount !== a.accessCount) {
        return b.accessCount - a.accessCount;
      }
      // Then by recency
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    // Build memory section within token budget
    // Rough estimate: 1 token ≈ 4 characters
    const maxChars = this.tokenBudget * 4;
    const lines: string[] = ['## Remembered Context'];
    let currentLength = lines[0].length + 1; // +1 for newline

    for (const memory of sortedMemories) {
      const line = `- ${memory.key}: ${memory.value}`;
      const lineLength = line.length + 1; // +1 for newline

      if (currentLength + lineLength > maxChars) {
        break;
      }

      lines.push(line);
      currentLength += lineLength;
    }

    // Only return if we have memories to include
    if (lines.length === 1) {
      return '';
    }

    return lines.join('\n');
  }

  /**
   * Check if service is loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Get memory count
   */
  count(): number {
    return this.memories.size;
  }
}
