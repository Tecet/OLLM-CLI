import React from 'react';
import { Box, Text } from 'ink';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import type { Theme } from '../../../config/types.js';

export interface HookItemProps {
  /** The hook to display */
  hook: Hook;
  /** Whether this hook item is currently selected */
  isSelected: boolean;
  /** Whether the parent panel has focus */
  hasFocus: boolean;
  /** Whether the hook is enabled */
  isEnabled: boolean;
  /** Theme for styling */
  theme: Theme;
  /** Optional callback when the hook is clicked/selected */
  onSelect?: () => void;
}

/**
 * HookItem component
 * 
 * Displays an individual hook with enable/disable toggle indicator.
 * Shows hook name with visual indicators for enabled (●) and disabled (○) states.
 * Applies focus state styling when selected.
 * 
 * Visual States:
 * - Enabled: Green ● indicator with bright text
 * - Disabled: Gray ○ indicator with dimmed text
 * - Selected + Focus: Yellow bold text with cyan background
 * - Selected without Focus: Normal text
 * - Disabled: Dimmed text for better visual distinction
 * 
 * Example Usage:
 * ```tsx
 * <HookItem
 *   hook={myHook}
 *   isSelected={selectedIndex === index}
 *   hasFocus={panelHasFocus}
 *   isEnabled={enabledHooks.has(myHook.id)}
 *   theme={uiTheme}
 * />
 * ```
 * 
 * Requirements: 1.6, 1.7, 1.8
 * - 1.6: Hook details include name, version, description, trigger conditions, action, and status
 * - 1.7: Visual distinction between enabled (●) and disabled (○) hooks
 * - 1.8: Selected hook highlighted in yellow when panel has focus
 */
export function HookItem({
  hook,
  isSelected,
  hasFocus,
  isEnabled,
  theme,
  onSelect,
}: HookItemProps) {
  // Enhanced color scheme for better visual distinction
  const getTextColor = () => {
    if (isSelected && hasFocus) return 'yellow';
    if (isEnabled) return theme.text.primary;
    return theme.text.secondary;
  };
  
  // Improved indicator colors with better contrast
  const indicatorColor = isEnabled ? 'green' : 'gray';
  
  // Apply dimming to disabled hooks for better visual hierarchy
  const shouldDim = !isEnabled;

  return (
    <Box paddingLeft={2} paddingY={0} onClick={onSelect}>
      <Box gap={1}>
        {/* Enable/disable indicator with enhanced colors */}
        <Text color={indicatorColor} bold={isEnabled}>
          {isEnabled ? '●' : '○'}
        </Text>
        
        {/* Hook name with improved visual hierarchy */}
        <Text
          bold={isSelected && hasFocus}
          color={getTextColor()}
          dimColor={shouldDim}
        >
          {hook.name}
        </Text>
      </Box>
    </Box>
  );
}
