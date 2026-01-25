/**
 * Configuration types for OLLM CLI
 */

// Re-export ConfigError from centralized errors
export { ConfigError } from '@ollm/ollm-cli-core/errors/index.js';

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
 * Mode switching configuration
 */
export interface ModeSwitchingConfig {
  enabled: boolean;
  confidenceThreshold: number;
  minDuration: number;
  cooldown: number;
}

/**
 * Per-mode enable/disable configuration
 */
export interface ModeEnableConfig {
  enabled: boolean;
}

/**
 * Prompt mode configuration
 */
export interface PromptConfig {
  mode: 'auto' | 'assistant' | 'planning' | 'developer' | 'tool' | 'debugger' | 'security' | 'reviewer' | 'performance';
  switching: ModeSwitchingConfig;
  modes: {
    assistant: ModeEnableConfig;
    planning: ModeEnableConfig;
    developer: ModeEnableConfig;
    tool: ModeEnableConfig;
    debugger: ModeEnableConfig;
    security: ModeEnableConfig;
    reviewer: ModeEnableConfig;
    performance: ModeEnableConfig;
  };
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
  prompt?: PromptConfig;
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

export interface UISettings {
  theme: Theme;
  typography: Typography;
  keybinds: Keybinds;
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
    style?: 'round' | 'single' | 'double' | 'bold' | 'ascii';
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
  tabGithub: string;
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
 * Profile Configuration Types
 */
export interface ContextProfile {
  size: number;
  size_label?: string;
  vram_estimate?: string;
  /** Coerced numeric VRAM estimate in GB (preferred) */
  vram_estimate_gb?: number;
  ollama_context_size?: number; // 85% cap for natural stops (optional, calculated if not provided)
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
  thinking_enabled?: boolean;
  reasoning_buffer?: string;
  warmup_timeout?: number;
  ollama_url?: string;
  default_context?: number;
  // Use `max_context_window` as the canonical field name. Older files may still include `context_window`.
  max_context_window?: number;
  context_window?: number;
  context_profiles: ContextProfile[];
}

/**
 * Source of tool support information
 * - profile: From LLM_profiles.json
 * - user_confirmed: User manually confirmed via prompt
 * - auto_detected: Automatically detected via test request
 * - runtime_error: Detected from runtime error during usage
 */
export type ToolSupportSource = 'profile' | 'user_confirmed' | 'auto_detected' | 'runtime_error';

export interface UserModelEntry {
  id: string;
  name?: string;
  source?: string;
  last_seen?: string;
  description?: string;
  abilities?: string[];
  tool_support?: boolean;
  tool_support_source?: ToolSupportSource;
  tool_support_confirmed_at?: string;
  context_profiles?: ContextProfile[];
  default_context?: number;
  manual_context?: number;
  max_context_window?: number;
  quantization?: string;
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
