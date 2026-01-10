/**
 * Provider Registry
 * Manages registration and resolution of provider adapters.
 */

import type { ProviderAdapter } from './types.js';

/**
 * Registry for managing provider adapters.
 * Stores providers by name and manages default provider selection.
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderAdapter>;
  private defaultProviderName?: string;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Register a provider adapter.
   * @param adapter The provider adapter to register
   */
  register(adapter: ProviderAdapter): void {
    this.providers.set(adapter.name, adapter);
  }

  /**
   * Get a provider by name.
   * @param name The provider name
   * @returns The provider adapter, or undefined if not found
   */
  get(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  /**
   * Set the default provider.
   * @param name The name of the provider to set as default
   * @throws Error if the provider is not registered
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not registered`);
    }
    this.defaultProviderName = name;
  }

  /**
   * Get the default provider.
   * @returns The default provider adapter
   * @throws Error if no default provider is set or if the default provider is not found
   */
  getDefault(): ProviderAdapter {
    if (!this.defaultProviderName) {
      throw new Error('No default provider set');
    }
    const provider = this.providers.get(this.defaultProviderName);
    if (!provider) {
      throw new Error(
        `Default provider "${this.defaultProviderName}" not found`
      );
    }
    return provider;
  }

  /**
   * List all registered provider names.
   * @returns Array of provider names
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
