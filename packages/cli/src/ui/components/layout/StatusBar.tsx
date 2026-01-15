import React from 'react';
import { Box, Text } from 'ink';

export interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  provider: string;
}

export interface GitStatus {
  branch: string;
  staged: number;
  modified: number;
}

export interface GPUInfo {
  available: boolean;
  vendor: 'nvidia' | 'amd' | 'apple' | 'windows' | 'cpu';
  vramTotal: number;
  vramUsed: number;
  vramFree: number;
  temperature: number;
  temperatureMax: number;
  gpuUtilization: number;
}

export interface StatusBarProps {
  connection: ConnectionStatus;
  model: string;
  tokens: { current: number; max: number };
  git: GitStatus | null;
  gpu: GPUInfo | null;
  reviews: number;
  cost: number;
  loadedModels?: string[];
  projectProfile?: string;
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

function getConnectionIndicator(status: ConnectionStatus['status']): string {
  switch (status) {
    case 'connected':
      return '🟢';
    case 'connecting':
      return '🟡';
    case 'disconnected':
      return '🔴';
  }
}

function getConnectionColor(status: ConnectionStatus['status'], theme: StatusBarProps['theme']): string {
  switch (status) {
    case 'connected':
      return theme.status.success;
    case 'connecting':
      return theme.status.warning;
    case 'disconnected':
      return theme.status.error;
  }
}

export function StatusBar({
  connection,
  model,
  tokens,
  git,
  gpu,
  reviews,
  cost,
  loadedModels = [],
  projectProfile,
  theme,
}: StatusBarProps) {
  const connectionIndicator = getConnectionIndicator(connection.status);
  const connectionColor = getConnectionColor(connection.status, theme);

  return (
    <Box
      flexDirection="row"
      borderStyle="single"
      borderColor={theme.text.secondary}
      paddingX={1}
      justifyContent="space-between"
    >
      {/* Left side: Connection and Model */}
      <Box flexDirection="row">
        <Box>
          <Text color={connectionColor}>
            {connectionIndicator} {connection.provider}
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.secondary}> │ </Text>
        </Box>
        <Box>
          <Text color={theme.text.accent}>{model}</Text>
        </Box>
        
        {/* Project Profile */}
        {projectProfile && (
          <Box>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.status.info}>
              {projectProfile}
            </Text>
          </Box>
        )}
      </Box>

      {/* Right side: Metrics */}
      <Box flexDirection="row">
        {/* Loaded Models */}
        {loadedModels.length > 0 && (
          <Box>
            <Text color={theme.status.success}>
              {loadedModels.length} loaded
            </Text>
            <Text color={theme.text.secondary}> │ </Text>
          </Box>
        )}

        {/* Token usage */}
        <Box>
          <Text color={theme.text.secondary}>
            {tokens.current}/{tokens.max}
          </Text>
        </Box>

        {/* Git status */}
        {git && (
          <Box>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.status.info}>
              {git.branch}
              {git.staged > 0 && ` +${git.staged}`}
              {git.modified > 0 && ` ~${git.modified}`}
            </Text>
          </Box>
        )}

        {/* GPU status */}
        {gpu && gpu.available && (
          <Box>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={gpu.temperature > 80 ? theme.status.warning : theme.text.secondary}>
              {gpu.temperature}°C {formatBytes(gpu.vramUsed)}/{formatBytes(gpu.vramTotal)}
            </Text>
          </Box>
        )}

        {/* Review count */}
        {reviews > 0 && (
          <Box>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.status.warning}>
              {reviews} review{reviews !== 1 ? 's' : ''}
            </Text>
          </Box>
        )}

        {/* Cost estimate */}
        {cost > 0 && (
          <Box>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>
              ${cost.toFixed(4)}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
