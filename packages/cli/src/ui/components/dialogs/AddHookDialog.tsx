/**
 * AddHookDialog - Dialog for creating new hooks
 * 
 * Features:
 * - Form fields for hook configuration
 * - Validation for required fields
 * - Save and cancel actions
 * 
 * Requirements: 3.1, 3.2, 3.3, 6.1
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import type { HookEvent } from '@ollm/ollm-cli-core/hooks/types.js';

export interface HookFormData {
  name: string;
  command: string;
  args: string[];
}

export interface ValidationErrors {
  name?: string;
  command?: string;
  args?: string;
}

export interface AddHookDialogProps {
  onSave: (formData: HookFormData) => Promise<void>;
  onCancel: () => void;
}

/**
 * Validate hook form data
 */
function validateHookForm(formData: HookFormData): ValidationErrors {
  const errors: ValidationErrors = {};

  // Name is required
  if (!formData.name || formData.name.trim() === '') {
    errors.name = 'Name is required';
  }

  // Command is required
  if (!formData.command || formData.command.trim() === '') {
    errors.command = 'Command is required';
  }

  return errors;
}

/**
 * AddHookDialog component
 */
export function AddHookDialog({ onSave, onCancel }: AddHookDialogProps) {
  const { state: uiState } = useUI();

  const [formData, setFormData] = useState<HookFormData>({
    name: '',
    command: '',
    args: [],
  });

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    // Validate form
    const validationErrors = validateHookForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Save hook
    setIsSaving(true);
    try {
      await onSave(formData);
      // Dialog will be closed by parent
    } catch (error) {
      setErrors({
        name: error instanceof Error ? error.message : 'Failed to save hook',
      });
      setIsSaving(false);
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
          Add New Hook
        </Text>
      </Box>

      {/* Form fields */}
      <Box flexDirection="column" gap={1}>
        {/* Name field */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Name:</Text>
          <Text color={uiState.theme.text.secondary} dimColor>
            {formData.name || '(enter name)'}
          </Text>
          {errors.name && (
            <Text color={uiState.theme.status.error}>{errors.name}</Text>
          )}
        </Box>

        {/* Command field */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Command:</Text>
          <Text color={uiState.theme.text.secondary} dimColor>
            {formData.command || '(enter command)'}
          </Text>
          {errors.command && (
            <Text color={uiState.theme.status.error}>{errors.command}</Text>
          )}
        </Box>

        {/* Args field */}
        <Box flexDirection="column">
          <Text color={uiState.theme.text.primary}>Arguments:</Text>
          <Text color={uiState.theme.text.secondary} dimColor>
            {formData.args.length > 0 ? formData.args.join(' ') : '(optional)'}
          </Text>
        </Box>
      </Box>

      {/* Actions */}
      <Box marginTop={2} gap={2}>
        <Text color={isSaving ? 'gray' : 'green'}>
          {isSaving ? 'Saving...' : '[S] Save'}
        </Text>
        <Text color="red">[C] Cancel</Text>
      </Box>

      {/* Instructions */}
      <Box marginTop={1}>
        <Text color={uiState.theme.text.secondary} dimColor>
          Note: This is a placeholder dialog. Full form editing will be implemented in a future update.
        </Text>
      </Box>
    </Box>
  );
}
