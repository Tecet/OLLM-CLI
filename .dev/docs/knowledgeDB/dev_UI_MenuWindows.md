# UI Menu Windows - Dialogs & Overlays

**Last Updated:** January 26, 2026  
**Status:** ✅ Implemented  
**Related Documents:**

- `dev_UI_Front.md` - Main interface
- `dev_Keybinds.md` - Keyboard shortcuts
- `dev_MCPIntegration.md` - MCP dialogs
- `dev_HookSystem.md` - Hook dialogs

---

## Overview

Menu windows are modal dialogs and overlays that appear on top of the main interface. They handle user interactions for configuration, confirmation, and data input.

**Dialog System:** `packages/cli/src/ui/components/dialogs/DialogManager.tsx`

---

## Dialog Types

### 1. Confirmation Dialogs

**Purpose:** Confirm destructive or important actions

**Component:** `packages/cli/src/ui/components/dialogs/ConfirmationDialog.tsx`

**Layout:**

```
┌─ Confirmation ────────────────────────────┐
│                                            │
│ Are you sure you want to delete this file?│
│                                            │
│ /path/to/file.ts                          │
│                                            │
│ This action cannot be undone.             │
│                                            │
│ [Yes (Y)] [No (N)]                        │
│                                            │
└────────────────────────────────────────────┘
```

**Keybinds:**

- `Y` - Confirm
- `N` - Cancel
- `Escape` - Cancel
- `Return` - Confirm (if focused on Yes)

**Usage:**

- File deletion
- Session deletion
- Hook deletion
- Server uninstall

---

### 2. Hook Approval Dialog

**Purpose:** Approve untrusted hooks before execution

**Component:** `packages/cli/src/ui/components/dialogs/HookApprovalDialog.tsx`

**Layout:**

```
┌─ Hook Approval Required ──────────────────┐
│                                            │
│ Hook: lint-on-save                        │
│ Event: fileEdited                         │
│ Action: runCommand                        │
│                                            │
│ Command:                                   │
│ npx eslint --fix {{file.path}}            │
│                                            │
│ Hash: a1b2c3d4e5f6...                     │
│                                            │
│ ⚠️ This hook will execute shell commands  │
│                                            │
│ [Approve Once] [Always Trust] [Reject]    │
│                                            │
└────────────────────────────────────────────┘
```

**Keybinds:**

- `O` - Approve once
- `A` - Always trust (add to trusted list)
- `R` - Reject
- `Escape` - Reject

**Reference:** `dev_HookSystem.md` - "Trust System" section

---

### 3. MCP Server Configuration

**Purpose:** Configure MCP server settings

**Component:** `packages/cli/src/ui/components/dialogs/ServerConfigDialog.tsx`

**Layout:**

```
┌─ Configure MCP Server ────────────────────┐
│                                            │
│ Server Name:                               │
│ [github                              ]    │
│                                            │
│ Command:                                   │
│ [npx                                 ]    │
│                                            │
│ Arguments:                                 │
│ [-y @modelcontextprotocol/server-github] │
│                                            │
│ Environment Variables:                     │
│ GITHUB_TOKEN: [********************]      │
│                                            │
│ Transport: [stdio ▼]                      │
│                                            │
│ [Save] [Cancel] [Test Connection]         │
│                                            │
└────────────────────────────────────────────┘
```

**Keybinds:**

- `Tab` - Next field
- `Shift+Tab` - Previous field
- `Return` - Save (if on Save button)
- `Escape` - Cancel

**Reference:** `dev_MCPIntegration.md` - "Configuration" section

---

### 4. OAuth Configuration

**Purpose:** Configure OAuth settings for MCP servers

**Component:** `packages/cli/src/ui/components/dialogs/OAuthConfigDialog.tsx`

**Layout:**

```
┌─ OAuth Configuration ─────────────────────┐
│                                            │
│ Server: github                             │
│                                            │
│ Client ID:                                 │
│ [your-client-id                      ]    │
│                                            │
│ Client Secret:                             │
│ [********************                ]    │
│                                            │
│ Authorization URL:                         │
│ [https://github.com/login/oauth/authorize]│
│                                            │
│ Token URL:                                 │
│ [https://github.com/login/oauth/access_token]│
│                                            │
│ Scopes:                                    │
│ [repo, user                          ]    │
│                                            │
│ [Save] [Cancel]                           │
│                                            │
└────────────────────────────────────────────┘
```

**Reference:** `dev_MCPIntegration.md` - "OAuth Flow" section

---

### 5. Marketplace Dialog

**Purpose:** Browse and install MCP servers from marketplace

**Component:** `packages/cli/src/ui/components/dialogs/MarketplaceDialog.tsx`

**Layout:**

```
┌─ MCP Marketplace ─────────────────────────┐
│                                            │
│ Search: [github                      ] 🔍 │
│                                            │
│ ┌────────────────────────────────────────┐│
│ │ github-integration          ⭐ 4.8/5  ││
│ │ GitHub integration for OLLM            ││
│ │ Tools: 12 | Downloads: 1.2K            ││
│ │ [Install] [Details]                    ││
│ ├────────────────────────────────────────┤│
│ │ github-actions              ⭐ 4.5/5  ││
│ │ GitHub Actions integration             ││
│ │ Tools: 8 | Downloads: 850              ││
│ │ [Install] [Details]                    ││
│ └────────────────────────────────────────┘│
│                                            │
│ [Close]                                    │
│                                            │
└────────────────────────────────────────────┘
```

**Keybinds:**

- `Up/Down` - Navigate list
- `Return` - Install selected
- `D` - View details
- `/` - Focus search
- `Escape` - Close

**Reference:** `dev_MCPIntegration.md`

---

### 6. Help Overlay

**Purpose:** Show context-sensitive help and keybinds

**Component:** `packages/cli/src/ui/components/dialogs/HelpOverlay.tsx`

**Layout:**

```
┌─ Help ────────────────────────────────────┐
│                                            │
│ File Explorer Keybinds                    │
│                                            │
│ o - Open file                             │
│ e - Edit file                             │
│ r - Rename file/folder                    │
│ d - Delete file/folder                    │
│ c - Copy path                             │
│ j/k - Move up/down (Vim-style)            │
│ h/l - Collapse/expand (Vim-style)         │
│ p - Quick open                            │
│ ? - Toggle this help                      │
│                                            │
│ Press ? or Escape to close                │
│                                            │
└────────────────────────────────────────────┘
```

**Keybinds:**

- `?` - Toggle help
- `Escape` - Close

**Reference:** `dev_Keybinds.md`

---

### 7. Add/Edit Hook Dialog

**Purpose:** Create or edit hooks

**Component:** `packages/cli/src/ui/components/dialogs/AddHookDialog.tsx`

**Layout:**

```
┌─ Add Hook ────────────────────────────────┐
│                                            │
│ Name:                                      │
│ [lint-on-save                        ]    │
│                                            │
│ Event Type: [fileEdited ▼]               │
│                                            │
│ File Patterns:                             │
│ [*.ts, *.tsx                         ]    │
│                                            │
│ Action Type: [runCommand ▼]              │
│                                            │
│ Command:                                   │
│ [npx eslint --fix {{file.path}}      ]    │
│                                            │
│ [Save] [Cancel] [Test]                    │
│                                            │
└────────────────────────────────────────────┘
```

**Reference:** `dev_HookSystem.md`

---

### 8. Mode Suggestion Dialog

**Purpose:** Suggest mode changes based on context

**Component:** `packages/cli/src/ui/components/dialogs/ModeSuggestionDialog.tsx`

**Layout:**

```
┌─ Mode Suggestion ─────────────────────────┐
│                                            │
│ 💡 Detected debugging context             │
│                                            │
│ You're analyzing an error. Would you like │
│ to switch to Debug mode?                  │
│                                            │
│ Debug mode provides:                      │
│ • Stack trace analysis                    │
│ • Error reproduction steps                │
│ • Binary search for bugs                  │
│                                            │
│ [Switch to Debug] [Stay in Assistant]    │
│ [Don't ask again]                         │
│                                            │
└────────────────────────────────────────────┘
```

**Reference:** `dev_PromptSystem.md` - "Mode System" section

---

### 9. Health Monitor Dialog

**Purpose:** Show MCP server health status

**Component:** `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`

**Layout:**

```
┌─ MCP Health Monitor ──────────────────────┐
│                                            │
│ github                          🟢 Healthy│
│ Last check: 2s ago                        │
│ Response time: 45ms                       │
│ Uptime: 2h 15m                            │
│ [Restart] [View Logs]                     │
│                                            │
│ slack                           🔴 Unhealthy│
│ Last check: 5s ago                        │
│ Error: Connection timeout                 │
│ Failed attempts: 3/3                      │
│ [Restart] [View Logs] [Configure]         │
│                                            │
│ [Close] [Refresh]                         │
│                                            │
└────────────────────────────────────────────┘
```

**Reference:** `dev_MCPIntegration.md` - "Health Monitoring" section

---

### 10. Server Logs Viewer

**Purpose:** View MCP server logs

**Component:** `packages/cli/src/ui/components/dialogs/ServerLogsViewer.tsx`

**Layout:**

```
┌─ Server Logs: github ─────────────────────┐
│                                            │
│ [2026-01-26 14:32:15] INFO: Connected     │
│ [2026-01-26 14:32:16] INFO: Tools loaded  │
│ [2026-01-26 14:32:20] DEBUG: Tool call    │
│ [2026-01-26 14:32:21] INFO: Tool result   │
│ [2026-01-26 14:32:25] ERROR: Rate limit   │
│                                            │
│ ▼ (scroll for more)                       │
│                                            │
│ [Close] [Clear] [Export]                  │
│                                            │
└────────────────────────────────────────────┘
```

**Keybinds:**

- `Up/Down` - Scroll
- `Home/End` - Jump to top/bottom
- `Escape` - Close

---

## Dialog Manager

**Component:** `packages/cli/src/ui/components/dialogs/DialogManager.tsx`

**Responsibilities:**

- Dialog queue management
- Z-index stacking
- Focus management
- Keyboard event routing
- Dialog transitions

**Dialog Stack:**

```
┌─────────────────────────────────────────┐
│ Main UI (blurred)                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Dialog 1 (background)           │   │
│  │                                 │   │
│  │  ┌─────────────────────────┐   │   │
│  │  │ Dialog 2 (foreground)   │   │   │
│  │  │ [Active]                │   │   │
│  │  └─────────────────────────┘   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Dialog Context:**

```typescript
// packages/cli/src/ui/contexts/DialogContext.tsx
interface DialogContext {
  showDialog: (type: DialogType, data: any) => void;
  hideDialog: () => void;
  currentDialog: Dialog | null;
}
```

---

## Dialog Styling

**Common Layout:**

```css
.dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 40;
  max-width: 80;
  border: double;
  padding: 2;
  background: theme.background;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  border-bottom: single;
  padding-bottom: 1;
  margin-bottom: 1;
  font-weight: bold;
}

.dialog-content {
  padding: 1 0;
}

.dialog-footer {
  border-top: single;
  padding-top: 1;
  margin-top: 1;
  display: flex;
  justify-content: flex-end;
  gap: 2;
}
```

**Button Styling:**

```css
.button {
  padding: 0 2;
  border: single;
  background: theme.accent;
  color: theme.text;
}

.button:focus {
  border: double;
  background: theme.accentHover;
}

.button:disabled {
  opacity: 0.5;
  color: theme.textDim;
}
```

---

## Form Components

**Location:** `packages/cli/src/ui/components/forms/`

### TextInput

**Component:** `TextInput.tsx`

**Features:**

- Single-line text input
- Password masking
- Validation
- Placeholder text
- Character limit

### Checkbox

**Component:** `Checkbox.tsx`

**Features:**

- Toggle state
- Label
- Disabled state
- Keyboard navigation

### Button

**Component:** `Button.tsx`

**Features:**

- Click handler
- Focus state
- Disabled state
- Loading state
- Variants (primary, secondary, danger)

### FormField

**Component:** `FormField.tsx`

**Features:**

- Label
- Input wrapper
- Error message
- Help text
- Required indicator

---

## Dialog Transitions

**Fade In:**

```
Frame 1: Opacity 0%
Frame 2: Opacity 25%
Frame 3: Opacity 50%
Frame 4: Opacity 75%
Frame 5: Opacity 100%
```

**Slide In:**

```
Frame 1: Y offset +10
Frame 2: Y offset +7
Frame 3: Y offset +4
Frame 4: Y offset +1
Frame 5: Y offset 0
```

**Component:** `packages/cli/src/ui/components/mcp/FadeTransition.tsx`

---

## Notification System

**Component:** `packages/cli/src/ui/components/mcp/Notification.tsx`

**Layout:**

```
┌─────────────────────────────────────────┐
│ Main UI                                 │
│                                         │
│                  ┌─────────────────────┐│
│                  │ ✓ File saved        ││
│                  └─────────────────────┘│
│                  ┌─────────────────────┐│
│                  │ ⚠️ Low memory       ││
│                  └─────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

**Notification Types:**

- Success (green, ✓)
- Warning (yellow, ⚠️)
- Error (red, ✗)
- Info (blue, ℹ️)

**Auto-dismiss:** 3 seconds (configurable)

---

## File Locations

| Component            | File Path                                                         |
| -------------------- | ----------------------------------------------------------------- |
| DialogManager        | `packages/cli/src/ui/components/dialogs/DialogManager.tsx`        |
| ConfirmationDialog   | `packages/cli/src/ui/components/dialogs/ConfirmationDialog.tsx`   |
| HookApprovalDialog   | `packages/cli/src/ui/components/dialogs/HookApprovalDialog.tsx`   |
| ServerConfigDialog   | `packages/cli/src/ui/components/dialogs/ServerConfigDialog.tsx`   |
| OAuthConfigDialog    | `packages/cli/src/ui/components/dialogs/OAuthConfigDialog.tsx`    |
| MarketplaceDialog    | `packages/cli/src/ui/components/dialogs/MarketplaceDialog.tsx`    |
| HelpOverlay          | `packages/cli/src/ui/components/dialogs/HelpOverlay.tsx`          |
| AddHookDialog        | `packages/cli/src/ui/components/dialogs/AddHookDialog.tsx`        |
| ModeSuggestionDialog | `packages/cli/src/ui/components/dialogs/ModeSuggestionDialog.tsx` |
| HealthMonitorDialog  | `packages/cli/src/ui/components/dialogs/HealthMonitorDialog.tsx`  |
| ServerLogsViewer     | `packages/cli/src/ui/components/dialogs/ServerLogsViewer.tsx`     |
| Notification         | `packages/cli/src/ui/components/mcp/Notification.tsx`             |
| DialogContext        | `packages/cli/src/ui/contexts/DialogContext.tsx`                  |
| Form Components      | `packages/cli/src/ui/components/forms/`                           |

---

## Post-Alpha Tasks

### Dialog System Improvements

**Priority:** Low  
**Effort:** 1-2 days

1. **Dialog Animations**
   - Smooth transitions
   - Fade in/out
   - Slide animations

2. **Dialog Stacking**
   - Multiple dialogs
   - Z-index management
   - Focus management

3. **Form Validation**
   - Real-time validation
   - Error messages
   - Field dependencies

4. **Accessibility**
   - Screen reader support
   - Keyboard navigation
   - Focus trapping

---

## Notes

- All dialogs are modal (block main UI)
- Dialogs use DialogContext for state management
- Form components are reusable across dialogs
- Notifications are non-modal (don't block UI)
- Dialog styling is theme-aware
- Keyboard navigation is fully supported
