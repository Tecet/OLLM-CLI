import React from 'react';
import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';

export interface DiffViewerProps {
  /** The diff content to display */
  diff: string;

  /** File name */
  fileName: string;

  /** Theme for styling */
  theme: Theme;

  /** Whether to show line numbers */
  showLineNumbers?: boolean;
}

/**
 * DiffViewer component
 *
 * Displays a diff with syntax highlighting.
 * Shows added lines in green, removed lines in red.
 * Supports line numbers and file name header.
 */
export function DiffViewer({ diff, fileName, theme, showLineNumbers = true }: DiffViewerProps) {
  const lines = diff.split('\n');

  const renderLine = (line: string, index: number) => {
    let color = theme.text.primary;
    let prefix = ' ';

    if (line.startsWith('+')) {
      color = theme.diff.added;
      prefix = '+';
    } else if (line.startsWith('-')) {
      color = theme.diff.removed;
      prefix = '-';
    } else if (line.startsWith('@@')) {
      color = theme.text.accent;
      prefix = '@';
    }

    const content = line.substring(1) || ' ';
    const lineNumber = showLineNumbers ? `${(index + 1).toString().padStart(4, ' ')} ` : '';

    return (
      <Box key={index}>
        {showLineNumbers && <Text color={theme.text.secondary}>{lineNumber}</Text>}
        <Text color={color}>
          {prefix} {content}
        </Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.text.secondary}>
      {/* File header */}
      <Box borderStyle="single" borderColor={theme.text.accent} paddingX={1}>
        <Text bold color={theme.text.accent}>
          {fileName}
        </Text>
      </Box>

      {/* Diff content */}
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {lines.map((line, index) => renderLine(line, index))}
      </Box>
    </Box>
  );
}
