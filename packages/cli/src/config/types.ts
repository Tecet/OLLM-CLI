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
