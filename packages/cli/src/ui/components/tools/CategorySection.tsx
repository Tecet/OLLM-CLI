import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../config/types.js';
import { ToolCategory, ToolMetadata } from '../../../config/toolsConfig.js';
import { ToolItem } from './ToolItem.js';

export interface CategorySectionProps {
  category: ToolCategory;
  displayName: string;
  tools: ToolMetadata[];
  toolStates: Record<string, boolean>;
  isSelected: boolean;
  selectedToolIndex: number;
  onToggle: (toolId: string) => void;
  theme: Theme;
}

/**
 * CategorySection component
 * 
 * Displays a category header and its tools.
 * Highlights the selected tool when the category is active.
 * 
 * Requirements: 23.2, 25.3
 */
export function CategorySection({
  category,
  displayName,
  tools,
  toolStates,
  isSelected,
  selectedToolIndex,
  onToggle,
  theme,
}: CategorySectionProps) {
  // Category icon mapping
  const categoryIcons: Record<ToolCategory, string> = {
    'file-operations': '📝',
    'file-discovery': '🔍',
    'shell': '⚡',
    'web': '🌐',
    'memory': '💾',
    'context': '🔄',
  };

  const icon = categoryIcons[category] || '📦';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Category header */}
      <Box
        borderStyle="round"
        borderColor={isSelected ? theme.text.accent : theme.text.secondary}
        paddingX={1}
        marginBottom={1}
      >
        <Text
          bold
          color={isSelected ? theme.text.accent : theme.text.primary}
        >
          {icon} {displayName}
        </Text>
        <Text color={theme.text.secondary}>
          {' '}({tools.length} tools)
        </Text>
      </Box>

      {/* Tools list */}
      <Box flexDirection="column" paddingLeft={2}>
        {tools.map((tool, index) => {
          const isToolSelected = isSelected && index === selectedToolIndex;
          const isEnabled = toolStates[tool.id] ?? true;

          return (
            <ToolItem
              key={tool.id}
              tool={tool}
              isEnabled={isEnabled}
              isSelected={isToolSelected}
              onToggle={() => onToggle(tool.id)}
              theme={theme}
            />
          );
        })}
      </Box>
    </Box>
  );
}
