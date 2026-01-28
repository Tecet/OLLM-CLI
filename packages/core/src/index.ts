// Core package entry point

// Error handling system
export {
  OllmError,
  FileSystemError,
  ConfigError,
  ProviderConnectionError,
  ModelError,
  WorkspaceBoundaryError,
  ToolExecutionError,
  InputValidationError,
  TimeoutError,
  AbortError,
  MCPConnectionError,
  HookError,
  ContextError,
  NonInteractiveError,
  isOllmError,
  isNodeError,
  getErrorMessage,
  getErrorStack,
  createErrorContext,
} from './errors/index.js';

export {
  handleFileSystemError,
  handleJSONParseError,
  handleProviderError,
  withTimeout,
  checkAborted,
  withRetry,
  withFallback,
  collectErrors,
  AggregateError,
} from './errors/errorHandlers.js';

// Provider types and interfaces
export type {
  Role,
  MessagePart,
  Message,
  ToolSchema,
  ToolCall,
  GenerationOptions,
  ProviderRequest,
  ProviderEvent,
  ProviderError,
  ModelInfo,
  PullProgress,
  ProviderAdapter,
  ProviderMetrics,
} from './provider/types.js';

// Provider registry
export { ProviderRegistry } from './provider/registry.js';

// Core runtime
export { ChatClient, type ChatConfig, type ChatEvent } from './core/chatClient.js';
export {
  Turn,
  type TurnEvent,
  type ToolRegistry as TurnToolRegistry,
  type Tool,
  type ChatOptions,
} from './core/turn.js';
export { TokenCounter, type TokenLimitConfig } from './core/tokenLimits.js';
export { ReActToolHandler, type ReActParseResult } from './core/reactToolHandler.js';

// Policy engine
export {
  PolicyEngine,
  type PolicyEvaluationResult,
  type PolicyConfig,
  type PolicyRule,
  type PolicyCondition,
  type PolicyDecision,
  type RiskLevel,
  type ConditionOperator,
  DEFAULT_POLICY_CONFIG,
} from './policy/index.js';

// Confirmation bus
export {
  ConfirmationBus,
  createConfirmationBus,
  DEFAULT_CONFIRMATION_TIMEOUT,
  type ConfirmationRequest,
  type ConfirmationResponse,
  type ConfirmationHandler,
} from './confirmation-bus/index.js';

// Tool system
export {
  ToolRegistry,
  registerBuiltInTools,
  ParameterValidator,
  globalValidator,
  OutputFormatter,
  // Tool classes
  ReadFileTool,
  ReadManyFilesTool,
  WriteFileTool,
  EditFileTool,
  GlobTool,
  GrepTool,
  LsTool,
  ShellTool,
  WebFetchTool,
  WebSearchTool,
  MemoryTool,
  WriteTodosTool,
  MemoryDumpTool,
  HotSwapTool,
} from './tools/index.js';

// Tool types
export type {
  ToolResult,
  ToolCallConfirmationDetails,
  ToolInvocation,
  ToolSchema as DeclarativeToolSchema,
  DeclarativeTool,
  MessageBus,
  PolicyEngineInterface,
  ToolContext,
  ValidationError,
  TruncationConfig,
  // Tool parameter types
  ReadFileParams,
  ReadManyFilesParams,
  WriteFileParams,
  EditFileParams,
  // FileEdit, // Commented out - not yet implemented
  GlobParams,
  GrepParams,
  LsParams,
  ShellParams,
  WebFetchParams,
  WebSearchParams,
  MemoryParams,
  WriteTodosParams,
} from './tools/index.js';

// Services
export {
  ShellExecutionService,
  ChatRecordingService,
  ChatCompressionService,
  LoopDetectionService,
  DynamicContextInjector,
  EnvironmentSanitizationService,
  FileDiscoveryService,
  MemoryService,
  TemplateService,
  ComparisonService,
  ProjectProfileService,
  createGPUMonitor,
  DefaultGPUMonitor,
  type GPUMonitor,
  type GPUInfo,
  type GPUVendor,
  ReasoningParser,
  ServiceContainer,
  createServiceContainer,
} from './services/index.js';

// Utilities
export {
  createLogger,
  getLogLevel,
  setLogLevel,
  type Logger,
  type LogLevel,
} from './utils/logger.js';
export {
  validateStoragePath,
  logPathDiagnostics,
  getDefaultStorageLocations,
  logAllStorageLocations,
  ensureStorageDirectories,
  type PathValidationResult,
  type StorageLocations,
} from './utils/pathValidation.js';
export {
  needsMigration,
  migrateStorage,
  runMigrationIfNeeded,
  type MigrationResult,
} from './utils/storageMigration.js';
export { initializeStorage, initializeStorageSafe } from './utils/storageInitialization.js';

// Context Management System
export {
  // Types and interfaces
  GPUType,
  MemoryLevel,
  ContextTier,
  OperationalMode,
  // Factory functions
  createGPUDetector,
  createVRAMMonitor,
  createContextManager,
  createContextPool,
  createSnapshotManager,
  createSnapshotStorage,
  createMemoryGuard,
  // Classes (for DI/testing)
  DefaultVRAMMonitor,
  DefaultGPUDetector,
  ConversationContextManager,
  HotSwapService,
} from './context/index.js';

// Context Size Calculator (pure calculation functions)
export * as ContextSizeCalculator from './context/ContextSizeCalculator.js';

export { deriveGPUPlacementHints } from './context/gpuHints.js';

// Prompt routing helpers
export { TieredPromptStore } from './prompts/tieredPromptStore.js';
export { SnapshotManager as PromptsSnapshotManager } from './prompts/modeSnapshotManager.js';

export type {
  VRAMInfo,
  VRAMMonitor,
  GPUDetector,
  ContextConfig,
  ContextUsage,
  ContextPool,
  ContextPoolConfig,
  ModelInfo as ContextModelInfo,
  ContextSnapshot,
  SnapshotMetadata,
  SnapshotConfig,
  SnapshotManager as ContextSnapshotManager,
  SnapshotStorage,
  CompressionStrategy as ContextCompressionStrategy,
  CompressionStrategyType,
  CompressedContext,
  CompressionEstimate,
  CompressionConfig,
  CompressionService as ContextCompressionService,
  MemoryThresholds,
  MemoryGuard,
  Message as ContextMessage,
  ToolCall as ContextToolCall,
  ToolResult as ContextToolResult,
  ConversationContext,
  ContextManager as ContextManagerInterface,
  TokenCounter as ContextTokenCounter,
  TokenCountCache,
  KVQuantization,
  GPUPlacementHints,
} from './context/index.js';

// Service types
export type {
  SessionMessage,
  SessionToolCall,
  Session,
  SessionSummary,
  CompressionStrategy,
  CompressionOptions,
  CompressionResult,
  LoopPatternType,
  LoopPattern,
  LoopDetectionConfig,
  ContextEntry,
  FileEntry,
  DiscoveryOptions,
  FileChangeEvent,
  Disposable,
  SanitizationConfig,
  ServicesConfig,
  ReasoningBlock,
  ParserState,
  ParseResult,
} from './services/index.js';

// Commands
export {
  ContextCommandHandler,
  createContextCommandHandler,
  type ContextCommandResult,
  type ContextStatusData,
  type ContextStatsData,
} from './commands/index.js';

// Hook system
export type {
  Hook,
  HookEvent,
  HookSource,
  HookInput,
  HookOutput,
  HookContext,
  HookExecutionPlan,
  HookApproval,
} from './hooks/index.js';

// Extension system
export type {
  Extension,
  ExtensionManifest,
  ExtensionSetting,
  HookConfig,
  Skill,
} from './extensions/index.js';

// MCP integration
export type {
  MCPServerConfig,
  MCPServerStatus,
  MCPServerStatusType,
  MCPServerInfo,
  MCPTool,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPTransport,
  MCPClient,
  MCPSchemaConverter,
  MCPToolWrapper,
} from './mcp/index.js';

export {
  BaseMCPTransport,
  StdioTransport,
  SSETransport,
  HTTPTransport,
  DefaultMCPClient,
  DefaultMCPSchemaConverter,
  DefaultMCPToolWrapper,
} from './mcp/index.js';

// Prompt System
export {
  PromptRegistry,
  type PromptDefinition,
  type RegisteredPrompt,
  type PromptTemplateParams,
  // Context Analyzer
  ContextAnalyzer,
  type ContextAnalysis,
  type ModeType,
  // Prompt Mode Manager
  PromptModeManager,
  type ModeConfig,
  type ModeTransition,
  type PromptBuildOptions,
  // Workflow Manager
  WorkflowManager,
  type WorkflowStep,
  type WorkflowDefinition,
  type WorkflowState,
  type WorkflowProgress,
  // Snapshot Manager (Mode Transitions)
  SnapshotManager as ModeSnapshotManager,
  SnapshotManager,
  type ModeTransitionSnapshot,
  type ModeFindings,
  // Mode Transition Suggester
  ModeTransitionSuggester,
  type ModeTransitionSuggestion,
  // Mode Metrics Tracker
  ModeMetricsTracker,
  type ModeEvent,
  type ModeTimeMetrics,
  type ModeTransitionMetrics,
  type DebuggerModeMetrics,
  type PlanningModeMetrics,
  type DeveloperModeMetrics,
  type ToolModeMetrics,
  type AggregatedMetrics,
  type SerializableMetrics,
  // Hybrid Mode Manager
  HybridModeManager,
  type HybridMode,
  PRESET_HYBRID_MODES,
  MODE_METADATA,
  // Mode Transition Animator
  ModeTransitionAnimator,
  type TransitionAnimation,
} from './prompts/index.js';

export { ModelDatabase, modelDatabase, refreshModelDatabase } from './routing/modelDatabase.js';
