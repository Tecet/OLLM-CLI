import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ToolsPanel } from '../ToolsPanel.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { FocusProvider } from '../../../../features/context/FocusContext.js';
import { defaultDarkTheme } from '../../../../config/styles.js';

// Mock SettingsService
vi.mock('../../../../config/settingsService.js', () => ({
  SettingsService: {
    getInstance: vi.fn(() => ({
      getToolState: vi.fn(() => true),
      setToolState: vi.fn(),
    })),
  },
}));

describe('ToolsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <UIProvider initialTheme={defaultDarkTheme}>
          <ToolsPanel modelSupportsTools={true} />
        </UIProvider>
      </FocusProvider>
    );

    const output = lastFrame();
    expect(output).toBeTruthy();
    expect(output).toContain('Tools Configuration');
  });

  it('should show warning when model does not support tools', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <UIProvider initialTheme={defaultDarkTheme}>
          <ToolsPanel modelSupportsTools={false} />
        </UIProvider>
      </FocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('Model doesn\'t support tools');
    expect(output).toContain('The current model does not support function calling');
  });

  it('should display enabled and disabled counts', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <UIProvider initialTheme={defaultDarkTheme}>
          <ToolsPanel modelSupportsTools={true} />
        </UIProvider>
      </FocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('Enabled:');
    expect(output).toContain('Disabled:');
  });

  it('should display help footer with keyboard shortcuts', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <UIProvider initialTheme={defaultDarkTheme}>
          <ToolsPanel modelSupportsTools={true} />
        </UIProvider>
      </FocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('Navigate');
    expect(output).toContain('Toggle');
  });

  it('should display all tool categories', () => {
    const { lastFrame } = render(
      <FocusProvider>
        <UIProvider initialTheme={defaultDarkTheme}>
          <ToolsPanel modelSupportsTools={true} windowSize={30} />
        </UIProvider>
      </FocusProvider>
    );

    const output = lastFrame();
    expect(output).toContain('File Operations');
    expect(output).toContain('File Discovery');
    expect(output).toContain('Shell');
    expect(output).toContain('Web');
    expect(output).toContain('Memory');
    expect(output).toContain('Context');
  });
});
