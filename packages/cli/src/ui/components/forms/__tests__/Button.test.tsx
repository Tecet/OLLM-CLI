/**
 * Button Component Tests
 * 
 * Tests:
 * - Label rendering
 * - Disabled state
 * - Loading state
 * - Variant styles
 * - Shortcut display
 * - Icon display
 * - ButtonGroup functionality
 * - IconButton functionality
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { Button, ButtonGroup, IconButton } from '../Button.js';

// Mock UIContext
vi.mock('../../../../features/context/UIContext.js', () => ({
  useUI: () => ({
    state: {
      theme: {
        text: {
          primary: 'white',
          secondary: 'gray',
        },
        status: {
          info: 'blue',
          error: 'red',
          success: 'green',
        },
      },
    },
  }),
}));

describe('Button', () => {
  it('should render label', () => {
    const { lastFrame } = render(<Button label="Click Me" onPress={() => {}} />);

    expect(lastFrame()).toContain('Click Me');
  });

  it('should render shortcut when provided', () => {
    const { lastFrame } = render(
      <Button label="Save" onPress={() => {}} shortcut="S" />
    );

    expect(lastFrame()).toContain('[S]');
    expect(lastFrame()).toContain('Save');
  });

  it('should render icon when provided', () => {
    const { lastFrame } = render(
      <Button label="Delete" onPress={() => {}} icon="🗑" />
    );

    expect(lastFrame()).toContain('🗑');
    expect(lastFrame()).toContain('Delete');
  });

  it('should render loading state', () => {
    const { lastFrame } = render(
      <Button label="Save" onPress={() => {}} loading={true} />
    );

    expect(lastFrame()).toContain('Loading...');
    expect(lastFrame()).toContain('⟳');
  });

  it('should render disabled state', () => {
    const { lastFrame } = render(
      <Button label="Disabled" onPress={() => {}} disabled={true} />
    );

    expect(lastFrame()).toContain('Disabled');
  });

  it('should render primary variant', () => {
    const { lastFrame } = render(
      <Button label="Primary" onPress={() => {}} variant="primary" />
    );

    expect(lastFrame()).toContain('Primary');
  });

  it('should render secondary variant', () => {
    const { lastFrame } = render(
      <Button label="Secondary" onPress={() => {}} variant="secondary" />
    );

    expect(lastFrame()).toContain('Secondary');
  });

  it('should render danger variant', () => {
    const { lastFrame } = render(
      <Button label="Delete" onPress={() => {}} variant="danger" />
    );

    expect(lastFrame()).toContain('Delete');
  });

  it('should render success variant', () => {
    const { lastFrame } = render(
      <Button label="Confirm" onPress={() => {}} variant="success" />
    );

    expect(lastFrame()).toContain('Confirm');
  });

  it('should render with both icon and shortcut', () => {
    const { lastFrame } = render(
      <Button label="Save" onPress={() => {}} icon="💾" shortcut="S" />
    );

    expect(lastFrame()).toContain('[S]');
    expect(lastFrame()).toContain('💾');
    expect(lastFrame()).toContain('Save');
  });
});

describe('ButtonGroup', () => {
  const buttons = [
    { label: 'Save', onPress: () => {}, shortcut: 'S' },
    { label: 'Cancel', onPress: () => {}, shortcut: 'C', variant: 'secondary' as const },
    { label: 'Delete', onPress: () => {}, shortcut: 'D', variant: 'danger' as const },
  ];

  it('should render all buttons', () => {
    const { lastFrame } = render(<ButtonGroup buttons={buttons} />);

    expect(lastFrame()).toContain('Save');
    expect(lastFrame()).toContain('Cancel');
    expect(lastFrame()).toContain('Delete');
  });

  it('should render shortcuts for all buttons', () => {
    const { lastFrame } = render(<ButtonGroup buttons={buttons} />);

    expect(lastFrame()).toContain('[S]');
    expect(lastFrame()).toContain('[C]');
    expect(lastFrame()).toContain('[D]');
  });

  it('should handle empty button list', () => {
    const { lastFrame } = render(<ButtonGroup buttons={[]} />);

    // Empty button group renders nothing, which is expected
    expect(lastFrame()).toBe('');
  });

  it('should handle single button', () => {
    const { lastFrame } = render(
      <ButtonGroup buttons={[{ label: 'OK', onPress: () => {} }]} />
    );

    expect(lastFrame()).toContain('OK');
  });

  it('should render disabled buttons', () => {
    const disabledButtons = [
      { label: 'Disabled', onPress: () => {}, disabled: true },
    ];

    const { lastFrame } = render(<ButtonGroup buttons={disabledButtons} />);

    expect(lastFrame()).toContain('Disabled');
  });

  it('should render loading buttons', () => {
    const loadingButtons = [
      { label: 'Saving', onPress: () => {}, loading: true },
    ];

    const { lastFrame } = render(<ButtonGroup buttons={loadingButtons} />);

    expect(lastFrame()).toContain('Loading...');
  });
});

describe('IconButton', () => {
  it('should render icon', () => {
    const { lastFrame } = render(<IconButton icon="✓" onPress={() => {}} />);

    expect(lastFrame()).toContain('✓');
  });

  it('should render tooltip when provided', () => {
    const { lastFrame } = render(
      <IconButton icon="✓" onPress={() => {}} tooltip="Confirm" />
    );

    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('Confirm');
  });

  it('should render loading state', () => {
    const { lastFrame } = render(
      <IconButton icon="✓" onPress={() => {}} loading={true} />
    );

    expect(lastFrame()).toContain('⟳');
    expect(lastFrame()).not.toContain('✓');
  });

  it('should render disabled state', () => {
    const { lastFrame } = render(
      <IconButton icon="✓" onPress={() => {}} disabled={true} />
    );

    expect(lastFrame()).toContain('✓');
  });

  it('should render primary variant', () => {
    const { lastFrame } = render(
      <IconButton icon="✓" onPress={() => {}} variant="primary" />
    );

    expect(lastFrame()).toContain('✓');
  });

  it('should render danger variant', () => {
    const { lastFrame } = render(
      <IconButton icon="✗" onPress={() => {}} variant="danger" />
    );

    expect(lastFrame()).toContain('✗');
  });

  it('should render success variant', () => {
    const { lastFrame } = render(
      <IconButton icon="✓" onPress={() => {}} variant="success" />
    );

    expect(lastFrame()).toContain('✓');
  });
});
