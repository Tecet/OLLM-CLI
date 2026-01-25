/**
 * Project Profile Service for auto-detecting project type and applying project-specific configuration
 * Supports TypeScript, Python, Rust, Go, and documentation profiles
 * Feature: stage-07-model-management
 */

import { promises as fs } from 'fs';
import { join } from 'path';

import { parse as parseYaml } from 'yaml';

import { createLogger } from '../utils/logger.js';

const logger = createLogger('projectProfileService');

/**
 * Project profile configuration
 */
export interface ProjectProfile {
  name: string;
  model?: string;
  systemPrompt?: string;
  tools?: {
    enabled?: string[];
    disabled?: string[];
  };
  routing?: {
    defaultProfile?: string;
  };
  options?: Record<string, unknown>;
}

/**
 * Built-in profile definition
 */
export interface BuiltInProfile {
  name: string;
  description: string;
  detectionFiles: string[];
  defaultSettings: ProjectProfile;
}

/**
 * Detection rule for project type
 */
interface DetectionRule {
  name: string;
  files: string[];
  check?: (content: string) => boolean;
}

/**
 * Configuration for ProjectProfileService
 */
export interface ProjectProfileServiceConfig {
  /**
   * Whether to enable auto-detection (default: true)
   */
  autoDetect?: boolean;

  /**
   * Manual profile override
   */
  manualProfile?: string;

  /**
   * Whether to enable project profile service (default: true)
   */
  enabled?: boolean;
}

/**
 * Built-in project profiles
 */
const BUILT_IN_PROFILES: BuiltInProfile[] = [
  {
    name: 'typescript',
    description: 'TypeScript project with code-optimized settings',
    detectionFiles: ['package.json', 'tsconfig.json'],
    defaultSettings: {
      name: 'typescript',
      routing: {
        defaultProfile: 'code',
      },
      tools: {
        enabled: ['read-file', 'write-file', 'edit-file', 'glob', 'grep', 'ls'],
      },
      systemPrompt: 'You are working in a TypeScript project. Focus on type safety and modern JavaScript/TypeScript best practices.',
    },
  },
  {
    name: 'python',
    description: 'Python project with code-optimized settings',
    detectionFiles: ['requirements.txt', 'pyproject.toml', 'setup.py'],
    defaultSettings: {
      name: 'python',
      routing: {
        defaultProfile: 'code',
      },
      tools: {
        enabled: ['read-file', 'write-file', 'edit-file', 'glob', 'grep', 'ls', 'shell'],
      },
      systemPrompt: 'You are working in a Python project. Follow PEP 8 style guidelines and Python best practices.',
    },
  },
  {
    name: 'rust',
    description: 'Rust project with code-optimized settings',
    detectionFiles: ['Cargo.toml'],
    defaultSettings: {
      name: 'rust',
      routing: {
        defaultProfile: 'code',
      },
      tools: {
        enabled: ['read-file', 'write-file', 'edit-file', 'glob', 'grep', 'ls', 'shell'],
      },
      systemPrompt: 'You are working in a Rust project. Emphasize memory safety, ownership, and zero-cost abstractions.',
    },
  },
  {
    name: 'go',
    description: 'Go project with code-optimized settings',
    detectionFiles: ['go.mod'],
    defaultSettings: {
      name: 'go',
      routing: {
        defaultProfile: 'code',
      },
      tools: {
        enabled: ['read-file', 'write-file', 'edit-file', 'glob', 'grep', 'ls', 'shell'],
      },
      systemPrompt: 'You are working in a Go project. Emphasize simplicity, concurrency, and idiomatic Go patterns.',
    },
  },
  {
    name: 'documentation',
    description: 'Documentation project with writing-optimized settings',
    detectionFiles: ['docs/', 'README.md', 'mkdocs.yml'],
    defaultSettings: {
      name: 'documentation',
      routing: {
        defaultProfile: 'creative',
      },
      tools: {
        enabled: ['read-file', 'write-file', 'edit-file', 'glob', 'grep'],
      },
      systemPrompt: 'You are working on documentation. Focus on clarity, completeness, and user-friendly explanations.',
    },
  },
];

/**
 * Detection rules for project types
 */
const DETECTION_RULES: DetectionRule[] = [
  {
    name: 'typescript',
    files: ['package.json'],
    check: (content: string) => {
      try {
        const pkg = JSON.parse(content);
        return !!(
          pkg.devDependencies?.typescript ||
          pkg.dependencies?.typescript ||
          pkg.devDependencies?.['@types/node']
        );
      } catch {
        return false;
      }
    },
  },
  {
    name: 'python',
    files: ['requirements.txt', 'pyproject.toml', 'setup.py'],
  },
  {
    name: 'rust',
    files: ['Cargo.toml'],
  },
  {
    name: 'go',
    files: ['go.mod'],
  },
];

/**
 * Service for managing project profiles
 */
export class ProjectProfileService {
  private autoDetect: boolean;
  private manualProfile: string | null;
  private enabled: boolean;
  private currentProfile: ProjectProfile | null = null;

  constructor(config: ProjectProfileServiceConfig = {}) {
    this.autoDetect = config.autoDetect ?? true;
    this.manualProfile = config.manualProfile || null;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Detect project type from workspace files
   */
  async detectProfile(workspacePath: string): Promise<ProjectProfile | null> {
    if (!this.enabled) {
      return null;
    }

    // Check manual override first
    if (this.manualProfile) {
      const builtIn = BUILT_IN_PROFILES.find((p) => p.name === this.manualProfile);
      if (builtIn) {
        return builtIn.defaultSettings;
      }
    }

    // Auto-detect if enabled
    if (!this.autoDetect) {
      return null;
    }

    // Try each detection rule
    for (const rule of DETECTION_RULES) {
      for (const file of rule.files) {
        const filePath = join(workspacePath, file);

        try {
          const stats = await fs.stat(filePath);

          // If it's a directory, just check existence
          if (stats.isDirectory()) {
            const builtIn = BUILT_IN_PROFILES.find((p) => p.name === rule.name);
            if (builtIn) {
              return builtIn.defaultSettings;
            }
          }

          // If it's a file, check content if needed
          if (stats.isFile()) {
            if (rule.check) {
              const content = await fs.readFile(filePath, 'utf-8');
              if (rule.check(content)) {
                const builtIn = BUILT_IN_PROFILES.find((p) => p.name === rule.name);
                if (builtIn) {
                  return builtIn.defaultSettings;
                }
              }
            } else {
              // No check function, just existence is enough
              const builtIn = BUILT_IN_PROFILES.find((p) => p.name === rule.name);
              if (builtIn) {
                return builtIn.defaultSettings;
              }
            }
          }
        } catch (error) {
          // File doesn't exist, continue to next
          const err = error as NodeJS.ErrnoException;
          if (err.code !== 'ENOENT') {
            logger.warn(`Error checking ${filePath}: ${err.message}`);
          }
        }
      }
    }

    return null;
  }

  /**
   * Load project profile from workspace configuration file
   */
  async loadProfile(workspacePath: string): Promise<ProjectProfile | null> {
    if (!this.enabled) {
      return null;
    }

    const configPath = join(workspacePath, '.ollm', 'project.yaml');

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const data = parseYaml(content);

      // Validate profile structure
      this.validateProfile(data);

      const profile: ProjectProfile = {
        name: data.name || 'custom',
        model: data.model,
        systemPrompt: data.systemPrompt,
        tools: data.tools,
        routing: data.routing,
        options: data.options,
      };

      this.currentProfile = profile;
      return profile;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        // File doesn't exist, try auto-detection
        return this.detectProfile(workspacePath);
      }
      throw new Error(`Failed to load project profile: ${err.message}`);
    }
  }

  /**
   * Validate profile structure
   */
  private validateProfile(data: unknown): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Profile must be an object');
    }

    const profile = data as {
      model?: unknown;
      systemPrompt?: unknown;
      tools?: { enabled?: unknown; disabled?: unknown } | unknown;
      routing?: unknown;
      options?: unknown;
    };

    if (profile.model !== undefined && typeof profile.model !== 'string') {
      throw new Error('Profile model must be a string');
    }

    if (profile.systemPrompt !== undefined && typeof profile.systemPrompt !== 'string') {
      throw new Error('Profile systemPrompt must be a string');
    }

    if (profile.tools !== undefined) {
      if (typeof profile.tools !== 'object') {
        throw new Error('Profile tools must be an object');
      }

      if ((profile.tools as { enabled?: unknown }).enabled !== undefined && !Array.isArray((profile.tools as { enabled?: unknown }).enabled)) {
        throw new Error('Profile tools.enabled must be an array');
      }

      if ((profile.tools as { disabled?: unknown }).disabled !== undefined && !Array.isArray((profile.tools as { disabled?: unknown }).disabled)) {
        throw new Error('Profile tools.disabled must be an array');
      }
    }

    if (profile.routing !== undefined) {
      if (typeof profile.routing !== 'object') {
        throw new Error('Profile routing must be an object');
      }

      if ((profile.routing as { defaultProfile?: unknown }).defaultProfile !== undefined &&
          typeof (profile.routing as { defaultProfile?: unknown }).defaultProfile !== 'string') {
        throw new Error('Profile routing.defaultProfile must be a string');
      }
    }
  }

  /**
   * Apply profile settings (to be implemented by caller)
   * This method returns the merged settings that should be applied
   */
  applyProfile(profile: ProjectProfile, globalSettings: Partial<ProjectProfile> = {}): ProjectProfile {
    if (!this.enabled) {
      return globalSettings as ProjectProfile;
    }

    // Project settings take precedence over global settings
    const merged: ProjectProfile = {
      name: profile.name || globalSettings.name || 'default',
      model: profile.model || globalSettings.model,
      systemPrompt: profile.systemPrompt || globalSettings.systemPrompt,
      tools: {
        enabled: profile.tools?.enabled || globalSettings.tools?.enabled,
        disabled: profile.tools?.disabled || globalSettings.tools?.disabled,
      },
      routing: {
        defaultProfile: profile.routing?.defaultProfile || globalSettings.routing?.defaultProfile,
      },
      options: {
        ...globalSettings.options,
        ...profile.options,
      },
    };

    return merged;
  }

  /**
   * List all built-in profiles
   */
  listBuiltInProfiles(): BuiltInProfile[] {
    return BUILT_IN_PROFILES;
  }

  /**
   * Initialize a project with a profile
   */
  async initializeProject(workspacePath: string, profileName: string): Promise<void> {
    if (!this.enabled) {
      throw new Error('Project profile service is disabled');
    }

    // Find the built-in profile
    const builtIn = BUILT_IN_PROFILES.find((p) => p.name === profileName);
    if (!builtIn) {
      throw new Error(
        `Profile '${profileName}' not found. Available profiles: ${BUILT_IN_PROFILES.map((p) => p.name).join(', ')}`
      );
    }

    // Create .ollm directory if it doesn't exist
    const ollmDir = join(workspacePath, '.ollm');
    await fs.mkdir(ollmDir, { recursive: true });

    // Create project.yaml file
    const configPath = join(ollmDir, 'project.yaml');
    const yamlContent = builtIn.defaultSettings;

    // Write to file (using JSON for simplicity, can be converted to YAML later)
    const content = JSON.stringify(yamlContent, null, 2);
    await fs.writeFile(configPath, content, 'utf-8');

    this.currentProfile = builtIn.defaultSettings;
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): ProjectProfile | null {
    return this.currentProfile;
  }

  /**
   * Set manual profile override
   */
  setManualProfile(profileName: string | null): void {
    this.manualProfile = profileName;
  }

  /**
   * Get manual profile override
   */
  getManualProfile(): string | null {
    return this.manualProfile;
  }
}
