/**
 * ServerItem Component
 * 
 * Displays an individual MCP server with:
 * - Server name, description, and enabled/disabled state
 * - Health status indicator
 * - Expand/collapse functionality
 * - Server statistics (tools, resources, uptime, OAuth status)
 * - Available keyboard shortcuts
 * - Focus highlighting
 */

import React from 'react';
import { Box, Text } from 'ink';
import { HealthIndicator, formatUptime } from './HealthIndicator.js';
import type { ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';

export interface ServerItemProps {
  /** Server status and configuration */
  server: ExtendedMCPServerStatus;
  /** Whether this server item is currently focused */
  focused: boolean;
  /** Whether this server item is expanded to show details */
  expanded: boolean;
  /** Callback when toggle button is pressed */
  onToggle?: () => void;
  /** Callback when expand/collapse is triggered */
  onExpand?: () => void;
}

/**
 * ServerStats sub-component
 * Displays server statistics including tools count, resources count, uptime, and OAuth status
 */
const ServerStats: React.FC<{ server: ExtendedMCPServerStatus }> = ({ server }) => {
  const toolsCount = server.toolsList?.length || 0;
  const resourcesCount = server.resources || 0;
  const uptimeMs = server.uptime || 0;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const hasOAuth = server.config.oauth?.enabled;
  const oauthConnected = server.oauthStatus?.connected;

  return (
    <Box flexDirection="row" gap={1}>
      <Text dimColor>Tools: {toolsCount}</Text>
      <Text dimColor>|</Text>
      <Text dimColor>Resources: {resourcesCount}</Text>
      {uptimeSeconds > 0 && (
        <>
          <Text dimColor>|</Text>
          <Text dimColor>Uptime: {formatUptime(uptimeSeconds)}</Text>
        </>
      )}
      {hasOAuth && (
        <>
          <Text dimColor>|</Text>
          <Text color={oauthConnected ? 'green' : 'yellow'}>
            OAuth: {oauthConnected ? 'Connected' : 'Not Connected'}
          </Text>
        </>
      )}
    </Box>
  );
};

/**
 * ServerActions sub-component
 * Displays available keyboard shortcuts for the focused server
 */
const ServerActions: React.FC<{ focused: boolean }> = ({ focused }) => {
  if (!focused) return null;

  return (
    <Box marginTop={1}>
      <Text dimColor>
        [V] View Tools  [C] Configure  [R] Restart  [L] Logs  [U] Uninstall
      </Text>
    </Box>
  );
};

/**
 * Toggle component
 * Displays enabled/disabled state with visual indicator
 */
const Toggle: React.FC<{ enabled: boolean; focused: boolean }> = ({ enabled, focused }) => {
  const icon = enabled ? '●' : '○';
  const color = enabled ? 'green' : 'gray';
  const label = enabled ? 'Enabled' : 'Disabled';

  return (
    <Text color={focused ? 'cyan' : color}>
      {icon} {label}
    </Text>
  );
};

/**
 * ServerItem Component
 * 
 * Main component that displays an MCP server with all its information and controls.
 * Supports expand/collapse functionality and focus highlighting.
 */
export const ServerItem: React.FC<ServerItemProps> = ({
  server,
  focused,
  expanded,
  onToggle,
  onExpand,
}) => {
  const isEnabled = !server.config.disabled;
  const expandIcon = expanded ? '▼' : '>';
  
  // Map server status to health indicator status
  const healthStatus = server.status === 'connected' ? server.health :
                      server.status === 'starting' ? 'connecting' :
                      server.status === 'disconnected' ? 'stopped' :
                      'unhealthy';

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Main server row */}
      <Box flexDirection="row" gap={1}>
        {/* Expand/collapse icon */}
        <Text color={focused ? 'cyan' : undefined}>
          {expandIcon}
        </Text>

        {/* Server name */}
        <Text bold color={focused ? 'cyan' : undefined}>
          {server.name}
        </Text>

        {/* Toggle indicator */}
        <Toggle enabled={isEnabled} focused={focused} />

        {/* Health indicator */}
        <HealthIndicator status={healthStatus} />
      </Box>

      {/* Server description */}
      <Box marginLeft={2}>
        <Text dimColor>{server.description || 'No description available'}</Text>
      </Box>

      {/* Expanded details */}
      {expanded && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {/* Server statistics */}
          <ServerStats server={server} />

          {/* Error message if unhealthy */}
          {server.health === 'unhealthy' && server.error && (
            <Box marginTop={1}>
              <Text color="red">Error: {server.error}</Text>
            </Box>
          )}

          {/* Warning message if degraded */}
          {server.health === 'degraded' && server.error && (
            <Box marginTop={1}>
              <Text color="yellow">Warning: {server.error}</Text>
            </Box>
          )}

          {/* Available actions */}
          <ServerActions focused={focused} />
        </Box>
      )}
    </Box>
  );
};
