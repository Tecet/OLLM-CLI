import React from 'react';
import { Box, Text } from 'ink';

import { useWindow } from '../../contexts/WindowContext.js';
import { rightPanelHeaderLabel } from '../../utils/windowDisplayLabels.js';

import type { Theme } from '../../../config/types.js';
import type { ModeType } from '@ollm/ollm-cli-core';

interface ModeConfidenceDisplayProps {
  currentMode: ModeType;
  currentModeIcon: string;
  currentModeColor: string;
  currentModeConfidence: number;
  suggestedModes: Array<{
    mode: ModeType;
    icon: string;
    confidence: number;
    reason: string;
  }>;
  allowedTools: string[];
  theme: Theme;
}

// Time and confidence bar helpers removed; time display was requested to be removed.

/**
 * Mode Confidence Display Component
 *
 * Shows current mode confidence and suggested alternative modes
 */
export function ModeConfidenceDisplay({
  currentMode,
  currentModeIcon,
  currentModeColor,
  currentModeConfidence: _currentModeConfidence,
  suggestedModes,
  allowedTools,
  theme,
}: ModeConfidenceDisplayProps) {
  const { activeWindow } = useWindow();

  const label = rightPanelHeaderLabel(activeWindow)
    ? `${rightPanelHeaderLabel(activeWindow)}:`
    : '';

  return (
    <Box flexDirection="column" paddingX={1} alignItems="flex-start">
      {/* 1. Current Mode Identity with padding */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginTop={2} alignSelf="flex-start">
          <Text bold color={theme.status.info}>
            Mode:
          </Text>
          <Text> </Text>
          <Text bold color={currentModeColor}>
            {currentModeIcon}{' '}
            {currentMode ? currentMode.charAt(0).toUpperCase() + currentMode.slice(1) : 'Unknown'}
          </Text>
        </Box>
        <Box marginTop={2} alignSelf="flex-start">
          {label ? (
            <>
              <Text dimColor>{label}</Text>
              <Text> </Text>
            </>
          ) : null}
          {allowedTools.length === 0 ? (
            <Text dimColor>None</Text>
          ) : allowedTools.includes('*') ? (
            <Text color={theme.status.success}>All</Text>
          ) : (
            <Text dimColor>({allowedTools.length})</Text>
          )}
        </Box>
      </Box>

      {/* 3. Suggested Modes with padding */}
      {suggestedModes.length > 0 && (
        <Box flexDirection="column" marginTop={0}>
          <Text bold color={theme.status.info}>
            Suggested Modes
          </Text>
          <Box flexDirection="column" marginTop={1} alignItems="flex-start">
            {suggestedModes.map((suggested, index) => (
              <Box
                key={suggested.mode}
                flexDirection="column"
                marginBottom={index < suggestedModes.length - 1 ? 1 : 0}
              >
                <Box alignSelf="flex-start">
                  <Text dimColor>├─</Text>
                  <Text> </Text>
                  <Text>
                    {suggested.icon}{' '}
                    {suggested.mode.charAt(0).toUpperCase() + suggested.mode.slice(1)}
                  </Text>
                  <Text dimColor>(</Text>
                  <Text> </Text>
                  <Text color={theme.text.accent}>{(suggested.confidence * 100).toFixed(0)}%</Text>
                  <Text dimColor>)</Text>
                </Box>
                <Box marginLeft={3} alignSelf="flex-start">
                  <Text dimColor>"{suggested.reason}"</Text>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
