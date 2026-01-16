/**
 * DialogManager - Renders active dialogs
 * 
 * Centralized component that renders the currently active dialog based on
 * dialog context state. Handles keyboard input and dialog positioning.
 */

import React from 'react';
import { Box, useInput } from 'ink';
import { useDialog } from '../../contexts/DialogContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { HookApprovalDialog } from './HookApprovalDialog.js';

/**
 * Manager component that renders active dialogs
 */
export function DialogManager() {
  const { state, closeDialog } = useDialog();
  const { state: uiState } = useUI();

  // Handle keyboard input for dialogs
  useInput((input, key) => {
    if (!state.isVisible || !state.activeDialog) {
      return;
    }

    // Handle Escape key to close any dialog
    if (key.escape) {
      closeDialog();
      return;
    }

    // Handle dialog-specific input
    switch (state.activeDialog.type) {
      case 'hookApproval': {
        const dialog = state.activeDialog;
        const lowerInput = input.toLowerCase();

        if (lowerInput === 'a') {
          dialog.onApprove();
        } else if (lowerInput === 'd') {
          dialog.onDeny();
        }
        break;
      }

      case 'confirmation': {
        const dialog = state.activeDialog;
        const lowerInput = input.toLowerCase();

        if (lowerInput === 'y' || key.return) {
          dialog.onConfirm();
        } else if (lowerInput === 'n') {
          dialog.onCancel();
        }
        break;
      }

      case 'error':
      case 'info': {
        const dialog = state.activeDialog;
        if (key.return || input === ' ') {
          dialog.onClose();
        }
        break;
      }
    }
  });

  // Don't render anything if no dialog is active
  if (!state.isVisible || !state.activeDialog) {
    return null;
  }

  // Render dialog overlay
  return (
    <Box
      position="absolute"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      flexDirection="column"
    >
      {/* Semi-transparent backdrop */}
      <Box
        position="absolute"
        width="100%"
        height="100%"
        backgroundColor="black"
        opacity={0.7}
      />

      {/* Dialog content */}
      <Box position="relative" zIndex={1000}>
        {state.activeDialog.type === 'hookApproval' && (
          <HookApprovalDialog
            hook={state.activeDialog.hook}
            hash={state.activeDialog.hash}
            theme={uiState.theme}
            onApprove={state.activeDialog.onApprove}
            onDeny={state.activeDialog.onDeny}
            visible={true}
          />
        )}

        {state.activeDialog.type === 'confirmation' && (
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={uiState.theme.border.accent}
            padding={1}
            width="60%"
          >
            <Box marginBottom={1}>
              <Box color={uiState.theme.text.accent} bold>
                {state.activeDialog.title}
              </Box>
            </Box>
            <Box marginBottom={1}>
              <Box color={uiState.theme.text.primary}>
                {state.activeDialog.message}
              </Box>
            </Box>
            <Box>
              <Box color={uiState.theme.text.muted} dimColor>
                Press Y to confirm, N to cancel, or Esc to close
              </Box>
            </Box>
          </Box>
        )}

        {state.activeDialog.type === 'error' && (
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={uiState.theme.status.error}
            padding={1}
            width="60%"
          >
            <Box marginBottom={1}>
              <Box color={uiState.theme.status.error} bold>
                ❌ {state.activeDialog.title}
              </Box>
            </Box>
            <Box marginBottom={1}>
              <Box color={uiState.theme.text.primary}>
                {state.activeDialog.message}
              </Box>
            </Box>
            <Box>
              <Box color={uiState.theme.text.muted} dimColor>
                Press Enter or Space to close
              </Box>
            </Box>
          </Box>
        )}

        {state.activeDialog.type === 'info' && (
          <Box
            flexDirection="column"
            borderStyle="double"
            borderColor={uiState.theme.border.accent}
            padding={1}
            width="60%"
          >
            <Box marginBottom={1}>
              <Box color={uiState.theme.text.accent} bold>
                ℹ️  {state.activeDialog.title}
              </Box>
            </Box>
            <Box marginBottom={1}>
              <Box color={uiState.theme.text.primary}>
                {state.activeDialog.message}
              </Box>
            </Box>
            <Box>
              <Box color={uiState.theme.text.muted} dimColor>
                Press Enter or Space to close
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
