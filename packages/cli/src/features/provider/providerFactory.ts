/**
 * Provider Factory
 *
 * Creates provider adapter instances based on configuration.
 */

import type { ProviderAdapter } from '@ollm/core';

export interface ProviderConfig {
  ollama?: {
    host?: string;
    timeout?: number;
  };
}

/**
 * Create a provider adapter from configuration
 * @param config - Provider configuration
 * @returns Provider adapter instance
 */
export function createProvider(config: ProviderConfig): ProviderAdapter {
  let LocalProviderClass: {
    new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter;
  } | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@ollm/ollm-bridge/provider/localProvider.js') as
      | { LocalProvider: { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter } }
      | { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter };
    LocalProviderClass =
      ((mod as Record<string, unknown>).LocalProvider as {
        new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter;
      }) || mod;
  } catch (err) {
    console.warn('Failed to load LocalProvider, using no-op provider:', err);
    LocalProviderClass = class implements ProviderAdapter {
      readonly name = 'no-op';
      constructor(_opts: { baseUrl: string; timeout?: number }) {}
      async *chatStream(
        _req: unknown
      ): AsyncIterable<{ type: 'error'; error: { message: string } }> {
        yield { type: 'error', error: { message: 'Bridge not installed' } };
      }
    } as unknown as { new (opts: { baseUrl: string; timeout?: number }): ProviderAdapter };
  }

  const ollamaConfig = config.ollama || {
    host: 'http://localhost:11434',
    timeout: 30000,
  };

  if (!LocalProviderClass) throw new Error('Failed to initialize LocalProvider');

  return new LocalProviderClass({
    baseUrl: ollamaConfig.host || 'http://localhost:11434',
    timeout: ollamaConfig.timeout || 30000,
  });
}
