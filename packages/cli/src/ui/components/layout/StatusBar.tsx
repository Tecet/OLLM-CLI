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
  compact?: boolean;
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
  compact = false,
}: StatusBarProps) {
  const connectionIndicator = getConnectionIndicator(connection.status);
  const connectionColor = getConnectionColor(connection.status, theme);
  if (compact) {
    return (
      <Box flexDirection="row" alignItems="center">
        <Text color={connectionColor}>{connectionIndicator} {connection.provider}</Text>
        <Text color={theme.text.secondary}> │ </Text>
        <Text color={theme.text.accent}>{model}</Text>

        {loadedModels && loadedModels.length > 0 && (
          <>
            <Text color={theme.text.secondary}> </Text>
            <Text color={theme.text.secondary}>({loadedModels.length})</Text>
          </>
        )}

        {projectProfile && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.status.info}>{projectProfile}</Text>
          </>
        )}

        {git && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>{git.branch}</Text>
            <Text color={theme.text.secondary}> • </Text>
            <Text color={theme.text.secondary}>+{git.staged} ~{git.modified}</Text>
          </>
        )}

        {(typeof reviews === 'number' && reviews > 0) && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>Reviews: </Text>
            <Text color={theme.text.accent}>{reviews}</Text>
          </>
        )}

        {(typeof cost === 'number') && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>Cost: </Text>
            <Text color={theme.text.secondary}>{cost.toFixed(2)}</Text>
          </>
        )}

        <Text color={theme.text.secondary}> │ </Text>
        <Text color={theme.text.secondary}>{tokens.current}/{tokens.max}</Text>

        {gpu && gpu.available && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={gpu.temperature > 80 ? theme.status.warning : theme.text.secondary}>
              {gpu.temperature}°C {formatBytes(gpu.vramUsed)}/{formatBytes(gpu.vramTotal)}
            </Text>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="row" alignItems="center" width="100%">
      {/* Left: connection, model, project profile, git, loaded models, reviews, cost */}
      <Box flexDirection="row" alignItems="center" flexGrow={1}>
        <Text color={connectionColor}>
          {connectionIndicator} {connection.provider}
        </Text>

        <Text color={theme.text.secondary}> │ </Text>

        <Text color={theme.text.accent}>{model}</Text>

        {loadedModels && loadedModels.length > 0 && (
          <>
            <Text color={theme.text.secondary}> </Text>
            <Text color={theme.text.secondary}>({loadedModels.length})</Text>
          </>
        )}

        {projectProfile && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.status.info}>{projectProfile}</Text>
          </>
        )}

        {git && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>{git.branch}</Text>
            <Text color={theme.text.secondary}> • </Text>
            <Text color={theme.text.secondary}>+{git.staged} ~{git.modified}</Text>
          </>
        )}

        {(typeof reviews === 'number' && reviews > 0) && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>Reviews: </Text>
            <Text color={theme.text.accent}>{reviews}</Text>
          </>
        )}

        {(typeof cost === 'number') && (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={theme.text.secondary}>Cost: </Text>
            <Text color={theme.text.secondary}>{cost.toFixed(2)}</Text>
          </>
        )}
      </Box>

      {/* Middle: token usage */}
      <Box flexDirection="row" alignItems="center" paddingX={1}>
        <Text color={theme.text.secondary}>|</Text>
        <Text color={theme.text.secondary}> </Text>
        <Text color={theme.text.secondary}>{tokens.current}/{tokens.max}</Text>
      </Box>

      {/* Right: GPU status */}
      <Box flexDirection="row" alignItems="center" paddingLeft={1}>
        {gpu && gpu.available ? (
          <>
            <Text color={theme.text.secondary}> │ </Text>
            <Text color={gpu.temperature > 80 ? theme.status.warning : theme.text.secondary}>
              {gpu.temperature}°C {formatBytes(gpu.vramUsed)}/{formatBytes(gpu.vramTotal)}
            </Text>
          </>
        ) : (
          <Text color={theme.text.secondary}> </Text>
        )}
      </Box>
    </Box>
  );
}
