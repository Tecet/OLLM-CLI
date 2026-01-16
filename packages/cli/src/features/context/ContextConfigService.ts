import { promises as fs } from 'fs';
import * as path from 'path';

export interface ContextProfile {
  name: string;
  contextWindow: number;
  compressionThreshold: number;
  retentionRatio: number;
  strategy: 'summarize' | 'truncate';
  summaryPrompt?: string;
}

export interface ContextConfig {
  activeProfile: string;
  profiles: { [key: string]: ContextProfile };
}

const DEFAULT_CONFIG: ContextConfig = {
  activeProfile: 'standard',
  profiles: {
    standard: {
      name: 'Standard (High VRAM)',
      contextWindow: 4096,
      compressionThreshold: 0.6,
      retentionRatio: 0.3,
      strategy: 'summarize',
      summaryPrompt: 'Summarize the following conversation history, retaining key details and context for future reference.'
    },
    low_vram: {
      name: 'Low VRAM / Aggressive',
      contextWindow: 2048,
      compressionThreshold: 0.5,
      retentionRatio: 0.2,
      strategy: 'summarize',
      summaryPrompt: 'Summarize the interaction briefly.'
    }
  }
};

export class ContextConfigService {
  private config: ContextConfig = DEFAULT_CONFIG;
  private configPath: string;

  constructor(workspacePath: string) {
    this.configPath = path.join(workspacePath, 'llm_context.json');
  }

  async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist, we'll use defaults and create it
      await this.save();
    }
  }

  async save(): Promise<void> {
    try {
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.warn('Failed to save context config:', error);
    }
  }

  getActiveProfile(): ContextProfile {
    const profile = this.config.profiles[this.config.activeProfile];
    return profile || DEFAULT_CONFIG.profiles.standard;
  }

  updateProfile(name: string, profile: Partial<ContextProfile>): void {
    if (this.config.profiles[name]) {
      this.config.profiles[name] = { ...this.config.profiles[name], ...profile };
    }
  }

  setActiveProfile(name: string): void {
    if (this.config.profiles[name]) {
      this.config.activeProfile = name;
    }
  }
}
