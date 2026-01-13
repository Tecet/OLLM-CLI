/**
 * Property-based tests for extension settings integration
 * 
 * Feature: stage-05-hooks-extensions-mcp
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { ExtensionSettingsManager } from '../settingsIntegration.js';
import type { ExtensionSetting } from '../types.js';

describe('Extension Settings Integration - Property Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  /**
   * Feature: stage-05-hooks-extensions-mcp, Property 28: Extension Settings Integration
   * Validates: Requirements 10.1, 10.2, 10.4, 10.6
   * 
   * For any extension that declares settings, those settings should be added to the
   * configuration schema, readable from environment variables when specified, and
   * available to hooks and MCP servers.
   */
  test('Property 28: Extension Settings Integration', () => {
    const manager = new ExtensionSettingsManager();

    // Arbitrary extension setting
    const arbExtensionSetting = fc.record({
      name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
      envVar: fc.option(fc.stringMatching(/^[A-Z_][A-Z0-9_]*$/), { nil: undefined }),
      sensitive: fc.option(fc.boolean(), { nil: undefined }),
      description: fc.string({ minLength: 1 }),
      default: fc.option(fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null)
      ), { nil: undefined }),
    });

    // Arbitrary extension name
    const arbExtensionName = fc.stringMatching(/^[a-z][a-z0-9-]*$/);

    fc.assert(
      fc.property(
        arbExtensionName,
        fc.uniqueArray(arbExtensionSetting, { minLength: 1, maxLength: 5, selector: (s) => s.name }),
        (extensionName, settings) => {
          // Set up environment variables for settings that have envVar
          for (const setting of settings) {
            if (setting.envVar) {
              process.env[setting.envVar] = 'test-value-from-env';
            }
          }

          // Resolve settings (Requirement 10.1, 10.2)
          const resolved = manager.resolveSettings(settings, extensionName);

          // All settings should be resolved
          expect(resolved).toHaveLength(settings.length);

          // Check each resolved setting
          for (let i = 0; i < settings.length; i++) {
            const setting = settings[i];
            const resolvedSetting = resolved[i];

            expect(resolvedSetting.name).toBe(setting.name);
            expect(resolvedSetting.sensitive).toBe(setting.sensitive ?? false);

            // If envVar is set, value should come from environment (Requirement 10.2)
            if (setting.envVar && process.env[setting.envVar]) {
              expect(resolvedSetting.value).toBe(process.env[setting.envVar]);
              expect(resolvedSetting.source).toBe('env');
            }
            // Otherwise, should use default value
            else if (setting.default !== undefined) {
              expect(resolvedSetting.value).toBe(setting.default);
              expect(resolvedSetting.source).toBe('default');
            }
            // Otherwise, should be undefined
            else {
              expect(resolvedSetting.value).toBeUndefined();
              expect(resolvedSetting.source).toBe('undefined');
            }
          }

          // Convert to environment variables (Requirement 10.6)
          const env = manager.toEnvironmentVariables(resolved, extensionName);

          // Count how many non-undefined settings we have with unique env var names
          const envVarNames = new Set<string>();
          for (const resolvedSetting of resolved) {
            if (resolvedSetting.value !== undefined) {
              const envVarName = `EXTENSION_${extensionName.toUpperCase().replace(/-/g, '_')}_${resolvedSetting.name
                .replace(/([A-Z])/g, '_$1')
                .toUpperCase()
                .replace(/^_/, '')}`;
              envVarNames.add(envVarName);
            }
          }
          
          // Environment should have exactly that many unique entries
          expect(Object.keys(env)).toHaveLength(envVarNames.size);

          // Each non-undefined setting should have a corresponding env var
          for (const resolvedSetting of resolved) {
            if (resolvedSetting.value !== undefined) {
              // There should be at least one env var for this setting
              const hasEnvVar = Object.keys(env).some(key => {
                const settingPart = resolvedSetting.name
                  .replace(/([A-Z])/g, '_$1')
                  .toUpperCase()
                  .replace(/^_/, '');
                return key.endsWith(settingPart);
              });
              expect(hasEnvVar).toBe(true);
            }
          }

          // Create config schema (Requirement 10.4)
          const schema = manager.createConfigSchema(extensionName, settings);

          // Schema should have extension name as key
          expect(schema).toHaveProperty(extensionName);
          const extensionSchema = schema[extensionName] as Record<string, unknown>;

          // All settings should be in schema
          for (const setting of settings) {
            expect(extensionSchema).toHaveProperty(setting.name);
            const settingSchema = extensionSchema[setting.name] as Record<string, unknown>;
            expect(settingSchema).toHaveProperty('description', setting.description);
            expect(settingSchema).toHaveProperty('default', setting.default);
            expect(settingSchema).toHaveProperty('sensitive', setting.sensitive ?? false);
          }

          // Clean up environment
          for (const setting of settings) {
            if (setting.envVar) {
              delete process.env[setting.envVar];
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: stage-05-hooks-extensions-mcp, Property 29: Sensitive Setting Redaction
   * Validates: Requirements 10.3
   * 
   * For any extension setting marked as sensitive, its value should be redacted
   * from logs and error messages.
   */
  test('Property 29: Sensitive Setting Redaction', () => {
    const manager = new ExtensionSettingsManager();

    // Arbitrary settings object with some sensitive fields
    const arbSettingsObject = fc.dictionary(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null)
      )
    );

    // Arbitrary set of sensitive field names
    const arbSensitiveNames = fc.array(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
      { minLength: 0, maxLength: 5 }
    ).map(names => new Set(names));

    fc.assert(
      fc.property(
        arbSettingsObject,
        arbSensitiveNames,
        (settingsObj, sensitiveNames) => {
          // Redact sensitive settings
          const redacted = manager.redactSensitiveSettings(settingsObj, sensitiveNames);

          // All keys should be present
          expect(Object.keys(redacted).sort()).toEqual(Object.keys(settingsObj).sort());

          // Check each field
          for (const [key, value] of Object.entries(settingsObj)) {
            if (sensitiveNames.has(key)) {
              // Sensitive fields should be redacted
              expect(redacted[key]).toBe('[REDACTED]');
            } else {
              // Non-sensitive fields should be unchanged
              expect(redacted[key]).toEqual(value);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: stage-05-hooks-extensions-mcp, Property 30: Extension Setting Validation
   * Validates: Requirements 10.5, 10.7
   * 
   * For any extension setting, modifying it should validate the new value against
   * the setting definition, and missing required settings should cause the extension
   * to be disabled.
   */
  test('Property 30: Extension Setting Validation', () => {
    const manager = new ExtensionSettingsManager();

    // Arbitrary extension setting
    const arbExtensionSetting = fc.record({
      name: fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
      envVar: fc.option(fc.stringMatching(/^[A-Z_][A-Z0-9_]*$/), { nil: undefined }),
      sensitive: fc.option(fc.boolean(), { nil: undefined }),
      description: fc.string({ minLength: 1 }),
      default: fc.option(fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null)
      ), { nil: undefined }),
    });

    // Arbitrary list of required setting names
    const arbRequiredSettings = fc.array(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]*$/),
      { minLength: 0, maxLength: 3 }
    );

    fc.assert(
      fc.property(
        fc.array(arbExtensionSetting, { minLength: 1, maxLength: 5 }),
        arbRequiredSettings,
        fc.stringMatching(/^[a-z][a-z0-9-]*$/),
        (settings, requiredSettings, extensionName) => {
          // Resolve settings
          const resolved = manager.resolveSettings(settings, extensionName);

          // Validate required settings (Requirement 10.7)
          const missing = manager.validateRequiredSettings(resolved, requiredSettings);

          // Check that all required settings are either present or missing
          for (const required of requiredSettings) {
            const setting = resolved.find(s => s.name === required);
            
            if (!setting || setting.value === undefined) {
              // Should be in missing list
              expect(missing).toContain(required);
            } else {
              // Should not be in missing list
              expect(missing).not.toContain(required);
            }
          }

          // All items in missing list should be required settings
          for (const missingName of missing) {
            expect(requiredSettings).toContain(missingName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

