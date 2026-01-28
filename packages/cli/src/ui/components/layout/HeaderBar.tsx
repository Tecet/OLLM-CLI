import { Box, Text, BoxProps } from 'ink';

import { Theme } from '../../../config/types.js';

export interface GPUInfo {
  model?: string;
  vendor?: string;
  vramTotal?: number;
  vramUsed?: number;
  temperature?: number;
  count?: number;
}

export interface HeaderBarProps {
  gpu: GPUInfo | null;
  theme: Theme;
  borderColor?: string;
}

export function formatMB(bytes: number): string {
  if (!bytes) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

/**
 * HeaderBar - Shows GPU and VRAM information only
 * Displays: [ GPU: nvidia | VRAM: 1.2 GB/8.0 GB | T: 45°C ]
 */
export function HeaderBar({ gpu, theme, borderColor }: HeaderBarProps) {
  const vramText =
    gpu && gpu.vramTotal ? `${formatMB(gpu.vramUsed ?? 0)}/${formatMB(gpu.vramTotal)}` : 'N/A';

  const tempText =
    gpu && typeof gpu.temperature === 'number' ? `${Math.round(gpu.temperature)}°C` : 'N/A';

  const gpuVendor = gpu?.vendor || 'Unknown';

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
        {`GPU: ${gpuVendor} | VRAM: ${vramText} | T: ${tempText}`}
      </Text>
    </Box>
  );
}
