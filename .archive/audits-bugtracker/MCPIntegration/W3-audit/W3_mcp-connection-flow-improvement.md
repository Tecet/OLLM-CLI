# MCP Connection Flow Improvement Plan

**Date**: January 23, 2026  
**Priority**: High  
**Status**: Planning

---

## Problem Statement

The current MCP server connection flow shows confusing intermediate states:
1. Status indicator turns green immediately (before connection is ready)
2. Shows "Unhealthy" during initial connection (before health checks complete)
3. Health check failures trigger errors too quickly (before retries)
4. Status messages race each other showing conflicting information
5. Left panel only shows status when server is selected

---

## User Experience Issues

### Current Flow (Confusing):
```
Enable Server
  ↓
● Green (Enabled) ← Misleading, not connected yet
  ↓
🟡 Connecting
  ↓
🔴 Unhealthy ← Scary, but just waiting for health check
  ↓
🟢 Healthy ← Finally correct
```

### Desired Flow (Clear):
```
Enable Server
  ↓
🟡 Connecting... (spinner)
  ↓
🟡 Checking health... (spinner, 1-3 attempts)
  ↓
🟢 Connected (healthy)
OR
🔴 Unhealthy (after 3 failed health checks)
```

---

## Technical Requirements

### 1. Connection State Machine

Add explicit connection phases:
```typescript
type ConnectionPhase = 
  | 'stopped'        // Server is disabled/stopped
  | 'starting'       // Server process starting
  | 'connecting'     // Waiting for initial connection
  | 'health-check'   // Running health checks (1-3 attempts)
  | 'connected'      // Fully connected and healthy
  | 'unhealthy'      // Connected but health checks failed
  | 'error';         // Connection failed
```

### 2. Health Check Retry Logic

- **Fast initial checks**: 1s interval for first 5 checks
- **Retry before error**: 3 attempts before marking unhealthy
- **Grace period**: Don't show "Unhealthy" during initial connection
- **Only error after retries**: System message only after all retries exhausted

### 3. Left Panel Display

**Always show 2 lines per server:**

Line 1: `[icon] Server Name`
- Icon based on final state (not intermediate)
- ○ gray = disabled
- ● green = connected & healthy
- ● yellow = connecting/checking
- ● red = unhealthy (after retries)

Line 2: `  Status Text` (always visible, not just when selected)
- "○ Stopped" (gray, when disabled)
- "⟳ Connecting..." (yellow, with spinner)
- "⟳ Checking health..." (yellow, with spinner)
- "✓ Connected" (green, healthy)
- "✗ Unhealthy" (red, after 3 failed checks)
- "✗ Connection failed" (red, couldn't connect)

### 4. Synchronization with Health Monitor

- Health monitor should emit connection phase events
- UI should listen to these events and update immediately
- No race conditions between status updates
- Single source of truth for connection state

---

## Implementation Plan

### Phase 1: Add Connection Phase Tracking (2-3 hours)

**Files**:
- `packages/core/src/mcp/mcpHealthMonitor.ts`
- `packages/cli/src/ui/contexts/MCPContext.tsx`

**Changes**:
1. Add `ConnectionPhase` type to health monitor
2. Track current phase for each server
3. Emit phase change events
4. Update MCPContext to listen to phase events

### Phase 2: Update Health Check Logic (2-3 hours)

**Files**:
- `packages/core/src/mcp/mcpHealthMonitor.ts`

**Changes**:
1. Add retry counter per server
2. Only mark unhealthy after 3 consecutive failures
3. Reset counter on successful check
4. Emit appropriate phase during retries

### Phase 3: Update UI Display (2-3 hours)

**Files**:
- `packages/cli/src/ui/components/tabs/MCPTab.tsx`

**Changes**:
1. Always show 2-line display for servers
2. Add spinner for connecting/checking states
3. Update icon colors based on phase
4. Remove "selected only" status display

### Phase 4: Suppress Premature Errors (1-2 hours)

**Files**:
- `packages/cli/src/ui/contexts/MCPContext.tsx`

**Changes**:
1. Don't emit system messages during initial connection
2. Only show errors after all retries exhausted
3. Add grace period for health checks

---

## Testing Strategy

### Manual Testing Scenarios:
1. Enable disabled server → Should show "Connecting..." → "Checking health..." → "Connected"
2. Enable server that fails health check → Should retry 3 times before showing "Unhealthy"
3. Enable server that can't connect → Should show "Connection failed" after timeout
4. Disable running server → Should show "Stopped" immediately
5. Multiple servers connecting → Each should show independent status

### Automated Tests:
- Connection phase transitions
- Health check retry logic
- Error suppression during grace period
- UI state synchronization

---

## Success Criteria

1. ✅ No confusing intermediate states shown to user
2. ✅ Clear visual feedback during connection process
3. ✅ Errors only shown after retries exhausted
4. ✅ Status always visible (not just when selected)
5. ✅ Synchronized with health monitor (no race conditions)
6. ✅ All tests passing
7. ✅ No performance regression

---

## Estimated Time

**Total**: 7-11 hours

- Phase 1: 2-3 hours
- Phase 2: 2-3 hours
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours

---

## Notes

- This is a significant refactor touching core connection logic
- Should be done carefully with thorough testing
- May want to do in separate branch
- Consider adding connection phase to server status type
- May need to update health monitor interface

---

**Status**: Ready for implementation approval
**Next Step**: Get user approval, then start Phase 1

