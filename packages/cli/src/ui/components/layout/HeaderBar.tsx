import { Box, Text, BoxProps } from 'ink';
import { ConnectionStatus, GPUInfo } from './StatusBar.js';
import { Theme } from '../../../config/types.js';

export interface HeaderBarProps {
  connection: ConnectionStatus;
  model: string;
  gpu: GPUInfo | null;
  theme: Theme;
  borderColor?: string;
}

function formatMB(bytes: number): string {
  if (!bytes) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function HeaderBar({ connection, model, gpu, theme, borderColor }: HeaderBarProps) {
  const providerName = connection.provider || 'Ollama';

  return (
    <Box 
      borderStyle={theme.border.style as BoxProps['borderStyle']} 
      borderColor={borderColor || theme.border.primary} 
      paddingX={1}
      overflow="hidden"
    >
      <Text wrap="truncate-end">
        <Text color={theme.text.accent}>* </Text>
        <Text color={theme.text.secondary}>{providerName}</Text>
        <Text color={theme.text.secondary}> | </Text>
        <Text color={theme.text.primary} bold>L:</Text>
        <Text color={theme.text.secondary} bold>{model}</Text>
        <Text color={theme.text.secondary}> | </Text>
        <Text color={theme.text.secondary}>V:</Text>
        <Text color={theme.text.primary}>{gpu?.available ? `${formatMB(gpu.vramUsed)}/${formatMB(gpu.vramTotal)}` : 'N/A'}</Text>
        <Text color={theme.text.secondary}> | </Text>
        <Text color={theme.text.secondary}>T:</Text>
        <Text color={theme.text.primary}>{gpu?.temperature || 0}</Text>
        <Text color={theme.text.primary}>°C</Text>
      </Text>
    </Box>
  );
}
