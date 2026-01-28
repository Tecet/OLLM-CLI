/**
 * Model Router - Selects appropriate models based on routing profiles and availability
 */

import { ModelDatabase, modelDatabase, ModelCapabilities } from './modelDatabase.js';
import { getRoutingProfile, RoutingProfile } from './routingProfiles.js';

export interface ModelInfo {
  name: string;
  size: number;
  modifiedAt: Date;
  family: string;
  contextWindow: number;
  capabilities: ModelCapabilities;
  parameterCount?: number;
}

export interface ModelRouterConfig {
  overrides?: Record<string, string>; // Profile name -> model name overrides
}

export class ModelRouter {
  private database: ModelDatabase;
  private config: ModelRouterConfig;
  private visitedProfiles: Set<string>; // For circular fallback detection

  constructor(database: ModelDatabase = modelDatabase, config: ModelRouterConfig = {}) {
    this.database = database;
    this.config = config;
    this.visitedProfiles = new Set();
  }

  /**
   * Select a model based on routing profile and available models
   * Returns model name or null if no suitable model found
   */
  selectModel(profileName: string, availableModels: ModelInfo[]): string | null {
    // Check for configuration override first
    if (this.config.overrides?.[profileName]) {
      const overrideModel = this.config.overrides[profileName];
      // Verify the override model is available
      const isAvailable = availableModels.some((m) => m.name === overrideModel);
      if (isAvailable) {
        return overrideModel;
      }
    }

    // Get the routing profile
    const profile = getRoutingProfile(profileName);
    if (!profile) {
      return null;
    }

    // Reset visited profiles for new selection
    this.visitedProfiles.clear();

    return this.selectModelWithProfile(profile, availableModels);
  }

  /**
   * Internal method to select model with profile, handling fallbacks
   */
  private selectModelWithProfile(
    profile: RoutingProfile,
    availableModels: ModelInfo[]
  ): string | null {
    // Detect circular fallback
    if (this.visitedProfiles.has(profile.name)) {
      return null;
    }
    this.visitedProfiles.add(profile.name);

    // Filter models by minimum context window
    let candidates = availableModels.filter(
      (model) => model.contextWindow >= profile.minContextWindow
    );

    // Filter by required capabilities
    candidates = candidates.filter((model) =>
      this.hasRequiredCapabilities(model.capabilities, profile.requiredCapabilities)
    );

    // If no candidates match, try fallback profile
    if (candidates.length === 0) {
      if (profile.fallbackProfile) {
        const fallbackProfile = getRoutingProfile(profile.fallbackProfile);
        if (fallbackProfile) {
          return this.selectModelWithProfile(fallbackProfile, availableModels);
        }
      }
      return null;
    }

    // Score candidates by preferred family match
    const scoredCandidates = candidates.map((model) => ({
      model,
      score: this.scoreModel(model, profile),
    }));

    // Sort by score (descending) and return highest scoring model
    scoredCandidates.sort((a, b) => b.score - a.score);

    return scoredCandidates[0].model.name;
  }

  /**
   * Check if model has all required capabilities
   */
  private hasRequiredCapabilities(
    modelCapabilities: ModelCapabilities,
    requiredCapabilities: string[]
  ): boolean {
    for (const capability of requiredCapabilities) {
      const capKey = capability as keyof ModelCapabilities;
      if (!modelCapabilities[capKey]) {
        return false;
      }
    }
    return true;
  }

  /**
   * Score a model based on preferred families
   * Higher score = better match
   */
  private scoreModel(model: ModelInfo, profile: RoutingProfile): number {
    let score = 0;

    // Check if model family is in preferred families
    const familyIndex = profile.preferredFamilies.indexOf(model.family);
    if (familyIndex !== -1) {
      // Earlier in the list = higher score
      // First family gets highest score, decreasing for later families
      score = profile.preferredFamilies.length - familyIndex;
    }

    return score;
  }

  /**
   * Get a routing profile by name
   */
  getProfile(name: string): RoutingProfile | null {
    return getRoutingProfile(name);
  }

  /**
   * List all available routing profiles
   */
  listProfiles(): RoutingProfile[] {
    return [
      {
        name: 'fast',
        description: 'Quick responses with smaller models',
        preferredFamilies: ['phi', 'gemma', 'mistral'],
        minContextWindow: 4096,
        requiredCapabilities: ['streaming'],
        fallbackProfile: 'general',
      },
      {
        name: 'general',
        description: 'Balanced performance for most tasks',
        preferredFamilies: ['llama', 'mistral', 'qwen'],
        minContextWindow: 8192,
        requiredCapabilities: ['streaming'],
      },
      {
        name: 'code',
        description: 'Optimized for code generation',
        preferredFamilies: ['codellama', 'deepseek-coder', 'starcoder', 'qwen'],
        minContextWindow: 16384,
        requiredCapabilities: ['streaming'],
        fallbackProfile: 'general',
      },
      {
        name: 'creative',
        description: 'Creative writing and storytelling',
        preferredFamilies: ['llama', 'mistral'],
        minContextWindow: 8192,
        requiredCapabilities: ['streaming'],
        fallbackProfile: 'general',
      },
    ];
  }

  /**
   * Validate if a model meets profile requirements
   */
  validateModel(modelName: string, profileName: string): boolean {
    const profile = getRoutingProfile(profileName);
    if (!profile) {
      return false;
    }

    const contextWindow = this.database.getContextWindow(modelName);
    const capabilities = this.database.getCapabilities(modelName);

    // Check context window
    if (contextWindow < profile.minContextWindow) {
      return false;
    }

    // Check required capabilities
    return this.hasRequiredCapabilities(capabilities, profile.requiredCapabilities);
  }
}
