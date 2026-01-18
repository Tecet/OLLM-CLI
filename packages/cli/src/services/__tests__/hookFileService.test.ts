import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { HookFileService } from '../hookFileService.js';
import type { UIHook } from '../../features/hooks/types.js';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    promises: {
      readdir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
    },
  },
}));

describe('HookFileService', () => {
  let service: HookFileService;
  const mockUserHooksDir = path.join(os.homedir(), '.ollm', 'hooks');
  const mockWorkspaceHooksDir = path.join(process.cwd(), '.ollm', 'hooks');

  beforeEach(() => {
    service = new HookFileService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadUserHooks', () => {
    it('should return empty array if directory does not exist', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const hooks = await service.loadUserHooks();

      expect(hooks).toEqual([]);
      expect(fs.existsSync).toHaveBeenCalledWith(mockUserHooksDir);
    });

    it('should load valid hooks from user directory', async () => {
      const mockHookData = {
        name: 'Test Hook',
        version: '1.0.0',
        description: 'A test hook',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue(['test-hook.json'] as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(mockHookData));

      const hooks = await service.loadUserHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toMatchObject({
        id: 'test-hook',
        name: 'Test Hook',
        source: 'user',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
      });
    });

    it('should skip invalid hook files', async () => {
      const invalidHookData = {
        name: 'Invalid Hook',
        // Missing required 'when' field
        then: {
          type: 'askAgent',
          prompt: 'Test',
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue(['invalid-hook.json'] as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(invalidHookData));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const hooks = await service.loadUserHooks();

      expect(hooks).toEqual([]);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle JSON parsing errors gracefully', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue(['malformed.json'] as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue('{ invalid json }');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const hooks = await service.loadUserHooks();

      expect(hooks).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('loadWorkspaceHooks', () => {
    it('should load hooks from workspace directory', async () => {
      const mockHookData = {
        name: 'Workspace Hook',
        version: '1.0.0',
        when: {
          type: 'promptSubmit',
        },
        then: {
          type: 'runCommand',
          command: 'npm test',
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValue(['workspace-hook.json'] as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(mockHookData));

      const hooks = await service.loadWorkspaceHooks();

      expect(hooks).toHaveLength(1);
      expect(hooks[0]).toMatchObject({
        id: 'workspace-hook',
        name: 'Workspace Hook',
        source: 'workspace',
      });
    });
  });

  describe('saveHook', () => {
    it('should save hook to user directory', async () => {
      const mockHook: UIHook = {
        id: 'new-hook',
        name: 'New Hook',
        version: '1.0.0',
        description: 'A new hook',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review changes',
        },
        enabled: true,
        trusted: false,
        source: 'user',
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await service.saveHook(mockHook);

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(mockUserHooksDir, 'new-hook.json'),
        expect.stringContaining('"name": "New Hook"'),
        'utf-8'
      );
    });

    it('should create directory if it does not exist', async () => {
      const mockHook: UIHook = {
        id: 'new-hook',
        name: 'New Hook',
        version: '1.0.0',
        when: {
          type: 'userTriggered',
        },
        then: {
          type: 'askAgent',
          prompt: 'Test',
        },
        enabled: true,
        trusted: false,
        source: 'user',
      };

      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await service.saveHook(mockHook);

      expect(fs.promises.mkdir).toHaveBeenCalledWith(mockUserHooksDir, { recursive: true });
    });
  });

  describe('updateHook', () => {
    it('should update existing hook', async () => {
      const existingHookData = {
        name: 'Old Name',
        version: '1.0.0',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Old prompt',
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingHookData));
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await service.updateHook('test-hook', {
        name: 'New Name',
        then: {
          type: 'askAgent',
          prompt: 'New prompt',
        },
      });

      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        path.join(mockUserHooksDir, 'test-hook.json'),
        expect.stringContaining('"name": "New Name"'),
        'utf-8'
      );
    });

    it('should throw error if hook file not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(service.updateHook('nonexistent', { name: 'Test' })).rejects.toThrow(
        'Hook file not found: nonexistent'
      );
    });

    it('should validate updated hook data', async () => {
      const existingHookData = {
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Test',
        },
      };

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(existingHookData));

      // Try to update with invalid data (remove required prompt)
      await expect(
        service.updateHook('test-hook', {
          then: {
            type: 'askAgent',
            prompt: '', // Invalid: empty prompt
          },
        })
      ).rejects.toThrow('Invalid hook data');
    });
  });

  describe('deleteHook', () => {
    it('should delete hook file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.unlink).mockResolvedValue(undefined);

      await service.deleteHook('test-hook');

      expect(fs.promises.unlink).toHaveBeenCalledWith(
        path.join(mockUserHooksDir, 'test-hook.json')
      );
    });

    it('should throw error if hook file not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(service.deleteHook('nonexistent')).rejects.toThrow(
        'Hook file not found: nonexistent'
      );
    });
  });

  describe('validateHook', () => {
    it('should validate valid hook', () => {
      const validHook = {
        name: 'Valid Hook',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Test prompt',
        },
      };

      const result = service.validateHook(validHook);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject hook with missing name', () => {
      const invalidHook = {
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Test',
        },
      };

      const result = service.validateHook(invalidHook);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing or invalid required field: name');
    });

    it('should reject hook with invalid event type', () => {
      const invalidHook = {
        name: 'Test',
        when: {
          type: 'invalidType',
        },
        then: {
          type: 'askAgent',
          prompt: 'Test',
        },
      };

      const result = service.validateHook(invalidHook);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid event type: invalidType');
    });

    it('should require patterns for file events', () => {
      const invalidHook = {
        name: 'Test',
        when: {
          type: 'fileEdited',
          // Missing patterns
        },
        then: {
          type: 'askAgent',
          prompt: 'Test',
        },
      };

      const result = service.validateHook(invalidHook);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File event types require at least one pattern');
    });

    it('should require prompt for askAgent action', () => {
      const invalidHook = {
        name: 'Test',
        when: {
          type: 'userTriggered',
        },
        then: {
          type: 'askAgent',
          // Missing prompt
        },
      };

      const result = service.validateHook(invalidHook);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('askAgent action requires a prompt');
    });

    it('should require command for runCommand action', () => {
      const invalidHook = {
        name: 'Test',
        when: {
          type: 'userTriggered',
        },
        then: {
          type: 'runCommand',
          // Missing command
        },
      };

      const result = service.validateHook(invalidHook);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('runCommand action requires a command');
    });
  });

  describe('getUserHooksDir', () => {
    it('should return user hooks directory path', () => {
      const dir = service.getUserHooksDir();
      expect(dir).toBe(mockUserHooksDir);
    });
  });

  describe('getWorkspaceHooksDir', () => {
    it('should return workspace hooks directory path', () => {
      const dir = service.getWorkspaceHooksDir();
      expect(dir).toBe(mockWorkspaceHooksDir);
    });
  });
});
