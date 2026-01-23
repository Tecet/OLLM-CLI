/**
 * OperationProgress Component
 * 
 * Displays progress for ongoing MCP operations (restart, install, etc.)
 * Shows as an overlay or notification in the MCP panel.
 * 
 * Validates: NFR-7
 */

import React from 'react';
import { Box } from 'ink';

import { ProgressIndicator } from './ProgressIndicator.js';

export interface OperationProgressProps {
  /** Map of server name to operation type */
  operations: Map<string, 'restart' | 'install' | 'uninstall' | 'configure'>;
}

/**
 * OperationProgress Component
 * 
 * Displays all ongoing operations as progress indicators.
 * Typically shown at the bottom of the MCP panel.
 */
export function OperationProgress({ operations }: OperationProgressProps) {
  if (operations.size === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" gap={1}>
      {Array.from(operations.entries()).map(([serverName, operation]) => (
        <ProgressIndicator
          key={serverName}
          operation={operation}
          serverName={serverName}
        />
      ))}
    </Box>
  );
}
