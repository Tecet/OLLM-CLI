/**
 * Project Mode Memory
 * 
 * Manages per-project mode preferences and settings.
 * Stores preferences in .ollm/mode-preferences.json within the project directory.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ModeType } from './ContextAnalyzer.js';

/**
 * Project-specific mode preferences
 */
export interface ProjectModePreferences {
  /** Default mode for this project */
  defaultMode: ModeType;
  /** Whether auto-switching is enabled */
  autoSwitchEnabled: boolean;
  /** Custom confidence thresholds per mode */
  customThresholds: Partial<Record<ModeType, number>>;
  /** Modes that are disabled for this project */
  disabledModes: ModeType[];
  /** Preferred workflows for this project */
  preferredWorkflows: string[];
  /** Last updated timestamp */
  lastUpdated?: number;
  /** Project path (for reference) */
  projectPath?: string;
}

/**
 * Default preferences for new projects
 */
function getDefaultPreferences(): ProjectModePreferences {
  return {
    defaultMode: 'assistant',
    autoSwitchEnabled: true,
    customThresholds: {},
    disabledModes: [],
    preferredWorkflows: [],
  };
}

/**
 * Manages project-specific mode preferences
 */
export class ProjectModeMemory {
  private preferences: ProjectModePreferences;
  private projectPath: string;
  private preferencesFilePath: string;
  private loaded: boolean = false;

  /**
   * Create a new ProjectModeMemory instance
   * @param projectPath - Root path of the project
   */
  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.preferencesFilePath = path.join(projectPath, '.ollm', 'mode-preferences.json');
    this.preferences = { ...getDefaultPreferences(), projectPath };
  }

  /**
   * Load preferences from disk
   * @returns The loaded preferences
   */
  async load(): Promise<ProjectModePreferences> {
    try {
      const data = await fs.readFile(this.preferencesFilePath, 'utf-8');
      const loaded = JSON.parse(data) as ProjectModePreferences;
      
      // Merge with defaults to ensure all fields exist
      this.preferences = {
        ...getDefaultPreferences(),
        ...loaded,
        projectPath: this.projectPath,
      };
      
      this.loaded = true;
      return this.preferences;
    } catch (error) {
      // File doesn't exist or is invalid, use defaults
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.loaded = true;
        return this.preferences;
      }
      
      throw new Error(`Failed to load mode preferences: ${(error as Error).message}`);
    }
  }

  /**
   * Save preferences to disk
   */
  async save(): Promise<void> {
    try {
      // Ensure .ollm directory exists
      const ollmDir = path.dirname(this.preferencesFilePath);
      await fs.mkdir(ollmDir, { recursive: true });
      
      // Update timestamp
      this.preferences.lastUpdated = Date.now();
      
      // Write preferences
      await fs.writeFile(
        this.preferencesFilePath,
        JSON.stringify(this.preferences, null, 2),
        'utf-8'
      );
    } catch (error) {
      throw new Error(`Failed to save mode preferences: ${(error as Error).message}`);
    }
  }

  /**
   * Get current preferences
   * @returns Current preferences
   */
  getPreferences(): ProjectModePreferences {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    return { ...this.preferences };
  }

  /**
   * Get default mode for this project
   */
  getDefaultMode(): ModeType {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    return this.preferences.defaultMode;
  }

  /**
   * Set default mode for this project
   */
  async setDefaultMode(mode: ModeType): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    this.preferences.defaultMode = mode;
    await this.save();
  }

  /**
   * Check if auto-switching is enabled
   */
  isAutoSwitchEnabled(): boolean {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    return this.preferences.autoSwitchEnabled;
  }

  /**
   * Set auto-switch enabled state
   */
  async setAutoSwitchEnabled(enabled: boolean): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    this.preferences.autoSwitchEnabled = enabled;
    await this.save();
  }

  /**
   * Get custom threshold for a mode
   * @param mode - Mode to get threshold for
   * @returns Custom threshold or undefined if not set
   */
  getCustomThreshold(mode: ModeType): number | undefined {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    return this.preferences.customThresholds[mode];
  }

  /**
   * Set custom threshold for a mode
   * @param mode - Mode to set threshold for
   * @param threshold - Confidence threshold (0.0 to 1.0)
   */
  async setCustomThreshold(mode: ModeType, threshold: number): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0.0 and 1.0');
    }
    
    this.preferences.customThresholds[mode] = threshold;
    await this.save();
  }

  /**
   * Remove custom threshold for a mode
   * @param mode - Mode to remove threshold for
   */
  async removeCustomThreshold(mode: ModeType): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    delete this.preferences.customThresholds[mode];
    await this.save();
  }

  /**
   * Check if a mode is disabled
   * @param mode - Mode to check
   */
  isModeDisabled(mode: ModeType): boolean {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    return this.preferences.disabledModes.includes(mode);
  }

  /**
   * Disable a mode for this project
   * @param mode - Mode to disable
   */
  async disableMode(mode: ModeType): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    
    if (!this.preferences.disabledModes.includes(mode)) {
      this.preferences.disabledModes.push(mode);
      await this.save();
    }
  }

  /**
   * Enable a mode for this project
   * @param mode - Mode to enable
   */
  async enableMode(mode: ModeType): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    
    const index = this.preferences.disabledModes.indexOf(mode);
    if (index !== -1) {
      this.preferences.disabledModes.splice(index, 1);
      await this.save();
    }
  }

  /**
   * Get preferred workflows for this project
   */
  getPreferredWorkflows(): string[] {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    return [...this.preferences.preferredWorkflows];
  }

  /**
   * Add a preferred workflow
   * @param workflow - Workflow name to add
   */
  async addPreferredWorkflow(workflow: string): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    
    if (!this.preferences.preferredWorkflows.includes(workflow)) {
      this.preferences.preferredWorkflows.push(workflow);
      await this.save();
    }
  }

  /**
   * Remove a preferred workflow
   * @param workflow - Workflow name to remove
   */
  async removePreferredWorkflow(workflow: string): Promise<void> {
    if (!this.loaded) {
      throw new Error('Preferences not loaded. Call load() first.');
    }
    
    const index = this.preferences.preferredWorkflows.indexOf(workflow);
    if (index !== -1) {
      this.preferences.preferredWorkflows.splice(index, 1);
      await this.save();
    }
  }

  /**
   * Reset preferences to defaults
   */
  async reset(): Promise<void> {
    this.preferences = { ...getDefaultPreferences(), projectPath: this.projectPath };
    await this.save();
  }

  /**
   * Check if preferences file exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.preferencesFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the file path where preferences are stored
   */
  getFilePath(): string {
    return this.preferencesFilePath;
  }
}
