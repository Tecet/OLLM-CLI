/**
 * WorkspaceManager - Manages multi-project workspace configuration
 * 
 * Responsibilities:
 * - Parse .ollm-workspace and .ollm-project files
 * - Validate project paths
 * - Track active project for LLM context
 * - Provide project metadata
 * 
 * Requirements: 1.1, 1.3, 1.4
 */

import * as fs from 'fs';
import * as path from 'path';

import { WorkspaceConfig, ProjectConfig } from './types.js';

/**
 * WorkspaceManager handles loading and managing workspace configurations
 */
export class WorkspaceManager {
  private workspaceConfig: WorkspaceConfig | null = null;
  private activeProjectName: string | null = null;
  private workspaceRoot: string | null = null;
  private silent: boolean = false;

  /**
   * Create a new WorkspaceManager
   * 
   * @param options - Configuration options
   * @param options.silent - If true, suppress warning logs (useful for testing)
   */
  constructor(options?: { silent?: boolean }) {
    this.silent = options?.silent ?? false;
  }

  /**
   * Load workspace configuration from .ollm-workspace file
   * 
   * @param workspacePath - Path to the .ollm-workspace file or directory containing it
   * @returns Parsed workspace configuration
   * @throws Error if workspace file is invalid JSON or missing required fields
   * 
   * Requirement 1.1: Parse .ollm-workspace file and load all configured projects
   * Requirement 1.2: Skip invalid project paths with warning
   * Requirement 1.3: Support project metadata (name, llmAccess, excludePatterns)
   */
  loadWorkspace(workspacePath: string): WorkspaceConfig {
    // Determine the actual workspace file path
    let workspaceFilePath: string;
    
    if (fs.statSync(workspacePath).isDirectory()) {
      workspaceFilePath = path.join(workspacePath, '.ollm-workspace');
      this.workspaceRoot = workspacePath;
    } else {
      workspaceFilePath = workspacePath;
      this.workspaceRoot = path.dirname(workspacePath);
    }

    // Read and parse the workspace file
    const fileContent = fs.readFileSync(workspaceFilePath, 'utf-8');
    const rawConfig = JSON.parse(fileContent) as WorkspaceConfig;

    // Validate required fields
    if (!rawConfig.version) {
      throw new Error('Workspace configuration missing required field: version');
    }
    if (!Array.isArray(rawConfig.projects)) {
      throw new Error('Workspace configuration missing required field: projects');
    }

    // Validate and filter projects
    const validProjects: ProjectConfig[] = [];
    
    for (const project of rawConfig.projects) {
      // Validate required project fields
      if (!project.name || !project.path) {
        if (!this.silent) {
          console.warn(`Skipping project with missing name or path: ${JSON.stringify(project)}`);
        }
        continue;
      }

      // Resolve project path relative to workspace root
      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.resolve(this.workspaceRoot, project.path);

      // Check if project path exists
      if (!fs.existsSync(projectPath)) {
        if (!this.silent) {
          console.warn(`Skipping project "${project.name}" with invalid path: ${projectPath}`);
        }
        continue;
      }

      // Check if project path is a directory
      if (!fs.statSync(projectPath).isDirectory()) {
        if (!this.silent) {
          console.warn(`Skipping project "${project.name}" - path is not a directory: ${projectPath}`);
        }
        continue;
      }

      // Add valid project with resolved path
      validProjects.push({
        name: project.name,
        path: projectPath,
        llmAccess: project.llmAccess ?? true, // Default to true if not specified
        excludePatterns: project.excludePatterns ?? [], // Default to empty array
      });
    }

    // Store the validated configuration
    this.workspaceConfig = {
      version: rawConfig.version,
      projects: validProjects,
    };

    return this.workspaceConfig;
  }

  /**
   * Get the currently active project
   * 
   * @returns Active project configuration or null if no project is active
   * 
   * Requirement 1.4: Track active project for LLM context
   */
  getActiveProject(): ProjectConfig | null {
    if (!this.workspaceConfig || !this.activeProjectName) {
      return null;
    }

    const project = this.workspaceConfig.projects.find(
      (p) => p.name === this.activeProjectName
    );

    return project ?? null;
  }

  /**
   * Set the active project by name
   * 
   * @param projectName - Name of the project to set as active
   * @throws Error if project name is not found in workspace
   * 
   * Requirement 1.4: Mark project as active for LLM context
   */
  setActiveProject(projectName: string): void {
    if (!this.workspaceConfig) {
      throw new Error('No workspace loaded. Call loadWorkspace() first.');
    }

    const project = this.workspaceConfig.projects.find(
      (p) => p.name === projectName
    );

    if (!project) {
      throw new Error(`Project "${projectName}" not found in workspace`);
    }

    this.activeProjectName = projectName;
  }

  /**
   * Check if a path is within the workspace
   * 
   * @param filePath - Path to check
   * @returns True if path is within any workspace project
   * 
   * Requirement 1.1: Validate paths against workspace boundaries
   */
  isPathInWorkspace(filePath: string): boolean {
    if (!this.workspaceConfig) {
      return false;
    }

    const absolutePath = path.resolve(filePath);

    // Check if path is within any project
    return this.workspaceConfig.projects.some((project) => {
      const projectPath = path.resolve(project.path);
      return absolutePath.startsWith(projectPath + path.sep) || absolutePath === projectPath;
    });
  }

  /**
   * Get exclude patterns for a specific project
   * 
   * @param projectName - Name of the project
   * @returns Array of exclude patterns or empty array if project not found
   * 
   * Requirement 1.3: Provide project exclude patterns
   */
  getProjectExcludePatterns(projectName: string): string[] {
    if (!this.workspaceConfig) {
      return [];
    }

    const project = this.workspaceConfig.projects.find(
      (p) => p.name === projectName
    );

    return project?.excludePatterns ?? [];
  }

  /**
   * Get all projects in the workspace
   * 
   * @returns Array of all project configurations
   */
  getAllProjects(): ProjectConfig[] {
    return this.workspaceConfig?.projects ?? [];
  }

  /**
   * Get the workspace root directory
   * 
   * @returns Workspace root path or null if no workspace loaded
   */
  getWorkspaceRoot(): string | null {
    return this.workspaceRoot;
  }

  /**
   * Check if a workspace is currently loaded
   * 
   * @returns True if workspace is loaded
   */
  hasWorkspace(): boolean {
    return this.workspaceConfig !== null;
  }
}
