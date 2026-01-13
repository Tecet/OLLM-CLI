/**
 * Unit tests for extension configuration integration
 * Tests configuration validation, merging, and effects
 */

import { describe, it, expect } from 'vitest';
import {
  validateExtensionsConfig,
  mergeExtensionsConfig,
  DEFAULT_EXTENSIONS_CONFIG,
  type ExtensionsConfig,
} from '../config.js';

describe('Extension Configuration', () => {
  describe('validateExtensionsConfig', () => {
    it('should validate valid configuration', () => {
      const config: ExtensionsConfig = {
        enabled: true,
        directories: ['~/.ollm/extensions', '.ollm/extensions'],
        autoEnable: true,
      };

      const result = validateExtensionsConfig(config);
      expect(result).toEqual(config);
    });

    it('should accept partial configuration', () => {
      const config: ExtensionsConfig = {
        enabled: false,
      };

      const result = validateExtensionsConfig(config);
      expect(result.enabled).toBe(false);
    });

    it('should validate directories array', () => {
      const config: ExtensionsConfig = {
        directories: ['/custom/path', '/another/path'],
      };

      const result = validateExtensionsConfig(config);
      expect(result.directories).toHaveLength(2);
    });

    it('should reject invalid enabled type', () => {
      const config = {
        enabled: 'yes',
      };

      expect(() => validateExtensionsConfig(config)).toThrow();
    });
  });

  describe('mergeExtensionsConfig', () => {
    it('should use defaults when no config provided', () => {
      const result = mergeExtensionsConfig();
      expect(result).toEqual(DEFAULT_EXTENSIONS_CONFIG);
    });

    it('should merge partial config with defaults', () => {
      const userConfig: Partial<ExtensionsConfig> = {
        enabled: false,
      };

      const result = mergeExtensionsConfig(userConfig);
      expect(result.enabled).toBe(false);
      expect(result.directories).toEqual(DEFAULT_EXTENSIONS_CONFIG.directories);
      expect(result.autoEnable).toBe(DEFAULT_EXTENSIONS_CONFIG.autoEnable);
    });

    it('should override directories', () => {
      const userConfig: ExtensionsConfig = {
        directories: ['/custom/extensions'],
      };

      const result = mergeExtensionsConfig(userConfig);
      expect(result.directories).toEqual(['/custom/extensions']);
    });

    it('should override all defaults', () => {
      const userConfig: ExtensionsConfig = {
        enabled: false,
        directories: ['/my/extensions'],
        autoEnable: false,
      };

      const result = mergeExtensionsConfig(userConfig);
      expect(result).toEqual(userConfig);
    });
  });

  describe('DEFAULT_EXTENSIONS_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_EXTENSIONS_CONFIG.enabled).toBe(true);
      expect(DEFAULT_EXTENSIONS_CONFIG.directories).toHaveLength(2);
      expect(DEFAULT_EXTENSIONS_CONFIG.autoEnable).toBe(true);
    });
  });
});
