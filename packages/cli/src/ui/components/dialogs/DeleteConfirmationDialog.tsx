/**
 * DeleteConfirmationDialog - Confirmation dialog for deleting hooks
 * 
 * Features:
 * - Shows hook name and warning message
 * - Confirm and cancel buttons
 * - Built-in hook protection
 * - Visual warning styling
 * 
 * Requirements: 3.6, 3.7
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';

export interface DeleteConfirmationDialogProps {
  hook: Hook;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isDeletable: boolean;
}

/**
 * DeleteConfirmationDialog component
 */
export function DeleteConfirmationDialog({
  hook,
  onConfirm,
  _onCancel,
  isDeletable,
}: DeleteConfirmationDialogProps) {
  const { state: uiState } = useUI();
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if hook is deletable
  if (!isDeletable) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={uiState.theme.status.error}
        padding={1}
        width={60}
      >
        <Box marginBottom={1}>
          <Text bold color="red">
            ⚠ Cannot Delete Hook
          </Text>
        </Box>

        <Box marginBottom={2}>
          <Text color={uiState.theme.text.primary}>
            Built-in hooks cannot be deleted. You can only disable them.
          </Text>
        </Box>

        <Box>
          <Text color="yellow">[Esc] Close</Text>
        </Box>
      </Box>
    );
  }

  const _handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      // Dialog will be closed by parent
    } catch {
      setIsDeleting(false);
      // Error will be handled by parent
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={uiState.theme.status.error}
      padding={1}
      width={60}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color="red">
          ⚠ Delete Hook?
        </Text>
      </Box>

      {/* Warning message */}
      <Box flexDirection="column" marginBottom={2}>
        <Text color={uiState.theme.text.primary}>
          Are you sure you want to delete "{hook.name}"?
        </Text>
        <Box marginTop={1}>
          <Text color={uiState.theme.status.warning} bold>
            This action cannot be undone.
          </Text>
        </Box>
      </Box>

      {/* Hook details */}
      <Box flexDirection="column" marginBottom={2}>
        <Text color={uiState.theme.text.secondary} dimColor>
          Hook ID: {hook.id}
        </Text>
        <Text color={uiState.theme.text.secondary} dimColor>
          Source: {hook.source}
        </Text>
      </Box>

      {/* Actions */}
      <Box gap={2}>
        <Text color={isDeleting ? 'gray' : 'red'}>
          {isDeleting ? 'Deleting...' : '[D] Delete'}
        </Text>
        <Text color="yellow">[C] Cancel</Text>
      </Box>
    </Box>
  );
}
