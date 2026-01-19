/**
 * Tooltip Component
 * 
 * Displays contextual help information for form fields.
 * Shows detailed explanations for complex fields.
 * 
 * Note: Terminal support for tooltips is limited. This component
 * displays help text inline rather than as a hover tooltip.
 * 
 * Validates: NFR-9
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface TooltipProps {
  /** Tooltip content */
  text: string;
  /** Icon to display (default: ℹ) */
  icon?: string;
  /** Color for the icon (default: cyan) */
  iconColor?: string;
  /** Whether to show the tooltip inline (default: true) */
  inline?: boolean;
}

/**
 * Tooltip component
 * 
 * Displays help information inline with form fields.
 * Since terminal UIs don't support hover tooltips, this component
 * shows the help text directly.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  text,
  icon = 'ℹ',
  iconColor = 'cyan',
  inline = true,
}) => {
  if (inline) {
    return (
      <Box marginLeft={1}>
        <Text color={iconColor}>{icon}</Text>
        <Text dimColor> {text}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Box>
        <Text color={iconColor}>{icon}</Text>
        <Text dimColor> {text}</Text>
      </Box>
    </Box>
  );
};

/**
 * InfoIcon component - just the icon without text
 * Can be used to indicate that help is available
 */
export const InfoIcon: React.FC<{ color?: string }> = ({ color = 'cyan' }) => (
  <Text color={color}>ℹ</Text>
);
