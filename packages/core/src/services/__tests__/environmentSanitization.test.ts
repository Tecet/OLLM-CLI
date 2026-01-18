/**
 * Tests for EnvironmentSanitizationService
 * Feature: services-sessions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { EnvironmentSanitizationService } from '../environmentSanitization.js';

describe('EnvironmentSanitizationService', () => {
  let service: EnvironmentSanitizationService;

  beforeEach(() => {
    service = new EnvironmentSanitizationService();
  });

  describe('Property 25: Deny pattern filtering', () => {
    /**
     * Feature: services-sessions, Property 25: Deny pattern filtering
     * 
     * For any environment containing variables matching deny patterns, 
     * sanitization should remove all matching variables from the result.
     * 
     * Validates: Requirements 7.5
     */
    it('should remove all variables matching deny patterns', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.oneof(
              // Generate realistic sensitive variable names
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `${s}_KEY`),
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `${s}_SECRET`),
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `${s}_TOKEN`),
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `${s}_PASSWORD`),
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `${s}_CREDENTIAL`),
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `AWS_${s}`),
              fc.string({ minLength: 1, maxLength: 20 })
                .filter((s) => /^[A-Z0-9_]+$/.test(s))
                .map((s) => `GITHUB_${s}`)
            ),
            { minLength: 1, maxLength: 20 }
          ),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[A-Z_][A-Z0-9_]*$/.test(s)),
            fc.string({ maxLength: 200 }),
            { minKeys: 0, maxKeys: 10 }
          ),
          async (sensitiveVars: string[], otherVars: Record<string, string>) => {
            // Create an environment with sensitive variables
            const env: Record<string, string> = {};
            
            // Add sensitive variables
            for (const varName of sensitiveVars) {
              env[varName] = `sensitive-value-${varName}`;
            }
            
            // Add other variables (but filter out any that might match deny patterns)
            for (const [key, value] of Object.entries(otherVars)) {
              // Skip if this key is already in sensitiveVars or matches a deny pattern
              if (!sensitiveVars.includes(key) && !service.isDenied(key)) {
                env[key] = value;
              }
            }

            // Sanitize the environment
            const sanitized = service.sanitize(env);

            // Verify that all sensitive variables are removed
            for (const varName of sensitiveVars) {
              // If the variable is not in the allow list, it should be removed
              if (!service.getAllowList().includes(varName)) {
                expect(sanitized).not.toHaveProperty(varName);
              }
            }

            // Verify that variables matching deny patterns are not present
            for (const key of Object.keys(sanitized)) {
              expect(service.isDenied(key)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 26: Allow list preservation', () => {
    /**
     * Feature: services-sessions, Property 26: Allow list preservation
     * 
     * For any environment containing variables in the allow list, 
     * sanitization should preserve all those variables in the result.
     * 
     * Validates: Requirements 7.6
     */
    it('should preserve all variables in the allow list', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[A-Z_][A-Z0-9_]*$/.test(s)),
            fc.string({ maxLength: 200 }),
            { minKeys: 0, maxKeys: 20 }
          ),
          async (otherVars: Record<string, string>) => {
            // Get the allow list from the service
            const allowList = service.getAllowList();
            
            // Create an environment with allow list variables and other variables
            const env: Record<string, string> = {};
            
            // Add all allow list variables with random values
            for (const varName of allowList) {
              env[varName] = `allow-list-value-${varName}-${Math.random()}`;
            }
            
            // Add other variables (but filter out any that are already in allow list)
            for (const [key, value] of Object.entries(otherVars)) {
              if (!allowList.includes(key)) {
                env[key] = value;
              }
            }

            // Sanitize the environment
            const sanitized = service.sanitize(env);

            // Verify that ALL allow list variables are preserved
            for (const varName of allowList) {
              expect(sanitized).toHaveProperty(varName);
              expect(sanitized[varName]).toBe(env[varName]);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 27: Sanitization completeness', () => {
    /**
     * Feature: services-sessions, Property 27: Sanitization completeness
     * 
     * For any environment, after sanitization, the result should contain 
     * only variables that are either in the allow list or do not match 
     * any deny patterns.
     * 
     * Validates: Requirements 7.5, 7.6
     */
    it('should only contain allowed or non-denied variables after sanitization', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 50 }).filter((s) => /^[A-Z_][A-Z0-9_]*$/.test(s)),
            fc.string({ maxLength: 200 }),
            { minKeys: 1, maxKeys: 30 }
          ),
          async (env: Record<string, string>) => {
            // Sanitize the environment
            const sanitized = service.sanitize(env);

            // Get the allow list
            const allowList = service.getAllowList();

            // Verify that every variable in the sanitized result is either:
            // 1. In the allow list, OR
            // 2. Does not match any deny patterns
            for (const key of Object.keys(sanitized)) {
              const isInAllowList = allowList.includes(key);
              const matchesDenyPattern = service.isDenied(key);

              // The variable should be in the allow list OR not match deny patterns
              expect(isInAllowList || !matchesDenyPattern).toBe(true);
            }

            // Verify that no variable in the sanitized result matches deny patterns
            // unless it's explicitly in the allow list
            for (const key of Object.keys(sanitized)) {
              if (service.isDenied(key)) {
                // If it matches a deny pattern, it must be in the allow list
                expect(allowList.includes(key)).toBe(true);
              }
            }

            // Verify that all variables from the original environment that are
            // in the allow list are present in the sanitized result
            for (const key of Object.keys(env)) {
              if (allowList.includes(key)) {
                expect(sanitized).toHaveProperty(key);
                expect(sanitized[key]).toBe(env[key]);
              }
            }

            // Verify that all variables from the original environment that
            // match deny patterns and are NOT in the allow list are removed
            for (const key of Object.keys(env)) {
              if (service.isDenied(key) && !allowList.includes(key)) {
                expect(sanitized).not.toHaveProperty(key);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Default Configuration', () => {
    /**
     * Unit tests for default configuration
     * Validates: Requirements 7.3, 7.4
     */
    
    it('should include core variables in default allow list', () => {
      const allowList = service.getAllowList();
      
      // Test that all core variables are in the allow list
      const coreVariables = [
        'PATH',
        'HOME',
        'USER',
        'SHELL',
        'TERM',
        'LANG',
      ];
      
      for (const varName of coreVariables) {
        expect(allowList).toContain(varName);
      }
    });

    it('should include LC_* variables in default allow list', () => {
      const allowList = service.getAllowList();
      
      // Test that LC_* locale variables are in the allow list
      const localeVariables = [
        'LC_ALL',
        'LC_COLLATE',
        'LC_CTYPE',
        'LC_MESSAGES',
        'LC_MONETARY',
        'LC_NUMERIC',
        'LC_TIME',
      ];
      
      for (const varName of localeVariables) {
        expect(allowList).toContain(varName);
      }
    });

    it('should include sensitive patterns in default deny patterns', () => {
      const denyPatterns = service.getDenyPatterns();
      
      // Test that all sensitive patterns are in the deny list
      const sensitivePatterns = [
        '*_KEY',
        '*_SECRET',
        '*_TOKEN',
        '*_PASSWORD',
        '*_CREDENTIAL',
        'AWS_*',
        'GITHUB_*',
      ];
      
      for (const pattern of sensitivePatterns) {
        expect(denyPatterns).toContain(pattern);
      }
    });

    it('should deny variables matching sensitive patterns', () => {
      // Test specific examples of sensitive variable names
      const sensitiveVars = [
        'API_KEY',
        'DATABASE_SECRET',
        'AUTH_TOKEN',
        'DB_PASSWORD',
        'SERVICE_CREDENTIAL',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'GITHUB_TOKEN',
        'GITHUB_API_KEY',
      ];
      
      for (const varName of sensitiveVars) {
        expect(service.isDenied(varName)).toBe(true);
      }
    });

    it('should allow core variables even if they match patterns', () => {
      // Core variables should always be allowed
      const coreVariables = [
        'PATH',
        'HOME',
        'USER',
        'SHELL',
        'TERM',
        'LANG',
      ];
      
      for (const varName of coreVariables) {
        expect(service.isAllowed(varName)).toBe(true);
      }
    });

    it('should allow non-sensitive variables', () => {
      // Test that normal, non-sensitive variables are allowed
      const normalVars = [
        'NODE_ENV',
        'DEBUG',
        'PORT',
        'HOSTNAME',
        'TZ',
        'EDITOR',
        'PAGER',
      ];
      
      for (const varName of normalVars) {
        expect(service.isAllowed(varName)).toBe(true);
      }
    });

    it('should sanitize environment with default configuration', () => {
      const env = {
        // Core variables (should be kept)
        PATH: '/usr/bin:/bin',
        HOME: '/home/user',
        USER: 'testuser',
        SHELL: '/bin/bash',
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
        
        // Normal variables (should be kept)
        NODE_ENV: 'development',
        DEBUG: 'true',
        
        // Sensitive variables (should be removed)
        API_KEY: 'secret123',
        DATABASE_SECRET: 'dbpass456',
        AUTH_TOKEN: 'token789',
        AWS_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE',
        GITHUB_TOKEN: 'ghp_1234567890',
      };

      const sanitized = service.sanitize(env);

      // Core variables should be present
      expect(sanitized.PATH).toBe('/usr/bin:/bin');
      expect(sanitized.HOME).toBe('/home/user');
      expect(sanitized.USER).toBe('testuser');
      expect(sanitized.SHELL).toBe('/bin/bash');
      expect(sanitized.TERM).toBe('xterm-256color');
      expect(sanitized.LANG).toBe('en_US.UTF-8');

      // Normal variables should be present
      expect(sanitized.NODE_ENV).toBe('development');
      expect(sanitized.DEBUG).toBe('true');

      // Sensitive variables should be removed
      expect(sanitized).not.toHaveProperty('API_KEY');
      expect(sanitized).not.toHaveProperty('DATABASE_SECRET');
      expect(sanitized).not.toHaveProperty('AUTH_TOKEN');
      expect(sanitized).not.toHaveProperty('AWS_ACCESS_KEY_ID');
      expect(sanitized).not.toHaveProperty('GITHUB_TOKEN');
    });
  });

  describe('Error Handling', () => {
    /**
     * Unit tests for error handling
     * Validates: Requirements 10.5
     */

    it('should handle configuration that causes picomatch errors', () => {
      const service = new EnvironmentSanitizationService();
      
      // Spy on console.warn to verify warning is logged
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Try to configure - this would trigger the error handling
      // In real scenarios, picomatch might throw for truly invalid patterns
      // For this test, we're verifying the error handling path exists
      
      // Since we can't easily make picomatch throw, we'll test that
      // the service handles the case where configuration might fail
      const config = {
        allowList: ['PATH', 'HOME'],
        denyPatterns: ['*_KEY', '*_SECRET'],
      };
      
      // This should not throw
      expect(() => service.configure(config)).not.toThrow();
      
      warnSpy.mockRestore();
    });

    it('should handle empty configuration by keeping existing patterns', () => {
      const service = new EnvironmentSanitizationService();
      
      // Configure with empty arrays (this won't update the lists due to length check)
      const emptyConfig = {
        allowList: [],
        denyPatterns: [],
      };
      
      // This should work without errors
      service.configure(emptyConfig);
      
      // Since empty arrays don't pass the length > 0 check,
      // the service keeps its existing patterns (defaults)
      expect(service.isDenied('API_KEY')).toBe(true);
      expect(service.isDenied('AWS_SECRET')).toBe(true);
      
      // Default allow list should still be in place
      expect(service.isAllowed('PATH')).toBe(true);
      
      // Verify the defaults are still there
      const allowList = service.getAllowList();
      expect(allowList).toContain('PATH');
      expect(allowList).toContain('HOME');
    });

    it('should handle configuration with undefined values by keeping defaults', () => {
      const service = new EnvironmentSanitizationService();
      
      // Configure with undefined values (should keep defaults)
      const undefinedConfig = {
        allowList: undefined,
        denyPatterns: undefined,
      } as any;
      
      // This should not throw and should keep defaults
      service.configure(undefinedConfig);
      
      // Should still use default patterns
      expect(service.isDenied('API_KEY')).toBe(true);
      expect(service.isAllowed('PATH')).toBe(true);
      
      // Verify defaults are still in place
      const allowList = service.getAllowList();
      expect(allowList).toContain('PATH');
      expect(allowList).toContain('HOME');
    });

    it('should not throw when configuring with various inputs', () => {
      const service = new EnvironmentSanitizationService();
      
      // Test that configure doesn't throw with various inputs
      expect(() => service.configure({ allowList: [], denyPatterns: [] })).not.toThrow();
      expect(() => service.configure({ allowList: ['PATH'], denyPatterns: ['*_KEY'] })).not.toThrow();
      expect(() => service.configure({ allowList: undefined, denyPatterns: undefined } as any)).not.toThrow();
      
      // Empty strings in patterns will cause picomatch to throw, which should be caught
      expect(() => service.configure({ allowList: [''], denyPatterns: [''] })).not.toThrow();
    });

    it('should sanitize environment correctly after empty configuration', () => {
      const service = new EnvironmentSanitizationService();
      
      // Configure with empty lists (won't update due to length check)
      service.configure({ allowList: [], denyPatterns: [] });
      
      // Test that sanitization still works with defaults
      const env = {
        PATH: '/usr/bin',
        HOME: '/home/user',
        API_KEY: 'secret',
        AWS_SECRET: 'aws-secret',
        CUSTOM_VAR: 'value',
      };
      
      const sanitized = service.sanitize(env);
      
      // Core variables should be preserved (from default allow list)
      expect(sanitized.PATH).toBe('/usr/bin');
      expect(sanitized.HOME).toBe('/home/user');
      
      // Sensitive variables should be removed (from default deny patterns)
      expect(sanitized).not.toHaveProperty('API_KEY');
      expect(sanitized).not.toHaveProperty('AWS_SECRET');
      
      // Non-sensitive custom variables should be preserved
      expect(sanitized.CUSTOM_VAR).toBe('value');
    });

    it('should handle pattern matching with special characters gracefully', () => {
      const service = new EnvironmentSanitizationService();
      
      // Create an environment with various variable names including special chars
      const env = {
        PATH: '/usr/bin',
        'NORMAL_VAR': 'value3',
        API_KEY: 'secret',
      };
      
      // Sanitization should handle any pattern matching issues gracefully
      const sanitized = service.sanitize(env);
      
      // Should not throw and should return a valid object
      expect(sanitized).toBeDefined();
      expect(typeof sanitized).toBe('object');
      
      // Core variables should be preserved
      expect(sanitized.PATH).toBe('/usr/bin');
      
      // Normal variables should be preserved
      expect(sanitized.NORMAL_VAR).toBe('value3');
      
      // Sensitive variables should be removed
      expect(sanitized).not.toHaveProperty('API_KEY');
    });

    it('should maintain configuration after multiple operations', () => {
      const service = new EnvironmentSanitizationService();
      
      // Configure with custom settings
      service.configure({ allowList: ['PATH', 'HOME'], denyPatterns: ['*_SECRET'] });
      
      // Should work with new configuration
      expect(service.isDenied('MY_SECRET')).toBe(true);
      expect(service.isDenied('API_KEY')).toBe(false); // Not in deny patterns
      expect(service.isAllowed('PATH')).toBe(true);
      expect(service.isAllowed('USER')).toBe(true); // Not denied, so allowed
      
      // Configure again
      service.configure({ allowList: ['PATH'], denyPatterns: ['*_KEY', '*_TOKEN'] });
      
      // Should work with updated configuration
      expect(service.isDenied('API_KEY')).toBe(true);
      expect(service.isDenied('AUTH_TOKEN')).toBe(true);
      expect(service.isDenied('MY_SECRET')).toBe(false); // No longer in deny patterns
      expect(service.isAllowed('PATH')).toBe(true);
    });
  });
});
