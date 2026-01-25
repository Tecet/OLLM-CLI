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
  const _providerName = connection.provider; // Correctly get provider name from connection prop

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
        LLM: llama3.2:3b | VRAM: 2.6 GB/6.0 GB | T: 36°C
      </Text>
    </Box>
  );
}
