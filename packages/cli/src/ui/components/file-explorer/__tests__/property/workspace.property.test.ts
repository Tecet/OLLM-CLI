/**
 * Property-based tests for WorkspaceManager
 * 
 * These tests validate universal properties that should hold for all valid
 * workspace configurations using fast-check for property-based testing.
 * 
 * Feature: file-explorer-ui
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WorkspaceManager } from '../../WorkspaceManager.js';
import type { WorkspaceConfig, ProjectConfig } from '../../types.js';

/**
 * Helper function to create a temporary directory
 */
function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-test-'));
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
 * Arbitrary generator for valid project names
 */
const _projectNameArbitrary = fc.string({ minLength: 1, maxLength: 50 })
  .filter(name => !name.includes('/') && !name.includes('\\') && name.trim().length > 0);

/**
 * Arbitrary generator for exclude patterns
 */
const _excludePatternArbitrary = fc.array(
  fc.oneof(
    fc.constant('node_modules'),
    fc.constant('*.log'),
    fc.constant('.git'),
    fc.constant('dist'),
    fc.constant('build')
  ),
  { maxLength: 5 }
);

describe('WorkspaceManager - Property Tests', () => {
  let tempDirs: string[] = [];

  beforeEach(() => {
    tempDirs = [];
  });

  afterEach(() => {
    // Clean up all temporary directories
    tempDirs.forEach(dir => cleanupDir(dir));
  });

  /**
   * Property 1: Workspace Configuration Parsing Preserves All Valid Projects
   * 
   * For any valid .ollm-workspace JSON file, parsing and loading should result
   * in all projects with valid paths being available in the workspace, with their
   * metadata (name, llmAccess, excludePatterns) preserved exactly.
   * 
   * Validates: Requirements 1.1, 1.3
   */
  test('Property 1: Workspace Configuration Parsing Preserves All Valid Projects', () => {
    fc.assert(
      fc.property(
        fc.record({
          version: fc.constant('1.0'),
          numProjects: fc.integer({ min: 1, max: 5 }),
        }),
        ({ version, numProjects }) => {
          // Create workspace directory
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          // Generate projects with valid paths
          const projects: ProjectConfig[] = [];
          for (let i = 0; i < numProjects; i++) {
            const projectDir = path.join(workspaceDir, `project-${i}`);
            fs.mkdirSync(projectDir, { recursive: true });

            projects.push({
              name: `project-${i}`,
              path: projectDir,
              llmAccess: i % 2 === 0, // Alternate true/false
              excludePatterns: i === 0 ? ['node_modules', '*.log'] : [],
            });
          }

          // Create workspace config
          const config: WorkspaceConfig = {
            version,
            projects,
          };

          // Write workspace file
          const workspaceFile = path.join(workspaceDir, '.ollm-workspace');
          fs.writeFileSync(workspaceFile, JSON.stringify(config, null, 2));

          // Load workspace
          const manager = new WorkspaceManager();
          const loadedConfig = manager.loadWorkspace(workspaceFile);

          // Verify all projects are loaded
          expect(loadedConfig.projects).toHaveLength(numProjects);
          expect(loadedConfig.version).toBe(version);

          // Verify each project's metadata is preserved
          for (let i = 0; i < numProjects; i++) {
            const loadedProject = loadedConfig.projects[i];
            const originalProject = projects[i];

            expect(loadedProject.name).toBe(originalProject.name);
            expect(loadedProject.llmAccess).toBe(originalProject.llmAccess);
            expect(loadedProject.excludePatterns).toEqual(originalProject.excludePatterns);
            // Path should be resolved to absolute
            expect(path.isAbsolute(loadedProject.path)).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 2: Invalid Project Paths Are Gracefully Skipped
   * 
   * For any workspace configuration containing a mix of valid and invalid project
   * paths, the workspace manager should load all valid projects and skip invalid
   * ones without throwing errors.
   * 
   * Validates: Requirements 1.2
   */
  test('Property 2: Invalid Project Paths Are Gracefully Skipped', () => {
    fc.assert(
      fc.property(
        fc.record({
          numValidProjects: fc.integer({ min: 1, max: 3 }),
          numInvalidProjects: fc.integer({ min: 1, max: 3 }),
        }),
        ({ numValidProjects, numInvalidProjects }) => {
          // Create workspace directory
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          const projects: ProjectConfig[] = [];

          // Create valid projects
          for (let i = 0; i < numValidProjects; i++) {
            const projectDir = path.join(workspaceDir, `valid-project-${i}`);
            fs.mkdirSync(projectDir, { recursive: true });

            projects.push({
              name: `valid-project-${i}`,
              path: projectDir,
              llmAccess: true,
              excludePatterns: [],
            });
          }

          // Create invalid projects (non-existent paths)
          for (let i = 0; i < numInvalidProjects; i++) {
            projects.push({
              name: `invalid-project-${i}`,
              path: path.join(workspaceDir, `non-existent-${i}`),
              llmAccess: true,
              excludePatterns: [],
            });
          }

          // Shuffle projects to mix valid and invalid
          const shuffled = projects.sort(() => Math.random() - 0.5);

          // Create workspace config
          const config: WorkspaceConfig = {
            version: '1.0',
            projects: shuffled,
          };

          // Write workspace file
          const workspaceFile = path.join(workspaceDir, '.ollm-workspace');
          fs.writeFileSync(workspaceFile, JSON.stringify(config, null, 2));

          // Load workspace - should not throw
          const manager = new WorkspaceManager({ silent: true });
          const loadedConfig = manager.loadWorkspace(workspaceFile);

          // Verify only valid projects are loaded
          expect(loadedConfig.projects).toHaveLength(numValidProjects);

          // Verify all loaded projects are the valid ones
          const loadedNames = loadedConfig.projects.map(p => p.name);
          for (let i = 0; i < numValidProjects; i++) {
            expect(loadedNames).toContain(`valid-project-${i}`);
          }

          // Verify invalid projects are not loaded
          for (let i = 0; i < numInvalidProjects; i++) {
            expect(loadedNames).not.toContain(`invalid-project-${i}`);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Active Project Selection Updates Context
   * 
   * For any project in a loaded workspace, selecting it as active should result
   * in that project being marked as the active project and available for LLM context.
   * 
   * Validates: Requirements 1.4
   */
  test('Property 3: Active Project Selection Updates Context', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 0, max: 4 }),
        (numProjects, selectedIndex) => {
          // Ensure selectedIndex is within bounds
          const actualSelectedIndex = selectedIndex % numProjects;

          // Create workspace directory
          const workspaceDir = createTempDir();
          tempDirs.push(workspaceDir);

          // Generate projects
          const projects: ProjectConfig[] = [];
          for (let i = 0; i < numProjects; i++) {
            const projectDir = path.join(workspaceDir, `project-${i}`);
            fs.mkdirSync(projectDir, { recursive: true });

            projects.push({
              name: `project-${i}`,
              path: projectDir,
              llmAccess: true,
              excludePatterns: [`exclude-${i}`],
            });
          }

          // Create workspace config
          const config: WorkspaceConfig = {
            version: '1.0',
            projects,
          };

          // Write workspace file
          const workspaceFile = path.join(workspaceDir, '.ollm-workspace');
          fs.writeFileSync(workspaceFile, JSON.stringify(config, null, 2));

          // Load workspace
          const manager = new WorkspaceManager();
          manager.loadWorkspace(workspaceFile);

          // Initially, no project should be active
          expect(manager.getActiveProject()).toBeNull();

          // Select a project as active
          const selectedProjectName = `project-${actualSelectedIndex}`;
          manager.setActiveProject(selectedProjectName);

          // Verify the active project is set correctly
          const activeProject = manager.getActiveProject();
          expect(activeProject).not.toBeNull();
          expect(activeProject?.name).toBe(selectedProjectName);
          expect(activeProject?.llmAccess).toBe(true);
          expect(activeProject?.excludePatterns).toEqual([`exclude-${actualSelectedIndex}`]);

          // Verify we can change the active project
          const newSelectedIndex = (actualSelectedIndex + 1) % numProjects;
          const newSelectedProjectName = `project-${newSelectedIndex}`;
          manager.setActiveProject(newSelectedProjectName);

          const newActiveProject = manager.getActiveProject();
          expect(newActiveProject).not.toBeNull();
          expect(newActiveProject?.name).toBe(newSelectedProjectName);
          expect(newActiveProject?.excludePatterns).toEqual([`exclude-${newSelectedIndex}`]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
