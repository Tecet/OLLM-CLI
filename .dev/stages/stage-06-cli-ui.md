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

## Theme: Dark Mode

```typescript
const theme = {
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
};
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
| `/context` | Show context status |
| `/clear` | Clear conversation |
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
2. Implement InputBox with multi-line support
3. Streaming text display with spinner
4. Tool call display with arguments
5. Inline diff review for small changes (≤5 lines)

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
3. Session info (tokens, duration, cost)
4. Options (temperature, max tokens, review mode)
5. Quick actions (save, export, clear)

**Deliverables**:
- `packages/cli/src/ui/tabs/SettingsTab.tsx`
- `packages/cli/src/ui/components/settings/ModelPicker.tsx`
- `packages/cli/src/ui/components/settings/SessionInfo.tsx`

**Acceptance Criteria**:
- [ ] Model switching works
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

### S06-T13: Launch Screen (ASCII Art)

**Goal**: Display ASCII art logo and quick actions on startup.

**Steps**:
1. Load ASCII art from `docs/OLLM_v01.txt`
2. Display centered in active tab on launch
3. Show version, quick tips, and recent sessions
4. Dismiss on any keypress or input
5. Add `/home` command to return to launch screen

**Launch Screen Layout**:
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                            -#               │
│                                                           #+#               │
│         +##-                                             #-++               │
│      ##++-+#                                            #+-#                │
│    #+---.--+.                                         +#+-++                │
│   ++.    .-+                                        -##-  #.                │
│  +-       -+           +========+                 +###-  ++                 │
│ --        -+           |OLLM CLI|              .####+-  .+                  │
│ +         -+           +========+            #####++-  .#                   │
│ +         -+                              .####+-+-.  .+                    │
│ +        .-#                            -####+----   -#                     │
│ +        .-##                         +##++------   #-                      │
│  +        -+##      -+++########..  ###--.------  .#                        │
│  ++      .++##########################-.  .--+.  -+                         │
│   ++     .+++++########################+-+--.  .#                           │
│    ##.   .-++-.-###########################++-#.                            │
│                                                                             │
│                        OLLM CLI v1.0.0                                      │
│                   Local LLM Assistant                                       │
│                                                                             │
│  ┌─ Quick Actions ─────────────────────────────────────────────────────┐   │
│  │  [Enter] Start chatting    [Ctrl+5] View docs    [Ctrl+6] Settings  │   │
│  │  [/] Commands              [?] Help              [Esc] Quit         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ Recent Sessions ───────────────────────────────────────────────────┐   │
│  │  1. "Fixing auth bug" - 2 hours ago                                  │   │
│  │  2. "Refactoring utils" - yesterday                                  │   │
│  │  3. "New feature planning" - 3 days ago                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
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

// Load ASCII art
async function loadAsciiArt(): Promise<string> {
  const artPath = path.join(__dirname, '../../../docs/OLLM_v01.txt');
  return fs.readFile(artPath, 'utf-8');
}

// Center art in terminal
function centerAsciiArt(art: string, termWidth: number): string {
  const lines = art.split('\n');
  const maxWidth = Math.max(...lines.map(l => l.length));
  const padding = Math.floor((termWidth - maxWidth) / 2);
  return lines.map(l => ' '.repeat(padding) + l).join('\n');
}
```

**Deliverables**:
- `packages/cli/src/ui/components/LaunchScreen.tsx`
- `packages/cli/src/ui/components/RecentSessions.tsx`
- Copy `docs/OLLM_v01.txt` to package assets

**Acceptance Criteria**:
- [ ] ASCII art displays centered on launch
- [ ] Version number shown
- [ ] Recent sessions listed
- [ ] Quick action hints shown
- [ ] Any keypress dismisses to Chat tab
- [ ] `/home` command returns to launch screen

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
    ├── theme.ts                  # Dark theme colors
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
        └── llama.ts              # Future enhancement

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
# ~/.ollm/config.yaml

ui:
  layout: hybrid              # hybrid | simple
  sidePanel: true             # Show side panel by default
  showGpuStats: true          # Show GPU in status bar
  showCost: true              # Show session cost
  
status:
  pollInterval: 5000          # GPU poll interval (ms)
  highTempThreshold: 80       # Warn at this temp
  lowVramThreshold: 512       # Warn at this MB

shortcuts:
  togglePanel: 'ctrl+p'
  clearChat: 'ctrl+l'
  saveSession: 'ctrl+s'
```

---

## Verification Checklist

- [ ] Config loads from all layers
- [ ] Config validation shows clear errors
- [ ] Non-interactive mode works with `-p`
- [ ] All output formats work correctly
- [ ] GPU monitoring works (NVIDIA, AMD, fallback)
- [ ] Tab bar switches correctly
- [ ] Side panel toggles with Ctrl+P
- [ ] Status bar shows all components
- [ ] Chat history displays messages
- [ ] Tool calls show with args
- [ ] Streaming spinner works
- [ ] Diff review in Tools tab works
- [ ] Keyboard shortcuts work
- [ ] Model picker works
- [ ] Session stats update
