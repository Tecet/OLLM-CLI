/**
 * ServerListItem Component
 * 
 * Compact server list item for the left column of the two-column MCP panel layout.
 * Displays minimal information with focus on navigation and status at a glance.
 * 
 * Features:
 * - Expand/collapse icon (▼ expanded, > collapsed)
 * - Server name
 * - Health status icon with color coding
 * - Yellow highlighting when focused
 * - Minimal design - detailed information shown in right column
 * 
 * Validates: Requirements 1.1-1.5, NFR-7
 */

import React from 'react';
import { Box, Text } from 'ink';

import type { ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';

export interface ServerListItemProps {
  /** Server status and configuration */
  server: ExtendedMCPServerStatus;
  /** Whether this server item is currently focused */
  focused: boolean;
  /** Whether this server item is expanded to show details */
  expanded: boolean;
}

/**
 * Get health status color based on server health
 */
function getHealthColor(health: string): string {
  switch (health) {
    case 'healthy': return 'green';
    case 'degraded': return 'yellow';
    case 'unhealthy': return 'red';
    default: return 'gray';
  }
}

/**
 * Get status icon based on server status
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'connected': return '●';
    case 'disconnected': return '○';
    case 'starting': return '⟳';
    case 'error': return '✗';
    default: return '○';
  }
}

/**
 * ServerListItem Component
 * 
 * Compact list item for the left column showing:
 * - Expand icon (▼ or >)
 * - Server name (yellow when focused)
 * - Health status icon (color-coded)
 * 
 * This component is intentionally minimal - detailed information
 * is displayed in the ServerDetails component in the right column.
 */
export const ServerListItem: React.FC<ServerListItemProps> = ({
  server,
  focused,
  expanded,
}) => {
  // Determine health status from server state
  const healthStatus = server.status === 'connected' ? server.health :
                      server.status === 'starting' ? 'connecting' :
                      server.status === 'disconnected' ? 'stopped' :
                      'unhealthy';
  
  const healthColor = getHealthColor(healthStatus);
  const statusIcon = getStatusIcon(server.status);
  const expandIcon = expanded ? '▼' : '>';
  
  return (
    <Box marginY={0}>
      <Text color={focused ? 'yellow' : undefined} bold={focused}>
        {expandIcon} {server.name}
      </Text>
      <Box marginLeft={1}>
        <Text color={healthColor}>{statusIcon}</Text>
      </Box>
    </Box>
  );
};
