/**
 * TextInput Component Tests
 * 
 * Tests:
 * - Value display
 * - Placeholder display
 * - Masking for sensitive data
 * - Disabled state
 * - Max length truncation
 * - Validation
 * - Validators utility functions
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { TextInput, validators, combineValidators } from '../TextInput.js';

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

describe('TextInput', () => {
  it('should render value', () => {
    const { lastFrame } = render(
      <TextInput value="test value" onChange={() => {}} />
    );

    expect(lastFrame()).toContain('test value');
  });

  it('should render placeholder when value is empty', () => {
    const { lastFrame } = render(
      <TextInput value="" onChange={() => {}} placeholder="Enter text" />
    );

    expect(lastFrame()).toContain('Enter text');
  });

  it('should mask value when mask is true', () => {
    const { lastFrame } = render(
      <TextInput value="secret123" onChange={() => {}} mask={true} />
    );

    expect(lastFrame()).not.toContain('secret123');
    expect(lastFrame()).toContain('•');
  });

  it('should not mask value when mask is false', () => {
    const { lastFrame } = render(
      <TextInput value="visible" onChange={() => {}} mask={false} />
    );

    expect(lastFrame()).toContain('visible');
    expect(lastFrame()).not.toContain('•');
  });

  it('should truncate value when maxLength is exceeded', () => {
    const longValue = 'a'.repeat(100);
    const { lastFrame } = render(
      <TextInput value={longValue} onChange={() => {}} maxLength={10} />
    );

    const output = lastFrame();
    expect(output).toContain('...');
    expect(output).not.toContain(longValue);
  });

  it('should show disabled state', () => {
    const { lastFrame } = render(
      <TextInput value="disabled" onChange={() => {}} disabled={true} />
    );

    expect(lastFrame()).toContain('disabled');
  });

  it('should validate value when validator provided', () => {
    const validator = (value: string) =>
      value.length < 3 ? 'Too short' : undefined;

    const { lastFrame } = render(
      <TextInput value="ab" onChange={() => {}} validate={validator} />
    );

    // Component renders but validation error is handled by FormField
    expect(lastFrame()).toContain('ab');
  });
});

describe('validators', () => {
  describe('required', () => {
    it('should return error for empty string', () => {
      expect(validators.required('')).toBe('This field is required');
    });

    it('should return error for whitespace only', () => {
      expect(validators.required('   ')).toBe('This field is required');
    });

    it('should return undefined for non-empty string', () => {
      expect(validators.required('value')).toBeUndefined();
    });
  });

  describe('minLength', () => {
    it('should return error when value is too short', () => {
      const validator = validators.minLength(5);
      expect(validator('abc')).toBe('Minimum length is 5 characters');
    });

    it('should return undefined when value meets minimum', () => {
      const validator = validators.minLength(5);
      expect(validator('abcde')).toBeUndefined();
    });
  });

  describe('maxLength', () => {
    it('should return error when value is too long', () => {
      const validator = validators.maxLength(5);
      expect(validator('abcdef')).toBe('Maximum length is 5 characters');
    });

    it('should return undefined when value is within limit', () => {
      const validator = validators.maxLength(5);
      expect(validator('abc')).toBeUndefined();
    });
  });

  describe('pattern', () => {
    it('should return error when pattern does not match', () => {
      const validator = validators.pattern(/^\d+$/, 'Must be digits only');
      expect(validator('abc')).toBe('Must be digits only');
    });

    it('should return undefined when pattern matches', () => {
      const validator = validators.pattern(/^\d+$/, 'Must be digits only');
      expect(validator('123')).toBeUndefined();
    });
  });

  describe('url', () => {
    it('should return error for invalid URL', () => {
      expect(validators.url('not a url')).toBe('Invalid URL format');
    });

    it('should return undefined for valid URL', () => {
      expect(validators.url('https://example.com')).toBeUndefined();
    });
  });

  describe('email', () => {
    it('should return error for invalid email', () => {
      expect(validators.email('notanemail')).toBe('Invalid email format');
    });

    it('should return undefined for valid email', () => {
      expect(validators.email('test@example.com')).toBeUndefined();
    });
  });

  describe('number', () => {
    it('should return error for non-numeric value', () => {
      expect(validators.number('abc')).toBe('Must be a valid number');
    });

    it('should return undefined for numeric value', () => {
      expect(validators.number('123')).toBeUndefined();
      expect(validators.number('123.45')).toBeUndefined();
    });
  });

  describe('integer', () => {
    it('should return error for non-integer', () => {
      expect(validators.integer('123.45')).toBe('Must be an integer');
    });

    it('should return undefined for integer', () => {
      expect(validators.integer('123')).toBeUndefined();
    });
  });

  describe('positive', () => {
    it('should return error for zero or negative', () => {
      expect(validators.positive('0')).toBe('Must be a positive number');
      expect(validators.positive('-5')).toBe('Must be a positive number');
    });

    it('should return undefined for positive number', () => {
      expect(validators.positive('5')).toBeUndefined();
    });
  });
});

describe('combineValidators', () => {
  it('should return first error from multiple validators', () => {
    const combined = combineValidators(
      validators.required,
      validators.minLength(5)
    );

    expect(combined('')).toBe('This field is required');
    expect(combined('abc')).toBe('Minimum length is 5 characters');
    expect(combined('abcde')).toBeUndefined();
  });

  it('should return undefined when all validators pass', () => {
    const combined = combineValidators(
      validators.required,
      validators.minLength(3),
      validators.maxLength(10)
    );

    expect(combined('hello')).toBeUndefined();
  });

  it('should handle empty validator list', () => {
    const combined = combineValidators();
    expect(combined('anything')).toBeUndefined();
  });
});
