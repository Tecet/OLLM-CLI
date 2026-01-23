/**
 * ExplorerPersistence Tests
 * 
 * Tests for state persistence and restoration
 */

import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ExplorerPersistence } from '../ExplorerPersistence.js';

describe('ExplorerPersistence', () => {
  let persistence: ExplorerPersistence;
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `persist-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    persistence = new ExplorerPersistence(testDir);
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });

  describe('saveState', () => {
    it('should save state to file', () => {
      const state = {
        expandedDirectories: ['/path/to/dir1', '/path/to/dir2'],
        focusedFiles: ['/path/to/file1.txt', '/path/to/file2.txt'],
        quickOpenHistory: ['/recent/file.txt'],
        lastActiveProject: 'my-project',
      };

      persistence.saveState(state);

      const statePath = join(testDir, '.ollm', 'explorer-state.json');
      expect(existsSync(statePath)).toBe(true);
    });

    it('should handle empty state', () => {
      const state = {
        expandedDirectories: [],
        focusedFiles: [],
        quickOpenHistory: [],
        lastActiveProject: null,
      };

      expect(() => persistence.saveState(state)).not.toThrow();
    });
  });

  describe('loadState', () => {
    it('should load saved state', () => {
      const state = {
        expandedDirectories: ['/path/to/dir1'],
        focusedFiles: ['/path/to/file1.txt'],
        quickOpenHistory: ['/recent/file.txt'],
        lastActiveProject: 'test-project',
      };

      persistence.saveState(state);
      const loaded = persistence.loadState();

      expect(loaded.expandedDirectories).toEqual(state.expandedDirectories);
      expect(loaded.focusedFiles).toEqual(state.focusedFiles);
      expect(loaded.quickOpenHistory).toEqual(state.quickOpenHistory);
      expect(loaded.lastActiveProject).toBe(state.lastActiveProject);
    });

    it('should return default state if file does not exist', () => {
      const loaded = persistence.loadState();

      expect(loaded.expandedDirectories).toEqual([]);
      expect(loaded.focusedFiles).toEqual([]);
      expect(loaded.quickOpenHistory).toEqual([]);
      expect(loaded.lastActiveProject).toBeNull();
    });

    it('should handle corrupted state file', () => {
      // Save invalid JSON
      const statePath = join(testDir, '.ollm', 'explorer-state.json');
      mkdirSync(join(testDir, '.ollm'), { recursive: true });
      writeFileSync(statePath, 'invalid json{');

      const loaded = persistence.loadState();

      // Should return default state
      expect(loaded.expandedDirectories).toEqual([]);
    });
  });

  describe('clearState', () => {
    it('should clear saved state', () => {
      const state = {
        expandedDirectories: ['/path/to/dir1'],
        focusedFiles: ['/path/to/file1.txt'],
        quickOpenHistory: [],
        lastActiveProject: null,
      };

      persistence.saveState(state);
      persistence.clearState();

      const loaded = persistence.loadState();
      expect(loaded.expandedDirectories).toEqual([]);
      expect(loaded.focusedFiles).toEqual([]);
    });
  });
});
