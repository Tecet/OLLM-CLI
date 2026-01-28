/**
 * ExplorerPersistence - Manages state persistence for File Explorer
 *
 * Responsibilities:
 * - Save explorer state to .ollm/explorer-state.json
 * - Load explorer state from disk
 * - Handle corrupted state files gracefully
 * - Persist expanded directories, focused files, and Quick Open history
 *
 * Requirements: 12.1, 12.2, 12.3, 12.5
 */

import * as fs from 'fs';
import * as path from 'path';

import { handleError } from './ErrorHandler.js';

/**
 * Explorer state that gets persisted to disk
 */
export interface ExplorerState {
  /** List of expanded directory paths */
  expandedDirectories: string[];
  /** List of focused file paths */
  focusedFiles: string[];
  /** Quick Open history (most recent first) */
  quickOpenHistory: string[];
  /** Last active project name (if in workspace mode) */
  lastActiveProject: string | null;
}

/**
 * Default state when no persisted state exists or state is corrupted
 */
const DEFAULT_STATE: ExplorerState = {
  expandedDirectories: [],
  focusedFiles: [],
  quickOpenHistory: [],
  lastActiveProject: null,
};

/**
 * Options for ExplorerPersistence
 */
export interface ExplorerPersistenceOptions {
  /** Custom state file path (defaults to .ollm/explorer-state.json) */
  stateFilePath?: string;
  /** If true, suppress warning logs (useful for testing) */
  silent?: boolean;
}

/**
 * ExplorerPersistence handles saving and loading explorer state
 */
export class ExplorerPersistence {
  private stateFilePath: string;
  private silent: boolean;

  /**
   * Create a new ExplorerPersistence instance
   *
   * @param workspaceRoot - Root directory of the workspace
   * @param options - Configuration options
   */
  constructor(workspaceRoot: string, options?: ExplorerPersistenceOptions) {
    this.stateFilePath =
      options?.stateFilePath ?? path.join(workspaceRoot, '.ollm', 'explorer-state.json');
    this.silent = options?.silent ?? false;
  }

  /**
   * Save explorer state to disk
   *
   * Creates the .ollm directory if it doesn't exist.
   * Writes state as formatted JSON for readability.
   *
   * @param state - Explorer state to save
   * @throws Error if unable to write state file
   *
   * Requirement 12.1: Save expanded directory state
   * Requirement 12.2: Persist state across sessions
   * Requirement 12.3: Save focused files list
   */
  saveState(state: ExplorerState): void {
    try {
      // Ensure .ollm directory exists
      const stateDir = path.dirname(this.stateFilePath);
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      // Write state as formatted JSON
      const stateJson = JSON.stringify(state, null, 2);
      fs.writeFileSync(this.stateFilePath, stateJson, 'utf-8');
    } catch (error) {
      const errorInfo = handleError(error, {
        operation: 'saveState',
        stateFilePath: this.stateFilePath,
      });

      throw new Error(`Failed to save explorer state: ${errorInfo.message}`);
    }
  }

  /**
   * Load explorer state from disk
   *
   * Returns default state if:
   * - State file doesn't exist
   * - State file is corrupted/invalid JSON
   * - State file is missing required fields
   *
   * @returns Loaded explorer state or default state
   *
   * Requirement 12.2: Restore expanded directories on startup
   * Requirement 12.3: Restore focused files list
   * Requirement 12.5: Handle corrupted configuration gracefully
   */
  loadState(): ExplorerState {
    try {
      // Check if state file exists
      if (!fs.existsSync(this.stateFilePath)) {
        return { ...DEFAULT_STATE };
      }

      // Read and parse state file
      const stateJson = fs.readFileSync(this.stateFilePath, 'utf-8');
      const rawState = JSON.parse(stateJson);

      // Validate state structure
      if (!this.isValidState(rawState)) {
        if (!this.silent) {
          console.warn('Corrupted explorer state file detected. Resetting to default state.');
        }
        return { ...DEFAULT_STATE };
      }

      // Return validated state with defaults for missing fields
      return {
        expandedDirectories: Array.isArray(rawState.expandedDirectories)
          ? rawState.expandedDirectories
          : [],
        focusedFiles: Array.isArray(rawState.focusedFiles) ? rawState.focusedFiles : [],
        quickOpenHistory: Array.isArray(rawState.quickOpenHistory) ? rawState.quickOpenHistory : [],
        lastActiveProject:
          typeof rawState.lastActiveProject === 'string' || rawState.lastActiveProject === null
            ? rawState.lastActiveProject
            : null,
      };
    } catch (error) {
      // Handle JSON parse errors or file read errors
      if (!this.silent) {
        const errorInfo = handleError(error, {
          operation: 'loadState',
          stateFilePath: this.stateFilePath,
          silent: this.silent,
        });

        console.warn(`Failed to load explorer state: ${errorInfo.message}. Using default state.`);
      }
      return { ...DEFAULT_STATE };
    }
  }

  /**
   * Validate that a raw state object has the correct structure
   *
   * @param state - Raw state object to validate
   * @returns True if state is valid
   */
  private isValidState(state: unknown): state is ExplorerState {
    if (typeof state !== 'object' || state === null) {
      return false;
    }

    const s = state as Record<string, unknown>;

    // Check that all required fields exist
    return (
      'expandedDirectories' in s &&
      'focusedFiles' in s &&
      'quickOpenHistory' in s &&
      'lastActiveProject' in s
    );
  }

  /**
   * Clear all persisted state
   *
   * Deletes the state file if it exists.
   * Useful for testing or resetting to clean state.
   */
  clearState(): void {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        fs.unlinkSync(this.stateFilePath);
      }
    } catch (error) {
      const errorInfo = handleError(error, {
        operation: 'clearState',
        stateFilePath: this.stateFilePath,
      });

      throw new Error(`Failed to clear explorer state: ${errorInfo.message}`);
    }
  }

  /**
   * Check if a persisted state file exists
   *
   * @returns True if state file exists
   */
  hasPersistedState(): boolean {
    return fs.existsSync(this.stateFilePath);
  }

  /**
   * Get the path to the state file
   *
   * @returns Absolute path to state file
   */
  getStateFilePath(): string {
    return this.stateFilePath;
  }
}
