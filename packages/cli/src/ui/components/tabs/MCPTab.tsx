/**
 * MCPTab Component
 * 
 * Main container for the MCP Panel UI that provides:
 * - Two-column layout (30% left, 70% right)
 * - Left column: Menu with Marketplace and Installed Servers sections
 * - Right column: Dynamic content based on selection
 * - Keyboard navigation: Up/Down within columns, Left/Right between columns
 * - Dialog management for configuration, OAuth, tools, etc.
 * 
 * Validates: Requirements 1.1-1.6, 12.1-12.15, NFR-7
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { useMCP, type ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useNotifications } from '../../hooks/useNotifications.js';
import { LoadingSpinner } from '../mcp/LoadingSpinner.js';
import { OperationProgress } from '../mcp/OperationProgress.js';
import { ErrorBanner } from '../mcp/ErrorDisplay.js';
import { NotificationContainer } from '../mcp/Notification.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import { APIKeyInputDialog } from '../dialogs/APIKeyInputDialog.js';
import type { MCPMarketplaceServer } from '../../../services/mcpMarketplace.js';
import { 
  ServerConfigDialog,
  OAuthConfigDialog,
  ServerToolsViewer,
  HealthMonitorDialog,
  ServerLogsViewer,
  UninstallConfirmDialog,
  DialogErrorBoundary,
  HelpOverlay,
} from '../dialogs/index.js';

export interface MCPTabProps {
  windowWidth?: number;
}

/**
 * Detail view navigation items for server details
 */
type ServerDetailNavItem = 'exit' | 'toggle' | 'editkeys' | 'delete';

/**
 * Server Details Content Component - Shows installed server details
 */
interface ServerDetailsContentProps {
  server: ExtendedMCPServerStatus;
  activeColumn: 'left' | 'right';
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
  onRefreshServers: () => Promise<void>;
}

function ServerDetailsContent({ server, activeColumn, onToggle, onDelete, onRefreshServers }: ServerDetailsContentProps) {
  const { state: uiState } = useUI();
  const [navItem, setNavItem] = useState<ServerDetailNavItem>('exit');
  const [toggleState, setToggleState] = useState<{
    status: 'idle' | 'toggling';
  }>({
    status: 'idle',
  });
  const [deleteState, setDeleteState] = useState<{
    status: 'idle' | 'confirm' | 'deleting' | 'success' | 'error';
    selection: 'yes' | 'no';
    error?: string;
  }>({
    status: 'idle',
    selection: 'no',
  });
  
  // Track if we're in a refresh period (servers reconnecting)
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Health check countdown timer (30 seconds)
  const [healthCheckCountdown, setHealthCheckCountdown] = useState(30);
  
  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setHealthCheckCountdown(prev => {
        if (prev <= 1) {
          return 30; // Reset to 30 when it reaches 0
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Reset countdown when server status changes
  useEffect(() => {
    setHealthCheckCountdown(30);
  }, [server.status, server.health]);
  
  // Clear refreshing state after 3 seconds
  useEffect(() => {
    if (isRefreshing) {
      const timer = setTimeout(() => {
        setIsRefreshing(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing]);
  
  // Handle keyboard input when right column is active
  useInput((input, key) => {
    if (activeColumn !== 'right') return;
    
    // Handle delete confirmation
    if (deleteState.status === 'confirm') {
      if (key.leftArrow) {
        setDeleteState(prev => ({ ...prev, selection: 'yes' }));
      } else if (key.rightArrow) {
        setDeleteState(prev => ({ ...prev, selection: 'no' }));
      } else if (key.return) {
        if (deleteState.selection === 'yes') {
          // Start deletion
          setDeleteState({ status: 'deleting', selection: 'no' });
          
          // Perform deletion
          onDelete()
            .then(() => {
              setDeleteState({ status: 'success', selection: 'no' });
              setIsRefreshing(true); // Mark as refreshing
            })
            .catch(err => {
              setDeleteState({
                status: 'error',
                selection: 'no',
                error: err instanceof Error ? err.message : 'Unknown error occurred',
              });
            });
        } else {
          // Cancel
          setDeleteState({ status: 'idle', selection: 'no' });
        }
      } else if (key.escape) {
        setDeleteState({ status: 'idle', selection: 'no' });
      }
      return;
    }
    
    // Handle success/error dismissal
    if (deleteState.status === 'success' || deleteState.status === 'error') {
      if (key.return || key.escape) {
        if (deleteState.status === 'success') {
          // Refresh servers list after successful deletion
          onRefreshServers().catch(console.error);
        }
        setDeleteState({ status: 'idle', selection: 'no' });
      }
      return;
    }
    
    // Don't allow navigation during deletion
    if (deleteState.status === 'deleting') {
      return;
    }
    
    // Handle navigation
    if (key.upArrow) {
      if (navItem === 'delete') {
        setNavItem('toggle');
      } else if (navItem === 'toggle') {
        setNavItem('exit');
      }
    } else if (key.downArrow) {
      if (navItem === 'exit') {
        setNavItem('toggle');
      } else if (navItem === 'toggle') {
        setNavItem('delete');
      }
    } else if (key.return) {
      if (navItem === 'exit') {
        // Exit handled by parent
      } else if (navItem === 'toggle') {
        // Toggle server enabled/disabled
        setToggleState({ status: 'toggling' });
        onToggle()
          .then(() => {
            setToggleState({ status: 'idle' });
            setIsRefreshing(true); // Mark as refreshing
            // Refresh to show updated status
            onRefreshServers().catch(console.error);
          })
          .catch(err => {
            console.error('Failed to toggle server:', err);
            setToggleState({ status: 'idle' });
          });
      } else if (navItem === 'delete') {
        // Show delete confirmation
        setDeleteState({ status: 'confirm', selection: 'no' });
      }
    }
  }, { isActive: activeColumn === 'right' });
  
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Help Text - Top Right */}
      <Box flexShrink={0} justifyContent="flex-end">
        <Text dimColor>
          ↑↓: Navigate | Enter: Select | Esc: Back
        </Text>
      </Box>
      
      {/* Exit Item */}
      <Box flexShrink={0}>
        <Text bold color={navItem === 'exit' ? uiState.theme.text.accent : 'white'}>
          {navItem === 'exit' ? '▶ ' : '  '}← Exit
        </Text>
      </Box>
      
      <Text> </Text>
      
      {/* Health Status (display only) */}
      <Box flexShrink={0}>
        <Text>
          <Text bold>Health:</Text>{' '}
          <Text color={
            isRefreshing ? uiState.theme.status.info :
            server.health === 'healthy' ? uiState.theme.status.success :
            server.health === 'degraded' ? uiState.theme.status.warning : uiState.theme.status.error
          }>
            {isRefreshing ? '⟳ Reconnecting...' :
             server.health === 'healthy' ? '✓ Healthy' :
             server.health === 'degraded' ? '⚠ Degraded' :
             '✗ Unhealthy'}
          </Text>
          {!server.config.disabled && !isRefreshing && (
            <Text dimColor> (Next check: {healthCheckCountdown}s)</Text>
          )}
        </Text>
      </Box>
      
      {/* Status Toggle (navigable) */}
      <Box flexShrink={0}>
        <Text bold color={navItem === 'toggle' ? uiState.theme.text.accent : 'white'}>
          {navItem === 'toggle' ? '▶ ' : '  '}Status: <Text color={server.config.disabled ? uiState.theme.status.error : uiState.theme.status.success}>
            {server.config.disabled ? '○ Disabled' : '● Enabled'}
          </Text>
        </Text>
        {navItem === 'toggle' && toggleState.status === 'idle' && (
          <Text dimColor> (Press Enter to toggle)</Text>
        )}
        {toggleState.status === 'toggling' && (
          <Text dimColor> Updating...</Text>
        )}
      </Box>
      
      <Text> </Text>
      <Text> </Text>
      
      {/* Server Details - Scrollable */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {/* Header: Name, Version */}
        <Text bold color={uiState.theme.text.accent}>
          MCP Server: {server.name}
        </Text>
        {server.config.metadata?.version && (
          <Text>
            <Text bold>Version:</Text> {server.config.metadata.version}
          </Text>
        )}
        <Text> </Text>
        <Text> </Text>
        
        {/* Author, Homepage, GitHub, Category, Rating - Inline */}
        {server.config.metadata?.author && (
          <Text>
            <Text bold>Author:</Text> {server.config.metadata.author}
          </Text>
        )}
        
        {server.config.metadata?.homepage && (
          <Text>
            <Text bold>Homepage:</Text> <Text color={uiState.theme.text.accent}>{server.config.metadata.homepage}</Text>
          </Text>
        )}
        
        {server.config.metadata?.repository && (
          <Text>
            <Text bold>GitHub Repository:</Text> <Text color={uiState.theme.text.accent}>{server.config.metadata.repository}</Text>
          </Text>
        )}
        
        {server.config.metadata?.category && (
          <Text>
            <Text bold>Category:</Text> {server.config.metadata.category}
          </Text>
        )}
        
        {server.config.metadata?.rating && (
          <Text>
            <Text bold>Rating:</Text> {'⭐'.repeat(Math.floor(server.config.metadata.rating))} ({server.config.metadata.rating}/5)
          </Text>
        )}
        <Text> </Text>
        <Text> </Text>
        
        {/* Description - Multi-line */}
        {server.config.metadata?.description && (
          <>
            <Text bold>Description:</Text>
            <Text wrap="wrap">{server.config.metadata.description}</Text>
            <Text> </Text>
          </>
        )}
        
        {/* Requirements - List */}
        {server.config.metadata?.requirements && server.config.metadata.requirements.length > 0 && (
          <>
            <Text bold>Requirements:</Text>
            {server.config.metadata.requirements.map((req, idx) => (
              <Text key={idx}>  • {req}</Text>
            ))}
            <Text> </Text>
          </>
        )}
        
        {/* Required API Keys - Prominent */}
        {server.config.env && Object.keys(server.config.env).length > 0 && (
          <>
            <Text bold color={uiState.theme.status.warning}>⚠️  This server requires:</Text>
            {Object.keys(server.config.env).map((key) => (
              <Text key={key} color={uiState.theme.status.warning}>  • {key}</Text>
            ))}
            <Text> </Text>
          </>
        )}
        
        {/* Command, Tools, Transport - Inline */}
        <Text>
          <Text bold>Command:</Text> <Text dimColor>{server.config.command} {server.config.args?.join(' ') || ''}</Text>
        </Text>
        <Text>
          <Text bold>Tools Available:</Text> {server.toolsList?.length || 0} tools
        </Text>
        <Text>
          <Text bold>Transport:</Text> {server.config.transport || 'stdio'}
        </Text>
        <Text> </Text>
        <Text> </Text>
        
        {/* API Keys Section - Show current values (masked) */}
        {server.config.env && Object.keys(server.config.env).length > 0 && (
          <>
            <Text bold>API Keys:</Text>
            {Object.entries(server.config.env).map(([key, value]) => (
              <Text key={key}>
                <Text dimColor>  {key}:</Text> {value ? <Text color={uiState.theme.status.success}>●●●●●●●● (configured)</Text> : <Text color={uiState.theme.status.error}>(not set)</Text>}
              </Text>
            ))}
            <Text dimColor>  (Press [E] to edit)</Text>
            <Text> </Text>
            <Text> </Text>
          </>
        )}
        
        {/* Connection Status */}
        <Text>
          <Text bold>Connection Status:</Text>{' '}
          {server.status === 'connected' ? '✓ Connected' :
           server.status === 'error' ? '✗ Disconnected' :
           '○ Stopped'}
        </Text>
        
        {server.oauthStatus && (
          <Text>
            <Text bold>OAuth Status:</Text>{' '}
            <Text color={server.oauthStatus.connected ? 'green' : 'red'}>
              {server.oauthStatus.connected ? '✓ Connected' : '✗ Not Connected'}
            </Text>
          </Text>
        )}
      </Box>
      
      {/* Delete Button / Confirmation / Status - Bottom */}
      <Box flexDirection="column" flexShrink={0} marginTop={1}>
        {deleteState.status === 'idle' && (
          <Text bold color={navItem === 'delete' ? 'yellow' : 'red'}>
            {navItem === 'delete' ? '▶ ' : '  '}[D] Delete Server
          </Text>
        )}
        
        {deleteState.status === 'confirm' && (
          <>
            <Text bold color="red">
              Delete {server.name}?
            </Text>
            <Box gap={4} marginTop={1}>
              <Text bold color={deleteState.selection === 'yes' ? 'yellow' : 'white'}>
                {deleteState.selection === 'yes' ? '▶ ' : '  '}Yes
              </Text>
              <Text bold color={deleteState.selection === 'no' ? 'yellow' : 'white'}>
                {deleteState.selection === 'no' ? '▶ ' : '  '}No
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                ←→: Select | Enter: Confirm | Esc: Cancel
              </Text>
            </Box>
          </>
        )}
        
        {deleteState.status === 'deleting' && (
          <>
            <Text bold color="red">
              Deleting {server.name}...
            </Text>
            <Box marginTop={1}>
              <Text dimColor>
                Please wait...
              </Text>
            </Box>
          </>
        )}
        
        {deleteState.status === 'success' && (
          <>
            <Text bold color="green">
              ✓ Server Deleted Successfully!
            </Text>
            <Box marginTop={1}>
              <Text dimColor>
                Press Enter to continue
              </Text>
            </Box>
          </>
        )}
        
        {deleteState.status === 'error' && (
          <>
            <Text bold color="red">
              ✗ Deletion Failed
            </Text>
            <Box marginTop={1}>
              <Text color={uiState.theme.status.error}>
                {deleteState.error}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                Press Enter to dismiss
              </Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

/**
 * Marketplace Content Component - Shows marketplace in right column
 */
interface MarketplaceContentProps {
  activeColumn: 'left' | 'right';
  onRefreshServers: () => Promise<void>;
  height?: number;
}

/**
 * View mode for marketplace content
 */
type MarketplaceView = 'list' | 'detail' | 'apikey';

/**
 * Detail view navigation items
 */
type DetailNavItem = 'exit' | 'install';

function MarketplaceContent({ activeColumn, onRefreshServers, height: _height = 20 }: MarketplaceContentProps) {
  const { state: uiState } = useUI();
  const { searchMarketplace } = useMCP();
  const [searchQuery, setSearchQuery] = useState('');
  const [servers, setServers] = useState<MCPMarketplaceServer[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [view, setView] = useState<MarketplaceView>('list');
  const [selectedServer, setSelectedServer] = useState<MCPMarketplaceServer | null>(null);
  const [detailNavItem, setDetailNavItem] = useState<DetailNavItem>('exit');
  const [installState, setInstallState] = useState<{
    status: 'idle' | 'confirm' | 'installing' | 'success' | 'error';
    selection: 'yes' | 'no';
    error?: string;
  }>({
    status: 'idle',
    selection: 'no',
  });
  
  // Fixed window size - display exactly 10 servers at a time
  const windowSize = 10;
  
  // Load initial servers
  useEffect(() => {
    const loadServers = async () => {
      setIsLoading(true);
      try {
        const results = await searchMarketplace('');
        setServers(results);
      } catch (err) {
        console.error('Failed to load marketplace:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadServers();
  }, [searchMarketplace]);
  
  // Search when query changes
  useEffect(() => {
    const performSearch = async () => {
      setIsLoading(true);
      try {
        const results = await searchMarketplace(searchQuery);
        setServers(results);
        setSelectedIndex(0);
        setScrollOffset(0);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (searchQuery) {
      performSearch();
    }
  }, [searchQuery, searchMarketplace]);
  
  // Auto-scroll to keep selected item visible (snap to server, not line)
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + windowSize) {
      setScrollOffset(selectedIndex - windowSize + 1);
    }
  }, [selectedIndex, scrollOffset, windowSize]);
  
  // Get visible servers (only show what fits in the window)
  const visibleServers = useMemo(() => {
    return servers.slice(scrollOffset, scrollOffset + windowSize);
  }, [servers, scrollOffset, windowSize]);
  
  // Handle keyboard input when right column is active
  useInput((input, key) => {
    if (activeColumn !== 'right') return;
    
    // Handle install confirmation
    if (installState.status === 'confirm') {
      if (key.leftArrow) {
        setInstallState(prev => ({ ...prev, selection: 'yes' }));
      } else if (key.rightArrow) {
        setInstallState(prev => ({ ...prev, selection: 'no' }));
      } else if (key.return) {
        if (installState.selection === 'yes' && selectedServer) {
          // Start installation
          setInstallState({ status: 'installing', selection: 'no' });
          
          // Perform installation
          (async () => {
            try {
              const { mcpMarketplace } = await import('../../../services/mcpMarketplace.js');
              // Pass the full server object instead of just ID to avoid lookup issues
              await mcpMarketplace.installServer(selectedServer, {});
              setInstallState({ status: 'success', selection: 'no' });
            } catch (err) {
              setInstallState({
                status: 'error',
                selection: 'no',
                error: err instanceof Error ? err.message : 'Unknown error occurred',
              });
            }
          })();
        } else {
          // Cancel
          setInstallState({ status: 'idle', selection: 'no' });
        }
      } else if (key.escape) {
        setInstallState({ status: 'idle', selection: 'no' });
      }
      return;
    }
    
    // Handle success/error dismissal
    if (installState.status === 'success' || installState.status === 'error') {
      if (key.return || key.escape) {
        if (installState.status === 'success') {
          // Refresh servers list before going back
          onRefreshServers().then(() => {
            setInstallState({ status: 'idle', selection: 'no' });
            // Go back to list after successful install
            setView('list');
            setSelectedServer(null);
            setDetailNavItem('exit');
          }).catch(err => {
            console.error('Failed to refresh servers:', err);
            setInstallState({ status: 'idle', selection: 'no' });
            setView('list');
            setSelectedServer(null);
            setDetailNavItem('exit');
          });
        } else {
          // On error, go back to detail view to try again
          setInstallState({ status: 'idle', selection: 'no' });
          setView('detail');
        }
      }
      return;
    }
    
    // Don't allow navigation during installation
    if (installState.status === 'installing') {
      return;
    }
    
    // Handle detail view navigation
    if (view === 'detail') {
      if (key.upArrow) {
        setDetailNavItem('exit');
      } else if (key.downArrow) {
        setDetailNavItem('install');
      } else if (key.return) {
        if (detailNavItem === 'exit') {
          // Back to list
          setView('list');
          setSelectedServer(null);
          setDetailNavItem('exit');
        } else if (detailNavItem === 'install' && selectedServer) {
          // Check if server requires API keys
          const hasEnvVars = selectedServer.env && Object.keys(selectedServer.env).length > 0;
          
          if (hasEnvVars) {
            // Show API key input dialog
            setView('apikey');
          } else {
            // No API keys needed, show confirmation directly
            setInstallState({ status: 'confirm', selection: 'no' });
          }
        }
      } else if (key.escape) {
        // Back to list
        setView('list');
        setSelectedServer(null);
        setDetailNavItem('exit');
      }
      return;
    }
    
    // Handle search input
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
    
    // / to focus search
    if (input === '/') {
      setIsSearchFocused(true);
      return;
    }
    
    // Navigation - snap to server names (skip descriptions)
    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(servers.length - 1, prev + 1));
    } else if (key.return && servers[selectedIndex]) {
      // Show server details
      setSelectedServer(servers[selectedIndex]);
      setView('detail');
      setDetailNavItem('exit');
    }
  }, { isActive: activeColumn === 'right' });
  
  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
        <LoadingSpinner message="Loading marketplace..." spinnerType="dots" color={uiState.theme.text.accent} centered padded />
      </Box>
    );
  }
  
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + windowSize < servers.length;
  
  // Render API key input view
  if (view === 'apikey' && selectedServer) {
    return (
      <APIKeyInputDialog
        server={selectedServer}
        onInstall={async (envVars) => {
          // Start installation with provided API keys
          setInstallState({ status: 'installing', selection: 'no' });
          
          try {
            const { mcpMarketplace } = await import('../../../services/mcpMarketplace.js');
            // Pass the full server object instead of just ID to avoid lookup issues
            await mcpMarketplace.installServer(selectedServer, { env: envVars });
            setInstallState({ status: 'success', selection: 'no' });
          } catch (err) {
            setInstallState({
              status: 'error',
              selection: 'no',
              error: err instanceof Error ? err.message : 'Unknown error occurred',
            });
          }
        }}
        onCancel={() => {
          // Go back to detail view
          setView('detail');
        }}
      />
    );
  }
  
  // Render detail view
  if (view === 'detail' && selectedServer) {
    return (
      <Box flexDirection="column" height="100%" width="100%">
        {/* Help Text - Top Right */}
        <Box flexShrink={0} justifyContent="flex-end">
          <Text dimColor>
            ↑↓: Navigate | Enter: Select | Esc: Back
          </Text>
        </Box>
        
        {/* Exit Item - Top */}
        <Box flexShrink={0}>
          <Text bold color={detailNavItem === 'exit' ? uiState.theme.text.accent : 'white'}>
            {detailNavItem === 'exit' ? '▶ ' : '  '}← Exit
          </Text>
        </Box>
        
        <Text> </Text>
        <Text> </Text>
        
        {/* Server Details - Scrollable */}
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {/* Header: Name, Version, Updated */}
          <Text bold color={uiState.theme.text.accent}>
            MCP Server: {selectedServer.name}
          </Text>
          <Text>
            <Text bold>Version:</Text> {selectedServer.version || 'N/A'}
          </Text>
          <Text> </Text>
          <Text> </Text>
          
          {/* Author, Homepage, GitHub, Category, Rating - Inline */}
          <Text>
            <Text bold>Author:</Text> {selectedServer.author || 'Unknown'}
          </Text>
          
          {selectedServer.homepage && (
            <Text>
              <Text bold>Homepage:</Text> <Text color="cyan">{selectedServer.homepage}</Text>
            </Text>
          )}
          
          {selectedServer.repository && (
            <Text>
              <Text bold>GitHub Repository:</Text> <Text color="cyan">{selectedServer.repository}</Text>
            </Text>
          )}
          
          <Text>
            <Text bold>Category:</Text> {selectedServer.category || 'Utilities'}
          </Text>
          
          <Text>
            <Text bold>Rating:</Text> {'⭐'.repeat(Math.floor(selectedServer.rating))} ({selectedServer.rating}/5)
          </Text>
          <Text> </Text>
          <Text> </Text>
          
          {/* Description - Multi-line */}
          <Text bold>Description:</Text>
          <Text wrap="wrap">{selectedServer.description}</Text>
          <Text> </Text>
          
          {/* Requirements - List */}
          {selectedServer.requirements.length > 0 && (
            <>
              <Text bold>Requirements:</Text>
              {selectedServer.requirements.map((req, idx) => (
                <Text key={idx}>  • {req}</Text>
              ))}
              <Text> </Text>
            </>
          )}
          
          {/* Required API Keys - Prominent */}
          {selectedServer.env && Object.keys(selectedServer.env).length > 0 && (
            <>
              <Text bold color="yellow">⚠️  This server requires:</Text>
              {Object.keys(selectedServer.env).map((key) => (
                <Text key={key} color="yellow">  • {key}</Text>
              ))}
              <Text> </Text>
              <Text> </Text>
            </>
          )}
          
          {/* Command - Inline */}
          <Text>
            <Text bold>Command:</Text> <Text dimColor>{selectedServer.command} {selectedServer.args?.join(' ')}</Text>
          </Text>
          <Text> </Text>
          <Text> </Text>
          
          {/* API Keys Section - Placeholder for future editable input */}
          {selectedServer.env && Object.keys(selectedServer.env).length > 0 && (
            <>
              <Text bold>API Keys:</Text>
              <Text dimColor>  (Configure during installation)</Text>
              <Text> </Text>
              <Text> </Text>
            </>
          )}
        </Box>
        
        {/* Install Button / Confirmation / Status - Bottom */}
        <Box flexDirection="column" flexShrink={0} marginTop={1}>
          {installState.status === 'idle' && (
            <Text bold color={detailNavItem === 'install' ? 'yellow' : 'green'}>
              {detailNavItem === 'install' ? '▶ ' : '  '}[I] Install
            </Text>
          )}
          
          {installState.status === 'confirm' && (
            <>
              <Text bold color="cyan">
                Install {selectedServer.name}?
              </Text>
              <Box gap={4} marginTop={1}>
                <Text bold color={installState.selection === 'yes' ? 'yellow' : 'white'}>
                  {installState.selection === 'yes' ? '▶ ' : '  '}Yes
                </Text>
                <Text bold color={installState.selection === 'no' ? uiState.theme.text.accent : 'white'}>
                  {installState.selection === 'no' ? '▶ ' : '  '}No
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  ←→: Select | Enter: Confirm | Esc: Cancel
                </Text>
              </Box>
            </>
          )}
          
          {installState.status === 'installing' && (
            <>
              <Text bold color="cyan">
                Installing {selectedServer.name}...
              </Text>
              <Box marginTop={1}>
                <Text dimColor>
                  Please wait...
                </Text>
              </Box>
            </>
          )}
          
          {installState.status === 'success' && (
            <>
              <Text bold color="green">
                ✓ Installation Successful!
              </Text>
              <Box marginTop={1}>
                <Text dimColor>
                  Press Enter to continue
                </Text>
              </Box>
            </>
          )}
          
          {installState.status === 'error' && (
            <>
              <Text bold color="red">
                ✗ Installation Failed
              </Text>
              <Box marginTop={1}>
                <Text color={uiState.theme.status.error}>
                  {installState.error}
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  Press Enter to dismiss
                </Text>
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  }
  
  // Render list view
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Line 0: Title and Help - STATIC */}
      <Box flexDirection="column" flexShrink={0}>
        <Text bold color="cyan">
          🏪 MCP Marketplace
        </Text>
        <Text dimColor>
          {isSearchFocused
            ? 'Type to search, Enter to finish'
            : `↑↓: Navigate | Enter: View Details | /: Search | ${servers.length} servers`
          }
        </Text>
      </Box>
      
      {/* Search Container - STATIC */}
      <Box flexShrink={0} marginTop={1} marginBottom={1}>
        <Text bold>Search: </Text>
        <Text color={isSearchFocused ? 'yellow' : 'gray'}>
          {searchQuery || 'type / to search'}
          {isSearchFocused && <Text color="yellow">_</Text>}
        </Text>
      </Box>
      
      {/* Scroll up indicator */}
      {showScrollUp && (
        <Box justifyContent="center" flexShrink={0}>
          <Text color="cyan" bold>▲ More above</Text>
        </Box>
      )}
      
      {/* Results Container - SCROLLABLE with overflow hidden */}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
        {visibleServers.map((server, index) => {
          const actualIndex = scrollOffset + index;
          const isSelected = actualIndex === selectedIndex;
          
          return (
            <Box key={server.id} flexDirection="column" flexShrink={0}>
              {/* Server name and version - selectable line */}
              <Text bold color={isSelected ? 'yellow' : 'cyan'}>
                {isSelected ? '▶ ' : '  '}{server.name}{server.version ? ` v${server.version}` : ''}
              </Text>
              
              {/* Description - separate line with padding */}
              <Text dimColor>
                {'   '}{server.description}
              </Text>
              
              {/* Empty line separator */}
              <Text> </Text>
            </Box>
          );
        })}
      </Box>
      
      {/* Scroll down indicator */}
      {showScrollDown && (
        <Box justifyContent="center" flexShrink={0}>
          <Text color="cyan" bold>▼ More below</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Dialog state type
 */
type DialogType = 
  | 'configure'
  | 'oauth'
  | 'tools'
  | 'health'
  | 'logs'
  | 'marketplace'
  | 'install'
  | 'uninstall'
  | 'help'
  | null;

interface DialogState {
  type: DialogType;
  serverName?: string;
  serverId?: string;
}

/**
 * Menu item types for left column
 */
type MenuItemType = 'exit' | 'marketplace' | 'server';

interface MenuItem {
  type: MenuItemType;
  label: string;
  icon: string;
  server?: ExtendedMCPServerStatus;
}

/**
 * MCPTab Component
 * 
 * Main tab component that orchestrates the MCP panel UI with two-column layout.
 * Handles keyboard navigation, dialog management, and server operations.
 */
export function MCPTab({ windowWidth }: MCPTabProps) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <Box flexDirection="column" padding={2}>
          <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
            <Text color="red" bold>
              ⚠️  MCP Panel Error
            </Text>
          </Box>
          <Box marginTop={1} paddingLeft={2}>
            <Text dimColor>{error.message}</Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>The MCP panel encountered an error. Press </Text>
            <Text bold color="cyan">
              Esc or 0
            </Text>
            <Text dimColor> to return to main menu.</Text>
          </Box>
        </Box>
      )}
    >
      <MCPTabContent windowWidth={windowWidth} />
    </ErrorBoundary>
  );
}

/**
 * MCPTab Content Component (wrapped by error boundary)
 */
function MCPTabContent({ windowWidth }: { windowWidth?: number }) {
  const { state: uiState } = useUI();
  const { isFocused, isActive, exitToNavBar } = useFocusManager();
  const { stdout } = useStdout();
  
  // Calculate absolute widths if windowWidth is provided
  const absoluteLeftWidth = windowWidth ? Math.floor(windowWidth * 0.3) : undefined;
  const absoluteRightWidth = windowWidth && absoluteLeftWidth ? (windowWidth - absoluteLeftWidth) : undefined;

  const { 
    state, 
    toggleServer, 
    restartServer, 
    configureServer,
    uninstallServer,
    refreshServers,
  } = useMCP();
  
  // Check if this panel has focus (for navigation and dialogs)
  const hasFocus = isFocused('mcp-panel');
  // Check if we're in active mode (for state-modifying actions like toggle)
  const canModifyState = hasFocus && isActive();
  
  // Get terminal height for calculating content area
  const terminalHeight = (stdout?.rows || 24) - 1;
  
  // Use notification hook for feedback
  const {
    notifications,
    removeNotification,
    showSuccess,
    showError,
    showInfo,
  } = useNotifications();
  
  // Navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeColumn, setActiveColumn] = useState<'left' | 'right'>('left');
  const [scrollOffset, setScrollOffset] = useState(0);
  const windowSize = 15; // Number of items visible in left column
  
  // Track servers that are reconnecting (show "Reconnecting..." instead of "Disconnected")
  // Show reconnecting for servers with error status until they connect
  const reconnectingServers = useMemo(() => {
    return new Set(
      Array.from(state.servers.values())
        .filter(s => s.status === 'error' && !s.config.disabled)
        .map(s => s.name)
    );
  }, [state.servers]);
  
  // Dialog state
  const [dialogState, setDialogState] = useState<DialogState>({ type: null });
  
  // Build menu items for left column
  const menuItems = useMemo((): MenuItem[] => {
    const items: MenuItem[] = [];
    
    // Exit item
    items.push({
      type: 'exit',
      label: 'Exit',
      icon: '←',
    });
    
    // Marketplace item
    items.push({
      type: 'marketplace',
      label: 'Marketplace',
      icon: '🏪',
    });
    
    // Installed servers
    const serverList = Array.from(state.servers.values());
    serverList.forEach(server => {
      items.push({
        type: 'server',
        label: server.name,
        icon: server.config.disabled ? '○' : '●',
        server,
      });
    });
    
    return items;
  }, [state.servers]);
  
  // Get visible items for windowed rendering
  const visibleItems = useMemo(() => {
    return menuItems.slice(scrollOffset, scrollOffset + windowSize);
  }, [menuItems, scrollOffset, windowSize]);
  
  // Get currently selected item
  const selectedItem = useMemo(() => {
    if (selectedIndex >= 0 && selectedIndex < menuItems.length) {
      return menuItems[selectedIndex];
    }
    return null;
  }, [menuItems, selectedIndex]);
  
  // Navigation handlers
  const handleNavigateUp = useCallback(() => {
    if (activeColumn === 'left') {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    }
    // TODO: Handle right column navigation when content supports it
  }, [activeColumn]);
  
  const handleNavigateDown = useCallback(() => {
    if (activeColumn === 'left') {
      setSelectedIndex(prev => Math.min(menuItems.length - 1, prev + 1));
    }
    // TODO: Handle right column navigation when content supports it
  }, [activeColumn, menuItems.length]);
  
  const handleNavigateLeft = useCallback(() => {
    setActiveColumn('left');
  }, []);
  
  const handleNavigateRight = useCallback(() => {
    setActiveColumn('right');
  }, []);
  
  const handleSelect = useCallback(async () => {
    if (!selectedItem) return;
    
    switch (selectedItem.type) {
      case 'exit':
        exitToNavBar();
        break;
        
      case 'marketplace':
        // Don't open dialog, just stay selected to show marketplace in right column
        // The right column will detect selectedItem.type === 'marketplace' and show content
        break;
        
      case 'server':
        // Toggle server enabled/disabled state (only in active mode)
        if (selectedItem.server && canModifyState) {
          try {
            await toggleServer(selectedItem.server.name);
          } catch (error) {
            showError(
              'Toggle failed',
              error instanceof Error ? error.message : 'Failed to toggle server'
            );
          }
        }
        break;
    }
  }, [selectedItem, exitToNavBar, toggleServer, showError, canModifyState]);
  
  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + windowSize) {
      setScrollOffset(selectedIndex - windowSize + 1);
    }
  }, [selectedIndex, scrollOffset, windowSize]);
  
  /**
   * Close dialog handler
   */
  const handleCloseDialog = useCallback(() => {
    setDialogState({ type: null });
  }, []);
  
  /**
   * Render the appropriate dialog based on dialog state
   */
  const renderDialog = () => {
    if (dialogState.type === null) return null;
    
    switch (dialogState.type) {
      case 'configure':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Server Configuration">
            <ServerConfigDialog
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
              onSave={async (config) => {
                await configureServer(dialogState.serverName!, config);
                showSuccess(
                  'Configuration saved',
                  `${dialogState.serverName} has been configured successfully`
                );
                handleCloseDialog();
              }}
            />
          </DialogErrorBoundary>
        );
      
      case 'oauth':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="OAuth Configuration">
            <OAuthConfigDialog
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
            />
          </DialogErrorBoundary>
        );
      
      case 'tools':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Server Tools">
            <ServerToolsViewer
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
            />
          </DialogErrorBoundary>
        );
      
      case 'health':
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Health Monitor">
            <HealthMonitorDialog
              onClose={handleCloseDialog}
            />
          </DialogErrorBoundary>
        );
      
      case 'logs':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Server Logs">
            <ServerLogsViewer
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
            />
          </DialogErrorBoundary>
        );
      
      case 'uninstall':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Uninstall Confirmation">
            <UninstallConfirmDialog
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
              onConfirm={async () => {
                const serverName = dialogState.serverName!;
                await uninstallServer(serverName);
                showSuccess(
                  'Server uninstalled',
                  `${serverName} has been uninstalled successfully`
                );
                handleCloseDialog();
              }}
            />
          </DialogErrorBoundary>
        );
      
      case 'help':
        return (
          <HelpOverlay
            onClose={handleCloseDialog}
            context="main"
          />
        );
      
      default:
        return null;
    }
  };
  
  /**
   * Handle keyboard navigation
   */
  useInput((input, key) => {
    if (!hasFocus) return;
    
    // Handle dialog keyboard input
    if (dialogState.type !== null) {
      if (key.escape) {
        handleCloseDialog();
      } else if (input === '?') {
        setDialogState({ type: 'help' });
      }
      return;
    }
    
    // Show help overlay on '?' key
    if (input === '?') {
      setDialogState({ type: 'help' });
      return;
    }
    
    // Handle navigation
    if (key.upArrow) {
      handleNavigateUp();
    } else if (key.downArrow) {
      handleNavigateDown();
    } else if (key.leftArrow) {
      handleNavigateLeft();
    } else if (key.rightArrow) {
      handleNavigateRight();
    } else if (key.return) {
      handleSelect();
    } else if (key.escape || input === '0') {
      exitToNavBar();
    } else if (input === 'r' || input === 'R') {
      // Restart server
      if (selectedItem?.type === 'server' && selectedItem.server) {
        const server = selectedItem.server;
        showInfo('Restarting server', `${server.name} is restarting...`);
        restartServer(server.name)
          .then(() => {
            showSuccess('Server restarted', `${server.name} has been restarted`);
          })
          .catch(err => {
            showError('Failed to restart', err instanceof Error ? err.message : 'Unknown error');
          });
      }
    } else if (input === 'c' || input === 'C') {
      // Configure server
      if (selectedItem?.type === 'server' && selectedItem.server) {
        setDialogState({ type: 'configure', serverName: selectedItem.server.name });
      }
    } else if (input === 'u' || input === 'U') {
      // Uninstall server
      if (selectedItem?.type === 'server' && selectedItem.server) {
        setDialogState({ type: 'uninstall', serverName: selectedItem.server.name });
      }
    } else if (input === 't' || input === 'T') {
      // View tools
      if (selectedItem?.type === 'server' && selectedItem.server) {
        setDialogState({ type: 'tools', serverName: selectedItem.server.name });
      }
    } else if (input === 'l' || input === 'L') {
      // View logs
      if (selectedItem?.type === 'server' && selectedItem.server) {
        setDialogState({ type: 'logs', serverName: selectedItem.server.name });
      }
    } else if (input === 'o' || input === 'O') {
      // OAuth configuration
      if (selectedItem?.type === 'server' && selectedItem.server) {
        setDialogState({ type: 'oauth', serverName: selectedItem.server.name });
      }
    } else if (input === 'h' || input === 'H') {
      setDialogState({ type: 'health' });
    }
  }, { isActive: hasFocus });
  
  // Loading state
  if (state.isLoading) {
    return (
      <LoadingSpinner
        message="Loading MCP servers..."
        spinnerType="dots"
        color="cyan"
        centered={true}
        padded={true}
      />
    );
  }
  
  // Error state with retry option
  if (state.error) {
    return (
      <Box flexDirection="column" padding={2}>
        <ErrorBanner
          message={state.error}
          canRetry={true}
          onRetry={() => {
            refreshServers().catch(err => {
              console.error('Failed to refresh servers:', err);
            });
          }}
          onDismiss={() => {
            refreshServers().catch(err => {
              console.error('Failed to refresh servers:', err);
            });
          }}
        />
        <Box marginTop={2}>
          <Text dimColor>Press </Text>
          <Text bold color="cyan">
            Esc or 0
          </Text>
          <Text dimColor> to return to main menu</Text>
        </Box>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" height="100%">
      {/* Notification Container */}
      <NotificationContainer
        notifications={notifications}
        onDismiss={removeNotification}
      />
      
      {/* Header with focus indicator */}
      <Box flexDirection="column" paddingX={1} paddingY={1} flexShrink={0}>
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              🔌 MCP Servers
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text wrap="truncate-end" color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary} dimColor={!hasFocus}>
              ↑↓:Nav ←→:Column Enter:Select R:Restart C:Config U:Uninstall T:Tools L:Logs ?:Help 0/Esc:Exit
            </Text>
          </Box>
        </Box>
      </Box>
      
      {/* Two-column layout - Hide when dialog is open to focus on dialog */}
      {dialogState.type === null && (
        <Box flexGrow={1} overflow="hidden" flexDirection="row">
        {/* Left Column: Menu (30%) */}
        <Box 
          flexDirection="column" 
          width={absoluteLeftWidth ?? "30%"} 
          flexShrink={0}
          borderStyle="single" 
          borderColor={hasFocus && activeColumn === 'left' ? uiState.theme.text.accent : uiState.theme.border.primary}
          paddingY={1}
        >
          {/* Scroll indicator at top */}
          {scrollOffset > 0 && (
            <>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.accent} bold>
                  ▲ More above
                </Text>
              </Box>
              <Text> </Text>
            </>
          )}
          
          {/* Scrollable content area */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            {visibleItems.map((item, index) => {
              const actualIndex = scrollOffset + index;
              const isSelected = hasFocus && activeColumn === 'left' && actualIndex === selectedIndex;
              
              // Render Exit item
              if (item.type === 'exit') {
                return (
                  <Box key="exit" flexDirection="column">
                    <Text
                      bold={isSelected}
                      color={isSelected ? uiState.theme.text.accent : uiState.theme.text.primary}
                    >
                      {item.icon} {item.label}
                    </Text>
                  </Box>
                );
              }
              
              // Render Marketplace item
              if (item.type === 'marketplace') {
                return (
                  <Box key="marketplace" flexDirection="column">
                    <Text> </Text>
                    <Text> </Text>
                    <Text
                      bold={isSelected}
                      color={isSelected ? 'yellow' : 'cyan'}
                    >
                      {item.icon} {item.label}
                    </Text>
                  </Box>
                );
              }
              
              return null;
            })}
            
            {/* Installed Servers Header - Always visible */}
            <Text> </Text>
            <Text> </Text>
            <Text bold color={uiState.theme.text.accent}>
              📦 Installed Servers
            </Text>
            <Text> </Text>
            
            {/* Render Server items */}
            {visibleItems.filter(item => item.type === 'server').length === 0 ? (
              <Text dimColor>  No servers installed</Text>
            ) : (
              visibleItems.map((item, index) => {
                const actualIndex = scrollOffset + index;
                const isSelected = hasFocus && activeColumn === 'left' && actualIndex === selectedIndex;
                
                // Render Server item
                if (item.type === 'server' && item.server) {
                  const healthColor = 
                    item.server.health === 'healthy' ? 'green' :
                    item.server.health === 'degraded' ? 'yellow' : 'red';
                  
                  // Determine status text and color
                  const isDisabled = item.server.config.disabled;
                  const isReconnecting = reconnectingServers.has(item.server.name);
                  const statusColor = isDisabled ? 'gray' :
                                     isReconnecting ? 'cyan' :
                                     item.server.status === 'connected' ? 'green' : 
                                     item.server.status === 'error' ? 'red' : 
                                     'yellow';
                  
                  return (
                    <Box key={item.server.name} flexDirection="column">
                      <Text
                        bold={isSelected}
                        color={isSelected ? uiState.theme.text.accent : (isDisabled ? 'gray' : uiState.theme.text.primary)}
                        dimColor={isDisabled}
                      >
                        <Text color={isDisabled ? 'gray' : healthColor}>{item.icon}</Text> {item.label}
                      </Text>
                      {isSelected && (
                        <Box paddingLeft={2}>
                          <Text dimColor={isDisabled} color={statusColor}>
                            {isDisabled ? '○ Disabled' : 
                             isReconnecting ? '⟳ Reconnecting...' :
                             item.server.status === 'connected' ? '✓ Connected' : 
                             item.server.status === 'error' ? '✗ Disconnected' : 
                             '○ Stopped'}
                          </Text>
                        </Box>
                      )}
                    </Box>
                  );
                }
                
                return null;
              })
            )}
          </Box>
          
          {/* Scroll indicator at bottom */}
          {scrollOffset + windowSize < menuItems.length && (
            <>
              <Text> </Text>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.accent} bold>
                  ▼ More below
                </Text>
              </Box>
            </>
          )}
        </Box>
        
        {/* Right Column: Dynamic Content (70%) */}
        <Box 
          flexDirection="column" 
          width={absoluteRightWidth ?? "70%"} 
          flexShrink={0}
          borderStyle="single" 
          borderColor={hasFocus && activeColumn === 'right' ? uiState.theme.text.accent : uiState.theme.border.primary}
          paddingX={2} 
          paddingY={2}
        >
          {(!selectedItem || (selectedItem?.type === 'exit' && activeColumn === 'left')) && (
            <Box flexDirection="column" paddingX={2} paddingY={1}>
              <Text bold color={uiState.theme.text.accent}>═══════════════════════════════════════════════════════════════════</Text>
              <Text></Text>
              <Text bold color={uiState.theme.text.accent}>                    MCP Registry - Marketplace</Text>
              <Text></Text>
              <Text>The MCP registry provides MCP clients with a list of MCP servers.</Text>
              <Text></Text>
              <Text color={uiState.theme.text.secondary}>───────────────────────────────────────────────────────────────────</Text>
              <Text></Text>
              <Text bold>Documentation:</Text>
              <Text></Text>
              <Text>📄 <Text color={uiState.theme.text.accent}>Public-facing docs</Text> - Published on modelcontextprotocol.io</Text>
              <Text></Text>
              <Text>🏗️ <Text color={uiState.theme.text.accent}>Design documentation</Text> - Architecture, vision, and roadmap</Text>
              <Text></Text>
              <Text>📖 <Text color={uiState.theme.text.accent}>Reference</Text> - Technical specifications</Text>
              <Text></Text>
              <Text>🔧 <Text color={uiState.theme.text.accent}>Contributing guides</Text> - How to contribute</Text>
              <Text></Text>
              <Text>🔒 <Text color={uiState.theme.text.accent}>Administration</Text> - Admin operations</Text>
              <Text></Text>
              <Text color={uiState.theme.text.secondary}>───────────────────────────────────────────────────────────────────</Text>
              <Text></Text>
              <Text color={uiState.theme.text.secondary} dimColor>Press Enter to browse marketplace or ↑↓ to navigate</Text>
              <Text></Text>
              <Text bold color={uiState.theme.text.accent}>═══════════════════════════════════════════════════════════════════</Text>
            </Box>
          )}
          
          {selectedItem?.type === 'exit' && activeColumn === 'right' && (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
              <Text color={uiState.theme.text.secondary} dimColor>
                ⬅️  Press Enter or Esc to exit
              </Text>
            </Box>
          )}
          
          {selectedItem?.type === 'marketplace' && (
            <MarketplaceContent 
              activeColumn={activeColumn}
              height={terminalHeight}
              onRefreshServers={refreshServers}
            />
          )}
          
          {selectedItem?.type === 'server' && selectedItem.server && (
            <ServerDetailsContent
              server={selectedItem.server}
              activeColumn={activeColumn}
              onToggle={async () => {
                // Toggle server enabled/disabled in settings
                await toggleServer(selectedItem.server!.name);
              }}
              onDelete={async () => {
                // Permanently delete server from settings
                await uninstallServer(selectedItem.server!.name);
              }}
              onRefreshServers={refreshServers}
            />
          )}
          
          {!selectedItem && (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
              <Text color={uiState.theme.text.secondary} dimColor>
                👆 Select an item to view details
              </Text>
            </Box>
          )}
        </Box>
      </Box>
      )}

      {dialogState.type !== null && renderDialog()}

      {/* Operation Progress */}
      {state.operationsInProgress.size > 0 && (
        <Box borderStyle="single" borderColor={uiState.theme.text.accent} paddingX={1}>
          <OperationProgress operations={state.operationsInProgress} />
        </Box>
      )}
      
      {/* Render active dialog (moved inside conditional above) */}
    </Box>
  );
}
