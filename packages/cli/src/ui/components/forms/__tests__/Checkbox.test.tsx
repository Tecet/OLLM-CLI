/**
 * Checkbox Component Tests
 * 
 * Tests:
 * - Checked/unchecked state rendering
 * - Label display
 * - Description display
 * - Disabled state
 * - CheckboxGroup functionality
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { Checkbox, CheckboxGroup } from '../Checkbox.js';

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
          success: 'green',
          error: 'red',
        },
      },
    },
  }),
}));

describe('Checkbox', () => {
  it('should render checked state', () => {
    const { lastFrame } = render(
      <Checkbox label="Test Checkbox" checked={true} onChange={() => {}} />
    );

    expect(lastFrame()).toContain('☑');
    expect(lastFrame()).toContain('Test Checkbox');
  });

  it('should render unchecked state', () => {
    const { lastFrame } = render(
      <Checkbox label="Test Checkbox" checked={false} onChange={() => {}} />
    );

    expect(lastFrame()).toContain('☐');
    expect(lastFrame()).toContain('Test Checkbox');
  });

  it('should render label', () => {
    const { lastFrame } = render(
      <Checkbox label="My Label" checked={false} onChange={() => {}} />
    );

    expect(lastFrame()).toContain('My Label');
  });

  it('should render description when provided', () => {
    const { lastFrame } = render(
      <Checkbox
        label="Test Checkbox"
        checked={false}
        onChange={() => {}}
        description="This is a description"
      />
    );

    expect(lastFrame()).toContain('This is a description');
  });

  it('should render disabled state', () => {
    const { lastFrame } = render(
      <Checkbox
        label="Disabled Checkbox"
        checked={false}
        onChange={() => {}}
        disabled={true}
      />
    );

    expect(lastFrame()).toContain('Disabled Checkbox');
  });

  it('should handle checked disabled state', () => {
    const { lastFrame } = render(
      <Checkbox
        label="Checked Disabled"
        checked={true}
        onChange={() => {}}
        disabled={true}
      />
    );

    expect(lastFrame()).toContain('☑');
    expect(lastFrame()).toContain('Checked Disabled');
  });
});

describe('CheckboxGroup', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2', description: 'Description 2' },
    { value: 'option3', label: 'Option 3' },
  ];

  it('should render group label', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={[]}
        onChange={() => {}}
      />
    );

    expect(lastFrame()).toContain('Test Group');
  });

  it('should render all options', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={[]}
        onChange={() => {}}
      />
    );

    expect(lastFrame()).toContain('Option 1');
    expect(lastFrame()).toContain('Option 2');
    expect(lastFrame()).toContain('Option 3');
  });

  it('should render option descriptions', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={[]}
        onChange={() => {}}
      />
    );

    expect(lastFrame()).toContain('Description 2');
  });

  it('should show selected options as checked', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={['option1', 'option3']}
        onChange={() => {}}
      />
    );

    const output = lastFrame();
    expect(output).toContain('☑');
    expect(output).toContain('Option 1');
    expect(output).toContain('Option 3');
  });

  it('should show unselected options as unchecked', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={['option1']}
        onChange={() => {}}
      />
    );

    const output = lastFrame();
    expect(output).toContain('☐');
    expect(output).toContain('Option 2');
  });

  it('should render disabled state', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={[]}
        onChange={() => {}}
        disabled={true}
      />
    );

    expect(lastFrame()).toContain('Test Group');
    expect(lastFrame()).toContain('Option 1');
  });

  it('should handle empty options', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Empty Group"
        options={[]}
        selected={[]}
        onChange={() => {}}
      />
    );

    expect(lastFrame()).toContain('Empty Group');
  });

  it('should handle all options selected', () => {
    const { lastFrame } = render(
      <CheckboxGroup
        label="Test Group"
        options={options}
        selected={['option1', 'option2', 'option3']}
        onChange={() => {}}
      />
    );

    const output = lastFrame();
    expect(output).toContain('☑');
    expect(output).toContain('Option 1');
    expect(output).toContain('Option 2');
    expect(output).toContain('Option 3');
  });
});
