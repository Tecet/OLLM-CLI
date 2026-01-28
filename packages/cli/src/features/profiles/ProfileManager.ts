import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import { refreshModelDatabase } from '@ollm/core';

import { defaultContextBehavior } from '../../config/defaults.js';
import { compileUserProfiles } from '../../services/profileCompiler.js';

import type {
  LLMProfile,
  ContextSettings,
  ContextBehaviorProfile,
  ContextProfile,
  UserModelEntry,
  ProfilesData,
} from '../../config/types.js';

// NOTE: ProfileManager now reads from USER file (~/.ollm/LLM_profiles.json)
// NOT from app config (packages/cli/src/config/LLM_profiles.json)
// The ProfileCompiler is the ONLY component that reads from app config

// Default Ollama base URL
const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';

export class ProfileManager {
  private profiles: LLMProfile[];
  private contextSettings: ContextSettings;
  private userModels: UserModelEntry[];
  private userModelsPath: string;
  private userProfilesPath: string;

  constructor() {
    this.contextSettings = defaultContextBehavior;
    this.userModels = [];

    // Strategy: Use ~/.ollm/user_models.json and ~/.ollm/LLM_profiles.json
    // During tests (Vitest) prefer an isolated temp home directory to avoid global state
    const homeDir = process.env.VITEST ? join(tmpdir(), `ollm-vitest-${process.pid}`) : homedir();
    const configDir = join(homeDir, '.ollm');
    this.userModelsPath = join(configDir, 'user_models.json');
    this.userProfilesPath = join(configDir, 'LLM_profiles.json');

    this.ensureConfigExists(configDir);
    this.profiles = this.loadProfiles();
    this.loadUserModels();

    // Auto-refresh on startup (async, non-blocking)
    this.refreshMetadataAsync().catch((err) => {
      // Silent fail - not critical for startup
      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.warn('Failed to refresh model metadata:', err);
      }
    });
  }

  private ensureConfigExists(configDir: string): void {
    try {
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      if (!existsSync(this.userModelsPath)) {
        this.saveUserModels([]);
      }
    } catch (error) {
      console.warn('Failed to initialize models config:', error);
    }
  }

  /**
   * Reload profiles from user file.
   * Useful after compiling user profiles or when profiles have been updated externally.
   */
  public reloadProfiles(): void {
    this.profiles = this.loadProfiles();
    this.loadUserModels();
  }

  /**
   * Refresh model metadata from Ollama on startup (async, non-blocking).
   * Queries Ollama for installed models and updates user_models.json while preserving user overrides.
   * Fails silently if Ollama is unavailable or times out.
   */
  private async refreshMetadataAsync(): Promise<void> {
    try {
      // Check if Ollama is available with 2s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return; // Silent fail - Ollama might not be running
      }

      const data = await response.json();

      // Extract model list with size information
      const models = Array.isArray(data.models)
        ? data.models.map((m: { name: string; size?: number }) => ({
            name: m.name,
            sizeBytes: m.size,
          }))
        : [];

      // Update user models (preserves user overrides including tool_support_source)
      if (models.length > 0) {
        this.updateUserModelsFromList(models);
      }
    } catch (error) {
      // Silent fail - not critical for startup
      // Only log in debug mode to avoid noise
      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.warn(
          'Model metadata refresh failed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  private loadProfiles(): LLMProfile[] {
    try {
      // Read from USER file (~/.ollm/LLM_profiles.json)
      // NOT from app config (packages/cli/src/config/LLM_profiles.json)
      if (!existsSync(this.userProfilesPath)) {
        // First run: compile user profiles synchronously
        if (process.env.OLLM_LOG_LEVEL === 'debug') {
          console.log('[ProfileManager] User profiles not found, compiling...');
        }
        // Note: compileUserProfiles is async, but we need sync here
        // We'll trigger compilation and return empty array for now
        // The profiles will be available on next startup
        compileUserProfiles().catch((err) => {
          if (process.env.OLLM_LOG_LEVEL === 'debug') {
            console.warn('[ProfileManager] Failed to compile user profiles:', err);
          }
        });
        return [];
      }

      const raw = readFileSync(this.userProfilesPath, 'utf-8');
      const data = JSON.parse(raw) as ProfilesData;
      const models = data.models || [];

      // Normalize entries: support migration and coercion
      return models.map((m: any) => this.normalizeRawProfile(m));
    } catch (error) {
      if (process.env.OLLM_LOG_LEVEL === 'debug') {
        console.warn('[ProfileManager] Failed to load user profiles:', error);
      }
      return [];
    }
  }

  private normalizeRawProfile(raw: any): LLMProfile {
    const entry = { ...raw } as any;

    if (entry.context_window && !entry.max_context_window) {
      entry.max_context_window = entry.context_window;
    }

    if (!Array.isArray(entry.context_profiles)) {
      entry.context_profiles = [];
    }

    for (const cp of entry.context_profiles) {
      if (cp.vram_estimate_gb == null && typeof cp.vram_estimate === 'string') {
        const match = cp.vram_estimate.match(/([0-9]+(?:\.[0-9]+)?)\s*GB/i);
        if (match) {
          cp.vram_estimate_gb = Number(match[1]);
        } else {
          const matchMb = cp.vram_estimate.match(/([0-9]+(?:\.[0-9]+)?)\s*MB/i);
          if (matchMb) cp.vram_estimate_gb = Number(matchMb[1]) / 1024;
        }
      }
    }

    if (!entry.capabilities) {
      entry.capabilities = {
        toolCalling: Boolean(entry.tool_support),
        vision:
          Array.isArray(entry.abilities) &&
          entry.abilities.some((a: string) => /visual|vision|multimodal/i.test(a)),
        streaming: entry.streaming ?? true,
        reasoning:
          Boolean(entry.thinking_enabled) ||
          (Array.isArray(entry.abilities) &&
            entry.abilities.some((a: string) => /reasoning|think/i.test(a))),
      };
    }

    return entry as LLMProfile;
  }

  private loadUserModels(): void {
    try {
      if (!existsSync(this.userModelsPath)) {
        return;
      }
      const content = readFileSync(this.userModelsPath, 'utf-8');
      const data = JSON.parse(content);
      const models = Array.isArray(data.user_models) ? data.user_models : [];
      this.setUserModels(models);
    } catch (error) {
      console.warn('Failed to load user models list:', error);
    }
  }

  private saveUserModels(userModels: UserModelEntry[]): void {
    try {
      const data = {
        user_models: userModels,
      };
      writeFileSync(this.userModelsPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save user models list:', error);
    }
  }

  public getProfiles(): LLMProfile[] {
    return this.profiles;
  }

  public getUserModels(): UserModelEntry[] {
    this.loadUserModels();
    return this.userModels;
  }

  public setUserModels(models: UserModelEntry[]): void {
    const normalized = models.map((model) => this.normalizeUserModelEntry(model));
    this.userModels = normalized;
    this.saveUserModels(this.userModels);
    refreshModelDatabase();
  }

  private buildFallbackContextProfiles(sizeBytes?: number): {
    profiles: ContextProfile[];
    defaultContext: number;
  } {
    const fallback = this.getFallbackProfile();
    if (!fallback) {
      return {
        profiles: [],
        defaultContext: 4096,
      };
    }

    const baseProfiles = fallback.context_profiles ?? [];
    let filtered = baseProfiles;

    if (typeof sizeBytes === 'number' && sizeBytes > 0) {
      const sizeGB = sizeBytes / (1024 * 1024 * 1024);
      if (sizeGB < 3) {
        filtered = baseProfiles.filter((profile) => profile.size <= 8192);
      } else if (sizeGB < 8) {
        filtered = baseProfiles.filter((profile) => profile.size >= 4096 && profile.size <= 16384);
      } else {
        filtered = baseProfiles.filter((profile) => profile.size >= 8192);
      }
      if (filtered.length === 0) {
        filtered = baseProfiles;
      }
    }

    return {
      profiles: filtered.map((profile) => ({ ...profile })),
      defaultContext:
        fallback.default_context ?? filtered[0]?.size ?? fallback.max_context_window ?? 4096,
    };
  }

  public updateUserModelsFromList(models: Array<{ name: string; sizeBytes?: number }>): void {
    const existing = new Map(this.userModels.map((model) => [model.id, model]));
    const nowIso = new Date().toISOString();

    const nextModels = models.map((model) => {
      const id = model.name;
      const previous = existing.get(id);
      const profile = this.findProfile(id);
      const fallback = this.buildFallbackContextProfiles(model.sizeBytes);
      const defaultContext =
        profile?.default_context ?? previous?.default_context ?? fallback.defaultContext;
      const contextProfiles =
        profile?.context_profiles ?? previous?.context_profiles ?? fallback.profiles;

      // Determine tool_support value with proper precedence
      // Rule: Never override user_confirmed tool support with profile data
      let toolSupport: boolean;
      if (previous?.tool_support_source === 'user_confirmed') {
        // User has explicitly confirmed - preserve their choice
        toolSupport = previous.tool_support ?? false;
      } else {
        // Use profile data, then previous value, then fallback
        toolSupport = profile?.tool_support ?? previous?.tool_support ?? false;
      }

      return {
        id,
        name: profile?.name || model.name,
        source: 'ollama',
        last_seen: nowIso,
        description: profile?.description ?? previous?.description ?? 'No metadata available.',
        abilities: profile?.abilities ?? previous?.abilities ?? [],
        tool_support: toolSupport,
        // Preserve tool support metadata from previous entry
        tool_support_source: previous?.tool_support_source,
        tool_support_confirmed_at: previous?.tool_support_confirmed_at,
        context_profiles: contextProfiles,
        default_context: defaultContext,
        manual_context: previous?.manual_context,
      } satisfies UserModelEntry;
    });

    this.setUserModels(nextModels);
  }

  public getManualContext(modelId: string): number | undefined {
    const entry = this.userModels.find((model) => model.id === modelId);
    return entry?.manual_context;
  }

  public setManualContext(modelId: string, value: number): void {
    const entry = this.userModels.find((model) => model.id === modelId);
    if (entry) {
      entry.manual_context = value;
    }
    this.saveUserModels(this.userModels);
    refreshModelDatabase();
  }

  public getCombinedModels(): Array<{ id: string; name: string; profile?: LLMProfile }> {
    this.loadUserModels();
    return this.userModels.map((model) => {
      const profile = this.findProfile(model.id);
      return {
        id: model.id,
        name: model.name || model.id,
        profile,
      };
    });
  }

  public getContextSettings(): ContextSettings {
    return this.contextSettings;
  }

  public getContextBehavior(profileName?: string): ContextBehaviorProfile | undefined {
    const name = profileName || this.contextSettings.activeProfile;
    return this.contextSettings.profiles[name];
  }

  public getProfileById(id: string): LLMProfile | undefined {
    return this.profiles.find((p) => p.id === id);
  }

  private getFallbackProfile(): LLMProfile | undefined {
    return this.findProfile('llama3.2:3b') ?? this.profiles[0];
  }

  private normalizeContextProfiles(
    source: ContextProfile[] | undefined,
    reference?: ContextProfile[]
  ): ContextProfile[] {
    const fallbackProfiles =
      source && source.length > 0
        ? source
        : reference && reference.length > 0
          ? reference
          : (this.getFallbackProfile()?.context_profiles ?? []);
    const referenceProfiles = reference ?? this.getFallbackProfile()?.context_profiles ?? [];

    return fallbackProfiles.map((profile) => {
      const ref =
        referenceProfiles.find((p) => p.size === profile.size) ??
        this.getFallbackProfile()?.context_profiles?.find((p) => p.size === profile.size);
      const sizeLabel = profile.size_label ?? ref?.size_label;
      const vramEstimate = profile.vram_estimate ?? ref?.vram_estimate ?? '';
      const vramEstimateGb = profile.vram_estimate_gb ?? ref?.vram_estimate_gb;
      const ollamaContextSize =
        profile.ollama_context_size ??
        ref?.ollama_context_size ??
        Math.max(1, Math.floor(profile.size * 0.85));

      return {
        size: profile.size,
        size_label: sizeLabel,
        vram_estimate: vramEstimate,
        vram_estimate_gb: vramEstimateGb,
        ollama_context_size: ollamaContextSize,
      };
    });
  }

  private normalizeUserModelEntry(entry: UserModelEntry): UserModelEntry {
    const profile = this.findProfile(entry.id) ?? this.getFallbackProfile();
    const baseProfiles =
      entry.context_profiles && entry.context_profiles.length > 0
        ? entry.context_profiles
        : (profile?.context_profiles ?? this.getFallbackProfile()?.context_profiles ?? []);
    const normalizedProfiles = this.normalizeContextProfiles(
      baseProfiles,
      profile?.context_profiles
    );
    const defaultContext =
      entry.default_context ?? profile?.default_context ?? normalizedProfiles[0]?.size ?? 4096;
    const maxContextWindow =
      entry.max_context_window ??
      profile?.max_context_window ??
      profile?.context_window ??
      defaultContext;
    const quantization = entry.quantization ?? profile?.quantization ?? 'auto';

    return {
      ...entry,
      name: entry.name ?? profile?.name ?? entry.id,
      description: entry.description ?? profile?.description ?? 'No metadata available.',
      abilities: entry.abilities ?? profile?.abilities ?? [],
      context_profiles: normalizedProfiles,
      default_context: defaultContext,
      max_context_window: maxContextWindow,
      quantization,
      source: entry.source ?? 'ollama',
      last_seen: entry.last_seen ?? new Date().toISOString(),
    };
  }

  private normalizeSearchKey(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private findUserModel(modelName: string): UserModelEntry | undefined {
    const search = this.normalizeSearchKey(modelName);
    return this.userModels.find((model) => {
      if (this.normalizeSearchKey(model.id) === search) return true;
      if (model.name && this.normalizeSearchKey(model.name) === search) return true;
      return false;
    });
  }

  public getModelEntry(modelId: string): UserModelEntry {
    const userEntry = this.findUserModel(modelId);
    if (userEntry) {
      return userEntry;
    }

    const profile = this.findProfile(modelId);
    return this.createUserModelEntryFromProfile(profile ?? this.getFallbackProfile());
  }

  private createUserModelEntryFromProfile(profile?: LLMProfile): UserModelEntry {
    const fallbackProfile =
      profile ??
      ({
        id: 'llama3.2:3b',
        name: 'Llama 3.2 3B',
        creator: 'Unknown',
        parameters: 'Unknown',
        description: 'Fallback LLM entry',
        abilities: [],
        context_profiles: [],
        default_context: 4096,
        max_context_window: 4096,
        quantization: 'auto',
        tool_support: false,
        source: 'profile',
      } as LLMProfile);

    return this.normalizeUserModelEntry({
      id: fallbackProfile.id,
      name: fallbackProfile.name,
      description: fallbackProfile.description,
      abilities: fallbackProfile.abilities,
      tool_support: fallbackProfile.tool_support,
      context_profiles: fallbackProfile.context_profiles ?? [],
      default_context: fallbackProfile.default_context ?? 4096,
      max_context_window:
        fallbackProfile.max_context_window ??
        fallbackProfile.context_window ??
        fallbackProfile.default_context ??
        4096,
      quantization: fallbackProfile.quantization ?? 'auto',
      source: 'profile',
      last_seen: new Date().toISOString(),
    });
  }

  /**
   * Fuzzy find a profile by model name (e.g. matching "llama3.2" to "llama3.2:3b")
   */
  public findProfile(modelName: string): LLMProfile | undefined {
    const search = this.normalizeSearchKey(modelName);

    // Exact ID match
    let match = this.profiles.find((p) => p.id === modelName);
    if (match) return match;

    // ID contains search
    match = this.profiles.find((p) => this.normalizeSearchKey(p.id).includes(search));
    if (match) return match;

    // Name contains search
    match = this.profiles.find((p) => this.normalizeSearchKey(p.name).includes(search));
    return match;
  }
}

export const profileManager = new ProfileManager();
