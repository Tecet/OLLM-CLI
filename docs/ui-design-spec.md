# OLLM CLI UI Design Specification

## Layout: Hybrid (Tabs + Collapsible Side Panel)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ [💬 Chat] [🔧 Tools] [📁 Files] [🔍 Search] [📚 Docs] [⚙️ Settings] [Ctrl+P ▢/▣]│
├─────────────────────────────────────────────────────┬───────────────────────────┤
│                                                     │                           │
│                 ACTIVE TAB CONTENT                  │    SIDE PANEL             │
│                                                     │    (Collapsible)          │
│                 (Full width when panel hidden)      │    - Activity indicator   │
│                                                     │    - Context info         │
│                                                     │                           │
├─────────────────────────────────────────────────────┴───────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────────┐ │
│ │ > _                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 🟢 llama3.2:3b │ 8.2K/32K │ ⚡38.5t/s │ GPU: 45°C 6.2/8GB │ main +3 │ ~$0.02   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Status Bar Components

### Always Visible (Left to Right)

| Component | Format | Example | Source |
|-----------|--------|---------|--------|
| **Provider Status** | Colored dot | 🟢 🟡 🔴 | Provider connection |
| **Model Name** | Truncated if long | `llama3.2:3b` | Active model |
| **Token Usage** | current/max | `8.2K/32K` | Context tracking |
| **Avg Speed** | tokens/sec | `⚡38.5t/s` | metricsCollector |
| **GPU Temp** | Temperature | `GPU: 45°C` | nvidia-smi/rocm |
| **VRAM Usage** | used/total | `6.2/8GB` | nvidia-smi/rocm |
| **Git Status** | branch +staged ~modified | `main +3` | gitService |
| **Session Cost** | Estimate | `~$0.02` | costTracker |

### Status Bar States

```
Connected:    🟢 llama3.2:3b │ 8.2K/32K │ ⚡38.5t/s │ GPU: 45°C 6.2/8GB │ main +3 │ ~$0.02
Loading:      🟡 Loading llama3.2:3b... │ GPU: 52°C 4.1/8GB 
Disconnected: 🔴 Disconnected │ Reconnecting...
No GPU:       🟢 llama3.2:3b │ 8.2K/32K │ ⚡38.5t/s │ CPU mode │ main +3 │ ~$0.02
```

### VRAM/GPU Monitoring

```typescript
// packages/core/src/services/gpuMonitor.ts

interface GPUInfo {
  available: boolean;
  vendor: 'nvidia' | 'amd' | 'apple' | 'cpu';
  
  // Memory
  vramTotal: number;       // Bytes
  vramUsed: number;        // Bytes
  vramFree: number;        // Bytes
  
  // Temperature
  temperature: number;     // Celsius
  temperatureMax: number;  // Throttle threshold
  
  // Utilization
  gpuUtilization: number;  // 0-100%
  memoryUtilization: number;
}

interface GPUMonitor {
  getInfo(): Promise<GPUInfo>;
  startPolling(intervalMs: number): void;
  stopPolling(): void;
  onUpdate(callback: (info: GPUInfo) => void): void;
  
  // Alerts
  onHighTemp(threshold: number, callback: () => void): void;
  onLowVRAM(threshold: number, callback: () => void): void;
}

// Implementation per platform:
// - NVIDIA: nvidia-smi --query-gpu=...
// - AMD: rocm-smi
// - Apple: powermetrics (requires sudo) or ioreg
// - CPU fallback: show "CPU mode"
```

---

## Theme: Dark Mode

### Color Palette

```typescript
const theme = {
  // Background
  bg: {
    primary: '#0d1117',      // Main background
    secondary: '#161b22',    // Panels, cards
    tertiary: '#21262d',     // Hover states
    input: '#0d1117',        // Input field
  },
  
  // Text
  text: {
    primary: '#c9d1d9',      // Main text
    secondary: '#8b949e',    // Muted text
    muted: '#484f58',        // Very muted
    accent: '#58a6ff',       // Links, highlights
  },
  
  // Roles
  role: {
    user: '#58a6ff',         // User messages
    assistant: '#7ee787',    // Assistant messages
    system: '#a371f7',       // System messages
    tool: '#f0883e',         // Tool calls
  },
  
  // Status
  status: {
    success: '#3fb950',      // Green
    warning: '#d29922',      // Yellow
    error: '#f85149',        // Red
    info: '#58a6ff',         // Blue
  },
  
  // Diff
  diff: {
    added: '#2ea043',        // Added lines bg
    addedText: '#7ee787',    // Added text
    removed: '#f85149',      // Removed lines bg
    removedText: '#ffa198',  // Removed text
  },
  
  // Borders
  border: {
    primary: '#30363d',
    muted: '#21262d',
  }
};
```

---

## Diff Review: Explanation

### Option 1: Inline in Chat

Diffs appear directly in the chat flow as the AI proposes changes:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ User                                                                       │
│ Fix the login bug                                                          │
│                                                                            │
│ Assistant                                                         3:42 PM  │
│ I found the issue. Here's the fix:                                         │
│                                                                            │
│ ┌─ Proposed Change: src/auth/login.ts ───────────────────────────────────┐ │
│ │  45 │   const token = req.headers.authorization;                       │ │
│ │  46 │ - if (token) {                                                   │ │
│ │  46 │ + if (token && validateToken(token)) {                           │ │
│ │  47 │     next();                                                      │ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ [y] Apply  [n] Reject  [e] Edit  [v] View Full                             │
│                                                                            │
│ The issue was that the token wasn't being validated...                     │
└────────────────────────────────────────────────────────────────────────────┘
```

**Pros**:
- Natural flow with conversation
- Context preserved
- Easy to approve inline

**Cons**:
- Clutters chat with large diffs
- Hard to review multiple files

---

### Option 2: Dedicated Panel (Tools Tab)

Diffs queued and reviewed in a separate panel:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [💬 Chat] [🔧 Tools ●] [📁 Files] [🔍 Search] [⚙️ Settings]               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ ┌─ Pending Reviews (2) ───────────────────────────────────────────────────┐│
│ │                                                                         ││
│ │ 📄 src/auth/login.ts                                      +1 -1 lines ││
│ │ ┌─────────────────────────────────────────────────────────────────────┐││
│ │ │  45 │   const token = req.headers.authorization;                    │││
│ │ │  46 │ - if (token) {                                                │││
│ │ │  46 │ + if (token && validateToken(token)) {                        │││
│ │ │  47 │     next();                                                   │││
│ │ └─────────────────────────────────────────────────────────────────────┘││
│ │ [✓ Apply] [✗ Reject] [✎ Edit]                                         ││
│ │                                                                         ││
│ │ ─────────────────────────────────────────────────────────────────────  ││
│ │                                                                         ││
│ │ 📄 src/utils/token.ts                                    +12 -3 lines ││
│ │ [Expand to view diff]                                                  ││
│ │                                                                         ││
│ └─────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│ [Apply All (2)] [Reject All]                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

**Pros**:
- Clean chat history
- Batch review multiple files
- Full diff context

**Cons**:
- Must switch tabs to review
- Disconnected from conversation

---

### Recommended: Hybrid Approach

1. **Small diffs (≤5 lines)**: Show inline in chat
2. **Large diffs (>5 lines)**: Show summary inline, full diff in Tools tab
3. **Badge on tab**: Show pending count `[🔧 Tools ●]`

```
┌─ Chat ─────────────────────────────────────────────────────────────────────┐
│ Assistant                                                                  │
│ I've prepared the fix:                                                     │
│                                                                            │
│ 📝 src/auth/login.ts (+1 -1) - Token validation added                     │
│    [Quick Apply] [View in Tools Tab]                                       │
│                                                                            │
│ 📝 src/utils/token.ts (+12 -3) - New validation function                  │
│    [View in Tools Tab]                                                     │
│                                                                            │
│ Switch to Tools tab (Ctrl+2) to review all changes.                        │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Tool Execution Display

### Tool Call Format

```
┌─ Chat ─────────────────────────────────────────────────────────────────────┐
│ 🔧 read_file ✓                                                     0.12s  │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ path: "src/auth/login.ts"                                            │  │
│ │ Result: 245 lines (4.2KB)                                            │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ 🔧 grep_search ✓                                                   0.34s  │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ pattern: "validateToken"                                             │  │
│ │ path: "src/**/*.ts"                                                  │  │
│ │ Result: 3 matches in 2 files                                         │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│ 🔧 write_file ⏳ pending review                                            │
│ ┌──────────────────────────────────────────────────────────────────────┐  │
│ │ path: "src/auth/login.ts"                                            │  │
│ │ content: "import { validateToken } from '../utils/token';\nimport..." │  │
│ │          ↳ (2,847 characters) [Expand]                               │  │
│ └──────────────────────────────────────────────────────────────────────┘  │
│ [y] Apply  [n] Reject  [v] View Diff                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### Long Arguments: Wrapped Display

```typescript
// When argument value > 80 characters, wrap with ellipsis
const MAX_INLINE_LENGTH = 80;

function formatArgument(key: string, value: string): string {
  if (value.length <= MAX_INLINE_LENGTH) {
    return `${key}: "${value}"`;
  }
  
  const truncated = value.slice(0, MAX_INLINE_LENGTH - 3);
  const chars = value.length;
  return `${key}: "${truncated}..."\n       ↳ (${chars} characters) [Expand]`;
}
```

### Tool Status Icons

| Icon | State | Color |
|------|-------|-------|
| ⏳ | Running | Yellow |
| ✓ | Success | Green |
| ✗ | Failed | Red |
| ⚠ | Warning | Orange |
| 🔒 | Needs Approval | Blue |
| ⏸ | Pending Review | Purple |

---

## Inference Performance Metrics

Real-time performance metrics displayed under each LLM response:

### Per-Response Display

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

### Metrics Explained

| Metric | Symbol | Description |
|--------|--------|-------------|
| **Generation Speed** | ⚡ | Tokens generated per second |
| **Input Tokens** | 📥 | Tokens in prompt (context sent to model) |
| **Output Tokens** | 📤 | Tokens generated in response |
| **Total Time** | ⏱️ | End-to-end generation time |
| **Time to First Token** | TTFT | Latency before first token appears |

### Compact Mode

Configurable compact display for less verbose output:

```
│ ⚡ 42.3 t/s │ 156 tokens │ 3.68s                                          │
```

### Data Sources

```typescript
interface InferenceMetrics {
  promptTokens: number;        // Input/context tokens
  completionTokens: number;    // Generated tokens  
  tokensPerSecond: number;     // Generation speed
  totalDuration: number;       // Total time in seconds
  timeToFirstToken: number;    // TTFT in seconds
}

// Ollama API provides:
// - eval_count, eval_duration (generation)
// - prompt_eval_count, prompt_eval_duration (prompt processing)
// - total_duration

// Fallback estimation when provider data unavailable:
// tokensPerSecond = Math.ceil(responseText.length / 4) / totalSeconds
```

### Configuration

```yaml
ui:
  metrics:
    enabled: true              # Show metrics under responses
    compactMode: false         # Use compact single-line format
    showPromptTokens: true     # Show input token count (📥)
    showTTFT: true             # Show time to first token
    showInStatusBar: true      # Show average t/s in status bar
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+M` | Toggle metrics display visibility |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/metrics` | Show session performance statistics |
| `/metrics toggle` | Toggle metrics display |
| `/metrics reset` | Reset session statistics |

---

## Activity Indicators

Visual feedback shown during LLM operations. Two indicator types work together:
- **🦙 Llama Animation**: Walks inside Assistant message box (waiting for first token only)
- **⠋ Spinner**: Shown in Side Panel activity area (streaming, tools, reasoning)

### State 1: Waiting for First Token (Llama Walks)

```
┌──────────────────────────────────────────────────────┬─────────────────────────────────┐
│                                                      │  ACTIVITY                       │
│  You: Fix the login bug in auth.ts                   │                                 │
│                                                      │  ⏳ Waiting for response        │
│  ┌──────────────────────────────────────────────┐    │                                 │
│  │ Assistant                                    │    │  Model: llama3.2:3b             │
│  │                                              │    │  Queue: 0 pending               │
│  │  ▌                                           │    │                                 │
│  │                                              │    │                                 │
│  │         🦙                                   │    │                                 │
│  │        /||\                                  │    │                                 │
│  └──────────────────────────────────────────────┘    │                                 │
│                                                      │                                 │
│  ┌──────────────────────────────────────────────┐    │                                 │
│  │ > _                                          │    │                                 │
│  └──────────────────────────────────────────────┘    │                                 │
└──────────────────────────────────────────────────────┴─────────────────────────────────┘
```

**Llama walks left-to-right, then flips and walks back (bounce loop):**
```
│  │  🦙→                                        │  (start left, facing right)
│  │       🦙→                                   │  (walking right...)
│  │                                    🦙→      │  (reaches right edge)
│  │                                    ←🦙      │  (FLIP! now facing left)
│  │                           ←🦙               │  (walking left...)
│  │  ←🦙                                        │  (reaches left, FLIP, repeat)
```

### State 2: Streaming Response (Spinner in Panel)

```
│  ┌──────────────────────────────────────────────┐    │  ACTIVITY                       │
│  │ Assistant                                    │    │                                 │
│  │                                              │    │  ⠋ Generating                   │
│  │  I found the issue in your login handler.    │    │    42 tokens                    │
│  │  The token validation was being skipped      │    │    35.2 t/s                     │
│  │  when the Authorization header was present   │    │    1.2s elapsed                 │
│  │  but empty.▌                                 │    │                                 │
│  │                                              │    │  Model: llama3.2:3b             │
│  └──────────────────────────────────────────────┘    │                                 │
```

### State 3: Tool Execution (Spinner in Panel)

```
│  Assistant:                                          │  ACTIVITY                       │
│  Let me check that file...                           │                                 │
│                                                      │  ⠋ Running tool                 │
│  ┌── 🔧 read_file ────────────────────────────────┐  │    📂 read_file                 │
│  │ Reading src/auth/login.ts...                   │  │    src/auth/login.ts            │
│  └────────────────────────────────────────────────┘  │                                 │
│                                                      │  Queue: 0 more                  │
```

### State 4: Reasoning (Spinner in Panel)

```
│  ┌──────────────────────────────────────────────┐    │  ACTIVITY                       │
│  │ Assistant                                    │    │                                 │
│  │                                              │    │  🧠 Reasoning                   │
│  │ ┌─ 🧠 Reasoning ────────── [▼ Collapse] ───┐ │    │    234 tokens                   │
│  │ │ Let me analyze step by step...           │ │    │    4.2s elapsed                 │
│  │ └──────────────────────────────────────────┘ │    │                                 │
│  │                                              │    │  ⠋ Generating response...       │
│  └──────────────────────────────────────────────┘    │                                 │
```

### Indicator Summary

| State | Message Box | Side Panel |
|-------|-------------|------------|
| **Waiting for first token** | 🦙 Llama bounces at bottom | ⏳ Waiting for response |
| **Streaming** | Text appears with cursor ▌ | ⠋ Generating + token count |
| **Tool execution** | Tool execution box | ⠋ Running tool + name |
| **Reasoning** | 🧠 Reasoning box | 🧠 + token count |
| **Idle** | Normal message | Empty or context info |

### Animation Assets

Using pixel art images (16x16 PNG with transparency):

**Phase 1 (Static Move)**:
- `llama_right.png` - facing right
- `llama_left.png` - facing left

**Phase 2 (Walking Animation)** - Future:
- `llama_right_1.png`, `llama_right_2.png` - walk cycle right
- `llama_left_1.png`, `llama_left_2.png` - walk cycle left

See [Llama Animation Guide](llama_animation.md) for pixel art specs and creation guide.

### Animation Code

```typescript
// packages/cli/src/ui/components/LlamaAnimation.tsx

interface LlamaAnimationProps {
  isActive: boolean;
  containerWidth: number;
}

// Phase 1: Static image bounce
const LLAMA_RIGHT = 'assets/animations/llama_right.png';
const LLAMA_LEFT = 'assets/animations/llama_left.png';

// Phase 2 (future): Walk cycle frames
// const WALK_FRAMES_RIGHT = ['llama_right_1.png', 'llama_right_2.png'];
// const WALK_FRAMES_LEFT = ['llama_left_1.png', 'llama_left_2.png'];

interface LlamaState {
  position: number;
  direction: 'right' | 'left';
  image: string;
  // walkFrame: number;  // Phase 2
}

function useLlamaBounce(containerWidth: number, isActive: boolean): LlamaState {
  const [state, setState] = useState<LlamaState>({
    position: 0,
    direction: 'right',
    image: LLAMA_RIGHT
  });
  
  useEffect(() => {
    if (!isActive) return;
    
    const maxPosition = containerWidth - 16; // 16px icon width
    const interval = setInterval(() => {
      setState(prev => {
        let { position, direction } = prev;
        
        if (direction === 'right') {
          position += 2;
          if (position >= maxPosition) {
            direction = 'left';
          }
        } else {
          position -= 2;
          if (position <= 0) {
            direction = 'right';
          }
        }
        
        return {
          position,
          direction,
          image: direction === 'right' ? LLAMA_RIGHT : LLAMA_LEFT
        };
      });
    }, 80); // 80ms per step for smooth movement
    
    return () => clearInterval(interval);
  }, [containerWidth, isActive]);
  
  return state;
}
```

### Fallback (No Image Support)

For terminals without image support:
```typescript
const LLAMA_FALLBACK_RIGHT = '🦙→';
const LLAMA_FALLBACK_LEFT = '←🦙';
```

```typescript
// Spinner frames for side panel
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL = 80; // ms per frame
```

---

## Reasoning Model Display

For models that output thinking process (DeepSeek-R1, Qwen3, QwQ), display reasoning in a nested scrollable box.

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
│ I found the issue. The token validation was being skipped when the        │
│ Authorization header was present but empty. Here's the fix:               │
│ [code block...]                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Behavior

| State | Behavior |
|-------|----------|
| **Streaming** | Expanded, auto-scrolls to follow new content |
| **Complete** | Auto-collapses, shows token count and duration |
| **User Toggle** | Manual expand/collapse with button or `Ctrl+R` |

### Design Features

- **Nested Box**: Bordered container within the message
- **Scrollable**: 8 visible lines, scroll for longer content
- **Auto-scroll**: Follows new content during streaming
- **Auto-collapse**: Collapses when response completes
- **Visual**: Different background, 🧠 icon, muted text color

### Configuration

```yaml
ui:
  reasoning:
    enabled: true                # Show reasoning blocks
    maxVisibleLines: 8           # Height before scrolling
    autoCollapseOnComplete: true # Collapse when response finishes
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Toggle reasoning visibility |

### Slash Commands

| Command | Description |
|---------|-------------|
| `/reasoning toggle` | Toggle reasoning display globally |
| `/reasoning expand` | Expand all reasoning blocks |
| `/reasoning collapse` | Collapse all reasoning blocks |

### Supported Models

- DeepSeek-R1 (all sizes)
- Qwen3 (in thinking mode)
- QwQ
- Any model outputting `<think>...</think>` blocks

---

## Component Specifications

### Tab Bar Component

```tsx
interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  notifications: Record<string, number>;  // Badge counts
}

const tabs: Tab[] = [
  { id: 'chat', icon: '💬', label: 'Chat', shortcut: 'Ctrl+1' },
  { id: 'tools', icon: '🔧', label: 'Tools', shortcut: 'Ctrl+2' },
  { id: 'files', icon: '📁', label: 'Files', shortcut: 'Ctrl+3' },
  { id: 'search', icon: '🔍', label: 'Search', shortcut: 'Ctrl+4' },
  { id: 'docs', icon: '📚', label: 'Docs', shortcut: 'Ctrl+5' },
  { id: 'settings', icon: '⚙️', label: 'Settings', shortcut: 'Ctrl+6' },
];
```

### Side Panel Component

```tsx
interface SidePanelProps {
  visible: boolean;
  width: number;  // Percentage or columns
  onToggle: () => void;
}

// Side panel sections (collapsible)
const sections = [
  { id: 'context', title: 'Context Files', icon: '📄' },
  { id: 'git', title: 'Git Status', icon: '' },
  { id: 'reviews', title: 'Pending Reviews', icon: '📝' },
  { id: 'tools', title: 'Active Tools', icon: '🔧' },
];
```

### Status Bar Component

```tsx
interface StatusBarProps {
  model: string;
  provider: string;
  connected: boolean;
  tokens: { current: number; max: number };
  git?: { branch: string; staged: number; modified: number };
  gpu?: { temp: number; vramUsed: number; vramTotal: number };
  pendingReviews: number;
  sessionCost: number;
}
```

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
| `Enter` | Send message / Start chat (on launch) |
| `Shift+Enter` | Newline in input |
| `y` / `n` | Approve / Reject (in review) |
| `j` / `k` | Scroll down / up (in Docs tab) |
| `Tab` | Cycle focus |

---

## File Structure

```
packages/cli/src/ui/
├── App.tsx                      # Main app
├── theme.ts                     # Dark theme colors
├── contexts/
│   ├── ChatContext.tsx
│   ├── UIContext.tsx
│   ├── GPUContext.tsx           # NEW
│   └── ReviewContext.tsx        # NEW
├── components/
│   ├── layout/
│   │   ├── TabBar.tsx
│   │   ├── SidePanel.tsx
│   │   ├── StatusBar.tsx
│   │   └── InputBox.tsx
│   ├── chat/
│   │   ├── ChatHistory.tsx
│   │   ├── Message.tsx
│   │   ├── ToolCall.tsx         # NEW
│   │   └── StreamingIndicator.tsx
│   ├── review/
│   │   ├── DiffViewer.tsx
│   │   ├── InlineDiff.tsx       # NEW
│   │   └── ReviewActions.tsx
│   ├── docs/                    # NEW
│   │   ├── DocViewer.tsx
│   │   └── DocNav.tsx
│   ├── LaunchScreen.tsx         # NEW
│   ├── RecentSessions.tsx       # NEW
│   └── common/
│       ├── Spinner.tsx
│       ├── Badge.tsx
│       └── Collapsible.tsx
├── tabs/
│   ├── ChatTab.tsx
│   ├── ToolsTab.tsx
│   ├── FilesTab.tsx
│   ├── SearchTab.tsx
│   ├── DocsTab.tsx              # NEW
│   └── SettingsTab.tsx
├── services/
│   └── docsService.ts           # NEW
└── animations/
    ├── spinner.ts
    └── llama.ts                 # Future

assets/
└── OLLM_v01.txt                 # ASCII art logo
```

---

## Launch Screen

On startup, OLLM CLI displays the ASCII art logo with quick actions and recent sessions:

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

**Behavior**:
- Any keypress dismisses launch screen and shows Chat tab
- `/home` command returns to launch screen
- ASCII art loaded from `assets/OLLM_v01.txt`

---

## Docs Tab

In-app documentation browser with side panel navigation:

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

**Features**:
- Markdown rendering in terminal
- Document titles in side panel
- Keyboard navigation (j/k scroll, Enter select)
- Internal link support

---

## Summary

| Feature | Decision |
|---------|----------|
| Layout | Hybrid (tabs + collapsible side panel) |
| Tabs | 6 tabs: Chat, Tools, Files, Search, Docs, Settings |
| Theme | Dark mode only |
| Status Bar | Model, tokens, avg t/s, GPU, git, cost |
| **Metrics** | Per-response: t/s, tokens, TTFT (toggle with Ctrl+M) |
| **Reasoning** | Nested scrollable box for `<think>` content (Ctrl+R) |
| Diff Review | Small inline, large in Tools tab |
| Tool Display | Show name + result, wrapped args |
| Streaming | Spinner (llama animation later) |
| Launch | ASCII art logo with quick actions |
| Docs | In-app documentation browser |
