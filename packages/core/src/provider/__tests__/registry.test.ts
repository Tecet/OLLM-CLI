/**
 * Property-based tests for Provider Registry.
 * These tests validate the correctness properties defined in the design document.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ProviderRegistry } from '../registry.js';
import type { ProviderAdapter, ProviderRequest, ProviderEvent } from '../types.js';

/**
 * Arbitraries (generators) for property-based testing
 */

// Generate a mock provider adapter
const mockProviderArbitrary = fc.record({
  name: fc.string({ minLength: 1 }),
  chatStream: fc.constant(async function* (): AsyncIterable<ProviderEvent> {
    yield { type: 'text', value: 'mock' };
  }),
});

// Generate a unique provider name
const providerNameArbitrary = fc.string({ minLength: 1 });

describe('Provider Registry - Property-Based Tests', () => {
  describe('Property 1: Provider Registration and Retrieval', () => {
    it('should retrieve the same adapter instance after registration', () => {
      // Feature: stage-02-core-provider, Property 1: Provider Registration and Retrieval
      // Validates: Requirements 1.1, 1.2
      fc.assert(
        fc.property(
          providerNameArbitrary,
          mockProviderArbitrary,
          (name: string, mockProvider) => {
            const registry = new ProviderRegistry();

            // Set the provider name to match the registration key
            const provider = { ...mockProvider, name } as ProviderAdapter;

            // Register the provider
            registry.register(provider);

            // Retrieve the provider by name
            const retrieved = registry.get(name);

            // Should return the same adapter instance
            expect(retrieved).toBe(provider);
            expect(retrieved?.name).toBe(name);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return undefined for unregistered providers', () => {
      // Feature: stage-02-core-provider, Property 1: Provider Registration and Retrieval
      // Validates: Requirements 1.1, 1.2
      fc.assert(
        fc.property(
          providerNameArbitrary,
          providerNameArbitrary,
          (registeredName: string, unregisteredName: string) => {
            // Skip if names are the same
            fc.pre(registeredName !== unregisteredName);

            const registry = new ProviderRegistry();
            const provider = {
              name: registeredName,
              chatStream: async function* () {
                yield { type: 'text', value: 'mock' } as ProviderEvent;
              },
            } as ProviderAdapter;

            registry.register(provider);

            // Attempting to get an unregistered provider should return undefined
            const retrieved = registry.get(unregisteredName);
            expect(retrieved).toBeUndefined();

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Default Provider Resolution', () => {
    it('should return the default provider when set', () => {
      // Feature: stage-02-core-provider, Property 2: Default Provider Resolution
      // Validates: Requirements 1.3, 1.5
      fc.assert(
        fc.property(
          providerNameArbitrary,
          mockProviderArbitrary,
          (name: string, mockProvider) => {
            const registry = new ProviderRegistry();
            const provider = { ...mockProvider, name } as ProviderAdapter;

            // Register and set as default
            registry.register(provider);
            registry.setDefault(name);

            // getDefault() should return the same adapter
            const defaultProvider = registry.getDefault();
            expect(defaultProvider).toBe(provider);
            expect(defaultProvider.name).toBe(name);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should throw error when setting unregistered provider as default', () => {
      // Feature: stage-02-core-provider, Property 2: Default Provider Resolution
      // Validates: Requirements 1.3, 1.5
      fc.assert(
        fc.property(providerNameArbitrary, (name: string) => {
          const registry = new ProviderRegistry();

          // Attempting to set an unregistered provider as default should throw
          expect(() => registry.setDefault(name)).toThrow(
            `Provider "${name}" not registered`
          );

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('should throw error when getting default with no default set', () => {
      // Feature: stage-02-core-provider, Property 2: Default Provider Resolution
      // Validates: Requirements 1.3, 1.5
      const registry = new ProviderRegistry();

      // Attempting to get default when none is set should throw
      expect(() => registry.getDefault()).toThrow('No default provider set');
    });

    it('should update default provider when set multiple times', () => {
      // Feature: stage-02-core-provider, Property 2: Default Provider Resolution
      // Validates: Requirements 1.3, 1.5
      fc.assert(
        fc.property(
          providerNameArbitrary,
          providerNameArbitrary,
          mockProviderArbitrary,
          mockProviderArbitrary,
          (name1: string, name2: string, mock1, mock2) => {
            // Skip if names are the same
            fc.pre(name1 !== name2);

            const registry = new ProviderRegistry();
            const provider1 = { ...mock1, name: name1 } as ProviderAdapter;
            const provider2 = { ...mock2, name: name2 } as ProviderAdapter;

            // Register both providers
            registry.register(provider1);
            registry.register(provider2);

            // Set first as default
            registry.setDefault(name1);
            expect(registry.getDefault()).toBe(provider1);

            // Set second as default
            registry.setDefault(name2);
            expect(registry.getDefault()).toBe(provider2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Provider List Completeness', () => {
    it('should return all registered provider names', () => {
      // Feature: stage-02-core-provider, Property 3: Provider List Completeness
      // Validates: Requirements 1.4
      fc.assert(
        fc.property(
          fc.array(providerNameArbitrary, { minLength: 1, maxLength: 10 }),
          (names: string[]) => {
            // Ensure unique names
            const uniqueNames = Array.from(new Set(names));
            fc.pre(uniqueNames.length > 0);

            const registry = new ProviderRegistry();

            // Register providers with unique names
            for (const name of uniqueNames) {
              const provider = {
                name,
                chatStream: async function* () {
                  yield { type: 'text', value: 'mock' } as ProviderEvent;
                },
              } as ProviderAdapter;
              registry.register(provider);
            }

            // Get the list of registered providers
            const list = registry.list();

            // Should contain exactly the registered names
            expect(list.length).toBe(uniqueNames.length);

            // Every registered name should be in the list
            for (const name of uniqueNames) {
              expect(list).toContain(name);
            }

            // Every name in the list should be a registered name
            for (const name of list) {
              expect(uniqueNames).toContain(name);
            }

            // No duplicates in the list
            const uniqueList = Array.from(new Set(list));
            expect(uniqueList.length).toBe(list.length);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return empty array for empty registry', () => {
      // Feature: stage-02-core-provider, Property 3: Provider List Completeness
      // Validates: Requirements 1.4
      const registry = new ProviderRegistry();
      const list = registry.list();

      expect(list).toEqual([]);
      expect(list.length).toBe(0);
    });

    it('should update list when providers are added', () => {
      // Feature: stage-02-core-provider, Property 3: Provider List Completeness
      // Validates: Requirements 1.4
      fc.assert(
        fc.property(
          providerNameArbitrary,
          providerNameArbitrary,
          (name1: string, name2: string) => {
            // Skip if names are the same
            fc.pre(name1 !== name2);

            const registry = new ProviderRegistry();

            // Initially empty
            expect(registry.list()).toEqual([]);

            // Add first provider
            const provider1 = {
              name: name1,
              chatStream: async function* () {
                yield { type: 'text', value: 'mock' } as ProviderEvent;
              },
            } as ProviderAdapter;
            registry.register(provider1);
            expect(registry.list()).toContain(name1);
            expect(registry.list().length).toBe(1);

            // Add second provider
            const provider2 = {
              name: name2,
              chatStream: async function* () {
                yield { type: 'text', value: 'mock' } as ProviderEvent;
              },
            } as ProviderAdapter;
            registry.register(provider2);
            expect(registry.list()).toContain(name1);
            expect(registry.list()).toContain(name2);
            expect(registry.list().length).toBe(2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
