/**
 * Context Management System - Core Types and Interfaces
 * 
 * This module defines all interfaces and types for the context management system,
 * including VRAM monitoring, token counting, context pooling, snapshots, compression,
 * and memory safety.
 */

// ============================================================================
// VRAM Monitor Types
// ============================================================================

/**
 * Information about GPU memory status
 */
export interface VRAMInfo {
  /** Total VRAM in bytes */
  total: number;
  /** Currently used VRAM in bytes */
  used: number;
  /** Available VRAM for allocation in bytes */
  available: number;
  /** Memory used by loaded model in bytes */
  modelLoaded: number;
}

/**
 * GPU type detected on the system
 */
export enum GPUType {
  NVIDIA = 'nvidia',
  AMD = 'amd',
  APPLE_SILICON = 'apple',
  WINDOWS = 'windows',
  CPU_ONLY = 'cpu'
}

/**
 * GPU detection interface
 */
export interface GPUDetector {
  /** Detect GPU type on system */
  detectGPU(): Promise<GPUType>;
  /** Check if GPU is available */
  hasGPU(): Promise<boolean>;
}

/**
 * VRAM monitoring interface
 */
export interface VRAMMonitor {
  /** Query current memory status */
  getInfo(): Promise<VRAMInfo>;
  /** Get memory available for context allocation */
  getAvailableForContext(): Promise<number>;
  /** Register callback for low memory events */
  onLowMemory(callback: (info: VRAMInfo) => void): void;
  /** Start monitoring with specified interval */
  startMonitoring(intervalMs: number): void;
  /** Stop monitoring */
  stopMonitoring(): void;
}

// ============================================================================
// Token Counter Types
// ============================================================================

/**
 * Token count cache interface
 */
export interface TokenCountCache {
  /** Get cached token count for message */
  get(messageId: string): number | undefined;
  /** Set token count for message */
  set(messageId: string, count: number): void;
  /** Clear all cached counts */
  clear(): void;
}

/**
 * Token counting interface
 */
export interface TokenCounter {
  /** Count tokens in text */
  countTokens(text: string): Promise<number>;
  /** Count tokens using cached value if available */
  countTokensCached(messageId: string, text: string): number;
  /** Count total tokens in conversation */
  countConversationTokens(messages: Message[]): number;
  /** Clear cache */
  clearCache(): void;
}

// ============================================================================
// Context Pool Types
// ============================================================================

/**
 * KV cache quantization types
 */
export type KVQuantization = 'f16' | 'q8_0' | 'q4_0';

/**
 * Context pool configuration
 */
export interface ContextPoolConfig {
  /** Minimum context size in tokens (default: 2048) */
  minContextSize: number;
  /** Maximum context size in tokens (model limit) */
  maxContextSize: number;
  /** User-preferred context size in tokens */
  targetContextSize: number;
  /** Safety buffer in bytes (default: 512MB) */
  reserveBuffer: number;
  /** KV cache quantization type */
  kvCacheQuantization: KVQuantization;
  /** Enable automatic sizing based on VRAM */
  autoSize: boolean;
}

/**
 * Context usage statistics
 */
export interface ContextUsage {
  /** Current token count */
  currentTokens: number;
  /** Maximum token capacity */
  maxTokens: number;
  /** Usage percentage (0-100) */
  percentage: number;
  /** VRAM used in bytes */
  vramUsed: number;
  /** Total VRAM in bytes */
  vramTotal: number;
}

/**
 * Model information for context calculations
 */
export interface ModelInfo {
  /** Model size in billions of parameters */
  parameters: number;
  /** Maximum context tokens supported */
  contextLimit: number;
}

/**
 * Context pool interface
 */
export interface ContextPool {
  /** Current configuration */
  config: ContextPoolConfig;
  /** Current context size in tokens */
  currentSize: number;
  /** Calculate optimal context size based on available VRAM */
  calculateOptimalSize(vramInfo: VRAMInfo, modelInfo: ModelInfo): number;
  /** Resize context (may require model reload) */
  resize(newSize: number): Promise<void>;
  /** Get current usage statistics */
  getUsage(): ContextUsage;
  /** Update configuration */
  updateConfig(config: Partial<ContextPoolConfig>): void;
  /** Set current token count */
  setCurrentTokens(tokens: number): void;
  /** Update VRAM information */
  updateVRAMInfo(vramInfo: VRAMInfo): void;
  /** Track active request start */
  beginRequest(): void;
  /** Track active request end */
  endRequest(): void;
  /** Check if there are active requests */
  hasActiveRequests(): boolean;
}

// ============================================================================
// Snapshot Types
// ============================================================================

/**
 * Context snapshot metadata
 */
export interface SnapshotMetadata {
  /** Unique snapshot ID */
  id: string;
  /** Associated session ID */
  sessionId: string;
  /** Creation timestamp */
  timestamp: Date;
  /** Total tokens at snapshot */
  tokenCount: number;
  /** Brief summary of content */
  summary: string;
  /** File size in bytes */
  size: number;
}

/**
 * Complete context snapshot
 */
export interface ContextSnapshot {
  /** Unique snapshot ID (UUID) */
  id: string;
  /** Associated session */
  sessionId: string;
  /** Creation time */
  timestamp: Date;
  /** Total tokens at snapshot */
  tokenCount: number;
  /** Brief summary of content */
  summary: string;
  /** Full conversation messages */
  messages: Message[];
  /** Additional metadata */
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
  };
}

/**
 * Snapshot configuration
 */
export interface SnapshotConfig {
  /** Enable snapshot functionality */
  enabled: boolean;
  /** Maximum snapshots to keep (default: 5) */
  maxCount: number;
  /** Auto-create at threshold */
  autoCreate: boolean;
  /** Threshold for auto-creation (default: 0.8) */
  autoThreshold: number;
}

/**
 * Snapshot manager interface
 */
export interface SnapshotManager {
  /** Set the current session ID */
  setSessionId(sessionId: string): void;
  /** Create snapshot from current context */
  createSnapshot(context: ConversationContext): Promise<ContextSnapshot>;
  /** Restore context from snapshot */
  restoreSnapshot(snapshotId: string): Promise<ConversationContext>;
  /** List snapshots for a session */
  listSnapshots(sessionId: string): Promise<ContextSnapshot[]>;
  /** Delete a snapshot */
  deleteSnapshot(snapshotId: string): Promise<void>;
  /** Register threshold callback */
  onContextThreshold(threshold: number, callback: () => void): void;
  /** Register pre-overflow callback */
  onBeforeOverflow(callback: () => void): void;
  /** Check context usage and trigger callbacks */
  checkThresholds(currentTokens: number, maxTokens: number): void;
  /** Update configuration */
  updateConfig(config: Partial<SnapshotConfig>): void;
  /** Get current configuration */
  getConfig(): SnapshotConfig;
  /** Cleanup old snapshots */
  cleanupOldSnapshots(maxCount: number): Promise<void>;
}

/**
 * Snapshot storage interface
 */
export interface SnapshotStorage {
  /** Save snapshot to disk */
  save(snapshot: ContextSnapshot): Promise<void>;
  /** Load snapshot from disk */
  load(snapshotId: string): Promise<ContextSnapshot>;
  /** List all snapshots for a session */
  list(sessionId: string): Promise<SnapshotMetadata[]>;
  /** Delete snapshot */
  delete(snapshotId: string): Promise<void>;
  /** Check if snapshot exists */
  exists(snapshotId: string): Promise<boolean>;
  /** Verify snapshot integrity */
  verify(snapshotId: string): Promise<boolean>;
  /** Get the base storage path */
  getBasePath(): string;
}

// ============================================================================
// Compression Types
// ============================================================================

/**
 * Compression strategy type
 */
export type CompressionStrategyType = 'summarize' | 'truncate' | 'hybrid';

/**
 * Compression strategy configuration
 */
export interface CompressionStrategy {
  /** Strategy type */
  type: CompressionStrategyType;
  /** Tokens to keep uncompressed */
  preserveRecent: number;
  /** Max tokens for summary */
  summaryMaxTokens: number;
  /** Optional timeout for LLM summarization in milliseconds */
  summaryTimeout?: number;
}

/**
 * Compressed context result
 */
export interface CompressedContext {
  /** System message with summary */
  summary: Message;
  /** Recent messages kept intact */
  preserved: Message[];
  /** Original token count */
  originalTokens: number;
  /** Compressed token count */
  compressedTokens: number;
  /** Compression ratio (compressed/original) */
  compressionRatio: number;
  /** Status of the compression attempt */
  status?: 'success' | 'inflated';
}

/**
 * Compression estimation result
 */
export interface CompressionEstimate {
  /** Estimated token count after compression */
  estimatedTokens: number;
  /** Estimated compression ratio */
  estimatedRatio: number;
  /** Strategy used for estimation */
  strategy: CompressionStrategy;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  /** Enable compression */
  enabled: boolean;
  /** Trigger at % capacity (default: 0.8) */
  threshold: number;
  /** Strategy to use */
  strategy: CompressionStrategyType;
  /** Tokens to preserve (default: 4096) */
  preserveRecent: number;
  /** Max summary size (default: 1024) */
  summaryMaxTokens: number;
}

/**
 * Compression service interface
 */
export interface ICompressionService {
  /** Compress messages using specified strategy */
  compress(
    messages: Message[],
    strategy: CompressionStrategy
  ): Promise<CompressedContext>;
  /** Estimate compression without performing it */
  estimateCompression(messages: Message[]): CompressionEstimate;
  /** Check if compression is needed */
  shouldCompress(tokenCount: number, threshold: number): boolean;
}

// ============================================================================
// Memory Guard Types
// ============================================================================

/**
 * Memory usage level
 */
export enum MemoryLevel {
  NORMAL = 'normal',      // < 80%
  WARNING = 'warning',    // 80-90%
  CRITICAL = 'critical',  // 90-95%
  EMERGENCY = 'emergency' // > 95%
}

/**
 * Memory threshold configuration
 */
export interface MemoryThresholds {
  /** Soft limit - trigger compression (80%) */
  soft: number;
  /** Hard limit - force context reduction (90%) */
  hard: number;
  /** Critical limit - emergency snapshot + clear (95%) */
  critical: number;
}

/**
 * Memory guard configuration
 */
export interface MemoryGuardConfig {
  /** Safety buffer in bytes (default: 512MB) */
  safetyBuffer: number;
  /** Memory thresholds */
  thresholds: MemoryThresholds;
}

/**
 * Memory guard interface
 */
export interface MemoryGuard {
  /** Check if allocation is safe */
  canAllocate(requestedTokens: number): boolean;
  /** Get safe allocation limit */
  getSafeLimit(): number;
  /** Handle memory threshold events */
  onThreshold(level: MemoryLevel, callback: () => void | Promise<void>): void;
  /** Execute emergency actions */
  executeEmergencyActions(): Promise<void>;
  /** Set services for memory guard */
  setServices(services: { compression: ICompressionService; snapshot: SnapshotManager }): void;
  /** Set context for memory guard */
  setContext(context: ConversationContext): void;
  /** Check current memory level */
  checkMemoryLevel(): MemoryLevel;
  /** Update configuration */
  updateConfig(config: Partial<MemoryGuardConfig>): void;
  /** Check current memory level and trigger appropriate actions */
  checkMemoryLevelAndAct(): Promise<void>;
  /** Register event listener */
  on(event: string, callback: (data: unknown) => void): void;
}

// ============================================================================
// Message and Context Types
// ============================================================================

/**
 * Tool call information
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Tool result information
 */
export interface ToolResult {
  toolCallId: string;
  result: string;
  error?: string;
}

/**
 * Message in conversation
 */
export interface Message {
  /** Unique message ID */
  id: string;
  /** Message role */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** Message content */
  content: string;
  /** Message timestamp */
  timestamp: Date;
  /** Tool calls made by assistant */
  toolCalls?: ToolCall[];
  /** Tool call ID for tool role */
  toolCallId?: string;
  /** Cached token count */
  tokenCount?: number;
  /** Additional metadata */
  metadata?: {
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  };
}

/**
 * Compression event in history
 */
export interface CompressionEvent {
  /** Event timestamp */
  timestamp: Date;
  /** Strategy used */
  strategy: string;
  /** Original token count */
  originalTokens: number;
  /** Compressed token count */
  compressedTokens: number;
  /** Compression ratio */
  ratio: number;
}

/**
 * Conversation context
 */
export interface ConversationContext {
  /** Session ID */
  sessionId: string;
  /** All messages in conversation */
  messages: Message[];
  /** System prompt message */
  systemPrompt: Message;
  /** Total token count */
  tokenCount: number;
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Additional metadata */
  metadata: {
    model: string;
    contextSize: number;
    compressionHistory: CompressionEvent[];
  };
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Complete context management configuration
 */
export interface ContextConfig {
  /** Target context size in tokens */
  targetSize: number;
  /** Minimum context size in tokens */
  minSize: number;
  /** Maximum context size in tokens */
  maxSize: number;
  /** Enable automatic sizing */
  autoSize: boolean;
  /** VRAM buffer in bytes */
  vramBuffer: number;
  /** KV cache quantization type */
  kvQuantization: KVQuantization;
  /** Compression configuration */
  compression: CompressionConfig;
  /** Snapshot configuration */
  snapshots: SnapshotConfig;
}

// ============================================================================
// Context Manager Types
// ============================================================================

/**
 * Main context manager interface
 */
export interface ContextManager {
  /** Current configuration */
  config: ContextConfig;
  /** Active skills */
  activeSkills: string[];
  /** Active tools */
  activeTools: string[];
  /** Start context management services */
  start(): Promise<void>;
  /** Stop context management services */
  stop(): Promise<void>;
  /** Update configuration */
  updateConfig(config: Partial<ContextConfig>): void;
  /** Get current context usage */
  getUsage(): ContextUsage;
  /** Add message to context */
  addMessage(message: Message): Promise<void>;
  /** Create manual snapshot */
  createSnapshot(): Promise<ContextSnapshot>;
  /** Restore from snapshot */
  restoreSnapshot(snapshotId: string): Promise<void>;
  /** List available snapshots */
  listSnapshots(): Promise<ContextSnapshot[]>;
  /** Trigger manual compression */
  compress(): Promise<void>;
  /** Clear context (except system prompt) */
  clear(): Promise<void>;
  /** Set active skills and corresponding tools */
  setActiveSkills(skills: string[]): void;
  /** Set system prompt */
  setSystemPrompt(prompt: string): void;
  /** Get system prompt */
  getSystemPrompt(): string;
  /** Register event listener */
  on(event: string, callback: (data: unknown) => void): void;
  /** Unregister event listener */
  off(event: string, callback: (data: unknown) => void): void;
  /** Emit event */
  emit(event: string, data?: unknown): boolean;
  /** Get current messages in context */
  getMessages(): Promise<Message[]>;
  /** Report in-flight (streaming) token delta to the manager (can be positive or negative) */
  reportInflightTokens(delta: number): void;
  /** Clear any in-flight token accounting (call on generation finish) */
  clearInflightTokens(): void;
}
