import React from 'react';
import { Box, Text } from 'ink';
import type { ModeType } from '@ollm/ollm-cli-core';

interface ModeConfidenceDisplayProps {
  currentMode: ModeType;
  currentModeIcon: string;
  currentModeColor: string;
  currentModeConfidence: number;
  modeDuration: number;
  suggestedModes: Array<{
    mode: ModeType;
    icon: string;
    confidence: number;
    reason: string;
  }>;
  allowedTools: string[];
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Render confidence bar
 */
function renderConfidenceBar(confidence: number, width: number = 10): string {
  const filled = Math.round(confidence * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Mode Confidence Display Component
 * 
 * Shows current mode confidence and suggested alternative modes
 */
export function ModeConfidenceDisplay({
  currentMode,
  currentModeIcon,
  currentModeColor,
  currentModeConfidence,
  modeDuration,
  suggestedModes,
  allowedTools
}: ModeConfidenceDisplayProps) {
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* 1. Indicators at the very top */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginTop={0}>
          <Text dimColor>Conf: </Text>
          <Text>{renderConfidenceBar(currentModeConfidence, 8)} </Text>
          <Text color="yellow">{(currentModeConfidence * 100).toFixed(0)}%</Text>
        </Box>
        <Box marginTop={0}>
          <Text dimColor>Time: </Text>
          <Text color="green">{formatDuration(modeDuration)}</Text>
        </Box>
      </Box>

      {/* 2. Current Mode Identity with padding */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text bold color="cyan">Mode: </Text>
          <Text bold color={currentModeColor}>
            {currentModeIcon} {currentMode ? currentMode.charAt(0).toUpperCase() + currentMode.slice(1) : 'Unknown'}
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text dimColor>Tools: </Text>
          {allowedTools.length === 0 ? (
            <Text dimColor>None</Text>
          ) : allowedTools.includes('*') ? (
            <Text color="green">All</Text>
          ) : (
            <Text dimColor>({allowedTools.length})</Text>
          )}
        </Box>
      </Box>

      {/* 3. Suggested Modes with padding */}
      {suggestedModes.length > 0 && (
        <Box flexDirection="column" marginTop={0}>
          <Text bold color="cyan">Suggested Modes</Text>
          <Box flexDirection="column" marginTop={1}>
            {suggestedModes.map((suggested, index) => (
              <Box key={suggested.mode} flexDirection="column" marginBottom={index < suggestedModes.length - 1 ? 1 : 0}>
                <Box>
                  <Text dimColor>├─ </Text>
                  <Text>
                    {suggested.icon} {suggested.mode.charAt(0).toUpperCase() + suggested.mode.slice(1)}
                  </Text>
                  <Text dimColor> (</Text>
                  <Text color="yellow">{(suggested.confidence * 100).toFixed(0)}%</Text>
                  <Text dimColor>)</Text>
                </Box>
                <Box marginLeft={3}>
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
