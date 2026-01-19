/**
 * ServerDetails Component
 * 
 * Detailed server view for the right column of the two-column MCP panel layout.
 * Displays comprehensive information about the selected server including:
 * - Server name (bold, yellow when focused)
 * - Description
 * - Status (Enabled/Disabled with toggle indicator)
 * - Health status with icon and color
 * - Statistics (tools, resources, uptime, OAuth status) when expanded
 * - Error/warning messages when applicable
 * - Available action shortcuts when expanded
 * 
 * Validates: Requirements 1.1-1.6, NFR-7
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';

export interface ServerDetailsProps {
  /** Server status and configuration (undefined when no server selected) */
  server: ExtendedMCPServerStatus | undefined;
  /** Whether this server is expanded to show detailed statistics */
  expanded: boolean;
  /** Whether this server is currently focused (for highlighting) */
  focused?: boolean;
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
 * Format uptime in human-readable format
 */
function formatUptime(uptime: number): string {
  const seconds = Math.floor(uptime / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Get OAuth connection status
 */
function getOAuthStatus(server: ExtendedMCPServerStatus): string {
  if (!server.config.oauth) return 'Not configured';
  if (server.oauthStatus?.connected) return 'Connected';
  return 'Not connected';
}

/**
 * ServerDetails Component
 * 
 * Displays detailed information about a selected MCP server in the right column.
 * Shows placeholder text when no server is selected.
 * 
 * When a server is selected, displays:
 * - Server name (bold, yellow when focused)
 * - Description (dimmed)
 * - Status line with health indicator and enabled/disabled state
 * 
 * When expanded, additionally shows:
 * - Statistics (tools count, resources count, uptime)
 * - OAuth status (if OAuth is configured)
 * - Error/warning messages (if applicable)
 * - Available action shortcuts
 */
export const ServerDetails: React.FC<ServerDetailsProps> = ({
  server,
  expanded,
  focused = false,
}) => {
  // Show placeholder when no server is selected
  if (!server) {
    return (
      <Box padding={1}>
        <Text dimColor>Select a server to view details</Text>
      </Box>
    );
  }
  
  // Determine health status from server state
  const healthStatus = server.status === 'connected' ? server.health :
                      server.status === 'starting' ? 'connecting' :
                      server.status === 'disconnected' ? 'stopped' :
                      'unhealthy';
  
  const healthColor = getHealthColor(healthStatus);
  const statusIcon = getStatusIcon(server.status);
  const toggleIndicator = server.config.disabled ? '○ Disabled' : '● Enabled';
  
  return (
    <Box flexDirection="column" padding={1}>
      {/* Server name - bold and yellow when focused */}
      <Text bold color={focused ? 'yellow' : undefined}>
        {server.name}
      </Text>
      
      {/* Description - dimmed secondary text */}
      <Text dimColor>
        {server.description || 'No description available'}
      </Text>
      
      {/* Status line with health and enabled/disabled state */}
      <Box marginTop={1}>
        <Text>Status: </Text>
        <Text color={healthColor}>{statusIcon} {healthStatus}</Text>
        <Text> | </Text>
        <Text>{toggleIndicator}</Text>
      </Box>
      
      {/* Expanded details - only shown when server is expanded */}
      {expanded && (
        <>
          {/* Statistics: tools, resources, uptime */}
          <Box marginTop={1}>
            <Text>Tools: {server.toolsList?.length || server.tools || 0}</Text>
            <Text> | Resources: {server.resources || 0}</Text>
            {server.uptime && server.uptime > 0 && (
              <Text> | Uptime: {formatUptime(server.uptime)}</Text>
            )}
          </Box>
          
          {/* OAuth status - only shown if OAuth is configured */}
          {server.config.oauth && (
            <Box marginTop={1}>
              <Text>OAuth: {getOAuthStatus(server)}</Text>
            </Box>
          )}
          
          {/* Error/warning messages - only shown when applicable */}
          {server.error && (
            <Box marginTop={1}>
              <Text color={healthStatus === 'unhealthy' ? 'red' : 'yellow'}>
                {healthStatus === 'unhealthy' ? 'Error: ' : 'Warning: '}
                {server.error}
              </Text>
            </Box>
          )}
          
          {/* Available action shortcuts */}
          <Box marginTop={1}>
            <Text dimColor>
              [V] View Tools  [C] Configure  [R] Restart  [L] Logs  [U] Uninstall
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};
