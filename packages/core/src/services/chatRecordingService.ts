/**
 * ChatRecordingService - Handles session persistence and management
 * 
 * Responsibilities:
 * - Create and manage chat sessions
 * - Record messages and tool calls to disk
 * - Load and list existing sessions
 * - Enforce session count limits
 * - Provide atomic writes for data durability
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, unlink, rename, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { sanitizeErrorMessage } from './errorSanitization.js';
import { validateStoragePath, logPathDiagnostics } from '../utils/pathValidation.js';

import type {
  Session,
  SessionMessage,
  SessionToolCall,
  SessionSummary,
} from './types.js';

/**
 * Configuration options for ChatRecordingService
 */
export interface ChatRecordingServiceConfig {
  dataDir?: string;
  maxSessions?: number;
  autoSave?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<ChatRecordingServiceConfig> = {
  dataDir: join(homedir(), '.ollm', 'sessions'),
  maxSessions: 100,
  autoSave: true,
};

/**
 * ChatRecordingService implementation
 */
export class ChatRecordingService {
  private config: Required<ChatRecordingServiceConfig>;
  private sessionCache: Map<string, Session>;

  constructor(config: ChatRecordingServiceConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionCache = new Map();
    
    // Log path diagnostics on initialization
    logPathDiagnostics('Sessions', this.config.dataDir);
  }

  /**
   * Create a new session
   */
  async createSession(model: string, provider: string): Promise<string> {
    const sessionId = randomUUID();
    const now = new Date().toISOString();

    const session: Session = {
      sessionId,
      startTime: now,
      lastActivity: now,
      model,
      provider,
      messages: [],
      toolCalls: [],
      metadata: {
        tokenCount: 0,
        compressionCount: 0,
      },
    };

    // Cache the session
    this.sessionCache.set(sessionId, session);

    // Ensure data directory exists
    await this.ensureDataDir();

    // Save initial session file
    await this.saveSession(sessionId);

    return sessionId;
  }

  /**
   * Record a message to a session
   */
  async recordMessage(sessionId: string, message: SessionMessage): Promise<void> {
    const session = await this.getOrLoadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add message to session
    session.messages.push(message);
    session.lastActivity = new Date().toISOString();

    // Update cache
    this.sessionCache.set(sessionId, session);

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }
  }

  /**
   * Record a tool call to a session
   */
  async recordToolCall(sessionId: string, toolCall: SessionToolCall): Promise<void> {
    const session = await this.getOrLoadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add tool call to session
    session.toolCalls.push(toolCall);
    session.lastActivity = new Date().toISOString();

    // Update cache
    this.sessionCache.set(sessionId, session);

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    return this.getOrLoadSession(sessionId);
  }

  /**
   * List all sessions with summary information
   */
  async listSessions(): Promise<SessionSummary[]> {
    await this.ensureDataDir();

    try {
      const files = await readdir(this.config.dataDir);
      const sessionFiles = files.filter(f => f.endsWith('.json'));

      const summaries: SessionSummary[] = [];

      for (const file of sessionFiles) {
        try {
          const sessionId = file.replace('.json', '');
          const session = await this.loadSessionFromDisk(sessionId);

          if (session) {
            summaries.push({
              sessionId: session.sessionId,
              startTime: session.startTime,
              lastActivity: session.lastActivity,
              model: session.model,
              messageCount: session.messages.length,
              tokenCount: session.metadata.tokenCount,
            });
          }
        } catch (error) {
          // Skip corrupted session files
          // Only log error if not in a test environment
          if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Failed to load session ${file}:`, sanitizeErrorMessage(errorMessage));
          }
        }
      }

      // Sort by lastActivity (most recent first)
      summaries.sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      return summaries;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to list sessions:', sanitizeErrorMessage(errorMessage));
      return [];
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Remove from cache
    this.sessionCache.delete(sessionId);

    // Delete file
    const filePath = this.getSessionFilePath(sessionId);
    try {
      await unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Delete oldest sessions to enforce session count limit
   */
  async deleteOldestSessions(keepCount: number): Promise<void> {
    const sessions = await this.listSessions();

    if (sessions.length <= keepCount) {
      return;
    }

    // Sessions are already sorted by lastActivity (most recent first)
    const sessionsToDelete = sessions.slice(keepCount);

    for (const session of sessionsToDelete) {
      await this.deleteSession(session.sessionId);
    }
  }

  /**
   * Update mode history in session metadata
   */
  async updateModeHistory(
    sessionId: string,
    modeTransition: {
      from: string;
      to: string;
      timestamp: string;
      trigger: 'auto' | 'manual' | 'tool' | 'explicit';
      confidence: number;
    }
  ): Promise<void> {
    const session = await this.getOrLoadSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Initialize mode history if it doesn't exist
    if (!session.metadata.modeHistory) {
      session.metadata.modeHistory = [];
    }

    // Add the new transition
    session.metadata.modeHistory.push(modeTransition);

    // Keep only last 100 transitions to avoid unbounded growth
    if (session.metadata.modeHistory.length > 100) {
      session.metadata.modeHistory = session.metadata.modeHistory.slice(-100);
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();

    // Update cache
    this.sessionCache.set(sessionId, session);

    // Auto-save if enabled
    if (this.config.autoSave) {
      await this.saveSession(sessionId);
    }
  }

  /**
   * Save a session to disk (atomic write with durability guarantees)
   */
  async saveSession(sessionId: string): Promise<void> {
    const session = this.sessionCache.get(sessionId);
    if (!session) {
      throw new Error(`Session not in cache: ${sessionId}`);
    }

    await this.ensureDataDir();

    const filePath = this.getSessionFilePath(sessionId);
    const tempPath = `${filePath}.tmp`;

    try {
      // Write to temp file
      const json = JSON.stringify(session, null, 2);
      await writeFile(tempPath, json, 'utf-8');

      // Flush to disk for durability (Requirements 9.3, 9.6)
      // Open the file and call fsync to ensure data is written to disk
      const fileHandle = await open(tempPath, 'r+');
      try {
        await fileHandle.sync();
      } finally {
        await fileHandle.close();
      }

      // Atomic rename
      await rename(tempPath, filePath);

      // Try to flush the directory to ensure the rename is durable
      // Note: This may fail on some platforms (e.g., Windows), which is acceptable
      try {
        const dirHandle = await open(this.config.dataDir, 'r');
        try {
          await dirHandle.sync();
        } finally {
          await dirHandle.close();
        }
      } catch (_error) {
        // Ignore directory sync errors (not supported on all platforms)
        // The file sync above provides sufficient durability for the data
      }
    } catch (error) {
      // Clean up temp file on error
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Get or load a session (from cache or disk)
   */
  private async getOrLoadSession(sessionId: string): Promise<Session | null> {
    // Check cache first
    const cached = this.sessionCache.get(sessionId);
    if (cached) {
      return cached;
    }

    // Load from disk
    const session = await this.loadSessionFromDisk(sessionId);
    if (session) {
      this.sessionCache.set(sessionId, session);
    }

    return session;
  }

  /**
   * Load a session from disk
   */
  private async loadSessionFromDisk(sessionId: string): Promise<Session | null> {
    const filePath = this.getSessionFilePath(sessionId);

    try {
      const json = await readFile(filePath, 'utf-8');
      const session = JSON.parse(json) as Session;
      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get the file path for a session
   */
  private getSessionFilePath(sessionId: string): string {
    return join(this.config.dataDir, `${sessionId}.json`);
  }

  /**
   * Ensure the data directory exists
   */
  private async ensureDataDir(): Promise<void> {
    // Validate path before creating
    const validation = validateStoragePath(this.config.dataDir, true);
    
    if (!validation.valid) {
      throw new Error(`Invalid session storage path: ${validation.error}`);
    }
    
    try {
      await mkdir(this.config.dataDir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
  
  /**
   * Get the data directory path
   */
  getDataDir(): string {
    return this.config.dataDir;
  }
}
