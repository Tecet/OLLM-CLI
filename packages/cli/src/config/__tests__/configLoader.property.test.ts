/**
 * Property-based tests for configuration loader
 * Feature: stage-06-cli-ui
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ConfigLoader } from '../configLoader.js';
import type { Config, ConfigSource } from '../types.js';
import { defaultConfig } from '../defaults.js';

describe('ConfigLoader Property Tests', () => {
  const loader = new ConfigLoader();

  /**
   * Property 1: Configuration Precedence
   * For any configuration key that appears in multiple layers,
   * the final merged configuration should use the value from the highest precedence layer.
   * 
   * Feature: stage-06-cli-ui, Property 1: Configuration Precedence
   * Validates: Requirements 1.1, 1.3
   */
  it('Property 1: Configuration Precedence - highest precedence wins', () => {
    // Generator for a simple config value
    const configValueArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.boolean()
    );

    // Generator for a config key path
    const configKeyArb = fc.constantFrom(
      'provider.default',
      'model.default',
      'model.temperature',
      'ui.layout',
      'ui.sidePanel',
      'status.pollInterval'
    );

    fc.assert(
      fc.property(
        configKeyArb,
        configValueArb,
        configValueArb,
        configValueArb,
        (keyPath, lowValue, midValue, highValue) => {
          // Create three config sources with different priorities
          const sources: ConfigSource[] = [
            {
              layer: 'system',
              priority: 1,
              data: setNestedValue({}, keyPath, lowValue),
            },
            {
              layer: 'user',
              priority: 2,
              data: setNestedValue({}, keyPath, midValue),
            },
            {
              layer: 'cli',
              priority: 5,
              data: setNestedValue({}, keyPath, highValue),
            },
          ];

          const merged = loader.mergeConfigs(sources);
          const actualValue = getNestedValue(merged, keyPath);

          // The highest priority value (CLI) should win
          // UNLESS it's a whitespace-only string, in which case we fall back to the next non-empty value
          let expectedValue = highValue;
          if (typeof highValue === 'string' && highValue.trim() === '') {
            // High value is whitespace-only, check mid value
            if (typeof midValue === 'string' && midValue.trim() === '') {
              // Mid value is also whitespace-only, check low value
              if (typeof lowValue === 'string' && lowValue.trim() === '') {
                // All are whitespace-only strings, expect empty string
                expectedValue = '';
              } else {
                // Low value is not a whitespace-only string, use it
                expectedValue = lowValue;
              }
            } else {
              // Mid value is not a whitespace-only string, use it
              expectedValue = midValue;
            }
          }
          
          expect(actualValue).toBe(expectedValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Configuration Validation Errors
   * For any invalid configuration file, the error message should contain
   * the file path and a description of the validation issue.
   * 
   * Feature: stage-06-cli-ui, Property 2: Configuration Validation Errors
   * Validates: Requirements 1.2, 22.1
   */
  it('Property 2: Configuration Validation Errors - errors contain path and message', () => {
    // Generator for invalid config values
    const invalidConfigArb = fc.oneof(
      // Invalid temperature (outside 0-2 range)
      fc.record({
        model: fc.record({
          temperature: fc.oneof(fc.constant(-1), fc.constant(3)),
        }),
      }),
      // Invalid layout enum
      fc.record({
        ui: fc.record({
          layout: fc.constantFrom('invalid', 'wrong', 'bad'),
        }),
      }),
      // Invalid poll interval (too small)
      fc.record({
        status: fc.record({
          pollInterval: fc.integer({ min: -1000, max: 999 }),
        }),
      }),
      // Missing required field
      fc.record({
        provider: fc.record({}), // Missing 'default' field
      })
    );

    fc.assert(
      fc.property(invalidConfigArb, (invalidConfig) => {
        const validation = loader.validateConfig(invalidConfig as Partial<Config>);

        // Should be invalid
        expect(validation.valid).toBe(false);

        // Should have at least one error
        expect(validation.errors.length).toBeGreaterThan(0);

        // Each error should have a path and message
        for (const error of validation.errors) {
          expect(error.path).toBeDefined();
          expect(typeof error.path).toBe('string');
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
          expect(error.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Configuration Defaults
   * For any required configuration key that is missing from all layers,
   * the final configuration should contain the documented default value.
   * 
   * Feature: stage-06-cli-ui, Property 3: Configuration Defaults
   * Validates: Requirements 1.5
   */
  it('Property 3: Configuration Defaults - missing keys use defaults', () => {
    // Generator for partial configs with random missing keys
    const partialConfigArb = fc.record({
      provider: fc.option(
        fc.record({
          default: fc.option(fc.string(), { nil: undefined }),
        }),
        { nil: undefined }
      ),
      model: fc.option(
        fc.record({
          default: fc.option(fc.string(), { nil: undefined }),
          temperature: fc.option(fc.double({ min: 0, max: 2 }), { nil: undefined }),
        }),
        { nil: undefined }
      ),
      ui: fc.option(
        fc.record({
          layout: fc.option(fc.constantFrom('hybrid', 'simple'), { nil: undefined }),
        }),
        { nil: undefined }
      ),
    });

    fc.assert(
      fc.property(partialConfigArb, (partialConfig) => {
        const sources: ConfigSource[] = [
          {
            layer: 'system',
            priority: 1,
            data: defaultConfig,
          },
          {
            layer: 'user',
            priority: 2,
            data: partialConfig as Partial<Config>,
          },
        ];

        const merged = loader.mergeConfigs(sources);

        // Check that default values are present for missing keys
        if (partialConfig.provider?.default === undefined) {
          expect(merged.provider.default).toBe(defaultConfig.provider.default);
        }

        if (partialConfig.model?.default === undefined) {
          expect(merged.model.default).toBe(defaultConfig.model.default);
        }

        if (partialConfig.model?.temperature === undefined) {
          expect(merged.model.temperature).toBe(defaultConfig.model.temperature);
        }

        if (partialConfig.ui?.layout === undefined) {
          expect(merged.ui.layout).toBe(defaultConfig.ui.layout);
        }

        // All required fields should be present
        expect(merged.provider.default).toBeDefined();
        expect(merged.model.default).toBeDefined();
        expect(merged.model.temperature).toBeDefined();
        expect(merged.model.maxTokens).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

// Helper functions

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const existing = current[key];
    const next =
      typeof existing === 'object' && existing !== null
        ? { ...(existing as Record<string, unknown>) }
        : {};
    current[key] = next;
    current = next;
  }

  current[keys[keys.length - 1]] = value;
  return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
