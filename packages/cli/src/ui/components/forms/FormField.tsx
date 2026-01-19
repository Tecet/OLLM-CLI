/**
 * FormField - Wrapper component for form fields with label
 * 
 * Features:
 * - Label display
 * - Error message display
 * - Consistent spacing
 * - Theme-aware styling
 * 
 * Validates: Requirements NFR-7, NFR-9
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';

export interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}

/**
 * FormField component - wraps form inputs with label and error display
 */
export function FormField({
  label,
  error,
  required = false,
  helpText,
  children,
}: FormFieldProps) {
  const { state: uiState } = useUI();

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Label */}
      <Box>
        <Text color={uiState.theme.text.primary} bold>
          {label}
          {required && <Text color={uiState.theme.status.error}>*</Text>}
        </Text>
      </Box>

      {/* Input */}
      <Box marginLeft={2}>{children}</Box>

      {/* Help text */}
      {helpText && !error && (
        <Box marginLeft={2}>
          <Text color={uiState.theme.text.secondary} dimColor>
            {helpText}
          </Text>
        </Box>
      )}

      {/* Error message */}
      {error && (
        <Box marginLeft={2}>
          <Text color={uiState.theme.status.error}>⚠ {error}</Text>
        </Box>
      )}
    </Box>
  );
}
