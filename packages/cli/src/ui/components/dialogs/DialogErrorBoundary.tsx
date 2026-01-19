/**
 * Dialog Error Boundary
 * 
 * Wraps dialog components with error boundary to prevent dialog errors
 * from crashing the entire MCP panel.
 */

import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { ErrorBoundary } from '../ErrorBoundary.js';

export interface DialogErrorBoundaryProps {
  children: ReactNode;
  onClose: () => void;
  dialogName?: string;
}

/**
 * Error boundary specifically for dialog components
 */
export function DialogErrorBoundary({ 
  children, 
  _onClose, 
  dialogName = 'Dialog' 
}: DialogErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <Box
          flexDirection="column"
          padding={2}
          borderStyle="round"
          borderColor="red"
        >
          <Text color="red" bold>
            ❌ {dialogName} Error
          </Text>
          
          <Box marginTop={1}>
            <Text>{error.message}</Text>
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>
              The dialog encountered an error and cannot be displayed.
            </Text>
          </Box>
          
          <Box marginTop={1}>
            <Text dimColor>Press </Text>
            <Text bold color="cyan">Esc</Text>
            <Text dimColor> to close this dialog</Text>
          </Box>
        </Box>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
