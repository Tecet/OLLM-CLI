/**
 * Unit tests for environment variable substitution
 * 
 * Tests variable substitution, missing variable handling, and environment inheritance.
 */

import { describe, it, expect } from 'vitest';
import {
  substituteEnvVars,
  substituteEnvObject,
  settingsToEnv,
} from '../envSubstitution.js';

describe('Environment Variable Substitution - Unit Tests', () => {
  describe('substituteEnvVars', () => {
    it('should substitute a single variable', () => {
      const env = { MY_VAR: 'hello' };
      const result = substituteEnvVars('Value is ${MY_VAR}', env);
      expect(result).toBe('Value is hello');
    });

    it('should substitute multiple variables', () => {
      const env = { VAR1: 'foo', VAR2: 'bar' };
      const result = substituteEnvVars('${VAR1} and ${VAR2}', env);
      expect(result).toBe('foo and bar');
    });

    it('should handle variables at start and end', () => {
      const env = { START: 'begin', END: 'finish' };
      const result = substituteEnvVars('${START} middle ${END}', env);
      expect(result).toBe('begin middle finish');
    });

    it('should use empty string for missing variables', () => {
      const env = {};
      const result = substituteEnvVars('Value is ${MISSING}', env);
      expect(result).toBe('Value is ');
    });

    it('should handle mix of present and missing variables', () => {
      const env = { PRESENT: 'here' };
      const result = substituteEnvVars('${PRESENT} and ${MISSING}', env);
      expect(result).toBe('here and ');
    });

    it('should not substitute variables without ${} syntax', () => {
      const env = { MY_VAR: 'hello' };
      const result = substituteEnvVars('Value is $MY_VAR', env);
      expect(result).toBe('Value is $MY_VAR');
    });

    it('should handle empty string input', () => {
      const env = { MY_VAR: 'hello' };
      const result = substituteEnvVars('', env);
      expect(result).toBe('');
    });

    it('should handle string with no variables', () => {
      const env = { MY_VAR: 'hello' };
      const result = substituteEnvVars('plain text', env);
      expect(result).toBe('plain text');
    });

    it('should handle nested braces correctly', () => {
      const env = { VAR: 'value' };
      const result = substituteEnvVars('${VAR}', env);
      expect(result).toBe('value');
    });

    it('should handle variables with underscores and numbers', () => {
      const env = { MY_VAR_123: 'test' };
      const result = substituteEnvVars('${MY_VAR_123}', env);
      expect(result).toBe('test');
    });
  });

  describe('substituteEnvObject', () => {
    it('should substitute variables in all values', () => {
      const parentEnv = { TOKEN: 'secret123', API_KEY: 'key456' };
      const envConfig = {
        AUTH_TOKEN: '${TOKEN}',
        KEY: '${API_KEY}',
      };
      
      const result = substituteEnvObject(envConfig, parentEnv);
      
      expect(result).toEqual({
        AUTH_TOKEN: 'secret123',
        KEY: 'key456',
      });
    });

    it('should handle empty config', () => {
      const result = substituteEnvObject(undefined);
      expect(result).toEqual({});
    });

    it('should handle config with no variables', () => {
      const envConfig = {
        STATIC: 'value',
        ANOTHER: 'test',
      };
      
      const result = substituteEnvObject(envConfig);
      
      expect(result).toEqual({
        STATIC: 'value',
        ANOTHER: 'test',
      });
    });

    it('should use empty string for missing variables', () => {
      const parentEnv = {};
      const envConfig = {
        MISSING: '${NOT_FOUND}',
      };
      
      const result = substituteEnvObject(envConfig, parentEnv);
      
      expect(result).toEqual({
        MISSING: '',
      });
    });

    it('should inherit from parent environment by default', () => {
      // Set a test variable in process.env
      const originalValue = process.env.TEST_VAR_FOR_SUBSTITUTION;
      process.env.TEST_VAR_FOR_SUBSTITUTION = 'from-process-env';
      
      try {
        const envConfig = {
          VALUE: '${TEST_VAR_FOR_SUBSTITUTION}',
        };
        
        const result = substituteEnvObject(envConfig);
        
        expect(result).toEqual({
          VALUE: 'from-process-env',
        });
      } finally {
        // Restore original value
        if (originalValue === undefined) {
          delete process.env.TEST_VAR_FOR_SUBSTITUTION;
        } else {
          process.env.TEST_VAR_FOR_SUBSTITUTION = originalValue;
        }
      }
    });

    it('should handle complex substitution patterns', () => {
      const parentEnv = { BASE: '/usr/local', NAME: 'myapp' };
      const envConfig = {
        PATH: '${BASE}/bin',
        CONFIG: '${BASE}/etc/${NAME}.conf',
      };
      
      const result = substituteEnvObject(envConfig, parentEnv);
      
      expect(result).toEqual({
        PATH: '/usr/local/bin',
        CONFIG: '/usr/local/etc/myapp.conf',
      });
    });
  });

  describe('settingsToEnv', () => {
    it('should convert settings to environment variables', () => {
      const settings = [
        { name: 'apiKey', envVar: 'API_KEY' },
        { name: 'timeout' },
      ];
      const values = {
        apiKey: 'secret123',
        timeout: 30,
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        API_KEY: 'secret123',
        TIMEOUT: '30',
      });
    });

    it('should use envVar when specified', () => {
      const settings = [
        { name: 'githubToken', envVar: 'GITHUB_TOKEN' },
      ];
      const values = {
        githubToken: 'ghp_123',
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        GITHUB_TOKEN: 'ghp_123',
      });
    });

    it('should convert camelCase to UPPER_SNAKE_CASE', () => {
      const settings = [
        { name: 'myApiKey' },
        { name: 'someValue' },
      ];
      const values = {
        myApiKey: 'key',
        someValue: 'val',
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        MY_API_KEY: 'key',
        SOME_VALUE: 'val',
      });
    });

    it('should skip undefined values', () => {
      const settings = [
        { name: 'defined' },
        { name: 'undefined' },
      ];
      const values = {
        defined: 'value',
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        DEFINED: 'value',
      });
    });

    it('should handle empty settings', () => {
      const result = settingsToEnv(undefined, {});
      expect(result).toEqual({});
    });

    it('should convert boolean values to strings', () => {
      const settings = [
        { name: 'enabled' },
      ];
      const values = {
        enabled: true,
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        ENABLED: 'true',
      });
    });

    it('should convert number values to strings', () => {
      const settings = [
        { name: 'port' },
        { name: 'timeout' },
      ];
      const values = {
        port: 8080,
        timeout: 30.5,
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        PORT: '8080',
        TIMEOUT: '30.5',
      });
    });

    it('should handle kebab-case names', () => {
      const settings = [
        { name: 'api-key' },
      ];
      const values = {
        'api-key': 'secret',
      };
      
      const result = settingsToEnv(settings, values);
      
      expect(result).toEqual({
        API_KEY: 'secret',
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete MCP server environment setup', () => {
      // Simulate extension settings
      const settings = [
        { name: 'githubToken', envVar: 'GITHUB_TOKEN' },
        { name: 'defaultRepo' },
      ];
      const values = {
        githubToken: 'ghp_secret',
        defaultRepo: 'owner/repo',
      };
      
      // Convert settings to env vars
      const settingsEnv = settingsToEnv(settings, values);
      
      // Simulate MCP server config with substitution
      const serverEnv = {
        GITHUB_TOKEN: '${GITHUB_TOKEN}',
        REPO: '${DEFAULT_REPO}',
        STATIC: 'value',
      };
      
      // Merge and substitute
      const parentEnv = { ...process.env, ...settingsEnv };
      const result = substituteEnvObject(serverEnv, parentEnv);
      
      expect(result.GITHUB_TOKEN).toBe('ghp_secret');
      expect(result.REPO).toBe('owner/repo'); // DEFAULT_REPO is in settingsEnv
      expect(result.STATIC).toBe('value');
    });

    it('should handle environment inheritance chain', () => {
      // Parent environment
      const parentEnv = {
        BASE_PATH: '/app',
        VERSION: '1.0.0',
      };
      
      // Extension settings
      const settings = [
        { name: 'apiEndpoint', envVar: 'API_ENDPOINT' },
      ];
      const values = {
        apiEndpoint: '${BASE_PATH}/api',
      };
      
      // Convert settings (this would substitute from parentEnv)
      const settingsEnv = settingsToEnv(settings, values);
      
      // MCP server config
      const serverEnv = {
        ENDPOINT: '${API_ENDPOINT}',
        VERSION: '${VERSION}',
      };
      
      // Merge and substitute
      const mergedEnv = { ...parentEnv, ...settingsEnv };
      const result = substituteEnvObject(serverEnv, mergedEnv);
      
      expect(result.ENDPOINT).toBe('${BASE_PATH}/api'); // Not double-substituted
      expect(result.VERSION).toBe('1.0.0');
    });
  });
});
