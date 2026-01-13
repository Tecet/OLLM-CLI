/**
 * Unit tests for MCP configuration integration
 * Tests configuration validation, merging, and effects
 */

import { describe, it, expect } from 'vitest';
import {
  validateMCPConfig,
  mergeMCPConfig,
  DEFAULT_MCP_CONFIG,
  type MCPConfig,
} from '../config.js';

describe('MCP Configuration', () => {
  describe('validateMCPConfig', () => {
    it('should validate valid configuration', () => {
      const config: MCPConfig = {
        enabled: true,
        connectionTimeout: 10000,
        servers: {},
      };

      const result = validateMCPConfig(config);
      expect(result).toEqual(config);
    });

    it('should accept partial configuration', () => {
      const config: MCPConfig = {
        enabled: false,
      };

      const result = validateMCPConfig(config);
      expect(result.enabled).toBe(false);
    });

    it('should reject invalid connectionTimeout', () => {
      const config = {
        enabled: true,
        connectionTimeout: -5000,
      };

      expect(() => validateMCPConfig(config)).toThrow();
    });
  });

  describe('mergeMCPConfig', () => {
    it('should use defaults when no config provided', () => {
      const result = mergeMCPConfig();
      expect(result.enabled).toBe(DEFAULT_MCP_CONFIG.enabled);
      expect(result.connectionTimeout).toBe(DEFAULT_MCP_CONFIG.connectionTimeout);
      expect(result.servers).toEqual({});
    });

    it('should merge partial config with defaults', () => {
      const userConfig: Partial<MCPConfig> = {
        enabled: false,
      };

      const result = mergeMCPConfig(userConfig);
      expect(result.enabled).toBe(false);
      expect(result.connectionTimeout).toBe(DEFAULT_MCP_CONFIG.connectionTimeout);
    });

    it('should merge server configurations', () => {
      const userConfig: MCPConfig = {
        servers: {
          'my-server': {
            command: 'npx',
            args: ['my-mcp-server'],
          },
        },
      };

      const result = mergeMCPConfig(userConfig);
      expect(result.servers['my-server']).toBeDefined();
    });
  });

  describe('DEFAULT_MCP_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_MCP_CONFIG.enabled).toBe(true);
      expect(DEFAULT_MCP_CONFIG.connectionTimeout).toBeGreaterThan(0);
      expect(DEFAULT_MCP_CONFIG.servers).toEqual({});
    });
  });
});
