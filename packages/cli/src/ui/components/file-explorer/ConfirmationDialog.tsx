/**
 * ConfirmationDialog Component
 * 
 * Displays a modal confirmation dialog for destructive operations.
 * Used for delete operations and other actions that require user confirmation.
 * 
 * Requirements: 4.3, 10.3
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Props for ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** The confirmation message to display */
  message: string;
  /** Optional title for the dialog (defaults to "Confirm") */
  title?: string;
  /** Optional confirm button label (defaults to "Yes") */
  confirmLabel?: string;
  /** Optional cancel button label (defaults to "No") */
  cancelLabel?: string;
  /** Callback when user confirms */
  onConfirm: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Optional warning level: 'info' | 'warning' | 'danger' (defaults to 'warning') */
  level?: 'info' | 'warning' | 'danger';
}

/**
 * ConfirmationDialog component
 * 
 * Displays a modal dialog with a message and Yes/No buttons.
 * The user can navigate between buttons with arrow keys or Tab,
 * and select with Enter. Esc cancels the operation.
 * 
 * Keyboard shortcuts:
 * - Left/Right/Tab: Navigate between buttons
 * - Enter: Select current button
 * - Esc: Cancel (same as No)
 * - y: Quick confirm (Yes)
 * - n: Quick cancel (No)
 */
export function ConfirmationDialog({
  isOpen,
  message,
  title = 'Confirm',
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  onConfirm,
  onCancel,
  level = 'warning',
}: ConfirmationDialogProps) {
  // 0 = Cancel button, 1 = Confirm button
  const [selectedButton, setSelectedButton] = useState<0 | 1>(0);

  /**
   * Handle confirmation
   */
  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  /**
   * Handle cancellation
   */
  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  /**
   * Handle keyboard input
   */
  useInput((input, key) => {
    if (!isOpen) return;

    // Cancel on Esc
    if (key.escape) {
      handleCancel();
      return;
    }

    // Navigate between buttons
    if (key.leftArrow || key.rightArrow || key.tab) {
      setSelectedButton(prev => prev === 0 ? 1 : 0);
      return;
    }

    // Select with Enter
    if (key.return) {
      if (selectedButton === 1) {
        handleConfirm();
      } else {
        handleCancel();
      }
      return;
    }

    // Quick shortcuts
    if (input === 'y' || input === 'Y') {
      handleConfirm();
      return;
    }

    if (input === 'n' || input === 'N') {
      handleCancel();
      return;
    }
  });

  // Don't render if dialog is not open
  if (!isOpen) {
    return null;
  }

  // Determine colors based on level
  const borderColor = level === 'danger' ? 'red' : level === 'warning' ? 'yellow' : 'cyan';
  const titleColor = level === 'danger' ? 'red' : level === 'warning' ? 'yellow' : 'cyan';
  const icon = level === 'danger' ? '⚠️' : level === 'warning' ? '⚠' : 'ℹ';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor}
      padding={1}
      minWidth={50}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text color={titleColor} bold>
          {icon} {title}
        </Text>
      </Box>

      {/* Message */}
      <Box marginBottom={1} paddingX={1}>
        <Text>{message}</Text>
      </Box>

      {/* Buttons */}
      <Box justifyContent="center" gap={2}>
        {/* Cancel button */}
        <Box
          borderStyle="single"
          borderColor={selectedButton === 0 ? 'cyan' : 'gray'}
          paddingX={2}
        >
          <Text
            bold={selectedButton === 0}
            inverse={selectedButton === 0}
            color={selectedButton === 0 ? 'cyan' : undefined}
          >
            {cancelLabel}
          </Text>
        </Box>

        {/* Confirm button */}
        <Box
          borderStyle="single"
          borderColor={selectedButton === 1 ? (level === 'danger' ? 'red' : 'green') : 'gray'}
          paddingX={2}
        >
          <Text
            bold={selectedButton === 1}
            inverse={selectedButton === 1}
            color={selectedButton === 1 ? (level === 'danger' ? 'red' : 'green') : undefined}
          >
            {confirmLabel}
          </Text>
        </Box>
      </Box>

      {/* Footer hint */}
      <Box marginTop={1}>
        <Text dimColor>
          Use arrow keys or Tab to navigate • Enter to select • Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
