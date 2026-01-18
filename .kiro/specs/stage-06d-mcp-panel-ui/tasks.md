# MCP Panel UI - Implementation Tasks

**Feature:** Interactive UI for managing MCP servers and marketplace  
**Status:** Not Started  
**Created:** 2026-01-17

## Task List

### Phase 1: Data Layer (4-5 hours)

- [ ] 1.1 Create MCPContext with state management
  - Create `packages/cli/src/ui/contexts/MCPContext.tsx`
  - Define MCPContext interface and types
  - Implement MCPProvider component
  - Add server state management (Map<string, MCPServerStatus>)
  - Add marketplace state management
  - Add loading and error states

- [ ] 1.2 Integrate with MCPClient for server status
  - Update `packages/core/src/mcp/mcpClient.ts`
  - Add getServerStatus() method to MCPClient
  - Add getAllServerStatuses() method to MCPClient
  - Add restartServer() method to MCPClient
  - Add getServerTools() method to MCPClient
  - Add getServerLogs() method to MCPClient

- [ ] 1.3 Integrate with MCPHealthMonitor
  - Update `packages/core/src/mcp/mcpHealthMonitor.ts`
  - Add subscribeToHealthUpdates() method
  - Implement background health checking
  - Add health status caching

- [ ] 1.4 Add OAuth manager integration
  - Update `packages/core/src/mcp/oauthManager.ts`
  - Implement configureOAuth() method
  - Implement authorize() method with callback server
  - Implement refreshToken() method
  - Implement revokeAccess() method
  - Implement getOAuthStatus() method
  - Add secure token storage with encryption

- [ ] 1.5 Create marketplace service
  - Create `packages/cli/src/services/mcpMarketplace.ts`
  - Implement MCPMarketplace class
  - Add searchServers() method
  - Add getAllServers() method with caching
  - Add getServerDetails() method
  - Add installServer() method
  - Add getPopularServers() method
  - Implement local registry fallback

- [ ] 1.6 Checkpoint - Run focused tests after data layer
  - Run unit tests for MCPContext
  - Run unit tests for MCPClient methods
  - Run unit tests for health monitoring
  - Run unit tests for OAuth manager
  - Run unit tests for marketplace service
  - Fix any failures before proceeding to Phase 2

### Phase 2: UI Components (5-6 hours)

- [ ] 2.1 Create MCPTab component
  - Create `packages/cli/src/ui/components/tabs/MCPTab.tsx`
  - Implement main MCPTab container
  - Add loading and error states
  - Integrate with MCPContext
  - Add keyboard input handling
  - Add dialog state management

- [ ] 2.2 Implement ServerItem component
  - Create `packages/cli/src/ui/components/mcp/ServerItem.tsx`
  - Add server status display
  - Add health indicator with color coding
  - Add toggle control
  - Add expand/collapse functionality
  - Implement ServerStats sub-component
  - Implement ServerActions sub-component

- [ ] 2.3 Create MarketplaceSection component
  - Create `packages/cli/src/ui/components/mcp/MarketplaceSection.tsx`
  - Implement MarketplacePreview component
  - Add server list rendering
  - Add search functionality
  - Add rating and install count display
  - Add OAuth requirement indicators

- [ ] 2.4 Add HealthMonitor component
  - Create `packages/cli/src/ui/components/mcp/HealthIndicator.tsx`
  - Add status icon mapping (●, ⚠, ✗, ○, ⟳)
  - Add color coding for health states
  - Add uptime formatting utility

- [ ] 2.5 Implement windowed rendering
  - Add virtual scrolling for server list
  - Optimize rendering for large lists (>20 servers)
  - Add performance monitoring

- [ ] 2.6 Checkpoint - Run focused tests after UI components
  - Run UI tests for MCPTab
  - Run UI tests for ServerItem
  - Run UI tests for MarketplaceSection
  - Run UI tests for HealthIndicator
  - Run performance tests for windowed rendering
  - Fix any failures before proceeding to Phase 3

### Phase 3: Navigation & Focus (2-3 hours)

- [ ] 3.1 Create useMCPNavigation hook
  - Create `packages/cli/src/ui/hooks/useMCPNavigation.ts`
  - Add Up/Down arrow navigation
  - Add Left/Right toggle functionality
  - Add Enter for expand/collapse
  - Add action key handlers (M, H, O, V, C, R, L, I, U)
  - Track focused index and section

- [ ] 3.2 Implement keyboard event handling
  - Add keyboard listener in MCPTab
  - Handle arrow keys for navigation
  - Handle action keys
  - Handle Tab for returning to main nav
  - Handle Esc for closing dialogs

- [ ] 3.3 Add focus management
  - Implement expandedServers state
  - Add toggleServer method
  - Implement focusedIndex and focusedSection state
  - Add visual focus indicators
  - Ensure focus stays visible during scrolling

- [ ] 3.4 Integrate with main navigation
  - Update `packages/cli/src/ui/components/layout/TabBar.tsx`
  - Add MCP tab to TabBar
  - Add tab switching logic
  - Add keyboard shortcut for MCP tab

- [ ] 3.5 Checkpoint - Run focused tests after navigation
  - Run unit tests for navigation hook
  - Run tests for focus management
  - Run integration tests for tab navigation
  - Fix any failures before proceeding to Phase 4

### Phase 4: Dialogs & Modals (6-7 hours)

- [ ] 4.1 Create ServerConfigDialog
  - Create `packages/cli/src/ui/components/dialogs/ServerConfigDialog.tsx`
  - Add command input field
  - Add arguments input field
  - Add environment variables editor with add/remove
  - Add auto-approve tools selector
  - Add form validation
  - Add test connection button
  - Mask secret environment variables

- [ ] 4.2 Create OAuthConfigDialog
  - Create `packages/cli/src/ui/components/dialogs/OAuthConfigDialog.tsx`
  - Add provider display
  - Add client ID input
  - Add scopes selector with checkboxes
  - Add OAuth status display
  - Add authorize button with browser integration
  - Add refresh token button
  - Add revoke access button

- [ ] 4.3 Create InstallServerDialog
  - Create `packages/cli/src/ui/components/dialogs/InstallServerDialog.tsx`
  - Add server info display (name, description, rating)
  - Add requirements display
  - Add dynamic configuration form
  - Add auto-approve checkbox
  - Add install button

- [ ] 4.4 Create ServerToolsViewer
  - Create `packages/cli/src/ui/components/dialogs/ServerToolsViewer.tsx`
  - Add tools list grouped by category
  - Add auto-approve checkboxes per tool
  - Add select all/none buttons
  - Add save functionality

- [ ] 4.5 Create HealthMonitorDialog
  - Create `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`
  - Add overall status summary
  - Add per-server health display
  - Add restart buttons
  - Add auto-restart configuration
  - Add refresh button

- [ ] 4.6 Create shared form components
  - Create `packages/cli/src/ui/components/forms/FormField.tsx`
  - Create `packages/cli/src/ui/components/forms/TextInput.tsx`
  - Create `packages/cli/src/ui/components/forms/Checkbox.tsx`
  - Create `packages/cli/src/ui/components/forms/Button.tsx`
  - Add validation error display
  - Ensure consistent styling

- [ ] 4.7 Checkpoint - Run focused tests after dialogs
  - Run UI tests for ServerConfigDialog
  - Run UI tests for OAuthConfigDialog
  - Run UI tests for InstallServerDialog
  - Run UI tests for ServerToolsViewer
  - Run UI tests for HealthMonitorDialog
  - Fix any failures before proceeding to Phase 5

### Phase 5: Integration & Testing (4-5 hours)

- [ ] 5.1 Wire up MCPTab to main App
  - Update `packages/cli/src/ui/App.tsx`
  - Add MCPProvider to App component
  - Add MCPTab to tab list
  - Add tab routing logic

- [ ] 5.2 Add to TabBar navigation
  - Add MCP tab button to TabBar
  - Add keyboard shortcut
  - Add visual indicator
  - Ensure proper tab ordering

- [ ] 5.3 Property-based tests (critical correctness properties)
  - [ ] 5.3.1 Property: Configuration persistence
    - **Property 1: Configuration Persistence**
    - **Validates: Data integrity requirement**
  - [ ] 5.3.2 Property: Server state consistency
    - **Property 2: Server State Consistency**
    - **Validates: State management requirement**
  - [ ] 5.3.3 Property: Token security
    - **Property 3: Token Security**
    - **Validates: OAuth security requirement**

- [ ] 5.4 Integration tests
  - [ ] 5.4.1 Test server toggle flow
  - [ ] 5.4.2 Test server installation flow
  - [ ] 5.4.3 Test OAuth authorization flow
  - [ ] 5.4.4 Test health monitoring updates
  - [ ] 5.4.5 Test error handling scenarios

- [ ] 5.5 Checkpoint - Run full test suite
  - Run all unit tests
  - Run all property-based tests
  - Run all integration tests
  - Verify UI rendering and navigation
  - Fix any failures before proceeding to Phase 6

### Phase 6: Polish & Documentation (3-4 hours)

- [ ] 6.1 Add loading states
  - Add loading spinners for async operations
  - Add skeleton screens for initial load
  - Add progress indicators

- [ ] 6.2 Improve error handling
  - Add error boundaries
  - Add user-friendly error messages
  - Add retry logic for failed operations
  - Handle configuration corruption gracefully

- [ ] 6.3 Add visual polish
  - Add animations for state changes
  - Add success/error notifications
  - Add confirmation dialogs for destructive actions
  - Improve color scheme consistency

- [ ] 6.4 Add help and documentation
  - Add contextual help text
  - Add keyboard shortcut hints in footer
  - Add field descriptions in dialogs
  - Add tooltips where helpful

- [ ] 6.5 Update documentation
  - Update `docs/MCP/` documentation
  - Add user guide for MCP panel
  - Add developer guide for extending
  - Update README with MCP panel features
  - Add screenshots/examples

- [ ] 6.6 Final validation checkpoint
  - Run complete test suite
  - Verify all success criteria met
  - Test with 20+ servers for performance
  - Test all error scenarios
  - Mark feature as complete

## Estimated Effort

**Total: 24-30 hours**

- Phase 1 (Data Layer): 4-5 hours
- Phase 2 (UI Components): 5-6 hours
- Phase 3 (Navigation): 2-3 hours
- Phase 4 (Dialogs): 6-7 hours
- Phase 5 (Integration): 4-5 hours
- Phase 6 (Polish): 3-4 hours

## Dependencies

- Stage-05 (MCP System) must be complete
- Stage-08b (Tools Panel) provides navigation patterns
- Stage-06 (CLI UI) provides base components

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

- Reuse navigation patterns from Tools Panel (stage-08b) and Hooks Panel (stage-08c)
- MCP configuration supports both user (~/.ollm/settings/mcp.json) and workspace (.ollm/settings/mcp.json) levels
- OAuth tokens stored securely with encryption in ~/.ollm/mcp/oauth-tokens.json
- Server logs stored in ~/.ollm/mcp/logs/{server-name}.log
- Marketplace supports offline mode with cached data and local registry fallback
- Health monitoring runs in background without blocking UI
- Environment variables with secrets (API keys, tokens) must be masked in UI
- Server commands validated to prevent injection attacks
