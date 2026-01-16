/**
 * MCP Status Component
 * 
 * Displays the health status of MCP servers
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { HealthCheckResult } from '@ollm/ollm-cli-core/mcp';

export interface MCPStatusProps {
  /** Health check results for all servers */
  servers: HealthCheckResult[];
  /** Theme colors */
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Get status indicator for server health
 */
function getHealthIndicator(healthy: boolean): string {
  return healthy ? '🟢' : '🔴';
}

/**
 * Get color for server health
 */
function getHealthColor(healthy: boolean, theme: MCPStatusProps['theme']): string {
  return healthy ? theme.status.success : theme.status.error;
}

/**
 * Get status text for server
 */
function getStatusText(status: string): string {
  switch (status) {
    case 'connected':
      return 'OK';
    case 'starting':
      return 'Starting';
    case 'disconnected':
      return 'Offline';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

/**
 * MCP Status Component
 * 
 * Displays health status of MCP servers in the UI
 */
export function MCPStatus({ servers, theme, compact = false }: MCPStatusProps) {
  // Don't render if no servers
  if (servers.length === 0) {
    return null;
  }

  // Count healthy and unhealthy servers
  const healthyCount = servers.filter(s => s.healthy).length;
  const unhealthyCount = servers.length - healthyCount;

  if (compact) {
    // Compact mode: just show counts
    return (
      <Box flexDirection="row" alignItems="center">
        <Text color={theme.text.secondary}>MCP: </Text>
        {healthyCount > 0 && (
          <Text color={theme.status.success}>{healthyCount}✓</Text>
        )}
        {unhealthyCount > 0 && (
          <>
            {healthyCount > 0 && <Text color={theme.text.secondary}> </Text>}
            <Text color={theme.status.error}>{unhealthyCount}✗</Text>
          </>
        )}
      </Box>
    );
  }

  // Full mode: show each server
  return (
    <Box flexDirection="column">
      <Text color={theme.text.accent} bold>
        MCP Servers ({healthyCount}/{servers.length} healthy)
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {servers.map((server) => (
          <Box key={server.serverName} flexDirection="row" alignItems="center">
            <Text color={getHealthColor(server.healthy, theme)}>
              {getHealthIndicator(server.healthy)}
            </Text>
            <Text color={theme.text.primary}> {server.serverName}</Text>
            <Text color={theme.text.secondary}> - </Text>
            <Text color={getHealthColor(server.healthy, theme)}>
              {getStatusText(server.status)}
            </Text>
            {server.error && (
              <>
                <Text color={theme.text.secondary}> - </Text>
                <Text color={theme.status.error}>{server.error}</Text>
              </>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
