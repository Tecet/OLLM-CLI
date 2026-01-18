import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../config/types.js';
import { ToolMetadata } from '../../../config/toolsConfig.js';
import { ToolToggle } from './ToolToggle.js';

export interface ToolItemProps {
  tool: ToolMetadata;
  isEnabled: boolean;
  isSelected: boolean;
  theme: Theme;
}

/**
 * ToolItem component
 * 
 * Displays a single tool with its toggle, name, description, and risk level.
 * Highlights when selected for keyboard navigation.
 * 
 * Requirements: 23.3, 24.3
 */
export function ToolItem({
  tool,
  isEnabled,
  isSelected,
  theme,
}: ToolItemProps) {
  // Risk level colors
  const riskColors = {
    low: theme.status.success,
    medium: theme.status.warning,
    high: theme.status.error,
  };

  // Risk level icons
  const riskIcons = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
  };

  const riskColor = riskColors[tool.risk];
  const riskIcon = riskIcons[tool.risk];

  return (
    <Box
      flexDirection="column"
      borderStyle={isSelected ? 'double' : undefined}
      borderColor={isSelected ? theme.text.accent : undefined}
      paddingX={isSelected ? 1 : 0}
      marginBottom={1}
    >
      {/* Tool name and toggle */}
      <Box justifyContent="space-between" alignItems="center">
        <Box gap={1}>
          <ToolToggle
            isEnabled={isEnabled}
            isSelected={isSelected}
            theme={theme}
          />
          <Text
            bold={isSelected}
            color={isSelected ? theme.text.accent : theme.text.primary}
            dimColor={!isEnabled}
          >
            {tool.displayName}
          </Text>
        </Box>
        
        <Box gap={1}>
          <Text color={riskColor}>
            {riskIcon}
          </Text>
          <Text color={riskColor} dimColor={!isEnabled}>
            {tool.risk}
          </Text>
        </Box>
      </Box>

      {/* Tool description */}
      <Box paddingLeft={3} marginTop={1}>
        <Text
          color={theme.text.secondary}
          dimColor={!isEnabled}
        >
          {tool.description}
        </Text>
      </Box>

      {/* Tool ID (for reference) */}
      {isSelected && (
        <Box paddingLeft={3} marginTop={1}>
          <Text color={theme.text.secondary} italic>
            ID: {tool.id}
          </Text>
        </Box>
      )}
    </Box>
  );
}
