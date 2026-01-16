import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';

/**
 * Git status information
 */
export interface GitStatus {
  branch: string;
  staged: number;
  modified: number;
  untracked: number;
}

/**
 * Context file information
 */
export interface ContextFile {
  path: string;
  type: 'file' | 'symbol' | 'url';
  size?: number;
}

export interface FilesTabProps {
  /** Context files currently loaded */
  contextFiles?: ContextFile[];
  
  /** Git status */
  gitStatus?: GitStatus;
  
  /** Callback when a file is added to context */
  onAddFile?: (path: string) => void;
  
  /** Callback when a file is removed from context */
  onRemoveFile?: (path: string) => void;
  
  /** Callback for git actions */
  onGitAction?: (action: 'commit' | 'stash' | 'diff') => void;
}

/**
 * FilesTab component
 * 
 * Displays context files list and git status.
 * Allows adding/removing files from context.
 * Provides quick git actions.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function FilesTab({
  contextFiles = [],
  gitStatus,
  onAddFile,
  onRemoveFile,
  onGitAction,
}: FilesTabProps) {
  const { state: uiState } = useUI();
  const theme = uiState.theme as any;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleAddFile = () => {
    // In a real implementation, this would open a file picker
    // For now, just a placeholder
    console.log('Add file to context');
  };

  const handleRemoveFile = (path: string) => {
    if (onRemoveFile) {
      onRemoveFile(path);
    }
  };

  const handleGitAction = (action: 'commit' | 'stash' | 'diff') => {
    if (onGitAction) {
      onGitAction(action);
    }
  };

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* Context Files Section */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiState.theme.text.accent}
        paddingX={1}
        marginBottom={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color={uiState.theme.text.accent}>
            Context Files ({contextFiles.length})
          </Text>
          <Text color={uiState.theme.status.info}>
            [+] Add File
          </Text>
        </Box>

        {contextFiles.length === 0 ? (
          <Box paddingY={1}>
            <Text color={uiState.theme.text.secondary}>
              No files in context. Use @-mentions to add files.
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {contextFiles.map((file) => {
              const isSelected = selectedFile === file.path;
              const icon = file.type === 'file' ? '📄' : file.type === 'symbol' ? '🔍' : '🌐';
              
              return (
                <Box
                  key={file.path}
                  justifyContent="space-between"
                  borderStyle={isSelected ? 'single' : undefined}
                  borderColor={isSelected ? uiState.theme.text.accent : undefined}
                  paddingX={1}
                  marginBottom={1}
                >
                  <Box>
                    <Text color={uiState.theme.text.primary}>
                      {icon} {file.path}
                    </Text>
                    {file.size && (
                      <Text color={uiState.theme.text.secondary} dimColor>
                        {' '}({Math.round(file.size / 1024)}KB)
                      </Text>
                    )}
                  </Box>
                  <Text color={theme.status.error}>
                    [×] Remove
                  </Text>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Git Status Section */}
      {gitStatus && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={uiState.theme.text.accent}
          paddingX={1}
          marginBottom={1}
          flexShrink={0}
        >
          <Text bold color={uiState.theme.text.accent} marginBottom={1}>
            Git Status
          </Text>

          <Box flexDirection="column" gap={1}>
            <Box>
              <Text color={uiState.theme.text.primary}>
                Branch: <Text color={uiState.theme.status.info}>{gitStatus.branch}</Text>
              </Text>
            </Box>

            {gitStatus.staged > 0 && (
              <Box>
                <Text color={uiState.theme.diff.added}>
                  ✓ {gitStatus.staged} staged
                </Text>
              </Box>
            )}

            {gitStatus.modified > 0 && (
              <Box>
                <Text color={uiState.theme.status.warning}>
                  ● {gitStatus.modified} modified
                </Text>
              </Box>
            )}

            {gitStatus.untracked > 0 && (
              <Box>
                <Text color={uiState.theme.text.secondary}>
                  ? {gitStatus.untracked} untracked
                </Text>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {/* Git Actions Section */}
      {gitStatus && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={uiState.theme.text.secondary}
          paddingX={1}
          flexShrink={0}
        >
          <Text bold color={uiState.theme.text.secondary} marginBottom={1}>
            Quick Actions
          </Text>

          <Box flexDirection="column" gap={1}>
            <Box>
              <Text color={uiState.theme.status.success}>
                [c] Commit Changes
              </Text>
            </Box>
            <Box>
              <Text color={uiState.theme.status.warning}>
                [s] Stash Changes
              </Text>
            </Box>
            <Box>
              <Text color={uiState.theme.status.info}>
                [d] View Diff
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Empty state when no git status */}
      {!gitStatus && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={uiState.theme.text.secondary}
          paddingX={1}
          flexShrink={0}
        >
          <Text color={theme.text.secondary}>
            Not in a git repository
          </Text>
        </Box>
      )}
    </Box>
  );
}
