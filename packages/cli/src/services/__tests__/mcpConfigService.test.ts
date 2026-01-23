/**
 * Tests for MCP Configuration Service
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MCPConfigService } from '../mcpConfigService.js';

import type { MCPServerConfig } from '@ollm/ollm-cli-core/mcp/types.js';

describe('MCPConfigService', () => {
  let service: MCPConfigService;
  let tempDir: string;

  beforeEach(() => {
    // Create temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-config-test-'));

    // Mock process.cwd() to return temp directory
    vi.spyOn(process, 'cwd').mockReturnValue(tempDir);

    // Mock os.homedir() to return temp directory
    vi.spyOn(os, 'homedir').mockReturnValue(tempDir);

    // Create service instance
    service = new MCPConfigService();
  });

  afterEach(() => {
    // Stop watching
    service.stopWatching();

    // Restore mocks
    vi.restoreAllMocks();

    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('loadMCPConfig', () => {
    it('should return empty config when no files exist', async () => {
      const config = await service.loadMCPConfig();

      expect(config).toEqual({ mcpServers: {} });
    });

    it('should load user-level configuration', async () => {
      // Create user config
      const userConfigPath = path.join(tempDir, '.ollm', 'settings', 'mcp.json');
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({
          mcpServers: {
            'user-server': {
              command: 'node',
              args: ['server.js'],
            },
          },
        })
      );

      const config = await service.loadMCPConfig();

      expect(config.mcpServers).toHaveProperty('user-server');
      expect(config.mcpServers['user-server'].command).toBe('node');
    });

    it('should load workspace-level configuration', async () => {
      // Create workspace config
      const workspaceConfigPath = path.join(tempDir, '.ollm', 'settings', 'mcp.json');
      fs.mkdirSync(path.dirname(workspaceConfigPath), { recursive: true });
      fs.writeFileSync(
        workspaceConfigPath,
        JSON.stringify({
          mcpServers: {
            'workspace-server': {
              command: 'python',
              args: ['server.py'],
            },
          },
        })
      );

      const config = await service.loadMCPConfig();

      expect(config.mcpServers).toHaveProperty('workspace-server');
      expect(config.mcpServers['workspace-server'].command).toBe('python');
    });

    it('should merge user and workspace configs with workspace taking precedence', async () => {
      // Create separate temp directories for user and workspace
      const userTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-user-'));
      const workspaceTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-workspace-'));

      // Mock os.homedir() to return user temp directory
      vi.spyOn(os, 'homedir').mockReturnValue(userTempDir);
      
      // Mock process.cwd() to return workspace temp directory
      vi.spyOn(process, 'cwd').mockReturnValue(workspaceTempDir);

      // Create new service instance with mocked paths
      const testService = new MCPConfigService();

      // Create user config
      const userConfigPath = path.join(userTempDir, '.ollm', 'settings', 'mcp.json');
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({
          mcpServers: {
            'shared-server': {
              command: 'node',
              args: ['user.js'],
            },
            'user-only': {
              command: 'node',
              args: ['user-only.js'],
            },
          },
        })
      );

      // Create workspace config
      const workspaceConfigPath = path.join(workspaceTempDir, '.ollm', 'settings', 'mcp.json');
      fs.mkdirSync(path.dirname(workspaceConfigPath), { recursive: true });
      fs.writeFileSync(
        workspaceConfigPath,
        JSON.stringify({
          mcpServers: {
            'shared-server': {
              command: 'python',
              args: ['workspace.py'],
            },
            'workspace-only': {
              command: 'python',
              args: ['workspace-only.py'],
            },
          },
        })
      );

      const config = await testService.loadMCPConfig();

      // Workspace config should override user config for shared-server
      expect(config.mcpServers['shared-server'].command).toBe('python');
      expect(config.mcpServers['shared-server'].args).toEqual(['workspace.py']);

      // Both unique servers should be present
      expect(config.mcpServers).toHaveProperty('user-only');
      expect(config.mcpServers).toHaveProperty('workspace-only');

      // Clean up
      fs.rmSync(userTempDir, { recursive: true, force: true });
      fs.rmSync(workspaceTempDir, { recursive: true, force: true });
    });

    it('should handle corrupted JSON gracefully', async () => {
      // Suppress expected error logs during this test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Create corrupted config
      const userConfigPath = path.join(tempDir, '.ollm', 'settings', 'mcp.json');
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(userConfigPath, '{ invalid json }');

      const config = await service.loadMCPConfig();

      // Should return empty config instead of throwing
      expect(config).toEqual({ mcpServers: {} });
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should handle invalid config structure gracefully', async () => {
      // Create config with invalid structure
      const userConfigPath = path.join(tempDir, '.ollm', 'settings', 'mcp.json');
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({
          // Missing mcpServers field
          someOtherField: 'value',
        })
      );

      const config = await service.loadMCPConfig();

      // Should return empty config
      expect(config).toEqual({ mcpServers: {} });
    });
  });

  describe('saveMCPConfig', () => {
    it('should save configuration to user-level file', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      await service.saveMCPConfig(config);

      // Verify file was created
      const userConfigPath = service.getUserConfigPath();
      expect(fs.existsSync(userConfigPath)).toBe(true);

      // Verify content
      const content = fs.readFileSync(userConfigPath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(config);
    });

    it('should create directory if it does not exist', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      await service.saveMCPConfig(config);

      // Verify directory was created
      const userConfigPath = service.getUserConfigPath();
      const dir = path.dirname(userConfigPath);
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('should use atomic write (temp file + rename)', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      await service.saveMCPConfig(config);

      // Verify no temp file remains
      const userConfigPath = service.getUserConfigPath();
      const tempPath = `${userConfigPath}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);
    });

    it('should format JSON with 2-space indentation', async () => {
      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      await service.saveMCPConfig(config);

      // Verify formatting
      const userConfigPath = service.getUserConfigPath();
      const content = fs.readFileSync(userConfigPath, 'utf-8');
      expect(content).toContain('  '); // Should have indentation
      expect(content).toContain('\n'); // Should have newlines
    });

    it('should validate configuration before saving', async () => {
      const invalidConfig = {
        mcpServers: {
          'test-server': {
            // Missing required 'command' field
            args: ['test.js'],
          } as any,
        },
      };

      await expect(service.saveMCPConfig(invalidConfig)).rejects.toThrow();
    });

    it('should overwrite existing configuration', async () => {
      // Save initial config
      const config1 = {
        mcpServers: {
          'server1': {
            command: 'node',
            args: ['server1.js'],
          },
        },
      };
      await service.saveMCPConfig(config1);

      // Save new config
      const config2 = {
        mcpServers: {
          'server2': {
            command: 'python',
            args: ['server2.py'],
          },
        },
      };
      await service.saveMCPConfig(config2);

      // Verify new config replaced old config
      const loaded = await service.loadMCPConfig();
      expect(loaded.mcpServers).toHaveProperty('server2');
      expect(loaded.mcpServers).not.toHaveProperty('server1');
    });
  });

  describe('updateServerConfig', () => {
    it('should update a specific server configuration', async () => {
      // Create initial config
      const initialConfig = {
        mcpServers: {
          'server1': {
            command: 'node',
            args: ['server1.js'],
          },
          'server2': {
            command: 'python',
            args: ['server2.py'],
          },
        },
      };
      await service.saveMCPConfig(initialConfig);

      // Update server1
      const updatedServerConfig: MCPServerConfig = {
        command: 'deno',
        args: ['run', 'server1.ts'],
      };
      await service.updateServerConfig('server1', updatedServerConfig);

      // Verify update
      const loaded = await service.loadMCPConfig();
      expect(loaded.mcpServers['server1'].command).toBe('deno');
      expect(loaded.mcpServers['server1'].args).toEqual(['run', 'server1.ts']);

      // Verify server2 was not affected
      expect(loaded.mcpServers['server2'].command).toBe('python');
    });

    it('should add new server if it does not exist', async () => {
      // Create initial config with one server
      const initialConfig = {
        mcpServers: {
          'server1': {
            command: 'node',
            args: ['server1.js'],
          },
        },
      };
      await service.saveMCPConfig(initialConfig);

      // Add new server
      const newServerConfig: MCPServerConfig = {
        command: 'python',
        args: ['server2.py'],
      };
      await service.updateServerConfig('server2', newServerConfig);

      // Verify both servers exist
      const loaded = await service.loadMCPConfig();
      expect(loaded.mcpServers).toHaveProperty('server1');
      expect(loaded.mcpServers).toHaveProperty('server2');
    });

    it('should validate server configuration before updating', async () => {
      const invalidServerConfig = {
        // Missing required 'command' field
        args: ['test.js'],
      } as any;

      await expect(
        service.updateServerConfig('test-server', invalidServerConfig)
      ).rejects.toThrow();
    });

    it('should use atomic write for updates', async () => {
      // Create initial config
      const initialConfig = {
        mcpServers: {
          'server1': {
            command: 'node',
            args: ['server1.js'],
          },
        },
      };
      await service.saveMCPConfig(initialConfig);

      // Update server
      const updatedServerConfig: MCPServerConfig = {
        command: 'deno',
        args: ['run', 'server1.ts'],
      };
      await service.updateServerConfig('server1', updatedServerConfig);

      // Verify no temp file remains
      const userConfigPath = service.getUserConfigPath();
      const tempPath = `${userConfigPath}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);
    });
  });

  describe('removeServerConfig', () => {
    it('should remove a server from configuration', async () => {
      // Create initial config
      const initialConfig = {
        mcpServers: {
          'server1': {
            command: 'node',
            args: ['server1.js'],
          },
          'server2': {
            command: 'python',
            args: ['server2.py'],
          },
        },
      };
      await service.saveMCPConfig(initialConfig);

      // Remove server1
      await service.removeServerConfig('server1');

      // Verify server1 was removed
      const loaded = await service.loadMCPConfig();
      expect(loaded.mcpServers).not.toHaveProperty('server1');
      expect(loaded.mcpServers).toHaveProperty('server2');
    });

    it('should not throw if server does not exist', async () => {
      // Create initial config
      const initialConfig = {
        mcpServers: {
          'server1': {
            command: 'node',
            args: ['server1.js'],
          },
        },
      };
      await service.saveMCPConfig(initialConfig);

      // Remove non-existent server (should not throw)
      await expect(
        service.removeServerConfig('non-existent')
      ).resolves.not.toThrow();
    });
  });

  describe('file watching', () => {
    it('should start and stop watching', () => {
      expect(() => service.startWatching()).not.toThrow();
      expect(() => service.stopWatching()).not.toThrow();
    });

    it('should not start watching twice', () => {
      service.startWatching();
      service.startWatching(); // Should be no-op

      // Should be able to stop once
      service.stopWatching();
    });

    it('should notify listeners when config file changes', async () => {
      // Create initial config
      const userConfigPath = service.getUserConfigPath();
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({ mcpServers: {} })
      );

      // Add listener
      const listener = vi.fn();
      service.addChangeListener(listener);

      // Start watching
      service.startWatching();

      // Wait a bit for watcher to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      // Modify config file
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({
          mcpServers: {
            'new-server': {
              command: 'node',
              args: ['test.js'],
            },
          },
        })
      );

      // Wait for file watcher to detect change (with debounce)
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify listener was called
      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'user',
          path: userConfigPath,
        })
      );
    });

    it('should remove listeners', async () => {
      const listener = vi.fn();
      service.addChangeListener(listener);
      service.removeChangeListener(listener);

      // Create and modify config
      const userConfigPath = service.getUserConfigPath();
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({ mcpServers: {} })
      );

      service.startWatching();
      await new Promise(resolve => setTimeout(resolve, 100));

      fs.writeFileSync(
        userConfigPath,
        JSON.stringify({
          mcpServers: {
            'new-server': {
              command: 'node',
              args: ['test.js'],
            },
          },
        })
      );

      await new Promise(resolve => setTimeout(resolve, 200));

      // Listener should not have been called
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('path getters', () => {
    it('should return user config path', () => {
      const userPath = service.getUserConfigPath();
      expect(userPath).toContain('.ollm');
      expect(userPath).toContain('settings');
      expect(userPath).toContain('mcp.json');
    });

    it('should return workspace config path', () => {
      const workspacePath = service.getWorkspaceConfigPath();
      expect(workspacePath).toContain('.ollm');
      expect(workspacePath).toContain('settings');
      expect(workspacePath).toContain('mcp.json');
    });
  });

  describe('error handling', () => {
    it('should handle write errors gracefully', async () => {
      // Mock fs.promises.writeFile to throw an error
      const originalWriteFile = fs.promises.writeFile;
      vi.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(
        new Error('EACCES: permission denied')
      );

      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      await expect(service.saveMCPConfig(config)).rejects.toThrow();

      // Restore original function
      vi.spyOn(fs.promises, 'writeFile').mockImplementation(originalWriteFile);
    });

    it('should clean up temp file on write failure', async () => {
      // Create initial config
      const userConfigPath = service.getUserConfigPath();
      fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
      fs.writeFileSync(userConfigPath, JSON.stringify({ mcpServers: {} }));

      // Make file read-only to force write error
      fs.chmodSync(userConfigPath, 0o444);

      const config = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      await expect(service.saveMCPConfig(config)).rejects.toThrow();

      // Verify temp file was cleaned up
      const tempPath = `${userConfigPath}.tmp`;
      expect(fs.existsSync(tempPath)).toBe(false);

      // Clean up
      fs.chmodSync(userConfigPath, 0o644);
    });
  });
});
