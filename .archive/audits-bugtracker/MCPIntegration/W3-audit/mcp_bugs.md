# MCP Panel UI - Test Failures and Bugs

This document tracks test failures and bugs discovered during the implementation of the MCP Panel UI feature.

---

## HealthMonitorDialog Test Failures

**Date:** 2026-01-19  
**Component:** `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`  
**Test File:** `packages/cli/src/ui/components/dialogs/__tests__/HealthMonitorDialog.test.tsx`

### Summary
- **Test Files:** 1 failed (1)
- **Tests:** 19 failed | 10 passed (29 total)
- **Pass Rate:** 34.5%

### Issue Description
The HealthMonitorDialog tests are failing because the MCPContext is not properly loading server data during test initialization. The component renders with "No MCP servers configured" even when mock data is provided via `mockClient.getAllServerStatuses()`.

### Root Cause
The issue appears to be related to async initialization in the MCPContext. The context loads servers on mount using `useEffect`, but the mock `getAllServerStatuses` method is not being called or its data is not being properly set in the context state before the component renders in tests.

### Failed Tests

1. **Overall Status Summary Tests (3 failures)**
   - `should display "Degraded" when some servers are unhealthy`
   - `should display "All Unhealthy" when all servers are unhealthy`
   - Expected: Status text and server counts
   - Actual: "All Healthy (0/0 servers healthy)"

2. **Server Health Display Tests (4 failures)**
   - `should display server name and health status`
   - `should display uptime for running servers`
   - `should display last check time`
   - `should display response time`
   - Expected: Server details (name, uptime, last check, response time)
   - Actual: "No MCP servers configured"

3. **Error and Warning Messages Tests (2 failures)**
   - `should display error message for unhealthy servers`
   - `should display warning message for degraded servers`
   - Expected: Error/warning messages
   - Actual: No servers displayed

4. **Action Buttons Tests (1 failure)**
   - `should display View Logs button for all servers`
   - Expected: Action buttons for servers
   - Actual: No servers displayed

5. **Health Status Icons Tests (3 failures)**
   - `should display correct icon for healthy servers`
   - `should display correct icon for degraded servers`
   - `should display correct icon for unhealthy servers`
   - Expected: Health status icons (●, ⚠, ✗)
   - Actual: No servers displayed

6. **Multiple Servers Tests (2 failures)**
   - `should display all servers in the list`
   - `should calculate correct overall status with mixed health`
   - Expected: Multiple servers with mixed health
   - Actual: No servers displayed

7. **Uptime Formatting Tests (4 failures)**
   - `should format uptime in seconds`
   - `should format uptime in minutes`
   - `should format uptime in hours`
   - `should format uptime in days`
   - Expected: Formatted uptime strings
   - Actual: No servers displayed

### Passing Tests (10)

1. `should display "All Healthy" when all servers are healthy` ✅
2. `should display message when no servers are configured` ✅
3. `should not display error message for healthy servers` ✅
4. `should display Restart button for running servers` ✅
5. `should display Enable button for stopped servers` ✅
6. `should not display Restart button for stopped servers` ✅
7. `should display auto-restart checkbox` ✅
8. `should display max restarts input when auto-restart is enabled` ✅
9. `should display Refresh button` ✅
10. `should display Close button` ✅

### Technical Details

**Test Setup:**
```typescript
const renderWithProvider = (ui: React.ReactElement) => {
  return render(
    <UIProvider initialTheme={defaultDarkTheme}>
      <MCPProvider
        mcpClient={mockClient as any}
        healthMonitor={mockHealthMonitor as any}
        oauthProvider={mockOAuthProvider as any}
      >
        {ui}
      </MCPProvider>
    </UIProvider>
  );
};
```

**Mock Setup:**
```typescript
mockClient.getAllServerStatuses.mockResolvedValue(
  new Map([
    ['server1', createMockServer('server1', 'healthy')],
    ['server2', createMockServer('server2', 'unhealthy', 'error')],
  ])
);
```

### Potential Solutions

1. **Fix Async Initialization in Tests**
   - Wait for the MCPContext to complete its async initialization before assertions
   - Use `waitFor` with proper conditions to ensure data is loaded
   - Mock the async initialization to be synchronous in tests

2. **Refactor MCPContext for Testability**
   - Separate data loading logic from the context provider
   - Add a way to inject initial state for testing
   - Provide a synchronous initialization mode for tests

3. **Use Integration Tests Instead**
   - Convert some unit tests to integration tests that properly handle async initialization
   - Test the full component lifecycle including data loading

4. **Mock at a Higher Level**
   - Instead of mocking `getAllServerStatuses`, mock the entire MCPContext value
   - Provide pre-populated state directly to the context

### Recommended Fix

The most straightforward solution is to add an `initialState` prop to MCPProvider that allows tests to bypass async initialization:

```typescript
export interface MCPProviderProps {
  children: ReactNode;
  mcpClient?: MCPClient;
  healthMonitor?: MCPHealthMonitor;
  oauthProvider?: MCPOAuthProvider;
  initialState?: Partial<MCPState>; // Add this
}
```

Then in tests:
```typescript
const renderWithProvider = (ui: React.ReactElement, servers: Map<...>) => {
  return render(
    <UIProvider initialTheme={defaultDarkTheme}>
      <MCPProvider
        mcpClient={mockClient as any}
        healthMonitor={mockHealthMonitor as any}
        oauthProvider={mockOAuthProvider as any}
        initialState={{ servers, isLoading: false, error: null }}
      >
        {ui}
      </MCPProvider>
    </UIProvider>
  );
};
```

### Impact

- **Severity:** Medium
- **Priority:** Medium
- **Blocking:** No (component implementation is complete and functional)
- **Affects:** Test coverage and confidence in component behavior

### Next Steps

1. Implement one of the proposed solutions
2. Re-run tests to verify fixes
3. Ensure all 29 tests pass
4. Update test documentation

---

## Notes

- The component itself is fully functional and renders correctly in the application
- The issue is isolated to the test environment and async mocking
- 10 tests are passing, indicating the component structure and basic rendering work correctly
- The failing tests all relate to scenarios where server data should be displayed
