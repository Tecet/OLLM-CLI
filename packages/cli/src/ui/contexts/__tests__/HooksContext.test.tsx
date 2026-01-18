/**
 * Tests for HooksContext
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React, { useEffect } from 'react';
import { render } from 'ink-testing-library';
import { HooksProvider, useHooks } from '../HooksContext.js';
import { HookRegistry } from '@ollm/ollm-cli-core/hooks/hookRegistry.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import { SettingsService } from '../../../config/settingsService.js';
import { Text } from 'ink';

// Mock SettingsService
vi.mock('../../../config/settingsService.js', () => {
  const mockSettings = {
    hooks: {
      enabled: {} as Record<string, boolean>,
    },
  };

  return {
    SettingsService: {
      getInstance: vi.fn(() => ({
        getHookSettings: vi.fn(() => mockSettings.hooks),
        setHookEnabled: vi.fn((hookId: string, enabled: boolean) => {
          mockSettings.hooks.enabled[hookId] = enabled;
        }),
        removeHookSetting: vi.fn((hookId: string) => {
          delete mockSettings.hooks.enabled[hookId];
        }),
      })),
    },
  };
});

describe('HooksContext', () => {
  let hookRegistry: HookRegistry;
  let settingsService: ReturnType<typeof SettingsService.getInstance>;

  beforeEach(() => {
    hookRegistry = new HookRegistry();
    settingsService = SettingsService.getInstance();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  // Helper component to test the hook
  const TestComponent = ({ onRender }: { onRender: (value: ReturnType<typeof useHooks>) => void }) => {
    const hooks = useHooks();
    
    useEffect(() => {
      onRender(hooks);
    }, [hooks, onRender]);

    return <Text>Test</Text>;
  };

  it('should initialize with empty state', async () => {
    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.state.isLoading).toBe(false);
    expect(capturedValue!.state.categories).toEqual([]);
    expect(capturedValue!.state.allHooks).toEqual([]);
    expect(capturedValue!.state.enabledHooks.size).toBe(0);
    expect(capturedValue!.state.error).toBeNull();
  });

  it('should load hooks from registry', async () => {
    // Register test hooks
    const hook1: Hook = {
      id: 'test-hook-1',
      name: 'Test Hook 1',
      command: 'echo "test1"',
      source: 'user',
    };

    const hook2: Hook = {
      id: 'test-hook-2',
      name: 'Test Hook 2',
      command: 'echo "test2"',
      source: 'builtin',
    };

    hookRegistry.registerHook('session_start', hook1);
    hookRegistry.registerHook('session_end', hook2);

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.state.allHooks).toHaveLength(2);
    expect(capturedValue!.state.allHooks).toContainEqual(hook1);
    expect(capturedValue!.state.allHooks).toContainEqual(hook2);
  });

  it('should categorize hooks by event type', async () => {
    const sessionHook: Hook = {
      id: 'session-hook',
      name: 'Session Hook',
      command: 'echo "session"',
      source: 'user',
    };

    const toolHook: Hook = {
      id: 'tool-hook',
      name: 'Tool Hook',
      command: 'echo "tool"',
      source: 'builtin',
    };

    hookRegistry.registerHook('session_start', sessionHook);
    hookRegistry.registerHook('before_tool', toolHook);

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.state.categories).toHaveLength(2);
    
    const sessionCategory = capturedValue!.state.categories.find(c => c.name === 'Session Events');
    expect(sessionCategory).toBeDefined();
    expect(sessionCategory?.hooks).toContainEqual(sessionHook);

    const toolCategory = capturedValue!.state.categories.find(c => c.name === 'Tool Events');
    expect(toolCategory).toBeDefined();
    expect(toolCategory?.hooks).toContainEqual(toolHook);
  });

  it('should load enabled state from settings', async () => {
    const hook1: Hook = {
      id: 'enabled-hook',
      name: 'Enabled Hook',
      command: 'echo "enabled"',
      source: 'user',
    };

    const hook2: Hook = {
      id: 'disabled-hook',
      name: 'Disabled Hook',
      command: 'echo "disabled"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook1);
    hookRegistry.registerHook('session_start', hook2);

    // Mock settings to have hook1 enabled and hook2 disabled
    vi.mocked(settingsService.getHookSettings).mockReturnValue({
      enabled: {
        'enabled-hook': true,
        'disabled-hook': false,
      },
    });

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.state.enabledHooks.has('enabled-hook')).toBe(true);
    expect(capturedValue!.state.enabledHooks.has('disabled-hook')).toBe(false);
  });

  it('should default hooks to enabled if not in settings', async () => {
    const hook: Hook = {
      id: 'new-hook',
      name: 'New Hook',
      command: 'echo "new"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    // Mock settings with no entry for this hook
    vi.mocked(settingsService.getHookSettings).mockReturnValue({
      enabled: {},
    });

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    // Should default to enabled
    expect(capturedValue!.state.enabledHooks.has('new-hook')).toBe(true);
  });

  it('should toggle hook enabled state', async () => {
    const hook: Hook = {
      id: 'toggle-hook',
      name: 'Toggle Hook',
      command: 'echo "toggle"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    // Initially enabled (default)
    expect(capturedValue!.state.enabledHooks.has('toggle-hook')).toBe(true);

    // Toggle to disabled
    await capturedValue!.toggleHook('toggle-hook');
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(capturedValue!.state.enabledHooks.has('toggle-hook')).toBe(false);
    expect(settingsService.setHookEnabled).toHaveBeenCalledWith('toggle-hook', false);

    // Toggle back to enabled
    await capturedValue!.toggleHook('toggle-hook');
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(capturedValue!.state.enabledHooks.has('toggle-hook')).toBe(true);
    expect(settingsService.setHookEnabled).toHaveBeenCalledWith('toggle-hook', true);
  });

  it('should check if hook is enabled', async () => {
    const hook: Hook = {
      id: 'check-hook',
      name: 'Check Hook',
      command: 'echo "check"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    vi.mocked(settingsService.getHookSettings).mockReturnValue({
      enabled: {
        'check-hook': true,
      },
    });

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.isHookEnabled('check-hook')).toBe(true);
    expect(capturedValue!.isHookEnabled('non-existent')).toBe(false);
  });

  it('should get hook by ID', async () => {
    const hook: Hook = {
      id: 'get-hook',
      name: 'Get Hook',
      command: 'echo "get"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    const retrieved = capturedValue!.getHook('get-hook');
    expect(retrieved).toEqual(hook);

    const notFound = capturedValue!.getHook('non-existent');
    expect(notFound).toBeUndefined();
  });

  it('should handle corrupted hooks gracefully', async () => {
    // Register a hook with missing required fields
    const corruptedHook = {
      id: 'corrupted',
      // Missing name and command
    } as Hook;

    hookRegistry.registerHook('session_start', corruptedHook);

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    // Should not crash, but should track the corrupted hook
    expect(capturedValue!.state.corruptedHooks).toHaveLength(1);
    expect(capturedValue!.state.corruptedHooks[0].id).toBe('corrupted');
    expect(capturedValue!.state.allHooks).toHaveLength(0);
  });

  it('should refresh hooks on demand', async () => {
    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.state.allHooks).toHaveLength(0);

    // Add a hook after initial load
    const newHook: Hook = {
      id: 'new-hook',
      name: 'New Hook',
      command: 'echo "new"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', newHook);

    // Refresh
    await capturedValue!.refreshHooks();
    
    // Wait for state update
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(capturedValue!.state.allHooks).toHaveLength(1);
    expect(capturedValue!.state.allHooks[0]).toEqual(newHook);
  });

  it('should handle errors during hook loading', async () => {
    // Mock getAllHooks to throw an error
    vi.spyOn(hookRegistry, 'getAllHooks').mockImplementation(() => {
      throw new Error('Registry error');
    });

    let capturedValue: ReturnType<typeof useHooks> | null = null;

    render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <TestComponent onRender={(value) => { capturedValue = value; }} />
      </HooksProvider>
    );

    // Wait for async initialization
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(capturedValue).not.toBeNull();
    expect(capturedValue!.state.error).toBe('Registry error');
    expect(capturedValue!.state.allHooks).toEqual([]);
  });
});
