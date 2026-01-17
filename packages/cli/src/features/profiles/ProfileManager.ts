import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import profilesData from '../../config/LLM_profiles.json' with { type: 'json' };
import { defaultContextBehavior } from '../../config/defaults.js';
import type { LLMProfile, ContextSettings, ContextBehaviorProfile, ContextProfile, UserModelEntry } from '../../config/types.js';

export class ProfileManager {
  private profiles: LLMProfile[];
  private contextSettings: ContextSettings;
  private userModels: UserModelEntry[];
  private userModelsPath: string;

  constructor() {
    this.contextSettings = defaultContextBehavior;
    this.userModels = [];
    
    // Strategy: Use ~/.ollm/user_models.json
    const homeDir = homedir();
    const configDir = join(homeDir, '.ollm');
    this.userModelsPath = join(configDir, 'user_models.json');
    
    this.ensureConfigExists(configDir);
    this.profiles = this.loadProfiles();
    this.loadUserModels();
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

  private loadProfiles(): LLMProfile[] {
      return (profilesData as any).models || [];
  }

  private loadUserModels(): void {
      try {
          if (!existsSync(this.userModelsPath)) {
              return;
          }
          const content = readFileSync(this.userModelsPath, 'utf-8');
          const data = JSON.parse(content);
          if (Array.isArray(data.user_models)) {
              this.userModels = data.user_models;
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
    const fallback = (profilesData as any).fallback_model;
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
      defaultContext: (fallback?.default_context as number) || sizes[0] || 4096,
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

      return {
        id,
        name: profile?.name || model.name,
        source: 'ollama',
        last_seen: nowIso,
        description: profile?.description ?? previous?.description ?? (profilesData as any).fallback_model?.description ?? 'No metadata available.',
        abilities: profile?.abilities ?? previous?.abilities ?? [],
        tool_support: profile?.tool_support ?? previous?.tool_support ?? (profilesData as any).fallback_model?.tool_support ?? false,
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
