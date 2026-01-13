/**
 * Unit tests for hook configuration integration
 * Tests configuration validation, merging, and effects
 */

import { describe, it, expect } from 'vitest';
import {
  validateHooksConfig,
  mergeHooksConfig,
  DEFAULT_HOOKS_CONFIG,
  type HooksConfig,
} from '../config.js';

describe('Hook Configuration', () => {
  describe('validateHooksConfig', () => {
    it('should validate valid configuration', () => {
      const config: HooksConfig = {
        enabled: true,
        timeout: 30000,
        trustWorkspace: false,
      };

      const result = validateHooksConfig(config);
      expect(result).toEqual(config);
    });

    it('should accept partial configuration', () => {
      const config: HooksConfig = {
        enabled: false,
      };

      const result = validateHooksConfig(config);
      expect(result.enabled).toBe(false);
    });

    it('should reject invalid timeout', () => {
      const config = {
        enabled: true,
        timeout: -1000,
      };

      expect(() => validateHooksConfig(config)).toThrow();
    });

    it('should reject invalid enabled type', () => {
      const config = {
        enabled: 'yes',
      };

      expect(() => validateHooksConfig(config)).toThrow();
    });
  });

  describe('mergeHooksConfig', () => {
    it('should use defaults when no config provided', () => {
      const result = mergeHooksConfig();
      expect(result).toEqual(DEFAULT_HOOKS_CONFIG);
    });

    it('should merge partial config with defaults', () => {
      const userConfig: Partial<HooksConfig> = {
        enabled: false,
      };

      const result = mergeHooksConfig(userConfig);
      expect(result.enabled).toBe(false);
      expect(result.timeout).toBe(DEFAULT_HOOKS_CONFIG.timeout);
      expect(result.trustWorkspace).toBe(DEFAULT_HOOKS_CONFIG.trustWorkspace);
    });

    it('should override all defaults', () => {
      const userConfig: HooksConfig = {
        enabled: false,
        timeout: 60000,
        trustWorkspace: true,
      };

      const result = mergeHooksConfig(userConfig);
      expect(result).toEqual(userConfig);
    });
  });

  describe('DEFAULT_HOOKS_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_HOOKS_CONFIG.enabled).toBe(true);
      expect(DEFAULT_HOOKS_CONFIG.timeout).toBeGreaterThan(0);
      expect(DEFAULT_HOOKS_CONFIG.trustWorkspace).toBe(false);
    });
  });
});
