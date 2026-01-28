/**
 * EditHookDialog - Dialog for editing existing hooks
 *
 * Features:
 * - Pre-populated form with existing hook data
 * - Form validation
 * - Built-in hook protection
 * - Save and cancel actions
 *
 * Requirements: 3.4, 3.5, 6.1
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';

import { useUI } from '../../../features/context/UIContext.js';

import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';

export interface EditHookDialogProps {
  hook: Hook;
  onSave: (hookId: string, updates: Partial<Hook>) => Promise<void>;
  onCancel: () => void;
  isEditable: boolean;
}

/**
 * EditHookDialog component
 */
export function EditHookDialog({
  hook,
  onSave: _onSave,
  onCancel: _onCancel,
  isEditable,
}: EditHookDialogProps) {
  const { state: uiState } = useUI();

  const [formData, _setFormData] = useState({
    name: hook.name,
    command: hook.command,
    args: hook.args || [],
  });

  const [errors, _setErrors] = useState<Record<string, string>>({});
  const [isSaving, _setIsSaving] = useState(false);

  // Check if hook is editable
  if (!isEditable) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={uiState.theme.border.active}
        padding={1}
        width={60}
      >
        <Box marginBottom={1}>
          <Text bold color="yellow">
            Cannot Edit Hook
          </Text>
        </Box>

        <Box marginBottom={2}>
          <Text color={uiState.theme.text.primary}>
            Built-in hooks cannot be edited. You can only enable/disable them.
          </Text>
        </Box>

        <Box>
          <Text color="red">[Esc] Close</Text>
        </Box>
      </Box>
    );
  }

  const _handleSave = async () => {
    // Validate form
    const validationErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim() === '') {
      validationErrors.name = 'Name is required';
    }

    if (!formData.command || formData.command.trim() === '') {
      validationErrors.command = 'Command is required';
    }

    if (Object.keys(validationErrors).length > 0) {
      _setErrors(validationErrors);
      return;
    }

    // Save updates
    _setIsSaving(true);
    try {
      await _onSave(hook.id, {
        name: formData.name,
        command: formData.command,
        args: formData.args.length > 0 ? formData.args : undefined,
      });
      // Dialog will be closed by parent
    } catch (error) {
      _setErrors({
        name: error instanceof Error ? error.message : 'Failed to update hook',
      });
      _setIsSaving(false);
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={uiState.theme.border.active}
      padding={1}
      width={60}
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Edit Hook: {hook.name}
        </Text>
      </Box>

      {/* Form fields */}
      <Box flexDirection="column" gap={1}>
        {/* Name field */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Name:</Text>
          <Text color={uiState.theme.text.secondary}>{formData.name}</Text>
          {errors.name && <Text color={uiState.theme.status.error}>{errors.name}</Text>}
        </Box>

        {/* Command field */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Command:</Text>
          <Text color={uiState.theme.text.secondary}>{formData.command}</Text>
          {errors.command && <Text color={uiState.theme.status.error}>{errors.command}</Text>}
        </Box>

        {/* Args field */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Arguments:</Text>
          <Text color={uiState.theme.text.secondary} dimColor>
            {formData.args.length > 0 ? formData.args.join(' ') : '(none)'}
          </Text>
        </Box>

        {/* Source (read-only) */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Source:</Text>
          <Text color={uiState.theme.text.secondary} dimColor>
            {hook.source} (read-only)
          </Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box marginTop={2} gap={2}>
        <Text color={isSaving ? 'gray' : 'green'}>{isSaving ? 'Saving...' : '[S] Save'}</Text>
        <Text color="red">[C] Cancel</Text>
      </Box>

      {/* Instructions */}
      <Box marginTop={1}>
        <Text color={uiState.theme.text.secondary} dimColor>
          Note: This is a placeholder dialog. Full form editing will be implemented in a future
          update.
        </Text>
      </Box>
    </Box>
  );
}
