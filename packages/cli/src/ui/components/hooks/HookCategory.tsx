import React from 'react';
import { Box, Text } from 'ink';

import type { Theme } from '../../../config/types.js';

export interface HookCategory {
  name: string;
  eventTypes: string[];
  hooks: Array<{
    id: string;
    name: string;
    command: string;
    args?: string[];
    source: 'builtin' | 'user' | 'workspace' | 'downloaded' | 'extension';
    extensionName?: string;
  }>;
  expanded: boolean;
}

export interface HookCategoryProps {
  category: HookCategory;
  isSelected: boolean;
  hasFocus: boolean;
  theme: Theme;
  onToggleExpand?: () => void;
}

/**
 * HookCategory component
 *
 * Displays a collapsible category header with hook count.
 * Shows category name, icon, and number of hooks.
 * Supports expand/collapse functionality and focus state styling.
 *
 * Requirements: 1.4, 1.5
 */
export function HookCategory({
  category,
  isSelected,
  hasFocus,
  theme,
  onToggleExpand: _onToggleExpand,
}: HookCategoryProps) {
  // Category icon mapping (from design document)
  const categoryIcons: Record<string, string> = {
    'Session Events': '🔄',
    'Agent Events': '🤖',
    'Model Events': '🧠',
    'Tool Events': '🔧',
    'Compression Events': '📦',
    Notifications: '🔔',
    'File Events': '📝',
    'Prompt Events': '💬',
    'User Triggered': '👤',
  };

  const icon = categoryIcons[category.name] || '📦';
  const hookCount = category.hooks.length;
  const expandIndicator = category.expanded ? '▼' : '▶';

  // Determine colors based on selection and focus state
  const headerColor = isSelected && hasFocus ? 'yellow' : theme.text.primary;
  const countColor = theme.text.secondary;
  const borderColor = isSelected && hasFocus ? theme.border.active : theme.border.primary;

  return (
    <Box flexDirection="column">
      {/* Category header */}
      <Box borderStyle="round" borderColor={borderColor} paddingX={1}>
        <Text bold color={headerColor}>
          {expandIndicator} {icon} {category.name}
        </Text>
        <Text color={countColor}>
          {' '}
          ({hookCount} {hookCount === 1 ? 'hook' : 'hooks'})
        </Text>
      </Box>
    </Box>
  );
}
