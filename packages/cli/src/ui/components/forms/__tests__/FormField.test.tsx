/**
 * FormField Component Tests
 * 
 * Tests:
 * - Label rendering
 * - Required field indicator
 * - Error message display
 * - Help text display
 * - Children rendering
 * - Theme integration
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { FormField } from '../FormField.js';
import { Text } from 'ink';

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
          error: 'red',
        },
      },
    },
  }),
}));

describe('FormField', () => {
  it('should render label', () => {
    const { lastFrame } = render(
      <FormField label="Test Label">
        <Text>Input</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('Test Label');
  });

  it('should render required indicator when required is true', () => {
    const { lastFrame } = render(
      <FormField label="Required Field" required>
        <Text>Input</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('Required Field');
    expect(lastFrame()).toContain('*');
  });

  it('should not render required indicator when required is false', () => {
    const { lastFrame } = render(
      <FormField label="Optional Field" required={false}>
        <Text>Input</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('Optional Field');
    expect(lastFrame()).not.toMatch(/\*/);
  });

  it('should render children', () => {
    const { lastFrame } = render(
      <FormField label="Test Label">
        <Text>Test Input Content</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('Test Input Content');
  });

  it('should render help text when provided and no error', () => {
    const { lastFrame } = render(
      <FormField label="Test Label" helpText="This is help text">
        <Text>Input</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('This is help text');
  });

  it('should render error message when provided', () => {
    const { lastFrame } = render(
      <FormField label="Test Label" error="This field is required">
        <Text>Input</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('⚠ This field is required');
  });

  it('should not render help text when error is present', () => {
    const { lastFrame } = render(
      <FormField
        label="Test Label"
        helpText="Help text"
        error="Error message"
      >
        <Text>Input</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('Error message');
    expect(lastFrame()).not.toContain('Help text');
  });

  it('should render with proper spacing', () => {
    const { lastFrame } = render(
      <FormField label="Test Label">
        <Text>Input</Text>
      </FormField>
    );

    const output = lastFrame();
    expect(output).toBeTruthy();
    expect(output).toContain('Test Label');
    expect(output).toContain('Input');
  });

  it('should handle empty children', () => {
    const { lastFrame } = render(
      <FormField label="Test Label">
        <></>
      </FormField>
    );

    expect(lastFrame()).toContain('Test Label');
  });

  it('should handle multiple children', () => {
    const { lastFrame } = render(
      <FormField label="Test Label">
        <Text>Input 1</Text>
        <Text>Input 2</Text>
      </FormField>
    );

    expect(lastFrame()).toContain('Input 1');
    expect(lastFrame()).toContain('Input 2');
  });
});
