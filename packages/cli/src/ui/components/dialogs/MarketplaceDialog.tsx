/**
 * MarketplaceDialog - Dialog for browsing and installing MCP servers from marketplace
 * 
 * Features:
 * - Display full list of marketplace servers
 * - Search input field (filter by name/description)
 * - Show server name, description, rating, install count
 * - OAuth requirement indicators
 * - Install button per server (opens InstallServerDialog)
 * - Navigation with arrow keys
 * - / key to focus search box
 * - Close button
 * 
 * Validates: Requirements 3.1-3.7, 12.15
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Dialog } from './Dialog.js';
import { InstallServerDialog } from './InstallServerDialog.js';
import { TextInput } from '../forms/TextInput.js';
import { Button, ButtonGroup } from '../forms/Button.js';
import { LoadingSpinner } from '../mcp/LoadingSpinner.js';
import { useMCP } from '../../contexts/MCPContext.js';
import type { MCPMarketplaceServer } from '../../../services/mcpMarketplace.js';
import type { MCPServerConfig } from '@ollm/ollm-cli-core/mcp/types.js';

export interface MarketplaceDialogProps {
  /** Callback when dialog should close */
  onClose: () => void;
}

/**
 * Format rating as stars
 */
function formatRating(rating: number): string {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return '★'.repeat(fullStars) + 
         (hasHalfStar ? '½' : '') + 
         '☆'.repeat(emptyStars);
}

/**
 * Format install count with K/M suffix
 */
function formatInstallCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Server list item component
 */
interface ServerListItemProps {
  server: MCPMarketplaceServer;
  focused: boolean;
  onInstall: () => void;
}

function ServerListItem({ server, focused, onInstall }: ServerListItemProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle={focused ? 'single' : undefined}
      borderColor={focused ? 'yellow' : undefined}
      paddingX={1}
      marginY={1}
    >
      {/* Server name and OAuth indicator */}
      <Box>
        <Text bold color={focused ? 'yellow' : 'cyan'}>
          {server.name}
        </Text>
        {server.requiresOAuth && (
          <Box marginLeft={2}>
            <Text color="yellow">🔐 OAuth</Text>
          </Box>
        )}
      </Box>

      {/* Description */}
      <Box marginTop={1}>
        <Text dimColor>{server.description}</Text>
      </Box>

      {/* Rating and install count */}
      <Box marginTop={1}>
        <Text color="yellow">{formatRating(server.rating)}</Text>
        <Text dimColor> ({server.rating.toFixed(1)})</Text>
        <Text> | </Text>
        <Text dimColor>{formatInstallCount(server.installCount)} installs</Text>
        {server.category && (
          <>
            <Text> | </Text>
            <Text color="cyan">{server.category}</Text>
          </>
        )}
      </Box>

      {/* Install button when focused */}
      {focused && (
        <Box marginTop={1}>
          <Button
            label="Install"
            onPress={onInstall}
            variant="primary"
            shortcut="Enter"
            icon="⬇"
          />
        </Box>
      )}
    </Box>
  );
}

/**
 * MarketplaceDialog component
 * 
 * Provides a comprehensive marketplace browser:
 * - Full server list with search
 * - Arrow key navigation
 * - / key to focus search
 * - Enter to install selected server
 * - Esc to close
 */
export function MarketplaceDialog({ onClose }: MarketplaceDialogProps) {
  const { marketplace, searchMarketplace, installServer } = useMCP();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredServers, setFilteredServers] = useState<MCPMarketplaceServer[]>(marketplace || []);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [installDialogServer, setInstallDialogServer] = useState<MCPMarketplaceServer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update filtered servers when search query changes
  useEffect(() => {
    const performSearch = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await searchMarketplace(searchQuery);
        setFilteredServers(results);
        // Reset selection to first item
        setSelectedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Search failed');
        setFilteredServers([]);
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [searchQuery, searchMarketplace]);

  // Update filtered servers when marketplace data changes
  useEffect(() => {
    if (!searchQuery) {
      setFilteredServers(marketplace);
    }
  }, [marketplace, searchQuery]);

  /**
   * Handle keyboard input
   */
  useInput((input, key) => {
    // Don't handle input if install dialog is open
    if (installDialogServer) return;

    // / key to focus search
    if (input === '/' && !isSearchFocused) {
      setIsSearchFocused(true);
      return;
    }

    // Esc to unfocus search or close dialog
    if (key.escape) {
      if (isSearchFocused) {
        setIsSearchFocused(false);
      } else {
        onClose();
      }
      return;
    }

    // Handle search input when focused
    if (isSearchFocused) {
      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
      } else if (key.return) {
        setIsSearchFocused(false);
      } else if (input && !key.ctrl && !key.meta) {
        setSearchQuery(prev => prev + input);
      }
      return;
    }

    // Navigation when not in search mode
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(filteredServers.length - 1, prev + 1));
    } else if (key.return) {
      // Install selected server
      if (filteredServers[selectedIndex]) {
        handleInstallClick(filteredServers[selectedIndex]);
      }
    }
  });

  /**
   * Handle install button click
   */
  const handleInstallClick = useCallback((server: MCPMarketplaceServer) => {
    setInstallDialogServer(server);
  }, []);

  /**
   * Handle server installation
   */
  const handleInstall = useCallback(async (serverId: string, config: MCPServerConfig) => {
    try {
      await installServer(serverId, config);
      setInstallDialogServer(null);
    } catch (err) {
      // Error is handled by InstallServerDialog
      console.error('Installation failed:', err);
    }
  }, [installServer]);

  /**
   * Close install dialog
   */
  const handleCloseInstallDialog = useCallback(() => {
    setInstallDialogServer(null);
  }, []);

  // Show install dialog if server selected
  if (installDialogServer) {
    return (
      <InstallServerDialog
        server={installDialogServer}
        onClose={handleCloseInstallDialog}
        onInstall={handleInstall}
      />
    );
  }

  return (
    <Dialog
      title="MCP Marketplace"
      onClose={onClose}
      width={90}
    >
      <Box flexDirection="column" paddingX={1}>
        {/* Search box */}
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text bold>Search: </Text>
            <Text color={isSearchFocused ? 'yellow' : 'gray'}>
              {searchQuery || (
                <Text dimColor italic>
                  Type to search or press / to focus
                </Text>
              )}
              {isSearchFocused && <Text color="yellow">_</Text>}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              {isSearchFocused
                ? 'Type to search, Enter to finish, Esc to cancel'
                : '↑↓: Navigate | Enter: Install | /: Search | Esc: Close'
              }
            </Text>
          </Box>
        </Box>

        {/* Loading state */}
        {isLoading && (
          <Box marginY={2}>
            <LoadingSpinner
              message="Loading servers..."
              spinnerType="dots"
              color="cyan"
              centered={false}
              padded={false}
            />
          </Box>
        )}

        {/* Error state */}
        {error && (
          <Box marginY={2}>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}

        {/* Server list */}
        {!isLoading && !error && (
          <Box flexDirection="column" marginTop={1}>
            {/* Results count */}
            <Box marginBottom={1}>
              <Text dimColor>
                {filteredServers.length} server{filteredServers.length !== 1 ? 's' : ''} found
              </Text>
            </Box>

            {/* Empty state */}
            {filteredServers.length === 0 && (
              <Box marginY={2}>
                <Text dimColor>
                  No servers found matching "{searchQuery}"
                </Text>
              </Box>
            )}

            {/* Server items */}
            {filteredServers.map((server, index) => (
              <ServerListItem
                key={server.id}
                server={server}
                focused={index === selectedIndex}
                onInstall={() => handleInstallClick(server)}
              />
            ))}
          </Box>
        )}

        {/* Footer actions */}
        <Box marginTop={2} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>
            💡 Tip: Use arrow keys to navigate, Enter to install, / to search
          </Text>
        </Box>
      </Box>
    </Dialog>
  );
}
