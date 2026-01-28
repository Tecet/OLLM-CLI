import React from 'react';
import { Box, Text, useInput } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { PlannedFeaturesList } from '../github/PlannedFeaturesList.js';

/**
 * GitHubTab Component
 *
 * Placeholder UI for GitHub integration panel.
 *
 * Displays:
 * - "Coming Soon" heading
 * - Brief description
 * - List of planned features organized by category
 * - Link to Stage-11 specification
 *
 * @see .kiro/specs/stage-11-developer-productivity-future-dev/
 */
export const GitHubTab: React.FC<{ width?: number }> = ({ width }) => {
  const { isFocused, exitToNavBar } = useFocusManager();
  const { state: uiState } = useUI();
  const hasFocus = isFocused('github-tab');

  // Handle keyboard input
  useInput(
    (input, key) => {
      // Allow ESC to bubble to global handler
      if (key.escape) return;

      if (input === '0') {
        exitToNavBar();
      }
      // Allow enter to also exit as there's nothing to select yet
      if (key.return) {
        exitToNavBar();
      }
    },
    { isActive: hasFocus }
  );

  return (
    <Box flexDirection="column" height="100%" width={width}>
      {/* Header */}
      <Box
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              🚧 GitHub Integration
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text
              wrap="truncate-end"
              color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}
            >
              Enter:Return 0/Esc:Exit
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Content area */}
      <Box
        flexDirection="column"
        flexGrow={1}
        padding={2}
        borderStyle={uiState.theme.border.style as import('ink').BoxProps['borderStyle']}
        borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
      >
        {/* Heading - centered with space above and below */}
        <Box justifyContent="center" marginTop={1} marginBottom={1}>
          <Text bold color={hasFocus ? uiState.theme.text.accent : 'yellow'}>
            🚧 Coming Soon 🚧
          </Text>
        </Box>

        {/* Description - with space below */}
        <Box marginBottom={2} justifyContent="center">
          <Text>GitHub integration will be available in a future release v0.7.0</Text>
        </Box>

        {/* Features Section Label - with space below */}
        <Box flexDirection="column" marginBottom={1}>
          <Text bold color={uiState.theme.text.primary}>
            Planned Features:
          </Text>
        </Box>

        <PlannedFeaturesList />

        {/* Documentation Link - with space above */}
        <Box marginTop={2}>
          <Text dimColor>
            For more information, see: https://github.com/Tecet/OLLM/tree/main/docs
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
