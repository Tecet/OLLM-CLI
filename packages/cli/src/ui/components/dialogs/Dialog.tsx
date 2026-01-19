/**
 * Dialog - Base dialog component for modal interactions
 * 
 * Features:
 * - Consistent border and padding
 * - Title display
 * - Esc key handler for closing
 * - Theme-aware styling
 * - Flexible content area
 * 
 * Requirements: 12.14, NFR-7
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';

export interface DialogProps {
  /** Dialog title */
  title: string;
  /** Callback when dialog should close (Esc key) */
  onClose: () => void;
  /** Dialog content */
  children: React.ReactNode;
  /** Optional custom width (default: 60) */
  width?: number;
  /** Optional custom border color (defaults to theme.border.active) */
  borderColor?: string;
  /** Optional title color (defaults to yellow) */
  titleColor?: string;
}

/**
 * Base Dialog component
 * 
 * Provides a consistent dialog container with:
 * - Rounded border
 * - Title bar
 * - Esc key handling
 * - Theme-aware styling
 * 
 * @example
 * ```tsx
 * <Dialog title="Configure Server" onClose={handleClose}>
 *   <Box flexDirection="column">
 *     <Text>Dialog content goes here</Text>
 *   </Box>
 * </Dialog>
 * ```
 */
export function Dialog({
  title,
  onClose,
  children,
  width = 60,
  borderColor,
  titleColor = 'yellow',
}: DialogProps) {
  const { state: uiState } = useUI();

  // Handle Esc key to close dialog
  useInput((input, key) => {
    if (key.escape) {
      onClose();
    }
  });

  const effectiveBorderColor = borderColor || uiState.theme.border.active;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={effectiveBorderColor}
      padding={1}
      width={width}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={titleColor}>
          {title}
        </Text>
      </Box>

      {/* Content */}
      {children}
    </Box>
  );
}
