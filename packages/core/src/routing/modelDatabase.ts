/**
 * Model Database - Registry of known model capabilities, context limits, and characteristics
 */

// @ts-expect-error - picomatch doesn't have type definitions
import picomatch from 'picomatch';

export interface ModelCapabilities {
  toolCalling: boolean;
  vision: boolean;
  streaming: boolean;
}

export interface ModelEntry {
  pattern: string; // Glob pattern (e.g., "llama3.1:*")
  family: string; // Model family
  contextWindow: number; // Max context tokens
  maxOutputTokens?: number; // Max generation tokens
  capabilities: ModelCapabilities;
  profiles: string[]; // Suitable routing profiles
}

/**
 * Default values for unknown models
 */
const DEFAULT_MODEL_ENTRY: Omit<ModelEntry, 'pattern' | 'family'> = {
  contextWindow: 4096,
  capabilities: {
    toolCalling: false,
    vision: false,
    streaming: true,
  },
  profiles: ['general'],
};

/**
 * Known model database with pattern matching
 */
const MODEL_DATABASE: ModelEntry[] = [
  {
    pattern: 'llama3.1:*',
    family: 'llama',
    contextWindow: 128000,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code'],
  },
  {
    pattern: 'llama3:*',
    family: 'llama',
    contextWindow: 8192,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code'],
  },
  {
    pattern: 'codellama:*',
    family: 'llama',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'mistral:*',
    family: 'mistral',
    contextWindow: 32768,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'fast'],
  },
  {
    pattern: 'phi3:*',
    family: 'phi',
    contextWindow: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast'],
  },
  {
    pattern: 'phi:*',
    family: 'phi',
    contextWindow: 2048,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast'],
  },
  {
    pattern: 'gemma:*',
    family: 'gemma',
    contextWindow: 8192,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast', 'general'],
  },
  {
    pattern: 'gemma2:*',
    family: 'gemma',
    contextWindow: 8192,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['fast', 'general'],
  },
  {
    pattern: 'deepseek-coder:*',
    family: 'deepseek',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'qwen:*',
    family: 'qwen',
    contextWindow: 32768,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code'],
  },
  {
    pattern: 'qwen2:*',
    family: 'qwen',
    contextWindow: 32768,
    capabilities: { toolCalling: true, vision: false, streaming: true },
    profiles: ['general', 'code'],
  },
  {
    pattern: 'starcoder:*',
    family: 'starcoder',
    contextWindow: 8192,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'starcoder2:*',
    family: 'starcoder',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'wizardcoder:*',
    family: 'wizardcoder',
    contextWindow: 16384,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['code'],
  },
  {
    pattern: 'neural-chat:*',
    family: 'neural-chat',
    contextWindow: 8192,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['general'],
  },
  {
    pattern: 'orca:*',
    family: 'orca',
    contextWindow: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['general'],
  },
  {
    pattern: 'vicuna:*',
    family: 'vicuna',
    contextWindow: 4096,
    capabilities: { toolCalling: false, vision: false, streaming: true },
    profiles: ['general'],
  },
];

export class ModelDatabase {
  private entries: ModelEntry[];
  private matchers: Map<string, ReturnType<typeof picomatch>>;

  constructor(entries: ModelEntry[] = MODEL_DATABASE) {
    this.entries = entries;
    this.matchers = new Map();

    // Pre-compile glob patterns for performance
    for (const entry of entries) {
      this.matchers.set(entry.pattern, picomatch(entry.pattern));
    }
  }

  /**
   * Look up a model by name, returning its entry or null if not found
   */
  lookup(modelName: string): ModelEntry | null {
    for (const entry of this.entries) {
      const matcher = this.matchers.get(entry.pattern);
      if (matcher && matcher(modelName)) {
        return entry;
      }
    }
    return null;
  }

  /**
   * Get context window size for a model, with safe default
   */
  getContextWindow(modelName: string): number {
    const entry = this.lookup(modelName);
    return entry?.contextWindow ?? DEFAULT_MODEL_ENTRY.contextWindow;
  }

  /**
   * Get capabilities for a model, with safe defaults
   */
  getCapabilities(modelName: string): ModelCapabilities {
    const entry = this.lookup(modelName);
    return entry?.capabilities ?? DEFAULT_MODEL_ENTRY.capabilities;
  }

  /**
   * Get suitable routing profiles for a model
   */
  getSuitableProfiles(modelName: string): string[] {
    const entry = this.lookup(modelName);
    return entry?.profiles ?? DEFAULT_MODEL_ENTRY.profiles;
  }

  /**
   * List all known model entries
   */
  listKnownModels(): ModelEntry[] {
    return [...this.entries];
  }

  /**
   * Get the model family for a model name
   */
  getFamily(modelName: string): string | null {
    const entry = this.lookup(modelName);
    return entry?.family ?? null;
  }
}

// Export singleton instance
export const modelDatabase = new ModelDatabase();
