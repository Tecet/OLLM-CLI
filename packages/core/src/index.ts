// Core package entry point

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
  ModelInfo,
  PullProgress,
  ProviderAdapter,
} from './provider/types.js';

// Provider registry
export { ProviderRegistry } from './provider/registry.js';

// Core runtime
export { ChatClient, type ChatConfig, type ChatEvent } from './core/chatClient.js';
export { Turn, type TurnEvent, type ToolRegistry as TurnToolRegistry, type Tool, type ChatOptions } from './core/turn.js';
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
  ContextManager,
  EnvironmentSanitizationService,
  FileDiscoveryService,
  MemoryService,
  TemplateService,
  ComparisonService,
  ProjectProfileService,
} from './services/index.js';

// Context Management System
export {
  // Types and interfaces
  GPUType,
  MemoryLevel,
  // Factory functions
  createGPUDetector,
  createVRAMMonitor,
  createContextManager,
  createContextPool,
  createSnapshotManager,
  createMemoryGuard,
  // Classes (for DI/testing)
  DefaultVRAMMonitor,
  DefaultGPUDetector,
  ContextManagerImpl,
} from './context/index.js';

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
  SnapshotManager,
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
} from './services/index.js';

// Commands
export {
  ContextCommandHandler,
  createContextCommandHandler,
  type ContextCommandResult,
  type ContextStatusData,
  type ContextStatsData
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
