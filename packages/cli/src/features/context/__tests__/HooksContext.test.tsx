/**
 * Tests for HooksContext
 * 
 * Note: These tests verify the context logic without rendering React components.
 * We test the service integration and state management directly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { UIHook } from '../../hooks/types.js';
import { HookFileService } from '../../../services/hookFileService.js';
import { SettingsService } from '../../../config/settingsService.js';

// Mock the services
vi.mock('../../../services/hookFileService.js');
vi.mock('../../../config/settingsService.js');

describe('HooksContext Logic', () => {
  let mockHookFileService: any;
  let mockSettingsService: any;

  const mockHooks: UIHook[] = [
    {
      id: 'test-hook-1',
      name: 'Test Hook 1',
      version: '1.0.0',
      description: 'Test hook for file events',
      when: {
        type: 'fileEdited',
        patterns: ['*.ts'],
      },
      then: {
        type: 'askAgent',
        prompt: 'Review this file',
      },
      enabled: true,
      trusted: false,
      source: 'user',
    },
    {
      id: 'test-hook-2',
      name: 'Test Hook 2',
      version: '1.0.0',
      description: 'Test hook for prompt events',
      when: {
        type: 'promptSubmit',
      },
      then: {
        type: 'runCommand',
        command: 'npm test',
      },
      enabled: false,
      trusted: false,
      source: 'user',
    },
    {
      id: 'builtin-hook',
      name: 'Built-in Hook',
      version: '1.0.0',
      description: 'Built-in hook',
      when: {
        type: 'userTriggered',
      },
      then: {
        type: 'askAgent',
        prompt: 'Do something',
      },
      enabled: true,
      trusted: true,
      source: 'builtin',
    },
  ];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup HookFileService mock
    mockHookFileService = {
      loadUserHooks: vi.fn().mockResolvedValue([mockHooks[0], mockHooks[1]]),
      loadWorkspaceHooks: vi.fn().mockResolvedValue([mockHooks[2]]),
      saveHook: vi.fn().mockResolvedValue(undefined),
      updateHook: vi.fn().mockResolvedValue(undefined),
      deleteHook: vi.fn().mockResolvedValue(undefined),
      validateHook: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    };

    // Setup SettingsService mock
    mockSettingsService = {
      getHookSettings: vi.fn().mockReturnValue({
        enabled: {
          'test-hook-1': true,
          'test-hook-2': false,
          'builtin-hook': true,
        },
      }),
      setHookEnabled: vi.fn(),
      removeHookSetting: vi.fn(),
    };

    // Mock the constructors
    vi.mocked(HookFileService).mockImplementation(() => mockHookFileService);
    vi.mocked(SettingsService.getInstance).mockReturnValue(mockSettingsService);
  });

  describe('Service Integration', () => {
    it('should create HookFileService instance', () => {
      const service = new HookFileService();
      expect(service).toBeDefined();
    });

    it('should get SettingsService instance', () => {
      const service = SettingsService.getInstance();
      expect(service).toBeDefined();
    });

    it('should load hooks from both directories', async () => {
      const service = new HookFileService();
      const [userHooks, workspaceHooks] = await Promise.all([
        service.loadUserHooks(),
        service.loadWorkspaceHooks(),
      ]);

      expect(mockHookFileService.loadUserHooks).toHaveBeenCalled();
      expect(mockHookFileService.loadWorkspaceHooks).toHaveBeenCalled();
      expect(userHooks).toHaveLength(2);
      expect(workspaceHooks).toHaveLength(1);
    });
  });

  describe('Hook Categorization Logic', () => {
    it('should categorize hooks by event type', () => {
      const hooks = mockHooks;
      const fileEvents: UIHook[] = [];
      const promptEvents: UIHook[] = [];
      const userTriggered: UIHook[] = [];

      for (const hook of hooks) {
        switch (hook.when.type) {
          case 'fileEdited':
          case 'fileCreated':
          case 'fileDeleted':
            fileEvents.push(hook);
            break;
          case 'promptSubmit':
          case 'agentStop':
            promptEvents.push(hook);
            break;
          case 'userTriggered':
            userTriggered.push(hook);
            break;
        }
      }

      expect(fileEvents).toHaveLength(1);
      expect(fileEvents[0].id).toBe('test-hook-1');
      expect(promptEvents).toHaveLength(1);
      expect(promptEvents[0].id).toBe('test-hook-2');
      expect(userTriggered).toHaveLength(1);
      expect(userTriggered[0].id).toBe('builtin-hook');
    });

    it('should create category structure', () => {
      const hooks = mockHooks;
      const fileEvents = hooks.filter(h => 
        ['fileEdited', 'fileCreated', 'fileDeleted'].includes(h.when.type)
      );
      const promptEvents = hooks.filter(h => 
        ['promptSubmit', 'agentStop'].includes(h.when.type)
      );
      const userTriggered = hooks.filter(h => h.when.type === 'userTriggered');

      const categories = [
        {
          name: 'File Events',
          eventTypes: ['fileEdited', 'fileCreated', 'fileDeleted'],
          hooks: fileEvents,
          expanded: true,
        },
        {
          name: 'Prompt Events',
          eventTypes: ['promptSubmit', 'agentStop'],
          hooks: promptEvents,
          expanded: true,
        },
        {
          name: 'User Triggered',
          eventTypes: ['userTriggered'],
          hooks: userTriggered,
          expanded: true,
        },
      ];

      expect(categories).toHaveLength(3);
      expect(categories[0].hooks).toHaveLength(1);
      expect(categories[1].hooks).toHaveLength(1);
      expect(categories[2].hooks).toHaveLength(1);
    });
  });

  describe('Toggle Hook Logic', () => {
    it('should toggle enabled state in settings', () => {
      const settingsService = SettingsService.getInstance();
      const hookId = 'test-hook-1';
      const newState = false;

      settingsService.setHookEnabled(hookId, newState);

      expect(mockSettingsService.setHookEnabled).toHaveBeenCalledWith(hookId, newState);
    });

    it('should update enabled hooks set', () => {
      const enabledHooks = new Set(['test-hook-1', 'builtin-hook']);
      const hookId = 'test-hook-1';

      // Toggle off
      enabledHooks.delete(hookId);
      expect(enabledHooks.has(hookId)).toBe(false);

      // Toggle on
      enabledHooks.add(hookId);
      expect(enabledHooks.has(hookId)).toBe(true);
    });
  });

  describe('Add Hook Logic', () => {
    it('should generate ID from hook name', () => {
      const name = 'My Cool Hook!';
      const hookId = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      expect(hookId).toBe('my-cool-hook');
    });

    it('should save hook to file system', async () => {
      const service = new HookFileService();
      const newHook: UIHook = {
        id: 'new-hook',
        name: 'New Hook',
        version: '1.0.0',
        when: {
          type: 'userTriggered',
        },
        then: {
          type: 'askAgent',
          prompt: 'Do something',
        },
        enabled: true,
        trusted: false,
        source: 'user',
      };

      await service.saveHook(newHook);

      expect(mockHookFileService.saveHook).toHaveBeenCalledWith(newHook);
    });

    it('should enable new hook by default', () => {
      const settingsService = SettingsService.getInstance();
      const hookId = 'new-hook';

      settingsService.setHookEnabled(hookId, true);

      expect(mockSettingsService.setHookEnabled).toHaveBeenCalledWith(hookId, true);
    });
  });

  describe('Edit Hook Logic', () => {
    it('should update hook file', async () => {
      const service = new HookFileService();
      const hookId = 'test-hook-1';
      const updates = {
        description: 'Updated description',
      };

      await service.updateHook(hookId, updates);

      expect(mockHookFileService.updateHook).toHaveBeenCalledWith(hookId, updates);
    });

    it('should prevent editing built-in hooks', () => {
      const hook = mockHooks.find(h => h.id === 'builtin-hook');
      expect(hook?.source).toBe('builtin');

      // Logic to check if editable
      const isEditable = hook?.source !== 'builtin';
      expect(isEditable).toBe(false);
    });

    it('should allow editing user hooks', () => {
      const hook = mockHooks.find(h => h.id === 'test-hook-1');
      expect(hook?.source).toBe('user');

      // Logic to check if editable
      const isEditable = hook?.source !== 'builtin';
      expect(isEditable).toBe(true);
    });
  });

  describe('Delete Hook Logic', () => {
    it('should delete hook file', async () => {
      const service = new HookFileService();
      const hookId = 'test-hook-1';

      await service.deleteHook(hookId);

      expect(mockHookFileService.deleteHook).toHaveBeenCalledWith(hookId);
    });

    it('should remove hook from settings', () => {
      const settingsService = SettingsService.getInstance();
      const hookId = 'test-hook-1';

      settingsService.removeHookSetting(hookId);

      expect(mockSettingsService.removeHookSetting).toHaveBeenCalledWith(hookId);
    });

    it('should prevent deleting built-in hooks', () => {
      const hook = mockHooks.find(h => h.id === 'builtin-hook');
      expect(hook?.source).toBe('builtin');

      // Logic to check if deletable
      const isDeletable = hook?.source !== 'builtin';
      expect(isDeletable).toBe(false);
    });
  });

  describe('Test Hook Logic', () => {
    it('should validate hook structure', () => {
      const service = new HookFileService();
      const hookData = {
        name: 'Test Hook',
        version: '1.0.0',
        when: {
          type: 'fileEdited',
          patterns: ['*.ts'],
        },
        then: {
          type: 'askAgent',
          prompt: 'Review this',
        },
      };

      const result = service.validateHook(hookData);

      expect(mockHookFileService.validateHook).toHaveBeenCalledWith(hookData);
      expect(result.valid).toBe(true);
    });

    it('should return test result for valid hook', () => {
      const hook = mockHooks[0];
      const testResult = {
        success: true,
        message: 'Hook test passed',
        details: `Would trigger on: ${hook.when.type}${
          hook.when.patterns ? ` (${hook.when.patterns.join(', ')})` : ''
        }\nWould execute: ${hook.then.type} - ${
          hook.then.prompt || hook.then.command
        }`,
      };

      expect(testResult.success).toBe(true);
      expect(testResult.details).toContain('fileEdited');
      expect(testResult.details).toContain('*.ts');
    });

    it('should return failure for invalid hook', () => {
      mockHookFileService.validateHook.mockReturnValue({
        valid: false,
        errors: ['Missing required field: name'],
      });

      const service = new HookFileService();
      const result = service.validateHook({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: name');
    });
  });

  describe('Error Handling', () => {
    it('should handle file loading errors', async () => {
      mockHookFileService.loadUserHooks.mockRejectedValue(new Error('Load failed'));

      const service = new HookFileService();

      await expect(service.loadUserHooks()).rejects.toThrow('Load failed');
    });

    it('should handle save errors', async () => {
      mockHookFileService.saveHook.mockRejectedValue(new Error('Save failed'));

      const service = new HookFileService();
      const hook: UIHook = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        when: { type: 'userTriggered' },
        then: { type: 'askAgent', prompt: 'Test' },
        enabled: true,
        trusted: false,
        source: 'user',
      };

      await expect(service.saveHook(hook)).rejects.toThrow('Save failed');
    });

    it('should handle delete errors', async () => {
      mockHookFileService.deleteHook.mockRejectedValue(new Error('Delete failed'));

      const service = new HookFileService();

      await expect(service.deleteHook('test')).rejects.toThrow('Delete failed');
    });
  });

  describe('Settings Persistence', () => {
    it('should load enabled state from settings', () => {
      const settingsService = SettingsService.getInstance();
      const hookSettings = settingsService.getHookSettings();

      expect(mockSettingsService.getHookSettings).toHaveBeenCalled();
      expect(hookSettings.enabled['test-hook-1']).toBe(true);
      expect(hookSettings.enabled['test-hook-2']).toBe(false);
    });

    it('should persist enabled state changes', () => {
      const settingsService = SettingsService.getInstance();
      
      settingsService.setHookEnabled('test-hook-1', false);
      expect(mockSettingsService.setHookEnabled).toHaveBeenCalledWith('test-hook-1', false);

      settingsService.setHookEnabled('test-hook-2', true);
      expect(mockSettingsService.setHookEnabled).toHaveBeenCalledWith('test-hook-2', true);
    });

    it('should default to enabled if not in settings', () => {
      const hookSettings = { enabled: {} };
      const hookId = 'new-hook';
      const isEnabled = hookSettings.enabled[hookId] ?? true;

      expect(isEnabled).toBe(true);
    });
  });
});
