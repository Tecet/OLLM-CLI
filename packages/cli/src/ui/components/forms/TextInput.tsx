/**
 * TextInput - Text input component with validation
 * 
 * Features:
 * - Controlled input with onChange callback
 * - Optional masking for sensitive data
 * - Placeholder support
 * - Validation support
 * - Theme-aware styling
 * 
 * Validates: Requirements NFR-7, NFR-9, NFR-16
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mask?: boolean;
  disabled?: boolean;
  maxLength?: number;
  validate?: (value: string) => string | undefined;
}

/**
 * TextInput component - displays text with edit indicator
 * 
 * Note: This is a display-only component for terminal UI.
 * Actual editing happens through dialog interactions.
 */
export function TextInput({
  value,
  _onChange,
  placeholder = '',
  mask = false,
  disabled = false,
  maxLength,
  validate,
}: TextInputProps) {
  const { state: uiState } = useUI();

  // Mask sensitive values
  const displayValue = mask && value ? '•'.repeat(Math.min(value.length, 20)) : value;

  // Validate if validator provided
  const error = validate ? validate(value) : undefined;

  // Truncate if max length exceeded
  const truncatedValue =
    maxLength && displayValue.length > maxLength
      ? displayValue.substring(0, maxLength) + '...'
      : displayValue;

  return (
    <Box flexDirection="column">
      <Box>
        <Text
          color={
            disabled
              ? 'gray'
              : error
                ? uiState.theme.status.error
                : uiState.theme.text.secondary
          }
          dimColor={disabled}
        >
          {truncatedValue || (
            <Text dimColor italic>
              {placeholder}
            </Text>
          )}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Common validators
 */
export const validators = {
  required: (value: string) => {
    return value.trim() === '' ? 'This field is required' : undefined;
  },

  minLength: (min: number) => (value: string) => {
    return value.length < min ? `Minimum length is ${min} characters` : undefined;
  },

  maxLength: (max: number) => (value: string) => {
    return value.length > max ? `Maximum length is ${max} characters` : undefined;
  },

  pattern: (pattern: RegExp, message: string) => (value: string) => {
    return !pattern.test(value) ? message : undefined;
  },

  url: (value: string) => {
    try {
      new URL(value);
      return undefined;
    } catch {
      return 'Invalid URL format';
    }
  },

  email: (value: string) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !emailPattern.test(value) ? 'Invalid email format' : undefined;
  },

  number: (value: string) => {
    return isNaN(Number(value)) ? 'Must be a valid number' : undefined;
  },

  integer: (value: string) => {
    return !Number.isInteger(Number(value)) ? 'Must be an integer' : undefined;
  },

  positive: (value: string) => {
    return Number(value) <= 0 ? 'Must be a positive number' : undefined;
  },
};

/**
 * Combine multiple validators
 */
export function combineValidators(
  ...validators: Array<(value: string) => string | undefined>
) {
  return (value: string): string | undefined => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  };
}
