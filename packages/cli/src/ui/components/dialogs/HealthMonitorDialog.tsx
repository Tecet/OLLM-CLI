/**
 * HealthMonitorDialog - Dialog for monitoring MCP server health
 * 
 * Features:
 * - Overall status summary (X/Y servers healthy)
 * - List all servers with health status, uptime, last check time
 * - Show error/warning messages for unhealthy/degraded servers
 * - Restart button per server
 * - View Logs button per server
 * - Enable button for stopped servers
 * - Auto-restart configuration (checkbox + max restarts input)
 * - Refresh and Close buttons
 * 
 * Validates: Requirements 7.1-7.8, 9.1-9.7
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Dialog } from './Dialog.js';
import { Button, ButtonGroup } from '../forms/Button.js';
import { FormField } from '../forms/FormField.js';
import { TextInput } from '../forms/TextInput.js';
import { Checkbox } from '../forms/Checkbox.js';
import { useMCP } from '../../contexts/MCPContext.js';
import type { ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';

export interface HealthMonitorDialogProps {
  /** Callback when dialog should close */
  onClose: () => void;
  /** Optional callback when viewing logs for a server */
  onViewLogs?: (serverName: string) => void;
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format timestamp for last check time
 */
function formatLastCheck(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  } else {
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}

/**
 * Get health status icon
 */
function getHealthIcon(health: 'healthy' | 'degraded' | 'unhealthy'): string {
  switch (health) {
    case 'healthy':
      return '●';
    case 'degraded':
      return '⚠';
    case 'unhealthy':
      return '✗';
    default:
      return '○';
  }
}

/**
 * Get health status color
 */
function getHealthColor(health: 'healthy' | 'degraded' | 'unhealthy'): string {
  switch (health) {
    case 'healthy':
      return 'green';
    case 'degraded':
      return 'yellow';
    case 'unhealthy':
      return 'red';
    default:
      return 'gray';
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'running':
      return '●';
    case 'stopped':
      return '○';
    case 'error':
      return '✗';
    case 'connecting':
      return '⟳';
    default:
      return '○';
  }
}

/**
 * ServerHealthItem - Individual server health display
 */
interface ServerHealthItemProps {
  server: ExtendedMCPServerStatus;
  onRestart: (serverName: string) => void;
  onViewLogs: (serverName: string) => void;
  onEnable: (serverName: string) => void;
  isRestarting: boolean;
}

function ServerHealthItem({
  server,
  onRestart,
  onViewLogs,
  onEnable,
  isRestarting,
}: ServerHealthItemProps) {
  const healthIcon = getHealthIcon(server.health);
  const healthColor = getHealthColor(server.health);
  const statusIcon = getStatusIcon(server.status);

  return (
    <Box flexDirection="column" marginY={1} paddingX={1} borderStyle="single" borderColor="gray">
      {/* Server name and status */}
      <Box>
        <Box width={30}>
          <Text bold>{server.name}</Text>
        </Box>
        <Box width={20}>
          <Text color={healthColor}>
            {healthIcon} {server.health}
          </Text>
        </Box>
        <Box width={20}>
          <Text dimColor>
            {statusIcon} {server.status}
          </Text>
        </Box>
      </Box>

      {/* Server details */}
      <Box marginTop={1} marginLeft={2}>
        {server.uptime > 0 ? (
          <Box marginRight={4}>
            <Text dimColor>Uptime: {formatUptime(server.uptime)}</Text>
          </Box>
        ) : null}
        {server.lastCheckTime ? (
          <Box marginRight={4}>
            <Text dimColor>Last check: {formatLastCheck(server.lastCheckTime)}</Text>
          </Box>
        ) : null}
        {(server.responseTime !== undefined && server.responseTime !== null) ? (
          <Box>
            <Text dimColor>Response: <Text>{String(server.responseTime)}</Text>ms</Text>
          </Box>
        ) : null}
      </Box>

      {/* Error/Warning messages */}
      {server.health === 'unhealthy' && server.lastError ? (
        <Box marginTop={1} marginLeft={2}>
          <Text color="red">Error: {server.lastError}</Text>
        </Box>
      ) : null}
      {server.health === 'degraded' && server.lastError ? (
        <Box marginTop={1} marginLeft={2}>
          <Text color="yellow">Warning: {server.lastError}</Text>
        </Box>
      ) : null}

      {/* Action buttons */}
      <Box marginTop={1} marginLeft={2}>
        {server.status !== 'stopped' ? (
          <Box marginRight={1}>
            <Button
              label="Restart"
              onPress={() => onRestart(server.name)}
              variant="secondary"
              icon="⟳"
              loading={isRestarting}
              disabled={isRestarting}
            />
          </Box>
        ) : null}
        <Box marginRight={1}>
          <Button
            label="View Logs"
            onPress={() => onViewLogs(server.name)}
            variant="secondary"
            icon="📄"
          />
        </Box>
        {server.status === 'stopped' && server.config.disabled ? (
          <Box>
            <Button
              label="Enable"
              onPress={() => onEnable(server.name)}
              variant="success"
              icon="▶"
            />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

/**
 * HealthMonitorDialog component
 * 
 * Provides comprehensive health monitoring for all MCP servers:
 * - Overall status summary
 * - Individual server health details
 * - Restart and enable actions
 * - Log viewing
 * - Auto-restart configuration
 */
export function HealthMonitorDialog({
  onClose,
  onViewLogs,
}: HealthMonitorDialogProps) {
  const { state, restartServer, toggleServer, refreshServers } = useMCP();

  // UI state
  const [restartingServers, setRestartingServers] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRestart, setAutoRestart] = useState(true);
  const [maxRestarts, setMaxRestarts] = useState('3');

  // Calculate overall status
  const serverList = Array.from(state.servers.values());
  const healthyCount = serverList.filter(s => s.health === 'healthy').length;
  const totalCount = serverList.length;
  const overallStatus = healthyCount === totalCount ? 'All Healthy' : 
                       healthyCount === 0 ? 'All Unhealthy' : 
                       'Degraded';
  const overallColor = healthyCount === totalCount ? 'green' : 
                      healthyCount === 0 ? 'red' : 
                      'yellow';

  /**
   * Handle server restart
   */
  const handleRestart = useCallback(async (serverName: string) => {
    setRestartingServers(prev => new Set(prev).add(serverName));
    try {
      await restartServer(serverName);
    } catch (error) {
      console.error(`Failed to restart server ${serverName}:`, error);
    } finally {
      setRestartingServers(prev => {
        const next = new Set(prev);
        next.delete(serverName);
        return next;
      });
    }
  }, [restartServer]);

  /**
   * Handle view logs
   */
  const handleViewLogs = useCallback((serverName: string) => {
    if (onViewLogs) {
      onViewLogs(serverName);
    }
  }, [onViewLogs]);

  /**
   * Handle enable server
   */
  const handleEnable = useCallback(async (serverName: string) => {
    try {
      await toggleServer(serverName);
    } catch (error) {
      console.error(`Failed to enable server ${serverName}:`, error);
    }
  }, [toggleServer]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshServers();
    } catch (error) {
      console.error('Failed to refresh servers:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshServers]);

  /**
   * Validate max restarts input
   */
  const handleMaxRestartsChange = useCallback((value: string) => {
    // Only allow positive integers
    if (/^\d*$/.test(value)) {
      setMaxRestarts(value);
    }
  }, []);

  return (
    <Dialog
      title="MCP Health Monitor"
      onClose={onClose}
      width={90}
    >
      <Box flexDirection="column" paddingX={1}>
        {/* Overall Status Summary */}
        <Box marginBottom={2} paddingY={1} borderStyle="single" borderColor={overallColor}>
          <Box width={30}>
            <Text bold>Overall Status:</Text>
          </Box>
          <Box>
            <Text color={overallColor} bold>
              {overallStatus}
            </Text>
            <Text dimColor> (<Text>{healthyCount}</Text>/<Text>{totalCount}</Text> servers healthy)</Text>
          </Box>
        </Box>

        {/* Server List */}
        <Box flexDirection="column" marginBottom={2}>
          {serverList.length > 0 ? (
            serverList.map(server => (
              <ServerHealthItem
                key={server.name}
                server={server}
                onRestart={handleRestart}
                onViewLogs={handleViewLogs}
                onEnable={handleEnable}
                isRestarting={restartingServers.has(server.name)}
              />
            ))
          ) : (
            <Box paddingY={2}>
              <Text dimColor>No MCP servers configured</Text>
            </Box>
          )}
        </Box>

        {/* Auto-restart Configuration */}
        <Box flexDirection="column" marginBottom={2} paddingY={1} borderStyle="single" borderColor="gray">
          <Box marginBottom={1}>
            <Text bold>Auto-Restart Configuration</Text>
          </Box>
          <Box marginLeft={2}>
            <Checkbox
              label="Enable auto-restart for unhealthy servers"
              checked={autoRestart}
              onChange={setAutoRestart}
            />
          </Box>
          {autoRestart ? (
            <Box marginLeft={2} marginTop={1}>
              <FormField
                label="Max restarts per hour"
                helpText="Maximum number of automatic restart attempts per hour"
              >
                <Box width={10}>
                  <TextInput
                    value={maxRestarts}
                    onChange={handleMaxRestartsChange}
                    placeholder="3"
                  />
                </Box>
              </FormField>
            </Box>
          ) : null}
        </Box>

        {/* Action Buttons */}
        <Box marginTop={1}>
          <ButtonGroup
            buttons={[
              {
                label: 'Refresh',
                onPress: handleRefresh,
                variant: 'secondary',
                icon: '⟳',
                loading: isRefreshing,
                disabled: isRefreshing,
                shortcut: 'R',
              },
              {
                label: 'Close',
                onPress: onClose,
                variant: 'secondary',
                shortcut: 'Esc',
              },
            ]}
          />
        </Box>
      </Box>
    </Dialog>
  );
}
