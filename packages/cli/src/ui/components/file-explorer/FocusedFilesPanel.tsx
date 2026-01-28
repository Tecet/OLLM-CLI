/**
 * FocusedFilesPanel - Display panel for focused files
 *
 * Shows all files that are currently focused for LLM context injection.
 * Displays file paths, sizes, truncation warnings, and total content size.
 *
 * Requirements: 3.5 (Display focused files in context panel)
 */

import React from 'react';
import { Box, Text } from 'ink';

import { useFileFocus } from './FileFocusContext.js';

/**
 * Props for FocusedFilesPanel component
 */
export interface FocusedFilesPanelProps {
  /** Optional title for the panel */
  title?: string;
  /** Whether to show detailed information (sizes, warnings) */
  showDetails?: boolean;
}

/**
 * Format bytes to human-readable size
 *
 * Converts byte count to KB, MB, etc. with appropriate precision.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 KB", "2.3 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Show 1 decimal place for values >= 1KB
  const formatted = i > 0 ? value.toFixed(1) : value.toString();

  return `${formatted} ${sizes[i]}`;
}

/**
 * Get relative path for display
 *
 * Shortens absolute paths by showing only the last few segments
 * to make the display more compact.
 *
 * @param absolutePath - Full absolute path
 * @param maxSegments - Maximum number of path segments to show
 * @returns Shortened path with ellipsis if truncated
 */
function getDisplayPath(absolutePath: string, maxSegments: number = 3): string {
  const segments = absolutePath.split(/[/\\]/);

  if (segments.length <= maxSegments) {
    return absolutePath;
  }

  // Show last N segments with ellipsis
  const displaySegments = segments.slice(-maxSegments);
  return `.../${displaySegments.join('/')}`;
}

/**
 * FocusedFilesPanel component
 *
 * Renders a panel showing all focused files with their metadata:
 * - File paths (with focus indicator 📌)
 * - File sizes
 * - Truncation warnings for files exceeding 8KB
 * - Total focused content size
 *
 * The panel is designed to be compact and informative, providing
 * users with visibility into what content is being injected into
 * the LLM context.
 */
export function FocusedFilesPanel({
  title = 'Focused Files',
  showDetails = true,
}: FocusedFilesPanelProps) {
  const { getAllFocusedFiles, state } = useFileFocus();
  const focusedFiles = getAllFocusedFiles();

  // If no focused files, show empty state
  if (focusedFiles.length === 0) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        <Text bold color="cyan">
          {title}
        </Text>
        <Text dimColor>No files focused</Text>
        <Text dimColor>Press 'f' on a file to focus it</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      {/* Panel header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color="cyan">
          {title}
        </Text>
        <Text dimColor>
          ({focusedFiles.length} file{focusedFiles.length !== 1 ? 's' : ''})
        </Text>
      </Box>

      {/* Focused files list */}
      <Box flexDirection="column" marginTop={1}>
        {focusedFiles.map((file, index) => (
          <Box
            key={file.path}
            flexDirection="column"
            marginBottom={index < focusedFiles.length - 1 ? 1 : 0}
          >
            {/* File path with focus indicator */}
            <Box flexDirection="row">
              <Text>📌 </Text>
              <Text color="green">{getDisplayPath(file.path)}</Text>
            </Box>

            {/* File details (size and truncation warning) */}
            {showDetails && (
              <Box flexDirection="column" marginLeft={3}>
                {/* File size */}
                <Text dimColor>Size: {formatBytes(file.size)}</Text>

                {/* Truncation warning */}
                {file.truncated && (
                  <Text color="yellow">⚠ Truncated at {formatBytes(8192)} (content too large)</Text>
                )}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Total size footer */}
      {showDetails && (
        <Box flexDirection="row" marginTop={1} borderTop borderColor="gray">
          <Text dimColor>Total content size: </Text>
          <Text bold>{formatBytes(state.totalSize)}</Text>
        </Box>
      )}
    </Box>
  );
}
