/**
 * ConfirmationDialog Component
 * 
 * Generic confirmation dialog for destructive or important actions.
 * Provides clear visual feedback and prevents accidental actions.
 * 
 * Features:
 * - Customizable title, message, and action labels
 * - Warning level (info, warning, danger)
 * - Optional detailed description
 * - Confirm and Cancel buttons with keyboard shortcuts
 * - Loading state during action execution
 * - Error handling
 * 
 * Validates: NFR-7
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Dialog } from './Dialog.js';
import { ButtonGroup } from '../forms/Button.js';
import { useUI } from '../../../features/context/UIContext.js';

export type ConfirmationLevel = 'info' | 'warning' | 'danger';

export interface ConfirmationDialogProps {
  /** Dialog title */
  title: string;
  /** Main confirmation message */
  message: string;
  /** Optional detailed description */
  description?: string;
  /** Warning level (affects colors and icons) */
  level?: ConfirmationLevel;
  /** Confirm button label */
  confirmLabel?: string;
  /** Cancel button label */
  cancelLabel?: string;
  /** Icon to display */
  icon?: string;
  /** List of items that will be affected */
  affectedItems?: string[];
  /** Additional warning notes */
  warningNotes?: string[];
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when action is confirmed */
  onConfirm: () => Promise<void>;
}

/**
 * Get colors based on confirmation level
 */
function getLevelColors(level: ConfirmationLevel, theme: import('../../../config/types.js').Theme) {
  switch (level) {
    case 'danger':
      return {
        border: 'red',
        title: theme.status.error,
        icon: '⚠',
        confirmVariant: 'danger' as const,
      };
    case 'warning':
      return {
        border: 'yellow',
        title: theme.status.warning,
        icon: '⚠',
        confirmVariant: 'warning' as const,
      };
    case 'info':
    default:
      return {
        border: 'cyan',
        title: theme.status.info,
        icon: 'ℹ',
        confirmVariant: 'primary' as const,
      };
  }
}

/**
 * ConfirmationDialog Component
 * 
 * Generic confirmation dialog with customizable appearance and behavior.
 * Provides clear visual feedback for important user actions.
 */
export function ConfirmationDialog({
  title,
  message,
  description,
  level = 'warning',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon,
  affectedItems,
  warningNotes,
  onClose,
  onConfirm,
}: ConfirmationDialogProps) {
  const { state: { theme } } = useUI();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = getLevelColors(level, theme);
  const displayIcon = icon || colors.icon;

  /**
   * Handle confirmation
   */
  const handleConfirm = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      await onConfirm();
      // Close dialog after successful confirmation
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
      setIsProcessing(false);
    }
  }, [onConfirm, onClose]);

  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={70}
      borderColor={colors.border}
      titleColor={colors.title}
    >
      <Box flexDirection="column" paddingX={1}>
        {/* Main Message */}
        <Box flexDirection="column" marginBottom={2}>
          <Box>
            <Text bold color={colors.title}>
              {displayIcon} {message}
            </Text>
          </Box>
          {description && (
            <Box marginTop={1}>
              <Text color={theme.text.secondary}>{description}</Text>
            </Box>
          )}
        </Box>

        {/* Affected Items */}
        {affectedItems && affectedItems.length > 0 && (
          <Box flexDirection="column" marginBottom={2}>
            <Text bold>The following will be affected:</Text>
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
              {affectedItems.map((item, index) => (
                <Box key={index}>
                  <Text color={colors.title}>• </Text>
                  <Text>{item}</Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Warning Notes */}
        {warningNotes && warningNotes.length > 0 && (
          <Box
            marginBottom={2}
            borderStyle="single"
            borderColor={colors.border}
            padding={1}
          >
            <Box flexDirection="column">
              <Text color={colors.title}>{displayIcon} Important Notes:</Text>
              <Box marginTop={1} flexDirection="column">
                {warningNotes.map((note, index) => (
                  <Text key={index} dimColor>
                    • {note}
                  </Text>
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {/* Error Message */}
        {error && (
          <Box marginBottom={2}>
            <Text color={theme.status.error}>✗ {error}</Text>
          </Box>
        )}

        {/* Action Buttons */}
        <Box marginTop={1} gap={2}>
          <ButtonGroup
            buttons={[
              {
                label: confirmLabel,
                onPress: handleConfirm,
                variant: colors.confirmVariant,
                loading: isProcessing,
                disabled: isProcessing,
                shortcut: 'Enter',
              },
              {
                label: cancelLabel,
                onPress: onClose,
                variant: 'secondary',
                disabled: isProcessing,
                shortcut: 'Esc',
              },
            ]}
          />
        </Box>

        {/* Help Text */}
        <Box marginTop={2}>
          <Text dimColor>
            💡 Tip: Press Enter to confirm or Esc to cancel
          </Text>
        </Box>
      </Box>
    </Dialog>
  );
}

/**
 * Quick confirmation dialog for simple yes/no questions
 */
export interface QuickConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function QuickConfirm({ message, onConfirm: _onConfirm, onCancel: _onCancel }: QuickConfirmProps) {
  const { state: { theme } } = useUI();

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text color={theme.status.warning} bold>
          ⚠ {message}
        </Text>
      </Box>
      <Box gap={2}>
        <Text color={theme.text.secondary}>[Y] Yes</Text>
        <Text color={theme.text.secondary}>[N] No</Text>
      </Box>
    </Box>
  );
}
