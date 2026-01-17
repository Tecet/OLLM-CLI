import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import modelsData from '../../config/LLM_models.json' with { type: 'json' };
import { defaultContextBehavior } from '../../config/defaults.js';
import type { LLMProfile, ContextSettings, ContextBehaviorProfile } from '../../config/types.js';

export class ProfileManager {
  private profiles: LLMProfile[];
  private contextSettings: ContextSettings;
  private configPath: string;

  constructor() {
    this.contextSettings = defaultContextBehavior;
    
    // Strategy: Use ~/.ollm/LLM_models.json
    const homeDir = homedir();
    const configDir = join(homeDir, '.ollm');
    this.configPath = join(configDir, 'LLM_models.json');
    
    this.ensureConfigExists(configDir);
    this.profiles = this.loadProfiles();
  }

  private ensureConfigExists(configDir: string): void {
      try {
          if (!existsSync(configDir)) {
              mkdirSync(configDir, { recursive: true });
          }
          
          // If file doesn't exist, save our defaults there immediately
          if (!existsSync(this.configPath)) {
              this.saveProfiles((modelsData as any).models || []);
          }
      } catch (error) {
          console.warn('Failed to initialize models config:', error);
      }
  }

  private loadProfiles(): LLMProfile[] {
      try {
          if (existsSync(this.configPath)) {
              const content = readFileSync(this.configPath, 'utf-8');
              const data = JSON.parse(content);
              return data.models || [];
          }
      } catch (error) {
          console.error('Failed to load user models config:', error);
      }
      // Fallback to internal defaults
      return (modelsData as any).models || [];
  }

  private saveProfiles(profiles: LLMProfile[]): void {
      try {
          const data = { models: profiles };
          writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
      } catch (error) {
          console.error('Failed to save user models config:', error);
      }
  }

  public getProfiles(): LLMProfile[] {
    return this.profiles;
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
