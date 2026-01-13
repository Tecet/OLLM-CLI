/**
 * Tests for extension system types
 */

import { describe, it, expect } from 'vitest';
import type {
  Extension,
  ExtensionManifest,
  ExtensionSetting,
  HookConfig,
  MCPServerConfig,
  Skill,
} from '../types.js';

describe('Extension Types', () => {
  describe('ExtensionManifest', () => {
    it('should allow minimal manifest with required fields only', () => {
      const manifest: ExtensionManifest = {
        name: 'test-extension',
        version: '1.0.0',
        description: 'A test extension',
      };

      expect(manifest.name).toBe('test-extension');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.description).toBe('A test extension');
      expect(manifest.mcpServers).toBeUndefined();
      expect(manifest.hooks).toBeUndefined();
      expect(manifest.settings).toBeUndefined();
      expect(manifest.skills).toBeUndefined();
    });

    it('should allow manifest with all optional fields', () => {
      const manifest: ExtensionManifest = {
        name: 'full-extension',
        version: '2.0.0',
        description: 'A full-featured extension',
        mcpServers: {
          server1: {
            command: 'node',
            args: ['server.js'],
          },
        },
        hooks: {
          session_start: [
            {
              name: 'init',
              command: 'node',
              args: ['init.js'],
            },
          ],
        },
        settings: [
          {
            name: 'apiKey',
            description: 'API key',
          },
        ],
        skills: [
          {
            name: 'skill1',
            description: 'A skill',
            prompt: 'Do something',
          },
        ],
      };

      expect(manifest.mcpServers).toBeDefined();
      expect(manifest.hooks).toBeDefined();
      expect(manifest.settings).toBeDefined();
      expect(manifest.skills).toBeDefined();
    });
  });

  describe('HookConfig', () => {
    it('should allow hook config with command only', () => {
      const hookConfig: HookConfig = {
        name: 'test-hook',
        command: 'echo',
      };

      expect(hookConfig.name).toBe('test-hook');
      expect(hookConfig.command).toBe('echo');
      expect(hookConfig.args).toBeUndefined();
    });

    it('should allow hook config with args', () => {
      const hookConfig: HookConfig = {
        name: 'test-hook',
        command: 'node',
        args: ['script.js', '--flag'],
      };

      expect(hookConfig.args).toEqual(['script.js', '--flag']);
    });
  });

  describe('MCPServerConfig', () => {
    it('should allow minimal MCP server config', () => {
      const config: MCPServerConfig = {
        command: 'npx',
        args: ['mcp-server'],
      };

      expect(config.command).toBe('npx');
      expect(config.args).toEqual(['mcp-server']);
      expect(config.env).toBeUndefined();
      expect(config.transport).toBeUndefined();
      expect(config.timeout).toBeUndefined();
    });

    it('should allow full MCP server config', () => {
      const config: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        env: {
          API_KEY: '${MY_API_KEY}',
          DEBUG: 'true',
        },
        transport: 'stdio',
        timeout: 10000,
      };

      expect(config.env).toEqual({
        API_KEY: '${MY_API_KEY}',
        DEBUG: 'true',
      });
      expect(config.transport).toBe('stdio');
      expect(config.timeout).toBe(10000);
    });

    it('should allow different transport types', () => {
      const stdioConfig: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        transport: 'stdio',
      };

      const sseConfig: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        transport: 'sse',
      };

      const httpConfig: MCPServerConfig = {
        command: 'node',
        args: ['server.js'],
        transport: 'http',
      };

      expect(stdioConfig.transport).toBe('stdio');
      expect(sseConfig.transport).toBe('sse');
      expect(httpConfig.transport).toBe('http');
    });
  });

  describe('ExtensionSetting', () => {
    it('should allow minimal setting', () => {
      const setting: ExtensionSetting = {
        name: 'timeout',
        description: 'Request timeout',
      };

      expect(setting.name).toBe('timeout');
      expect(setting.description).toBe('Request timeout');
      expect(setting.envVar).toBeUndefined();
      expect(setting.sensitive).toBeUndefined();
      expect(setting.default).toBeUndefined();
    });

    it('should allow setting with environment variable', () => {
      const setting: ExtensionSetting = {
        name: 'apiKey',
        envVar: 'MY_API_KEY',
        description: 'API key',
      };

      expect(setting.envVar).toBe('MY_API_KEY');
    });

    it('should allow sensitive setting', () => {
      const setting: ExtensionSetting = {
        name: 'password',
        sensitive: true,
        description: 'Password',
      };

      expect(setting.sensitive).toBe(true);
    });

    it('should allow setting with default value', () => {
      const setting: ExtensionSetting = {
        name: 'retries',
        description: 'Number of retries',
        default: 3,
      };

      expect(setting.default).toBe(3);
    });
  });

  describe('Skill', () => {
    it('should allow skill definition', () => {
      const skill: Skill = {
        name: 'create-pr',
        description: 'Create a pull request',
        prompt: 'Create a pull request with the following changes: {{changes}}',
      };

      expect(skill.name).toBe('create-pr');
      expect(skill.description).toBe('Create a pull request');
      expect(skill.prompt).toContain('{{changes}}');
    });
  });

  describe('Extension', () => {
    it('should allow complete extension object', () => {
      const extension: Extension = {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test extension',
        path: '/path/to/extension',
        manifest: {
          name: 'test-extension',
          version: '1.0.0',
          description: 'Test extension',
        },
        enabled: true,
        hooks: [],
        mcpServers: [],
        settings: [],
        skills: [],
      };

      expect(extension.name).toBe('test-extension');
      expect(extension.enabled).toBe(true);
      expect(extension.hooks).toEqual([]);
      expect(extension.mcpServers).toEqual([]);
      expect(extension.settings).toEqual([]);
      expect(extension.skills).toEqual([]);
    });

    it('should allow disabled extension', () => {
      const extension: Extension = {
        name: 'disabled-extension',
        version: '1.0.0',
        description: 'Disabled extension',
        path: '/path/to/extension',
        manifest: {
          name: 'disabled-extension',
          version: '1.0.0',
          description: 'Disabled extension',
        },
        enabled: false,
        hooks: [],
        mcpServers: [],
        settings: [],
        skills: [],
      };

      expect(extension.enabled).toBe(false);
    });
  });
});
