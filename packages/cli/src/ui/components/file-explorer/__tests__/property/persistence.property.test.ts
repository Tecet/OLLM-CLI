/**
 * Property-based tests for ExplorerPersistence
 * 
 * These tests validate universal properties that should hold for state
 * persistence operations using fast-check for property-based testing.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExplorerPersistence, type ExplorerState } from '../../ExplorerPersistence.js';

/**
 * Helper function to create a temporary directory
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'persistence-test-'));
}

/**
 * Helper function to clean up a directory recursively
 */
function cleanupDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Arbitrary generator for file paths
 */
const filePathArbitrary = fc.array(
  fc.string({ minLength: 1, maxLength: 20 })
    .filter(s => !s.includes('\0') && !s.includes('/') && !s.includes('\\')),
  { minLength: 1, maxLength: 3 }
).map(parts => '/' + parts.join('/'));

/**
 * Arbitrary generator for ExplorerState
 */
const explorerStateArbitrary = fc.record({
  expandedDirectories: fc.array(filePathArbitrary, { maxLength: 10 }),
  focusedFiles: fc.array(filePathArbitrary, { maxLength: 5 }),
  quickOpenHistory: fc.array(filePathArbitrary, { maxLength: 20 }),
  lastActiveProject: fc.oneof(
    fc.constant(null),
    fc.string({ minLength: 1, maxLength: 30 })
      .filter(s => !s.includes('/') && !s.includes('\\'))
  ),
});

describe('ExplorerPersistence - Property Tests', () => {
  let tempDirs: string[] = [];

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    // Clean up all temporary directories
    tempDirs.forEach(dir => cleanupDir(dir));
  });

  /**
   * Property 40: Explorer State Persistence Round-Trip
   * 
   * For any set of expanded directories and focused files, saving the state
   * and then loading it should restore the exact same set of expanded
   * directories and focused files.
   * 
   * Validates: Requirements 12.1, 12.2, 12.3
   */
  test('Property 40: Explorer State Persistence Round-Trip', () => {
    fc.assert(
      fc.property(
        explorerStateArbitrary,
        (originalState) => {
          // Create temporary workspace directory
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          // Create persistence instance
          const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

          // Save the state
          persistence.saveState(originalState);

          // Verify state file was created
          expect(persistence.hasPersistedState()).toBe(true);

          // Load the state
          const loadedState = persistence.loadState();

          // Verify round-trip: loaded state should match original state
          expect(loadedState.expandedDirectories).toEqual(originalState.expandedDirectories);
          expect(loadedState.focusedFiles).toEqual(originalState.focusedFiles);
          expect(loadedState.quickOpenHistory).toEqual(originalState.quickOpenHistory);
          expect(loadedState.lastActiveProject).toEqual(originalState.lastActiveProject);

          // Verify the state file exists at the expected location
          const expectedPath = path.join(workspaceDir, '.ollm', 'explorer-state.json');
          expect(fs.existsSync(expectedPath)).toBe(true);

          // Verify the file contains valid JSON
          const fileContent = fs.readFileSync(expectedPath, 'utf-8');
          const parsedContent = JSON.parse(fileContent);
          expect(parsedContent).toEqual(originalState);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 40a: Multiple Save/Load Cycles Preserve State
   * 
   * Performing multiple save/load cycles should preserve state integrity.
   */
  test('Property 40a: Multiple Save/Load Cycles Preserve State', () => {
    fc.assert(
      fc.property(
        fc.array(explorerStateArbitrary, { minLength: 2, maxLength: 5 }),
        (states) => {
          // Create temporary workspace directory
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          // Create persistence instance
          const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

          // Perform multiple save/load cycles
          for (const state of states) {
            persistence.saveState(state);
            const loadedState = persistence.loadState();

            // Verify each cycle preserves state
            expect(loadedState).toEqual(state);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 40b: Empty State Persists Correctly
   * 
   * Empty state (no expanded directories, no focused files) should persist
   * and load correctly.
   */
  test('Property 40b: Empty State Persists Correctly', () => {
    const workspaceDir = createTempDir();
    tempDirs.push(workspaceDir);

    const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

    const emptyState: ExplorerState = {
      expandedDirectories: [],
      focusedFiles: [],
      quickOpenHistory: [],
      lastActiveProject: null,
    };

    persistence.saveState(emptyState);
    const loadedState = persistence.loadState();

    expect(loadedState).toEqual(emptyState);
  });

  /**
   * Property 40c: State with Duplicate Paths Persists Correctly
   * 
   * State containing duplicate paths should persist and load correctly
   * (duplicates are preserved, not deduplicated).
   */
  test('Property 40c: State with Duplicate Paths Persists Correctly', () => {
    fc.assert(
      fc.property(
        filePathArbitrary,
        fc.integer({ min: 2, max: 5 }),
        (filePath, duplicateCount) => {
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

          // Create state with duplicate paths
          const stateWithDuplicates: ExplorerState = {
            expandedDirectories: Array(duplicateCount).fill(filePath),
            focusedFiles: Array(duplicateCount).fill(filePath),
            quickOpenHistory: Array(duplicateCount).fill(filePath),
            lastActiveProject: 'test-project',
          };

          persistence.saveState(stateWithDuplicates);
          const loadedState = persistence.loadState();

          expect(loadedState).toEqual(stateWithDuplicates);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 40d: State File Path is Correct
   * 
   * The state file should be created at .ollm/explorer-state.json
   * relative to the workspace root.
   */
  test('Property 40d: State File Path is Correct', () => {
    fc.assert(
      fc.property(
        explorerStateArbitrary,
        (state) => {
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

          persistence.saveState(state);

          const expectedPath = path.join(workspaceDir, '.ollm', 'explorer-state.json');
          expect(fs.existsSync(expectedPath)).toBe(true);
          expect(persistence.getStateFilePath()).toBe(expectedPath);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 40e: Custom State File Path Works
   * 
   * When a custom state file path is provided, state should be saved
   * and loaded from that location.
   */
  test('Property 40e: Custom State File Path Works', () => {
    fc.assert(
      fc.property(
        explorerStateArbitrary,
        (state) => {
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          const customPath = path.join(workspaceDir, 'custom-state.json');
          const persistence = new ExplorerPersistence(workspaceDir, { 
            stateFilePath: customPath,
            silent: true,
          });

          persistence.saveState(state);
          const loadedState = persistence.loadState();

          expect(loadedState).toEqual(state);
          expect(fs.existsSync(customPath)).toBe(true);
          expect(persistence.getStateFilePath()).toBe(customPath);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 42: Corrupted Configuration Resets to Default
   * 
   * For any corrupted configuration file, loading it should result in the
   * default state being used and a warning being logged.
   * 
   * Validates: Requirements 12.5
   */
  test('Property 42: Corrupted Configuration Resets to Default', () => {
    // Test various types of corrupted state files
    const corruptedStates = [
      // Invalid JSON
      'this is not valid JSON',
      '{invalid json}',
      '{"expandedDirectories": [}',
      
      // Missing required fields
      '{"expandedDirectories": []}',
      '{"focusedFiles": []}',
      '{"quickOpenHistory": []}',
      
      // Wrong types for fields
      '{"expandedDirectories": "not an array", "focusedFiles": [], "quickOpenHistory": [], "lastActiveProject": null}',
      '{"expandedDirectories": [], "focusedFiles": "not an array", "quickOpenHistory": [], "lastActiveProject": null}',
      '{"expandedDirectories": [], "focusedFiles": [], "quickOpenHistory": "not an array", "lastActiveProject": null}',
      '{"expandedDirectories": [], "focusedFiles": [], "quickOpenHistory": [], "lastActiveProject": 123}',
      
      // Empty file
      '',
      
      // Null
      'null',
      
      // Array instead of object
      '[]',
      
      // Number instead of object
      '123',
    ];

    const defaultState: ExplorerState = {
      expandedDirectories: [],
      focusedFiles: [],
      quickOpenHistory: [],
      lastActiveProject: null,
    };

    for (const corruptedContent of corruptedStates) {
      const workspaceDir = createTempDir();
      tempDirs.push(workspaceDir);

      // Create .ollm directory
      const ollmDir = path.join(workspaceDir, '.ollm');
      fs.mkdirSync(ollmDir, { recursive: true });

      // Write corrupted state file
      const stateFilePath = path.join(ollmDir, 'explorer-state.json');
      fs.writeFileSync(stateFilePath, corruptedContent, 'utf-8');

      // Create persistence instance
      const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

      // Load state - should return default state without throwing
      const loadedState = persistence.loadState();

      // Verify default state is returned
      expect(loadedState).toEqual(defaultState);
    }
  });

  /**
   * Property 42a: Non-Existent State File Returns Default
   * 
   * When no state file exists, loading should return the default state.
   */
  test('Property 42a: Non-Existent State File Returns Default', () => {
    const workspaceDir = createTempDir();
    tempDirs.push(workspaceDir);

    const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

    // Verify no state file exists
    expect(persistence.hasPersistedState()).toBe(false);

    // Load state - should return default state
    const loadedState = persistence.loadState();

    const defaultState: ExplorerState = {
      expandedDirectories: [],
      focusedFiles: [],
      quickOpenHistory: [],
      lastActiveProject: null,
    };

    expect(loadedState).toEqual(defaultState);
  });

  /**
   * Property 42b: Partially Valid State Uses Defaults for Missing Fields
   * 
   * When a state file has some valid fields but is missing others,
   * defaults should be used for the missing fields.
   */
  test('Property 42b: Partially Valid State Uses Defaults for Missing Fields', () => {
    fc.assert(
      fc.property(
        fc.array(filePathArbitrary, { maxLength: 5 }),
        (expandedDirs) => {
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          // Create .ollm directory
          const ollmDir = path.join(workspaceDir, '.ollm');
          fs.mkdirSync(ollmDir, { recursive: true });

          // Write partially valid state (missing some fields)
          const partialState = {
            expandedDirectories: expandedDirs,
            focusedFiles: [],
            quickOpenHistory: [],
            lastActiveProject: null,
          };

          const stateFilePath = path.join(ollmDir, 'explorer-state.json');
          fs.writeFileSync(stateFilePath, JSON.stringify(partialState), 'utf-8');

          const persistence = new ExplorerPersistence(workspaceDir, { silent: true });
          const loadedState = persistence.loadState();

          // Should load successfully with the provided values
          expect(loadedState.expandedDirectories).toEqual(expandedDirs);
          expect(loadedState.focusedFiles).toEqual([]);
          expect(loadedState.quickOpenHistory).toEqual([]);
          expect(loadedState.lastActiveProject).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 42c: Clear State Removes State File
   * 
   * Calling clearState should remove the state file from disk.
   */
  test('Property 42c: Clear State Removes State File', () => {
    fc.assert(
      fc.property(
        explorerStateArbitrary,
        (state) => {
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          const persistence = new ExplorerPersistence(workspaceDir, { silent: true });

          // Save state
          persistence.saveState(state);
          expect(persistence.hasPersistedState()).toBe(true);

          // Clear state
          persistence.clearState();
          expect(persistence.hasPersistedState()).toBe(false);

          // Loading after clear should return default state
          const loadedState = persistence.loadState();
          const defaultState: ExplorerState = {
            expandedDirectories: [],
            focusedFiles: [],
            quickOpenHistory: [],
            lastActiveProject: null,
          };
          expect(loadedState).toEqual(defaultState);
        }
      ),
      { numRuns: 50 }
    );
  });
});
