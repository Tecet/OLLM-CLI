import React from 'react';
import { Box, Text } from 'ink';

import { useContextManager } from '../../../features/context/ContextManagerContext.js';
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

// Helper to format tier display
function formatTierDisplay(tier: string): string {
  if (!tier || typeof tier !== 'string') return 'Unknown';
  const match = tier.match(/Tier (\d+)/);
  if (!match) return tier;

  const tierNum = match[1];
  const tierRanges: Record<string, string> = {
    '1': '2-4K',
    '2': '8K',
    '3': '16K',
    '4': '32K',
    '5': '64K+',
  };

  return tierRanges[tierNum] || tier;
}

// Helper to capitalize mode name
function formatModeName(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

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
  const { state: contextState } = useContextManager();

  const _label = rightPanelHeaderLabel(activeWindow)
    ? `${rightPanelHeaderLabel(activeWindow)}:`
    : '';

  const modeStr = formatModeName(currentMode);
  const tierStr = formatTierDisplay(contextState.currentTier);
  const optimizationStr = contextState.autoSizeEnabled ? 'Auto' : 'User-optimized';

  return (
    <Box flexDirection="column" paddingX={1} alignItems="flex-start">
      {/* Mode and Active Prompt */}
      <Box flexDirection="column">
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

        <Box alignSelf="flex-start">
          <Text color={theme.status.info} bold>
            Active Prompt:{' '}
          </Text>
          <Text color={theme.text.primary}>
            {modeStr} {tierStr}
          </Text>
          <Text dimColor> ({optimizationStr})</Text>
        </Box>
      </Box>

      {/* Empty lines */}
      <Box height={2} />

      {/* Suggested Modes */}
      {suggestedModes.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={theme.status.info}>
            Suggested Modes
          </Text>
          <Box flexDirection="column" alignItems="flex-start">
            {suggestedModes.map((suggested) => (
              <Box key={suggested.mode} flexDirection="row" alignSelf="flex-start">
                <Text dimColor>├─</Text>
                <Text> </Text>
                <Text>
                  {suggested.icon}{' '}
                  {suggested.mode.charAt(0).toUpperCase() + suggested.mode.slice(1)}
                </Text>
                <Text dimColor>:</Text>
                <Text> </Text>
                <Text color={theme.text.accent}>{(suggested.confidence * 100).toFixed(0)}%</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Empty line */}
      <Box height={1} />

      {/* Tools */}
      <Box alignSelf="flex-start">
        <Text dimColor>Tools: </Text>
        {allowedTools.length === 0 ? (
          <Text dimColor>None</Text>
        ) : allowedTools.includes('*') ? (
          <Text color={theme.status.success}>All</Text>
        ) : (
          <Text dimColor>{allowedTools.length}</Text>
        )}
      </Box>

      {/* Empty line */}
      <Box height={1} />
    </Box>
  );
}
