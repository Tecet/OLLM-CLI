/**
 * InstalledServersSection Component
 * 
 * Displays the list of installed MCP servers with:
 * - Section header with server count
 * - List of ServerItem components
 * - Empty state when no servers are configured
 * - Focus state management for individual servers
 * 
 * Validates: Requirements 1.1, 12.1, 12.2
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ServerItem } from './ServerItem.js';
import { ServerSkeleton } from './ServerSkeleton.js';
import type { ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';

export interface InstalledServersSectionProps {
  /** List of installed MCP servers */
  servers: ExtendedMCPServerStatus[];
  /** Index of the currently focused server (-1 if none focused) */
  focusedIndex?: number;
  /** Set of server names that are expanded */
  expandedServers?: Set<string>;
  /** Callback when a server's expand/collapse state should toggle */
  onToggleExpand?: (serverName: string) => void;
  /** Whether the section is loading */
  isLoading?: boolean;
}

/**
 * InstalledServersSection Component
 * 
 * Main component that displays all installed MCP servers.
 * Handles empty state and passes focus state to individual ServerItem components.
 */
export const InstalledServersSection: React.FC<InstalledServersSectionProps> = ({
  servers,
  focusedIndex = -1,
  expandedServers = new Set(),
  onToggleExpand,
  isLoading = false,
}) => {
  const serverCount = servers.length;
  const enabledCount = servers.filter(s => !s.config.disabled).length;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Section header with server count */}
      <Box marginBottom={1}>
        <Text bold>
          ═══ Installed MCP Servers ({enabledCount}/{serverCount}) ═══
        </Text>
      </Box>

      {/* Server list or empty state */}
      {isLoading ? (
        <ServerSkeleton count={3} />
      ) : serverCount === 0 ? (
        <Box flexDirection="column" marginY={2}>
          <Text dimColor>No MCP servers configured</Text>
          <Box marginTop={1}>
            <Text dimColor>Press </Text>
            <Text bold color="cyan">
              M
            </Text>
            <Text dimColor> to browse the marketplace and install servers</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          {servers.map((server, index) => (
            <ServerItem
              key={server.name}
              server={server}
              focused={index === focusedIndex}
              expanded={expandedServers.has(server.name)}
              onExpand={() => onToggleExpand?.(server.name)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};
