/**
 * Property-based tests for environment variable substitution
 * 
 * Feature: stage-05-hooks-extensions-mcp
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  substituteEnvVars,
  substituteEnvObject,
  settingsToEnv,
} from '../envSubstitution.js';

describe('Environment Variable Substitution - Property Tests', () => {
  /**
   * Property 32: MCP Environment Variables
   * 
   * For any MCP server configured with environment variables, those variables
   * should be set in the server process environment, with ${VAR_NAME} syntax
   * substituted from the parent environment.
   * 
   * Validates: Requirements 13.1, 13.2, 13.3, 13.5, 13.6
   */
  describe('Property 32: MCP Environment Variables', () => {
    it('should substitute ${VAR_NAME} patterns with environment values', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
          fc.string({ minLength: 1, maxLength: 20 }),
          (env, varName) => {
            // Ensure varName is a valid identifier
            const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '_');
            const value = env[cleanVarName] || 'test-value';
            const testEnv = { ...env, [cleanVarName]: value };
            
            const input = `prefix-\${${cleanVarName}}-suffix`;
            const result = substituteEnvVars(input, testEnv);
            
            expect(result).toBe(`prefix-${value}-suffix`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should substitute multiple variables in a single string', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            // Generate valid identifier names (alphanumeric + underscore)
            fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/),
            fc.string()
          ),
          (env) => {
            const keys = Object.keys(env).slice(0, 3);
            if (keys.length === 0) return true;
            
            const input = keys.map(k => `\${${k}}`).join('-');
            const result = substituteEnvVars(input, env);
            const expected = keys.map(k => env[k] || '').join('-');
            
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should process all values in an environment object', () => {
      fc.assert(
        fc.property(
          fc.dictionary(
            // Generate valid identifier names that don't conflict with Object.prototype
            fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/)
              .filter(name => !['__proto__', 'toString', 'valueOf', 'constructor', 'hasOwnProperty'].includes(name)),
            fc.string()
          ),
          fc.dictionary(
            fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]{0,19}$/)
              .filter(name => !['__proto__', 'toString', 'valueOf', 'constructor', 'hasOwnProperty'].includes(name)),
            fc.string()
          ),
          (parentEnv, envConfig) => {
            const result = substituteEnvObject(envConfig, parentEnv);
            
            // All keys should be preserved
            expect(Object.keys(result).sort()).toEqual(Object.keys(envConfig).sort());
            
            // Values should be substituted
            for (const [key, value] of Object.entries(envConfig)) {
              expect(result[key]).toBeDefined();
              expect(typeof result[key]).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should inherit parent environment by default', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()),
          (envConfig) => {
            // Filter out dangerous prototype properties that Object.entries() won't include
            const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
            const safeEnvConfig = Object.fromEntries(
              Object.entries(envConfig).filter(([key]) => !dangerousKeys.includes(key))
            );
            
            // Use actual process.env for this test
            const result = substituteEnvObject(safeEnvConfig);
            
            // Should return an object with all keys from safeEnvConfig
            expect(Object.keys(result).sort()).toEqual(Object.keys(safeEnvConfig).sort());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle nested substitutions correctly', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => s.replace(/[^a-zA-Z0-9_]/g, '_'))
            .filter((s) => s.length > 0 && !/^_+$/.test(s)), // Ensure not empty or only underscores
          fc
            .string({ minLength: 1, maxLength: 20 })
            .map((s) => s.replace(/[^a-zA-Z0-9_]/g, '_'))
            .filter((s) => s.length > 0 && !/^_+$/.test(s)), // Ensure not empty or only underscores
          (cleanVar1, cleanVar2) => {
            // Skip if both variables have the same name
            fc.pre(cleanVar1 !== cleanVar2);
            
            const env = {
              [cleanVar1]: 'value1',
              [cleanVar2]: `\${${cleanVar1}}`,
            };
            
            const result = substituteEnvVars(env[cleanVar2], env);
            
            // Should substitute the reference
            expect(result).toBe('value1');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 33: Missing Environment Variable Handling
   * 
   * For any MCP server environment variable using substitution syntax where
   * the variable is not found, the MCP client should log a warning and use
   * an empty string.
   * 
   * Validates: Requirements 13.4
   */
  describe('Property 33: Missing Environment Variable Handling', () => {
    it('should use empty string for missing variables', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (varName) => {
            // Ensure varName is a valid identifier and doesn't exist
            const cleanVarName = 'NONEXISTENT_' + varName.replace(/[^a-zA-Z0-9_]/g, '_');
            const emptyEnv = {}; // Empty environment
            
            const input = `prefix-\${${cleanVarName}}-suffix`;
            const result = substituteEnvVars(input, emptyEnv);
            
            // Should use empty string for missing variable
            expect(result).toBe('prefix--suffix');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple missing variables', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          (varNames) => {
            const emptyEnv = {};
            const cleanVarNames = varNames.map(v => 'MISSING_' + v.replace(/[^a-zA-Z0-9_]/g, '_'));
            
            const input = cleanVarNames.map(v => `\${${v}}`).join('-');
            const result = substituteEnvVars(input, emptyEnv);
            
            // All missing variables should be replaced with empty strings
            const expected = cleanVarNames.map(() => '').join('-');
            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle mix of present and missing variables', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string(),
          (varName, value) => {
            const cleanVarName = varName.replace(/[^a-zA-Z0-9_]/g, '_');
            const env = { [cleanVarName]: value };
            
            const input = `\${${cleanVarName}}-\${MISSING_VAR}`;
            const result = substituteEnvVars(input, env);
            
            // Present variable should be substituted, missing should be empty
            expect(result).toBe(`${value}-`);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test settings to environment variable conversion
   */
  describe('Settings to Environment Variables', () => {
    it('should convert settings to environment variables', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.string({ minLength: 1, maxLength: 20 }),
              envVar: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
            })
          ),
          fc.dictionary(fc.string(), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
          (settings, values) => {
            const result = settingsToEnv(settings, values);
            
            // Should be an object
            expect(typeof result).toBe('object');
            
            // All values should be strings
            for (const value of Object.values(result)) {
              expect(typeof value).toBe('string');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip undefined values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              // Generate valid setting names that don't conflict with Object.prototype
              name: fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,19}$/)
                .filter(name => !['toString', 'valueOf', 'constructor', 'hasOwnProperty'].includes(name)),
            })
          ),
          (settings) => {
            const result = settingsToEnv(settings, {});
            
            // Should return empty object when no values provided
            expect(Object.keys(result).length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use envVar when specified', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
            s !== '__proto__' && s !== 'constructor' && s !== 'prototype'
          ),
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
            s !== '__proto__' && s !== 'constructor' && s !== 'prototype'
          ),
          fc.string(),
          (settingName, envVarName, value) => {
            const settings = [{ name: settingName, envVar: envVarName }];
            const values = { [settingName]: value };
            
            const result = settingsToEnv(settings, values);
            
            // Should use the specified envVar name
            expect(result[envVarName]).toBe(value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
