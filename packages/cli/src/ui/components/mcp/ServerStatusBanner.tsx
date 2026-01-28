/**
 * ServerStatusBanner Component
 *
 * Displays server health and enabled/disabled status in a visually appealing banner.
 * This is an informational display only - not navigable.
 */

import React from 'react';
import { Box, Text } from 'ink';

import { useUI } from '../../../features/context/UIContext.js';

export interface ServerStatusBannerProps {
  /** Connection phase */
  phase?:
    | 'stopped'
    | 'starting'
    | 'connecting'
    | 'health-check'
    | 'connected'
    | 'unhealthy'
    | 'error';
  /** Whether the server is enabled */
  isEnabled: boolean;
}

/**
 * ServerStatusBanner Component
 *
 * Displays a colored banner showing server connection phase and enabled/disabled status.
 * Uses rounded borders and appropriate colors for visual clarity.
 */
export const ServerStatusBanner: React.FC<ServerStatusBannerProps> = ({
  phase = 'stopped',
  isEnabled,
}) => {
  const { state: uiState } = useUI();

  // Determine banner content and color based on phase
  let icon: string;
  let text: string;
  let color: string;

  if (!isEnabled) {
    icon = '⚪';
    text = 'Disabled';
    color = 'gray';
  } else {
    switch (phase) {
      case 'starting':
        icon = '🟡';
        text = 'Starting • Enabled';
        color = 'yellow';
        break;
      case 'connecting':
        icon = '🟡';
        text = 'Connecting • Enabled';
        color = 'yellow';
        break;
      case 'health-check':
        icon = '🟡';
        text = 'Checking Health • Enabled';
        color = 'yellow';
        break;
      case 'connected':
        icon = '🟢';
        text = 'Healthy • Enabled';
        color = uiState.theme.status.success;
        break;
      case 'unhealthy':
        icon = '🔴';
        text = 'Unhealthy • Enabled';
        color = uiState.theme.status.error;
        break;
      case 'error':
        icon = '🔴';
        text = 'Connection Failed • Enabled';
        color = uiState.theme.status.error;
        break;
      default:
        icon = '⚪';
        text = 'Stopped • Enabled';
        color = 'gray';
    }
  }

  return (
    <Box borderStyle="round" borderColor={color} paddingX={1} width="100%" flexShrink={0}>
      <Text color={color}>
        {icon} {text}
      </Text>
    </Box>
  );
};
