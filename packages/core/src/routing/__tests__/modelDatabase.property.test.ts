/**
 * Property-based tests for Model Database
 * Feature: stage-07-model-management
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ModelDatabase } from '../modelDatabase.js';

describe('Model Database Properties', () => {
  /**
   * Property 13: Known model lookup
   * For any known model pattern in the database, looking up a matching model name
   * should return the stored context window, capabilities, and suitable profiles
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  it('Property 13: Known model lookup', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'llama3.1:8b',
          'llama3.1:70b',
          'llama3:8b',
          'codellama:7b',
          'codellama:13b',
          'mistral:7b',
          'mistral:latest',
          'phi3:mini',
          'phi3:medium',
          'phi:latest',
          'gemma:2b',
          'gemma:7b',
          'gemma2:9b',
          'deepseek-coder:6.7b',
          'deepseek-coder:33b',
          'qwen:7b',
          'qwen:14b',
          'qwen2:7b',
          'starcoder:7b',
          'starcoder2:15b',
          'wizardcoder:13b',
          'neural-chat:7b',
          'orca:7b',
          'vicuna:7b'
        ),
        (modelName) => {
          const db = new ModelDatabase();
          const entry = db.lookup(modelName);

          // Should find a matching entry
          expect(entry).not.toBeNull();

          if (entry) {
            // Should have all required fields
            expect(entry.pattern).toBeDefined();
            expect(entry.family).toBeDefined();
            expect(entry.contextWindow).toBeGreaterThan(0);
            expect(entry.capabilities).toBeDefined();
            expect(entry.profiles).toBeDefined();
            expect(Array.isArray(entry.profiles)).toBe(true);

            // Capabilities should have all required fields
            expect(typeof entry.capabilities.toolCalling).toBe('boolean');
            expect(typeof entry.capabilities.vision).toBe('boolean');
            expect(typeof entry.capabilities.streaming).toBe('boolean');

            // Context window should be reasonable
            expect(entry.contextWindow).toBeGreaterThanOrEqual(2048);
            expect(entry.contextWindow).toBeLessThanOrEqual(200000);

            // Should have at least one profile
            expect(entry.profiles.length).toBeGreaterThan(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Unknown model defaults
   * For any model name not matching any database pattern, lookup should return
   * safe default values (4096 context window, no special capabilities)
   * Validates: Requirements 7.4
   */
  it('Property 14: Unknown model defaults', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
          // Filter out strings that might match known patterns
          const knownPrefixes = [
            'llama',
            'codellama',
            'mistral',
            'phi',
            'gemma',
            'deepseek',
            'qwen',
            'starcoder',
            'wizardcoder',
            'neural-chat',
            'orca',
            'vicuna',
          ];
          return !knownPrefixes.some((prefix) => s.toLowerCase().startsWith(prefix));
        }),
        (unknownModelName) => {
          const db = new ModelDatabase();

          // Lookup should return null for unknown models
          const entry = db.lookup(unknownModelName);
          expect(entry).toBeNull();

          // But helper methods should return safe defaults
          const contextWindow = db.getContextWindow(unknownModelName);
          expect(contextWindow).toBe(4096);

          const capabilities = db.getCapabilities(unknownModelName);
          expect(capabilities.toolCalling).toBe(false);
          expect(capabilities.vision).toBe(false);
          expect(capabilities.streaming).toBe(true);

          const profiles = db.getSuitableProfiles(unknownModelName);
          expect(profiles).toEqual(['general']);

          const family = db.getFamily(unknownModelName);
          expect(family).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 15: Wildcard pattern matching
   * For any model name and database pattern with wildcards, the pattern should
   * match all appropriate model names
   * Validates: Requirements 7.5
   */
  it('Property 15: Wildcard pattern matching', () => {
    fc.assert(
      fc.property(
        fc.record({
          family: fc.constantFrom(
            'llama3.1',
            'llama3',
            'codellama',
            'mistral',
            'phi3',
            'phi',
            'gemma',
            'gemma2',
            'deepseek-coder',
            'qwen',
            'qwen2',
            'starcoder',
            'starcoder2',
            'wizardcoder',
            'neural-chat',
            'orca',
            'vicuna'
          ),
          variant: fc.constantFrom(
            '7b',
            '8b',
            '13b',
            '70b',
            'mini',
            'medium',
            'latest',
            '2b',
            '9b',
            '6.7b',
            '33b',
            '14b',
            '15b'
          ),
        }),
        ({ family, variant }) => {
          const modelName = `${family}:${variant}`;
          const db = new ModelDatabase();
          const entry = db.lookup(modelName);

          // Should find a matching entry
          expect(entry).not.toBeNull();

          if (entry) {
            // The pattern should be a wildcard pattern
            expect(entry.pattern).toContain('*');

            // The model name should match the pattern
            const patternPrefix = entry.pattern.replace(':*', '');
            expect(modelName.startsWith(patternPrefix)).toBe(true);

            // All helper methods should return consistent data
            const contextWindow = db.getContextWindow(modelName);
            expect(contextWindow).toBe(entry.contextWindow);

            const capabilities = db.getCapabilities(modelName);
            expect(capabilities).toEqual(entry.capabilities);

            const profiles = db.getSuitableProfiles(modelName);
            expect(profiles).toEqual(entry.profiles);

            const familyName = db.getFamily(modelName);
            expect(familyName).toBe(entry.family);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Pattern matching consistency
   * For any model that matches a pattern, all lookups should be consistent
   */
  it('Pattern matching consistency', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'llama3.1:8b',
          'mistral:7b',
          'phi3:mini',
          'gemma:2b',
          'codellama:13b',
          'qwen:7b'
        ),
        (modelName) => {
          const db = new ModelDatabase();

          // Multiple lookups should return the same result
          const entry1 = db.lookup(modelName);
          const entry2 = db.lookup(modelName);

          expect(entry1).toEqual(entry2);

          // Helper methods should be consistent with lookup
          if (entry1) {
            expect(db.getContextWindow(modelName)).toBe(entry1.contextWindow);
            expect(db.getCapabilities(modelName)).toEqual(entry1.capabilities);
            expect(db.getSuitableProfiles(modelName)).toEqual(entry1.profiles);
            expect(db.getFamily(modelName)).toBe(entry1.family);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Custom database entries
   * For any custom model database, lookups should work correctly
   */
  it('Custom database entries work correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            pattern: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s) => /^[a-z0-9-]+$/i.test(s))
              .map((s) => `${s}:*`),
            family: fc
              .string({ minLength: 3, maxLength: 15 })
              .filter((s) => /^[a-z0-9-]+$/i.test(s)),
            contextWindow: fc.integer({ min: 2048, max: 128000 }),
            capabilities: fc.record({
              toolCalling: fc.boolean(),
              vision: fc.boolean(),
              streaming: fc.boolean(),
            }),
            profiles: fc.array(
              fc.constantFrom('fast', 'general', 'code', 'creative'),
              { minLength: 1, maxLength: 4 }
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (entries) => {
          const db = new ModelDatabase(entries);

          // Should be able to list all entries
          const listed = db.listKnownModels();
          expect(listed.length).toBe(entries.length);

          // Each entry should be findable by a model name that matches its pattern
          for (const entry of entries) {
            const modelName = entry.pattern.replace('*', 'test');
            const found = db.lookup(modelName);

            // If found, it should match the first entry that matches the pattern
            // (since lookup returns the first match)
            if (found) {
              // The found entry should be one of the entries in the database
              const matchingEntry = entries.find(
                (e) =>
                  e.family === found.family &&
                  e.contextWindow === found.contextWindow &&
                  JSON.stringify(e.capabilities) === JSON.stringify(found.capabilities) &&
                  JSON.stringify(e.profiles) === JSON.stringify(found.profiles)
              );
              expect(matchingEntry).toBeDefined();
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
