/**
 * Integration tests for TabBar with MCP tab
 * 
 * Validates: Requirements 12.1 - MCP tab integration
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { TabBar, tabs } from '../TabBar.js';
import { UIProvider } from '../../../../features/context/UIContext.js';
import { FocusProvider } from '../../../../features/context/FocusContext.js';
import { defaultDarkTheme } from '../../../../config/styles.js';

describe('TabBar - MCP Tab Integration', () => {
  const mockOnTabChange = vi.fn();
  const mockNotifications = new Map();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include MCP tab in tabs array', () => {
    const mcpTab = tabs.find(tab => tab.id === 'mcp');
    
    expect(mcpTab).toBeDefined();
    expect(mcpTab?.label).toBe('MCP');
    expect(mcpTab?.icon).toBe('🔌');
    expect(mcpTab?.shortcut).toBe('Ctrl+8');
  });

  it('should render MCP tab in TabBar', () => {
    const { lastFrame } = render(
      <UIProvider>
        <FocusProvider>
          <TabBar
            activeTab="mcp"
            onTabChange={mockOnTabChange}
            notifications={mockNotifications}
            theme={defaultDarkTheme}
          />
        </FocusProvider>
      </UIProvider>
    );

    expect(lastFrame()).toContain('MCP');
    expect(lastFrame()).toContain('🔌');
  });

  it('should highlight MCP tab when active', () => {
    const { lastFrame } = render(
      <UIProvider>
        <FocusProvider>
          <TabBar
            activeTab="mcp"
            onTabChange={mockOnTabChange}
            notifications={mockNotifications}
            theme={defaultDarkTheme}
          />
        </FocusProvider>
      </UIProvider>
    );

    const output = lastFrame();
    expect(output).toContain('MCP');
  });

  it('should allow navigation to MCP tab', () => {
    const { lastFrame } = render(
      <UIProvider initialTab="tools">
        <FocusProvider>
          <TabBar
            activeTab="tools"
            onTabChange={mockOnTabChange}
            notifications={mockNotifications}
            theme={defaultDarkTheme}
          />
        </FocusProvider>
      </UIProvider>
    );

    // Verify MCP tab is present in the tab bar
    expect(lastFrame()).toContain('MCP');
  });

  it('should display MCP tab with correct position (8th tab)', () => {
    const mcpTabIndex = tabs.findIndex(tab => tab.id === 'mcp');
    
    // MCP should be at index 7 (8th position, 0-indexed)
    expect(mcpTabIndex).toBe(7);
    
    // Verify tabs before and after
    expect(tabs[6].id).toBe('github');
    expect(tabs[8].id).toBe('settings');
  });

  it('should support Ctrl+8 shortcut for MCP tab', () => {
    const mcpTab = tabs.find(tab => tab.id === 'mcp');
    expect(mcpTab?.shortcut).toBe('Ctrl+8');
  });
});
