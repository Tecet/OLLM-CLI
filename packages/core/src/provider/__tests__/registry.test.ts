/**
 * Unit tests for ProviderRegistry.
 * Tests provider registration, resolution, default provider management, and error handling.
 *
 * Feature: stage-08-testing-qa
 * Task: 38. Add Provider System Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { MockProvider } from '@ollm/test-utils';

import { ProviderRegistry } from '../registry.js';

import type { ProviderAdapter } from '../types.js';

describe('ProviderRegistry - Unit Tests', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('Provider Registration', () => {
    it('should register a provider successfully', () => {
      const provider = new MockProvider({ name: 'test-provider' });

      expect(() => registry.register(provider)).not.toThrow();

      const retrieved = registry.get('test-provider');
      expect(retrieved).toBe(provider);
    });

    it('should throw error when registering provider with empty name', () => {
      const provider = new MockProvider({ name: '' });

      expect(() => registry.register(provider)).toThrow(
        'Provider name is required and must be non-empty'
      );
    });

    it('should throw error when registering provider with whitespace-only name', () => {
      const provider = new MockProvider({ name: '   ' });

      expect(() => registry.register(provider)).toThrow(
        'Provider name is required and must be non-empty'
      );
    });

    it('should throw error when registering duplicate provider name', () => {
      const provider1 = new MockProvider({ name: 'duplicate' });
      const provider2 = new MockProvider({ name: 'duplicate' });

      registry.register(provider1);

      expect(() => registry.register(provider2)).toThrow(
        'Provider "duplicate" is already registered'
      );
    });

    it('should throw error when provider does not implement chatStream', () => {
      const invalidProvider = {
        name: 'invalid',
        // Missing chatStream method
      } as ProviderAdapter;

      expect(() => registry.register(invalidProvider)).toThrow(
        'Provider "invalid" must implement chatStream method'
      );
    });

    it('should register multiple providers with different names', () => {
      const provider1 = new MockProvider({ name: 'provider-1' });
      const provider2 = new MockProvider({ name: 'provider-2' });
      const provider3 = new MockProvider({ name: 'provider-3' });

      registry.register(provider1);
      registry.register(provider2);
      registry.register(provider3);

      expect(registry.get('provider-1')).toBe(provider1);
      expect(registry.get('provider-2')).toBe(provider2);
      expect(registry.get('provider-3')).toBe(provider3);
    });
  });

  describe('Provider Retrieval', () => {
    it('should return provider by name', () => {
      const provider = new MockProvider({ name: 'test' });
      registry.register(provider);

      const retrieved = registry.get('test');

      expect(retrieved).toBe(provider);
    });

    it('should return undefined for non-existent provider', () => {
      const retrieved = registry.get('non-existent');

      expect(retrieved).toBeUndefined();
    });

    it('should return undefined for empty string name', () => {
      const retrieved = registry.get('');

      expect(retrieved).toBeUndefined();
    });

    it('should be case-sensitive when retrieving providers', () => {
      const provider = new MockProvider({ name: 'TestProvider' });
      registry.register(provider);

      expect(registry.get('TestProvider')).toBe(provider);
      expect(registry.get('testprovider')).toBeUndefined();
      expect(registry.get('TESTPROVIDER')).toBeUndefined();
    });
  });

  describe('Default Provider Management', () => {
    it('should set default provider successfully', () => {
      const provider = new MockProvider({ name: 'default-provider' });
      registry.register(provider);

      expect(() => registry.setDefault('default-provider')).not.toThrow();

      const defaultProvider = registry.getDefault();
      expect(defaultProvider).toBe(provider);
    });

    it('should throw error when setting non-existent provider as default', () => {
      expect(() => registry.setDefault('non-existent')).toThrow(
        'Provider "non-existent" not registered'
      );
    });

    it('should throw error when getting default before setting one', () => {
      expect(() => registry.getDefault()).toThrow('No default provider set');
    });

    it('should update default provider when set multiple times', () => {
      const provider1 = new MockProvider({ name: 'provider-1' });
      const provider2 = new MockProvider({ name: 'provider-2' });

      registry.register(provider1);
      registry.register(provider2);

      registry.setDefault('provider-1');
      expect(registry.getDefault()).toBe(provider1);

      registry.setDefault('provider-2');
      expect(registry.getDefault()).toBe(provider2);
    });

    it('should clear default when unregistering default provider', () => {
      const provider = new MockProvider({ name: 'default' });
      registry.register(provider);
      registry.setDefault('default');

      registry.unregister('default');

      expect(() => registry.getDefault()).toThrow('No default provider set');
    });
  });

  describe('Provider Unregistration', () => {
    it('should unregister provider successfully', () => {
      const provider = new MockProvider({ name: 'to-remove' });
      registry.register(provider);

      const result = registry.unregister('to-remove');

      expect(result).toBe(true);
      expect(registry.get('to-remove')).toBeUndefined();
    });

    it('should return false when unregistering non-existent provider', () => {
      const result = registry.unregister('non-existent');

      expect(result).toBe(false);
    });

    it('should allow re-registration after unregistering', () => {
      const provider1 = new MockProvider({ name: 'reusable' });
      const provider2 = new MockProvider({ name: 'reusable' });

      registry.register(provider1);
      registry.unregister('reusable');

      expect(() => registry.register(provider2)).not.toThrow();
      expect(registry.get('reusable')).toBe(provider2);
    });

    it('should not affect other providers when unregistering one', () => {
      const provider1 = new MockProvider({ name: 'keep-1' });
      const provider2 = new MockProvider({ name: 'remove' });
      const provider3 = new MockProvider({ name: 'keep-2' });

      registry.register(provider1);
      registry.register(provider2);
      registry.register(provider3);

      registry.unregister('remove');

      expect(registry.get('keep-1')).toBe(provider1);
      expect(registry.get('keep-2')).toBe(provider3);
      expect(registry.get('remove')).toBeUndefined();
    });
  });

  describe('Provider Listing', () => {
    it('should return empty array when no providers registered', () => {
      const providers = registry.list();

      expect(providers).toEqual([]);
    });

    it('should list all registered provider names', () => {
      const provider1 = new MockProvider({ name: 'provider-a' });
      const provider2 = new MockProvider({ name: 'provider-b' });
      const provider3 = new MockProvider({ name: 'provider-c' });

      registry.register(provider1);
      registry.register(provider2);
      registry.register(provider3);

      const providers = registry.list();

      expect(providers).toHaveLength(3);
      expect(providers).toContain('provider-a');
      expect(providers).toContain('provider-b');
      expect(providers).toContain('provider-c');
    });

    it('should update list after unregistering provider', () => {
      const provider1 = new MockProvider({ name: 'keep' });
      const provider2 = new MockProvider({ name: 'remove' });

      registry.register(provider1);
      registry.register(provider2);

      registry.unregister('remove');

      const providers = registry.list();

      expect(providers).toHaveLength(1);
      expect(providers).toContain('keep');
      expect(providers).not.toContain('remove');
    });

    it('should return array copy, not internal reference', () => {
      const provider = new MockProvider({ name: 'test' });
      registry.register(provider);

      const list1 = registry.list();
      const list2 = registry.list();

      expect(list1).not.toBe(list2);
      expect(list1).toEqual(list2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle provider with special characters in name', () => {
      const specialNames = [
        'provider-with-dash',
        'provider_with_underscore',
        'provider.with.dot',
        'provider:with:colon',
        'provider/with/slash',
      ];

      for (const name of specialNames) {
        const provider = new MockProvider({ name });

        expect(() => registry.register(provider)).not.toThrow();
        expect(registry.get(name)).toBe(provider);
      }
    });

    it('should handle very long provider names', () => {
      const longName = 'a'.repeat(1000);
      const provider = new MockProvider({ name: longName });

      registry.register(provider);

      expect(registry.get(longName)).toBe(provider);
    });

    it('should handle unicode characters in provider names', () => {
      const unicodeNames = [
        'provider-日本語',
        'provider-中文',
        'provider-한국어',
        'provider-العربية',
        'provider-emoji-🚀',
      ];

      for (const name of unicodeNames) {
        const provider = new MockProvider({ name });

        registry.register(provider);
        expect(registry.get(name)).toBe(provider);
      }
    });

    it('should maintain provider state across operations', async () => {
      const provider = new MockProvider({
        name: 'stateful',
        tokenCount: 42,
      });

      registry.register(provider);
      registry.setDefault('stateful');

      const retrieved = registry.get('stateful');
      const defaultProvider = registry.getDefault();

      expect(retrieved).toBe(provider);
      expect(defaultProvider).toBe(provider);

      // Verify provider state is preserved
      expect(
        await retrieved!.countTokens({
          model: 'test',
          messages: [],
        })
      ).toBe(42);
    });
  });
});
