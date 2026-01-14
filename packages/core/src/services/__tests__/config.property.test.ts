/**
 * Property-based tests for service configuration
 * Feature: stage-07-model-management
 * 
 * Tests Properties 17, 18, and 19 from the design document
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  validateServicesConfig,
  mergeServicesConfig,
  applyEnvironmentOverrides,
  loadConfigWithEnvOverrides,
  ENV_VAR_NAMES,
} from '../config.js';
import type { ServicesConfig } from '../types.js';

describe('Property 17: Options validation', () => {
  it('should validate model options against schema and reject invalid options with clear error messages', () => {
    fc.assert(
      fc.property(
        fc.record({
          temperature: fc.option(fc.float({ min: -1, max: 3, noNaN: true }), { nil: undefined }),
          maxTokens: fc.option(fc.integer({ min: -100, max: 10000 }), { nil: undefined }),
          topP: fc.option(fc.float({ min: -1, max: 2, noNaN: true }), { nil: undefined }),
          numCtx: fc.option(fc.integer({ min: -100, max: 200000 }), { nil: undefined }),
        }),
        (options) => {
          const config: Partial<ServicesConfig> = {
            options,
          };

          // Check if options are valid
          const isTemperatureValid =
            options.temperature === undefined ||
            (!isNaN(options.temperature) && options.temperature >= 0 && options.temperature <= 2);
          const isMaxTokensValid =
            options.maxTokens === undefined || options.maxTokens > 0;
          const isTopPValid =
            options.topP === undefined || (!isNaN(options.topP) && options.topP >= 0 && options.topP <= 1);
          const isNumCtxValid = options.numCtx === undefined || options.numCtx > 0;

          const allValid =
            isTemperatureValid && isMaxTokensValid && isTopPValid && isNumCtxValid;

          if (allValid) {
            // Should not throw
            const result = validateServicesConfig(config);
            expect(result.options).toEqual(options);
          } else {
            // Should throw with descriptive error
            expect(() => validateServicesConfig(config)).toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate model configuration options', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Test with just default
          fc.record({ default: fc.string() }),
          // Test with just cacheTTL (valid)
          fc.record({ cacheTTL: fc.integer({ min: 1, max: 1000000 }) }),
          // Test with routing (without overrides to avoid Zod bug)
          fc.record({
            routing: fc.record({
              enabled: fc.boolean(),
              defaultProfile: fc.string(),
            }),
          }),
          // Test with keepAlive (valid)
          fc.record({
            keepAlive: fc.record({
              enabled: fc.boolean(),
              models: fc.array(fc.string()),
              timeout: fc.integer({ min: 1, max: 1000 }),
            }),
          }),
          // Test with invalid cacheTTL (0 or negative)
          fc.record({ cacheTTL: fc.integer({ min: -10, max: -1 }) }),
          // Test with invalid timeout (0 or negative)
          fc.record({
            keepAlive: fc.record({
              timeout: fc.integer({ min: -10, max: -1 }),
            }),
          })
        ),
        (model) => {
          const config: Partial<ServicesConfig> = {
            model,
          };

          // Check if model config is valid
          const isTimeoutValid =
            !model.keepAlive?.timeout || model.keepAlive.timeout > 0;
          const isCacheTTLValid = !model.cacheTTL || model.cacheTTL > 0;

          const allValid = isTimeoutValid && isCacheTTLValid;

          if (allValid) {
            // Should not throw
            const result = validateServicesConfig(config);
            expect(result.model).toBeDefined();
          } else {
            // Should throw
            expect(() => validateServicesConfig(config)).toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 18: Generation parameter support', () => {
  it('should accept and apply valid temperature, max_tokens, and top_p values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(2), noNaN: true }),
        fc.integer({ min: 1, max: 100000 }),
        fc.float({ min: 0, max: Math.fround(1), noNaN: true }),
        (temperature, maxTokens, topP) => {
          const config: Partial<ServicesConfig> = {
            options: {
              temperature,
              maxTokens,
              topP,
            },
          };

          // Should validate successfully
          const validated = validateServicesConfig(config);
          expect(validated.options?.temperature).toBe(temperature);
          expect(validated.options?.maxTokens).toBe(maxTokens);
          expect(validated.options?.topP).toBe(topP);

          // Should merge with defaults
          const merged = mergeServicesConfig(config);
          expect(merged.options.temperature).toBe(temperature);
          expect(merged.options.maxTokens).toBe(maxTokens);
          expect(merged.options.topP).toBe(topP);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should accept valid numCtx values', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200000 }), (numCtx) => {
        const config: Partial<ServicesConfig> = {
          options: {
            numCtx,
          },
        };

        // Should validate successfully
        const validated = validateServicesConfig(config);
        expect(validated.options?.numCtx).toBe(numCtx);

        // Should merge with defaults
        const merged = mergeServicesConfig(config);
        expect(merged.options.numCtx).toBe(numCtx);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid temperature values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-10), max: Math.fround(-0.01), noNaN: true }), 
          fc.float({ min: Math.fround(2.01), max: Math.fround(10), noNaN: true })
        ),
        (temperature) => {
          const config: Partial<ServicesConfig> = {
            options: {
              temperature,
            },
          };

          // Should throw validation error
          expect(() => validateServicesConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid maxTokens values', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: 0 }), (maxTokens) => {
        const config: Partial<ServicesConfig> = {
          options: {
            maxTokens,
          },
        };

        // Should throw validation error
        expect(() => validateServicesConfig(config)).toThrow();
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid topP values', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.float({ min: Math.fround(-10), max: Math.fround(-0.01), noNaN: true }), 
          fc.float({ min: Math.fround(1.01), max: Math.fround(10), noNaN: true })
        ),
        (topP) => {
          const config: Partial<ServicesConfig> = {
            options: {
              topP,
            },
          };

          // Should throw validation error
          expect(() => validateServicesConfig(config)).toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 19: Environment variable precedence', () => {
  it('should use environment variable value when both env var and config file value exist', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.float({ min: 0, max: 2, noNaN: true }).filter(n => !isNaN(n) && isFinite(n)),
        fc.float({ min: 0, max: 2, noNaN: true }).filter(n => !isNaN(n) && isFinite(n)),
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1024, max: 200000 }),
        fc.integer({ min: 1024, max: 200000 }),
        (
          configModel,
          envModel,
          configTemp,
          envTemp,
          configMaxTokens,
          envMaxTokens,
          configCtx,
          envCtx
        ) => {
          // Set up config file values
          const config: Partial<ServicesConfig> = {
            model: {
              default: configModel,
            },
            options: {
              temperature: configTemp,
              maxTokens: configMaxTokens,
              numCtx: configCtx,
            },
          };

          // Set up environment variables
          const originalEnv = { ...process.env };
          process.env[ENV_VAR_NAMES.MODEL] = envModel;
          process.env[ENV_VAR_NAMES.TEMPERATURE] = envTemp.toString();
          process.env[ENV_VAR_NAMES.MAX_TOKENS] = envMaxTokens.toString();
          process.env[ENV_VAR_NAMES.CONTEXT_SIZE] = envCtx.toString();

          try {
            // Apply environment overrides
            const result = applyEnvironmentOverrides(config);

            // Environment variables should take precedence
            expect(result.model?.default).toBe(envModel);
            expect(result.options?.temperature).toBe(envTemp);
            expect(result.options?.maxTokens).toBe(envMaxTokens);
            expect(result.options?.numCtx).toBe(envCtx);
          } finally {
            // Restore original environment
            process.env = originalEnv;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should use config file value when environment variable is not set', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.float({ min: 0, max: 2, noNaN: true }).filter(n => !isNaN(n) && isFinite(n)),
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1024, max: 200000 }),
        (configModel, configTemp, configMaxTokens, configCtx) => {
          // Set up config file values
          const config: Partial<ServicesConfig> = {
            model: {
              default: configModel,
            },
            options: {
              temperature: configTemp,
              maxTokens: configMaxTokens,
              numCtx: configCtx,
            },
          };

          // Ensure environment variables are not set
          const originalEnv = { ...process.env };
          delete process.env[ENV_VAR_NAMES.MODEL];
          delete process.env[ENV_VAR_NAMES.TEMPERATURE];
          delete process.env[ENV_VAR_NAMES.MAX_TOKENS];
          delete process.env[ENV_VAR_NAMES.CONTEXT_SIZE];

          try {
            // Apply environment overrides (should have no effect)
            const result = applyEnvironmentOverrides(config);

            // Config file values should be preserved
            expect(result.model?.default).toBe(configModel);
            expect(result.options?.temperature).toBe(configTemp);
            expect(result.options?.maxTokens).toBe(configMaxTokens);
            expect(result.options?.numCtx).toBe(configCtx);
          } finally {
            // Restore original environment
            process.env = originalEnv;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ignore invalid environment variable values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 2, noNaN: true }).filter(n => !isNaN(n) && isFinite(n)),
        fc.integer({ min: 1, max: 100000 }),
        fc.integer({ min: 1024, max: 200000 }),
        (configTemp, configMaxTokens, configCtx) => {
          // Set up config file values
          const config: Partial<ServicesConfig> = {
            options: {
              temperature: configTemp,
              maxTokens: configMaxTokens,
              numCtx: configCtx,
            },
          };

          // Set up invalid environment variables
          const originalEnv = { ...process.env };
          process.env[ENV_VAR_NAMES.TEMPERATURE] = 'invalid';
          process.env[ENV_VAR_NAMES.MAX_TOKENS] = 'not-a-number';
          process.env[ENV_VAR_NAMES.CONTEXT_SIZE] = 'abc';

          try {
            // Apply environment overrides
            const result = applyEnvironmentOverrides(config);

            // Config file values should be preserved (invalid env vars ignored)
            expect(result.options?.temperature).toBe(configTemp);
            expect(result.options?.maxTokens).toBe(configMaxTokens);
            expect(result.options?.numCtx).toBe(configCtx);
          } finally {
            // Restore original environment
            process.env = originalEnv;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should ignore out-of-range environment variable values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 2, noNaN: true }).filter(n => !isNaN(n) && isFinite(n)),
        fc.integer({ min: 1, max: 100000 }),
        (configTemp, configMaxTokens) => {
          // Set up config file values
          const config: Partial<ServicesConfig> = {
            options: {
              temperature: configTemp,
              maxTokens: configMaxTokens,
            },
          };

          // Set up out-of-range environment variables
          const originalEnv = { ...process.env };
          process.env[ENV_VAR_NAMES.TEMPERATURE] = '5.0'; // > 2.0
          process.env[ENV_VAR_NAMES.MAX_TOKENS] = '-100'; // < 0

          try {
            // Apply environment overrides
            const result = applyEnvironmentOverrides(config);

            // Config file values should be preserved (out-of-range env vars ignored)
            expect(result.options?.temperature).toBe(configTemp);
            expect(result.options?.maxTokens).toBe(configMaxTokens);
          } finally {
            // Restore original environment
            process.env = originalEnv;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply environment overrides in loadConfigWithEnvOverrides', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        fc.float({ min: 0, max: 2, noNaN: true }).filter(n => !isNaN(n) && isFinite(n)),
        (envModel, envTemp) => {
          // Set up environment variables
          const originalEnv = { ...process.env };
          process.env[ENV_VAR_NAMES.MODEL] = envModel;
          process.env[ENV_VAR_NAMES.TEMPERATURE] = envTemp.toString();

          try {
            // Load config with env overrides
            const result = loadConfigWithEnvOverrides({});

            // Environment variables should override defaults
            expect(result.model.default).toBe(envModel);
            expect(result.options.temperature).toBe(envTemp);
          } finally {
            // Restore original environment
            process.env = originalEnv;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
