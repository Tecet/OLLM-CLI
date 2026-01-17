/**
 * Configuration types for OLLM CLI
 */

export interface ProviderConfig {
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
}

export interface ModelConfig {
  default: string;
  temperature: number;
  maxTokens: number;
}

export interface MetricsConfig {
  enabled: boolean;
  compactMode: boolean;
  showPromptTokens: boolean;
  showTTFT: boolean;
  showInStatusBar: boolean;
}

export interface ReasoningConfig {
  enabled: boolean;
  maxVisibleLines: number;
  autoCollapseOnComplete: boolean;
}

export interface UIConfig {
  layout: 'hybrid' | 'simple';
  sidePanel: boolean;
  theme?: string;
  showGpuStats: boolean;
  showCost: boolean;
  metrics: MetricsConfig;
  reasoning: ReasoningConfig;
}

export interface StatusConfig {
  pollInterval: number;
  highTempThreshold: number;
  lowVramThreshold: number;
}

export interface ReviewConfig {
  enabled: boolean;
  inlineThreshold: number;
}

export interface SessionConfig {
  autoSave: boolean;
  saveInterval: number;
}

/**
 * Context management configuration
 * Controls VRAM-aware context sizing and compression
 */
export interface ContextConfig {
  /** Target context size in tokens */
  targetSize: number;
  /** Minimum context size in tokens */
  minSize: number;
  /** Maximum context size in tokens */
  maxSize: number;
  /** Enable automatic context sizing based on VRAM */
  autoSize: boolean;
  /** VRAM buffer to reserve (in bytes) */
  vramBuffer: number;
  /** Enable automatic context compression */
  compressionEnabled: boolean;
  /** Threshold (0-1) to trigger compression */
  compressionThreshold: number;
  /** Enable snapshots for context restoration */
  snapshotsEnabled: boolean;
  /** Maximum number of snapshots to keep */
  maxSnapshots: number;
}

export interface Config {
  provider: ProviderConfig;
  model: ModelConfig;
  ui: UIConfig;
  status: StatusConfig;
  review: ReviewConfig;
  session: SessionConfig;
  context?: ContextConfig;
}

export type ConfigLayer = 'system' | 'user' | 'workspace' | 'env' | 'cli';

export interface ConfigSource {
  layer: ConfigLayer;
  priority: number;
  data: Partial<Config>;
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Configuration error with enhanced details
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly line?: number,
    public readonly column?: number,
    public readonly snippet?: string
  ) {
    super(message);
    this.name = 'ConfigError';
  }
  
  toString(): string {
    let result = `Configuration Error: ${this.message}`;
    
    if (this.filePath) {
      result += `\n  File: ${this.filePath}`;
    }
    
    if (this.line !== undefined) {
      result += `\n  Line: ${this.line}`;
      if (this.column !== undefined) {
        result += `, Column: ${this.column}`;
      }
    }
    
    if (this.snippet) {
      result += `\n\n${this.snippet}`;
    }
    
    return result;
  }
}

/**
 * Visual Theme Definition
 */
export interface Theme {
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
  border: {
    primary: string;
    secondary: string;
    active: string;
  };
  diff: {
    added: string;
    removed: string;
  };
}

/**
 * Typography Definition
 */
export interface Typography {
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

/**
 * Keyboard Shortcuts Definition
 */
export interface Keybinds {
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

/**
 * Combined UI Settings (Theme + Look & Feel)
 */
export interface UISettings {
  theme: Theme;
  typography: Typography;
  keybinds: Keybinds;
}

/**
 * Profile Configuration Types
 */
export interface ContextProfile {
  size: number;
  size_label?: string;
  vram_estimate: string;
}

export interface LLMProfile {
  id: string;
  name: string;
  creator: string;
  parameters: string;
  quantization: string;
  description: string;
  abilities: string[];
  tool_support?: boolean;
  reasoning_buffer?: string;
  ollama_url?: string;
  default_context?: number;
  context_window: number;
  context_profiles: ContextProfile[];
}

export interface UserModelEntry {
  id: string;
  name?: string;
  source?: string;
  last_seen?: string;
  description?: string;
  abilities?: string[];
  tool_support?: boolean;
  context_profiles?: ContextProfile[];
  default_context?: number;
  manual_context?: number;
}

export interface ContextBehaviorProfile {
  name: string;
  contextWindow: number;
  compressionThreshold: number;
  retentionRatio: number;
  strategy: string;
  summaryPrompt: string;
}

export interface ContextSettings {
  activeProfile: string;
  profiles: Record<string, ContextBehaviorProfile>;
}

export interface ProfilesData {
  version?: string;
  context_behavior?: ContextSettings;
  fallback_model?: {
    description?: string;
    tool_support?: boolean;
    context_sizes?: number[];
    default_context?: number;
  };
  models: LLMProfile[];
}
