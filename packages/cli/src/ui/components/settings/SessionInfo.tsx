import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../config/types.js';

export interface SessionStats {
  id: string;
  startTime: Date;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalGenerations: number;
  totalTime: number;
  estimatedCost: number;
}

export interface SessionInfoProps {
  /** Session statistics */
  stats: SessionStats;
  
  /** Theme for styling */
  theme: Theme;
}

/**
 * SessionInfo component
 * 
 * Displays current session statistics.
 * Shows tokens, duration, cost, and generation count.
 */
export function SessionInfo({ stats, theme }: SessionInfoProps) {
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.text.accent} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Session Information
        </Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Box>
          <Text color={theme.text.secondary}>Session ID: </Text>
          <Text color={theme.text.primary}>{stats.id}</Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Started: </Text>
          <Text color={theme.text.primary}>
            {stats.startTime.toLocaleString()}
          </Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Duration: </Text>
          <Text color={theme.text.primary}>
            {formatDuration(stats.totalTime)}
          </Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Generations: </Text>
          <Text color={theme.text.primary}>{stats.totalGenerations}</Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Total Tokens: </Text>
          <Text color={theme.text.primary}>{stats.totalTokens}</Text>
        </Box>

        <Box paddingLeft={2}>
          <Text color={theme.text.secondary}>📥 Prompt: </Text>
          <Text color={theme.text.primary}>{stats.totalPromptTokens}</Text>
        </Box>

        <Box paddingLeft={2}>
          <Text color={theme.text.secondary}>📤 Completion: </Text>
          <Text color={theme.text.primary}>{stats.totalCompletionTokens}</Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Estimated Cost: </Text>
          <Text color={theme.status.warning}>
            {formatCost(stats.estimatedCost)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
