/**
 * Provider Registry
 * Manages registration and resolution of provider adapters.
 */

import type { ProviderAdapter } from './types.js';

/**
 * Provider Registry
 * 
 * Manages registration and resolution of provider adapters.
 * Provides centralized access to all registered providers and
 * maintains a default provider for convenience.
 * 
 * Usage Pattern:
 * 1. Create registry instance
 * 2. Register provider adapters
 * 3. Set default provider
 * 4. Resolve providers by name or use default
 * 
 * @example
 * ```typescript
 * const registry = new ProviderRegistry();
 * 
 * // Register providers
 * const localProvider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
 * registry.register(localProvider);
 * 
 * // Set default
 * registry.setDefault('local');
 * 
 * // Use providers
 * const provider = registry.get('local');
 * const defaultProvider = registry.getDefault();
 * ```
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderAdapter>;
  private defaultProviderName?: string;

  constructor() {
    this.providers = new Map();
  }

  /**
   * Register a provider adapter.
   * 
   * Providers must have a unique name and implement the ProviderAdapter interface.
   * Attempting to register a provider with a duplicate name will throw an error.
   * 
   * Validation:
   * - Provider name must be non-empty
   * - Provider name must be unique
   * - Provider must implement chatStream method
   * 
   * @param adapter - The provider adapter to register
   * @throws {Error} If provider name is empty or already registered
   * @throws {Error} If provider doesn't implement required methods
   * 
   * @example
   * ```typescript
   * const registry = new ProviderRegistry();
   * const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
   * registry.register(provider);
   * ```
   */
  register(adapter: ProviderAdapter): void {
    // Validate provider name
    if (!adapter.name || adapter.name.trim() === '') {
      throw new Error('Provider name is required and must be non-empty');
    }

    // Check for duplicates
    if (this.providers.has(adapter.name)) {
      throw new Error(`Provider "${adapter.name}" is already registered`);
    }

    // Validate chatStream method exists
    if (typeof adapter.chatStream !== 'function') {
      throw new Error(
        `Provider "${adapter.name}" must implement chatStream method`
      );
    }

    this.providers.set(adapter.name, adapter);
  }

  /**
   * Get a provider by name.
   * 
   * Returns the provider adapter with the specified name,
   * or undefined if no provider with that name is registered.
   * 
   * @param name - The provider name
   * @returns The provider adapter, or undefined if not found
   * 
   * @example
   * ```typescript
   * const provider = registry.get('local');
   * if (provider) {
   *   // Use provider
   * } else {
   *   console.error('Provider not found');
   * }
   * ```
   */
  get(name: string): ProviderAdapter | undefined {
    return this.providers.get(name);
  }

  /**
   * Set the default provider.
   * 
   * The default provider is used when no specific provider is requested.
   * The provider must already be registered before setting it as default.
   * 
   * @param name - The name of the provider to set as default
   * @throws {Error} If the provider is not registered
   * 
   * @example
   * ```typescript
   * registry.register(localProvider);
   * registry.setDefault('local');
   * 
   * // Now getDefault() will return localProvider
   * const provider = registry.getDefault();
   * ```
   */
  setDefault(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider "${name}" not registered`);
    }
    this.defaultProviderName = name;
  }

  /**
   * Get the default provider.
   * 
   * Returns the provider that was set as default using setDefault().
   * Throws an error if no default provider has been set.
   * 
   * @returns The default provider adapter
   * @throws {Error} If no default provider is set
   * @throws {Error} If the default provider is not found (should not happen)
   * 
   * @example
   * ```typescript
   * try {
   *   const provider = registry.getDefault();
   *   // Use provider
   * } catch (error) {
   *   console.error('No default provider configured');
   * }
   * ```
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
   * 
   * Returns an array of all provider names that have been registered.
   * Useful for displaying available providers to users or for debugging.
   * 
   * @returns Array of provider names
   * 
   * @example
   * ```typescript
   * const providers = registry.list();
   * console.log('Available providers:', providers.join(', '));
   * // Output: "Available providers: local, vllm, openai"
   * ```
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }
}
