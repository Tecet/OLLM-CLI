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
export { Turn, type TurnEvent, type ToolRegistry, type Tool, type ChatOptions } from './core/turn.js';
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
  FileEdit,
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
} from './services/index.js';

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
