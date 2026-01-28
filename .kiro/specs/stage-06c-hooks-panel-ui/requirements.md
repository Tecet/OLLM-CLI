# Hooks Panel UI - Requirements

**Feature:** Interactive UI for viewing and managing hooks  
**Priority:** Medium  
**Status:** Requirements Review  
**Created:** 2026-01-17

## Problem Statement

Users currently need to manually edit JSON files to create, configure, and manage hooks. This creates friction and makes the hook system less accessible. Users need an interactive UI to:

- View all available hooks organized by event type
- Enable/disable hooks without editing files
- Create new custom hooks through guided dialogs
- Edit existing hook configurations
- Test hooks before enabling them
- See which hooks are currently active

## User Stories

### US-1: View Hooks by Category

**As a** user  
**I want** to see all available hooks organized by event type  
**So that** I can understand what hooks are available and when they trigger

**Acceptance Criteria:**

- 1.1: Two-column layout (30% list, 70% details) matching ToolsPanel design
- 1.2: Left column shows hooks grouped by category with icons (📝 File, 💬 Prompt, 👤 User)
- 1.3: Exit item at top of list (position 0) with "← Exit" label
- 1.4: Category headers are visual-only (not selectable)
- 1.5: Right column shows detailed information for selected hook
- 1.6: Hook details include name, version, description, trigger conditions, action, and status
- 1.7: Visual distinction between enabled (●) and disabled (○) hooks
- 1.8: Selected hook highlighted in yellow when panel has focus
- 1.9: Windowed rendering for large hook lists (> 15 hooks)
- 1.10: Sticky scroll indicators (▲/▼) at top/bottom when scrolling

### US-2: Enable/Disable Hooks

**As a** user  
**I want** to enable/disable hooks with keyboard shortcuts  
**So that** I can quickly toggle hooks without editing files

**Acceptance Criteria:**

- 2.1: Left/Right arrow keys toggle hook enabled state
- 2.2: Visual toggle indicator shows current state (● enabled, ○ disabled)
- 2.3: Changes persist to settings file immediately
- 2.4: System message confirms state change
- 2.5: No page reload required

### US-3: Add New Hooks

**As a** user  
**I want** to create new custom hooks through a guided dialog  
**So that** I can add automation without writing JSON manually

**Acceptance Criteria:**

- 3.1: Press 'A' key to open Add Hook dialog
- 3.2: Dialog prompts for: name, description, event type, file patterns (if applicable), action type, prompt/command
- 3.3: Form validation prevents invalid configurations
- 3.4: Hook is saved to user hooks directory (~/.ollm/hooks/)
- 3.5: New hook appears in list immediately
- 3.6: Hook is enabled by default

### US-4: Edit Existing Hooks

**As a** user  
**I want** to edit existing hook configurations  
**So that** I can update hooks without recreating them

**Acceptance Criteria:**

- 4.1: Press 'E' key on selected hook to open Edit dialog
- 4.2: Dialog pre-populates with current values
- 4.3: Built-in hooks are read-only (can disable but not edit)
- 4.4: User hooks can be fully edited
- 4.5: Changes save to hook file immediately
- 4.6: Updated hook reflects changes in list

### US-5: Delete Hooks

**As a** user  
**I want** to delete hooks I no longer need  
**So that** I can keep my hook list clean

**Acceptance Criteria:**

- 5.1: Press 'D' key on selected hook to open delete confirmation
- 5.2: Confirmation dialog shows hook name and warns action is permanent
- 5.3: Built-in hooks cannot be deleted
- 5.4: User hooks can be deleted
- 5.5: Hook file is removed from disk
- 5.6: Hook disappears from list immediately

### US-6: Test Hooks

**As a** user  
**I want** to test hooks before enabling them  
**So that** I can verify they work correctly

**Acceptance Criteria:**

- 6.1: Press 'T' key on selected hook to test
- 6.2: Test dialog simulates hook trigger event
- 6.3: Shows hook execution result (success/failure)
- 6.4: Displays any errors or warnings
- 6.5: Test doesn't affect actual system state
- 6.6: Can test both enabled and disabled hooks

### US-7: Keyboard Navigation

**As a** user  
**I want** to navigate the hooks panel with keyboard shortcuts  
**So that** I can manage hooks efficiently

**Acceptance Criteria:**

- 7.1: Up/Down arrows navigate between hooks (skipping category headers)
- 7.2: Up from first hook moves to Exit item
- 7.3: Down from Exit item moves to first hook
- 7.4: Enter on Exit item triggers exit (same as Esc/0)
- 7.5: Enter/Left/Right on hook toggles enabled/disabled
- 7.6: Esc or 0 key exits to nav-bar (Browse Mode)
- 7.7: Tab enters panel from nav-bar (Active Mode)
- 7.8: A/E/D/T keys trigger respective actions (Add/Edit/Delete/Test)
- 7.9: Focus indicator shows current selection (yellow highlight)
- 7.10: Auto-scroll keeps selected item visible

### US-8: Hook Status Visibility

**As a** user  
**I want** to see which hooks are currently active  
**So that** I know what automation is running

**Acceptance Criteria:**

- 8.1: Enabled hooks show ● indicator
- 8.2: Disabled hooks show ○ indicator
- 8.3: Hook source shown (builtin/user/extension)
- 8.4: Trusted status visible for security
- 8.5: Last execution time shown (if available)

## Non-Functional Requirements

### Performance

- NFR-1: Panel should render < 100ms with 50 hooks
- NFR-2: Hook toggle should respond < 50ms
- NFR-3: Windowed rendering for large hook lists (> 20 hooks)
- NFR-4: No UI blocking during hook file operations

### Usability

- NFR-5: Consistent navigation with Tools Panel (stage-08b)
- NFR-6: Clear visual feedback for all actions
- NFR-7: Helpful error messages for validation failures
- NFR-8: Keyboard shortcuts displayed in footer
- NFR-9: Accessible color scheme for enabled/disabled states

### Reliability

- NFR-10: Corrupted hook files don't crash panel
- NFR-11: File write errors show user-friendly messages
- NFR-12: Settings persist correctly across sessions
- NFR-13: Concurrent edits handled gracefully

### Maintainability

- NFR-14: Reuse navigation patterns from Tools Panel
- NFR-15: Shared dialog components for consistency
- NFR-16: Hook validation logic centralized
- NFR-17: Comprehensive unit tests for all actions

## Data Model

### Hook Definition (from stage-05)

```typescript
interface Hook {
  id: string;
  name: string;
  version: string;
  description?: string;
  when: {
    type: HookEventType;
    patterns?: string[]; // For file events
  };
  then: {
    type: HookActionType;
    prompt?: string; // For askAgent
    command?: string; // For runCommand
  };
  enabled: boolean;
  trusted: boolean;
  source: 'builtin' | 'user' | 'extension';
}
```

### Settings Storage

```json
{
  "hooks": {
    "enabled": {
      "lint-on-save": true,
      "format-on-save": false,
      "test-on-change": true
    }
  }
}
```

### Hook Categories

```typescript
interface HookCategory {
  name: string;
  eventTypes: HookEventType[];
  hooks: Hook[];
  expanded: boolean;
}
```

## Dependencies

- **HookRegistry** (stage-05) - Hook loading and management
- **SettingsService** (existing) - Settings persistence
- **Tools Panel** (stage-08b) - Navigation patterns and UI components
- **TabBar** (stage-06) - Tab navigation integration

## Out of Scope

- Hook marketplace/discovery (future enhancement)
- Hook templates library (future enhancement)
- Hook debugging/logging UI (future enhancement)
- Hook scheduling/timing configuration (future enhancement)
- Hook chaining/composition UI (future enhancement)
- Bulk hook operations (enable/disable all) (future enhancement)
- Hook import/export functionality (future enhancement)
- Hook execution metrics/statistics (future enhancement)

## Success Metrics

- 90% of users can create a hook without documentation
- < 5% of hook configurations are invalid
- Zero crashes from hook panel operations
- 80% of users prefer UI over manual JSON editing
- Average time to create hook < 2 minutes

## Open Questions

1. Should we show hook execution history in the panel? (Adds complexity)
2. Should we support hook templates for common use cases? (Future enhancement)
3. Should we allow inline editing of hook fields? (vs dialog-based)
4. Should we show hook conflicts/warnings? (e.g., multiple hooks on same event)
5. Should we support hook search/filtering? (useful with many hooks)

## References

- Design Plan: `.dev/docs/Ui/hooks-panel-interactive-plan.md`
- Hook System: `docs/MCP/hooks/`
- Stage-05: `.kiro/specs/stage-05-hooks-extensions-mcp/`
- Tools Panel: `.kiro/specs/stage-08b-tool-support-detection/`
- Hook Audit: `.dev/audit/hooks-audit-2026-01-17.md`
