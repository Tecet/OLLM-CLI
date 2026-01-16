import { Box, Text } from 'ink';
import { ConnectionStatus, GPUInfo } from './StatusBar.js';
import { Theme } from '../../../config/uiSettings.js';

export interface HeaderBarProps {
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
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
      alignItems="center"
      justifyContent="center"
      paddingX={1}
      flexWrap="wrap"
    >
      <Text>
        <Text color={theme.status.success}>● </Text>
        <Text color={theme.text.secondary}>{providerName}</Text>
        <Text color={theme.text.secondary}> | </Text>

        <Text color={theme.text.primary} bold>LLM: </Text>
        <Text color={theme.text.secondary} bold>{model}</Text>
        <Text color={theme.text.secondary}> | </Text>

        <Text color={theme.text.secondary}>VRAM </Text>
        <Text color={theme.text.primary}>
          {gpu?.available ? `${formatMB(gpu.vramUsed)} / ${formatMB(gpu.vramTotal)}` : 'N/A'}
        </Text>
        <Text color={theme.text.secondary}> | </Text>

        <Text>🌡️ </Text>
        <Text color={theme.text.primary}>{gpu?.temperature || 0}°</Text>
      </Text>
    </Box>
  );
}
