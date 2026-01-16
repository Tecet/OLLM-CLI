import React from 'react';
import { Box, Text } from 'ink';
import { ConnectionStatus } from './StatusBar.js';

export interface HeaderBarProps {
  connection: ConnectionStatus;
  model: string;
  gpu: any;
  theme: any;
}

function formatMB(bytes: number): string {
  if (!bytes) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function HeaderBar({ connection, model, gpu, theme }: HeaderBarProps) {
  const providerName = connection.provider || 'Ollama';
  
  return (
    <Box 
      flexDirection="row" 
      width="100%" 
      borderStyle="single" 
      borderColor={theme.text.secondary} 
      alignItems="center"
      paddingX={1}
    >
      {/* 1. Provider Section */}
      <Box marginRight={2}>
        <Text>
          <Text color={theme.status.success}>🌐 </Text>
          <Text color={theme.text.secondary}>Provider - </Text>
          <Text color={theme.text.primary} bold>{providerName}</Text>
        </Text>
      </Box>

      <Text color={theme.text.secondary}>|</Text>

      {/* 2. Model Section */}
      <Box marginX={2}>
        <Text>
          <Text>🧠 </Text>
          <Text color={theme.text.secondary}>LLM Model - </Text>
          <Text color={theme.text.accent} bold>{model}</Text>
        </Text>
      </Box>

      <Text color={theme.text.secondary}>|</Text>

      {/* 3. VRAM Section */}
      <Box marginX={2}>
        <Text>
          <Text color="#4ec9b0">📏 </Text>
          <Text color={theme.text.secondary}>VRAM - </Text>
          <Text color={theme.text.primary}>
            {gpu?.available ? `${formatMB(gpu.vramUsed)} / ${formatMB(gpu.vramTotal)}` : 'N/A'}
          </Text>
        </Text>
      </Box>

      <Text color={theme.text.secondary}>|</Text>

      {/* 4. GPU Section */}
      <Box marginLeft={2}>
        <Text>
          <Text color={theme.status.warning}>🌡️ </Text>
          <Text color={theme.text.secondary}>GPU - </Text>
          <Text color={theme.text.primary}>{gpu?.temperature || 0}°</Text>
        </Text>
      </Box>
    </Box>
  );
}
