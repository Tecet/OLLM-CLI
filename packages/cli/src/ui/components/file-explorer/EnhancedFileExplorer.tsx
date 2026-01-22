/**
 * EnhancedFileExplorer - Improved UI wrapper for File Explorer
 * 
 * Provides a more user-friendly interface with:
 * - Header with breadcrumbs and stats
 * - Action toolbar
 * - Better visual hierarchy
 * - Status indicators
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { FileExplorerComponent, FileExplorerComponentProps } from './FileExplorerComponent.js';

interface EnhancedFileExplorerProps extends FileExplorerComponentProps {
  /** Window width for responsive layout */
  width?: number;
  /** Window height for responsive layout */
  height?: number;
  /** Show header with breadcrumbs */
  showHeader?: boolean;
  /** Show action toolbar */
  showToolbar?: boolean;
  /** Show status bar */
  showStatusBar?: boolean;
}

/**
 * EnhancedFileExplorer - User-friendly File Explorer with enhanced UI
 */
export function EnhancedFileExplorer({
  width = 80,
  height = 40,
  showHeader = true,
  showToolbar = true,
  showStatusBar = true,
  rootPath,
  ...props
}: EnhancedFileExplorerProps) {
  const [stats, _setStats] = useState({
    totalFiles: 0,
    focusedFiles: 0,
    gitStatus: 'clean' as 'clean' | 'modified' | 'untracked',
  });

  // Calculate layout dimensions
  const headerHeight = showHeader ? 3 : 0;
  const toolbarHeight = showToolbar ? 2 : 0;
  const statusBarHeight = showStatusBar ? 1 : 0;
  const contentHeight = height - headerHeight - toolbarHeight - statusBarHeight;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header with breadcrumbs and info */}
      {showHeader && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          height={headerHeight}
        >
          <Box flexDirection="row" justifyContent="space-between">
            <Box flexDirection="row" gap={1}>
              <Text color="cyan" bold>📁</Text>
              <Text color="cyan" bold>File Explorer</Text>
            </Box>
            <Box flexDirection="row" gap={2}>
              <Text dimColor>
                {stats.totalFiles} files
              </Text>
              {stats.focusedFiles > 0 && (
                <Text color="yellow">
                  📌 {stats.focusedFiles} focused
                </Text>
              )}
              {stats.gitStatus !== 'clean' && (
                <Text color="yellow">
                  ⚠️ {stats.gitStatus}
                </Text>
              )}
            </Box>
          </Box>
          <Box>
            <Text dimColor>
              📂 {rootPath || process.cwd()}
            </Text>
          </Box>
        </Box>
      )}

      {/* Action Toolbar */}
      {showToolbar && (
        <Box
          flexDirection="row"
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          height={toolbarHeight}
          justifyContent="space-between"
        >
          <Box flexDirection="row" gap={2}>
            <Text dimColor>
              <Text color="cyan">F</Text> Focus
            </Text>
            <Text dimColor>
              <Text color="cyan">E</Text> Edit
            </Text>
            <Text dimColor>
              <Text color="cyan">N</Text> New
            </Text>
            <Text dimColor>
              <Text color="cyan">D</Text> Delete
            </Text>
            <Text dimColor>
              <Text color="cyan">R</Text> Rename
            </Text>
          </Box>
          <Box flexDirection="row" gap={2}>
            <Text dimColor>
              <Text color="cyan">Ctrl+P</Text> Quick Open
            </Text>
            <Text dimColor>
              <Text color="cyan">?</Text> Help
            </Text>
          </Box>
        </Box>
      )}

      {/* Main File Explorer Content */}
      <Box flexGrow={1} height={contentHeight}>
        <FileExplorerComponent
          rootPath={rootPath}
          {...props}
          onStateRestored={() => {
            // Update stats when state is restored
            props.onStateRestored?.();
          }}
        />
      </Box>

      {/* Status Bar */}
      {showStatusBar && (
        <Box
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          height={statusBarHeight}
          justifyContent="space-between"
          flexDirection="row"
        >
          <Box flexDirection="row" gap={2}>
            <Text color="green">●</Text>
            <Text dimColor>Ready</Text>
          </Box>
          <Box flexDirection="row" gap={2}>
            <Text dimColor>
              {props.toolRegistry ? '🔧 Tools' : ''}
            </Text>
            <Text dimColor>
              {props.policyEngine ? '🛡️ Policy' : ''}
            </Text>
            <Text dimColor>
              {props.messageBus ? '🔔 Hooks' : ''}
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
