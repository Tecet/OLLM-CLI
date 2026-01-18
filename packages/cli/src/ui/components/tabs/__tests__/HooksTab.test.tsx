/**
 * Tests for HooksTab component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { HooksTab } from '../HooksTab.js';
import { HooksProvider } from '../../../contexts/HooksContext.js';
import { HookRegistry } from '@ollm/ollm-cli-core/hooks/hookRegistry.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import { SettingsService } from '../../../../config/settingsService.js';

// Mock dependencies
vi.mock('../../../../features/context/UIContext.js', () => ({
  useUI: () => ({
    state: {
      theme: {
        text: {
          primary: 'white',
          secondary: 'gray',
        },
        border: {
          primary: 'gray',
          active: 'yellow',
        },
        status: {
          success: 'green',
          error: 'red',
          warning: 'yellow',
        },
      },
    },
  }),
}));

vi.mock('../../../../features/context/FocusContext.js', () => ({
  useFocusManager: () => ({
    isFocused: () => true,
    exitToNavBar: vi.fn(),
  }),
}));

vi.mock('../../../../config/settingsService.js', () => {
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

describe('HooksTab', () => {
  let hookRegistry: HookRegistry;
  let settingsService: ReturnType<typeof SettingsService.getInstance>;

  beforeEach(() => {
    hookRegistry = new HookRegistry();
    settingsService = SettingsService.getInstance();
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    expect(lastFrame()).toContain('Loading hooks');
  });

  it('should render empty state when no hooks available', async () => {
    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(lastFrame()).toContain('No hooks available');
  });

  it('should render hooks organized by category', async () => {
    // Register test hooks
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

    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const frame = lastFrame();
    expect(frame).toContain('Session Events');
    expect(frame).toContain('Tool Events');
    expect(frame).toContain('Session Hook');
    expect(frame).toContain('Tool Hook');
  });

  it('should show enabled/disabled indicators', async () => {
    const hook: Hook = {
      id: 'test-hook',
      name: 'Test Hook',
      command: 'echo "test"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    // Mock hook as enabled
    vi.mocked(settingsService.getHookSettings).mockReturnValue({
      enabled: {
        'test-hook': true,
      },
    });

    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const frame = lastFrame();
    // Should show enabled indicator (●)
    expect(frame).toContain('●');
    expect(frame).toContain('Test Hook');
  });

  it('should display hook details in right panel', async () => {
    const hook: Hook = {
      id: 'detail-hook',
      name: 'Detail Hook',
      command: 'echo "details"',
      args: ['arg1', 'arg2'],
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const frame = lastFrame();
    expect(frame).toContain('Detail Hook');
    expect(frame).toContain('detail-hook');
    expect(frame).toContain('echo "details"');
    expect(frame).toContain('arg1 arg2');
  });

  it('should show Exit item at top of list when hooks are present', async () => {
    // Register a test hook so the full UI is shown
    const hook: Hook = {
      id: 'test-hook',
      name: 'Test Hook',
      command: 'echo "test"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const frame = lastFrame();
    expect(frame).toContain('Exit');
  });

  it('should display keyboard shortcuts in header when hooks are present', async () => {
    // Register a test hook so the full UI is shown
    const hook: Hook = {
      id: 'test-hook',
      name: 'Test Hook',
      command: 'echo "test"',
      source: 'user',
    };

    hookRegistry.registerHook('session_start', hook);

    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const frame = lastFrame();
    expect(frame).toContain('↑↓:Nav');
    expect(frame).toContain('Enter:Toggle');
    expect(frame).toContain('A:Add');
    expect(frame).toContain('E:Edit');
    expect(frame).toContain('D:Del');
    expect(frame).toContain('T:Test');
    expect(frame).toContain('0/Esc:Exit');
  });

  it('should show corrupted hooks warning', async () => {
    // Register a corrupted hook
    const corruptedHook = {
      id: 'corrupted',
      // Missing required fields
    } as Hook;

    hookRegistry.registerHook('session_start', corruptedHook);

    const { lastFrame } = render(
      <HooksProvider hookRegistry={hookRegistry} settingsService={settingsService}>
        <HooksTab />
      </HooksProvider>
    );

    // Wait for loading to complete
    await new Promise(resolve => setTimeout(resolve, 150));

    const frame = lastFrame();
    expect(frame).toContain('corrupted hook');
  });
});
