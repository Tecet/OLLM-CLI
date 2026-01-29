/**
 * Mock ProfileManager for Testing
 * 
 * Provides a complete mock implementation of IProfileManager
 * for use in all context-related tests.
 */

import type { IProfileManager } from '../../integration/providerAwareCompression.js';
import type { ContextProfile } from '../../types.js';

/**
 * Create standard context profiles for testing
 */
export function createStandardProfiles(): ContextProfile[] {
  return [
    {
      size: 4096,
      size_label: '4k',
      vram_estimate: '3.5 GB',
      vram_estimate_gb: 3.5,
      ollama_context_size: 3482,
    },
    {
      size: 8192,
      size_label: '8k',
      vram_estimate: '3.9 GB',
      vram_estimate_gb: 3.9,
      ollama_context_size: 6963,
    },
    {
      size: 16384,
      size_label: '16k',
      vram_estimate: '4.6 GB',
      vram_estimate_gb: 4.6,
      ollama_context_size: 13926,
    },
    {
      size: 32768,
      size_label: '32k',
      vram_estimate: '6.0 GB',
      vram_estimate_gb: 6,
      ollama_context_size: 27853,
    },
    {
      size: 65536,
      size_label: '64k',
      vram_estimate: '8.8 GB',
      vram_estimate_gb: 8.8,
      ollama_context_size: 55706,
    },
    {
      size: 131072,
      size_label: '128k',
      vram_estimate: '14.5 GB',
      vram_estimate_gb: 14.5,
      ollama_context_size: 111411,
    },
  ];
}

/**
 * Mock ProfileManager implementation
 */
export class MockProfileManager implements IProfileManager {
  private models: Map<
    string,
    {
      id: string;
      name: string;
      context_profiles?: ContextProfile[];
      default_context?: number;
    }
  > = new Map();

  /**
   * Add a model to the mock manager
   */
  addModel(
    modelId: string,
    profiles: ContextProfile[],
    defaultContext?: number
  ): void {
    this.models.set(modelId, {
      id: modelId,
      name: modelId,
      context_profiles: profiles,
      default_context: defaultContext,
    });
  }

  /**
   * Get model entry by ID
   */
  getModelEntry(modelId: string) {
    return this.models.get(modelId) || null;
  }

  /**
   * Get all profiles
   */
  getProfiles() {
    return Array.from(this.models.values());
  }
}

/**
 * Create a mock ProfileManager with standard test models
 */
export function createMockProfileManager(): IProfileManager {
  const manager = new MockProfileManager();
  
  // Add standard test models
  manager.addModel('llama3.2:3b', createStandardProfiles(), 131072);
  manager.addModel('mistral:7b', createStandardProfiles(), 32768);
  manager.addModel('codellama:13b', createStandardProfiles(), 16384);
  
  return manager;
}
