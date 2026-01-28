/**
 * MarketplacePreview Component
 *
 * Displays a preview of the top 3 popular servers from the MCP marketplace.
 * Shows server name, description, rating (★), install count, and OAuth requirements.
 * Includes a hint to press 'M' to open the full marketplace.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.6
 */

import React from 'react';
import { Box, Text } from 'ink';

import type { MCPMarketplaceServer } from '../../../services/mcpMarketplace.js';

export interface MarketplacePreviewProps {
  /** Top 3 popular servers from marketplace */
  servers: MCPMarketplaceServer[];
  /** Whether the marketplace preview section is focused */
  focused?: boolean;
}

/**
 * Format install count to human-readable format
 * @param count - Number of installations
 * @returns Formatted string (e.g., "10K", "1.5K", "500")
 */
function formatInstallCount(count: number): string {
  if (count >= 1000) {
    const thousands = count / 1000;
    return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Generate star rating display
 * @param rating - Rating value (0-5)
 * @returns String of stars (e.g., "★★★★★")
 */
function formatRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5 ? '½' : '';
  return '★'.repeat(fullStars) + halfStar;
}

/**
 * MarketplaceServerItem sub-component
 * Displays a single marketplace server in the preview
 */
const MarketplaceServerItem: React.FC<{ server: MCPMarketplaceServer }> = ({ server }) => {
  const stars = formatRating(server.rating);
  const installs = formatInstallCount(server.installCount);

  return (
    <Box flexDirection="column" marginY={1}>
      {/* Server name and OAuth indicator */}
      <Box flexDirection="row" gap={1}>
        <Text bold>{server.name}</Text>
        {server.requiresOAuth && (
          <Text color="yellow" dimColor>
            [OAuth Required]
          </Text>
        )}
      </Box>

      {/* Server description */}
      <Box marginLeft={2}>
        <Text dimColor>{server.description}</Text>
      </Box>

      {/* Rating and install count */}
      <Box marginLeft={2} flexDirection="row" gap={1}>
        <Text color="yellow">{stars}</Text>
        <Text dimColor>({server.rating.toFixed(1)})</Text>
        <Text dimColor>•</Text>
        <Text dimColor>{installs} installs</Text>
      </Box>
    </Box>
  );
};

/**
 * MarketplacePreview Component
 *
 * Displays a preview of popular MCP servers from the marketplace.
 * Shows the top 3 servers with their details and a hint to open the full marketplace.
 */
export const MarketplacePreview: React.FC<MarketplacePreviewProps> = ({
  servers,
  focused = false,
}) => {
  // Only show top 3 servers
  const topServers = servers.slice(0, 3);

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      {/* Section header */}
      <Box marginBottom={1}>
        <Text bold color={focused ? 'cyan' : undefined}>
          ═══ Marketplace Preview ═══
        </Text>
      </Box>

      {/* Server list or empty state */}
      {topServers.length > 0 ? (
        <Box flexDirection="column">
          {topServers.map((server) => (
            <MarketplaceServerItem key={server.id} server={server} />
          ))}
        </Box>
      ) : (
        <Box marginY={1}>
          <Text dimColor>No marketplace servers available</Text>
        </Box>
      )}

      {/* Hint to open full marketplace */}
      <Box marginTop={1} marginBottom={1}>
        <Text dimColor>Press </Text>
        <Text bold color="cyan">
          M
        </Text>
        <Text dimColor> for full marketplace</Text>
      </Box>
    </Box>
  );
};
