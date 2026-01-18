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

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
    >
      {/* Tool name and toggle */}
      <Box gap={1}>
        <ToolToggle
          isEnabled={isEnabled}
          isSelected={isSelected}
          theme={theme}
        />
        <Text
          bold={isSelected}
          color={isSelected ? 'yellow' : theme.text.primary}
          dimColor={!isEnabled}
        >
          {tool.displayName}
        </Text>
      </Box>

      {/* Tool description */}
      <Box paddingLeft={3} marginTop={1}>
        <Text
          color={isSelected ? 'yellow' : theme.text.secondary}
          dimColor={!isEnabled}
        >
          {tool.description}
        </Text>
      </Box>

      {/* Tool ID (for reference) */}
      {isSelected && (
        <Box paddingLeft={3} marginTop={1}>
          <Text color="yellow" italic>
            ID: {tool.id}
          </Text>
        </Box>
      )}
    </Box>
  );
}
