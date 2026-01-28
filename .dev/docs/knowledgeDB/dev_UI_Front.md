# UI Front - Main Interface

**Last Updated:** January 26, 2026  
**Status:** ✅ Implemented  
**Related Documents:**
- `dev_UI_MenuWindows.md` - Dialogs and overlays
- `dev_Terminal.md` - Terminal component (TBD)
- `dev_Keybinds.md` - Keyboard shortcuts
- `dev_ContextManagement.md` - Token count/calculations

---

## Overview

The OLLM CLI UI is a terminal-based interface built with React + Ink. The layout consists of three main areas: Header Bar, Main Content Area (with optional Side Panel), and Status Bar.

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER BAR (SystemBar)                                          │
│ Model | Context | Mode | Clock                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────┬─────────────────────────────────────┐  │
│ │                     │                                      │  │
│ │   MAIN CONTENT      │   SIDE PANEL (Optional)             │  │
│ │   (Chat/Tabs)       │   (Tools/Hooks/Files/MCP/Settings)  │  │
│ │                     │                                      │  │
│ │   - Chat History    │   - Tab Navigation                  │  │
│ │   - Input Area      │   - Tab Content                     │  │
│ │                     │   - Actions                         │  │
│ │                     │                                      │  │
│ └─────────────────────┴─────────────────────────────────────┘  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ STATUS BAR                                                       │
│ Status | Keybind Hints | Notifications                          │
└─────────────────────────────────────────────────────────────────┘
```

**CSS-like Layout:**
```css
/* Root Container */
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
}

/* Header Bar */
.header-bar {
  flex-shrink: 0;
  height: 1; /* 1 line */
  border-bottom: single;
}

/* Main Content Area */
.main-content {
  flex-grow: 1;
  display: flex;
  flex-direction: row;
  overflow: hidden;
}

/* Left Column (Chat) */
.left-column {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 60%;
}

/* Right Column (Side Panel) */
.right-column {
  flex-shrink: 0;
  width: 40%;
  border-left: single;
  overflow: hidden;
  /* Toggleable via Ctrl+P */
}

/* Status Bar */
.status-bar {
  flex-shrink: 0;
  height: 1; /* 1 line */
  border-top: single;
}
```

---

## Header Bar (SystemBar)

**Component:** `packages/cli/src/ui/components/layout/SystemBar.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🦙 llama3:8b │ 5.2K/13.9K │ 🎯 Assistant │ 🕐 14:32:15        │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**

| Element | Component | Description | Reference |
|---------|-----------|-------------|-----------|
| Model Name | ModelDisplay | Current active model | `dev_ModelManagement.md` |
| Context Usage | ContextSection | Tokens used/available | `dev_ContextManagement.md` |
| Mode Indicator | ModeDisplay | Current operational mode | `dev_PromptSystem.md` |
| Clock | Clock | Current time | - |

**Context Section Details:**
```typescript
// Format: {current}/{max} tokens
// Example: 5,234/13,926
// Color coding:
// - Green: < 60% usage
// - Yellow: 60-80% usage
// - Red: > 80% usage
```

**Token Calculation Reference:**
- See `dev_ContextManagement.md` - "Token Counting" section
- Implementation: `packages/core/src/context/tokenCounter.ts`

**Keybinds:**
- None (display only)

---

## Main Content Area

### Left Column - Chat View

**Component:** `packages/cli/src/ui/components/tabs/ChatTab.tsx`

**Layout:**
```
┌─────────────────────────────────────────┐
│ Chat History (scrollable)               │
│                                          │
│ User: How do I...                       │
│ Assistant: You can...                   │
│ [Tool Call: glob **/*.ts]               │
│ User: Thanks!                           │
│                                          │
│ ▼ (scroll indicator)                    │
├─────────────────────────────────────────┤
│ Input Area                               │
│ > Type your message...                  │
│ [Send: Return | New Line: Shift+Return] │
└─────────────────────────────────────────┘
```

**Sub-components:**

#### Chat History
**Component:** `packages/cli/src/ui/components/chat/ChatHistory.tsx`

**Features:**
- Scrollable message list
- Auto-scroll to bottom on new messages
- Message rendering (user, assistant, system, tool)
- Syntax highlighting for code blocks
- Tool call display

**Layout:**
```css
.chat-history {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1;
  display: flex;
  flex-direction: column;
}
```

#### Message Component
**Component:** `packages/cli/src/ui/components/chat/Message.tsx`

**Message Types:**
1. **User Message** - Blue text, left-aligned
2. **Assistant Message** - White text, left-aligned
3. **System Message** - Gray text, italic
4. **Tool Call** - Yellow box with tool name and result

**Tool Call Display:**
```
┌─ Tool: glob ─────────────────────────┐
│ Pattern: **/*.ts                      │
│ Result: Found 42 files                │
│ - src/index.ts                        │
│ - src/utils.ts                        │
│ - ...                                 │
└───────────────────────────────────────┘
```

---

### Message Rendering Architecture

**IMPORTANT:** OLLM CLI uses a **line-based rendering system** for chat history, not React component trees.

**Rendering Flow:**
1. `ChatContext.tsx` manages message state
2. `ChatHistory.tsx` converts messages to text lines via `buildChatLines()`
3. Lines are rendered as plain text, not React components
4. `message.expanded` controls ALL collapsible content

**Key Insight:** Component-level state in `Message.tsx` or child components does NOT affect rendering. The actual rendering happens in the `buildChatLines()` utility function.

**Refactoring Complete (January 28, 2026):** ✅
- Extracted custom hooks from `ModelContext.tsx`
- Created `useToolSupport.ts` for tool support management (311 lines)
- Created `useModelWarmup.ts` for warmup system (191 lines)
- Reduced `ModelContext.tsx` from 810 to 377 lines (53.5% reduction)
- All 810 tests passing
- Zero regressions

**Benefits:**
- Improved maintainability
- Better testability
- Clear separation of concerns
- Easier to understand and modify

**Reference:** `.dev/backlog/28-01-2026-SessionsContext/TASK-001-COMPLETE.md`

---

### Collapsible Content System

**State Control:** `message.expanded` field (boolean)

**Collapsible Elements:**
- Reasoning blocks (thinking process)
- Tool calls with large arguments
- Diffs with many lines
- Long outputs

**Behavior:**
```typescript
// ChatHistory.tsx
const isExpanded = message.expanded === true;

if (showReasoning && message.reasoning) {
  if (isExpanded) {
    // Show full reasoning content
  } else {
    addLine([{ text: 'Reasoning: (collapsed)', ... }]);
  }
}
```

---

### Reasoning Box Behavior

**Purpose:** Display LLM thinking process (e.g., DeepSeek R1 models)

**States:**

1. **Streaming (expanded: true, complete: false)**
   - Reasoning shows EXPANDED with full content
   - Content streams in real-time
   - User can see the thinking process
   - Box remains open until completion

2. **Complete (expanded: false, complete: true)**
   - Auto-collapses to summary view
   - Shows "Reasoning: (collapsed)"
   - Saves screen space
   - User can expand manually if needed

3. **Historical Messages**
   - Completed reasoning blocks start COLLAPSED
   - Shows summary line only
   - No unnecessary screen space used

**Implementation:**

```typescript
// ChatContext.tsx - Message Creation
const assistantMsg = addMessage({
  role: 'assistant',
  content: '',
  expanded: true,  // Start expanded to show reasoning as it streams
});

// ChatContext.tsx - On Completion
if (msg.reasoning) {
  updates.reasoning = {
    ...msg.reasoning,
    complete: true,
    duration: metrics.evalDuration > 0 ? metrics.evalDuration / 1e9 : 0,
  };
  updates.expanded = false;  // Auto-collapse when complete
}
```

**User Controls:**
- Navigate to reasoning block with arrow keys
- Press `Space` or `Return` to toggle expand/collapse
- State persists until next update

**Files:**
- `packages/cli/src/features/context/ChatContext.tsx` - Message state management
- `packages/cli/src/ui/components/chat/ChatHistory.tsx` - Rendering logic
- `packages/cli/src/ui/components/chat/Message.tsx` - Component wrapper (not used for rendering)
- `packages/cli/src/ui/components/chat/ReasoningBox.tsx` - Component wrapper (not used for rendering)

**Reference:** `.dev/docs/devs/audits-bugtracker/ContextManagement/W3-W4-LLM-audit/other/reasoning-box-behavior-fix.md`

#### Input Area
**Component:** `packages/cli/src/ui/components/layout/ChatInputArea.tsx`

**Features:**
- Multi-line text input
- Auto-resize based on content
- Keybind hints
- Character/token count (optional)

**Layout:**
```css
.input-area {
  flex-shrink: 0;
  border-top: single;
  padding: 1;
  min-height: 3;
  max-height: 10;
}
```

**Keybinds:**
- `Return` - Send message
- `Shift+Return` - New line
- `Escape` - Cancel/clear
- `Up` - Edit previous message
- See `dev_Keybinds.md` - "Chat Interaction" section

---

### Right Column - Side Panel

**Component:** `packages/cli/src/ui/components/layout/SidePanel.tsx`

**Toggle:** `Ctrl+P` (see `dev_Keybinds.md`)

**Layout:**
```
┌─────────────────────────────────────────┐
│ Tab Bar                                  │
│ [Tools] [Hooks] [Files] [MCP] [Settings]│
├─────────────────────────────────────────┤
│                                          │
│ Tab Content (scrollable)                │
│                                          │
│ - Tab-specific content                  │
│ - Actions                                │
│ - Status                                 │
│                                          │
└─────────────────────────────────────────┘
```

**Layout:**
```css
.side-panel {
  display: flex;
  flex-direction: column;
  width: 40%;
  border-left: single;
  overflow: hidden;
}

.tab-bar {
  flex-shrink: 0;
  height: 1;
  border-bottom: single;
}

.tab-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1;
}
```

#### Tab Bar
**Component:** `packages/cli/src/ui/components/layout/TabBar.tsx`

**Tabs:**
1. **Tools** (`Ctrl+2`) - Tool management
2. **Hooks** (`Ctrl+3`) - Hook management
3. **Files** (`Ctrl+4`) - File explorer
4. **Search** (`Ctrl+5`) - Search panel
5. **Docs** (`Ctrl+6`) - Documentation
6. **GitHub** (`Ctrl+7`) - GitHub integration
7. **MCP** (`Ctrl+8`) - MCP servers
8. **Settings** (`Ctrl+9`) - Settings

**Active Tab Indicator:**
```
[Tools*] [Hooks] [Files] [MCP] [Settings]
  ^^^^
  Active (highlighted)
```

**Keybinds:**
- `Ctrl+1-9` - Switch tabs
- See `dev_Keybinds.md` - "Tab Navigation" section

---

#### Tools Tab
**Component:** `packages/cli/src/ui/components/tabs/ToolsTab.tsx`

**Layout:**
```
┌─ Tools ──────────────────────────────────┐
│                                           │
│ File Operations                           │
│ ☑ read_file    ☑ write_file              │
│ ☑ edit_file    ☑ glob                    │
│                                           │
│ Search                                    │
│ ☑ grep         ☑ web_search              │
│                                           │
│ Execution                                 │
│ ☑ shell        ☑ web_fetch               │
│                                           │
│ MCP Tools (github)                        │
│ ☑ create_issue ☑ list_repos              │
│                                           │
└───────────────────────────────────────────┘
```

**Features:**
- Tool categories (collapsible)
- Enable/disable toggles
- Tool descriptions on hover
- MCP tools integration

**Reference:** `dev_ToolExecution.md`

---

#### Hooks Tab
**Component:** `packages/cli/src/ui/components/tabs/HooksTab.tsx`

**Layout:**
```
┌─ Hooks ──────────────────────────────────┐
│                                           │
│ File Events                               │
│ ✓ lint-on-save (fileEdited)              │
│ ✓ format-on-save (fileEdited)            │
│                                           │
│ Agent Events                              │
│ ○ log-prompts (promptSubmit)             │
│                                           │
│ [+ Add Hook] [Debug: OFF]                │
│                                           │
└───────────────────────────────────────────┘
```

**Features:**
- Hook list by category
- Enable/disable toggles
- Add/edit/delete hooks
- Debug mode toggle

**Reference:** `dev_HookSystem.md`

---

#### Files Tab
**Component:** `packages/cli/src/ui/components/tabs/FilesTab.tsx`

**Layout:**
```
┌─ Files ──────────────────────────────────┐
│ 📁 /home/user/project                    │
│                                           │
│ ▼ 📁 src                                  │
│   ▼ 📁 components                         │
│     📄 Button.tsx                         │
│     📄 Input.tsx                          │
│   📄 index.ts                             │
│ ▼ 📁 tests                                │
│   📄 app.test.ts                          │
│                                           │
│ [o]pen [e]dit [r]ename [d]elete [?]help  │
└───────────────────────────────────────────┘
```

**Features:**
- Tree view with expand/collapse
- File operations (open, edit, rename, delete)
- Git status indicators
- Quick open (`P`)
- Follow active file mode

**Keybinds:**
- See `dev_Keybinds.md` - "File Explorer" section

**Reference:** `packages/cli/src/ui/components/file-explorer/README.md`

---

#### MCP Tab
**Component:** `packages/cli/src/ui/components/tabs/MCPTab.tsx`

**Layout:**
```
┌─ MCP Servers ────────────────────────────┐
│                                           │
│ Installed Servers                         │
│ ✓ github (connected) 🟢                  │
│   Tools: 12 | Resources: 5               │
│   [View] [Restart] [Configure]           │
│                                           │
│ ○ slack (disconnected) 🔴                │
│   [Connect] [Configure]                   │
│                                           │
│ [+ Install Server] [Marketplace]          │
│                                           │
└───────────────────────────────────────────┘
```

**Features:**
- Server list with status
- Health indicators
- Server actions (restart, configure)
- Marketplace integration
- OAuth status

**Reference:** `dev_MCPIntegration.md`

---

#### Settings Tab
**Component:** `packages/cli/src/ui/components/tabs/SettingsTab.tsx`

**Layout:**
```
┌─ Settings ───────────────────────────────┐
│                                           │
│ Model                                     │
│ [llama3:8b ▼]                            │
│                                           │
│ Context Size                              │
│ [16384 ▼] (2K, 4K, 8K, 16K, 32K, 64K)   │
│                                           │
│ Theme                                     │
│ [default-dark ▼]                         │
│                                           │
│ Provider                                  │
│ [Ollama ▼]                               │
│                                           │
│ [Save] [Reset to Defaults]               │
│                                           │
└───────────────────────────────────────────┘
```

**Features:**
- Model picker
- Context size selector
- Theme picker
- Provider selector
- Keybinds editor (planned)

---

## Status Bar

**Component:** `packages/cli/src/ui/components/layout/StatusBar.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ● Ready | Ctrl+K: Commands | Ctrl+P: Panel | Ctrl+/: Debug     │
└─────────────────────────────────────────────────────────────────┘
```

**Elements:**

| Element | Description |
|---------|-------------|
| Status Indicator | ● Ready / ⏳ Thinking / ⚠️ Error |
| Keybind Hints | Context-sensitive shortcuts |
| Notifications | Temporary messages |

**Status Colors:**
- 🟢 Green - Ready
- 🟡 Yellow - Processing
- 🔴 Red - Error
- 🔵 Blue - Info

---

## Component File Locations

| Component | File Path |
|-----------|-----------|
| App (Root) | `packages/cli/src/ui/App.tsx` |
| SystemBar (Header) | `packages/cli/src/ui/components/layout/SystemBar.tsx` |
| StatusBar | `packages/cli/src/ui/components/layout/StatusBar.tsx` |
| SidePanel | `packages/cli/src/ui/components/layout/SidePanel.tsx` |
| TabBar | `packages/cli/src/ui/components/layout/TabBar.tsx` |
| ChatTab | `packages/cli/src/ui/components/tabs/ChatTab.tsx` |
| ChatHistory | `packages/cli/src/ui/components/chat/ChatHistory.tsx` |
| Message | `packages/cli/src/ui/components/chat/Message.tsx` |
| ChatInputArea | `packages/cli/src/ui/components/layout/ChatInputArea.tsx` |
| ToolsTab | `packages/cli/src/ui/components/tabs/ToolsTab.tsx` |
| HooksTab | `packages/cli/src/ui/components/tabs/HooksTab.tsx` |
| FilesTab | `packages/cli/src/ui/components/tabs/FilesTab.tsx` |
| MCPTab | `packages/cli/src/ui/components/tabs/MCPTab.tsx` |
| SettingsTab | `packages/cli/src/ui/components/tabs/SettingsTab.tsx` |

---

## Responsive Behavior

### Terminal Size Adaptation

**Minimum Size:** 80x24 (columns x rows)  
**Recommended:** 120x40

**Behavior:**
- Side panel auto-hides on narrow terminals (< 100 columns)
- Chat history scrolls on short terminals (< 30 rows)
- Input area shrinks on very short terminals

### Overflow Handling

```css
/* Chat History */
.chat-history {
  overflow-y: auto; /* Vertical scroll */
  overflow-x: hidden; /* No horizontal scroll */
}

/* Side Panel Content */
.tab-content {
  overflow-y: auto; /* Vertical scroll */
  overflow-x: hidden; /* Wrap long lines */
}

/* Input Area */
.input-area {
  overflow-y: auto; /* Scroll if > max-height */
  overflow-x: wrap; /* Wrap long lines */
}
```

---

## Theme Support

**Theme System:** `packages/cli/src/config/styles.ts`

**Customizable Elements:**
- Border colors
- Text colors (primary, secondary, dim)
- Background colors
- Accent colors
- Status colors (success, warning, error, info)

**Built-in Themes:**
- `default-dark` - Dark theme (default)
- `default-light` - Light theme
- `monokai` - Monokai color scheme
- `solarized-dark` - Solarized dark
- `solarized-light` - Solarized light

**User Themes:** `~/.ollm/themes/`

---

## Focus Management

**Focus System:** `packages/cli/src/ui/contexts/FocusContext.tsx`

**Focusable Elements:**
1. Chat Input
2. Side Panel Tabs
3. Side Panel Content
4. File Explorer
5. Dialogs (when open)

**Focus Indicators:**
- Border highlight (theme-dependent)
- Cursor visibility
- Keybind hints update

**Keybinds:**
- `Tab` - Cycle focus forward
- `Shift+Tab` - Cycle focus backward
- `Ctrl+Space` - Focus chat input
- `Ctrl+M` - Focus navigation
- See `dev_Keybinds.md` - "Global Focus Management"

---

## Performance Considerations

### Rendering Optimization

**Ink Rendering:**
- Uses React reconciliation
- Only re-renders changed components
- Efficient terminal updates

**Scroll Performance:**
- Virtual scrolling for long lists (file explorer)
- Message pagination (chat history)
- Lazy loading for large files

### Memory Management

**Chat History:**
- Keep last 100 messages in memory
- Older messages in session storage
- Compression for long conversations

**File Explorer:**
- Lazy load directory contents
- Cache expanded directories
- Unload collapsed directories

---

## Accessibility

**Keyboard Navigation:**
- All features accessible via keyboard
- No mouse required
- Vim-style alternatives available

**Screen Reader Support:**
- ANSI escape codes for formatting
- Text-based UI (no graphics)
- Clear status messages

**Color Blindness:**
- Status indicators use symbols + colors
- High contrast themes available
- Customizable color schemes

---

## Post-Alpha Tasks

### UI Documentation Tasks

**Priority:** Low  
**Effort:** 2-3 days

1. **Create Component Diagrams**
   - Visual component hierarchy
   - Data flow diagrams
   - State management diagrams

2. **Document All Components**
   - Props and types
   - State management
   - Event handlers
   - Examples

3. **Create Style Guide**
   - Component patterns
   - Layout patterns
   - Color usage
   - Typography

4. **Performance Audit**
   - Identify slow components
   - Optimize rendering
   - Reduce re-renders

---

## Notes

- UI is built with React + Ink (terminal rendering)
- All components are functional components with hooks
- State management via React Context
- Theme system supports custom themes
- Focus management for keyboard navigation
- Responsive to terminal size changes
