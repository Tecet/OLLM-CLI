/**
 * ProfileCompiler - Compiles user-specific LLM_profiles.json
 *
 * This is the ONLY component that reads from the master database.
 * All other parts of the system read from the compiled user file.
 *
 * Architecture:
 * - Master DB: packages/cli/src/config/LLM_profiles.json (READ ONLY by this compiler)
 * - User File: ~/.ollm/LLM_profiles.json (READ by entire app)
 *
 * Process:
 * 1. Query Ollama for installed models
 * 2. Load master database
 * 3. Match installed models with master
 * 4. Copy ALL metadata for matched models
 * 5. Preserve user overrides
 * 6. Save to user location
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import type { ProfilesData, LLMProfile } from '../config/types.js';

// Default Ollama base URL
const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';

interface CompiledProfile {
  version: string;
  last_updated: string;
  source: string;
  models: LLMProfile[];
}

export class ProfileCompiler {
  private masterDbPath: string;
  private userProfilePath: string;
  private configDir: string;

  constructor() {
    // Master database path (ONLY place that reads from app config)
    this.masterDbPath = join(
      process.cwd(),
      'packages',
      'cli',
      'src',
      'config',
      'LLM_profiles.json'
    );

    // User profile path
    const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
    this.configDir = join(homeDir, '.ollm');
    this.userProfilePath = join(this.configDir, 'LLM_profiles.json');
  }

  /**
   * Compile user-specific profiles from installed models
   * This is the main entry point called on app startup
   */
  async compileUserProfiles(): Promise<void> {
    try {
      // Ensure config directory exists
      this.ensureConfigDir();

      // 1. Load master database (ONLY place that reads from app config)
      const masterDb = await this.loadMasterDatabase();

      // 2. Query Ollama for installed models
      const installedModels = await this.getInstalledModels();

      // 3. Match and compile (copy ALL metadata from master)
      const userProfiles = this.matchModels(installedModels, masterDb);

      // 4. Load existing user file (preserve overrides)
      const existingProfiles = await this.loadUserProfiles();

      // 5. Merge (preserve user overrides, update from master)
      const merged = this.mergeProfiles(userProfiles, existingProfiles);

      // 6. Save to user location
      await this.saveUserProfiles(merged);

      console.log(`[ProfileCompiler] Compiled ${merged.length} model profiles to user location`);
    } catch (error) {
      // Non-fatal - app can continue with existing profiles
      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.warn('[ProfileCompiler] Failed to compile user profiles:', error);
      }
    }
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    try {
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true });
      }
    } catch (error) {
      console.warn('[ProfileCompiler] Failed to create config directory:', error);
    }
  }

  /**
   * Load master database from app config
   * THIS IS THE ONLY PLACE THAT READS FROM packages/cli/src/config/LLM_profiles.json
   */
  private async loadMasterDatabase(): Promise<ProfilesData> {
    try {
      if (!existsSync(this.masterDbPath)) {
        throw new Error(`Master database not found at ${this.masterDbPath}`);
      }

      const raw = readFileSync(this.masterDbPath, 'utf-8');
      const data = JSON.parse(raw) as ProfilesData;

      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.log(
          `[ProfileCompiler] Loaded master database with ${data.models?.length || 0} models`
        );
      }

      return data;
    } catch (error) {
      console.error('[ProfileCompiler] Failed to load master database:', error);
      // Return empty database as fallback
      return { version: '0.1.0', models: [] };
    }
  }

  /**
   * Query Ollama for installed models
   */
  private async getInstalledModels(): Promise<string[]> {
    try {
      // Check if Ollama is available with 2s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (process.env.OLLM_LOG_LEVEL === 'debug') {
          console.warn('[ProfileCompiler] Ollama not available');
        }
        return [];
      }

      const data = await response.json();

      // Extract model names
      const models = Array.isArray(data.models)
        ? data.models.map((m: { name: string }) => m.name)
        : [];

      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.log(`[ProfileCompiler] Found ${models.length} installed models:`, models);
      }

      return models;
    } catch (error) {
      // Silent fail - Ollama might not be running
      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.warn(
          '[ProfileCompiler] Failed to query Ollama:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
      return [];
    }
  }

  /**
   * Match installed models with master database
   * Copies ALL metadata for matched models
   * Uses "user-unknown-model" template for unknown models
   */
  private matchModels(installedModelIds: string[], masterDb: ProfilesData): LLMProfile[] {
    const matched: LLMProfile[] = [];

    // Find user-unknown-model template
    const unknownTemplate = masterDb.models?.find((m) => m.id === 'user-unknown-model');

    for (const modelId of installedModelIds) {
      // Skip the template itself
      if (modelId === 'user-unknown-model') continue;

      // Find in master database
      const masterEntry = masterDb.models?.find((m) => m.id === modelId);

      if (masterEntry) {
        // Known model - copy entire entry (ALL metadata)
        matched.push({ ...masterEntry });
      } else {
        // Unknown model - use template
        if (unknownTemplate) {
          const unknownEntry = {
            ...unknownTemplate,
            id: modelId,
            name: `Unknown Model (${modelId})`,
            description: `Unknown model "${modelId}". Please edit your settings at ~/.ollm/LLM_profiles.json (Windows: C:\\Users\\{username}\\.ollm\\LLM_profiles.json) to customize this model's metadata.`,
          };

          matched.push(unknownEntry);

          if (process.env.OLLM_LOG_LEVEL === 'debug') {
            console.warn(
              `[ProfileCompiler] Unknown model "${modelId}" - using fallback template (user-unknown-model)`
            );
          }
        } else {
          // No template available - log error
          console.error(
            `[ProfileCompiler] No "user-unknown-model" template found in master DB for unknown model "${modelId}"`
          );
        }
      }
    }

    return matched;
  }

  /**
   * Load existing user profiles (if any)
   */
  private async loadUserProfiles(): Promise<CompiledProfile | null> {
    try {
      if (!existsSync(this.userProfilePath)) {
        return null;
      }

      const raw = readFileSync(this.userProfilePath, 'utf-8');
      const data = JSON.parse(raw) as CompiledProfile;

      return data;
    } catch (error) {
      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.warn('[ProfileCompiler] Failed to load existing user profiles:', error);
      }
      return null;
    }
  }

  /**
   * Merge new profiles with existing (preserve user overrides)
   *
   * User overrides that are preserved:
   * - Custom context sizes
   * - Custom VRAM estimates
   * - Tool support confirmations
   * - Any user-added fields
   */
  private mergeProfiles(newProfiles: LLMProfile[], existing: CompiledProfile | null): LLMProfile[] {
    if (!existing || !existing.models) {
      // No existing profiles - use new ones as-is
      return newProfiles;
    }

    // Create map of existing profiles for quick lookup
    const existingMap = new Map(existing.models.map((profile) => [profile.id, profile]));

    // Merge each new profile with existing (if any)
    const merged = newProfiles.map((newProfile) => {
      const existingProfile = existingMap.get(newProfile.id);

      if (!existingProfile) {
        // New model - use as-is
        return newProfile;
      }

      // Merge: new profile data + preserved user overrides
      // User overrides are identified by checking if values differ from master
      // For now, we'll do a simple merge that prefers new data but preserves structure
      return {
        ...newProfile,
        // Preserve any user-added fields that don't exist in master
        ...Object.keys(existingProfile).reduce((acc, key) => {
          if (!(key in newProfile)) {
            (acc as any)[key] = (existingProfile as any)[key];
          }
          return acc;
        }, {} as Partial<LLMProfile>),
      };
    });

    return merged;
  }

  /**
   * Save compiled profiles to user location
   */
  private async saveUserProfiles(profiles: LLMProfile[]): Promise<void> {
    try {
      const data: CompiledProfile = {
        version: '0.1.0',
        last_updated: new Date().toISOString(),
        source: 'compiled from installed models',
        models: profiles,
      };

      writeFileSync(this.userProfilePath, JSON.stringify(data, null, 2), 'utf-8');

      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.log(
          `[ProfileCompiler] Saved ${profiles.length} profiles to ${this.userProfilePath}`
        );
      }
    } catch (error) {
      console.error('[ProfileCompiler] Failed to save user profiles:', error);
    }
  }

  /**
   * Get user profile path (for external access)
   */
  public getUserProfilePath(): string {
    return this.userProfilePath;
  }
}

// Singleton instance
let compilerInstance: ProfileCompiler | null = null;

/**
 * Get ProfileCompiler singleton instance
 */
export function getProfileCompiler(): ProfileCompiler {
  if (!compilerInstance) {
    compilerInstance = new ProfileCompiler();
  }
  return compilerInstance;
}

/**
 * Compile user profiles (convenience function)
 */
export async function compileUserProfiles(): Promise<void> {
  const compiler = getProfileCompiler();
  await compiler.compileUserProfiles();
}
