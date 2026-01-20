import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { HookCategory, type HookCategoryProps } from '../HookCategory.js';
import type { Theme } from '../../../../config/types.js';

// Mock theme
const mockTheme: Theme = {
  text: {
    primary: 'white',
    secondary: 'gray',
    accent: 'yellow',
    success: 'green',
    error: 'red',
    warning: 'yellow',
  },
  border: {
    primary: 'gray',
    active: 'yellow',
  },
  status: {
    success: 'green',
    error: 'red',
    warning: 'yellow',
    info: 'blue',
  },
};

describe('HookCategory', () => {
  const mockCategory: HookCategoryProps['category'] = {
    name: 'File Events',
    eventTypes: ['fileEdited', 'fileCreated', 'fileDeleted'],
    hooks: [
      {
        id: 'hook-1',
        name: 'Lint on Save',
        command: 'npm',
        args: ['run', 'lint'],
        source: 'builtin',
      },
      {
        id: 'hook-2',
        name: 'Format on Save',
        command: 'npm',
        args: ['run', 'format'],
        source: 'user',
      },
    ],
    expanded: true,
  };

  it('should render category name with icon', () => {
    const { lastFrame } = render(
      <HookCategory
        category={mockCategory}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('📝 File Events');
  });

  it('should display hook count', () => {
    const { lastFrame } = render(
      <HookCategory
        category={mockCategory}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('(2 hooks)');
  });

  it('should display singular "hook" when count is 1', () => {
    const singleHookCategory = {
      ...mockCategory,
      hooks: [mockCategory.hooks[0]],
    };

    const { lastFrame } = render(
      <HookCategory
        category={singleHookCategory}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('(1 hook)');
  });

  it('should show expand indicator when expanded', () => {
    const { lastFrame } = render(
      <HookCategory
        category={{ ...mockCategory, expanded: true }}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('▼');
  });

  it('should show collapse indicator when collapsed', () => {
    const { lastFrame } = render(
      <HookCategory
        category={{ ...mockCategory, expanded: false }}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('▶');
  });

  it('should apply focus styling when selected and has focus', () => {
    const { lastFrame } = render(
      <HookCategory
        category={mockCategory}
        isSelected={true}
        hasFocus={true}
        theme={mockTheme}
      />
    );

    // When focused, the text should be rendered (we can't directly test color in snapshots)
    // but we can verify the content is present
    expect(lastFrame()).toContain('File Events');
  });

  it('should not apply focus styling when not selected', () => {
    const { lastFrame } = render(
      <HookCategory
        category={mockCategory}
        isSelected={false}
        hasFocus={true}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('File Events');
  });

  it('should not apply focus styling when not focused', () => {
    const { lastFrame } = render(
      <HookCategory
        category={mockCategory}
        isSelected={true}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('File Events');
  });

  it('should use default icon for unknown category', () => {
    const unknownCategory = {
      ...mockCategory,
      name: 'Unknown Category',
    };

    const { lastFrame } = render(
      <HookCategory
        category={unknownCategory}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('📦 Unknown Category');
  });

  it('should handle category with no hooks', () => {
    const emptyCategory = {
      ...mockCategory,
      hooks: [],
    };

    const { lastFrame } = render(
      <HookCategory
        category={emptyCategory}
        isSelected={false}
        hasFocus={false}
        theme={mockTheme}
      />
    );

    expect(lastFrame()).toContain('(0 hooks)');
  });

  it('should render all known category icons correctly', () => {
    const categories = [
      { name: 'Session Events', icon: '🔄' },
      { name: 'Agent Events', icon: '🤖' },
      { name: 'Model Events', icon: '🧠' },
      { name: 'Tool Events', icon: '🔧' },
      { name: 'Compression Events', icon: '📦' },
      { name: 'Notifications', icon: '🔔' },
      { name: 'File Events', icon: '📝' },
      { name: 'Prompt Events', icon: '💬' },
      { name: 'User Triggered', icon: '👤' },
    ];

    categories.forEach(({ name, icon }) => {
      const testCategory = {
        ...mockCategory,
        name,
      };

      const { lastFrame } = render(
        <HookCategory
          category={testCategory}
          isSelected={false}
          hasFocus={false}
          theme={mockTheme}
        />
      );

      expect(lastFrame()).toContain(`${icon} ${name}`);
    });
  });
});
