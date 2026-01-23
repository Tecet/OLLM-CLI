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
  /** Server health status */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** Whether the server is enabled */
  isEnabled: boolean;
  /** Whether the server is currently connecting/starting */
  isConnecting?: boolean;
}

/**
 * ServerStatusBanner Component
 * 
 * Displays a colored banner showing server health and enabled/disabled status.
 * Uses rounded borders and appropriate colors for visual clarity.
 */
export const ServerStatusBanner: React.FC<ServerStatusBannerProps> = ({
  health,
  isEnabled,
  isConnecting = false,
}) => {
  const { state: uiState } = useUI();
  
  // Determine banner content and color based on state
  let icon: string;
  let text: string;
  let color: string;
  
  if (!isEnabled) {
    icon = '⚪';
    text = 'Disabled';
    color = 'gray';
  } else if (isConnecting) {
    icon = '🟡';
    text = 'Connecting • Enabled';
    color = 'yellow';
  } else if (health === 'healthy') {
    icon = '🟢';
    text = 'Healthy • Enabled';
    color = uiState.theme.status.success;
  } else if (health === 'degraded') {
    icon = '🟡';
    text = 'Degraded • Enabled';
    color = uiState.theme.status.warning;
  } else {
    icon = '🔴';
    text = 'Unhealthy • Enabled';
    color = uiState.theme.status.error;
  }
  
  return (
    <Box
      borderStyle="round"
      borderColor={color}
      paddingX={1}
      width="100%"
      flexShrink={0}
    >
      <Text color={color}>
        {icon} {text}
      </Text>
    </Box>
  );
};
