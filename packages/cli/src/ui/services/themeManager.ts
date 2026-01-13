/**
 * Theme Manager Service
 * 
 * Handles theme loading, custom theme merging, and theme application.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Theme, builtInThemes, defaultDarkTheme } from '../uiSettings.js';

export interface ThemeManagerOptions {
  customThemePath?: string;
}

/**
 * Deep merge utility for themes
 * Recursively merges source into target, preserving nested objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (
        sourceValue &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge nested objects
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        // Override with source value
        result[key] = sourceValue;
      }
    }
  }
  
  return result;
}

/**
 * Theme Manager
 * 
 * Manages theme loading, custom theme merging, and theme application.
 */
export class ThemeManager {
  private currentTheme: Theme;
  private customTheme: Partial<Theme> | null = null;
  private customThemePath?: string;

  constructor(options: ThemeManagerOptions = {}) {
    this.currentTheme = defaultDarkTheme;
    this.customThemePath = options.customThemePath;
  }

  /**
   * Load a built-in theme by name
   */
  loadTheme(name: string): Theme {
    const theme = builtInThemes[name];
    if (!theme) {
      throw new Error(`Theme "${name}" not found. Available themes: ${this.listThemes().join(', ')}`);
    }
    
    this.currentTheme = theme;
    return theme;
  }

  /**
   * Load a custom theme from a YAML file
   * The custom theme is deep-merged over the default theme
   */
  loadCustomTheme(themePath: string): Theme {
    try {
      // Read and parse the YAML file
      const fileContent = fs.readFileSync(themePath, 'utf-8');
      const customThemeData = yaml.load(fileContent) as Partial<Theme>;
      
      // Validate that it's an object
      if (!customThemeData || typeof customThemeData !== 'object') {
        throw new Error('Custom theme must be an object');
      }
      
      // Store the custom theme
      this.customTheme = customThemeData;
      
      // Merge with default theme
      const mergedTheme = this.mergeThemes(defaultDarkTheme, customThemeData);
      
      this.currentTheme = mergedTheme;
      return mergedTheme;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to load custom theme from ${themePath}: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Apply a theme (sets it as the current theme)
   */
  applyTheme(theme: Theme): void {
    this.currentTheme = theme;
  }

  /**
   * Merge a custom theme over a base theme
   * Uses deep merge to preserve unspecified default values
   */
  mergeThemes(base: Theme, custom: Partial<Theme>): Theme {
    return deepMerge(base, custom);
  }

  /**
   * Get the current theme
   */
  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * List all available built-in theme names
   */
  listThemes(): string[] {
    return Object.keys(builtInThemes);
  }

  /**
   * Check if a theme exists
   */
  hasTheme(name: string): boolean {
    return name in builtInThemes;
  }

  /**
   * Load custom theme from default location if it exists
   * Default location: ~/.ollm/ui.yaml
   */
  loadCustomThemeIfExists(): Theme | null {
    if (this.customThemePath && fs.existsSync(this.customThemePath)) {
      return this.loadCustomTheme(this.customThemePath);
    }
    
    // Try default location
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const defaultPath = path.join(homeDir, '.ollm', 'ui.yaml');
      if (fs.existsSync(defaultPath)) {
        return this.loadCustomTheme(defaultPath);
      }
    }
    
    return null;
  }

  /**
   * Reset to default theme
   */
  reset(): void {
    this.currentTheme = defaultDarkTheme;
    this.customTheme = null;
  }
}

/**
 * Create a singleton theme manager instance
 */
let themeManagerInstance: ThemeManager | null = null;

export function getThemeManager(options?: ThemeManagerOptions): ThemeManager {
  if (!themeManagerInstance) {
    themeManagerInstance = new ThemeManager(options);
  }
  return themeManagerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetThemeManager(): void {
  themeManagerInstance = null;
}
