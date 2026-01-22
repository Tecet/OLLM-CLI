/**
 * Checkbox - Checkbox component with label
 * 
 * Features:
 * - Checked/unchecked state
 * - Label display
 * - Disabled state
 * - Theme-aware styling
 * - Keyboard accessible
 * 
 * Validates: Requirements NFR-7, NFR-9
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}

/**
 * Checkbox component - displays checkbox with label
 */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  description,
}: CheckboxProps) {
  const { state: uiState } = useUI();

  const checkIcon = checked ? '☑' : '☐';
  const textColor = disabled
    ? 'gray'
    : checked
      ? uiState.theme.status.success
      : uiState.theme.text.primary;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={textColor} dimColor={disabled}>
          {checkIcon} {label}
        </Text>
      </Box>

      {description && (
        <Box marginLeft={3}>
          <Text color={uiState.theme.text.secondary} dimColor>
            {description}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * CheckboxGroup - Group of related checkboxes
 */
export interface CheckboxGroupProps {
  label: string;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function CheckboxGroup({
  label,
  options,
  selected,
  onChange,
  disabled = false,
}: CheckboxGroupProps) {
  const { state: uiState } = useUI();

  const handleToggle = (value: string) => {
    if (disabled) return;

    const newSelected = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];

    onChange(newSelected);
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={uiState.theme.text.primary} bold>
          {label}
        </Text>
      </Box>

      <Box flexDirection="column" marginLeft={2}>
        {options.map((option) => (
          <Checkbox
            key={option.value}
            label={option.label}
            checked={selected.includes(option.value)}
            onChange={() => handleToggle(option.value)}
            disabled={disabled}
            description={option.description}
          />
        ))}
      </Box>
    </Box>
  );
}
