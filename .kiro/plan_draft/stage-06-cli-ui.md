# Stage 06: CLI and UI

## Overview

Provide a full interactive TUI (React + Ink) with a hybrid layout (tabs + collapsible side panel), a non-interactive runner, and comprehensive status monitoring including GPU/VRAM tracking.

## Prerequisites

- Stage 05b complete (Developer Productivity - Git, @-mentions, Diff Review)

## Estimated Effort

5-6 days

## Tech Stack

- React + Ink for terminal UI
- Commander or yargs for CLI parsing
- nvidia-smi / rocm-smi for GPU monitoring

---

## UI Layout: Hybrid Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [💬 Chat] [🔧 Tools] [📁 Files] [🔍 Search] [📚 Docs] [⚙️ Settings] [Ctrl+P ▢/▣]│
├─────────────────────────────────────────────────────┬───────────────────────────┤
│                                                     │                           │
│                 ACTIVE TAB CONTENT                  │    SIDE PANEL             │
│                                                     │    (Collapsible)          │
│                 (Full width when panel hidden)      │                           │
│                                                     │                           │
├─────────────────────────────────────────────────────┴───────────────────────────┤
│ > _                                                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🟢 llama3.2:3b │ 8.2K/32K │ main +3 │ GPU: 45°C 6.2/8GB │ 2 reviews │ ~$0.02    │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Design Principles

- **Dark Mode Only**: CLI-native dark theme
- **Hybrid Layout**: Tabs for focus, side panel for context
- **GPU Awareness**: VRAM and temperature monitoring
- **Review Integration**: Inline small diffs, Tools tab for large diffs

---

## Unified UI Settings

All UI customization (colors, keybinds, typography) is centralized in a single file that users can override.

**File**: `packages/cli/src/ui/uiSettings.ts`

```typescript
export const defaultUISettings = {
  // ═══════════════════════════════════════════════════════════════════
  // COLOR THEME (Dark Mode)
  // ═══════════════════════════════════════════════════════════════════
  theme: {
    name: 'default-dark',
    
    bg: {
      primary: '#0d1117',
      secondary: '#161b22',
      tertiary: '#21262d',
    },
    
    text: {
      primary: '#c9d1d9',
      secondary: '#8b949e',
      accent: '#58a6ff',
    },
    
    role: {
      user: '#58a6ff',
      assistant: '#7ee787',
      system: '#a371f7',
      tool: '#f0883e',
    },
    
    status: {
      success: '#3fb950',
      warning: '#d29922',
      error: '#f85149',
      info: '#58a6ff',
    },
    
    diff: {
      added: '#2ea043',
      removed: '#f85149',
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // TYPOGRAPHY & SYMBOLS
  // ═══════════════════════════════════════════════════════════════════
  typography: {
    // Text styles
    headers: { bold: true, underline: false },
    code: { dim: false, italic: false },
    emphasis: { bold: true },
    
    // Unicode characters
    bullets: '•',           // '●', '○', '▪', '-'
    checkmark: '✓',         // '✔', '☑', '[x]'
    cross: '✗',             // '✘', '☒', '[x]'
    arrow: '→',             // '>', '=>', '▸'
    
    // Animation/Spinner style
    spinner: 'dots',        // 'dots', 'line', 'arc', 'bounce'
    
    // Box drawing style
    borders: 'round',       // 'round', 'single', 'double', 'bold', 'ascii'
    
    // ─────────────────────────────────────────────────────────────────
    // NOTE: The following cannot be controlled by this app.
    // They are set in your terminal emulator preferences:
    //   • Font family  → Terminal Settings (Fira Code, JetBrains Mono, etc.)
    //   • Font size    → Terminal Settings
    //   • Line height  → Terminal Settings
    // ─────────────────────────────────────────────────────────────────
  },

  // ═══════════════════════════════════════════════════════════════════
  // KEYBINDS
  // ═══════════════════════════════════════════════════════════════════
  keybinds: {
    // Tab navigation
    tabChat: 'ctrl+1',
    tabTools: 'ctrl+2',
    tabFiles: 'ctrl+3',
    tabSearch: 'ctrl+4',
    tabDocs: 'ctrl+5',
    tabSettings: 'ctrl+6',
    
    // Layout
    togglePanel: 'ctrl+p',
    commandPalette: 'ctrl+k',
    toggleDebug: 'ctrl+/',
    
    // Chat
    clearChat: 'ctrl+l',
    saveSession: 'ctrl+s',
    cancel: 'escape',
    send: 'enter',
    newline: 'shift+enter',
    editPrevious: 'up',
    
    // Review
    approve: 'y',
    reject: 'n',
    
    // Navigation (Docs tab)
    scrollDown: 'j',
    scrollUp: 'k',
    select: 'enter',
    back: 'backspace',
    cycleFocus: 'tab',
  },
};

export type UISettings = typeof defaultUISettings;
```

### User Customization: `~/.ollm/ui.yaml`

Users can create custom themes by overriding any setting. The loader **deep-merges** user config over defaults.

```yaml
# ~/.ollm/ui.yaml - Custom UI Settings

theme:
  name: 'my-purple-theme'
  bg:
    primary: '#1a1a2e'
    secondary: '#16213e'
  text:
    accent: '#e94560'
  role:
    assistant: '#00fff5'

typography:
  bullets: '▸'
  borders: 'double'
  spinner: 'arc'

keybinds:
  togglePanel: 'ctrl+b'   # Override default ctrl+p
  approve: 'a'            # Override default 'y'
```

> [!NOTE]
> Font family and size cannot be controlled — those are terminal emulator settings.

### Built-in Themes

Pre-defined themes available for quick switching via Settings tab or `/theme` command:

```typescript
export const builtInThemes: Record<string, Theme> = {
  'default-dark': {
    bg: { primary: '#0d1117', secondary: '#161b22', tertiary: '#21262d' },
    text: { primary: '#c9d1d9', secondary: '#8b949e', accent: '#58a6ff' },
    role: { user: '#58a6ff', assistant: '#7ee787', system: '#a371f7', tool: '#f0883e' },
    status: { success: '#3fb950', warning: '#d29922', error: '#f85149', info: '#58a6ff' },
    diff: { added: '#2ea043', removed: '#f85149' },
  },
  'dracula': {
    bg: { primary: '#282a36', secondary: '#44475a', tertiary: '#6272a4' },
    text: { primary: '#f8f8f2', secondary: '#6272a4', accent: '#bd93f9' },
    role: { user: '#8be9fd', assistant: '#50fa7b', system: '#bd93f9', tool: '#ffb86c' },
    status: { success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555', info: '#8be9fd' },
    diff: { added: '#50fa7b', removed: '#ff5555' },
  },
  'nord': {
    bg: { primary: '#2e3440', secondary: '#3b4252', tertiary: '#434c5e' },
    text: { primary: '#eceff4', secondary: '#d8dee9', accent: '#88c0d0' },
    role: { user: '#81a1c1', assistant: '#a3be8c', system: '#b48ead', tool: '#ebcb8b' },
    status: { success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a', info: '#81a1c1' },
    diff: { added: '#a3be8c', removed: '#bf616a' },
  },
  'monokai': {
    bg: { primary: '#272822', secondary: '#3e3d32', tertiary: '#49483e' },
    text: { primary: '#f8f8f2', secondary: '#75715e', accent: '#66d9ef' },
    role: { user: '#66d9ef', assistant: '#a6e22e', system: '#ae81ff', tool: '#fd971f' },
    status: { success: '#a6e22e', warning: '#e6db74', error: '#f92672', info: '#66d9ef' },
    diff: { added: '#a6e22e', removed: '#f92672' },
  },
  'solarized-dark': {
    bg: { primary: '#002b36', secondary: '#073642', tertiary: '#586e75' },
    text: { primary: '#839496', secondary: '#657b83', accent: '#268bd2' },
    role: { user: '#268bd2', assistant: '#859900', system: '#6c71c4', tool: '#cb4b16' },
    status: { success: '#859900', warning: '#b58900', error: '#dc322f', info: '#268bd2' },
    diff: { added: '#859900', removed: '#dc322f' },
  },
};

export type ThemeName = keyof typeof builtInThemes;
```

---

## CLI Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--prompt` | `-p` | One-shot prompt (non-interactive) |
| `--model` | `-m` | Select model |
| `--provider` | | Select provider |
| `--host` | | Provider endpoint URL |
| `--list-models` | | List available models |
| `--pull-model <name>` | | Pull/download a model |
| `--remove-model <name>` | | Remove a model |
| `--model-info <name>` | | Show model details |
| `--output` | `-o` | Output format: text, json, stream-json |
| `--review-diffs` | | Enable diff review mode |
| `--no-review` | | Disable diff review mode |
| `--debug` | | Enable debug output |
| `--no-color` | | Disable colored output |
| `--config` | `-c` | Config file path |
| `--session` | `-s` | Resume session by ID |
| `--version` | `-v` | Show version |
| `--help` | `-h` | Show help |

---

## Slash Commands (Interactive Mode)

| Command | Description |
|---------|-------------|
| `/model list` | List available models |
| `/model use <name>` | Switch to model |
| `/model pull <name>` | Download model |
| `/model rm <name>` | Remove model |
| `/model info <name>` | Show model details |
| `/provider list` | List providers |
| `/provider use <name>` | Switch provider |
| `/session list` | List saved sessions |
| `/session resume <id>` | Resume session |
| `/session delete <id>` | Delete session |
| `/session save` | Save current session |
| `/session export` | Export as markdown |
| `/git status` | Show git status |
| `/git commit [message]` | Commit changes |
| `/git undo` | Undo last change |
| `/review enable` | Enable diff review |
| `/review disable` | Disable diff review |
| `/review pending` | Show pending reviews |
| `/extensions list` | List extensions |
| `/extensions enable <name>` | Enable extension |
| `/extensions disable <name>` | Disable extension |
| `/theme list` | List available themes |
| `/theme use <name>` | Switch to theme |
| `/theme preview <name>` | Preview theme without saving |
| `/context` | Show context status |
| `/new` | Start new session (save current, clear all) |
| `/clear` | Clear context, keep system prompt |
| `/compact` | Manual context compression |
| `/metrics` | Show session performance stats |
| `/metrics toggle` | Toggle metrics display |
| `/metrics reset` | Reset session statistics |
| `/reasoning toggle` | Toggle reasoning display |
| `/reasoning expand` | Expand all reasoning blocks |
| `/reasoning collapse` | Collapse all reasoning blocks |
| `/help` | Show commands |
| `/exit` | Exit CLI |

---

## Tasks

### S06-T01: CLI Config Loader

**Steps**:
1. Implement layered settings resolution:
   - System defaults
   - User config (`~/.ollm/config.yaml`)
   - Workspace config (`.ollm/config.yaml`)
   - Environment variables
   - CLI flags (highest priority)
2. Create JSON schema for validation
3. Implement config loader with YAML/JSON parsing
4. Error reporting for invalid configs

**Deliverables**:
- `packages/cli/src/config/configLoader.ts`
- `packages/cli/src/config/configSchema.ts`
- `schemas/settings.schema.json`

**Acceptance Criteria**:
- [ ] Settings merge deterministically
- [ ] Invalid configs show clear errors
- [ ] All layers are respected

---

### S06-T02: GPU Monitor Service

**Goal**: Track GPU temperature and VRAM usage for status bar.

**Steps**:
1. Create `packages/core/src/services/gpuMonitor.ts`:

```typescript
interface GPUInfo {
  available: boolean;
  vendor: 'nvidia' | 'amd' | 'apple' | 'cpu';
  vramTotal: number;
  vramUsed: number;
  vramFree: number;
  temperature: number;
  temperatureMax: number;
  gpuUtilization: number;
}

interface GPUMonitor {
  getInfo(): Promise<GPUInfo>;
  startPolling(intervalMs: number): void;
  stopPolling(): void;
  onUpdate(callback: (info: GPUInfo) => void): void;
  onHighTemp(threshold: number, callback: () => void): void;
  onLowVRAM(threshold: number, callback: () => void): void;
}
```

2. Implement platform-specific queries:
   - NVIDIA: `nvidia-smi --query-gpu=...`
   - AMD: `rocm-smi`
   - Apple: `ioreg` or fallback
   - CPU: Show "CPU mode"

3. Poll every 5 seconds during active inference

**Deliverables**:
- `packages/core/src/services/gpuMonitor.ts`
- `packages/core/src/services/__tests__/gpuMonitor.test.ts`

**Acceptance Criteria**:
- [ ] GPU temp and VRAM shown in status bar
- [ ] Works on NVIDIA, AMD, Apple Silicon
- [ ] Falls back gracefully to "CPU mode"
- [ ] High temp warning at 80°C

---

### S06-T03: Non-Interactive Runner

**Steps**:
1. Implement `packages/cli/src/nonInteractive.ts`:
   - Parse `--prompt` flag
   - Run single turn
   - Output result and exit
2. Support output formats:
   - `text`: Plain text output
   - `json`: JSON object with response
   - `stream-json`: NDJSON stream of events
3. Handle errors with proper exit codes
4. Support piped input

**Deliverables**:
- `packages/cli/src/nonInteractive.ts`

**Acceptance Criteria**:
- [ ] `ollm -p "hello"` prints output and exits cleanly
- [ ] JSON output is valid
- [ ] Errors go to stderr with proper exit codes

---

### S06-T04: Tab Bar and Navigation

**Steps**:
1. Implement TabBar component with 6 tabs:
   - 💬 Chat (Ctrl+1)
   - 🔧 Tools (Ctrl+2)
   - 📁 Files (Ctrl+3)
   - 🔍 Search (Ctrl+4)
   - 📚 Docs (Ctrl+5)
   - ⚙️ Settings (Ctrl+6)
2. Support keyboard navigation
3. Show notification badges on tabs
4. Implement tab switching with state preservation

**Deliverables**:
- `packages/cli/src/ui/components/layout/TabBar.tsx`
- `packages/cli/src/ui/contexts/UIContext.tsx`

**Acceptance Criteria**:
- [ ] Tabs switch correctly
- [ ] Keyboard shortcuts work
- [ ] Badges show counts (reviews, tools)
- [ ] State preserved when switching

---

### S06-T05: Side Panel (Collapsible)

**Steps**:
1. Implement collapsible side panel (Ctrl+P toggle)
2. Panel sections:
   - Context Files (@-mentioned files)
   - Git Status (branch, changes)
   - Pending Reviews (diff count)
   - Active Tools (running tools)
3. Auto-show on relevant actions
4. Persist visibility preference

**Deliverables**:
- `packages/cli/src/ui/components/layout/SidePanel.tsx`
- `packages/cli/src/ui/components/panel/ContextSection.tsx`
- `packages/cli/src/ui/components/panel/GitSection.tsx`
- `packages/cli/src/ui/components/panel/ReviewSection.tsx`
- `packages/cli/src/ui/components/panel/ToolsSection.tsx`

**Acceptance Criteria**:
- [ ] Panel toggles with Ctrl+P
- [ ] Sections collapse/expand
- [ ] Auto-updates on changes
- [ ] Full width when hidden

---

### S06-T06: Status Bar

**Steps**:
1. Implement status bar with components:
   - Provider connection status (🟢🟡🔴)
   - Model name
   - Token usage (current/max)
   - Git status (branch +staged ~modified)
   - GPU temperature and VRAM
   - Pending reviews count
   - Session cost estimate
2. Update in real-time
3. Click/select sections for details

**Status Bar Format**:
```
🟢 llama3.2:3b │ 8.2K/32K │ main +3 │ GPU: 45°C 6.2/8GB │ 2 reviews │ ~$0.02
```

**Deliverables**:
- `packages/cli/src/ui/components/layout/StatusBar.tsx`

**Acceptance Criteria**:
- [ ] All components update in real-time
- [ ] GPU info shows when available
- [ ] Falls back to "CPU mode" gracefully
- [ ] Color-coded connection status

---

### S06-T07: Chat Tab (Main Interface)

**Steps**:
1. Implement ChatHistory with message display
2. **Implement Llama "Thinking" Animation**:
   - **Trigger**: Show only during state `WAITING_FOR_RESPONSE` (after user input, before 1st token).
  - **Component**: Use `LlamaAnimation` (Size: `small`) from `packages/cli/src/components/lama/LlamaAnimation.tsx`.
  - **Scripts**: Reference `packages/cli/src/components/lama/reference/` (mirrored at `.dev/reference/lama/reference/`) for usage examples (legacy helpers).
   - **Layout constraint**: When user submits input, **scroll ChatHistory up by ~20 lines**. This ensures the animation (especially `small` at 12 lines) has a clean stage without being truncated, while remaining more compact than the previous 25-line requirement.
   - **Transition**: Unmount immediately when `STREAMING` starts.
3. Implement InputBox with multi-line support
4. Streaming text display with spinner
5. Tool call display with arguments
6. Inline diff review for small changes (≤5 lines)

**Tool Call Display**:
```
🔧 read_file ✓                                                     0.12s
┌──────────────────────────────────────────────────────────────────────┐
│ path: "src/auth/login.ts"                                            │
│ Result: 245 lines (4.2KB)                                            │
└──────────────────────────────────────────────────────────────────────┘
```

**Long Arguments (wrap at 80 chars)**:
```
│ content: "import { validateToken } from '../utils/token';\nimport..." │
│          ↳ (2,847 characters) [Expand]                               │
```

**Streaming Indicator**:
```
⠋ Thinking...   (spinner frames: ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏, 80ms cycle)
```

**Deliverables**:
- `packages/cli/src/ui/components/chat/ChatHistory.tsx`
- `packages/cli/src/ui/components/chat/Message.tsx`
- `packages/cli/src/ui/components/chat/ToolCall.tsx`
- `packages/cli/src/ui/components/chat/StreamingIndicator.tsx`
- `packages/cli/src/ui/components/layout/InputBox.tsx`

**Acceptance Criteria**:
- [ ] Messages display with role colors
- [ ] Streaming text renders incrementally
- [ ] Tool calls show name + args + result
- [ ] Long args wrapped with expand option
- [ ] Spinner shows during generation

---

### S06-T08: Tools Tab (Diff Review)

**Steps**:
1. Tool execution history list
2. Full diff viewer for pending reviews
3. Batch approve/reject actions
4. Expand/collapse tool details

**Layout**:
```
┌─ Pending Reviews (2) ─────────────────────────────────────────────────────┐
│ 📄 src/auth/login.ts                                        +1 -1 lines │
│ [Diff Preview]                                                           │
│ [✓ Apply] [✗ Reject] [✎ Edit]                                           │
│                                                                          │
│ 📄 src/utils/token.ts                                      +12 -3 lines │
│ [Expand to view diff]                                                    │
└──────────────────────────────────────────────────────────────────────────┘
[Apply All (2)] [Reject All]
```

**Deliverables**:
- `packages/cli/src/ui/tabs/ToolsTab.tsx`
- `packages/cli/src/ui/components/review/DiffViewer.tsx`
- `packages/cli/src/ui/components/review/ReviewActions.tsx`

**Acceptance Criteria**:
- [ ] Pending reviews listed
- [ ] Full diffs viewable
- [ ] Apply/reject works
- [ ] Batch actions work

---

### S06-T09: Files Tab

**Steps**:
1. Context files list (@-mentioned)
2. Git status display
3. Add/remove files from context
4. Quick git actions (commit, stash, diff)

**Deliverables**:
- `packages/cli/src/ui/tabs/FilesTab.tsx`

**Acceptance Criteria**:
- [ ] Context files listed
- [ ] Git status accurate
- [ ] Can add/remove context files

---

### S06-T10: Search Tab (Stage 11 Integration)

**Steps**:
1. Semantic search input
2. Results with code snippets
3. Add results to context
4. Filter by file type

**Note**: Full implementation in Stage 11 (Codebase RAG). Basic UI scaffold here.

**Deliverables**:
- `packages/cli/src/ui/tabs/SearchTab.tsx`

---

### S06-T11: Settings Tab

**Steps**:
1. Model picker with details
2. Provider selection
3. **Theme picker with built-in themes**
4. Session info (tokens, duration, cost)
5. Options (temperature, max tokens, review mode)
6. Quick actions (save, export, clear)

**Theme Picker Layout**:
```
┌─ 🎨 Theme ─────────────────────────────────────────────────────────────────┐
│  ● Default Dark                                                            │
│  ○ Dracula                                                                 │
│  ○ Nord                                                                    │
│  ○ Monokai                                                                 │
│  ○ Solarized Dark                                                          │
│  ○ Custom (ui.yaml)                                                        │
└────────────────────────────────────────────────────────────────────────────┘
[Changes apply immediately]
```

**Deliverables**:
- `packages/cli/src/ui/tabs/SettingsTab.tsx`
- `packages/cli/src/ui/components/settings/ModelPicker.tsx`
- `packages/cli/src/ui/components/settings/ThemePicker.tsx`
- `packages/cli/src/ui/components/settings/SessionInfo.tsx`

**Acceptance Criteria**:
- [ ] Model switching works
- [ ] Theme switching works instantly
- [ ] Custom theme shows if ui.yaml exists
- [ ] Session stats accurate
- [ ] Options update in real-time

---

### S06-T12: Docs Tab

**Goal**: Provide in-app documentation browser with navigation.

**Steps**:
1. Create documentation index from `docs/` folder
2. Render markdown files in terminal
3. Side panel shows document titles for navigation
4. Support internal links between docs
5. Keyboard navigation (j/k scroll, Enter to select)

**Layout**:
```
┌─ [📚 Docs] ─────────────────────────────────────────┬───────────────────────┐
│                                                     │ 📑 Documentation      │
│  # Getting Started                                  │                       │
│                                                     │ ► Getting Started     │
│  Welcome to OLLM CLI! This guide will help you     │   Architecture        │
│  get up and running quickly.                        │   Configuration       │
│                                                     │   Commands            │
│  ## Installation                                    │   Provider Systems    │
│                                                     │   UI Design           │
│  ```bash                                            │   Feature Analysis    │
│  npm install -g @ollm/cli                           │                       │
│  ```                                                │ [↑/↓] Navigate        │
│                                                     │ [Enter] Open          │
│  ## Quick Start                                     │ [Backspace] Back      │
│  ...                                                │                       │
└─────────────────────────────────────────────────────┴───────────────────────┘
```

**Documentation Index**:
```typescript
interface DocEntry {
  title: string;
  path: string;
  description?: string;
  children?: DocEntry[];
}

const docsIndex: DocEntry[] = [
  { title: 'Getting Started', path: 'docs/README.md' },
  { title: 'Architecture', path: 'docs/architecture.md' },
  { title: 'Configuration', path: 'docs/configuration.md' },
  { title: 'Commands', path: 'docs/commands.md' },
  { title: 'Provider Systems', path: 'docs/provider-systems.md' },
  { title: 'UI Design', path: 'docs/ui-design-spec.md' },
  { title: 'Feature Analysis', path: 'docs/feature-analysis.md' },
];
```

**Deliverables**:
- `packages/cli/src/ui/tabs/DocsTab.tsx`
- `packages/cli/src/ui/components/docs/DocViewer.tsx`
- `packages/cli/src/ui/components/docs/DocNav.tsx`
- `packages/cli/src/services/docsService.ts`

**Acceptance Criteria**:
- [ ] Docs listed in side panel
- [ ] Markdown renders in terminal
- [ ] Navigation between docs works
- [ ] Internal links work
- [ ] Keyboard shortcuts work

---

### S06-T13: Launch Screen (Llama Brand)

**Goal**: Display the animated Llama logo and branded version info on startup.

**Steps**:
1. **Logo Component**: Use `LlamaAnimation` with `size="standard"`.
2. **Display Branded Block**: 
   - Show the version banner using a centered border box:
     ```
     ======================================================
     
              ┌───────────────────────────┐
              │       OLLM CLI V0.1       │
              └───────────────────────────┘
     
     ======================================================
     ```
3. **Quick Help**: Display documentation links:
   - `Documentation: /docs`
   - `For commands use: /help`
4. Show version, quick tips, and recent sessions.
5. Dismiss on any keypress or input.
6. Add `/home` command to return to launch screen.

**Launch Screen Layout**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                [LLAMA ANIMATION]                            │
│                                (Size: Standard)                             │
│                                                                             │
│   ========================================================================  │
│                                                                             │
│                        ┌───────────────────────────┐                        │
│                        │       OLLM CLI V0.1       │                        │
│                        └───────────────────────────┘                        │
│                                                                             │
│                                                                             │
│                                                                             │
│  Welcome to your local LLM Assistant.                                       │
│                                                                             │
│  Documentation: /docs                                                       │
│  For commands use: /help                                                    │
│                                                                             │
│  ┌─ Quick Actions ─────────────────────────────────────────────────────┐    │
│  │  [Enter] Start chatting    [Ctrl+5] View docs    [Ctrl+6] Settings  │    │
│  │  [/] Commands              [?] Help              [Esc] Quit         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─ Recent Sessions ────────────────────────────────────────────────────┐   │
│  │  1. "Fixing auth bug" - 2 hours ago                                  │   │
│  │  2. "Refactoring utils" - yesterday                                  │   │
│  │  3. "New feature planning" - 3 days ago                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                    Press any key to start...                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
interface LaunchScreenProps {
  version: string;
  recentSessions: Session[];
  onDismiss: () => void;
}

// Logic: Use LlamaAnimation (Standard) as the centered hero element.
// No longer needs docs/OLLM_v01.txt loading.
```

**Deliverables**:
- `packages/cli/src/ui/components/LaunchScreen.tsx`
- `packages/cli/src/ui/components/RecentSessions.tsx`

**Acceptance Criteria**:
- [x] Llama Animation displays centered on launch
- [x] Version banner matches specified aesthetic
- [x] Documentation /help hints shown
- [x] Recent sessions listed
- [x] Any keypress dismisses to Chat tab
- [x] `/home` command returns to launch screen

---

### S06-T21: Conversation Branching

**Goal**: Fork a conversation at any point to explore different directions without losing the original thread.

**Steps**:
1. Implement `BranchingService`:
   - `createBranch(messageId, prompt): Branch`
   - `listBranches(): Branch[]`
   - `switchBranch(branchId): void`
   - Store branches as session variants
2. UI Components:
   - Branch indicator in message timeline
   - Branch switcher dropdown
   - Visual tree view of conversation branches
3. Slash commands:
   ```
   /branch "Alternative approach..."  # Branch from last message
   /branch list                       # Show all branches
   /branch switch <id>                # Switch to branch
   /branch merge <id>                 # Merge branch into main
   ```

**Deliverables**:
- `packages/core/src/services/branchingService.ts`
- `packages/cli/src/ui/components/chat/BranchIndicator.tsx`
- `packages/cli/src/ui/components/chat/BranchSwitcher.tsx`

**Acceptance Criteria**:
- [ ] `/branch` creates new conversation fork
- [ ] Branches preserved in session
- [ ] Can switch between branches
- [ ] Visual indicator shows active branch

---

### S06-T22: Smart Model Suggestions

**Goal**: Suggest switching to a more appropriate model based on message content.

**Steps**:
1. Implement `ModelSuggestionService`:
   - Detect code blocks and suggest code models
   - Detect creative writing patterns
   - Detect technical questions
2. Non-intrusive suggestion UI:
   ```
   💡 Tip: You shared Python code. Switch to deepseek-coder? [Y/n/Never]
   ```
3. Configuration:
   ```yaml
   ui:
     suggestions:
       enabled: true
       showOnce: true  # Don't repeat same suggestion
       triggers:
         code: [deepseek-coder, codellama]
         creative: [llama3.1:70b]
   ```
4. Respect "Never" dismissals in memory

**Deliverables**:
- `packages/core/src/services/modelSuggestionService.ts`
- `packages/cli/src/ui/components/chat/SuggestionBanner.tsx`

**Acceptance Criteria**:
- [ ] Code detection triggers code model suggestion
- [ ] Suggestion is non-blocking
- [ ] User can accept, dismiss, or disable
- [ ] Dismissed suggestions remembered

---

### S06-T23: Response Quality Feedback

**Goal**: Allow users to rate responses to build local preference data.

**Steps**:
1. Implement `FeedbackService`:
   - `recordFeedback(messageId, rating, reason?): void`
   - `getFeedbackStats(): FeedbackStats`
   - Store in `~/.ollm/feedback.json`
2. Quick feedback buttons after each response:
   ```
   [👍 Good] [👎 Bad] [🔄 Retry with different model]
   ```
3. Optional feedback details on thumbs down
4. Use feedback to adjust model routing weights

**Deliverables**:
- `packages/core/src/services/feedbackService.ts`
- `packages/cli/src/ui/components/chat/FeedbackButtons.tsx`

**Acceptance Criteria**:
- [ ] Feedback buttons appear after responses
- [ ] Feedback persisted to file
- [ ] Retry option uses alternative model
- [ ] Stats viewable via `/feedback stats`

---

### S06-T24: Syntax Highlighting in Diffs

**Goal**: Apply language-aware syntax highlighting to diff previews.

**Steps**:
1. Integrate syntax highlighting library (e.g., `prism` or `shiki`)
2. Detect file language from extension
3. Apply highlighting to:
   - Diff viewer in Tools tab
   - Inline diff previews in chat
   - Code blocks in assistant responses
4. Theme-aware color mapping

**Deliverables**:
- `packages/cli/src/ui/components/code/SyntaxHighlighter.tsx`
- Updated `packages/cli/src/ui/components/review/DiffViewer.tsx`

**Acceptance Criteria**:
- [ ] Diffs show syntax-highlighted code
- [ ] Language auto-detected from filename
- [ ] Colors match active theme
- [ ] Performance acceptable for large diffs

---

### S06-T25: Command History with Search

**Goal**: Searchable history of past prompts and commands across sessions.

**Steps**:
1. Implement `HistoryService`:
   - Record all user inputs
   - Persist to `~/.ollm/history.json`
   - Limit to last 1000 entries
2. Search functionality:
   - Fuzzy matching
   - Date filtering
   - Session filtering
3. Slash commands:
   ```
   /history                    # Show recent history
   /history search "keyword"   # Search history
   /history clear              # Clear history
   ```
4. UI: `↑` arrow cycles through history in input box

**Deliverables**:
- `packages/core/src/services/historyService.ts`
- `packages/cli/src/commands/historyCommands.ts`

**Acceptance Criteria**:
- [ ] History persisted across sessions
- [ ] `/history search` finds matching commands
- [ ] Arrow up/down cycles history in input
- [ ] History respects max limit

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1-6` | Switch tabs (Chat, Tools, Files, Search, Docs, Settings) |
| `Ctrl+P` | Toggle side panel |
| `Ctrl+L` | Clear chat |
| `Ctrl+S` | Save session |
| `Ctrl+K` | Command palette |
| `Ctrl+/` | Toggle debug |
| `Esc` | Cancel / Return to input |
| `↑` | Previous message (edit) |
| `Enter` | Send message / Start chat (on launch screen) |
| `Shift+Enter` | Newline in input |
| `y` / `n` | Approve / Reject (in review) |
| `j` / `k` | Scroll down / up (in Docs tab) |
| `Tab` | Cycle focus |

---

## File Structure After Stage 06

```
packages/cli/src/
├── cli.tsx                       # Main entry
├── nonInteractive.ts             # Non-interactive runner
├── config/
│   ├── configLoader.ts
│   └── configSchema.ts
├── commands/
│   ├── slashCommands.ts
│   └── modelCommands.ts
└── ui/
    ├── App.tsx
    ├── uiSettings.ts             # Unified theme, keybinds, typography
    ├── contexts/
    │   ├── ChatContext.tsx
    │   ├── UIContext.tsx
    │   ├── GPUContext.tsx        # NEW
    │   └── ReviewContext.tsx     # NEW
    ├── components/
    │   ├── layout/
    │   │   ├── TabBar.tsx
    │   │   ├── SidePanel.tsx
    │   │   ├── StatusBar.tsx
    │   │   └── InputBox.tsx
    │   ├── chat/
    │   │   ├── ChatHistory.tsx
    │   │   ├── Message.tsx
    │   │   ├── ToolCall.tsx
    │   │   └── StreamingIndicator.tsx
    │   ├── review/
    │   │   ├── DiffViewer.tsx
    │   │   ├── InlineDiff.tsx
    │   │   └── ReviewActions.tsx
    │   ├── panel/
    │   │   ├── ContextSection.tsx
    │   │   ├── GitSection.tsx
    │   │   ├── ReviewSection.tsx
    │   │   └── ToolsSection.tsx
    │   ├── settings/
    │   │   ├── ModelPicker.tsx
    │   │   └── SessionInfo.tsx
    │   ├── docs/                     # NEW
    │   │   ├── DocViewer.tsx
    │   │   └── DocNav.tsx
    │   ├── LaunchScreen.tsx          # NEW
    │   ├── RecentSessions.tsx        # NEW
    │   └── common/
    │       ├── Spinner.tsx
    │       ├── Badge.tsx
    │       └── Collapsible.tsx
    ├── tabs/
    │   ├── ChatTab.tsx
    │   ├── ToolsTab.tsx
    │   ├── FilesTab.tsx
    │   ├── SearchTab.tsx
    │   ├── DocsTab.tsx               # NEW
    │   └── SettingsTab.tsx
    ├── services/
    │   └── docsService.ts            # NEW
    └── animations/
        ├── spinner.ts
        └── llama.ts              # Implemented (Activity Indicator)

packages/core/src/services/
└── gpuMonitor.ts                 # NEW

schemas/
└── settings.schema.json

assets/
└── OLLM_v01.txt                  # ASCII art logo
```

---

## Configuration

```yaml
# ~/.ollm/config.yaml - Runtime Settings

ui:
  layout: hybrid              # hybrid | simple
  sidePanel: true             # Show side panel by default
  showGpuStats: true          # Show GPU in status bar
  showCost: true              # Show session cost
  
  metrics:
    enabled: true              # Show metrics under responses
    compactMode: false         # Use compact single-line format
    showPromptTokens: true     # Show input token count (📥)
    showTTFT: true             # Show time to first token
    showInStatusBar: true      # Show average t/s in status bar

  reasoning:
    enabled: true                # Show reasoning blocks
    maxVisibleLines: 8           # Height before scrolling
    autoCollapseOnComplete: true # Collapse when response finishes

status:
  pollInterval: 5000          # GPU poll interval (ms)
  highTempThreshold: 80       # Warn at this temp
  lowVramThreshold: 512       # Warn at this MB

shortcuts:
  toggleMetrics: 'ctrl+m'
  toggleReasoning: 'ctrl+r'
```

> [!TIP]
> For theme colors, keybinds, and typography customization, see `~/.ollm/ui.yaml` (defined in [Unified UI Settings](#unified-ui-settings) section).

---

## Verification Checklist

### Core UI
- [ ] Config loads from all layers
- [ ] Config validation shows clear errors
- [ ] Non-interactive mode works with `-p`
- [ ] All output formats work correctly

### GPU & Status
- [ ] GPU monitoring works (NVIDIA, AMD, fallback)
- [ ] Status bar shows: model, tokens, t/s, GPU, git, cost

### Layout
- [ ] Tab bar switches correctly (6 tabs)
- [ ] Side panel toggles with Ctrl+P
- [ ] Side panel shows ACTIVITY section
- [ ] Input box has border
- [ ] Keyboard shortcuts work

### S06-B02: Fix Terminal Flickering in Full Screen
- [x] Reduce main container height by 1 row to prevent scroll triggers
- [x] Memoize high-frequency components (`HeaderBar`, `StatusBar`)
- [x] Enable Ink's `alternateBuffer: true`
- [x] Verified fix on Windows Terminal in full screen mode

### S06-B03: Optimize GPU Polling
- [ ] Implement adaptive polling (slower when idle)
- [ ] Memoize GPU stats components
- [ ] Ensure cleanup on exit

### Chat
- [ ] Chat history displays messages
- [ ] Tool calls show with args
- [ ] Diff review in Tools tab works
- [ ] Model picker works
- [ ] Session stats update

### Activity Indicators
- [x] Llama animation shows during waiting
- [x] Llama bounces left-to-right and back
- [x] Llama uses pixel art images (or fallback emoji)
- [ ] Spinner shows in side panel during streaming
- [ ] Spinner shows during tool execution
- [ ] Activity panel shows token count and speed

---

## Cross-References

- [UI Design Spec](../../docs/ui-design-spec.md) - Detailed UI specifications
- [Llama Animation Guide](../../docs/llama_animation.md) - Pixel art creation guide
- [UI Settings Guide](../../docs/UI_settings.md) - Theme and customization guide
- [Commands Reference](../../docs/commands.md) - All slash commands

---

# Part 2: Performance Metrics & Reasoning Display

## Overview

Enhance the chat interface with:
1. **Performance Metrics** - Real-time inference speed (t/s) under each response
2. **Reasoning Display** - Nested scrollable box for `<think>` content from reasoning models

## Tech Stack

- React + Ink for UI components
- Provider response metadata extraction
- Token counter integration from Stage 04b

---

## Feature: Per-Response Performance Metrics

### Display Format

Each LLM response shows performance metrics below the message content:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Assistant                                                         3:42 PM  │
│                                                                            │
│ I found the issue in your login handler. The token validation was         │
│ being skipped when the Authorization header was present but empty.        │
│ Here's the fix...                                                          │
│                                                                            │
│ ──────────────────────────────────────────────────────────────────────────│
│ ⚡ 42.3 t/s │ 📥 847 tokens │ 📤 156 tokens │ ⏱️ 3.68s │ TTFT: 0.12s     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Metrics Displayed

| Metric | Symbol | Description | Source |
|--------|--------|-------------|--------|
| **Generation Speed** | ⚡ | Tokens generated per second | `eval_count / eval_duration` |
| **Input Tokens** | 📥 | Tokens in prompt (context) | `prompt_eval_count` or Token Counter |
| **Output Tokens** | 📤 | Tokens generated in response | `eval_count` or Token Counter |
| **Total Time** | ⏱️ | End-to-end generation time | `total_duration` |
| **Time to First Token** | TTFT | Latency before first token | `prompt_eval_duration` or measured |

### Compact Mode (Configurable)

For less verbose display:

```
│ ⚡ 42.3 t/s │ 156 tokens │ 3.68s                                          │
```

---

## Data Sources

### Ollama Response Metadata

Ollama API returns timing information in response:

```json
{
  "model": "llama3.2:3b",
  "response": "...",
  "done": true,
  "total_duration": 3684129000,
  "load_duration": 12345678,
  "prompt_eval_count": 847,
  "prompt_eval_duration": 120000000,
  "eval_count": 156,
  "eval_duration": 3680000000
}
```

### Calculated Metrics

```typescript
interface InferenceMetrics {
  // Raw values from provider
  promptTokens: number;        // Input/context tokens
  completionTokens: number;    // Generated tokens  
  totalDuration: number;       // Total time in nanoseconds
  promptDuration: number;      // Time to process prompt (TTFT)
  evalDuration: number;        // Time to generate tokens
  
  // Calculated values
  tokensPerSecond: number;     // eval_count / (eval_duration / 1e9)
  timeToFirstToken: number;    // promptDuration in seconds
  totalSeconds: number;        // totalDuration / 1e9
  
  // Optional (provider-specific)
  loadDuration?: number;       // Model load time if applicable
}
```

---

## Feature: Reasoning Model Display

Display thinking process from reasoning models (DeepSeek-R1, Qwen3, QwQ) in a nested scrollable box.

### Expanded State (During Streaming)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Assistant                                                         3:42 PM  │
│                                                                            │
│ ┌─ 🧠 Reasoning ──────────────────────────────────── [▼ Collapse] ───────┐ │
│ │ Let me analyze this step by step...                                  ↑ │ │
│ │                                                                      │ │ │
│ │ First, I need to understand the problem:                             │ │ │
│ │ - The user wants to fix a login bug                                  │ │ │
│ │ - The token validation is being skipped                              ░ │ │
│ │                                                                      │ │ │
│ │ Key insight: The condition checks if token exists,                   │ │ │
│ │ but doesn't validate the token itself...                             ↓ │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ ⠋ Generating response...                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### Collapsed State (After Complete)

```
│ ┌─ 🧠 Reasoning (847 tokens, 12.3s) ─────────────────── [▶ Expand] ──────┐ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ I found the issue. The token validation was being skipped when...        │
└────────────────────────────────────────────────────────────────────────────┘
```

### Behavior

| State | Behavior |
|-------|----------|
| **Streaming** | Expanded, auto-scrolls to follow content |
| **Complete** | Auto-collapses, shows token count and duration |
| **User Toggle** | Manual expand/collapse via button or `Ctrl+R` |

### Supported Models

- DeepSeek-R1 (all sizes)
- Qwen3 (in thinking mode)
- QwQ
- Any model outputting `<think>...</think>` blocks

---

## Session Statistics Panel

Add detailed stats to Settings tab:

```
┌─ Session Performance ──────────────────────────────────────────────────────┐
│                                                                            │
│  Total Generations:     15                                                 │
│  Total Tokens:          2,847 (1,234 prompt + 1,613 completion)           │
│  Total Time:            42.3s                                              │
│                                                                            │
│  Average Speed:         38.1 t/s                                           │
│  Fastest:               52.3 t/s                                           │
│  Slowest:               12.8 t/s                                           │
│                                                                            │
│  Average TTFT:          0.15s                                              │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Performance Metrics Tasks

### S06-T14: Inference Metrics Types

**Steps**:
1. Create `packages/core/src/types/metrics.ts`
2. Define `InferenceMetrics`, `SessionStats`, `MetricsConfig` interfaces
3. Add provider-specific response metadata types

**Deliverables**:
- `packages/core/src/types/metrics.ts`

**Acceptance Criteria**:
- [ ] All metric types defined
- [ ] Provider metadata types included

---

### S06-T15: Metrics Collector Service

**Steps**:
1. Create `packages/core/src/services/metricsCollector.ts`
2. Implement generation tracking (start, first token, complete)
3. Add session statistics aggregation
4. Integrate with context management token counter

**Deliverables**:
- `packages/core/src/services/metricsCollector.ts`
- `packages/core/src/services/__tests__/metricsCollector.test.ts`

**Acceptance Criteria**:
- [ ] Tracks generation timing accurately
- [ ] Calculates tokens per second correctly
- [ ] Aggregates session statistics
- [ ] Falls back to estimation when provider data unavailable

---

### S06-T16: MetricsDisplay UI Component

**Steps**:
1. Create `packages/cli/src/ui/components/chat/MetricsDisplay.tsx`
2. Implement full and compact display modes
3. Apply theme colors and formatting
4. Add toggle visibility support

**Deliverables**:
- `packages/cli/src/ui/components/chat/MetricsDisplay.tsx`

**Acceptance Criteria**:
- [ ] Displays all metrics correctly
- [ ] Compact mode works
- [ ] Theme applied correctly
- [ ] Toggle visibility works

---

### S06-T17: Session Commands (/new, /clear, /compact)

**Steps**:
1. Create `packages/cli/src/commands/sessionCommands.ts`
2. Implement `/new` command with confirmation and snapshot
3. Implement `/clear` command (preserve system prompt)
4. Implement `/compact` command (trigger compression, show stats)
5. Register commands in slash command handler

**Deliverables**:
- `packages/cli/src/commands/sessionCommands.ts`

**Acceptance Criteria**:
- [ ] `/new` prompts for confirmation and saves snapshot
- [ ] `/new` clears all context and resets metrics
- [ ] `/clear` preserves system prompt
- [ ] `/compact` shows before/after token counts

---

### S06-T18: Reasoning Parser

**Steps**:
1. Create `packages/core/src/parsers/reasoningParser.ts`
2. Parse `<think>...</think>` blocks from model output
3. Extract thinking content, duration, and token count
4. Handle streaming (partial `<think>` blocks)

**Deliverables**:
- `packages/core/src/parsers/reasoningParser.ts`
- `packages/core/src/parsers/__tests__/reasoningParser.test.ts`

**Acceptance Criteria**:
- [ ] Parses complete `<think>` blocks correctly
- [ ] Handles streaming partial blocks
- [ ] Extracts thinking content and response separately

---

### S06-T19: ReasoningBox UI Component

**Steps**:
1. Create `packages/cli/src/ui/components/chat/ReasoningBox.tsx`
2. Implement nested scrollable container (8 lines visible)
3. Add expand/collapse toggle functionality
4. Auto-scroll during streaming, auto-collapse on complete
5. Show token count and duration when collapsed

**Deliverables**:
- `packages/cli/src/ui/components/chat/ReasoningBox.tsx`

**Acceptance Criteria**:
- [ ] Nested box renders within message
- [ ] Scrollable with 8 visible lines
- [ ] Expand/collapse toggle works
- [ ] Auto-scrolls during streaming
- [ ] Auto-collapses when complete

---

### S06-T20: Reasoning Commands

**Steps**:
1. Implement `/reasoning toggle` command
2. Implement `/reasoning expand` command
3. Implement `/reasoning collapse` command
4. Add `Ctrl+R` keyboard shortcut

**Acceptance Criteria**:
- [ ] `/reasoning toggle` shows/hides all reasoning blocks
- [ ] `/reasoning expand` expands all blocks
- [ ] `/reasoning collapse` collapses all blocks
- [ ] `Ctrl+R` toggles reasoning display

---

## Performance Metrics Verification Checklist

### Metrics
- [ ] Metrics display under each assistant response
- [ ] Tokens per second calculated correctly
- [ ] TTFT shown when available
- [ ] Compact mode works
- [ ] Status bar shows average t/s
- [ ] Session statistics accurate
- [ ] `/metrics` command works
- [ ] Toggle shortcut (Ctrl+M) works

### Session Commands
- [ ] `/new` prompts for confirmation
- [ ] `/new` saves snapshot before clearing
- [ ] `/clear` keeps system prompt
- [ ] `/compact` shows before/after token counts

### Reasoning Display
- [ ] Parses `<think>` blocks correctly
- [ ] Displays nested scrollable box
- [ ] Auto-scrolls during streaming
- [ ] Auto-collapses when complete
- [ ] `/reasoning toggle` works
- [ ] `Ctrl+R` shortcut works
- [ ] Works with DeepSeek-R1, Qwen3, QwQ
