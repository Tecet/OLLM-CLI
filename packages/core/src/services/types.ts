/**
 * Shared types and interfaces for all services
 */

/**
 * Message part types
 */
export interface TextPart {
  type: 'text';
  text: string;
}

export type MessagePart = TextPart;

/**
 * Session message structure
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  parts: MessagePart[];
  timestamp: string; // ISO 8601
}

/**
 * Tool call result structure
 */
export interface ToolCallResult {
  llmContent: string;
  returnDisplay?: string;
}

/**
 * Session tool call structure
 */
export interface SessionToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: ToolCallResult;
  timestamp: string; // ISO 8601
}

/**
 * Session metadata
 */
export interface SessionMetadata {
  tokenCount: number;
  compressionCount: number;
  modeHistory?: Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }>;
}

/**
 * Complete session structure
 */
export interface Session {
  sessionId: string; // UUID
  startTime: string; // ISO 8601
  lastActivity: string; // ISO 8601
  model: string;
  provider: string;
  messages: SessionMessage[];
  toolCalls: SessionToolCall[];
  metadata: SessionMetadata;
}

/**
 * Session summary for listing
 */
export interface SessionSummary {
  sessionId: string;
  startTime: string;
  lastActivity: string;
  model: string;
  messageCount: number;
  tokenCount: number;
}

/**
 * Compression strategies
 */
export type CompressionStrategy = 'summarize' | 'truncate' | 'hybrid';

/**
 * Compression options
 */
export interface CompressionOptions {
  strategy: CompressionStrategy;
  preserveRecentTokens: number; // Keep this many recent tokens intact
  targetTokens?: number; // Target size after compression
}

/**
 * Compression result
 */
export interface CompressionResult {
  compressedMessages: SessionMessage[];
  originalTokenCount: number;
  compressedTokenCount: number;
  strategy: CompressionStrategy;
}

/**
 * Loop detection pattern types
 */
export type LoopPatternType = 'repeated-tool' | 'repeated-output' | 'turn-limit';

/**
 * Loop pattern details
 */
export interface LoopPattern {
  type: LoopPatternType;
  details: string;
  count: number;
}

/**
 * Loop detection configuration
 */
export interface LoopDetectionConfig {
  maxTurns: number; // Default: 50
  repeatThreshold: number; // Default: 3
  enabled: boolean;
}

/**
 * Context entry structure
 */
export interface ContextEntry {
  key: string;
  content: string;
  priority: number; // Higher priority appears first
  source: 'hook' | 'extension' | 'user' | 'system';
  timestamp: string; // ISO 8601
}

/**
 * File entry structure for discovery
 */
export interface FileEntry {
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
}

/**
 * File discovery options
 */
export interface DiscoveryOptions {
  root: string;
  maxDepth?: number;
  includePatterns?: string[]; // Glob patterns
  excludePatterns?: string[]; // Glob patterns
  followSymlinks?: boolean;
}

/**
 * File change event types
 */
export type FileChangeEvent = 'add' | 'change' | 'unlink';

/**
 * Disposable interface for cleanup
 */
export interface Disposable {
  dispose(): void;
}

/**
 * Environment sanitization configuration
 */
export interface SanitizationConfig {
  allowList: string[]; // Exact variable names
  denyPatterns: string[]; // Glob patterns
}

/**
 * Service configuration for all services
 */
export interface ServicesConfig {
  session?: {
    dataDir?: string;
    maxSessions?: number;
    autoSave?: boolean;
  };
  compression?: {
    enabled?: boolean;
    threshold?: number;
    strategy?: CompressionStrategy;
    preserveRecent?: number;
  };
  loopDetection?: {
    enabled?: boolean;
    maxTurns?: number;
    repeatThreshold?: number;
  };
  fileDiscovery?: {
    maxDepth?: number;
    followSymlinks?: boolean;
    builtinIgnores?: string[];
  };
  environment?: {
    allowList?: string[];
    denyPatterns?: string[];
  };
  contextManagement?: {
    targetSize?: number;
    minSize?: number;
    maxSize?: number;
    autoSize?: boolean;
    vramBuffer?: number;
    kvQuantization?: 'f16' | 'q8_0' | 'q4_0';
    compression?: {
      enabled?: boolean;
      threshold?: number;
      strategy?: 'summarize' | 'truncate' | 'hybrid';
      preserveRecent?: number;
      summaryMaxTokens?: number;
    };
    snapshots?: {
      enabled?: boolean;
      maxCount?: number;
      autoCreate?: boolean;
      autoThreshold?: number;
    };
  };
  model?: {
    default?: string;
    routing?: {
      enabled?: boolean;
      defaultProfile?: string;
      overrides?: Record<string, string>;
    };
    keepAlive?: {
      enabled?: boolean;
      models?: string[];
      timeout?: number;
    };
    cacheTTL?: number;
    toolRouting?: {
      enabled?: boolean;
      bindings?: Record<string, string>;
      enableFallback?: boolean;
    };
  };
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    numCtx?: number;
  };
  memory?: {
    enabled?: boolean;
    tokenBudget?: number;
    storagePath?: string;
  };
  templates?: {
    directories?: string[];
  };
  project?: {
    profile?: string;
    autoDetect?: boolean;
  };
}
