/**
 * Unit tests for service configuration loading
 * Feature: services-sessions
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SERVICES_CONFIG,
  mergeServicesConfig,
  validateServicesConfig,
  getLoopDetectionConfig,
  getSanitizationConfig,
  servicesConfigSchema,
} from '../config.js';
import type { ServicesConfig } from '../types.js';

describe('Service Configuration', () => {
  describe('Default Values', () => {
    it('should have valid session defaults', () => {
      expect(DEFAULT_SERVICES_CONFIG.session).toEqual({
        dataDir: '~/.ollm/session-data',
        maxSessions: 100,
        autoSave: true,
      });
    });

    it('should have valid compression defaults', () => {
      expect(DEFAULT_SERVICES_CONFIG.compression).toEqual({
        enabled: true,
        threshold: 0.8,
        strategy: 'hybrid',
        preserveRecent: 4096,
      });
    });

    it('should have valid loop detection defaults', () => {
      expect(DEFAULT_SERVICES_CONFIG.loopDetection).toEqual({
        enabled: true,
        maxTurns: 50,
        repeatThreshold: 3,
      });
    });

    it('should have valid file discovery defaults', () => {
      expect(DEFAULT_SERVICES_CONFIG.fileDiscovery).toEqual({
        maxDepth: 10,
        followSymlinks: false,
        builtinIgnores: ['node_modules', '.git', 'dist', 'build', '.next', '.cache'],
      });
    });

    it('should have valid environment defaults', () => {
      expect(DEFAULT_SERVICES_CONFIG.environment).toEqual({
        allowList: ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG'],
        denyPatterns: [
          '*_KEY',
          '*_SECRET',
          '*_TOKEN',
          '*_PASSWORD',
          '*_CREDENTIAL',
          'AWS_*',
          'GITHUB_*',
        ],
      });
    });

    it('should have all required top-level keys', () => {
      expect(DEFAULT_SERVICES_CONFIG).toHaveProperty('session');
      expect(DEFAULT_SERVICES_CONFIG).toHaveProperty('compression');
      expect(DEFAULT_SERVICES_CONFIG).toHaveProperty('loopDetection');
      expect(DEFAULT_SERVICES_CONFIG).toHaveProperty('fileDiscovery');
      expect(DEFAULT_SERVICES_CONFIG).toHaveProperty('environment');
    });
  });

  describe('Custom Configuration', () => {
    it('should merge empty config with defaults', () => {
      const result = mergeServicesConfig({});
      expect(result).toEqual(DEFAULT_SERVICES_CONFIG);
    });

    it('should merge partial session config', () => {
      const userConfig: Partial<ServicesConfig> = {
        session: {
          maxSessions: 50,
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.session.maxSessions).toBe(50);
      expect(result.session.dataDir).toBe(DEFAULT_SERVICES_CONFIG.session.dataDir);
      expect(result.session.autoSave).toBe(DEFAULT_SERVICES_CONFIG.session.autoSave);
    });

    it('should merge partial compression config', () => {
      const userConfig: Partial<ServicesConfig> = {
        compression: {
          threshold: 0.9,
          strategy: 'summarize',
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.compression.threshold).toBe(0.9);
      expect(result.compression.strategy).toBe('summarize');
      expect(result.compression.enabled).toBe(DEFAULT_SERVICES_CONFIG.compression.enabled);
      expect(result.compression.preserveRecent).toBe(DEFAULT_SERVICES_CONFIG.compression.preserveRecent);
    });

    it('should merge partial loop detection config', () => {
      const userConfig: Partial<ServicesConfig> = {
        loopDetection: {
          maxTurns: 100,
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.loopDetection.maxTurns).toBe(100);
      expect(result.loopDetection.enabled).toBe(DEFAULT_SERVICES_CONFIG.loopDetection.enabled);
      expect(result.loopDetection.repeatThreshold).toBe(DEFAULT_SERVICES_CONFIG.loopDetection.repeatThreshold);
    });

    it('should merge partial file discovery config', () => {
      const userConfig: Partial<ServicesConfig> = {
        fileDiscovery: {
          maxDepth: 5,
          followSymlinks: true,
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.fileDiscovery.maxDepth).toBe(5);
      expect(result.fileDiscovery.followSymlinks).toBe(true);
      expect(result.fileDiscovery.builtinIgnores).toEqual(DEFAULT_SERVICES_CONFIG.fileDiscovery.builtinIgnores);
    });

    it('should append to builtin ignores instead of replacing', () => {
      const userConfig: Partial<ServicesConfig> = {
        fileDiscovery: {
          builtinIgnores: ['custom-ignore', 'another-ignore'],
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.fileDiscovery.builtinIgnores).toContain('node_modules');
      expect(result.fileDiscovery.builtinIgnores).toContain('.git');
      expect(result.fileDiscovery.builtinIgnores).toContain('custom-ignore');
      expect(result.fileDiscovery.builtinIgnores).toContain('another-ignore');
    });

    it('should append to environment allow list instead of replacing', () => {
      const userConfig: Partial<ServicesConfig> = {
        environment: {
          allowList: ['CUSTOM_VAR', 'ANOTHER_VAR'],
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.environment.allowList).toContain('PATH');
      expect(result.environment.allowList).toContain('HOME');
      expect(result.environment.allowList).toContain('CUSTOM_VAR');
      expect(result.environment.allowList).toContain('ANOTHER_VAR');
    });

    it('should append to environment deny patterns instead of replacing', () => {
      const userConfig: Partial<ServicesConfig> = {
        environment: {
          denyPatterns: ['CUSTOM_*', 'PRIVATE_*'],
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.environment.denyPatterns).toContain('*_KEY');
      expect(result.environment.denyPatterns).toContain('*_SECRET');
      expect(result.environment.denyPatterns).toContain('CUSTOM_*');
      expect(result.environment.denyPatterns).toContain('PRIVATE_*');
    });

    it('should merge multiple sections at once', () => {
      const userConfig: Partial<ServicesConfig> = {
        session: {
          maxSessions: 200,
        },
        compression: {
          enabled: false,
        },
        loopDetection: {
          repeatThreshold: 5,
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.session.maxSessions).toBe(200);
      expect(result.compression.enabled).toBe(false);
      expect(result.loopDetection.repeatThreshold).toBe(5);
    });

    it('should handle undefined user config', () => {
      const result = mergeServicesConfig(undefined);
      expect(result).toEqual(DEFAULT_SERVICES_CONFIG);
    });

    it('should override all session values', () => {
      const userConfig: Partial<ServicesConfig> = {
        session: {
          dataDir: '/custom/path',
          maxSessions: 25,
          autoSave: false,
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.session).toEqual({
        dataDir: '/custom/path',
        maxSessions: 25,
        autoSave: false,
      });
    });

    it('should override all compression values', () => {
      const userConfig: Partial<ServicesConfig> = {
        compression: {
          enabled: false,
          threshold: 0.5,
          strategy: 'truncate',
          preserveRecent: 2048,
        },
      };
      const result = mergeServicesConfig(userConfig);
      
      expect(result.compression).toEqual({
        enabled: false,
        threshold: 0.5,
        strategy: 'truncate',
        preserveRecent: 2048,
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should validate empty config', () => {
      const config = {};
      const result = validateServicesConfig(config);
      expect(result).toEqual({});
    });

    it('should validate valid session config', () => {
      const config = {
        session: {
          dataDir: '/custom/path',
          maxSessions: 50,
          autoSave: true,
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });

    it('should validate valid compression config', () => {
      const config = {
        compression: {
          enabled: true,
          threshold: 0.75,
          strategy: 'hybrid' as const,
          preserveRecent: 8192,
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });

    it('should validate valid loop detection config', () => {
      const config = {
        loopDetection: {
          enabled: false,
          maxTurns: 25,
          repeatThreshold: 2,
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });

    it('should validate valid file discovery config', () => {
      const config = {
        fileDiscovery: {
          maxDepth: 15,
          followSymlinks: true,
          builtinIgnores: ['test', 'coverage'],
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });

    it('should validate valid environment config', () => {
      const config = {
        environment: {
          allowList: ['VAR1', 'VAR2'],
          denyPatterns: ['SECRET_*', 'PRIVATE_*'],
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });

    it('should reject invalid compression threshold (negative)', () => {
      const config = {
        compression: {
          threshold: -0.5,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject invalid compression threshold (> 1)', () => {
      const config = {
        compression: {
          threshold: 1.5,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject invalid compression strategy', () => {
      const config = {
        compression: {
          strategy: 'invalid',
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject negative maxSessions', () => {
      const config = {
        session: {
          maxSessions: -10,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject zero maxSessions', () => {
      const config = {
        session: {
          maxSessions: 0,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject negative maxTurns', () => {
      const config = {
        loopDetection: {
          maxTurns: -5,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject negative repeatThreshold', () => {
      const config = {
        loopDetection: {
          repeatThreshold: -1,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject negative maxDepth', () => {
      const config = {
        fileDiscovery: {
          maxDepth: -3,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject negative preserveRecent', () => {
      const config = {
        compression: {
          preserveRecent: -100,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject non-boolean autoSave', () => {
      const config = {
        session: {
          autoSave: 'yes' as any,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject non-array allowList', () => {
      const config = {
        environment: {
          allowList: 'PATH,HOME' as any,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should reject non-array denyPatterns', () => {
      const config = {
        environment: {
          denyPatterns: '*_KEY' as any,
        },
      };
      expect(() => validateServicesConfig(config)).toThrow();
    });

    it('should accept partial configs', () => {
      const config = {
        session: {
          maxSessions: 75,
        },
        compression: {
          enabled: false,
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });

    it('should validate complete config', () => {
      const config = {
        session: {
          dataDir: '~/.ollm/sessions',
          maxSessions: 150,
          autoSave: true,
        },
        compression: {
          enabled: true,
          threshold: 0.85,
          strategy: 'summarize' as const,
          preserveRecent: 6144,
        },
        loopDetection: {
          enabled: true,
          maxTurns: 75,
          repeatThreshold: 4,
        },
        fileDiscovery: {
          maxDepth: 12,
          followSymlinks: false,
          builtinIgnores: ['tmp', 'cache'],
        },
        environment: {
          allowList: ['PATH', 'HOME', 'CUSTOM'],
          denyPatterns: ['*_SECRET', 'API_*'],
        },
      };
      const result = validateServicesConfig(config);
      expect(result).toEqual(config);
    });
  });

  describe('Helper Functions', () => {
    it('should extract loop detection config', () => {
      const servicesConfig = DEFAULT_SERVICES_CONFIG;
      const loopConfig = getLoopDetectionConfig(servicesConfig);
      
      expect(loopConfig).toEqual({
        enabled: true,
        maxTurns: 50,
        repeatThreshold: 3,
      });
    });

    it('should extract loop detection config from custom config', () => {
      const servicesConfig = mergeServicesConfig({
        loopDetection: {
          enabled: false,
          maxTurns: 100,
          repeatThreshold: 5,
        },
      });
      const loopConfig = getLoopDetectionConfig(servicesConfig);
      
      expect(loopConfig).toEqual({
        enabled: false,
        maxTurns: 100,
        repeatThreshold: 5,
      });
    });

    it('should extract sanitization config', () => {
      const servicesConfig = DEFAULT_SERVICES_CONFIG;
      const sanitizationConfig = getSanitizationConfig(servicesConfig);
      
      expect(sanitizationConfig).toEqual({
        allowList: ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG'],
        denyPatterns: [
          '*_KEY',
          '*_SECRET',
          '*_TOKEN',
          '*_PASSWORD',
          '*_CREDENTIAL',
          'AWS_*',
          'GITHUB_*',
        ],
      });
    });

    it('should extract sanitization config from custom config', () => {
      const servicesConfig = mergeServicesConfig({
        environment: {
          allowList: ['CUSTOM_VAR'],
          denyPatterns: ['PRIVATE_*'],
        },
      });
      const sanitizationConfig = getSanitizationConfig(servicesConfig);
      
      expect(sanitizationConfig.allowList).toContain('PATH');
      expect(sanitizationConfig.allowList).toContain('CUSTOM_VAR');
      expect(sanitizationConfig.denyPatterns).toContain('*_KEY');
      expect(sanitizationConfig.denyPatterns).toContain('PRIVATE_*');
    });
  });

  describe('Schema Validation', () => {
    it('should have valid schema for all compression strategies', () => {
      const strategies = ['summarize', 'truncate', 'hybrid'] as const;
      
      strategies.forEach((strategy) => {
        const config = {
          compression: {
            strategy,
          },
        };
        const result = servicesConfigSchema.parse(config);
        expect(result.compression?.strategy).toBe(strategy);
      });
    });

    it('should validate threshold boundaries', () => {
      const validThresholds = [0, 0.5, 0.8, 1.0];
      
      validThresholds.forEach((threshold) => {
        const config = {
          compression: {
            threshold,
          },
        };
        const result = servicesConfigSchema.parse(config);
        expect(result.compression?.threshold).toBe(threshold);
      });
    });

    it('should reject threshold outside boundaries', () => {
      const invalidThresholds = [-0.1, 1.1, 2.0];
      
      invalidThresholds.forEach((threshold) => {
        const config = {
          compression: {
            threshold,
          },
        };
        expect(() => servicesConfigSchema.parse(config)).toThrow();
      });
    });

    it('should validate positive integers', () => {
      const config = {
        session: {
          maxSessions: 100,
        },
        compression: {
          preserveRecent: 4096,
        },
        loopDetection: {
          maxTurns: 50,
          repeatThreshold: 3,
        },
        fileDiscovery: {
          maxDepth: 10,
        },
      };
      const result = servicesConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should reject non-integer values for integer fields', () => {
      const config = {
        session: {
          maxSessions: 100.5,
        },
      };
      expect(() => servicesConfigSchema.parse(config)).toThrow();
    });

    it('should validate boolean fields', () => {
      const config = {
        session: {
          autoSave: true,
        },
        compression: {
          enabled: false,
        },
        loopDetection: {
          enabled: true,
        },
        fileDiscovery: {
          followSymlinks: false,
        },
      };
      const result = servicesConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should validate array fields', () => {
      const config = {
        fileDiscovery: {
          builtinIgnores: ['node_modules', '.git', 'dist'],
        },
        environment: {
          allowList: ['PATH', 'HOME'],
          denyPatterns: ['*_KEY', '*_SECRET'],
        },
      };
      const result = servicesConfigSchema.parse(config);
      expect(result).toEqual(config);
    });

    it('should allow empty arrays', () => {
      const config = {
        fileDiscovery: {
          builtinIgnores: [],
        },
        environment: {
          allowList: [],
          denyPatterns: [],
        },
      };
      const result = servicesConfigSchema.parse(config);
      expect(result).toEqual(config);
    });
  });
});
