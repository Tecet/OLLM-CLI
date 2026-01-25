/**
 * ModeSuggestionDialog - Mode transition suggestion component
 * 
 * Displays proactive suggestions for mode transitions to help users
 * discover and navigate the mode system effectively.
 */

import React from 'react';
import { Box, Text } from 'ink';

import type { Theme } from '../../../config/types.js';
import type { ModeTransitionSuggestion } from '@ollm/ollm-cli-core';

export interface ModeSuggestionDialogProps {
  /** The mode transition suggestion */
  suggestion: ModeTransitionSuggestion | null;
  /** Currently selected option index */
  selectedIndex: number;
  /** Theme for styling */
  theme: Theme;
  /** Whether dialog is visible */
  visible: boolean;
}

/**
 * Mode icons for visual display
 */
const MODE_ICONS: Record<string, string> = {
  assistant: '💬',
  planning: '📋',
  developer: '👨‍💻',
  debugger: '🐛'
};

/**
 * Dialog for suggesting mode transitions
 */
export function ModeSuggestionDialog({
  suggestion,
  selectedIndex,
  theme,
  visible,
}: ModeSuggestionDialogProps) {
  if (!visible || !suggestion) {
    return null;
  }

  const options = [
    'Yes, switch mode',
    'No, stay in current mode',
    "Don't ask again for this transition"
  ];

  const suggestedModeIcon = MODE_ICONS[suggestion.suggestedMode] || '🔄';
  const currentModeIcon = MODE_ICONS[suggestion.currentMode] || '🔄';
  
  // Format confidence as percentage
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.text.accent}
      padding={1}
      width="70%"
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          💡 Mode Suggestion
        </Text>
      </Box>

      {/* Current and suggested modes */}
      <Box marginBottom={1} paddingX={1} flexDirection="column">
        <Box>
          <Text color={theme.text.secondary}>
            Current mode: {currentModeIcon} {suggestion.currentMode}
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.accent} bold>
            Suggested mode: {suggestedModeIcon} {suggestion.suggestedMode}
          </Text>
        </Box>
      </Box>

      {/* Reason */}
      <Box marginBottom={1} paddingX={1}>
        <Text color={theme.text.primary}>{suggestion.reason}</Text>
      </Box>

      {/* Confidence indicator */}
      <Box
        marginBottom={1}
        paddingX={1}
        borderStyle="single"
        borderColor={theme.border.secondary}
        flexDirection="column"
      >
        <Box>
          <Text color={theme.text.secondary}>
            Confidence: {confidencePercent}%
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text color={theme.text.accent}>
            {'█'.repeat(Math.floor(confidencePercent / 5))}
            <Text color={theme.text.secondary} dimColor>
              {'░'.repeat(20 - Math.floor(confidencePercent / 5))}
            </Text>
          </Text>
        </Box>
      </Box>

      {/* Additional context (if available) */}
      {suggestion.context && (
        <Box marginBottom={1} paddingX={1} flexDirection="column">
          {suggestion.context.errorCount !== undefined && (
            <Box>
              <Text color={theme.status.warning}>
                ⚠️  {suggestion.context.errorCount} error(s) detected
              </Text>
            </Box>
          )}
          {suggestion.context.planComplete && (
            <Box>
              <Text color={theme.status.success}>
                ✓ Plan appears complete
              </Text>
            </Box>
          )}
          {suggestion.context.hasTechnicalTerms && (
            <Box>
              <Text color={theme.status.info}>
                ℹ️  Technical implementation detected
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Options */}
      <Box flexDirection="column" marginBottom={1} paddingX={1}>
        <Box marginBottom={1}>
          <Text color={theme.text.secondary}>What would you like to do?</Text>
        </Box>

        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Box key={index} marginLeft={2}>
              <Text
                color={isSelected ? theme.text.accent : theme.text.primary}
                bold={isSelected}
              >
                {isSelected ? '▶ ' : '  '}
                {option}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Instructions */}
      <Box paddingX={1}>
        <Text color={theme.text.secondary} dimColor>
          Use ↑/↓ to navigate, Enter to select, Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}
