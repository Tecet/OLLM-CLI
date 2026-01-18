# MCP Panel UI - Requirements

**Feature:** Interactive UI for managing MCP servers and marketplace  
**Priority:** High  
**Status:** Requirements Review  
**Created:** 2026-01-17

## Problem Statement

Users currently need to manually edit JSON files to configure MCP servers, manage OAuth settings, and monitor server health. This creates friction and makes the MCP system less accessible. Users need an interactive UI to:
- View all installed MCP servers and their status
- Enable/disable servers without editing JSON
- Browse and install servers from the marketplace
- Configure OAuth for servers requiring authentication
- Monitor server health and connection status
- View and manage tools provided by each server
- Restart or reconnect failed servers
- View server logs and diagnostics

## User Stories

### US-1: View Installed Servers
**As a** user  
**I want** to see all installed MCP servers with their current status  
**So that** I can understand which servers are available and their health

**Acceptance Criteria:**
- 1.1: All configured MCP servers are displayed in a list
- 1.2: Each server shows: name, description, enabled/disabled state, health status
- 1.3: Server details include: tool count, resource count, uptime
- 1.4: OAuth status displayed for servers requiring authentication
- 1.5: Visual health indicators: ● Healthy (green), ⚠ Degraded (yellow), ✗ Unhealthy (red), ○ Stopped (gray), ⟳ Connecting (blue)
- 1.6: Servers can be expanded/collapsed to show details

### US-2: Enable/Disable Servers
**As a** user  
**I want** to enable/disable MCP servers with keyboard shortcuts  
**So that** I can quickly toggle servers without editing configuration files

**Acceptance Criteria:**
- 2.1: Left/Right arrow keys toggle server enabled/disabled state
- 2.2: Visual toggle indicator shows current state (● enabled, ○ disabled)
- 2.3: Changes persist to mcp.json configuration file immediately
- 2.4: System message confirms state change
- 2.5: Server starts/stops automatically when toggled
- 2.6: No page reload required

### US-3: Browse Marketplace
**As a** user  
**I want** to browse available MCP servers in the marketplace  
**So that** I can discover and install new servers

**Acceptance Criteria:**
- 3.1: Press 'M' key to open marketplace browser
- 3.2: Marketplace shows list of available servers
- 3.3: Each server shows: name, description, rating, install count
- 3.4: OAuth requirement indicators displayed
- 3.5: Search functionality to filter servers by name/description
- 3.6: Popular servers highlighted
- 3.7: Can navigate marketplace with arrow keys

### US-4: Install Servers
**As a** user  
**I want** to install MCP servers from the marketplace  
**So that** I can add new functionality without manual configuration

**Acceptance Criteria:**
- 4.1: Press Enter on marketplace server to open install dialog
- 4.2: Install dialog shows: server name, description, requirements, rating
- 4.3: Dialog prompts for required configuration (API keys, environment variables)
- 4.4: Option to auto-approve all tools during installation
- 4.5: Server is added to mcp.json configuration
- 4.6: Server starts automatically after installation
- 4.7: New server appears in installed servers list immediately

### US-5: Configure Servers
**As a** user  
**I want** to configure MCP server settings  
**So that** I can customize server behavior and credentials

**Acceptance Criteria:**
- 5.1: Press 'C' key on selected server to open configuration dialog
- 5.2: Dialog shows: command, arguments, environment variables
- 5.3: Can add/edit/remove environment variables
- 5.4: Can configure auto-approve tool list
- 5.5: Form validation prevents invalid configurations
- 5.6: Changes save to mcp.json immediately
- 5.7: Server restarts automatically after configuration change
- 5.8: Test connection button to verify configuration

### US-6: Configure OAuth
**As a** user  
**I want** to configure OAuth for servers requiring authentication  
**So that** I can securely connect to external services

**Acceptance Criteria:**
- 6.1: Press 'O' key to open OAuth manager
- 6.2: OAuth dialog shows: provider, client ID, scopes, connection status
- 6.3: Can configure OAuth settings for selected server
- 6.4: Authorize button initiates OAuth flow
- 6.5: Token expiration date displayed
- 6.6: Refresh token button to renew expired tokens
- 6.7: Revoke access button to disconnect
- 6.8: OAuth tokens stored securely in oauth-tokens.json
- 6.9: Visual indicator shows OAuth connection status

### US-7: Monitor Server Health
**As a** user  
**I want** to monitor MCP server health in real-time  
**So that** I can identify and resolve issues quickly

**Acceptance Criteria:**
- 7.1: Press 'H' key to open health monitor
- 7.2: Health monitor shows overall status summary
- 7.3: Each server displays: health status, uptime, last check time, response time
- 7.4: Error messages displayed for unhealthy servers
- 7.5: Warning messages for degraded servers (slow response, rate limits)
- 7.6: Auto-restart configuration options
- 7.7: Refresh button to manually check health
- 7.8: Health status updates automatically in background

### US-8: View Server Tools
**As a** user  
**I want** to view tools provided by each MCP server  
**So that** I can understand server capabilities and configure auto-approval

**Acceptance Criteria:**
- 8.1: Press 'V' key on selected server to view tools
- 8.2: Tools viewer shows all tools grouped by category
- 8.3: Each tool displays: name, description, auto-approve status
- 8.4: Can toggle auto-approve for individual tools
- 8.5: Select All / Select None buttons for batch operations
- 8.6: Changes save to mcp.json immediately
- 8.7: Tool count displayed in server details

### US-9: Restart Servers
**As a** user  
**I want** to restart failed or degraded servers  
**So that** I can recover from errors without manual intervention

**Acceptance Criteria:**
- 9.1: Press 'R' key on selected server to restart
- 9.2: Confirmation dialog for restart action
- 9.3: Server stops and starts cleanly
- 9.4: Status updates to "Connecting" during restart
- 9.5: Success/failure message after restart attempt
- 9.6: Restart button available in health monitor
- 9.7: Auto-restart option for unhealthy servers

### US-10: View Server Logs
**As a** user  
**I want** to view server logs and diagnostics  
**So that** I can troubleshoot issues and understand server behavior

**Acceptance Criteria:**
- 10.1: Press 'L' key on selected server to view logs
- 10.2: Logs viewer shows recent log entries
- 10.3: Can scroll through log history
- 10.4: Log level filtering (debug, info, warn, error)
- 10.5: Timestamps displayed for each log entry
- 10.6: Copy logs to clipboard option
- 10.7: Clear logs option
- 10.8: Logs stored in ~/.ollm/mcp/logs/

### US-11: Uninstall Servers
**As a** user  
**I want** to uninstall MCP servers I no longer need  
**So that** I can keep my server list clean

**Acceptance Criteria:**
- 11.1: Press 'U' key on selected server to uninstall
- 11.2: Confirmation dialog warns action is permanent
- 11.3: Server is stopped before removal
- 11.4: Server configuration removed from mcp.json
- 11.5: OAuth tokens removed if applicable
- 11.6: Server logs archived or deleted
- 11.7: Server disappears from list immediately

### US-12: Keyboard Navigation
**As a** user  
**I want** to navigate the MCP panel with keyboard shortcuts  
**So that** I can manage servers efficiently

**Acceptance Criteria:**
- 12.1: Up/Down arrows navigate between servers
- 12.2: Left/Right arrows toggle enabled/disabled
- 12.3: Enter expands/collapses server details
- 12.4: Tab returns to main navigation bar
- 12.5: M opens marketplace
- 12.6: H opens health monitor
- 12.7: O opens OAuth manager
- 12.8: V views server tools
- 12.9: C configures server
- 12.10: R restarts server
- 12.11: L views logs
- 12.12: I installs server (in marketplace)
- 12.13: U uninstalls server
- 12.14: Esc closes dialogs/modals
- 12.15: / focuses search box (in marketplace)

## Non-Functional Requirements

### Performance
- NFR-1: Server list renders within 100ms
- NFR-2: Health status updates every 5 seconds in background
- NFR-3: Marketplace search results appear within 200ms
- NFR-4: Server enable/disable completes within 500ms
- NFR-5: UI remains responsive during server operations

### Usability
- NFR-6: All actions accessible via keyboard shortcuts
- NFR-7: Visual feedback for all user actions
- NFR-8: Error messages are clear and actionable
- NFR-9: Help text available for all dialogs
- NFR-10: Consistent with existing UI patterns (Tools Panel, Hooks Panel)

### Reliability
- NFR-11: Configuration changes persist immediately
- NFR-12: No data loss on application crash
- NFR-13: OAuth tokens stored securely and encrypted
- NFR-14: Server failures don't crash the UI
- NFR-15: Auto-restart prevents service disruption

### Security
- NFR-16: Environment variables with secrets masked in UI
- NFR-17: OAuth tokens never displayed in plain text
- NFR-18: Secure token storage with encryption
- NFR-19: API keys validated before saving
- NFR-20: Server commands validated to prevent injection

### Compatibility
- NFR-21: Works with existing MCP configuration format
- NFR-22: Supports both user and workspace level configs
- NFR-23: Compatible with all MCP server types
- NFR-24: Marketplace supports offline mode (cached data)
- NFR-25: Cross-platform (Windows, macOS, Linux)

## Data Storage

### MCP Configuration
**Location:** `~/.ollm/settings/mcp.json` (user) or `.ollm/settings/mcp.json` (workspace)

```json
{
  "mcpServers": {
    "server-name": {
      "command": "string",
      "args": ["string"],
      "env": { "KEY": "value" },
      "disabled": false,
      "autoApprove": ["tool-name"],
      "oauth": {
        "provider": "string",
        "clientId": "string",
        "scopes": ["string"]
      }
    }
  }
}
```

### OAuth Tokens
**Location:** `~/.ollm/mcp/oauth-tokens.json`

```json
{
  "server-name": {
    "accessToken": "encrypted-token",
    "refreshToken": "encrypted-token",
    "expiresAt": "ISO-8601-timestamp",
    "scopes": ["string"]
  }
}
```

### Server Logs
**Location:** `~/.ollm/mcp/logs/{server-name}.log`

## Dependencies

### Internal Dependencies
- **stage-05-hooks-extensions-mcp:** MCP client and server management
- **stage-08b-tool-support-detection:** Tool registry and detection
- **stage-06-cli-ui:** Base UI components and navigation

### External Dependencies
- **MCPClient:** Server connection and communication
- **MCPHealthMonitor:** Health status monitoring
- **OAuthManager:** OAuth flow and token management
- **SettingsService:** Configuration persistence
- **HookRegistry:** Hook system integration

## Out of Scope

The following features are explicitly out of scope for this phase:
- Server templates and pre-configured setups
- Batch operations (enable/disable multiple servers)
- Server groups and categories
- Detailed performance metrics and analytics
- Custom marketplace hosting
- Server versioning and updates
- Backup/restore configurations
- AI-powered server recommendations

## Success Metrics

- ✅ All MCP servers displayed with accurate status
- ✅ Enable/disable servers without editing JSON
- ✅ Browse and install servers from marketplace
- ✅ Configure OAuth for authenticated servers
- ✅ Monitor server health in real-time
- ✅ View and manage server tools
- ✅ Restart failed servers successfully
- ✅ View server logs for troubleshooting
- ✅ All settings persist across sessions
- ✅ Zero configuration file corruption incidents

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| OAuth flow complexity | High | Medium | Use proven OAuth libraries, extensive testing |
| Server restart failures | High | Medium | Implement retry logic, clear error messages |
| Configuration corruption | High | Low | Validate before saving, backup on change |
| Marketplace unavailable | Medium | Medium | Cache marketplace data, offline mode |
| Health monitoring overhead | Medium | Low | Throttle checks, background processing |
| UI performance with many servers | Medium | Low | Windowed rendering, lazy loading |

## Related Documents

- MCP Panel Interactive Plan (.dev/docs/Ui/mcp-panel-interactive-plan.md)
- Tools Panel Spec (.kiro/specs/stage-08b-tool-support-detection/)
- Hooks Panel Spec (.kiro/specs/stage-08c-hooks-panel-ui/)
- [MCP Documentation](../../docs/MCP/)
- Stage-05 MCP Implementation (.kiro/specs/stage-05-hooks-extensions-mcp/)
