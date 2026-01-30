/**
 * Context Management System - Core Types and Interfaces
 *
 * @status REWORK - Enhanced (2026-01-29)
 * @date 2026-01-29
 * @changes Added getOllamaContextLimit() method to ContextManager interface
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
  CPU_ONLY = 'cpu',
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
  /** Get token counting metrics */
  getMetrics(): {
    cacheHitRate: string;
    cacheHits: number;
    cacheMisses: number;
    recalculations: number;
    totalTokensCounted: number;
    largestMessage: number;
    avgTokensPerMessage: number;
    uptimeSeconds: number;
  };
  /** Reset metrics */
  resetMetrics(): void;
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
 * Dynamic budget information for compression
 */
export interface ContextBudget {
  /** Total Ollama context size (85% pre-calculated) */
  totalOllamaSize: number;
  /** System prompt tokens (fixed) */
  systemPromptTokens: number;
  /** Checkpoint tokens (grows with each compression) */
  checkpointTokens: number;
  /** Available budget for new conversation */
  availableBudget: number;
  /** Current conversation tokens (excluding system + checkpoints) */
  conversationTokens: number;
  /** Usage percentage of available budget (0-100) */
  budgetPercentage: number;
}

/**
 * Context profile for a specific context size
 */
export interface ContextProfile {
  /** User-facing context size */
  size: number;
  /** Display label (e.g., "4k", "8k") */
  size_label?: string;
  /** Pre-calculated Ollama context size (85% of size) */
  ollama_context_size: number;
  /** VRAM estimate in GB */
  vram_estimate_gb?: number;
  /** VRAM estimate string (e.g., "5.5 GB") */
  vram_estimate?: string;
}

/**
 * Model information for context calculations
 */
export interface ModelInfo {
  /** Model size in billions of parameters */
  parameters: number;
  /** Maximum context tokens supported */
  contextLimit: number;
  /** Optional: Model-specific context profiles (from LLM_profiles.json) */
  contextProfiles?: ContextProfile[];
  /** Optional: Model ID for profile lookup */
  modelId?: string;
}

/**
 * Context pool interface
 */
export interface ContextPool {
  /** Current configuration */
  config: ContextPoolConfig;
  /** Current context size in tokens (Ollama size - 85%) */
  currentSize: number;
  /** User-facing context size (for UI display and tier detection) */
  userContextSize: number;
  /** Calculate optimal context size based on available VRAM */
  calculateOptimalSize(vramInfo: VRAMInfo, modelInfo: ModelInfo): number;
  /** Resize context (may require model reload) */
  resize(newSize: number, userSize?: number): Promise<void>;
  /** Get current usage statistics */
  getUsage(): ContextUsage;
  /** Get current Ollama context size (actual limit) */
  getCurrentSize(): number;
  /** Update configuration */
  updateConfig(config: Partial<ContextPoolConfig>): void;
  /** Set user-facing context size (for UI display and tier detection) */
  setUserContextSize(size: number): void;
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
 * User message (never compressed)
 */
export interface UserMessage {
  /** Unique message ID */
  id: string;
  /** Always 'user' */
  role: 'user';
  /** User's exact text (never modified) */
  content: string;
  /** When user sent this */
  timestamp: Date;
  /** Cached token count */
  tokenCount?: number;
  /** Optional: Group related messages */
  taskId?: string;
}

/**
 * Archived user message (summary only)
 */
export interface ArchivedUserMessage {
  /** Original message ID */
  id: string;
  /** First 100 chars of content */
  summary: string;
  /** When user sent this */
  timestamp: Date;
  /** Can retrieve full message if needed */
  fullMessageAvailable: boolean;
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
  /** Recent user messages (last 10, never compressed) */
  userMessages: UserMessage[];
  /** Archived user messages (summaries only) */
  archivedUserMessages: ArchivedUserMessage[];
  /** Full conversation messages (excluding user messages) */
  messages: Message[];
  /** Goal stack (structured context) */
  goalStack?: import('./goalTypes.js').GoalStack;
  /** Reasoning traces (for reasoning models) */
  reasoningStorage?: import('./reasoningTypes.js').ReasoningStorage;
  /** Additional metadata */
  metadata: {
    model: string;
    contextSize: number;
    compressionRatio: number;
    /** Total user messages including archived */
    totalUserMessages: number;
    /** Active goal ID */
    activeGoalId?: string;
    /** Total goals completed */
    totalGoalsCompleted: number;
    /** Total checkpoints */
    totalCheckpoints: number;
    /** Is this a reasoning model */
    isReasoningModel?: boolean;
    /** Total thinking tokens used */
    totalThinkingTokens?: number;
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
// Context Tier Types (Adaptive Compression)
// ============================================================================

/**
 * Context size tiers for adaptive compression
 */
export enum ContextTier {
  TIER_1_MINIMAL = '2-4K',
  TIER_2_BASIC = '8K',
  TIER_3_STANDARD = '16K',
  TIER_4_PREMIUM = '32K',
  TIER_5_ULTRA = '64K+',
}

/**
 * Tier configuration
 */
export interface TierConfig {
  /** Tier identifier */
  tier: ContextTier;
  /** Minimum tokens for this tier */
  minTokens: number;
  /** Maximum tokens for this tier */
  maxTokens: number;
  /** Compression strategy for this tier */
  strategy: 'rollover' | 'smart' | 'progressive' | 'structured';
  /** Maximum checkpoints to maintain */
  maxCheckpoints: number;
}

/**
 * Tier configurations for all tiers
 *
 * Note: The 85% context utilization is pre-calculated in LLM_profiles.json.
 * Compression triggers at 75-80% of available budget (calculated dynamically).
 */
export const TIER_CONFIGS: Record<ContextTier, TierConfig> = {
  [ContextTier.TIER_1_MINIMAL]: {
    tier: ContextTier.TIER_1_MINIMAL,
    minTokens: 2048,
    maxTokens: 4096,
    strategy: 'rollover',
    maxCheckpoints: 0,
  },
  [ContextTier.TIER_2_BASIC]: {
    tier: ContextTier.TIER_2_BASIC,
    minTokens: 4097,
    maxTokens: 8192,
    strategy: 'smart',
    maxCheckpoints: 1,
  },
  [ContextTier.TIER_3_STANDARD]: {
    tier: ContextTier.TIER_3_STANDARD,
    minTokens: 8193,
    maxTokens: 16384,
    strategy: 'progressive',
    maxCheckpoints: 5,
  },
  [ContextTier.TIER_4_PREMIUM]: {
    tier: ContextTier.TIER_4_PREMIUM,
    minTokens: 16385,
    maxTokens: 32768,
    strategy: 'structured',
    maxCheckpoints: 10,
  },
  [ContextTier.TIER_5_ULTRA]: {
    tier: ContextTier.TIER_5_ULTRA,
    minTokens: 65536,
    maxTokens: 131072,
    strategy: 'structured',
    maxCheckpoints: 15,
  },
};

// ============================================================================
// Operational Mode Types (Adaptive Compression)
// ============================================================================

/**
 * Operational modes for context management
 */
export enum OperationalMode {
  DEVELOPER = 'developer',
  PLANNING = 'planning',
  ASSISTANT = 'assistant',
  DEBUGGER = 'debugger',
  USER = 'user',
}

/**
 * Mode profile configuration
 */
export interface ModeProfile {
  /** Mode identifier */
  mode: OperationalMode;
  /** Section types to never compress */
  neverCompress: string[];
  /** Compression priority order (first = compress first) */
  compressionPriority: string[];
  /** Extraction rules for important information */
  extractionRules?: Record<string, RegExp>;
}

/**
 * Mode profiles for all operational modes
 */
export const MODE_PROFILES: Record<OperationalMode, ModeProfile> = {
  [OperationalMode.DEVELOPER]: {
    mode: OperationalMode.DEVELOPER,
    neverCompress: ['architecture_decisions', 'api_contracts', 'data_models'],
    compressionPriority: [
      'discussion',
      'exploration',
      'dependencies',
      'tests',
      'file_structure',
      'code_changes',
    ],
    extractionRules: {
      architecture_decision: /(?:decided|chose|using|implementing)\s+(\w+)\s+(?:because|for|to)/i,
      file_change: /(?:created|modified|updated|changed)\s+([^\s]+\.\w+)/i,
      api_definition: /(?:interface|class|function|endpoint)\s+(\w+)/i,
    },
  },
  [OperationalMode.PLANNING]: {
    mode: OperationalMode.PLANNING,
    neverCompress: ['goals', 'requirements', 'constraints'],
    compressionPriority: [
      'brainstorming',
      'rejected_ideas',
      'resources',
      'timeline',
      'dependencies',
      'tasks',
    ],
    extractionRules: {
      requirement: /(?:must|should|need to|required to)\s+(.+?)(?:\.|$)/i,
      task: /(?:task|step|action):\s*(.+?)(?:\.|$)/i,
      milestone: /(?:milestone|deadline|due):\s*(.+?)(?:\.|$)/i,
    },
  },
  [OperationalMode.ASSISTANT]: {
    mode: OperationalMode.ASSISTANT,
    neverCompress: ['user_preferences', 'conversation_context'],
    compressionPriority: ['small_talk', 'clarifications', 'examples', 'explanations', 'questions'],
    extractionRules: {
      preference: /(?:prefer|like|want|need)\s+(.+?)(?:\.|$)/i,
      important: /(?:important|critical|must remember)\s+(.+?)(?:\.|$)/i,
    },
  },
  [OperationalMode.DEBUGGER]: {
    mode: OperationalMode.DEBUGGER,
    neverCompress: ['error_messages', 'stack_traces', 'reproduction_steps'],
    compressionPriority: [
      'discussion',
      'successful_tests',
      'environment',
      'test_results',
      'fixes_attempted',
    ],
    extractionRules: {
      error: /(?:error|exception|failed):\s*(.+?)(?:\n|$)/i,
      fix_attempt: /(?:tried|attempted|fixed)\s+(.+?)(?:\.|$)/i,
      reproduction: /(?:reproduce|replicate|steps):\s*(.+?)(?:\.|$)/i,
    },
  },
  [OperationalMode.USER]: {
    mode: OperationalMode.USER,
    neverCompress: ['user_preferences', 'custom_context'],
    compressionPriority: ['discussion', 'exploration', 'examples'],
    extractionRules: {
      preference: /(?:prefer|like|want|need)\s+(.+?)(?:\.|$)/i,
      important: /(?:important|critical|must remember)\s+(.+?)(?:\.|$)/i,
    },
  },
};

// ============================================================================
// Never-Compressed Section Types
// ============================================================================

/**
 * Never-compressed section
 */
export interface NeverCompressedSection {
  /** Section type identifier */
  type: string;
  /** Section content */
  content: string;
  /** Creation timestamp */
  timestamp: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task definition (never compressed)
 */
export interface TaskDefinition {
  /** Task goal */
  goal: string;
  /** Requirements list */
  requirements: string[];
  /** Constraints list */
  constraints: string[];
  /** Creation timestamp */
  timestamp: Date;
}

/**
 * Architecture decision (never compressed)
 */
export interface ArchitectureDecision {
  /** Unique decision ID */
  id: string;
  /** Decision description */
  decision: string;
  /** Reason for decision */
  reason: string;
  /** Impact of decision */
  impact: string;
  /** Creation timestamp */
  timestamp: Date;
  /** Alternative approaches considered */
  alternatives?: string[];
}

// ============================================================================
// Adaptive System Prompt Types
// ============================================================================

// Prompt templates are loaded from disk at runtime.

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
  /** Optional checkpoint information */
  checkpoint?: {
    range: string;
    keyDecisions?: string[];
    filesModified?: string[];
    nextSteps?: string[];
  };
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
  compress(messages: Message[], strategy: CompressionStrategy): Promise<CompressedContext>;
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
  NORMAL = 'normal', // < 80%
  WARNING = 'warning', // 80-90%
  CRITICAL = 'critical', // 90-95%
  EMERGENCY = 'emergency', // > 95%
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
 * Checkpoint level for hierarchical compression
 */
export enum CheckpointLevel {
  /** Most compressed - ultra-compact summary (10+ compressions old) */
  COMPACT = 1,
  /** Medium compressed - moderate detail (5-9 compressions old) */
  MODERATE = 2,
  /** Least compressed - detailed checkpoint (1-4 compressions old) */
  DETAILED = 3,
}

/**
 * Compression checkpoint
 * Represents a compressed segment of conversation history
 */
export interface CompressionCheckpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Checkpoint level (determines detail) */
  level: CheckpointLevel;
  /** Message range this checkpoint covers */
  range: string;
  /** Summary message */
  summary: Message;
  /** When this checkpoint was created */
  createdAt: Date;
  /** When this checkpoint was last compressed */
  compressedAt?: Date;
  /** Original token count before compression */
  originalTokens: number;
  /** Current token count */
  currentTokens: number;
  /** Number of times this checkpoint has been compressed */
  compressionCount: number;
  /** Compression number when this checkpoint was created (for age calculation) */
  compressionNumber?: number;
  /** Key decisions or architecture choices (never compressed) */
  keyDecisions?: string[];
  /** Files modified in this range */
  filesModified?: string[];
  /** Next steps planned */
  nextSteps?: string[];
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
  /** Compression checkpoints (additive history) */
  checkpoints?: CompressionCheckpoint[];
  /** Task definition (never compressed) */
  taskDefinition?: TaskDefinition;
  /** Architecture decisions (never compressed) */
  architectureDecisions?: ArchitectureDecision[];
  /** Never-compressed sections */
  neverCompressed?: NeverCompressedSection[];
  /** Goal stack for goal-oriented context management */
  goalStack?: import('./goalTypes.js').GoalStack;
  /** Reasoning storage for reasoning traces */
  reasoningStorage?: import('./reasoningTypes.js').ReasoningStorage;
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
  /** Ollama context size (85% of targetSize, pre-calculated from profile) */
  ollamaContextSize?: number;
  /** Operational mode (assistant, developer, etc.) */
  mode?: string;
  /** Context tier */
  tier?: ContextTier;
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
  /** Get dynamic budget information */
  getBudget(): ContextBudget;
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
  /** Set operational mode for prompt routing */
  setMode(mode: OperationalMode): void;
  /** Get current operational mode */
  getMode(): OperationalMode;
  /** Register event listener */
  on(event: string, callback: (data: unknown) => void): void;
  /** Unregister event listener */
  off(event: string, callback: (data: unknown) => void): void;
  /** Emit event */
  emit(event: string, data?: unknown): boolean;
  /** Get current messages in context */
  getMessages(): Promise<Message[]>;
  /** Validate and build prompt before sending to Ollama (Phase 1: Pre-Send Validation) */
  validateAndBuildPrompt(newMessage?: Message): Promise<{
    valid: boolean;
    prompt: Message[];
    totalTokens: number;
    ollamaLimit: number;
    warnings: string[];
    emergencyAction?: 'compression' | 'rollover';
  }>;
  /** Check if summarization is currently in progress (Phase 2: Blocking Mechanism) */
  isSummarizationInProgress(): boolean;
  /** Wait for any in-progress summarization to complete (Phase 2: Blocking Mechanism) */
  waitForSummarization(timeoutMs?: number): Promise<void>;
  /** Get the Ollama context limit (85% pre-calculated value from JSON profiles) */
  getOllamaContextLimit?(): number;
  /** Report in-flight (streaming) token delta to the manager (can be positive or negative) */
  reportInflightTokens(delta: number): void;
  /** Clear any in-flight token accounting (call on generation finish) */
  clearInflightTokens(): void;
  /** Get token counting metrics */
  getTokenMetrics(): {
    cacheHitRate: string;
    cacheHits: number;
    cacheMisses: number;
    recalculations: number;
    totalTokensCounted: number;
    largestMessage: number;
    avgTokensPerMessage: number;
    uptimeSeconds: number;
  };
  /** Reset token counting metrics */
  resetTokenMetrics(): void;
}
