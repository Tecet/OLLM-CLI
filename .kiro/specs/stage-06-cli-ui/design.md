# Design Document: Stage 6 - CLI and UI

## Overview

This document describes the design for the OLLM CLI interactive terminal user interface (TUI) and non-interactive execution modes. The system provides a comprehensive React + Ink based interface with a hybrid layout combining tabs and a collapsible side panel, GPU monitoring, performance metrics, reasoning model support, and real-time status tracking.

The design follows a component-based architecture with clear separation between:
- **CLI Layer**: Argument parsing, configuration loading, and entry point
- **UI Layer**: React components for rendering the TUI
- **Service Layer**: Business logic for GPU monitoring, metrics collection, and session management
- **Context Layer**: State management and data flow between components

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLI Entry Point                         │
│                      (packages/cli/src/cli.tsx)                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ├─── Non-Interactive Mode
                         │    (packages/cli/src/nonInteractive.ts)
                         │
                         └─── Interactive Mode (TUI)
                              │
                              ├─── Config Loader
                              │    (packages/cli/src/config/)
                              │
                              ├─── UI Application
                              │    (packages/cli/src/ui/)
                              │    │
                              │    ├─── Layout Components
                              │    │    ├─── TabBar
                              │    │    ├─── SidePanel
                              │    │    ├─── StatusBar
                              │    │    └─── InputBox
                              │    │
                              │    ├─── Tab Components
                              │    │    ├─── ChatTab
                              │    │    ├─── ToolsTab
                              │    │    ├─── FilesTab
                              │    │    ├─── SearchTab
                              │    │    ├─── DocsTab
                              │    │    └─── SettingsTab
                              │    │
                              │    └─── Contexts
                              │         ├─── UIContext
                              │         ├─── ChatContext
                              │         ├─── GPUContext
                              │         └─── ReviewContext
                              │
                              └─── Services
                                   ├─── GPU Monitor
                                   ├─── Metrics Collector
                                   ├─── Reasoning Parser
                                   ├─── Docs Service
                                   └─── Theme Manager
```

### Component Hierarchy

```
App
├── LaunchScreen (initial state)
│   ├── LlamaAnimation (standard size)
│   ├── VersionBanner
│   ├── QuickActions
│   └── RecentSessions
│
└── MainInterface (after launch)
    ├── TabBar
    │   └── Tab (x6: Chat, Tools, Files, Search, Docs, Settings)
    │
    ├── ContentArea
    │   ├── ActiveTab (conditional render)
    │   │   ├── ChatTab
    │   │   │   ├── ChatHistory
    │   │   │   │   ├── Message (x N)
    │   │   │   │   │   ├── MessageHeader
    │   │   │   │   │   ├── MessageContent
    │   │   │   │   │   ├── ToolCall (optional)
    │   │   │   │   │   ├── ReasoningBox (optional)
    │   │   │   │   │   └── MetricsDisplay (optional)
    │   │   │   │   └── LlamaAnimation (when waiting)
    │   │   │   └── InputBox
    │   │   │
    │   │   ├── ToolsTab
    │   │   │   ├── PendingReviews
    │   │   │   │   └── ReviewItem (x N)
    │   │   │   │       ├── DiffViewer
    │   │   │   │       └── ReviewActions
    │   │   │   └── ToolHistory
    │   │   │
    │   │   ├── FilesTab
    │   │   │   ├── ContextFilesList
    │   │   │   ├── GitStatusDisplay
    │   │   │   └── GitActions
    │   │   │
    │   │   ├── SearchTab
    │   │   │   ├── SearchInput
    │   │   │   └── SearchResults
    │   │   │
    │   │   ├── DocsTab
    │   │   │   └── DocViewer
    │   │   │       ├── MarkdownRenderer
    │   │   │       └── DocNav (in side panel)
    │   │   │
    │   │   └── SettingsTab
    │   │       ├── ModelPicker
    │   │       ├── ProviderSelector
    │   │       ├── ThemePicker
    │   │       ├── SessionInfo
    │   │       └── OptionsPanel
    │   │
    │   └── SidePanel (collapsible)
    │       ├── ContextSection
    │       ├── GitSection
    │       ├── ReviewSection
    │       └── ToolsSection
    │
    ├── StatusBar
    │   ├── ConnectionStatus
    │   ├── ModelDisplay
    │   ├── TokenUsage
    │   ├── GitStatus
    │   ├── GPUStatus
    │   ├── ReviewCount
    │   └── CostEstimate
    │
    └── InputBox (global)
```

## Components and Interfaces

### 1. CLI Entry Point

**File**: `packages/cli/src/cli.tsx`

```typescript
interface CLIOptions {
  // Execution mode
  prompt?: string;              // Non-interactive prompt
  
  // Model selection
  model?: string;               // Model name
  provider?: string;            // Provider name
  host?: string;                // Provider endpoint
  
  // Model management
  listModels?: boolean;         // List available models
  pullModel?: string;           // Pull/download model
  removeModel?: string;         // Remove model
  modelInfo?: string;           // Show model details
  
  // Output control
  output?: 'text' | 'json' | 'stream-json';
  reviewDiffs?: boolean;        // Enable diff review
  noReview?: boolean;           // Disable diff review
  debug?: boolean;              // Enable debug output
  noColor?: boolean;            // Disable colors
  
  // Configuration
  config?: string;              // Config file path
  session?: string;             // Resume session ID
  
  // Info
  version?: boolean;            // Show version
  help?: boolean;               // Show help
}

interface CLIContext {
  options: CLIOptions;
  config: Config;
  mode: 'interactive' | 'non-interactive';
}
```

### 2. Configuration System

**File**: `packages/cli/src/config/configLoader.ts`

```typescript
interface Config {
  // Provider settings
  provider: {
    default: string;
    ollama?: {
      host: string;
      timeout: number;
    };
    vllm?: {
      host: string;
      apiKey?: string;
    };
    openaiCompatible?: {
      host: string;
      apiKey?: string;
    };
  };
  
  // Model settings
  model: {
    default: string;
    temperature: number;
    maxTokens: number;
  };
  
  // UI settings
  ui: {
    layout: 'hybrid' | 'simple';
    sidePanel: boolean;
    showGpuStats: boolean;
    showCost: boolean;
    
    metrics: {
      enabled: boolean;
      compactMode: boolean;
      showPromptTokens: boolean;
      showTTFT: boolean;
      showInStatusBar: boolean;
    };
    
    reasoning: {
      enabled: boolean;
      maxVisibleLines: number;
      autoCollapseOnComplete: boolean;
    };
  };
  
  // Status settings
  status: {
    pollInterval: number;
    highTempThreshold: number;
    lowVramThreshold: number;
  };
  
  // Review settings
  review: {
    enabled: boolean;
    inlineThreshold: number;  // Lines
  };
  
  // Session settings
  session: {
    autoSave: boolean;
    saveInterval: number;
  };
}

interface ConfigLayer {
  source: 'system' | 'user' | 'workspace' | 'env' | 'cli';
  priority: number;
  data: Partial<Config>;
}

class ConfigLoader {
  loadConfig(): Config;
  mergeConfigs(layers: ConfigLayer[]): Config;
  validateConfig(config: Partial<Config>): ValidationResult;
  getConfigPath(type: 'user' | 'workspace'): string;
}
```

**File**: `packages/cli/src/config/configSchema.ts`

```typescript
// JSON Schema for configuration validation
const configSchema = {
  type: 'object',
  properties: {
    provider: { /* ... */ },
    model: { /* ... */ },
    ui: { /* ... */ },
    status: { /* ... */ },
    review: { /* ... */ },
    session: { /* ... */ }
  },
  required: ['provider', 'model']
};
```

### 3. GPU Monitor Service

**File**: `packages/core/src/services/gpuMonitor.ts`

```typescript
interface GPUInfo {
  available: boolean;
  vendor: 'nvidia' | 'amd' | 'apple' | 'cpu';
  vramTotal: number;        // Bytes
  vramUsed: number;         // Bytes
  vramFree: number;         // Bytes
  temperature: number;      // Celsius
  temperatureMax: number;   // Celsius
  gpuUtilization: number;   // Percentage (0-100)
}

interface GPUMonitor {
  getInfo(): Promise<GPUInfo>;
  startPolling(intervalMs: number): void;
  stopPolling(): void;
  onUpdate(callback: (info: GPUInfo) => void): void;
  onHighTemp(threshold: number, callback: () => void): void;
  onLowVRAM(threshold: number, callback: () => void): void;
}

class DefaultGPUMonitor implements GPUMonitor {
  private vendor: GPUInfo['vendor'] | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private callbacks: Map<string, Function[]> = new Map();
  
  async detectVendor(): Promise<GPUInfo['vendor']>;
  async queryNVIDIA(): Promise<GPUInfo>;
  async queryAMD(): Promise<GPUInfo>;
  async queryApple(): Promise<GPUInfo>;
  async queryCPU(): Promise<GPUInfo>;
}
```

### 4. Non-Interactive Runner

**File**: `packages/cli/src/nonInteractive.ts`

```typescript
interface NonInteractiveOptions {
  prompt: string;
  model?: string;
  provider?: string;
  output: 'text' | 'json' | 'stream-json';
  config: Config;
}

interface NonInteractiveResult {
  response: string;
  metadata?: {
    model: string;
    provider: string;
    tokens: {
      prompt: number;
      completion: number;
      total: number;
    };
    duration: number;
    cost?: number;
  };
}

class NonInteractiveRunner {
  async run(options: NonInteractiveOptions): Promise<NonInteractiveResult>;
  formatOutput(result: NonInteractiveResult, format: string): string;
  handleError(error: Error): never;
}
```

### 5. UI Context Management

**File**: `packages/cli/src/ui/contexts/UIContext.tsx`

```typescript
interface UIState {
  activeTab: TabType;
  sidePanelVisible: boolean;
  theme: Theme;
  keybinds: Keybinds;
  notifications: Notification[];
}

type TabType = 'chat' | 'tools' | 'files' | 'search' | 'docs' | 'settings';

interface Notification {
  id: string;
  tab: TabType;
  count: number;
  type: 'info' | 'warning' | 'error';
}

interface UIContextValue {
  state: UIState;
  setActiveTab: (tab: TabType) => void;
  toggleSidePanel: () => void;
  setTheme: (theme: Theme) => void;
  addNotification: (tab: TabType, type: string) => void;
  clearNotifications: (tab: TabType) => void;
}
```

**File**: `packages/cli/src/ui/contexts/GPUContext.tsx`

```typescript
interface GPUContextValue {
  info: GPUInfo | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

**File**: `packages/cli/src/ui/contexts/ChatContext.tsx`

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  reasoning?: ReasoningBlock;
  metrics?: InferenceMetrics;
}

interface ChatState {
  messages: Message[];
  streaming: boolean;
  waitingForResponse: boolean;
  currentInput: string;
}

interface ChatContextValue {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  cancelGeneration: () => void;
  clearChat: () => void;
  editMessage: (id: string, content: string) => void;
}
```

**File**: `packages/cli/src/ui/contexts/ReviewContext.tsx`

```typescript
interface Review {
  id: string;
  file: string;
  diff: string;
  linesAdded: number;
  linesRemoved: number;
  status: 'pending' | 'approved' | 'rejected';
}

interface ReviewContextValue {
  reviews: Review[];
  pendingCount: number;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  approveAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
}
```

### 6. Layout Components

**File**: `packages/cli/src/ui/components/layout/TabBar.tsx`

```typescript
interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  notifications: Map<TabType, number>;
}

interface Tab {
  id: TabType;
  label: string;
  icon: string;
  shortcut: string;
}

const tabs: Tab[] = [
  { id: 'chat', label: 'Chat', icon: '💬', shortcut: 'Ctrl+1' },
  { id: 'tools', label: 'Tools', icon: '🔧', shortcut: 'Ctrl+2' },
  { id: 'files', label: 'Files', icon: '📁', shortcut: 'Ctrl+3' },
  { id: 'search', label: 'Search', icon: '🔍', shortcut: 'Ctrl+4' },
  { id: 'docs', label: 'Docs', icon: '📚', shortcut: 'Ctrl+5' },
  { id: 'settings', label: 'Settings', icon: '⚙️', shortcut: 'Ctrl+6' }
];
```

**File**: `packages/cli/src/ui/components/layout/SidePanel.tsx`

```typescript
interface SidePanelProps {
  visible: boolean;
  sections: SectionConfig[];
}

interface SectionConfig {
  id: string;
  title: string;
  component: React.ComponentType;
  collapsed: boolean;
}

interface SidePanelSection {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
```

**File**: `packages/cli/src/ui/components/layout/StatusBar.tsx`

```typescript
interface StatusBarProps {
  connection: ConnectionStatus;
  model: string;
  tokens: { current: number; max: number };
  git: GitStatus;
  gpu: GPUInfo | null;
  reviews: number;
  cost: number;
}

interface ConnectionStatus {
  status: 'connected' | 'connecting' | 'disconnected';
  provider: string;
}

interface GitStatus {
  branch: string;
  staged: number;
  modified: number;
}
```

### 7. Chat Components

**File**: `packages/cli/src/ui/components/chat/ChatHistory.tsx`

```typescript
interface ChatHistoryProps {
  messages: Message[];
  streaming: boolean;
  waitingForResponse: boolean;
  scrollToBottom: boolean;
}
```

**File**: `packages/cli/src/ui/components/chat/Message.tsx`

```typescript
interface MessageProps {
  message: Message;
  theme: Theme;
}
```

**File**: `packages/cli/src/ui/components/chat/ToolCall.tsx`

```typescript
interface ToolCallProps {
  toolCall: ToolCall;
  expanded: boolean;
  onToggle: () => void;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: string;
  duration?: number;
  status: 'pending' | 'success' | 'error';
}
```

**File**: `packages/cli/src/ui/components/chat/StreamingIndicator.tsx`

```typescript
interface StreamingIndicatorProps {
  text?: string;
  spinnerType: 'dots' | 'line' | 'arc' | 'bounce';
}

const spinnerFrames = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  bounce: ['⠁', '⠂', '⠄', '⠂']
};
```

### 8. Performance Metrics

**File**: `packages/core/src/types/metrics.ts`

```typescript
interface InferenceMetrics {
  // Raw values from provider
  promptTokens: number;
  completionTokens: number;
  totalDuration: number;       // Nanoseconds
  promptDuration: number;      // Nanoseconds
  evalDuration: number;        // Nanoseconds
  
  // Calculated values
  tokensPerSecond: number;
  timeToFirstToken: number;    // Seconds
  totalSeconds: number;
  
  // Optional
  loadDuration?: number;
}

interface SessionStats {
  totalGenerations: number;
  totalTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTime: number;
  averageSpeed: number;
  fastestSpeed: number;
  slowestSpeed: number;
  averageTTFT: number;
}

interface MetricsConfig {
  enabled: boolean;
  compactMode: boolean;
  showPromptTokens: boolean;
  showTTFT: boolean;
  showInStatusBar: boolean;
}
```

**File**: `packages/core/src/services/metricsCollector.ts`

```typescript
class MetricsCollector {
  private sessionStats: SessionStats;
  private currentGeneration: Partial<InferenceMetrics> | null = null;
  
  startGeneration(): void;
  recordFirstToken(): void;
  recordCompletion(metadata: ProviderMetadata): InferenceMetrics;
  getSessionStats(): SessionStats;
  resetStats(): void;
}
```

**File**: `packages/cli/src/ui/components/chat/MetricsDisplay.tsx`

```typescript
interface MetricsDisplayProps {
  metrics: InferenceMetrics;
  compact: boolean;
  theme: Theme;
}

// Full format:
// ⚡ 42.3 t/s │ 📥 847 tokens │ 📤 156 tokens │ ⏱️ 3.68s │ TTFT: 0.12s

// Compact format:
// ⚡ 42.3 t/s │ 156 tokens │ 3.68s
```

### 9. Reasoning Model Support

**File**: `packages/core/src/parsers/reasoningParser.ts`

```typescript
interface ReasoningBlock {
  content: string;
  tokenCount: number;
  duration: number;
  complete: boolean;
}

class ReasoningParser {
  parse(text: string): { reasoning: ReasoningBlock | null; response: string };
  parseStreaming(chunk: string, state: ParserState): ParserState;
}

interface ParserState {
  buffer: string;
  inThinkBlock: boolean;
  thinkContent: string;
  responseContent: string;
}
```

**File**: `packages/cli/src/ui/components/chat/ReasoningBox.tsx`

```typescript
interface ReasoningBoxProps {
  reasoning: ReasoningBlock;
  expanded: boolean;
  onToggle: () => void;
  maxVisibleLines: number;
  autoScroll: boolean;
}

// Expanded state:
// ┌─ 🧠 Reasoning ──────────────────────────────────── [▼ Collapse] ───────┐
// │ Let me analyze this step by step...                                  ↑ │
// │                                                                      │ │
// │ First, I need to understand the problem:                             │ │
// │ - The user wants to fix a login bug                                  │ │
// │ - The token validation is being skipped                              ░ │
// │                                                                      │ │
// │ Key insight: The condition checks if token exists,                   │ │
// │ but doesn't validate the token itself...                             ↓ │
// └──────────────────────────────────────────────────────────────────────┘

// Collapsed state:
// ┌─ 🧠 Reasoning (847 tokens, 12.3s) ─────────────────── [▶ Expand] ──────┐
// └──────────────────────────────────────────────────────────────────────────┘
```

### 10. Theme System

**File**: `packages/cli/src/ui/uiSettings.ts`

```typescript
interface Theme {
  name: string;
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

interface Typography {
  headers: { bold: boolean; underline: boolean };
  code: { dim: boolean; italic: boolean };
  emphasis: { bold: boolean };
  bullets: string;
  checkmark: string;
  cross: string;
  arrow: string;
  spinner: 'dots' | 'line' | 'arc' | 'bounce';
  borders: 'round' | 'single' | 'double' | 'bold' | 'ascii';
}

interface Keybinds {
  // Tab navigation
  tabChat: string;
  tabTools: string;
  tabFiles: string;
  tabSearch: string;
  tabDocs: string;
  tabSettings: string;
  
  // Layout
  togglePanel: string;
  commandPalette: string;
  toggleDebug: string;
  
  // Chat
  clearChat: string;
  saveSession: string;
  cancel: string;
  send: string;
  newline: string;
  editPrevious: string;
  
  // Review
  approve: string;
  reject: string;
  
  // Navigation
  scrollDown: string;
  scrollUp: string;
  select: string;
  back: string;
  cycleFocus: string;
}

interface UISettings {
  theme: Theme;
  typography: Typography;
  keybinds: Keybinds;
}

const defaultUISettings: UISettings = { /* ... */ };

const builtInThemes: Record<string, Theme> = {
  'default-dark': { /* ... */ },
  'dracula': { /* ... */ },
  'nord': { /* ... */ },
  'monokai': { /* ... */ },
  'solarized-dark': { /* ... */ }
};
```

**File**: `packages/cli/src/ui/services/themeManager.ts`

```typescript
class ThemeManager {
  private currentTheme: Theme;
  private customTheme: Partial<Theme> | null = null;
  
  loadTheme(name: string): Theme;
  loadCustomTheme(path: string): Theme;
  applyTheme(theme: Theme): void;
  mergeThemes(base: Theme, custom: Partial<Theme>): Theme;
  listThemes(): string[];
}
```

### 11. Session Management

**File**: `packages/cli/src/commands/sessionCommands.ts`

```typescript
interface SessionCommand {
  name: string;
  execute: (args: string[]) => Promise<void>;
}

const sessionCommands: SessionCommand[] = [
  {
    name: '/new',
    execute: async () => {
      // Prompt for confirmation
      // Save snapshot
      // Clear context
      // Reset metrics
    }
  },
  {
    name: '/clear',
    execute: async () => {
      // Clear context
      // Preserve system prompt
    }
  },
  {
    name: '/compact',
    execute: async () => {
      // Trigger compression
      // Show before/after stats
    }
  },
  {
    name: '/session save',
    execute: async () => {
      // Persist session
    }
  },
  {
    name: '/session list',
    execute: async () => {
      // Display saved sessions
    }
  },
  {
    name: '/session resume',
    execute: async (args) => {
      // Restore session by ID
    }
  }
];
```

### 12. Docs Service

**File**: `packages/cli/src/services/docsService.ts`

```typescript
interface DocEntry {
  title: string;
  path: string;
  description?: string;
  children?: DocEntry[];
}

interface DocsService {
  getIndex(): DocEntry[];
  loadDoc(path: string): Promise<string>;
  renderMarkdown(content: string): string;
  resolveLink(from: string, to: string): string;
}

const docsIndex: DocEntry[] = [
  { title: 'Getting Started', path: 'docs/README.md' },
  { title: 'Architecture', path: 'docs/architecture.md' },
  { title: 'Configuration', path: 'docs/configuration.md' },
  { title: 'Commands', path: 'docs/commands.md' },
  { title: 'Provider Systems', path: 'docs/provider-systems.md' },
  { title: 'UI Design', path: 'docs/ui-design-spec.md' },
  { title: 'Feature Analysis', path: 'docs/feature-analysis.md' }
];
```

## Data Models

### Configuration Data Model

```typescript
// System defaults (lowest priority)
const systemDefaults: Config = {
  provider: {
    default: 'ollama',
    ollama: {
      host: 'http://localhost:11434',
      timeout: 30000
    }
  },
  model: {
    default: 'llama3.2:3b',
    temperature: 0.7,
    maxTokens: 4096
  },
  ui: {
    layout: 'hybrid',
    sidePanel: true,
    showGpuStats: true,
    showCost: true,
    metrics: {
      enabled: true,
      compactMode: false,
      showPromptTokens: true,
      showTTFT: true,
      showInStatusBar: true
    },
    reasoning: {
      enabled: true,
      maxVisibleLines: 8,
      autoCollapseOnComplete: true
    }
  },
  status: {
    pollInterval: 5000,
    highTempThreshold: 80,
    lowVramThreshold: 512
  },
  review: {
    enabled: true,
    inlineThreshold: 5
  },
  session: {
    autoSave: true,
    saveInterval: 60000
  }
};

// User config (~/.ollm/config.yaml)
// Workspace config (.ollm/config.yaml)
// Environment variables (OLLM_*)
// CLI flags (highest priority)
```

### UI State Data Model

```typescript
interface AppState {
  // Launch state
  launched: boolean;
  
  // UI state
  ui: UIState;
  
  // Chat state
  chat: ChatState;
  
  // Review state
  reviews: Review[];
  
  // GPU state
  gpu: GPUInfo | null;
  
  // Session state
  session: {
    id: string;
    startTime: Date;
    stats: SessionStats;
  };
  
  // Config state
  config: Config;
}
```

### Message Data Model

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  
  // Optional fields
  toolCalls?: ToolCall[];
  reasoning?: ReasoningBlock;
  metrics?: InferenceMetrics;
  
  // UI state
  expanded?: boolean;
  editing?: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Configuration Precedence

*For any* configuration key that appears in multiple layers (system, user, workspace, env, CLI), the final merged configuration should use the value from the highest precedence layer (CLI > env > workspace > user > system).

**Validates: Requirements 1.1, 1.3**

### Property 2: Configuration Validation Errors

*For any* invalid configuration file, the error message should contain the file path and a description of the validation issue.

**Validates: Requirements 1.2, 22.1**

### Property 3: Configuration Defaults

*For any* required configuration key that is missing from all layers, the final configuration should contain the documented default value.

**Validates: Requirements 1.5**

### Property 4: GPU Temperature Warning

*For any* GPU temperature reading above 80°C, the status bar should display a warning indicator.

**Validates: Requirements 2.3**

### Property 5: VRAM Query Structure

*For any* successful VRAM query, the returned GPUInfo should contain total, used, and free VRAM values in bytes.

**Validates: Requirements 2.4**

### Property 6: Non-Interactive Mode Selection

*For any* CLI invocation with the `--prompt` flag, the CLI should execute in non-interactive mode and exit after completion.

**Validates: Requirements 3.1, 3.2**

### Property 7: Output Format Compliance

*For any* non-interactive execution with `--output json`, the output should be valid JSON containing a response field and metadata object.

**Validates: Requirements 3.4**

### Property 8: NDJSON Stream Format

*For any* non-interactive execution with `--output stream-json`, each line of output should be valid JSON.

**Validates: Requirements 3.5**

### Property 9: Error Exit Codes

*For any* error in non-interactive mode, the CLI should write to stderr and exit with a non-zero exit code.

**Validates: Requirements 3.6**

### Property 10: Tab Keyboard Shortcuts

*For any* keyboard shortcut Ctrl+1 through Ctrl+6, the tab bar should switch to the corresponding tab (Chat, Tools, Files, Search, Docs, Settings).

**Validates: Requirements 4.2**

### Property 11: Notification Badge Display

*For any* tab with a notification count greater than zero, the tab bar should display a badge with that count.

**Validates: Requirements 4.3**

### Property 12: Tab State Preservation

*For any* tab switch, the previous tab's state (scroll position, input, selections) should be preserved and restored when returning to that tab.

**Validates: Requirements 4.4**

### Property 13: Active Tab Highlighting

*For any* active tab, the tab bar should apply visual highlighting to distinguish it from inactive tabs.

**Validates: Requirements 4.5**

### Property 14: Side Panel Toggle

*For any* Ctrl+P keypress, the side panel should toggle between visible and hidden states.

**Validates: Requirements 5.1**

### Property 15: Side Panel Visibility Persistence

*For any* side panel visibility state (visible or hidden), that state should be persisted and restored across sessions.

**Validates: Requirements 5.5**

### Property 16: Connection Status Indicators

*For any* provider connection state (connected, connecting, disconnected), the status bar should display the corresponding color indicator (🟢, 🟡, 🔴).

**Validates: Requirements 6.1**

### Property 17: Token Usage Format

*For any* token usage display, the format should be "current/max" where both values are integers.

**Validates: Requirements 6.3**

### Property 18: Review Count Display

*For any* pending review count greater than zero, the status bar should display that count.

**Validates: Requirements 6.6**

### Property 19: Role-Based Message Colors

*For any* message with a role (user, assistant, system, tool), the chat history should apply the theme's corresponding role color.

**Validates: Requirements 7.1**

### Property 20: Tool Call Display Completeness

*For any* tool call, the chat history should display the tool name, arguments, and result (when available).

**Validates: Requirements 7.3**

### Property 21: Long Argument Wrapping

*For any* tool call with arguments exceeding 80 characters, the chat history should wrap the arguments and provide an expand option.

**Validates: Requirements 7.4**

### Property 22: Diff Size Threshold

*For any* diff with 5 or fewer lines, the chat history should display it inline; for diffs with more than 5 lines, it should show a summary with a link to the Tools tab.

**Validates: Requirements 7.6, 7.7**

### Property 23: Review List Completeness

*For any* set of pending reviews, the Tools tab should display all reviews with their file names and line counts.

**Validates: Requirements 9.1**

### Property 24: Review Approval Removal

*For any* review that is approved or rejected, the Tools tab should remove it from the pending list.

**Validates: Requirements 9.3, 9.4**

### Property 25: Metrics Display Completeness

*For any* completed response with metrics, the metrics display should show tokens per second, input tokens, output tokens, and total time.

**Validates: Requirements 15.1, 15.2, 15.3, 15.4**

### Property 26: TTFT Conditional Display

*For any* response with time-to-first-token data available, the metrics display should include the TTFT value.

**Validates: Requirements 15.5**

### Property 27: Compact Metrics Format

*For any* metrics display in compact mode, the output should be abbreviated to show only tokens per second, output tokens, and total time.

**Validates: Requirements 15.6**

### Property 28: Reasoning Block Extraction

*For any* model output containing `<think>...</think>` blocks, the reasoning parser should extract the thinking content and separate it from the response content.

**Validates: Requirements 16.1**

### Property 29: Reasoning Box Toggle

*For any* reasoning box expand/collapse action (click or Ctrl+R), the visibility state should toggle.

**Validates: Requirements 16.6**

### Property 30: Session Resume

*For any* valid session ID provided to `/session resume`, the CLI should restore that session's messages, context, and state.

**Validates: Requirements 17.7**

### Property 31: Theme Merging

*For any* custom theme in `~/.ollm/ui.yaml`, the theme system should deep-merge it over the default theme, preserving unspecified default values.

**Validates: Requirements 18.2**

### Property 32: Theme Switching

*For any* valid theme name provided to `/theme use`, the CLI should apply that theme immediately to all UI components.

**Validates: Requirements 18.4**

### Property 33: Command Suggestions

*For any* unrecognized slash command, the CLI should suggest similar valid commands based on string similarity.

**Validates: Requirements 22.2**

### Property 34: Missing Argument Help

*For any* slash command executed with missing required arguments, the CLI should display usage information for that command.

**Validates: Requirements 22.3**

### Property 35: Connection Error Display

*For any* provider connection failure, the CLI should display the connection status and available retry options.

**Validates: Requirements 22.4**

## Error Handling

### Configuration Errors

**Invalid YAML/JSON Syntax**:
- Parse error with line number and column
- Show the problematic line with a caret indicator
- Suggest common fixes (missing quotes, trailing commas)

**Schema Validation Errors**:
- List all validation failures with paths
- Show expected vs actual types
- Provide examples of valid values

**Missing Required Fields**:
- List missing fields
- Show default values that will be used
- Warn if defaults may not be appropriate

### GPU Monitoring Errors

**GPU Detection Failure**:
- Log warning to debug output
- Fall back to CPU mode silently
- Display "CPU mode" in status bar

**Query Command Failure**:
- Retry up to 3 times with exponential backoff
- Fall back to system RAM if all retries fail
- Log error details to debug output

**High Temperature Warning**:
- Display warning indicator in status bar
- Emit event for potential throttling
- Continue monitoring without interruption

### Non-Interactive Mode Errors

**Provider Connection Failure**:
- Write error to stderr with connection details
- Exit with code 1
- Include retry suggestions in error message

**Model Not Found**:
- Write error to stderr with available models
- Exit with code 2
- Suggest using `--list-models` flag

**Timeout**:
- Write error to stderr with timeout duration
- Exit with code 3
- Suggest increasing timeout or checking provider

**Invalid Output Format**:
- Write error to stderr with valid formats
- Exit with code 4
- Show example of correct usage

### UI Errors

**Component Render Failure**:
- Log error to debug output
- Display error boundary with message
- Provide option to reload or continue

**Theme Loading Failure**:
- Log warning to debug output
- Fall back to default theme
- Continue with default theme

**Keyboard Shortcut Conflict**:
- Log warning to debug output
- Use default keybind
- Show warning in settings tab

## Testing Strategy

### Unit Tests

Unit tests will verify specific examples and edge cases:

**Configuration Loading**:
- Test each configuration layer independently
- Test precedence with specific conflicting values
- Test validation with known invalid configs
- Test default value application

**GPU Monitoring**:
- Test vendor detection with mocked commands
- Test query parsing with sample outputs
- Test fallback behavior with command failures
- Test warning thresholds with specific temperatures

**Non-Interactive Mode**:
- Test each output format with sample responses
- Test error handling with specific error types
- Test stdin reading with piped input
- Test exit codes for different scenarios

**UI Components**:
- Test tab switching with specific tab IDs
- Test side panel toggle with state changes
- Test status bar updates with sample data
- Test message rendering with different roles

**Metrics Collection**:
- Test calculation with known provider metadata
- Test session stats aggregation
- Test compact mode formatting
- Test TTFT extraction

**Reasoning Parser**:
- Test parsing with complete think blocks
- Test streaming with partial blocks
- Test extraction with nested blocks
- Test error handling with malformed blocks

**Theme System**:
- Test built-in theme loading
- Test custom theme merging
- Test theme switching
- Test validation with invalid themes

### Property-Based Tests

Property-based tests will verify universal properties across all inputs:

**Property 1: Configuration Precedence** (100 iterations)
- Generate random configurations at each layer
- Verify highest precedence value is used
- Tag: **Feature: stage-06-cli-ui, Property 1: Configuration Precedence**

**Property 2: Configuration Validation Errors** (100 iterations)
- Generate random invalid configurations
- Verify error messages contain file path and issue
- Tag: **Feature: stage-06-cli-ui, Property 2: Configuration Validation Errors**

**Property 3: Configuration Defaults** (100 iterations)
- Generate configurations with random missing keys
- Verify defaults are applied correctly
- Tag: **Feature: stage-06-cli-ui, Property 3: Configuration Defaults**

**Property 4: GPU Temperature Warning** (100 iterations)
- Generate random temperature readings
- Verify warning appears when > 80°C
- Tag: **Feature: stage-06-cli-ui, Property 4: GPU Temperature Warning**

**Property 5: VRAM Query Structure** (100 iterations)
- Generate random VRAM query responses
- Verify structure contains required fields
- Tag: **Feature: stage-06-cli-ui, Property 5: VRAM Query Structure**

**Property 6: Non-Interactive Mode Selection** (100 iterations)
- Generate random prompts with --prompt flag
- Verify non-interactive mode is used
- Tag: **Feature: stage-06-cli-ui, Property 6: Non-Interactive Mode Selection**

**Property 7: Output Format Compliance** (100 iterations)
- Generate random responses with --output json
- Verify output is valid JSON with required fields
- Tag: **Feature: stage-06-cli-ui, Property 7: Output Format Compliance**

**Property 8: NDJSON Stream Format** (100 iterations)
- Generate random streaming responses
- Verify each line is valid JSON
- Tag: **Feature: stage-06-cli-ui, Property 8: NDJSON Stream Format**

**Property 9: Error Exit Codes** (100 iterations)
- Generate random errors in non-interactive mode
- Verify stderr output and non-zero exit code
- Tag: **Feature: stage-06-cli-ui, Property 9: Error Exit Codes**

**Property 10: Tab Keyboard Shortcuts** (100 iterations)
- Generate random tab switch sequences
- Verify correct tab is activated
- Tag: **Feature: stage-06-cli-ui, Property 10: Tab Keyboard Shortcuts**

**Property 11: Notification Badge Display** (100 iterations)
- Generate random notification counts
- Verify badges display correct counts
- Tag: **Feature: stage-06-cli-ui, Property 11: Notification Badge Display**

**Property 12: Tab State Preservation** (100 iterations)
- Generate random tab states and switch sequences
- Verify state is preserved and restored
- Tag: **Feature: stage-06-cli-ui, Property 12: Tab State Preservation**

**Property 13: Active Tab Highlighting** (100 iterations)
- Generate random tab activations
- Verify highlighting is applied
- Tag: **Feature: stage-06-cli-ui, Property 13: Active Tab Highlighting**

**Property 14: Side Panel Toggle** (100 iterations)
- Generate random toggle sequences
- Verify state toggles correctly
- Tag: **Feature: stage-06-cli-ui, Property 14: Side Panel Toggle**

**Property 15: Side Panel Visibility Persistence** (100 iterations)
- Generate random visibility states
- Verify persistence across sessions
- Tag: **Feature: stage-06-cli-ui, Property 15: Side Panel Visibility Persistence**

**Property 16: Connection Status Indicators** (100 iterations)
- Generate random connection states
- Verify correct indicator is displayed
- Tag: **Feature: stage-06-cli-ui, Property 16: Connection Status Indicators**

**Property 17: Token Usage Format** (100 iterations)
- Generate random token counts
- Verify format is "current/max"
- Tag: **Feature: stage-06-cli-ui, Property 17: Token Usage Format**

**Property 18: Review Count Display** (100 iterations)
- Generate random review counts
- Verify display when count > 0
- Tag: **Feature: stage-06-cli-ui, Property 18: Review Count Display**

**Property 19: Role-Based Message Colors** (100 iterations)
- Generate random messages with different roles
- Verify correct color is applied
- Tag: **Feature: stage-06-cli-ui, Property 19: Role-Based Message Colors**

**Property 20: Tool Call Display Completeness** (100 iterations)
- Generate random tool calls
- Verify all components are displayed
- Tag: **Feature: stage-06-cli-ui, Property 20: Tool Call Display Completeness**

**Property 21: Long Argument Wrapping** (100 iterations)
- Generate random tool arguments of varying lengths
- Verify wrapping when > 80 characters
- Tag: **Feature: stage-06-cli-ui, Property 21: Long Argument Wrapping**

**Property 22: Diff Size Threshold** (100 iterations)
- Generate random diffs of varying sizes
- Verify inline display for ≤5 lines, summary for >5 lines
- Tag: **Feature: stage-06-cli-ui, Property 22: Diff Size Threshold**

**Property 23: Review List Completeness** (100 iterations)
- Generate random sets of pending reviews
- Verify all reviews are displayed
- Tag: **Feature: stage-06-cli-ui, Property 23: Review List Completeness**

**Property 24: Review Approval Removal** (100 iterations)
- Generate random reviews and approval/rejection actions
- Verify removal from pending list
- Tag: **Feature: stage-06-cli-ui, Property 24: Review Approval Removal**

**Property 25: Metrics Display Completeness** (100 iterations)
- Generate random response metrics
- Verify all required metrics are displayed
- Tag: **Feature: stage-06-cli-ui, Property 25: Metrics Display Completeness**

**Property 26: TTFT Conditional Display** (100 iterations)
- Generate random responses with/without TTFT
- Verify TTFT is shown when available
- Tag: **Feature: stage-06-cli-ui, Property 26: TTFT Conditional Display**

**Property 27: Compact Metrics Format** (100 iterations)
- Generate random metrics in compact mode
- Verify abbreviated format
- Tag: **Feature: stage-06-cli-ui, Property 27: Compact Metrics Format**

**Property 28: Reasoning Block Extraction** (100 iterations)
- Generate random outputs with think blocks
- Verify extraction and separation
- Tag: **Feature: stage-06-cli-ui, Property 28: Reasoning Block Extraction**

**Property 29: Reasoning Box Toggle** (100 iterations)
- Generate random toggle actions
- Verify state toggles correctly
- Tag: **Feature: stage-06-cli-ui, Property 29: Reasoning Box Toggle**

**Property 30: Session Resume** (100 iterations)
- Generate random sessions and resume actions
- Verify session is restored correctly
- Tag: **Feature: stage-06-cli-ui, Property 30: Session Resume**

**Property 31: Theme Merging** (100 iterations)
- Generate random custom themes
- Verify deep merge with defaults
- Tag: **Feature: stage-06-cli-ui, Property 31: Theme Merging**

**Property 32: Theme Switching** (100 iterations)
- Generate random theme switches
- Verify theme is applied immediately
- Tag: **Feature: stage-06-cli-ui, Property 32: Theme Switching**

**Property 33: Command Suggestions** (100 iterations)
- Generate random unrecognized commands
- Verify suggestions are provided
- Tag: **Feature: stage-06-cli-ui, Property 33: Command Suggestions**

**Property 34: Missing Argument Help** (100 iterations)
- Generate random commands with missing arguments
- Verify usage information is displayed
- Tag: **Feature: stage-06-cli-ui, Property 34: Missing Argument Help**

**Property 35: Connection Error Display** (100 iterations)
- Generate random connection failures
- Verify error display includes status and retry options
- Tag: **Feature: stage-06-cli-ui, Property 35: Connection Error Display**

### Integration Tests

Integration tests will verify component interactions:

**Configuration to UI Flow**:
- Load configuration from all layers
- Verify UI reflects merged configuration
- Test theme application from config

**GPU Monitoring to Status Bar**:
- Start GPU monitoring
- Verify status bar updates with GPU info
- Test warning indicators

**Chat to Metrics Flow**:
- Send message and receive response
- Verify metrics are collected and displayed
- Test session stats aggregation

**Review to Tools Tab Flow**:
- Generate diff from tool call
- Verify review appears in Tools tab
- Test approve/reject workflow

**Session Management Flow**:
- Create session with messages
- Save session
- Resume session
- Verify state is restored

**Theme Switching Flow**:
- Load default theme
- Switch to custom theme
- Verify all components update

### Testing Tools

- **Vitest**: Test framework for unit and property tests
- **fast-check**: Property-based testing library
- **ink-testing-library**: Testing utilities for Ink components
- **mock-fs**: File system mocking for configuration tests
- **msw**: Mock Service Worker for provider API mocking

### Test Coverage Goals

- Unit test coverage: >80% for all modules
- Property test coverage: All 35 properties implemented
- Integration test coverage: All major workflows
- Edge case coverage: Error conditions, boundary values, fallbacks
