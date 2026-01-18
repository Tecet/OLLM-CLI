# MCP Panel UI - Implementation Tasks

**Feature:** Interactive UI for managing MCP servers and marketplace  
**Status:** In Progress  
**Created:** 2026-01-17  
**Last Updated:** 2026-01-18

## Task List

### Phase 1: Data Layer & Core Services (4-5 hours)

- [ ] 1.1 Extend MCPClient with UI-required methods
  - File: `packages/core/src/mcp/mcpClient.ts`
  - Add getAllServerStatuses() method returning Map<string, MCPServerStatus>
  - Add restartServer(serverName) method (stop + wait + start)
  - Add getServerLogs(serverName, lines?) method reading from logs directory
  - Update getServerStatus() to include uptime calculation
  - **Validates: Requirements 1.1, 1.2, 1.3, 7.3, 10.1**

- [ ] 1.2 Extend MCPHealthMonitor with subscription support
  - File: `packages/core/src/mcp/mcpHealthMonitor.ts`
  - Add subscribeToHealthUpdates(callback) method returning unsubscribe function
  - Emit health updates to subscribers on status changes
  - Add getServerHealth(serverName) returning detailed health info
  - Add getAllServerHealth() returning health for all servers
  - **Validates: Requirements 7.1, 7.3, 7.4, 7.8**

- [ ] 1.3 Extend MCPOAuthProvider with UI methods
  - File: `packages/core/src/mcp/mcpOAuth.ts`
  - Add getOAuthStatus(serverName) returning connection status and expiry
  - Ensure authorize() returns auth URL for browser opening
  - Ensure refreshToken() handles token renewal
  - Ensure revokeAccess() cleans up tokens
  - **Validates: Requirements 6.1, 6.4, 6.5, 6.6, 6.7, 6.8**

- [ ] 1.4 Create MCP configuration service
  - Create `packages/cli/src/services/mcpConfigService.ts`
  - Implement loadMCPConfig() reading from user/workspace mcp.json
  - Implement saveMCPConfig(config) with validation and atomic writes
  - Implement updateServerConfig(serverName, config) for partial updates
  - Add config file watching for external changes
  - **Validates: Requirements 2.3, 5.6, NFR-11, NFR-12**

- [ ] 1.5 Create marketplace service
  - Create `packages/cli/src/services/mcpMarketplace.ts`
  - Implement MCPMarketplace class with caching (1 hour TTL)
  - Add searchServers(query) with local filtering
  - Add getAllServers() with fallback to local registry
  - Add getServerDetails(serverId) for detailed info
  - Add installServer(serverId, config) integrating with config service
  - Add getPopularServers() sorted by install count
  - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 4.2, 4.6**

- [ ] 1.6 Create MCPContext for state management
  - Create `packages/cli/src/ui/contexts/MCPContext.tsx`
  - Define MCPContextValue interface with all required methods
  - Implement MCPProvider with useState for servers, config, marketplace
  - Initialize MCPClient, MCPHealthMonitor, MCPOAuthProvider, MCPMarketplace
  - Subscribe to health updates in useEffect
  - Implement all context methods (toggle, restart, configure, etc.)
  - **Validates: Requirements 1.1-1.6, 2.1-2.7, 5.1-5.8**

- [ ] 1.7 Checkpoint - Run focused tests after data layer
  - Create unit tests for MCPClient new methods
  - Create unit tests for health monitor subscription
  - Create unit tests for OAuth status methods
  - Create unit tests for config service
  - Create unit tests for marketplace service
  - Create unit tests for MCPContext
  - Fix any failures before proceeding to Phase 2

### Phase 2: Core UI Components (5-6 hours)

- [ ] 2.1 Create MCP components directory structure
  - Create `packages/cli/src/ui/components/mcp/` directory
  - Create index.ts for exports
  - **Validates: Project structure requirements**

- [ ] 2.2 Create HealthIndicator component
  - Create `packages/cli/src/ui/components/mcp/HealthIndicator.tsx`
  - Add status icon mapping (● healthy, ⚠ degraded, ✗ unhealthy, ○ stopped, ⟳ connecting)
  - Add color coding: green (healthy), yellow (degraded), red (unhealthy), gray (stopped), blue (connecting)
  - Add uptime formatting utility (formatUptime helper)
  - **Validates: Requirements 1.5, 7.3**

- [ ] 2.3 Create ServerItem component
  - Create `packages/cli/src/ui/components/mcp/ServerItem.tsx`
  - Display server name, description, enabled/disabled state
  - Integrate HealthIndicator for status display
  - Add expand/collapse functionality (▼ expanded, > collapsed)
  - Implement ServerStats sub-component (tools count, resources count, uptime, OAuth status)
  - Implement ServerActions sub-component (keyboard shortcuts display)
  - Add focus highlighting (cyan color when focused)
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

- [ ] 2.4 Create MarketplacePreview component
  - Create `packages/cli/src/ui/components/mcp/MarketplacePreview.tsx`
  - Display top 3 popular servers from marketplace
  - Show server name, description, rating (★), install count
  - Add OAuth requirement indicators
  - Add "Press M for full marketplace" hint
  - **Validates: Requirements 3.1, 3.2, 3.3, 3.6**

- [ ] 2.5 Create InstalledServersSection component
  - Create `packages/cli/src/ui/components/mcp/InstalledServersSection.tsx`
  - Render list of ServerItem components
  - Handle empty state (no servers configured)
  - Pass focus state to individual ServerItem components
  - Add section header with server count
  - **Validates: Requirements 1.1, 12.1, 12.2**

- [ ] 2.6 Create MCPActions component
  - Create `packages/cli/src/ui/components/mcp/MCPActions.tsx`
  - Display available keyboard shortcuts in footer
  - Show context-sensitive actions based on focused item
  - Use theme colors for styling
  - **Validates: Requirements 12.1-12.15, NFR-6**

- [ ] 2.7 Create MCPTab main component
  - Create `packages/cli/src/ui/components/tabs/MCPTab.tsx`
  - Implement main container with MCPContext integration
  - Add loading spinner for initial load
  - Add error message display
  - Compose InstalledServersSection, MarketplacePreview, MCPActions
  - Add keyboard input handling (delegate to navigation hook)
  - Add dialog state management (useState for active dialog)
  - **Validates: Requirements 1.1-1.6, 12.1-12.15**

- [ ] 2.8 Checkpoint - Run focused tests after UI components
  - Create UI tests for HealthIndicator
  - Create UI tests for ServerItem (expand/collapse, focus)
  - Create UI tests for MarketplacePreview
  - Create UI tests for InstalledServersSection
  - Create UI tests for MCPTab (loading, error, rendering)
  - Fix any failures before proceeding to Phase 3

### Phase 3: Navigation & Focus Management (2-3 hours)

- [ ] 3.1 Create useMCPNavigation hook
  - Create `packages/cli/src/ui/hooks/useMCPNavigation.ts`
  - Implement focusedIndex state (current server index)
  - Implement focusedSection state ('installed' | 'marketplace')
  - Implement expandedServers state (Set<string>)
  - Add handleKeyPress function with action callbacks
  - Add Up/Down arrow navigation (change focusedIndex)
  - Add Left/Right toggle functionality (callback to toggle server)
  - Add Enter for expand/collapse (toggleServer method)
  - Add action key handlers (M, H, O, V, C, R, L, I, U)
  - Add Tab handler for returning to main nav
  - **Validates: Requirements 12.1-12.15**

- [ ] 3.2 Integrate navigation hook with MCPTab
  - Update `packages/cli/src/ui/components/tabs/MCPTab.tsx`
  - Use useMCPNavigation hook
  - Connect handleKeyPress to useInput
  - Pass focusedIndex to InstalledServersSection
  - Pass expandedServers to ServerItem components
  - Implement action callbacks (onToggle, onConfigure, etc.)
  - **Validates: Requirements 12.1-12.15**

- [ ] 3.3 Add focus visual indicators
  - Update ServerItem to show focus state (cyan color)
  - Ensure focused item is always visible (scroll into view)
  - Add focus border to active section
  - **Validates: Requirements NFR-7**

- [ ] 3.4 Integrate MCP tab with TabBar
  - Update `packages/cli/src/ui/components/layout/TabBar.tsx`
  - Add MCP tab to tabs array: { id: 'mcp', label: 'MCP', icon: '🔌', shortcut: 'Ctrl+8' }
  - Update TabType in UIContext to include 'mcp'
  - **Validates: Requirements 12.1**

- [ ] 3.5 Wire MCPTab into main App
  - Update `packages/cli/src/ui/App.tsx` or main layout component
  - Add MCPProvider wrapper around app
  - Add MCPTab to tab routing/switching logic
  - Ensure tab switching works with Ctrl+8
  - **Validates: Requirements 12.1**

- [ ] 3.6 Checkpoint - Run focused tests after navigation
  - Create unit tests for useMCPNavigation hook
  - Test arrow key navigation (up/down/left/right)
  - Test action key handlers (M, H, O, V, C, R, L, I, U)
  - Test expand/collapse functionality
  - Test focus management and visual indicators
  - Test tab integration and switching
  - Fix any failures before proceeding to Phase 4

### Phase 4: Dialog Components (6-7 hours)

- [ ] 4.1 Create shared form components
  - Create `packages/cli/src/ui/components/forms/` directory
  - Create FormField.tsx (label + input wrapper)
  - Create TextInput.tsx (text input with validation)
  - Create Checkbox.tsx (checkbox with label)
  - Create Button.tsx (button with press handler)
  - Add validation error display
  - Ensure consistent styling with theme
  - **Validates: Requirements NFR-7, NFR-9**

- [ ] 4.2 Create base Dialog component
  - Create `packages/cli/src/ui/components/dialogs/Dialog.tsx` (if not exists)
  - Add title, onClose props
  - Add Esc key handler for closing
  - Add border and padding
  - Ensure consistent styling
  - **Validates: Requirements 12.14, NFR-7**

- [ ] 4.3 Create ServerConfigDialog
  - Create `packages/cli/src/ui/components/dialogs/ServerConfigDialog.tsx`
  - Add command input field (TextInput)
  - Add arguments input field (space-separated string)
  - Add environment variables editor (key-value pairs with add/remove)
  - Add auto-approve tools selector (list of tool names)
  - Add form validation (command required, valid args)
  - Add test connection button
  - Mask secret environment variables (API_KEY, TOKEN, SECRET, PASSWORD)
  - Add Save and Cancel buttons
  - **Validates: Requirements 5.1-5.8, NFR-16**

- [ ] 4.4 Create OAuthConfigDialog
  - Create `packages/cli/src/ui/components/dialogs/OAuthConfigDialog.tsx`
  - Display OAuth provider name (read-only)
  - Add client ID input field
  - Add scopes selector with checkboxes
  - Display OAuth connection status (connected/not connected)
  - Display token expiration date if connected
  - Add Authorize button (opens browser with auth URL)
  - Add Refresh Token button (renews expired token)
  - Add Revoke Access button (disconnects and removes token)
  - Add Save and Close buttons
  - **Validates: Requirements 6.1-6.9, NFR-17**

- [ ] 4.5 Create InstallServerDialog
  - Create `packages/cli/src/ui/components/dialogs/InstallServerDialog.tsx`
  - Display server name, description, rating (★), install count
  - Display requirements list
  - Add dynamic configuration form (based on server requirements)
  - Add environment variables inputs (API keys, etc.)
  - Add auto-approve all tools checkbox
  - Add Install and Cancel buttons
  - Validate required fields before installation
  - **Validates: Requirements 4.1-4.7**

- [ ] 4.6 Create ServerToolsViewer
  - Create `packages/cli/src/ui/components/dialogs/ServerToolsViewer.tsx`
  - Display tools list grouped by category (if available)
  - Show tool name and description
  - Add checkbox for auto-approve per tool
  - Add Select All / Select None buttons
  - Add Save and Close buttons
  - Update mcp.json autoApprove array on save
  - **Validates: Requirements 8.1-8.7**

- [ ] 4.7 Create HealthMonitorDialog
  - Create `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`
  - Display overall status summary (X/Y servers healthy)
  - List all servers with health status, uptime, last check time
  - Show error/warning messages for unhealthy/degraded servers
  - Add Restart button per server
  - Add View Logs button per server
  - Add Enable button for stopped servers
  - Add auto-restart configuration (checkbox + max restarts input)
  - Add Refresh and Close buttons
  - **Validates: Requirements 7.1-7.8, 9.1-9.7**

- [ ] 4.8 Create ServerLogsViewer
  - Create `packages/cli/src/ui/components/dialogs/ServerLogsViewer.tsx`
  - Display recent log entries (last 100 lines)
  - Add timestamps for each log entry
  - Add log level filtering (debug, info, warn, error)
  - Add scrolling support for log history
  - Add Copy to Clipboard button
  - Add Clear Logs button
  - Add Close button
  - **Validates: Requirements 10.1-10.8**

- [ ] 4.9 Create MarketplaceDialog
  - Create `packages/cli/src/ui/components/dialogs/MarketplaceDialog.tsx`
  - Display full list of marketplace servers
  - Add search input field (filter by name/description)
  - Show server name, description, rating, install count
  - Add OAuth requirement indicators
  - Add Install button per server (opens InstallServerDialog)
  - Add navigation with arrow keys
  - Add / key to focus search box
  - Add Close button
  - **Validates: Requirements 3.1-3.7, 12.15**

- [ ] 4.10 Create UninstallConfirmDialog
  - Create `packages/cli/src/ui/components/dialogs/UninstallConfirmDialog.tsx`
  - Display server name and warning message
  - Warn that action is permanent
  - List what will be removed (config, OAuth tokens, logs)
  - Add Confirm and Cancel buttons
  - **Validates: Requirements 11.1-11.7**

- [ ] 4.11 Integrate dialogs with MCPTab
  - Update MCPTab to render active dialog based on dialogState
  - Implement dialog action handlers (onConfigure, onOAuth, onViewTools, etc.)
  - Connect dialog callbacks to MCPContext methods
  - Handle dialog close and state cleanup
  - **Validates: All dialog-related requirements**

- [ ] 4.12 Checkpoint - Run focused tests after dialogs
  - Create UI tests for each dialog component
  - Test form validation in ServerConfigDialog
  - Test OAuth flow in OAuthConfigDialog
  - Test installation flow in InstallServerDialog
  - Test tool selection in ServerToolsViewer
  - Test health monitoring in HealthMonitorDialog
  - Test log viewing in ServerLogsViewer
  - Test marketplace browsing in MarketplaceDialog
  - Test uninstall confirmation in UninstallConfirmDialog
  - Fix any failures before proceeding to Phase 5

### Phase 5: Integration & Property-Based Testing (4-5 hours)

- [ ] 5.1 Integration test: Server enable/disable flow
  - Create `packages/cli/src/ui/components/tabs/__tests__/MCPTab.integration.test.tsx`
  - Test full flow: navigate to server, press left/right arrow, verify config updated
  - Verify server starts/stops correctly
  - Verify UI updates immediately
  - **Validates: Requirements 2.1-2.7**

- [ ] 5.2 Integration test: Server configuration flow
  - Test full flow: press C, edit config, save, verify server restarts
  - Verify config persists to mcp.json
  - Verify validation prevents invalid configs
  - **Validates: Requirements 5.1-5.8**

- [ ] 5.3 Integration test: OAuth authorization flow
  - Test full flow: press O, configure OAuth, authorize, verify token saved
  - Mock OAuth provider responses
  - Verify token encryption
  - Verify status updates in UI
  - **Validates: Requirements 6.1-6.9**

- [ ] 5.4 Integration test: Server installation flow
  - Test full flow: press M, search, select server, configure, install
  - Verify server added to mcp.json
  - Verify server starts automatically
  - Verify server appears in list
  - **Validates: Requirements 3.1-3.7, 4.1-4.7**

- [ ] 5.5 Integration test: Health monitoring updates
  - Test health status updates in background
  - Test auto-restart on failure
  - Test manual restart
  - Verify UI updates reflect health changes
  - **Validates: Requirements 7.1-7.8, 9.1-9.7**

- [ ] 5.6 Property-based test: Configuration persistence
  - Create `packages/cli/src/ui/components/tabs/__tests__/MCPTab.property.test.tsx`
  - **Property 1: Configuration Persistence**
  - Generate random server configs with fast-check
  - Save config and verify it can be loaded
  - Verify no data loss on save/load cycle
  - Verify JSON validity after write
  - **Validates: Requirements 2.3, 5.6, NFR-11, NFR-12**

- [ ] 5.7 Property-based test: Server state consistency
  - **Property 2: Server State Consistency**
  - Generate random enable/disable sequences
  - Verify server status matches config disabled flag
  - Verify enabled servers are running or connecting
  - Verify disabled servers are stopped
  - Verify no zombie processes
  - **Validates: Requirements 2.5, 9.3**

- [ ] 5.8 Property-based test: OAuth token security
  - **Property 3: OAuth Token Security**
  - Generate random tokens
  - Verify tokens never appear in plain text in UI
  - Verify tokens are encrypted at rest
  - Verify token file has restricted permissions
  - Verify revoked tokens are deleted
  - **Validates: Requirements NFR-16, NFR-17, NFR-18, 6.8**

- [ ] 5.9 Checkpoint - Run full test suite
  - Run all unit tests (data layer, UI components, hooks)
  - Run all integration tests (flows)
  - Run all property-based tests (correctness properties)
  - Verify test coverage meets 80% threshold
  - Fix any failures before proceeding to Phase 6

### Phase 6: Polish, Error Handling & Documentation (3-4 hours)

- [ ] 6.1 Add loading states and spinners
  - Add loading spinner for initial server list load
  - Add loading spinner for marketplace data fetch
  - Add skeleton screens for server items during load
  - Add progress indicators for long operations (install, restart)
  - **Validates: NFR-7**

- [ ] 6.2 Improve error handling
  - Add error boundaries around MCPTab and dialogs
  - Add user-friendly error messages for common failures
  - Add retry logic for failed operations (with exponential backoff)
  - Handle configuration corruption gracefully (backup + restore)
  - Add error recovery suggestions in messages
  - **Validates: NFR-8, NFR-12, NFR-14**

- [ ] 6.3 Add visual polish and feedback
  - Add animations for state changes (fade in/out)
  - Add success notifications (green checkmark + message)
  - Add error notifications (red X + message)
  - Add confirmation dialogs for destructive actions (uninstall, revoke)
  - Improve color scheme consistency with theme
  - Add hover effects (if terminal supports)
  - **Validates: NFR-7**

- [ ] 6.4 Add help and contextual documentation
  - Add help text in dialogs (field descriptions)
  - Add keyboard shortcut hints in footer (MCPActions)
  - Add tooltips for complex fields (if terminal supports)
  - Add "?" key handler to show help overlay
  - **Validates: NFR-9**

- [ ] 6.5 Performance optimization
  - Implement windowed rendering for server list (>20 servers)
  - Add memoization for expensive computations (grouped tools, formatted dates)
  - Debounce marketplace search (300ms)
  - Optimize health check frequency (configurable interval)
  - Add performance monitoring and logging
  - **Validates: NFR-1, NFR-3, NFR-4, NFR-5**

- [ ] 6.6 Security hardening
  - Validate server commands to prevent injection attacks
  - Sanitize environment variable values
  - Ensure file permissions on sensitive files (600 for tokens)
  - Add rate limiting for OAuth requests
  - Validate API keys before saving
  - **Validates: NFR-16, NFR-17, NFR-18, NFR-19, NFR-20**

- [ ] 6.7 Update documentation
  - Update `docs/MCP/` with MCP Panel UI guide
  - Create user guide: `docs/MCP/mcp-panel-user-guide.md`
  - Create developer guide: `docs/MCP/mcp-panel-developer-guide.md`
  - Update README.md with MCP panel features
  - Add screenshots/examples (ASCII art or terminal recordings)
  - Document keyboard shortcuts
  - Document configuration file format
  - **Validates: Documentation requirements**

- [ ] 6.8 Final validation checkpoint
  - Run complete test suite (unit + integration + property-based)
  - Verify all success criteria met (see below)
  - Test with 20+ servers for performance
  - Test all error scenarios (network failures, invalid configs, etc.)
  - Test on all platforms (Windows, macOS, Linux)
  - Verify no memory leaks or performance degradation
  - Mark feature as complete

## Estimated Effort

**Total: 24-30 hours**

- Phase 1 (Data Layer): 4-5 hours
- Phase 2 (UI Components): 5-6 hours
- Phase 3 (Navigation): 2-3 hours
- Phase 4 (Dialogs): 6-7 hours
- Phase 5 (Integration & Testing): 4-5 hours
- Phase 6 (Polish & Documentation): 3-4 hours

## Dependencies

- Stage-05 (MCP System) must be complete ✅ (MCPClient, MCPHealthMonitor, MCPOAuthProvider exist)
- Stage-06 (CLI UI) provides base components ✅ (TabBar, dialogs, layout components exist)
- Tools Panel provides navigation patterns (reference for consistency)

## Success Criteria

- [ ] All MCP servers displayed with accurate status
- [ ] Enable/disable servers with keyboard (left/right arrows)
- [ ] Browse and install servers from marketplace
- [ ] Configure OAuth for authenticated servers
- [ ] Monitor server health in real-time
- [ ] View and manage server tools with auto-approve
- [ ] Restart failed servers successfully
- [ ] View server logs for troubleshooting
- [ ] All settings persist across sessions
- [ ] No configuration file corruption
- [ ] All tests passing (unit, integration, property-based)
- [ ] Documentation complete with examples
- [ ] No performance issues with 20+ servers
- [ ] Visual feedback for all user actions

## Notes

- Reuse navigation patterns from Tools Panel (stage-06b) for consistency
- MCP configuration supports both user (~/.ollm/settings/mcp.json) and workspace (.ollm/settings/mcp.json) levels
- OAuth tokens stored securely with encryption in ~/.ollm/mcp/oauth-tokens.json
- Server logs stored in ~/.ollm/mcp/logs/{server-name}.log
- Marketplace supports offline mode with cached data and local registry fallback
- Health monitoring runs in background without blocking UI
- Environment variables with secrets (API keys, tokens) must be masked in UI
- Server commands validated to prevent injection attacks
- Follow existing UI patterns from ToolsTab, SettingsTab, etc.
