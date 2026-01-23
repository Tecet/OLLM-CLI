import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';

import { defaultContextBehavior } from '../../config/defaults.js';
import profilesData from '../../config/LLM_profiles.json' with { type: 'json' };

import type { LLMProfile, ContextSettings, ContextBehaviorProfile, ContextProfile, UserModelEntry, ProfilesData } from '../../config/types.js';

const profiles = profilesData as ProfilesData;

// Default Ollama base URL
const OLLAMA_BASE_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';

export class ProfileManager {
  private profiles: LLMProfile[];
  private contextSettings: ContextSettings;
  private userModels: UserModelEntry[];
  private userModelsPath: string;

  constructor() {
    this.contextSettings = defaultContextBehavior;
    this.userModels = [];
    
    // Strategy: Use ~/.ollm/user_models.json
    // During tests (Vitest) prefer an isolated temp home directory to avoid global state
    const homeDir = process.env.VITEST
      ? join(tmpdir(), `ollm-vitest-${process.pid}`)
      : homedir();
    const configDir = join(homeDir, '.ollm');
    this.userModelsPath = join(configDir, 'user_models.json');
    
    this.ensureConfigExists(configDir);
    this.profiles = this.loadProfiles();
    this.loadUserModels();
    
    // Auto-refresh on startup (async, non-blocking)
    this.refreshMetadataAsync().catch(err => {
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
        signal: controller.signal
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
            sizeBytes: m.size
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
        console.warn('Model metadata refresh failed:', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private loadProfiles(): LLMProfile[] {
      const raw = profiles.models || [];

      // Normalize entries: support migration and coercion
      const normalized = raw.map((m: any) => {
        const entry = { ...m } as any;

        // Support old key `context_window` -> `max_context_window`
        if (entry.context_window && !entry.max_context_window) {
          entry.max_context_window = entry.context_window;
        }

        // Ensure context_profiles exist
        if (!Array.isArray(entry.context_profiles)) {
          entry.context_profiles = [];
        }

        // Coerce vram_estimate strings to numeric GB field
        for (const cp of entry.context_profiles) {
          if (cp.vram_estimate_gb == null && typeof cp.vram_estimate === 'string') {
            const match = cp.vram_estimate.match(/([0-9]+(?:\.[0-9]+)?)\s*GB/i);
            if (match) {
              cp.vram_estimate_gb = Number(match[1]);
            } else {
              // Fallback: try MB
              const matchMb = cp.vram_estimate.match(/([0-9]+(?:\.[0-9]+)?)\s*MB/i);
              if (matchMb) cp.vram_estimate_gb = Number(matchMb[1]) / 1024;
            }
          }
        }

        // Add capabilities object if missing
        if (!entry.capabilities) {
          entry.capabilities = {
            toolCalling: Boolean(entry.tool_support),
            vision: Array.isArray(entry.abilities) && entry.abilities.some((a: string) => /visual|vision|multimodal/i.test(a)),
            streaming: entry.streaming ?? true,
            reasoning: Boolean(entry.thinking_enabled) || (Array.isArray(entry.abilities) && entry.abilities.some((a: string) => /reasoning|think/i.test(a)))
          };
        }

        return entry as LLMProfile;
      });

      return normalized as LLMProfile[];
  }

  private loadUserModels(): void {
      try {
          if (!existsSync(this.userModelsPath)) {
              return;
          }
          const content = readFileSync(this.userModelsPath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data.user_models)) {
              // Migration: Add default values for new fields if missing
              this.userModels = data.user_models.map((model: UserModelEntry) => ({
                  ...model,
                  // Preserve existing tool_support_source and tool_support_confirmed_at
                  // No defaults needed - these are optional fields
              }));
          }
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
    this.userModels = models;
    this.saveUserModels(this.userModels);
  }

  private buildFallbackContextProfiles(sizeBytes?: number): { profiles: ContextProfile[]; defaultContext: number } {
    const fallback = profiles.fallback_model;
    const defaultSizes: number[] = Array.isArray(fallback?.context_sizes)
      ? fallback.context_sizes
      : [2048, 4096, 8192, 16384, 32768];
    let sizes = defaultSizes;

    if (typeof sizeBytes === 'number' && sizeBytes > 0) {
      const sizeGB = sizeBytes / (1024 * 1024 * 1024);
      if (sizeGB < 3) {
        sizes = defaultSizes.filter(size => size <= 8192);
      } else if (sizeGB < 8) {
        sizes = defaultSizes.filter(size => size >= 4096 && size <= 16384);
      } else {
        sizes = defaultSizes.filter(size => size >= 8192);
      }
      if (sizes.length === 0) {
        sizes = defaultSizes;
      }
    }

    return {
      profiles: sizes.map(size => ({
        size,
        size_label: size >= 1024 ? `${size / 1024}k` : `${size}`,
        vram_estimate: '',
      })),
      defaultContext: fallback?.default_context ?? sizes[0] ?? 4096,
    };
  }

  public updateUserModelsFromList(models: Array<{ name: string; sizeBytes?: number }>): void {
    const existing = new Map(this.userModels.map(model => [model.id, model]));
    const nowIso = new Date().toISOString();

    const nextModels = models.map(model => {
      const id = model.name;
      const previous = existing.get(id);
      const profile = this.findProfile(id);
      const fallback = this.buildFallbackContextProfiles(model.sizeBytes);
      const defaultContext = profile?.default_context
        ?? previous?.default_context
        ?? fallback.defaultContext;
      const contextProfiles = profile?.context_profiles
        ?? previous?.context_profiles
        ?? fallback.profiles;

      // Determine tool_support value with proper precedence
      // Rule: Never override user_confirmed tool support with profile data
      let toolSupport: boolean;
      if (previous?.tool_support_source === 'user_confirmed') {
        // User has explicitly confirmed - preserve their choice
        toolSupport = previous.tool_support ?? false;
      } else {
        // Use profile data, then previous value, then fallback
        toolSupport = profile?.tool_support ?? previous?.tool_support ?? profiles.fallback_model?.tool_support ?? false;
      }

      return {
        id,
        name: profile?.name || model.name,
        source: 'ollama',
        last_seen: nowIso,
        description: profile?.description ?? previous?.description ?? profiles.fallback_model?.description ?? 'No metadata available.',
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

    this.userModels = nextModels;
    this.saveUserModels(this.userModels);
  }

  public getManualContext(modelId: string): number | undefined {
    const entry = this.userModels.find(model => model.id === modelId);
    return entry?.manual_context;
  }

  public setManualContext(modelId: string, value: number): void {
    const entry = this.userModels.find(model => model.id === modelId);
    if (entry) {
      entry.manual_context = value;
    }
    this.saveUserModels(this.userModels);
  }

  public getCombinedModels(): Array<{ id: string; name: string; profile?: LLMProfile }> {
    this.loadUserModels();
    return this.userModels.map(model => {
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
    return this.profiles.find(p => p.id === id);
  }

  /**
   * Fuzzy find a profile by model name (e.g. matching "llama3.2" to "llama3.2:3b")
   */
  public findProfile(modelName: string): LLMProfile | undefined {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const search = normalize(modelName);
    
    // Exact ID match
    let match = this.profiles.find(p => p.id === modelName);
    if (match) return match;

    // ID contains search
    match = this.profiles.find(p => normalize(p.id).includes(search));
    if (match) return match;

    // Name contains search
    match = this.profiles.find(p => normalize(p.name).includes(search));
    return match;
  }
}

export const profileManager = new ProfileManager();
