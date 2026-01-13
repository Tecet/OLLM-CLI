/**
 * Unit tests for extension settings integration
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ExtensionSettingsManager } from '../settingsIntegration.js';
import type { ExtensionSetting } from '../types.js';

describe('ExtensionSettingsManager', () => {
  let manager: ExtensionSettingsManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    manager = new ExtensionSettingsManager();
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('resolveSettings', () => {
    test('should resolve settings from environment variables', () => {
      const settings: ExtensionSetting[] = [
        {
          name: 'apiKey',
          envVar: 'TEST_API_KEY',
          sensitive: true,
          description: 'API key for service',
        },
      ];

      process.env.TEST_API_KEY = 'secret-key-123';

      const resolved = manager.resolveSettings(settings, 'test-extension');

      expect(resolved).toHaveLength(1);
      expect(resolved[0].name).toBe('apiKey');
      expect(resolved[0].value).toBe('secret-key-123');
      expect(resolved[0].source).toBe('env');
      expect(resolved[0].sensitive).toBe(true);
    });

    test('should use default value when env var not set', () => {
      const settings: ExtensionSetting[] = [
        {
          name: 'timeout',
          envVar: 'TEST_TIMEOUT',
          description: 'Request timeout',
          default: 30000,
        },
      ];

      const resolved = manager.resolveSettings(settings, 'test-extension');

      expect(resolved).toHaveLength(1);
      expect(resolved[0].value).toBe(30000);
      expect(resolved[0].source).toBe('default');
    });

    test('should handle undefined value when no env var and no default', () => {
      const settings: ExtensionSetting[] = [
        {
          name: 'optionalSetting',
          description: 'Optional setting',
        },
      ];

      const resolved = manager.resolveSettings(settings, 'test-extension');

      expect(resolved).toHaveLength(1);
      expect(resolved[0].value).toBeUndefined();
      expect(resolved[0].source).toBe('undefined');
    });

    test('should prioritize env var over default', () => {
      const settings: ExtensionSetting[] = [
        {
          name: 'port',
          envVar: 'TEST_PORT',
          description: 'Server port',
          default: 8080,
        },
      ];

      process.env.TEST_PORT = '3000';

      const resolved = manager.resolveSettings(settings, 'test-extension');

      expect(resolved[0].value).toBe('3000');
      expect(resolved[0].source).toBe('env');
    });
  });

  describe('toEnvironmentVariables', () => {
    test('should convert resolved settings to environment variables', () => {
      const resolved = [
        {
          name: 'apiKey',
          value: 'secret-123',
          sensitive: true,
          source: 'env' as const,
        },
        {
          name: 'timeout',
          value: 30000,
          sensitive: false,
          source: 'default' as const,
        },
      ];

      const env = manager.toEnvironmentVariables(resolved, 'github-integration');

      expect(env).toHaveProperty('EXTENSION_GITHUB_INTEGRATION_API_KEY', 'secret-123');
      expect(env).toHaveProperty('EXTENSION_GITHUB_INTEGRATION_TIMEOUT', '30000');
    });

    test('should skip undefined values', () => {
      const resolved = [
        {
          name: 'optionalSetting',
          value: undefined,
          sensitive: false,
          source: 'undefined' as const,
        },
      ];

      const env = manager.toEnvironmentVariables(resolved, 'test-extension');

      expect(Object.keys(env)).toHaveLength(0);
    });

    test('should handle camelCase setting names', () => {
      const resolved = [
        {
          name: 'githubToken',
          value: 'token-123',
          sensitive: true,
          source: 'env' as const,
        },
      ];

      const env = manager.toEnvironmentVariables(resolved, 'my-extension');

      expect(env).toHaveProperty('EXTENSION_MY_EXTENSION_GITHUB_TOKEN', 'token-123');
    });

    test('should convert various value types to strings', () => {
      const resolved = [
        { name: 'stringVal', value: 'hello', sensitive: false, source: 'default' as const },
        { name: 'numberVal', value: 42, sensitive: false, source: 'default' as const },
        { name: 'boolVal', value: true, sensitive: false, source: 'default' as const },
        { name: 'nullVal', value: null, sensitive: false, source: 'default' as const },
        { name: 'objectVal', value: { key: 'value' }, sensitive: false, source: 'default' as const },
      ];

      const env = manager.toEnvironmentVariables(resolved, 'test');

      expect(env.EXTENSION_TEST_STRING_VAL).toBe('hello');
      expect(env.EXTENSION_TEST_NUMBER_VAL).toBe('42');
      expect(env.EXTENSION_TEST_BOOL_VAL).toBe('true');
      expect(env.EXTENSION_TEST_NULL_VAL).toBe('');
      expect(env.EXTENSION_TEST_OBJECT_VAL).toBe('{"key":"value"}');
    });
  });

  describe('redactSensitiveSettings', () => {
    test('should redact sensitive fields', () => {
      const obj = {
        apiKey: 'secret-123',
        username: 'john',
        password: 'pass-456',
      };

      const sensitiveNames = new Set(['apiKey', 'password']);

      const redacted = manager.redactSensitiveSettings(obj, sensitiveNames);

      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.username).toBe('john');
      expect(redacted.password).toBe('[REDACTED]');
    });

    test('should handle nested objects', () => {
      const obj = {
        config: {
          apiKey: 'secret-123',
          endpoint: 'https://api.example.com',
        },
        username: 'john',
      };

      const sensitiveNames = new Set(['apiKey']);

      const redacted = manager.redactSensitiveSettings(obj, sensitiveNames);

      expect((redacted.config as Record<string, unknown>).apiKey).toBe('[REDACTED]');
      expect((redacted.config as Record<string, unknown>).endpoint).toBe('https://api.example.com');
      expect(redacted.username).toBe('john');
    });

    test('should not modify non-sensitive fields', () => {
      const obj = {
        publicField: 'visible',
        anotherField: 123,
      };

      const sensitiveNames = new Set<string>();

      const redacted = manager.redactSensitiveSettings(obj, sensitiveNames);

      expect(redacted).toEqual(obj);
    });
  });

  describe('validateRequiredSettings', () => {
    test('should identify missing required settings', () => {
      const resolved = [
        { name: 'apiKey', value: 'key-123', sensitive: true, source: 'env' as const },
        { name: 'timeout', value: undefined, sensitive: false, source: 'undefined' as const },
      ];

      const required = ['apiKey', 'timeout', 'endpoint'];

      const missing = manager.validateRequiredSettings(resolved, required);

      expect(missing).toContain('timeout');
      expect(missing).toContain('endpoint');
      expect(missing).not.toContain('apiKey');
    });

    test('should return empty array when all required settings present', () => {
      const resolved = [
        { name: 'apiKey', value: 'key-123', sensitive: true, source: 'env' as const },
        { name: 'endpoint', value: 'https://api.example.com', sensitive: false, source: 'default' as const },
      ];

      const required = ['apiKey', 'endpoint'];

      const missing = manager.validateRequiredSettings(resolved, required);

      expect(missing).toHaveLength(0);
    });

    test('should handle empty required list', () => {
      const resolved = [
        { name: 'apiKey', value: 'key-123', sensitive: true, source: 'env' as const },
      ];

      const required: string[] = [];

      const missing = manager.validateRequiredSettings(resolved, required);

      expect(missing).toHaveLength(0);
    });
  });

  describe('createConfigSchema', () => {
    test('should create configuration schema for extension', () => {
      const settings: ExtensionSetting[] = [
        {
          name: 'apiKey',
          envVar: 'GITHUB_TOKEN',
          sensitive: true,
          description: 'GitHub API token',
        },
        {
          name: 'defaultRepo',
          description: 'Default repository',
          default: 'owner/repo',
        },
      ];

      const schema = manager.createConfigSchema('github-integration', settings);

      expect(schema).toHaveProperty('github-integration');
      const extensionSchema = schema['github-integration'] as Record<string, unknown>;

      expect(extensionSchema).toHaveProperty('apiKey');
      expect(extensionSchema).toHaveProperty('defaultRepo');

      const apiKeySchema = extensionSchema.apiKey as Record<string, unknown>;
      expect(apiKeySchema.description).toBe('GitHub API token');
      expect(apiKeySchema.sensitive).toBe(true);
      expect(apiKeySchema.envVar).toBe('GITHUB_TOKEN');

      const defaultRepoSchema = extensionSchema.defaultRepo as Record<string, unknown>;
      expect(defaultRepoSchema.description).toBe('Default repository');
      expect(defaultRepoSchema.default).toBe('owner/repo');
      expect(defaultRepoSchema.sensitive).toBe(false);
    });

    test('should handle empty settings array', () => {
      const schema = manager.createConfigSchema('test-extension', []);

      expect(schema).toHaveProperty('test-extension');
      const extensionSchema = schema['test-extension'] as Record<string, unknown>;
      expect(Object.keys(extensionSchema)).toHaveLength(0);
    });
  });
});

