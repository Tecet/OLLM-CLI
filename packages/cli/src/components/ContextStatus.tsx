/**
 * ContextStatus Component
 * 
 * Displays context management status including:
 * - Model name
 * - Token usage (current/max with percentage)
 * - VRAM usage (used/total with percentage)
 * - KV cache info (quantization type and memory)
 * - Snapshot count
 * - Compression settings
 * - Warning indicator for high usage (>80%)
 */

import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../contexts/UIContext.js';

/**
 * Props for ContextStatus component
 */
export interface ContextStatusProps {
  /** Model name */
  modelName: string;
  /** Current token usage */
  currentTokens: number;
  /** Maximum context size in tokens */
  maxTokens: number;
  /** Current VRAM usage in bytes */
  vramUsed: number;
  /** Total VRAM in bytes */
  vramTotal: number;
  /** KV cache quantization type */
  kvQuantization: 'f16' | 'q8_0' | 'q4_0';
  /** KV cache memory usage in bytes */
  kvCacheMemory: number;
  /** Number of available snapshots */
  snapshotCount: number;
  /** Whether auto-compression is enabled */
  compressionEnabled: boolean;
  /** Compression threshold (0-1) */
  compressionThreshold: number;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Format percentage with color based on usage level
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get color for usage percentage using theme status colors
 */
function getUsageColor(percentage: number, theme: any): string {
  if (percentage >= 80) return theme.status.error;
  if (percentage >= 60) return theme.status.warning;
  return theme.status.success;
}

/**
 * ContextStatus Component
 */
export const ContextStatus: React.FC<ContextStatusProps> = ({
  modelName,
  currentTokens,
  maxTokens,
  vramUsed,
  vramTotal,
  kvQuantization,
  kvCacheMemory,
  snapshotCount,
  compressionEnabled,
  compressionThreshold
}) => {
  const { state: uiState } = useUI();
  const theme = uiState.theme;
  // Calculate percentages
  const tokenPercentage = (currentTokens / maxTokens) * 100;
  const vramPercentage = (vramUsed / vramTotal) * 100;
  
  // Determine if warning should be shown
  const showWarning = tokenPercentage > 80 || vramPercentage > 80;
  
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor={theme.border.primary}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>Context Status</Text>
        {showWarning && (
          <Text color={theme.status.warning} bold> ⚠ HIGH USAGE</Text>
        )}
      </Box>
      
      {/* Model Name */}
      <Box>
        <Text dimColor>Model: </Text>
        <Text bold>{modelName}</Text>
      </Box>
      
      {/* Token Usage */}
      <Box>
        <Text dimColor>Tokens: </Text>
        <Text color={getUsageColor(tokenPercentage, theme)}>
          {currentTokens.toLocaleString()} / {maxTokens.toLocaleString()}
        </Text>
        <Text dimColor> (</Text>
        <Text color={getUsageColor(tokenPercentage)} bold={tokenPercentage > 80}>
          {formatPercentage(tokenPercentage)}
        </Text>
        <Text dimColor>)</Text>
      </Box>
      
      {/* VRAM Usage */}
      <Box>
        <Text dimColor>VRAM: </Text>
        <Text color={getUsageColor(vramPercentage, theme)}>
          {formatBytes(vramUsed)} / {formatBytes(vramTotal)}
        </Text>
        <Text dimColor> (</Text>
        <Text color={getUsageColor(vramPercentage)} bold={vramPercentage > 80}>
          {formatPercentage(vramPercentage)}
        </Text>
        <Text dimColor>)</Text>
      </Box>
      
      {/* KV Cache Info */}
      <Box>
        <Text dimColor>KV Cache: </Text>
        <Text>{kvQuantization}</Text>
        <Text dimColor> - </Text>
        <Text>{formatBytes(kvCacheMemory)}</Text>
      </Box>
      
      {/* Snapshot Count */}
      <Box>
        <Text dimColor>Snapshots: </Text>
        <Text>{snapshotCount}</Text>
      </Box>
      
      {/* Compression Settings */}
      <Box>
        <Text dimColor>Compression: </Text>
        {compressionEnabled ? (
          <>
            <Text color={theme.status.success}>Enabled</Text>
            <Text dimColor> (threshold: </Text>
            <Text>{formatPercentage(compressionThreshold * 100)}</Text>
            <Text dimColor>)</Text>
          </>
        ) : (
          <Text color={theme.text.secondary}>Disabled</Text>
        )}
      </Box>
    </Box>
  );
};
