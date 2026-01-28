import React from 'react';
import { Text } from 'ink';

import { Pulse } from './FadeTransition.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'stopped' | 'connecting';

interface HealthIndicatorProps {
  status: HealthStatus;
  uptime?: number;
  showUptime?: boolean;
}

/**
 * Format uptime in seconds to human-readable format
 * @param uptimeSeconds - Uptime in seconds
 * @returns Formatted uptime string (e.g., "2h 30m", "45m", "30s")
 */
export function formatUptime(uptimeSeconds: number): string {
  if (uptimeSeconds < 0) return '0s';

  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = Math.floor(uptimeSeconds % 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Get status icon for health status
 */
function getStatusIcon(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '●';
    case 'degraded':
      return '⚠';
    case 'unhealthy':
      return '✗';
    case 'stopped':
      return '○';
    case 'connecting':
      return '⟳';
    default:
      return '?';
  }
}

/**
 * Get color for health status
 */
function getStatusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'unhealthy':
      return 'red';
    case 'stopped':
      return 'gray';
    case 'connecting':
      return 'blue';
    default:
      return 'white';
  }
}

/**
 * HealthIndicator component displays the health status of an MCP server
 * with appropriate icon, color, and optional uptime information.
 * Connecting status pulses to indicate activity.
 */
export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  status,
  uptime,
  showUptime = false,
}) => {
  const icon = getStatusIcon(status);
  const color = getStatusColor(status);

  // Pulse animation for connecting status
  if (status === 'connecting') {
    return (
      <Pulse active={true} color={color} interval={500}>
        <Text color={color}>
          {icon} {status}
          {showUptime && uptime !== undefined && uptime > 0 && ` (${formatUptime(uptime)})`}
        </Text>
      </Pulse>
    );
  }

  return (
    <Text color={color}>
      {icon} {status}
      {showUptime && uptime !== undefined && uptime > 0 && ` (${formatUptime(uptime)})`}
    </Text>
  );
};
