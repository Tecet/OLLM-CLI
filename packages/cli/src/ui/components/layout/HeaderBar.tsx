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

export function formatMB(bytes: number): string {
  if (!bytes) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function HeaderBar({ connection, model, gpu, theme, borderColor }: HeaderBarProps) {
  const vramText = gpu && gpu.vramTotal
    ? `${formatMB(gpu.vramUsed ?? 0)}/${formatMB(gpu.vramTotal)}`
    : 'N/A';

  const tempText = gpu && typeof gpu.temperature === 'number'
    ? `${Math.round(gpu.temperature)}°C`
    : 'N/A';
    
  const gpuVendor = gpu?.vendor || 'Unknown';
  
  const connectionIndicator = connection.status === 'connected' ? '🟢' : '🔴';
  const providerText = connection.provider || 'ollama';

  return (
    <Box 
      borderStyle={theme.border.style as BoxProps['borderStyle']}
      borderColor={borderColor || theme.border.primary}
      paddingX={1}
      overflow="hidden"
      width="100%"
      flexGrow={1}
      alignItems="center"
      justifyContent="center"
    >
      <Text color={theme.text.primary} bold wrap="truncate-end">
        {`${connectionIndicator} ${providerText} | LLM: ${model || 'none'} | GPU: ${gpuVendor} | VRAM: ${vramText} | T: ${tempText}`}
      </Text>
    </Box>
  );
}
