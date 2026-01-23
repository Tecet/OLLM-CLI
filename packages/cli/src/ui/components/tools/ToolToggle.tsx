import React from 'react';
import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';

export interface ToolToggleProps {
  isEnabled: boolean;
  isSelected: boolean;
  theme: Theme;
}

/**
 * ToolToggle component
 * 
 * Displays a visual toggle indicator for tool enabled/disabled state.
 * Shows different styles when selected for keyboard navigation.
 * 
 * Requirements: 23.4, 24.3
 */
export function ToolToggle({
  isEnabled,
  isSelected,
  theme,
}: ToolToggleProps) {
  // Toggle styles
  const enabledIcon = '✓';
  const disabledIcon = '✗';
  
  const icon = isEnabled ? enabledIcon : disabledIcon;
  const color = isEnabled ? theme.status.success : theme.status.error;
  
  // Bracket style changes when selected
  const leftBracket = isSelected ? '[' : ' ';
  const rightBracket = isSelected ? ']' : ' ';

  return (
    <Box>
      <Text color={isSelected ? theme.text.accent : theme.text.secondary}>
        {leftBracket}
      </Text>
      <Text color={color} bold={isSelected}>
        {icon}
      </Text>
      <Text color={isSelected ? theme.text.accent : theme.text.secondary}>
        {rightBracket}
      </Text>
    </Box>
  );
}
