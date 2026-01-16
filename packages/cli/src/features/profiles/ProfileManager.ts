import profilesData from '../../config/profiles.json' with { type: 'json' };

export interface ContextProfile {
  size: number;
  size_label?: string;
  vram_estimate: string;
}

export interface LLMProfile {
  id: string;
  name: string;
  creator: string;
  parameters: string;
  quantization: string;
  description: string;
  abilities: string[];
  tool_support?: boolean;
  reasoning_buffer?: string;
  ollama_url?: string;
  context_window: number;
  context_profiles: ContextProfile[];
}

export interface ContextBehaviorProfile {
  name: string;
  contextWindow: number;
  compressionThreshold: number;
  retentionRatio: number;
  strategy: string;
  summaryPrompt: string;
}

export interface ContextSettings {
  activeProfile: string;
  profiles: Record<string, ContextBehaviorProfile>;
}

interface ProfilesData {
  context_behavior: ContextSettings;
  models: LLMProfile[];
}

export class ProfileManager {
  private profiles: LLMProfile[];
  private contextSettings: ContextSettings;

  constructor() {
    const data = profilesData as unknown as ProfilesData;
    this.profiles = data.models || [];
    this.contextSettings = data.context_behavior || { activeProfile: 'standard', profiles: {} };
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
