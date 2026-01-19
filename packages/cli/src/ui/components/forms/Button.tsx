/**
 * Button - Button component with press handler
 * 
 * Features:
 * - Press handler callback
 * - Disabled state
 * - Loading state
 * - Variant styles (primary, secondary, danger)
 * - Theme-aware styling
 * - Keyboard shortcut display
 * 
 * Validates: Requirements NFR-7, NFR-9
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';

export interface ButtonProps {
  label: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  shortcut?: string;
  icon?: string;
}

/**
 * Button component - displays clickable button with label
 */
export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  shortcut,
  icon,
}: ButtonProps) {
  const { state: uiState } = useUI();

  // Determine color based on variant and state
  const getColor = () => {
    if (disabled || loading) return 'gray';

    switch (variant) {
      case 'primary':
        return uiState.theme.status.info;
      case 'secondary':
        return uiState.theme.text.secondary;
      case 'danger':
        return uiState.theme.status.error;
      case 'success':
        return uiState.theme.status.success;
      default:
        return uiState.theme.text.primary;
    }
  };

  const displayLabel = loading ? 'Loading...' : label;
  const displayIcon = loading ? '⟳' : icon;

  return (
    <Box>
      <Text color={getColor()} dimColor={disabled || loading}>
        {shortcut && `[${shortcut}] `}
        {displayIcon && `${displayIcon} `}
        {displayLabel}
      </Text>
    </Box>
  );
}

/**
 * ButtonGroup - Group of related buttons
 */
export interface ButtonGroupProps {
  buttons: Array<{
    label: string;
    onPress: () => void | Promise<void>;
    disabled?: boolean;
    loading?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'success';
    shortcut?: string;
    icon?: string;
  }>;
  spacing?: number;
}

export function ButtonGroup({ buttons, spacing = 2 }: ButtonGroupProps) {
  return (
    <Box gap={spacing}>
      {buttons.map((button, index) => (
        <Button key={index} {...button} />
      ))}
    </Box>
  );
}

/**
 * IconButton - Button with only an icon
 */
export interface IconButtonProps {
  icon: string;
  onPress: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export function IconButton({
  icon,
  onPress,
  disabled = false,
  loading = false,
  tooltip,
  variant = 'primary',
}: IconButtonProps) {
  const { state: uiState } = useUI();

  const getColor = () => {
    if (disabled || loading) return 'gray';

    switch (variant) {
      case 'primary':
        return uiState.theme.status.info;
      case 'secondary':
        return uiState.theme.text.secondary;
      case 'danger':
        return uiState.theme.status.error;
      case 'success':
        return uiState.theme.status.success;
      default:
        return uiState.theme.text.primary;
    }
  };

  const displayIcon = loading ? '⟳' : icon;

  return (
    <Box>
      <Text color={getColor()} dimColor={disabled || loading}>
        {displayIcon}
        {tooltip && (
          <Text color={uiState.theme.text.secondary} dimColor>
            {' '}
            {tooltip}
          </Text>
        )}
      </Text>
    </Box>
  );
}
