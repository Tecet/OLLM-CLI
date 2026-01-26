# MCP Panel UI - Design

**Feature:** Interactive UI for managing MCP servers and marketplace  
**Status:** ✅ IMPLEMENTED  
**Created:** 2026-01-17  
**Last Updated:** 2026-01-19

## Implementation Status

**Core Functionality**: ✅ COMPLETE  
**UI Components**: ✅ COMPLETE  
**Navigation**: ✅ COMPLETE  
**Dialogs**: ✅ COMPLETE  
**Integration**: ✅ COMPLETE  
**Testing**: ⚠️ 89.8% passing (9 MCPTab tests failing)  
**Documentation**: ⚠️ PARTIAL

### Key Achievements

1. **Full MCP Integration**: Tools discovered, wrapped, registered, and available to LLM
2. **Two-Column UI**: 30% menu (left), 70% details (right) with keyboard navigation
3. **Real-Time Health Monitoring**: Background health checks every 30 seconds
4. **Marketplace Integration**: Browse and install from MCP Registry API v0.1
5. **Configuration Management**: Atomic writes, backup/restore, file watching
6. **Error Handling**: Retry logic, error boundaries, user-friendly messages
7. **Visual Feedback**: Loading spinners, progress indicators, notifications

### Architecture Changes from Original Design

**Simplified Navigation**:
- Original: Complex windowed rendering with scroll indicators
- Implemented: Simpler two-column layout with menu sections (Marketplace, Installed Servers)
- Reason: Better UX, easier to implement, sufficient for current needs

**Menu Structure**:
- Original: Single scrollable server list
- Implemented: Two sections - Marketplace (top) and Installed Servers (bottom)
- Reason: Clearer separation of concerns, easier discovery

**Health Monitoring**:
- Original: Separate health monitor dialog
- Implemented: Integrated into server details with countdown timer
- Reason: More immediate feedback, less context switching

**OAuth Flow**:
- Original: Full interactive OAuth with browser opening
- Implemented: Infrastructure ready, UI components created, needs end-to-end testing
- Status: Partial implementation

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ User Action: Navigate to MCP Tab                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ MCPTab Component                                             │
│ - Load servers from MCPClient                                │
│ - Load health status from MCPHealthMonitor                   │
│ - Load marketplace data from MCPMarketplace                  │
│ - Render server list with navigation                         │
└────────────────┬────────────────────────────────────────────┘
                 │
         ┌───────┴───────┬───────────────┬──────────────┐
         │               │               │              │
    Toggle Server   Configure Server  Marketplace   Health Monitor
         │               │               │              │
         ▼               ▼               ▼              ▼
┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐
│ Update       │  │ Show Dialog  │  │ Browse & │  │ Monitor  │
│ mcp.json     │  │ - Config     │  │ Install  │  │ Status   │
│ Restart      │  │ - OAuth      │  │ Servers  │  │ Updates  │
│ Server       │  │ - Tools      │  │          │  │          │
└──────────────┘  └──────────────┘  └──────────┘  └──────────┘
```

## Component Design

### 1. MCPContext

**File:** `packages/cli/src/ui/contexts/MCPContext.tsx`

Provides MCP server data and management functions to all MCP-related components.

```typescript
interface MCPServerStatus {
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'error' | 'connecting';
  health: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  lastError?: string;
  tools: MCPTool[];
  resources: MCPResource[];
  config: MCPServerConfig;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: object;
  autoApproved: boolean;
}

interface MCPMarketplaceServer {
  id: string;
  name: string;
  description: string;
  rating: number;
  installCount: number;
  requiresOAuth: boolean;
  requirements: string[];
  command: string;
  args?: string[];
}

interface MCPContextValue {
  // Data
  servers: Map<string, MCPServerStatus>;
  config: MCPConfig;
  marketplace: MCPMarketplaceServer[];
  loading: boolean;
  error: string | null;
  
  // Server Management
  toggleServer: (serverName: string) => Promise<void>;
  restartServer: (serverName: string) => Promise<void>;
  installServer: (serverId: string, config: MCPServerConfig) => Promise<void>;
  uninstallServer: (serverName: string) => Promise<void>;
  configureServer: (serverName: string, config: MCPServerConfig) => Promise<void>;
  
  // OAuth Management
  configureOAuth: (serverName: string, oauth: OAuthConfig) => Promise<void>;
  refreshOAuthToken: (serverName: string) => Promise<void>;
  revokeOAuthAccess: (serverName: string) => Promise<void>;
  
  // Health & Monitoring
  getServerHealth: (serverName: string) => ServerHealth;
  getServerLogs: (serverName: string, lines?: number) => Promise<string[]>;
  
  // Tool Management
  getServerTools: (serverName: string) => MCPTool[];
  setToolAutoApprove: (serverName: string, toolName: string, approve: boolean) => Promise<void>;
  
  // Marketplace
  searchMarketplace: (query: string) => Promise<MCPMarketplaceServer[]>;
  refreshMarketplace: () => Promise<void>;
}
```

**Implementation:**

```typescript
export const MCPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [servers, setServers] = useState<Map<string, MCPServerStatus>>(new Map());
  const [config, setConfig] = useState<MCPConfig>({ mcpServers: {} });
  const [marketplace, setMarketplace] = useState<MCPMarketplaceServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const mcpClient = useMemo(() => new MCPClient(), []);
  const healthMonitor = useMemo(() => new MCPHealthMonitor(mcpClient), [mcpClient]);
  const oauthManager = useMemo(() => new OAuthManager(), []);
  const marketplaceService = useMemo(() => new MCPMarketplace(), []);
  
  // Load initial data
  useEffect(() => {
    loadServers();
    loadMarketplace();
    
    // Subscribe to health updates
    const unsubscribe = healthMonitor.subscribeToHealthUpdates((health) => {
      updateServerHealth(health);
    });
    
    return () => unsubscribe();
  }, []);
  
  const toggleServer = async (serverName: string) => {
    const server = servers.get(serverName);
    if (!server) return;
    
    const newConfig = {
      ...config,
      mcpServers: {
        ...config.mcpServers,
        [serverName]: {
          ...config.mcpServers[serverName],
          disabled: !config.mcpServers[serverName].disabled
        }
      }
    };
    
    await saveConfig(newConfig);
    
    if (newConfig.mcpServers[serverName].disabled) {
      await mcpClient.stopServer(serverName);
    } else {
      await mcpClient.startServer(serverName);
    }
    
    setConfig(newConfig);
    await loadServers();
  };
  
  // ... other methods
  
  return (
    <MCPContext.Provider value={{ /* ... */ }}>
      {children}
    </MCPContext.Provider>
  );
};
```

### 2. MCPTab Component

**File:** `packages/cli/src/ui/components/tabs/MCPTab.tsx`

Main container for the MCP panel UI following Browse Mode/Active Mode pattern.

```typescript
export const MCPTab: React.FC = () => {
  const { servers, marketplace, loading, error } = useMCP();
  const { focusedPanel } = useFocusContext();
  const { 
    selectedIndex,
    isOnExitItem,
    expandedServers,
    scrollOffset,
    isActive,
    visibleServers,
    showScrollUp,
    showScrollDown,
    handleKeyPress,
  } = useMCPNavigation();
  
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  
  // Only handle input when in Active Mode and no dialog is open
  useInput((input, key) => {
    if (!isActive || dialogState) return;
    
    handleKeyPress(input, key, {
      onToggle: handleToggleServer,
      onConfigure: () => setDialogState({ type: 'configure', serverName: getSelectedServer() }),
      onOAuth: () => setDialogState({ type: 'oauth', serverName: getSelectedServer() }),
      onViewTools: () => setDialogState({ type: 'tools', serverName: getSelectedServer() }),
      onRestart: handleRestartServer,
      onLogs: () => setDialogState({ type: 'logs', serverName: getSelectedServer() }),
      onMarketplace: () => setDialogState({ type: 'marketplace' }),
      onHealth: () => setDialogState({ type: 'health' }),
      onInstall: handleInstallServer,
      onUninstall: handleUninstallServer
    });
  });
  
  if (loading) return <LoadingSpinner message="Loading MCP servers..." />;
  if (error) return <ErrorMessage message={error} />;
  
  const getSelectedServer = () => {
    if (isOnExitItem || selectedIndex < 0) return null;
    return Array.from(servers.values())[selectedIndex]?.name;
  };
  
  return (
    <Box flexDirection="column" height="100%">
      {/* Header with focus indicator */}
      <Box borderStyle="single" borderColor={isActive ? 'cyan' : 'gray'}>
        <Text bold>
          {isActive ? '▶ ' : ''}MCP Servers
        </Text>
        <Box marginLeft="auto">
          <Text dimColor>
            {isActive 
              ? '↑↓:Nav Enter:Expand ←→:Toggle 0/Esc:Exit'
              : 'Press Enter to activate'
            }
          </Text>
        </Box>
      </Box>
      
      <Box flexDirection="row" flexGrow={1}>
        {/* Left Column: Server List (30%) */}
        <Box flexDirection="column" width="30%" borderStyle="single" borderColor="gray">
          {/* Scroll up indicator */}
          {showScrollUp && (
            <>
              <Text dimColor>▲ Scroll up for more</Text>
              <Text> </Text>
            </>
          )}
          
          {/* Exit item */}
          <Box>
            <Text color={isOnExitItem ? 'yellow' : undefined} bold={isOnExitItem}>
              ← Exit
            </Text>
          </Box>
          <Text> </Text>
          <Text> </Text>
          
          {/* Server list (windowed) */}
          {visibleServers.map((server, index) => {
            const actualIndex = scrollOffset > 0 ? scrollOffset - 1 + index : index;
            const isFocused = !isOnExitItem && selectedIndex === actualIndex;
            
            return (
              <ServerListItem
                key={server.name}
                server={server}
                focused={isFocused}
                expanded={expandedServers.has(server.name)}
              />
            );
          })}
          
          {/* Scroll down indicator */}
          {showScrollDown && (
            <>
              <Text> </Text>
              <Text dimColor>▼ Scroll down for more</Text>
            </>
          )}
        </Box>
        
        {/* Right Column: Server Details (70%) */}
        <Box flexDirection="column" width="70%" borderStyle="single" borderColor="gray" padding={1}>
          {isOnExitItem ? (
            <Text dimColor>Select a server to view details</Text>
          ) : (
            <ServerDetails 
              server={Array.from(servers.values())[selectedIndex]}
              expanded={expandedServers.has(Array.from(servers.values())[selectedIndex]?.name)}
            />
          )}
        </Box>
      </Box>
      
      {/* Marketplace Preview (if not in active mode) */}
      {!isActive && (
        <MarketplacePreview 
          servers={marketplace.slice(0, 3)}
        />
      )}
      
      {/* Actions Footer */}
      <MCPActions 
        isActive={isActive}
        hasSelection={!isOnExitItem && selectedIndex >= 0}
      />
      
      {/* Dialogs */}
      {dialogState && renderDialog(dialogState, setDialogState)}
    </Box>
  );
};

/**
 * Server list item component (left column)
 */
const ServerListItem: React.FC<{
  server: MCPServerStatus;
  focused: boolean;
  expanded: boolean;
}> = ({ server, focused, expanded }) => {
  const healthColor = getHealthColor(server.health);
  const statusIcon = getStatusIcon(server.status);
  const expandIcon = expanded ? '▼' : '>';
  
  return (
    <Box marginY={1}>
      <Text color={focused ? 'yellow' : undefined} bold={focused}>
        {expandIcon} {server.name}
      </Text>
      <Box marginLeft={1}>
        <Text color={healthColor}>{statusIcon}</Text>
      </Box>
    </Box>
  );
};

/**
 * Server details component (right column)
 */
const ServerDetails: React.FC<{
  server: MCPServerStatus;
  expanded: boolean;
}> = ({ server, expanded }) => {
  if (!server) return null;
  
  const healthColor = getHealthColor(server.health);
  const statusIcon = getStatusIcon(server.status);
  const toggleIndicator = server.config.disabled ? '○ Disabled' : '● Enabled';
  
  return (
    <Box flexDirection="column">
      <Text bold color="yellow">{server.name}</Text>
      <Text dimColor>{server.description || 'No description available'}</Text>
      
      <Box marginTop={1}>
        <Text>Status: </Text>
        <Text color={healthColor}>{statusIcon} {server.health}</Text>
        <Text> | </Text>
        <Text>{toggleIndicator}</Text>
      </Box>
      
      {expanded && (
        <>
          <Box marginTop={1}>
            <Text>Tools: {server.tools?.length || 0}</Text>
            <Text> | Resources: {server.resources || 0}</Text>
            {server.uptime > 0 && <Text> | Uptime: {formatUptime(server.uptime)}</Text>}
          </Box>
          
          {server.config.oauth && (
            <Box marginTop={1}>
              <Text>OAuth: {getOAuthStatus(server)}</Text>
            </Box>
          )}
          
          {server.error && (
            <Box marginTop={1}>
              <Text color={server.health === 'unhealthy' ? 'red' : 'yellow'}>
                {server.health === 'unhealthy' ? 'Error: ' : 'Warning: '}
                {server.error}
              </Text>
            </Box>
          )}
          
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
```

### 3. ServerItem Component

**File:** `packages/cli/src/ui/components/mcp/ServerItem.tsx`

Displays individual MCP server with status and actions.

```typescript
export const ServerItem: React.FC<{
  server: MCPServerStatus;
  focused: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}> = ({ server, focused, expanded, onToggle, onExpand }) => {
  const healthColor = getHealthColor(server.health);
  const statusIcon = getStatusIcon(server.status);
  
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color={focused ? 'cyan' : undefined}>
          {expanded ? '▼' : '>'} {server.name}
        </Text>
        <Box marginLeft={2}>
          <Toggle 
            enabled={!server.config.disabled} 
            focused={focused}
            onChange={onToggle}
          />
        </Box>
        <Box marginLeft={2}>
          <Text color={healthColor}>{statusIcon} {server.health}</Text>
        </Box>
      </Box>
      
      <Box marginLeft={2}>
        <Text dimColor>{server.description}</Text>
      </Box>
      
      {expanded && (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <ServerStats server={server} />
          <ServerActions server={server} focused={focused} />
        </Box>
      )}
    </Box>
  );
};

const ServerStats: React.FC<{ server: MCPServerStatus }> = ({ server }) => (
  <Box>
    <Text>Tools: {server.tools.length}</Text>
    <Text> | Resources: {server.resources.length}</Text>
    {server.uptime > 0 && <Text> | Uptime: {formatUptime(server.uptime)}</Text>}
    {server.config.oauth && <Text> | OAuth: {getOAuthStatus(server)}</Text>}
  </Box>
);

const ServerActions: React.FC<{ server: MCPServerStatus; focused: boolean }> = ({ server, focused }) => (
  <Box marginTop={1}>
    <Text dimColor>
      [V] View Tools  [C] Configure  [R] Restart  [L] Logs  [U] Uninstall
    </Text>
  </Box>
);
```

### 4. Navigation Hook

**File:** `packages/cli/src/ui/hooks/useMCPNavigation.ts`

Manages keyboard navigation and focus state following the Browse Mode/Active Mode pattern.

```typescript
export const useMCPNavigation = () => {
  const { servers } = useMCP();
  const { focusedPanel, setActivePanel, exitActiveMode } = useFocusContext();
  
  // Navigation state
  const [selectedIndex, setSelectedIndex] = useState(0); // Current selected item
  const [isOnExitItem, setIsOnExitItem] = useState(false); // Exit item at position 0
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const serverList = Array.from(servers.values());
  const isActive = focusedPanel === 'mcp-panel';
  
  // Windowed rendering configuration
  const terminalHeight = process.stdout.rows || 24;
  const headerRows = 3; // Header + spacing
  const footerRows = 2; // Actions footer
  const availableRows = terminalHeight - headerRows - footerRows;
  const windowSize = Math.max(5, availableRows - 4); // Reserve space for scroll indicators
  
  // Calculate visible window
  const totalItems = 1 + serverList.length; // Exit item + servers
  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(scrollOffset + windowSize, totalItems);
  const visibleServers = serverList.slice(
    Math.max(0, scrollOffset - 1), // Adjust for Exit item
    Math.max(0, visibleEnd - 1)
  );
  
  // Scroll indicators
  const showScrollUp = scrollOffset > 0;
  const showScrollDown = visibleEnd < totalItems;
  
  /**
   * Handle keyboard input in Active Mode
   */
  const handleKeyPress = (input: string, key: Key, actions: NavigationActions) => {
    // Exit to Browse Mode
    if (key.escape || input === '0') {
      if (hasUnsavedChanges) {
        // Auto-save on exit
        saveChanges();
      }
      exitActiveMode();
      return;
    }
    
    // Up/Down navigation
    if (key.upArrow) {
      if (isOnExitItem) {
        // Already at top, no action
        return;
      }
      
      if (selectedIndex === 0) {
        // Move to Exit item
        setIsOnExitItem(true);
        setSelectedIndex(-1);
        adjustScroll(-1);
      } else {
        // Move to previous server
        setSelectedIndex(selectedIndex - 1);
        adjustScroll(selectedIndex - 1);
      }
    } else if (key.downArrow) {
      if (isOnExitItem) {
        // Move from Exit to first server
        setIsOnExitItem(false);
        setSelectedIndex(0);
        adjustScroll(0);
      } else if (selectedIndex < serverList.length - 1) {
        // Move to next server
        setSelectedIndex(selectedIndex + 1);
        adjustScroll(selectedIndex + 1);
      }
      // Already at bottom, no action
    }
    
    // Enter key actions
    else if (key.return) {
      if (isOnExitItem) {
        // Exit on Enter from Exit item
        exitActiveMode();
      } else {
        // Toggle expand/collapse for selected server
        const serverName = serverList[selectedIndex].name;
        toggleServer(serverName);
      }
    }
    
    // Left/Right toggle enabled/disabled
    else if (key.leftArrow || key.rightArrow) {
      if (!isOnExitItem) {
        const serverName = serverList[selectedIndex].name;
        actions.onToggle(serverName);
        setHasUnsavedChanges(true);
      }
    }
    
    // Action keys (only when not on Exit item)
    else if (!isOnExitItem) {
      if (input === 'v') actions.onViewTools();
      else if (input === 'c') actions.onConfigure();
      else if (input === 'o') actions.onOAuth();
      else if (input === 'r') actions.onRestart();
      else if (input === 'l') actions.onLogs();
      else if (input === 'm') actions.onMarketplace();
      else if (input === 'h') actions.onHealth();
      else if (input === 'i') actions.onInstall();
      else if (input === 'u') actions.onUninstall();
    }
  };
  
  /**
   * Adjust scroll offset to keep selected item visible
   */
  const adjustScroll = (index: number) => {
    const position = index + 1; // Account for Exit item at position 0
    
    if (position < scrollOffset) {
      // Scroll up to show item
      setScrollOffset(position);
    } else if (position >= scrollOffset + windowSize) {
      // Scroll down to show item
      setScrollOffset(position - windowSize + 1);
    }
  };
  
  /**
   * Toggle server expand/collapse
   */
  const toggleServer = (serverName: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };
  
  /**
   * Save pending changes
   */
  const saveChanges = async () => {
    // Save any pending configuration changes
    setHasUnsavedChanges(false);
  };
  
  return {
    // State
    selectedIndex,
    isOnExitItem,
    expandedServers,
    scrollOffset,
    isActive,
    hasUnsavedChanges,
    
    // Windowed rendering
    visibleServers,
    showScrollUp,
    showScrollDown,
    
    // Actions
    handleKeyPress,
    toggleServer,
    saveChanges,
  };
};
```

## Navigation Modes

### Browse Mode
- **Purpose**: Navigate between major UI areas (tabs, panels)
- **Key**: `Tab` / `Shift+Tab` cycles through focusable areas
- **Behavior**: High-level navigation, moving between different sections
- **Visual**: Focused area shows accent color border
- **MCP Tab**: Shows as "MCP" in navigation bar, accessible via `Ctrl+8`

### Active Mode
- **Purpose**: Navigate within MCP panel content
- **Key**: `Enter` to activate from Browse Mode, `Esc` or `0` to exit
- **Behavior**: Internal navigation within server list
- **Visual**: 
  - Selected item highlighted in yellow
  - Panel header shows "▶" indicator
  - Exit item always at position 0

## Navigation Flow

```
Browse Mode (Tab cycling)
    ↓ Enter on MCP tab
Active Mode (Server list navigation)
    ↓ Esc/0
Browse Mode (Returns to nav-bar)
```

## Key Bindings

### Global (Browse Mode)
- `Tab` - Cycle focus forward through UI areas
- `Shift+Tab` - Cycle focus backward through UI areas
- `Ctrl+8` - Jump directly to MCP tab
- `Enter` - Activate MCP tab (switch to Active Mode)

### Active Mode (Within MCP Panel)
- `Up/Down` - Navigate servers (Exit item → servers)
- `Enter` - On Exit: exit to Browse Mode; On server: toggle enabled/disabled
- `Space` - Expand/collapse server details
- `Esc` or `0` - Exit to Browse Mode (returns to nav-bar, auto-saves changes)
- `V` - View server tools
- `C` - Configure server
- `O` - OAuth configuration
- `R` - Restart server
- `L` - View logs
- `M` - Open marketplace
- `H` - Health monitor
- `I` - Install server (in marketplace)
- `U` - Uninstall server

## MCP Panel Layout

### Two-Column Design (30/70 Split)

#### Left Column (30% width)
- **Purpose**: Server list with status indicators
- **Content**:
  - Exit item (position 0, always at top): "← Exit"
  - 2 empty lines below Exit item
  - Server items with health indicators
- **Features**:
  - Sticky scroll indicators (top/bottom)
  - Windowed rendering for performance (>20 servers)
  - Yellow highlighting for selected item
  - Expand/collapse indicators (▼ expanded, > collapsed)

#### Right Column (70% width)
- **Purpose**: Detailed information about selected server
- **Content**:
  - Server name (bold, yellow when focused)
  - Description
  - Status (Enabled/Disabled with toggle indicator)
  - Health status with icon and color
  - Statistics (tools, resources, uptime, OAuth status)
  - Available actions when expanded
- **Updates**: Dynamically updates as user navigates left column

### Exit Item
- **Position**: Always at position 0 (top of menu)
- **Label**: "← Exit"
- **Behavior**: 
  - Selectable with Up/Down navigation
  - Pressing Enter triggers exit (same as Esc/0)
  - Highlighted in yellow when selected
  - Auto-saves changes on exit
- **Spacing**: 2 empty lines below Exit item

### Scroll Indicators
- **Position**: Sticky at top and bottom of left column
- **Top**: "▲ Scroll up for more" (shown when scrollOffset > 0)
- **Bottom**: "▼ Scroll down for more" (shown when more items below)
- **Spacing**: 1 empty line between indicator and content
- **Color**: Secondary text color (dimmed)

## Navigation Rules

### Server List Navigation
1. **Up Arrow**:
   - From Exit item: No action (already at top)
   - From first server: Move to Exit item
   - From any server: Move to previous server

2. **Down Arrow**:
   - From Exit item: Move to first server
   - From any server: Move to next server
   - From last server: No action (already at bottom)

3. **Enter**:
   - On Exit item: Exit to Browse Mode (nav-bar)
   - On server item: Toggle enabled/disabled state
   - Sets `hasUnsavedChanges` flag
   - Visual toggle indicator updates immediately

4. **Space**:
   - On server item: Expand/collapse server details
   - Shows/hides detailed information in right column

5. **Esc or 0**:
   - Exit Active Mode
   - Return to Browse Mode (focus on nav-bar)
   - Auto-save if `hasUnsavedChanges` is true

### Action Keys
- Only active when a server is selected (not on Exit item)
- Open dialogs or perform actions on selected server
- Dialog interactions handled separately (own input handling)

## Visual Design Principles

### Highlighting
- **Selected item**: Yellow text (bold)
- **No borders**: Removed to prevent layout breaking
- **Focus indicator**: "▶" prefix on panel header when active
- **Health indicators**: Color-coded icons (● ⚠ ✗ ○ ⟳)

### Spacing
- **Exit item**: 2 empty lines below
- **Server items**: 1 empty line between items
- **Scroll indicators**: 1 empty line between indicator and content
- **No padding**: Between scroll indicators and container borders

### Colors
- **Selected**: Yellow (`'yellow'`)
- **Healthy**: Green (`'green'`)
- **Degraded**: Yellow (`'yellow'`)
- **Unhealthy**: Red (`'red'`)
- **Stopped**: Gray (`'gray'`)
- **Connecting**: Blue (`'blue'`)
- **Primary text**: Theme primary color
- **Secondary text**: Theme secondary color (descriptions, scroll indicators)

## Header Design

### Compact Layout
```
┌──────────────────────────────────────────────────────────────┐
│ ▶ MCP Servers    ↑↓:Nav Enter:Expand ←→:Toggle 0/Esc:Exit   │
└──────────────────────────────────────────────────────────────┘
```

- **Left**: Title with focus indicator (▶ when active)
- **Right**: Compact navigation help
- **Dynamic**: Shows relevant shortcuts based on context

## Implementation Notes

### State Management
- `isOnExitItem`: Boolean flag tracking if Exit is selected
- `selectedIndex`: Current server index (0-based, -1 when on Exit)
- `expandedServers`: Set of expanded server names
- `scrollOffset`: Window position for rendering
- `hasUnsavedChanges`: Flag for unsaved server state changes

### Windowed Rendering
- **Window size**: Calculated from terminal height
- **Total items**: Exit + all servers
- **Position calculation**: Accounts for Exit item at position 0
- **Auto-scroll**: Keeps selected item visible within window
- **Performance**: Only renders visible slice of server list

### Focus Management
- **FocusContext**: Manages global focus state
- **Mode tracking**: `'browse'` or `'active'`
- **Panel ID**: `'mcp-panel'` for MCP tab
- **Tab mapping**: `'mcp'` → `'mcp-panel'`

## Dialog Components

### 1. ServerConfigDialog

**File:** `packages/cli/src/ui/components/dialogs/ServerConfigDialog.tsx`

Dialog for configuring MCP server settings.

```typescript
export const ServerConfigDialog: React.FC<{
  serverName: string;
  onClose: () => void;
  onSave: (config: MCPServerConfig) => Promise<void>;
}> = ({ serverName, onClose, onSave }) => {
  const { servers } = useMCP();
  const server = servers.get(serverName);
  
  const [config, setConfig] = useState<MCPServerConfig>(server?.config || {
    command: '',
    args: [],
    env: {},
    disabled: false,
    autoApprove: []
  });
  
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    Object.entries(config.env || {}).map(([key, value]) => ({ key, value }))
  );
  
  const handleSave = async () => {
    const envObj = envVars.reduce((acc, { key, value }) => {
      if (key) acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    await onSave({
      ...config,
      env: envObj
    });
    
    onClose();
  };
  
  return (
    <Dialog title={`Configure Server: ${serverName}`} onClose={onClose}>
      <Box flexDirection="column" padding={1}>
        <FormField label="Command">
          <TextInput 
            value={config.command}
            onChange={(value) => setConfig({ ...config, command: value })}
          />
        </FormField>
        
        <FormField label="Arguments">
          <TextInput 
            value={config.args?.join(' ') || ''}
            onChange={(value) => setConfig({ ...config, args: value.split(' ') })}
          />
        </FormField>
        
        <FormField label="Environment Variables">
          {envVars.map((envVar, index) => (
            <Box key={index}>
              <TextInput 
                placeholder="KEY"
                value={envVar.key}
                onChange={(key) => updateEnvVar(index, { ...envVar, key })}
              />
              <TextInput 
                placeholder="value"
                value={envVar.value}
                onChange={(value) => updateEnvVar(index, { ...envVar, value })}
                mask={isSecret(envVar.key)}
              />
            </Box>
          ))}
          <Button label="Add Variable" onPress={() => addEnvVar()} />
        </FormField>
        
        <Box marginTop={1}>
          <Button label="Save" onPress={handleSave} />
          <Button label="Cancel" onPress={onClose} />
          <Button label="Test Connection" onPress={testConnection} />
        </Box>
      </Box>
    </Dialog>
  );
};
```

### 2. OAuthConfigDialog

**File:** `packages/cli/src/ui/components/dialogs/OAuthConfigDialog.tsx`

```typescript
export const OAuthConfigDialog: React.FC<{
  serverName: string;
  onClose: () => void;
}> = ({ serverName, onClose }) => {
  const { servers, configureOAuth, refreshOAuthToken, revokeOAuthAccess } = useMCP();
  const server = servers.get(serverName);
  const oauthManager = useOAuthManager();
  
  const [oauthConfig, setOAuthConfig] = useState(server?.config.oauth || {
    provider: '',
    clientId: '',
    scopes: []
  });
  
  const [oauthStatus, setOAuthStatus] = useState(
    oauthManager.getOAuthStatus(serverName)
  );
  
  const handleAuthorize = async () => {
    const authUrl = await oauthManager.authorize(serverName);
    // Open browser or show URL to user
    openBrowser(authUrl);
  };
  
  return (
    <Dialog title={`OAuth Configuration: ${serverName}`} onClose={onClose}>
      <Box flexDirection="column" padding={1}>
        <FormField label="Provider">
          <Text>{oauthConfig.provider}</Text>
        </FormField>
        
        <FormField label="Client ID">
          <TextInput 
            value={oauthConfig.clientId}
            onChange={(value) => setOAuthConfig({ ...oauthConfig, clientId: value })}
          />
        </FormField>
        
        <FormField label="Scopes">
          {oauthConfig.scopes.map((scope, index) => (
            <Checkbox 
              key={scope}
              label={scope}
              checked={true}
              onChange={() => toggleScope(scope)}
            />
          ))}
        </FormField>
        
        <Box marginTop={1}>
          <Text>Status: {oauthStatus.connected ? '● Connected' : '○ Not Connected'}</Text>
          {oauthStatus.expiresAt && (
            <Text>Token expires: {formatDate(oauthStatus.expiresAt)}</Text>
          )}
        </Box>
        
        <Box marginTop={1}>
          <Button label="Save" onPress={() => configureOAuth(serverName, oauthConfig)} />
          <Button label="Authorize" onPress={handleAuthorize} />
          <Button label="Refresh Token" onPress={() => refreshOAuthToken(serverName)} />
          <Button label="Revoke" onPress={() => revokeOAuthAccess(serverName)} />
        </Box>
      </Box>
    </Dialog>
  );
};
```

### 3. InstallServerDialog

**File:** `packages/cli/src/ui/components/dialogs/InstallServerDialog.tsx`

```typescript
export const InstallServerDialog: React.FC<{
  server: MCPMarketplaceServer;
  onClose: () => void;
  onInstall: (serverId: string, config: MCPServerConfig) => Promise<void>;
}> = ({ server, onClose, onInstall }) => {
  const [config, setConfig] = useState<MCPServerConfig>({
    command: server.command,
    args: server.args || [],
    env: {},
    disabled: false,
    autoApprove: []
  });
  
  const [autoApproveAll, setAutoApproveAll] = useState(false);
  
  const handleInstall = async () => {
    await onInstall(server.id, config);
    onClose();
  };
  
  return (
    <Dialog title="Install MCP Server" onClose={onClose}>
      <Box flexDirection="column" padding={1}>
        <Text bold>{server.name}</Text>
        <Text dimColor>{server.description}</Text>
        <Text>Rating: {'★'.repeat(Math.floor(server.rating))} ({server.installCount} installs)</Text>
        
        <Box marginTop={1}>
          <Text bold>Requirements:</Text>
          {server.requirements.map(req => (
            <Text key={req}>• {req}</Text>
          ))}
        </Box>
        
        <Box marginTop={1}>
          <Text bold>Configuration:</Text>
          {/* Dynamic form fields based on server requirements */}
          <FormField label="API Key">
            <TextInput 
              value={config.env?.API_KEY || ''}
              onChange={(value) => setConfig({
                ...config,
                env: { ...config.env, API_KEY: value }
              })}
              mask={true}
            />
          </FormField>
        </Box>
        
        <Box marginTop={1}>
          <Checkbox 
            label="Auto-approve all tools"
            checked={autoApproveAll}
            onChange={setAutoApproveAll}
          />
        </Box>
        
        <Box marginTop={1}>
          <Button label="Install" onPress={handleInstall} />
          <Button label="Cancel" onPress={onClose} />
        </Box>
      </Box>
    </Dialog>
  );
};
```

### 4. ServerToolsViewer

**File:** `packages/cli/src/ui/components/dialogs/ServerToolsViewer.tsx`

```typescript
export const ServerToolsViewer: React.FC<{
  serverName: string;
  onClose: () => void;
}> = ({ serverName, onClose }) => {
  const { getServerTools, setToolAutoApprove } = useMCP();
  const tools = getServerTools(serverName);
  
  const [toolStates, setToolStates] = useState<Map<string, boolean>>(
    new Map(tools.map(tool => [tool.name, tool.autoApproved]))
  );
  
  const groupedTools = groupToolsByCategory(tools);
  
  const handleToggleTool = (toolName: string) => {
    const newState = !toolStates.get(toolName);
    setToolStates(new Map(toolStates.set(toolName, newState)));
  };
  
  const handleSave = async () => {
    for (const [toolName, approved] of toolStates) {
      await setToolAutoApprove(serverName, toolName, approved);
    }
    onClose();
  };
  
  const selectAll = () => {
    setToolStates(new Map(tools.map(tool => [tool.name, true])));
  };
  
  const selectNone = () => {
    setToolStates(new Map(tools.map(tool => [tool.name, false])));
  };
  
  return (
    <Dialog title={`Tools: ${serverName} (${tools.length} tools)`} onClose={onClose}>
      <Box flexDirection="column" padding={1}>
        {Object.entries(groupedTools).map(([category, categoryTools]) => (
          <Box key={category} flexDirection="column" marginY={1}>
            <Text bold>▼ {category} ({categoryTools.length})</Text>
            {categoryTools.map(tool => (
              <Box key={tool.name} marginLeft={2}>
                <Checkbox 
                  label={tool.name}
                  checked={toolStates.get(tool.name) || false}
                  onChange={() => handleToggleTool(tool.name)}
                />
                <Text dimColor>{tool.description}</Text>
              </Box>
            ))}
          </Box>
        ))}
        
        <Box marginTop={1}>
          <Button label="Select All" onPress={selectAll} />
          <Button label="Select None" onPress={selectNone} />
          <Button label="Save" onPress={handleSave} />
          <Button label="Close" onPress={onClose} />
        </Box>
      </Box>
    </Dialog>
  );
};
```

### 5. HealthMonitorDialog

**File:** `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`

```typescript
export const HealthMonitorDialog: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const { servers, getServerHealth, restartServer } = useMCP();
  const [autoRestart, setAutoRestart] = useState(true);
  const [maxRestarts, setMaxRestarts] = useState(3);
  
  const serverList = Array.from(servers.values());
  const healthyCount = serverList.filter(s => s.health === 'healthy').length;
  const overallStatus = healthyCount === serverList.length ? 'Healthy' : 'Degraded';
  
  return (
    <Dialog title="MCP Health Monitor" onClose={onClose}>
      <Box flexDirection="column" padding={1}>
        <Text>
          Overall Status: {overallStatus} ({healthyCount}/{serverList.length} servers running)
        </Text>
        
        <Box flexDirection="column" marginTop={1}>
          {serverList.map(server => {
            const health = getServerHealth(server.name);
            return (
              <Box key={server.name} flexDirection="column" marginY={1}>
                <Box>
                  <Text>{server.name}</Text>
                  <Text color={getHealthColor(server.health)}>
                    {getStatusIcon(server.health)} {server.health}
                  </Text>
                  {server.uptime > 0 && <Text>Uptime: {formatUptime(server.uptime)}</Text>}
                </Box>
                
                <Box marginLeft={2}>
                  <Text dimColor>Last check: {health.lastCheck}</Text>
                  <Text dimColor>Response time: {health.responseTime}ms</Text>
                </Box>
                
                {server.health === 'degraded' && (
                  <Box marginLeft={2}>
                    <Text color="yellow">Warning: {server.lastError}</Text>
                    <Button label="Restart" onPress={() => restartServer(server.name)} />
                    <Button label="View Logs" onPress={() => viewLogs(server.name)} />
                  </Box>
                )}
                
                {server.status === 'stopped' && (
                  <Box marginLeft={2}>
                    <Text dimColor>Disabled by user</Text>
                    <Button label="Enable" onPress={() => enableServer(server.name)} />
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
        
        <Box marginTop={1}>
          <Checkbox 
            label="Auto-restart"
            checked={autoRestart}
            onChange={setAutoRestart}
          />
          <Text>Max restarts: </Text>
          <TextInput 
            value={String(maxRestarts)}
            onChange={(value) => setMaxRestarts(Number(value))}
          />
          <Text> per hour</Text>
        </Box>
        
        <Box marginTop={1}>
          <Button label="Refresh" onPress={refreshHealth} />
          <Button label="Configure" onPress={openHealthConfig} />
          <Button label="Close" onPress={onClose} />
        </Box>
      </Box>
    </Dialog>
  );
};
```

## Service Layer

### MCPMarketplace Service

**File:** `packages/cli/src/services/mcpMarketplace.ts`

```typescript
export class MCPMarketplace {
  private cache: MCPMarketplaceServer[] = [];
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 3600000; // 1 hour
  
  async searchServers(query: string): Promise<MCPMarketplaceServer[]> {
    const servers = await this.getAllServers();
    
    if (!query) return servers;
    
    const lowerQuery = query.toLowerCase();
    return servers.filter(server => 
      server.name.toLowerCase().includes(lowerQuery) ||
      server.description.toLowerCase().includes(lowerQuery)
    );
  }
  
  async getAllServers(): Promise<MCPMarketplaceServer[]> {
    if (this.cache.length > 0 && Date.now() < this.cacheExpiry) {
      return this.cache;
    }
    
    try {
      // Fetch from marketplace API or use local registry
      const response = await fetch('https://mcp-marketplace.example.com/api/servers');
      const servers = await response.json();
      
      this.cache = servers;
      this.cacheExpiry = Date.now() + this.CACHE_TTL;
      
      return servers;
    } catch (error) {
      // Fallback to cached data or local registry
      return this.getLocalRegistry();
    }
  }
  
  async getServerDetails(serverId: string): Promise<MCPMarketplaceServer> {
    const servers = await this.getAllServers();
    const server = servers.find(s => s.id === serverId);
    
    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    return server;
  }
  
  async installServer(serverId: string, config: MCPServerConfig): Promise<void> {
    const server = await this.getServerDetails(serverId);
    
    // Add to MCP configuration
    const mcpConfig = await loadMCPConfig();
    mcpConfig.mcpServers[server.name] = config;
    await saveMCPConfig(mcpConfig);
    
    // Start the server
    const mcpClient = new MCPClient();
    await mcpClient.startServer(server.name);
  }
  
  async getPopularServers(): Promise<MCPMarketplaceServer[]> {
    const servers = await this.getAllServers();
    return servers
      .sort((a, b) => b.installCount - a.installCount)
      .slice(0, 10);
  }
  
  private getLocalRegistry(): MCPMarketplaceServer[] {
    // Fallback local registry of popular servers
    return [
      {
        id: 'filesystem',
        name: 'filesystem',
        description: 'Local file system operations',
        rating: 5,
        installCount: 10000,
        requiresOAuth: false,
        requirements: ['Node.js 18+'],
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem']
      },
      // ... more servers
    ];
  }
}
```

## Integration Points

### 1. MCPClient Updates

**File:** `packages/core/src/mcp/mcpClient.ts`

Add methods for UI integration:

```typescript
export class MCPClient {
  // Existing methods...
  
  getServerStatus(serverName: string): MCPServerStatus {
    const connection = this.connections.get(serverName);
    if (!connection) {
      return {
        name: serverName,
        status: 'stopped',
        health: 'unhealthy',
        uptime: 0,
        tools: [],
        resources: [],
        config: this.config.mcpServers[serverName]
      };
    }
    
    return {
      name: serverName,
      status: connection.status,
      health: this.healthMonitor.getHealth(serverName),
      uptime: Date.now() - connection.startTime,
      lastError: connection.lastError,
      tools: connection.tools,
      resources: connection.resources,
      config: this.config.mcpServers[serverName]
    };
  }
  
  getAllServerStatuses(): Map<string, MCPServerStatus> {
    const statuses = new Map<string, MCPServerStatus>();
    
    for (const serverName of Object.keys(this.config.mcpServers)) {
      statuses.set(serverName, this.getServerStatus(serverName));
    }
    
    return statuses;
  }
  
  async restartServer(serverName: string): Promise<void> {
    await this.stopServer(serverName);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
    await this.startServer(serverName);
  }
  
  getServerTools(serverName: string): MCPTool[] {
    const connection = this.connections.get(serverName);
    if (!connection) return [];
    
    return connection.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      autoApproved: this.config.mcpServers[serverName].autoApprove?.includes(tool.name) || false
    }));
  }
  
  async getServerLogs(serverName: string, lines: number = 100): Promise<string[]> {
    const logPath = path.join(getLogsDir(), `${serverName}.log`);
    
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines);
    } catch (error) {
      return [];
    }
  }
}
```

### 2. OAuthManager Updates

**File:** `packages/core/src/mcp/oauthManager.ts`

```typescript
export class OAuthManager {
  private tokens: Map<string, OAuthToken> = new Map();
  private readonly TOKEN_FILE = path.join(getMCPDir(), 'oauth-tokens.json');
  
  async configureOAuth(serverName: string, config: OAuthConfig): Promise<void> {
    // Update MCP config with OAuth settings
    const mcpConfig = await loadMCPConfig();
    mcpConfig.mcpServers[serverName].oauth = config;
    await saveMCPConfig(mcpConfig);
  }
  
  async authorize(serverName: string): Promise<string> {
    const mcpConfig = await loadMCPConfig();
    const oauthConfig = mcpConfig.mcpServers[serverName].oauth;
    
    if (!oauthConfig) {
      throw new Error(`OAuth not configured for ${serverName}`);
    }
    
    // Generate authorization URL
    const authUrl = this.buildAuthUrl(oauthConfig);
    
    // Start local server to receive callback
    await this.startCallbackServer(serverName);
    
    return authUrl;
  }
  
  async refreshToken(serverName: string): Promise<void> {
    const token = this.tokens.get(serverName);
    
    if (!token || !token.refreshToken) {
      throw new Error(`No refresh token available for ${serverName}`);
    }
    
    // Exchange refresh token for new access token
    const newToken = await this.exchangeRefreshToken(token.refreshToken);
    
    this.tokens.set(serverName, newToken);
    await this.saveTokens();
  }
  
  async revokeAccess(serverName: string): Promise<void> {
    const token = this.tokens.get(serverName);
    
    if (token) {
      // Revoke token with provider
      await this.revokeTokenWithProvider(token);
      
      // Remove from local storage
      this.tokens.delete(serverName);
      await this.saveTokens();
    }
  }
  
  getOAuthStatus(serverName: string): OAuthStatus {
    const token = this.tokens.get(serverName);
    
    if (!token) {
      return { connected: false };
    }
    
    const expiresAt = new Date(token.expiresAt);
    const isExpired = expiresAt < new Date();
    
    return {
      connected: !isExpired,
      expiresAt: token.expiresAt,
      scopes: token.scopes
    };
  }
  
  private async saveTokens(): Promise<void> {
    const data = Object.fromEntries(this.tokens);
    await fs.writeFile(this.TOKEN_FILE, JSON.stringify(data, null, 2));
  }
}
```

## Data Flow

### Server Enable/Disable Flow

```
User presses Left/Right Arrow
         │
         ▼
useMCPNavigation.handleKeyPress()
         │
         ▼
MCPContext.toggleServer()
         │
         ├─> Update mcp.json config
         │
         ├─> If disabled: mcpClient.stopServer()
         │   If enabled: mcpClient.startServer()
         │
         └─> Refresh server status
                  │
                  ▼
            UI updates automatically
```

### Server Configuration Flow

```
User presses 'C' key
         │
         ▼
Open ServerConfigDialog
         │
         ▼
User edits configuration
         │
         ▼
User clicks Save
         │
         ▼
MCPContext.configureServer()
         │
         ├─> Validate configuration
         │
         ├─> Save to mcp.json
         │
         └─> Restart server with new config
                  │
                  ▼
            Dialog closes, UI updates
```

### OAuth Authorization Flow

```
User presses 'O' key
         │
         ▼
Open OAuthConfigDialog
         │
         ▼
User clicks Authorize
         │
         ▼
OAuthManager.authorize()
         │
         ├─> Generate auth URL
         │
         ├─> Start callback server
         │
         └─> Open browser
                  │
                  ▼
            User authorizes in browser
                  │
                  ▼
            Callback received
                  │
                  ▼
            Exchange code for token
                  │
                  ▼
            Save token securely
                  │
                  ▼
            Dialog updates status
```

## Correctness Properties

### Property 1: Configuration Persistence
**Validates: Requirements 2.3, 5.6**

For all server configuration changes:
- Changes must be written to mcp.json immediately
- File must be valid JSON after write
- Configuration must be readable on next load
- No data loss on application restart

**Test Strategy:**
```typescript
fc.assert(
  fc.property(
    fc.record({
      command: fc.string(),
      args: fc.array(fc.string()),
      env: fc.dictionary(fc.string(), fc.string()),
      disabled: fc.boolean()
    }),
    async (config) => {
      await configureServer('test-server', config);
      const loaded = await loadMCPConfig();
      expect(loaded.mcpServers['test-server']).toEqual(config);
    }
  )
);
```

### Property 2: Server State Consistency
**Validates: Requirements 2.5, 9.3**

For all server state transitions:
- Server status must match configuration disabled flag
- Enabled servers must be running or connecting
- Disabled servers must be stopped
- No zombie processes after disable

**Test Strategy:**
```typescript
fc.assert(
  fc.property(
    fc.boolean(),
    async (shouldEnable) => {
      await toggleServer('test-server', shouldEnable);
      const status = getServerStatus('test-server');
      
      if (shouldEnable) {
        expect(['running', 'connecting']).toContain(status.status);
      } else {
        expect(status.status).toBe('stopped');
      }
    }
  )
);
```

### Property 3: OAuth Token Security
**Validates: Requirements NFR-16, NFR-17, NFR-18**

For all OAuth operations:
- Tokens must never appear in plain text in UI
- Tokens must be encrypted at rest
- Token file must have restricted permissions
- Revoked tokens must be deleted

**Test Strategy:**
```typescript
fc.assert(
  fc.property(
    fc.string(),
    async (token) => {
      await saveOAuthToken('test-server', token);
      
      // Token file must be encrypted
      const fileContent = await fs.readFile(TOKEN_FILE, 'utf-8');
      expect(fileContent).not.toContain(token);
      
      // UI must mask token
      const status = getOAuthStatus('test-server');
      expect(status.displayToken).toMatch(/\*+/);
    }
  )
);
```

## Testing Strategy

### Unit Tests
- MCPContext state management
- Navigation hook logic
- Dialog form validation
- Service layer methods

### Integration Tests
- Server enable/disable flow
- Configuration save and load
- OAuth authorization flow
- Health monitoring updates

### UI Tests
- Keyboard navigation
- Dialog interactions
- Visual feedback
- Error handling

### Property-Based Tests
- Configuration persistence (Property 1)
- Server state consistency (Property 2)
- OAuth token security (Property 3)

## Performance Considerations

1. **Windowed Rendering:** Only render visible servers in long lists
2. **Debounced Search:** Throttle marketplace search to 300ms
3. **Background Health Checks:** Run health monitoring in separate thread
4. **Lazy Loading:** Load marketplace data on demand
5. **Memoization:** Cache computed values (grouped tools, formatted dates)

## Security Considerations

1. **Input Validation:** Validate all user inputs before saving
2. **Command Injection:** Sanitize server commands and arguments
3. **Secret Masking:** Mask API keys and tokens in UI
4. **Token Encryption:** Encrypt OAuth tokens at rest
5. **File Permissions:** Restrict access to sensitive files

## Accessibility

1. **Keyboard Navigation:** All actions accessible via keyboard
2. **Screen Reader Support:** Proper ARIA labels
3. **Visual Feedback:** Clear indicators for all states
4. **Error Messages:** Descriptive and actionable
5. **Help Text:** Context-sensitive help available

## Future Enhancements

1. Server templates for quick setup
2. Batch operations (enable/disable multiple)
3. Server groups and categories
4. Performance metrics dashboard
5. Custom marketplace hosting
6. Server versioning and updates
7. Backup/restore configurations
8. AI-powered server recommendations
