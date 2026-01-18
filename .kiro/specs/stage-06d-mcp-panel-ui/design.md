# MCP Panel UI - Design

**Feature:** Interactive UI for managing MCP servers and marketplace  
**Status:** Design Review  
**Created:** 2026-01-17

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

Main container for the MCP panel UI.

```typescript
export const MCPTab: React.FC = () => {
  const { servers, marketplace, loading, error } = useMCP();
  const { 
    focusedIndex,
    focusedSection,
    expandedServers,
    handleKeyPress,
    toggleServer: toggleExpanded
  } = useMCPNavigation();
  
  const [dialogState, setDialogState] = useState<DialogState | null>(null);
  
  useInput((input, key) => {
    if (dialogState) return; // Dialog handles its own input
    
    handleKeyPress(input, key, {
      onToggle: handleToggleServer,
      onConfigure: () => setDialogState({ type: 'configure', serverName: getFocusedServer() }),
      onOAuth: () => setDialogState({ type: 'oauth', serverName: getFocusedServer() }),
      onViewTools: () => setDialogState({ type: 'tools', serverName: getFocusedServer() }),
      onRestart: handleRestartServer,
      onLogs: () => setDialogState({ type: 'logs', serverName: getFocusedServer() }),
      onMarketplace: () => setDialogState({ type: 'marketplace' }),
      onHealth: () => setDialogState({ type: 'health' }),
      onInstall: handleInstallServer,
      onUninstall: handleUninstallServer
    });
  });
  
  if (loading) return <LoadingSpinner message="Loading MCP servers..." />;
  if (error) return <ErrorMessage message={error} />;
  
  return (
    <Box flexDirection="column" height="100%">
      <InstalledServersSection 
        servers={Array.from(servers.values())}
        focusedIndex={focusedSection === 'installed' ? focusedIndex : -1}
        expandedServers={expandedServers}
        onToggleExpand={toggleExpanded}
      />
      
      <MarketplacePreview 
        servers={marketplace.slice(0, 3)}
        focused={focusedSection === 'marketplace'}
      />
      
      <MCPActions />
      
      {dialogState && renderDialog(dialogState, setDialogState)}
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

Manages keyboard navigation and focus state.

```typescript
export const useMCPNavigation = () => {
  const { servers } = useMCP();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [focusedSection, setFocusedSection] = useState<'installed' | 'marketplace'>('installed');
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  
  const serverList = Array.from(servers.values());
  
  const handleKeyPress = (input: string, key: Key, actions: NavigationActions) => {
    // Up/Down navigation
    if (key.upArrow) {
      setFocusedIndex(Math.max(0, focusedIndex - 1));
    } else if (key.downArrow) {
      setFocusedIndex(Math.min(serverList.length - 1, focusedIndex + 1));
    }
    
    // Left/Right toggle
    else if (key.leftArrow || key.rightArrow) {
      actions.onToggle(serverList[focusedIndex].name);
    }
    
    // Enter to expand/collapse
    else if (key.return) {
      toggleServer(serverList[focusedIndex].name);
    }
    
    // Action keys
    else if (input === 'v') actions.onViewTools();
    else if (input === 'c') actions.onConfigure();
    else if (input === 'o') actions.onOAuth();
    else if (input === 'r') actions.onRestart();
    else if (input === 'l') actions.onLogs();
    else if (input === 'm') actions.onMarketplace();
    else if (input === 'h') actions.onHealth();
    else if (input === 'i') actions.onInstall();
    else if (input === 'u') actions.onUninstall();
  };
  
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
  
  return {
    focusedIndex,
    focusedSection,
    expandedServers,
    handleKeyPress,
    toggleServer
  };
};
```

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
