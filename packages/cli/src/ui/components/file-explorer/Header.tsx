/**
 * Header - File Explorer header component
 *
 * Displays the current mode (Browse/Workspace), active project, and
 * provides visual context for the file explorer state.
 *
 * Requirements: 11.1 (Display current mode in header)
 */

import React from 'react';
import { Box, Text } from 'ink';

import { useWorkspace } from './WorkspaceContext.js';

/**
 * Props for Header component
 */
export interface HeaderProps {
  /** Optional title to display */
  title?: string;
}

/**
 * Header component
 *
 * Displays:
 * - File Explorer title
 * - Current mode (Browse/Workspace)
 * - Active project name (if in workspace mode)
 * - Root path
 */
export function Header({ title = 'File Explorer' }: HeaderProps) {
  const { state } = useWorkspace();

  // Format mode display
  const modeDisplay = state.mode === 'workspace' ? 'Workspace' : 'Browse';
  const modeColor = state.mode === 'workspace' ? 'cyan' : 'green';

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Title and mode */}
      <Box flexDirection="row">
        <Text bold color="blue">
          {title}
        </Text>
        <Text> - </Text>
        <Text bold color={modeColor}>
          {modeDisplay} Mode
        </Text>
      </Box>

      {/* Active project (if in workspace mode) */}
      {state.mode === 'workspace' && state.activeProject && (
        <Box flexDirection="row">
          <Text dimColor>Project: </Text>
          <Text color="yellow">{state.activeProject}</Text>
        </Box>
      )}

      {/* Root path */}
      <Box flexDirection="row">
        <Text dimColor>Path: </Text>
        <Text>{state.rootPath}</Text>
      </Box>

      {/* Separator */}
      <Box marginTop={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>
    </Box>
  );
}
