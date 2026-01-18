import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../config/types.js';

export interface Options {
  temperature: number;
  maxTokens: number;
  reviewMode: boolean;
  metricsEnabled: boolean;
  reasoningEnabled: boolean;
}

export interface OptionsPanelProps {
  /** Current options */
  options: Options;
  
  /** Callback when an option is changed */
  onChange: (key: keyof Options, value: unknown) => void;
  
  /** Theme for styling */
  theme: Theme;
}

/**
 * OptionsPanel component
 * 
 * Displays and allows editing of runtime options.
 * Shows temperature, max tokens, and feature toggles.
 */
export function OptionsPanel({ options, onChange: _onChange, theme }: OptionsPanelProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border.active} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Options
        </Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between">
          <Text color={theme.text.secondary}>Temperature:</Text>
          <Text color={theme.text.primary}>{options.temperature.toFixed(1)}</Text>
        </Box>

        <Box justifyContent="space-between">
          <Text color={theme.text.secondary}>Max Tokens:</Text>
          <Text color={theme.text.primary}>{options.maxTokens}</Text>
        </Box>

        <Box justifyContent="space-between">
          <Text color={theme.text.secondary}>Review Mode:</Text>
          <Text color={options.reviewMode ? theme.status.success : theme.status.error}>
            {options.reviewMode ? '✓ Enabled' : '✗ Disabled'}
          </Text>
        </Box>

        <Box justifyContent="space-between">
          <Text color={theme.text.secondary}>Metrics:</Text>
          <Text color={options.metricsEnabled ? theme.status.success : theme.status.error}>
            {options.metricsEnabled ? '✓ Enabled' : '✗ Disabled'}
          </Text>
        </Box>

        <Box justifyContent="space-between">
          <Text color={theme.text.secondary}>Reasoning:</Text>
          <Text color={options.reasoningEnabled ? theme.status.success : theme.status.error}>
            {options.reasoningEnabled ? '✓ Enabled' : '✗ Disabled'}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={theme.text.secondary} paddingX={1}>
        <Text color={theme.text.secondary} dimColor>
          Use slash commands to modify options
        </Text>
      </Box>
    </Box>
  );
}
