# Design Document: CLI and UI

## Overview

The OLLM CLI provides a full-featured terminal user interface (TUI) built with React and Ink, offering both interactive and non-interactive execution modes. The system implements a hybrid layout with tabs for focused work and a collapsible side panel for contextual information. Real-time GPU monitoring, comprehensive status tracking, and an intuitive diff review system enable developers to work efficiently with local LLMs.

The architecture separates concerns between the CLI package (UI rendering, input handling, command parsing) and the core package (business logic, services, tool execution). This design enables testing UI components independently and supports future alternative interfaces.

## Architecture

### High-Level Component Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Package                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    App Container                          │  │
│  │  ┌────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │  Tab Bar   │  │ Main Content │  │   Side Panel    │  │  │
│  │  │  (6 tabs)  │  │   (Active)   │  │  (Collapsible)  │  │  │
│  │  └────────────┘  └──────────────┘  └─────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Input Box                             │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │              Status Bar                            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Configuration Loader                        │  │
│  │  (System → User → Workspace → Env → CLI Flags)          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Non-Interactive Runner                         │  │
│  │  (Single prompt execution with output formatting)        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Core Package                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   GPU Monitor Service                    │  │
│  │  (Platform-specific GPU queries with polling)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Docs Service                           │  │
│  │  (Documentation indexing and markdown rendering)         │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Chat Client & Tool Handler                  │  │
│  │  (Existing services for chat and tool execution)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Resolution Flow

```
System Defaults
    ↓
User Config (~/.ollm/config.yaml)
    ↓
Workspace Config (.ollm/config.yaml)
    ↓
Environment Variables
    ↓
CLI Flags (highest precedence)
    ↓
Merged Configuration → Validation → Application
```

### GPU Monitoring Flow

```
GPU Monitor Service
    ↓
Platform Detection (NVIDIA / AMD / Apple / CPU)
    ↓
Execute Platform Command (nvidia-smi / rocm-smi / ioreg)
    ↓
Parse Output → Extract Metrics
    ↓
Update Callbacks → Status Bar Update
```

## Components and Interfaces

### Configuration Loader

**Purpose:** Load and merge configuration from multiple sources with validation.

**Interface:**
```typescript
interface ConfigLayer {
  source: 'system' | 'user' | 'workspace' | 'env' | 'cli';
  priority: number;
  values: Record<string, unknown>;
}

interface ConfigLoader {
  loadConfig(): Promise<AppConfig>;
  validateConfig(config: unknown): ValidationResult;
  mergeConfigs(layers: ConfigLayer[]): AppConfig;
}

interface AppConfig {
  ui: {
    layout: 'hybrid' | 'simple';
    sidePanel: boolean;
    showGpuStats: boolean;
    showCost: boolean;
  };
  status: {
    pollInterval: number;
    highTempThreshold: number;
    lowVramThreshold: number;
  };
  shortcuts: Record<string, string>;
  model?: string;
  provider?: string;
  output?: 'text' | 'json' | 'stream-json';
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  path: string;
  message: string;
  value: unknown;
}
```

**Behavior:**
- Load configuration files using YAML/JSON parsers
- Merge configurations with explicit precedence rules
- Validate against JSON schema using Ajv
- Return detailed validation errors with paths and values
- Cache merged configuration for performance

### GPU Monitor Service

**Purpose:** Track GPU metrics across different hardware platforms.

**Interface:**
```typescript
interface GPUInfo {
  available: boolean;
  vendor: 'nvidia' | 'amd' | 'apple' | 'cpu';
  vramTotal: number;      // MB
  vramUsed: number;       // MB
  vramFree: number;       // MB
  temperature: number;    // Celsius
  temperatureMax: number; // Celsius
  gpuUtilization: number; // Percentage
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

**Platform Commands:**
- **NVIDIA:** `nvidia-smi --query-gpu=temperature.gpu,memory.total,memory.used,memory.free,utilization.gpu --format=csv,noheader,nounits`
- **AMD:** `rocm-smi --showtemp --showmeminfo --showuse`
- **Apple:** `ioreg -l | grep -i gpu` (fallback to CPU mode if unavailable)
- **CPU:** Return `{ available: false, vendor: 'cpu' }`

**Behavior:**
- Detect platform on initialization
- Execute platform-specific commands via shell
- Parse command output into structured GPUInfo
- Poll at configured interval (default 5 seconds)
- Invoke callbacks when thresholds are exceeded
- Handle command failures gracefully (fallback to CPU mode)

### Non-Interactive Runner

**Purpose:** Execute single prompts and output results in various formats.

**Interface:**
```typescript
interface NonInteractiveRunner {
  run(prompt: string, options: RunOptions): Promise<void>;
}

interface RunOptions {
  model?: string;
  provider?: string;
  output: 'text' | 'json' | 'stream-json';
  config?: AppConfig;
}

interface JSONOutput {
  response: string;
  model: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration: number;
  toolCalls?: ToolCall[];
}

interface StreamJSONEvent {
  type: 'start' | 'chunk' | 'tool_call' | 'tool_result' | 'end' | 'error';
  data: unknown;
  timestamp: number;
}
```

**Behavior:**
- Parse CLI flags and load configuration
- Initialize chat client with specified model
- Execute single turn with provided prompt
- Format output based on output option:
  - **text:** Write response text to stdout
  - **json:** Write JSONOutput object to stdout
  - **stream-json:** Write NDJSON events to stdout as they occur
- Write errors to stderr with appropriate exit codes
- Support piped input from stdin

### Tab Bar Component

**Purpose:** Provide navigation between functional areas.

**Interface:**
```typescript
interface Tab {
  id: string;
  label: string;
  icon: string;
  shortcut: string;
  badge?: number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}
```

**Tabs:**
1. Chat (💬) - Ctrl+1
2. Tools (🔧) - Ctrl+2
3. Files (📁) - Ctrl+3
4. Search (🔍) - Ctrl+4
5. Docs (📚) - Ctrl+5
6. Settings (⚙️) - Ctrl+6

**Behavior:**
- Render tabs horizontally with icons and labels
- Highlight active tab with accent color
- Display badge count when > 0
- Handle keyboard shortcuts (Ctrl+1-6)
- Preserve tab state when switching

### Side Panel Component

**Purpose:** Display contextual information without switching tabs.

**Interface:**
```typescript
interface SidePanelProps {
  visible: boolean;
  onToggle: () => void;
  sections: PanelSection[];
}

interface PanelSection {
  title: string;
  collapsed: boolean;
  content: React.ReactNode;
}
```

**Sections:**
1. **Context Files:** List of @-mentioned files
2. **Git Status:** Branch, staged, and modified files
3. **Pending Reviews:** Count and list of diffs awaiting approval
4. **Active Tools:** Currently executing tools with progress

**Behavior:**
- Toggle visibility with Ctrl+P
- Expand main content to full width when hidden
- Collapse/expand individual sections
- Auto-show when relevant events occur (e.g., new review)
- Persist visibility preference to config

### Status Bar Component

**Purpose:** Display real-time system metrics and status.

**Interface:**
```typescript
interface StatusBarProps {
  connection: ConnectionStatus;
  model: string;
  tokens: { current: number; max: number };
  git: GitStatus;
  gpu?: GPUInfo;
  reviews: number;
  cost: number;
}

interface ConnectionStatus {
  state: 'connected' | 'connecting' | 'disconnected';
  provider: string;
}

interface GitStatus {
  branch: string;
  staged: number;
  modified: number;
}
```

**Format:**
```
🟢 llama3.2:3b │ 8.2K/32K │ main +3 ~2 │ GPU: 45°C 6.2/8GB │ 2 reviews │ ~$0.02
```

**Behavior:**
- Update all components in real-time
- Use color-coded indicators (🟢🟡🔴)
- Format numbers with K/M suffixes
- Show GPU info when available, "CPU mode" otherwise
- Calculate cost based on token usage and model pricing

### Chat Interface Components

**Purpose:** Display conversation history and handle user input.

**Components:**

**ChatHistory:**
```typescript
interface ChatHistoryProps {
  messages: Message[];
  streaming: boolean;
}

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}
```

**ToolCall Display:**
```typescript
interface ToolCallProps {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  duration: number;
  status: 'pending' | 'success' | 'error';
}
```

**Format:**
```
🔧 read_file ✓                                                     0.12s
┌──────────────────────────────────────────────────────────────────────┐
│ path: "src/auth/login.ts"                                            │
│ Result: 245 lines (4.2KB)                                            │
└──────────────────────────────────────────────────────────────────────┘
```

**StreamingIndicator:**
```typescript
interface StreamingIndicatorProps {
  active: boolean;
  message?: string;
}
```

**Spinner frames:** ⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏ (80ms cycle)

**Behavior:**
- Render messages with role-specific colors
- Display streaming indicator during generation
- Show tool calls with formatted arguments
- Wrap long arguments at 80 characters with expand option
- Display inline diffs for small changes (≤5 lines)
- Auto-scroll to bottom on new messages

### Tools Tab Component

**Purpose:** Review and approve file changes.

**Interface:**
```typescript
interface ToolsTabProps {
  pendingReviews: DiffReview[];
  toolHistory: ToolExecution[];
  onApply: (reviewId: string) => void;
  onReject: (reviewId: string) => void;
  onApplyAll: () => void;
  onRejectAll: () => void;
}

interface DiffReview {
  id: string;
  file: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
}

interface ToolExecution {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  duration: number;
  timestamp: number;
}
```

**Behavior:**
- List pending reviews with file names and line counts
- Display full diffs with syntax highlighting
- Provide individual and batch approval actions
- Show tool execution history with expand/collapse
- Update in real-time as new reviews arrive

### Files Tab Component

**Purpose:** Manage context files and git operations.

**Interface:**
```typescript
interface FilesTabProps {
  contextFiles: ContextFile[];
  gitStatus: GitStatus;
  onRemoveFile: (path: string) => void;
  onGitAction: (action: GitAction) => void;
}

interface ContextFile {
  path: string;
  size: number;
  addedAt: number;
}

type GitAction = 'commit' | 'stash' | 'diff';
```

**Behavior:**
- List all @-mentioned context files
- Display git status with branch and changes
- Provide remove action for context files
- Offer quick git actions (commit, stash, diff)

### Docs Tab Component

**Purpose:** Browse and render documentation within the CLI.

**Interface:**
```typescript
interface DocsTabProps {
  docs: DocEntry[];
  currentDoc?: string;
  onSelectDoc: (path: string) => void;
}

interface DocEntry {
  title: string;
  path: string;
  description?: string;
  children?: DocEntry[];
}
```

**Behavior:**
- Display doc navigation in side panel
- Render markdown content in main area
- Support internal links between documents
- Handle keyboard navigation (j/k scroll, Enter select)
- Track navigation history for back button

### Settings Tab Component

**Purpose:** Configure model settings and view session information.

**Interface:**
```typescript
interface SettingsTabProps {
  models: ModelInfo[];
  currentModel: string;
  session: SessionInfo;
  options: ModelOptions;
  onModelChange: (model: string) => void;
  onOptionChange: (key: string, value: unknown) => void;
  onSaveSession: () => void;
  onExportSession: () => void;
  onClearChat: () => void;
}

interface ModelInfo {
  name: string;
  size: string;
  contextLength: number;
  capabilities: string[];
}

interface SessionInfo {
  tokens: number;
  duration: number;
  cost: number;
  messageCount: number;
}

interface ModelOptions {
  temperature: number;
  maxTokens: number;
  reviewMode: boolean;
}
```

**Behavior:**
- Display model picker with details
- Show session statistics
- Provide option controls with immediate updates
- Offer quick actions for session management

### Launch Screen Component

**Purpose:** Display welcoming screen on startup.

**Interface:**
```typescript
interface LaunchScreenProps {
  version: string;
  recentSessions: RecentSession[];
  onDismiss: () => void;
}

interface RecentSession {
  id: string;
  title: string;
  timestamp: number;
}
```

**Behavior:**
- Load ASCII art from docs/OLLM_v01.txt
- Center art in terminal
- Display version and recent sessions
- Show quick action hints
- Dismiss on any keypress to Chat tab
- Return via /home command

### Docs Service

**Purpose:** Index and serve documentation files.

**Interface:**
```typescript
interface DocsService {
  getIndex(): DocEntry[];
  getDoc(path: string): Promise<string>;
  renderMarkdown(content: string): string;
}
```

**Behavior:**
- Scan docs/ directory for markdown files
- Build hierarchical index
- Load and cache document content
- Render markdown to terminal-friendly format
- Resolve internal links

### Slash Command Handler

**Purpose:** Parse and execute slash commands.

**Interface:**
```typescript
interface SlashCommandHandler {
  parse(input: string): SlashCommand | null;
  execute(command: SlashCommand): Promise<void>;
}

interface SlashCommand {
  name: string;
  args: string[];
}
```

**Commands:**
- `/model list|use|pull|rm|info`
- `/provider list|use`
- `/session list|resume|delete|save|export`
- `/git status|commit|undo`
- `/review enable|disable|pending`
- `/extensions list|enable|disable`
- `/context`
- `/clear`
- `/help`
- `/exit`
- `/home`

**Behavior:**
- Parse input for slash prefix
- Extract command name and arguments
- Validate command and arguments
- Execute corresponding action
- Display results in chat or update UI state

## Data Models

### Configuration Schema

```typescript
interface ConfigSchema {
  ui: {
    layout: 'hybrid' | 'simple';
    sidePanel: boolean;
    showGpuStats: boolean;
    showCost: boolean;
  };
  status: {
    pollInterval: number;        // milliseconds
    highTempThreshold: number;   // celsius
    lowVramThreshold: number;    // megabytes
  };
  shortcuts: {
    togglePanel: string;
    clearChat: string;
    saveSession: string;
  };
  model?: string;
  provider?: string;
  host?: string;
  output?: 'text' | 'json' | 'stream-json';
  reviewDiffs?: boolean;
  debug?: boolean;
  noColor?: boolean;
}
```

### GPU Info Model

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
```

### UI State Model

```typescript
interface UIState {
  activeTab: string;
  sidePanelVisible: boolean;
  contextFiles: ContextFile[];
  pendingReviews: DiffReview[];
  activeTools: ToolExecution[];
  launchScreenVisible: boolean;
}
```

### Theme Model

```typescript
interface Theme {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  role: {
    user: string;
    assistant: string;
    system: string;
    tool: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  diff: {
    added: string;
    removed: string;
  };
}
```

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Configuration Precedence

*For any* set of configuration values defined across multiple layers (system, user, workspace, env, CLI), the merged configuration should use the value from the highest precedence layer for each setting.

**Validates: Requirements 1.1**

### Property 2: Configuration Error Messages Include Path

*For any* invalid configuration file (malformed YAML/JSON or schema violation), the error message should contain the file path and specific validation error.

**Validates: Requirements 1.2, 1.3**

### Property 3: Configuration Validation Before Application

*For any* configuration that violates the JSON schema, the Config_Loader should reject it before applying any settings.

**Validates: Requirements 1.5**

### Property 4: GPU Polling Interval

*For any* configured polling interval, when GPU monitoring is started, queries should occur at approximately that interval until stopped.

**Validates: Requirements 2.5**

### Property 5: GPU Threshold Callbacks

*For any* GPU temperature above the configured threshold or VRAM below the configured threshold, the corresponding callback should be invoked.

**Validates: Requirements 2.6, 2.7**

### Property 6: GPU Polling Stops

*For any* GPU monitor that is stopped, no further polling queries should occur.

**Validates: Requirements 2.8**

### Property 7: Non-Interactive Single Turn

*For any* prompt provided via --prompt flag, the non-interactive runner should execute exactly one turn and exit.

**Validates: Requirements 3.1**

### Property 8: Output Format Correctness

*For any* response in non-interactive mode, the output format should match the specified format (text, json, or stream-json) and be valid according to that format's specification.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 9: Error Exit Codes

*For any* error during non-interactive execution, the runner should write to stderr and exit with a non-zero exit code.

**Validates: Requirements 3.5**

### Property 10: Stdin Piping

*For any* content piped to stdin, the non-interactive runner should use it as the prompt.

**Validates: Requirements 3.6**

### Property 11: Tab Keyboard Shortcuts

*For any* tab shortcut (Ctrl+1 through Ctrl+6), pressing it should switch to the corresponding tab.

**Validates: Requirements 4.2**

### Property 12: Tab Badges

*For any* tab with pending items (count > 0), a notification badge should display the count.

**Validates: Requirements 4.3**

### Property 13: Tab State Preservation

*For any* tab switch, the previous tab's state should be preserved and restored when switching back.

**Validates: Requirements 4.4**

### Property 14: Side Panel Toggle

*For any* press of Ctrl+P, the side panel should toggle between visible and hidden states.

**Validates: Requirements 5.1**

### Property 15: Side Panel Width Adjustment

*For any* side panel state change, the main content area should expand to full width when hidden and contract when visible.

**Validates: Requirements 5.2**

### Property 16: Side Panel Reactive Updates

*For any* event that affects context files, git status, pending reviews, or active tools, the corresponding side panel section should update to reflect the change.

**Validates: Requirements 5.4, 5.5, 5.6, 5.7**

### Property 17: Side Panel Persistence

*For any* application session, the side panel visibility preference should be persisted and restored on next launch.

**Validates: Requirements 5.8**

### Property 18: Status Bar Connection Indicator

*For any* connection state (connected, connecting, disconnected), the status bar should display the corresponding colored indicator (green, yellow, red).

**Validates: Requirements 6.1**

### Property 19: Status Bar Component Display

*For any* status bar component (model, tokens, git, GPU, reviews, cost), changes to that component should update the display in real-time.

**Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9**

### Property 20: Message Role Colors

*For any* message with a role (user, assistant, system, tool), the chat history should display it with the role-specific color.

**Validates: Requirements 7.1**

### Property 21: Streaming Incremental Rendering

*For any* streaming text chunk, the chat interface should render it incrementally as it arrives.

**Validates: Requirements 7.3**

### Property 22: Tool Call Display Completeness

*For any* tool call, the chat interface should display the tool name, arguments, execution time, and result.

**Validates: Requirements 7.4**

### Property 23: Tool Argument Wrapping

*For any* tool arguments exceeding 80 characters, the chat interface should wrap them and provide an expand option.

**Validates: Requirements 7.5**

### Property 24: Inline Diff Threshold

*For any* file change of 5 lines or fewer, the chat interface should display an inline diff preview.

**Validates: Requirements 7.6**

### Property 25: Pending Reviews Display

*For any* set of pending diff reviews, the Tools tab should display all of them in a list.

**Validates: Requirements 8.1**

### Property 26: Diff Color Coding

*For any* diff displayed in the Tools tab, added lines should be green and removed lines should be red.

**Validates: Requirements 8.2**

### Property 27: Review Actions

*For any* review action (apply or reject), the Tools tab should process the change and remove the review from the pending list.

**Validates: Requirements 8.3, 8.4**

### Property 28: Batch Review Actions

*For any* set of multiple pending reviews, the Tools tab should provide "Apply All" and "Reject All" actions that process all reviews.

**Validates: Requirements 8.5**

### Property 29: Tool History Display

*For any* tool execution history, the Tools tab should display it with expand/collapse functionality.

**Validates: Requirements 8.6**

### Property 30: Context Files Display

*For any* file that has been @-mentioned, the Files tab should display it in the context files list.

**Validates: Requirements 9.1**

### Property 31: Git Status Display

*For any* git repository state, the Files tab should display the branch name, staged files count, and modified files count.

**Validates: Requirements 9.2**

### Property 32: Documentation Navigation

*For any* available documentation file, the Docs tab should list it in the navigation panel.

**Validates: Requirements 10.1**

### Property 33: Documentation Rendering

*For any* selected document, the Docs tab should render its markdown content in the main area.

**Validates: Requirements 10.2**

### Property 34: Documentation Links

*For any* internal link in a document, clicking it should navigate to the linked document.

**Validates: Requirements 10.3**

### Property 35: Documentation History

*For any* document navigation, pressing Backspace should return to the previous document in history.

**Validates: Requirements 10.6**

### Property 36: Model Picker Display

*For any* set of available models, the Settings tab should display all of them in the model picker.

**Validates: Requirements 11.1**

### Property 37: Model Selection

*For any* model selected in the Settings tab, subsequent requests should use that model.

**Validates: Requirements 11.2**

### Property 38: Session Info Display

*For any* active session, the Settings tab should display token count, duration, and estimated cost.

**Validates: Requirements 11.3**

### Property 39: Settings Immediate Application

*For any* option change in the Settings tab, the change should apply immediately without requiring confirmation.

**Validates: Requirements 11.5**

### Property 40: Recent Sessions Display

*For any* set of recent sessions (up to 3), the Launch Screen should display them with titles and timestamps.

**Validates: Requirements 12.3**

### Property 41: Launch Screen Dismissal

*For any* keypress on the Launch Screen, it should dismiss and switch to the Chat tab.

**Validates: Requirements 12.5**

### Property 42: Theme Color Application

*For any* UI element with a defined theme color, the element should render with that color.

**Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5**

### Property 43: Error Message Completeness

*For any* error condition (config load, model load, tool execution, GPU monitoring, invalid command), the error message should contain sufficient information to understand and resolve the issue.

**Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5**

## Error Handling

### Configuration Errors

**Invalid YAML/JSON:**
- Parse error with line and column number
- File path in error message
- Example of valid syntax

**Schema Violations:**
- Setting name and path
- Expected type vs actual type
- Valid value range or options

**File Not Found:**
- Attempted file path
- Suggestion to create default config

### GPU Monitoring Errors

**Command Execution Failure:**
- Fall back to CPU mode
- Log warning with command and error
- Continue operation without GPU stats

**Parse Errors:**
- Log warning with raw output
- Fall back to CPU mode
- Continue operation

**Threshold Violations:**
- Invoke callbacks without blocking
- Log warnings
- Continue operation

### Non-Interactive Errors

**Model Not Found:**
- List available models
- Exit with code 1

**Provider Connection Failed:**
- Display connection error
- Suggest checking provider status
- Exit with code 2

**Tool Execution Failed:**
- Display tool name and error
- Exit with code 3

**Invalid Output Format:**
- Display valid formats
- Exit with code 1

### UI Errors

**Component Render Errors:**
- Display error boundary
- Log error details
- Allow recovery or exit

**Keyboard Shortcut Conflicts:**
- Log warning
- Use first registered handler
- Continue operation

**State Persistence Errors:**
- Log warning
- Use default state
- Continue operation

## Testing Strategy

### Unit Testing

**Configuration Loader:**
- Test each layer loads correctly
- Test precedence with conflicting values
- Test validation with invalid configs
- Test error messages contain required info

**GPU Monitor:**
- Mock platform commands
- Test parsing for each platform
- Test polling interval accuracy
- Test threshold callbacks
- Test stop behavior

**Non-Interactive Runner:**
- Test each output format
- Test error handling and exit codes
- Test stdin piping
- Test with various prompts

**UI Components:**
- Test rendering with various props
- Test keyboard shortcuts
- Test state updates
- Test error boundaries

### Property-Based Testing

All properties listed in the Correctness Properties section should be implemented as property-based tests with minimum 100 iterations each. Each test should:

1. Generate random valid inputs for the property
2. Execute the operation
3. Verify the property holds
4. Tag the test with: **Feature: stage-06-cli-ui, Property N: [property text]**

**Example Property Test:**
```typescript
// Feature: stage-06-cli-ui, Property 1: Configuration Precedence
test('config precedence holds for any conflicting values', () => {
  fc.assert(
    fc.property(
      fc.record({
        system: fc.record({ setting: fc.string() }),
        user: fc.record({ setting: fc.string() }),
        workspace: fc.record({ setting: fc.string() }),
        env: fc.record({ setting: fc.string() }),
        cli: fc.record({ setting: fc.string() }),
      }),
      (configs) => {
        const merged = configLoader.mergeConfigs([
          { source: 'system', priority: 1, values: configs.system },
          { source: 'user', priority: 2, values: configs.user },
          { source: 'workspace', priority: 3, values: configs.workspace },
          { source: 'env', priority: 4, values: configs.env },
          { source: 'cli', priority: 5, values: configs.cli },
        ]);
        
        // CLI has highest precedence
        expect(merged.setting).toBe(configs.cli.setting);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

**End-to-End Flows:**
- Launch → Chat → Tool Call → Review → Apply
- Launch → Settings → Model Switch → Chat
- Launch → Docs → Navigate → Back
- Non-interactive with various flags and formats

**Cross-Component Integration:**
- Side panel updates when chat events occur
- Status bar updates when model changes
- Tools tab updates when reviews are pending
- Files tab updates when @-mentions occur

### Visual Testing

**Snapshot Tests:**
- Launch screen layout
- Each tab layout
- Status bar with various states
- Tool call display formats
- Diff viewer rendering

**Manual Testing:**
- Theme colors in actual terminal
- Spinner animation smoothness
- Keyboard shortcut responsiveness
- Layout at various terminal sizes

### Performance Testing

**Metrics:**
- Startup time < 500ms
- Tab switch time < 100ms
- Message render time < 50ms
- GPU poll overhead < 10ms

**Load Testing:**
- 1000+ messages in history
- 100+ pending reviews
- 50+ context files
- Long-running tool executions

## Implementation Notes

### React + Ink Considerations

- Use `useInput` hook for keyboard shortcuts
- Use `useStdout` for terminal dimensions
- Use `useFocus` for focus management
- Avoid re-renders during streaming (use refs)
- Test with `ink-testing-library`

### Configuration Loading

- Use `js-yaml` for YAML parsing
- Use `ajv` for JSON schema validation
- Cache merged config for performance
- Watch config files for changes (optional)

### GPU Monitoring

- Use `child_process.exec` for platform commands
- Parse output with regex patterns
- Handle missing commands gracefully
- Throttle polling to avoid overhead

### Non-Interactive Mode

- Use `process.stdin` for piped input
- Use `process.stdout` and `process.stderr` for output
- Set appropriate exit codes
- Handle SIGINT/SIGTERM gracefully

### State Management

- Use React Context for global state
- Use local state for component-specific state
- Persist preferences to config file
- Use refs for non-reactive state (e.g., timers)

### Keyboard Shortcuts

- Register shortcuts at app level
- Prevent conflicts with terminal shortcuts
- Document all shortcuts in help
- Make shortcuts configurable

### Documentation Service

- Index docs on startup
- Cache rendered markdown
- Use `marked` for markdown parsing
- Support relative links between docs

### ASCII Art

- Load from file at startup
- Center based on terminal width
- Handle narrow terminals gracefully
- Cache loaded art

## Future Enhancements

- **Themes:** Support light theme and custom themes
- **Plugins:** Allow UI extensions via plugins
- **Layouts:** Support alternative layouts (simple, compact)
- **Animations:** Add smooth transitions and animations
- **Accessibility:** Improve screen reader support
- **Localization:** Support multiple languages
- **Cloud Sync:** Sync sessions and preferences across devices
