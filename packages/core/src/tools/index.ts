/**
 * Tool System Exports
 *
 * This module exports all built-in tools and provides a registration function
 * to register them with a tool registry.
 */

// Import tool classes for registration function
import { EditFileTool } from './edit-file.js';
import { GlobTool } from './glob.js';
import {
  CreateGoalTool,
  CreateCheckpointTool,
  CompleteGoalTool,
  RecordDecisionTool,
  SwitchGoalTool,
} from './goal-management.js';
import { GrepTool } from './grep.js';
import { LsTool } from './ls.js';
import { MemoryTool } from './memory.js';
import { DuckDuckGoSearchProvider } from './providers/duckduckgo-search.js';
import { ReadFileTool } from './read-file.js';
import { ReadManyFilesTool } from './read-many-files.js';
import { ReadReasoningTool } from './read-reasoning.js';
import { ShellTool } from './shell.js';
import { ToolRegistry } from './tool-registry.js';
import { WebFetchTool } from './web-fetch.js';
import { WebSearchTool } from './web-search.js';
import { WriteFileTool } from './write-file.js';
import { WriteTodosTool } from './write-todos.js';

// Export tool registry
export { ToolRegistry } from './tool-registry.js';

// Export tool types
export type {
  ToolResult,
  ToolCallConfirmationDetails,
  ToolInvocation,
  ToolSchema,
  DeclarativeTool,
  MessageBus,
  PolicyEngineInterface,
  ToolContext,
} from './types.js';

// Export validation utilities
export { ParameterValidator, globalValidator, type ValidationError } from './validation.js';

// Export output helpers
export { OutputFormatter, type TruncationConfig } from './output-helpers.js';

// Export all built-in tools
export { ReadFileTool, ReadFileInvocation, type ReadFileParams } from './read-file.js';
export {
  ReadManyFilesTool,
  ReadManyFilesInvocation,
  type ReadManyFilesParams,
} from './read-many-files.js';
export { WriteFileTool, WriteFileInvocation, type WriteFileParams } from './write-file.js';
export {
  EditFileTool,
  EditFileInvocation,
  type EditFileParams /*, type FileEdit */,
} from './edit-file.js';
export { GlobTool, GlobInvocation, type GlobParams } from './glob.js';
export { GrepTool, GrepInvocation, type GrepParams } from './grep.js';
export { LsTool, LsInvocation, type LsParams } from './ls.js';
export { ShellTool, ShellInvocation, type ShellParams } from './shell.js';
export { WebFetchTool, WebFetchInvocation, type WebFetchParams } from './web-fetch.js';
export { WebSearchTool, WebSearchInvocation, type WebSearchParams } from './web-search.js';
export { MemoryTool, MemoryInvocation, type MemoryParams } from './memory.js';
export { WriteTodosTool, WriteTodosInvocation, type WriteTodosParams } from './write-todos.js';
export { RememberTool, RememberInvocation, type RememberParams } from './remember.js';
export { MemoryDumpTool } from './MemoryDumpTool.js';
export { HotSwapTool, HotSwapInvocation, type HotSwapParams } from './HotSwapTool.js';
export { ToolRouter, type ToolRoutingConfig, DEFAULT_TOOL_ROUTING_CONFIG } from './toolRouter.js';
export {
  CreateGoalTool,
  CreateCheckpointTool,
  CompleteGoalTool,
  RecordDecisionTool,
  SwitchGoalTool,
  type CreateGoalParams,
  type CreateCheckpointParams,
  type CompleteGoalParams,
  type RecordDecisionParams,
  type SwitchGoalParams,
} from './goal-management.js';
export { ReadReasoningTool, type ReadReasoningParams } from './read-reasoning.js';

/**
 * Configuration for built-in tools
 */
export interface BuiltInToolsConfig {
  /**
   * Path for memory storage (default: ~/.ollm/memory.json)
   */
  memoryPath?: string;

  /**
   * Path for todos storage (default: ~/.ollm/todos.json)
   */
  todosPath?: string;

  /**
   * Enable goal management tools (create_goal, create_checkpoint, etc.)
   * Default: false (these tools cause LLMs to call tools unnecessarily)
   */
  enableGoalTools?: boolean;
}

/**
 * Register all built-in tools with a tool registry
 *
 * This function creates instances of all built-in tools and registers them
 * with the provided registry. This is the recommended way to set up the
 * tool system with all standard tools.
 *
 * @param registry The tool registry to register tools with
 * @param config Optional configuration for tools that require paths
 *
 * @example
 * ```typescript
 * import { ToolRegistry, registerBuiltInTools } from '@ollm/core';
 *
 * const registry = new ToolRegistry();
 * registerBuiltInTools(registry);
 *
 * // Now the registry has all built-in tools available
 * const schemas = registry.getFunctionSchemas();
 * ```
 */
/**
 * Register all built-in tools with a tool registry
 *
 * This function creates instances of all built-in tools and registers them
 * with the provided registry. This is the recommended way to set up the
 * tool system with all standard tools.
 *
 * **IMPORTANT:** This registers up to 18 tools total. Passing all tools to the LLM
 * at once can cause confusion and excessive tool calling (5+ tools per request).
 * Use mode-based filtering (getFunctionSchemasForMode) to limit tools to 5-10
 * per mode for better LLM performance.
 *
 * Built-in tools registered:
 * - File reading: read_file, read_multiple_files
 * - File writing: write_file, edit_file
 * - File discovery: file_search, grep_search, list_directory
 * - Shell: shell
 * - Web: web_fetch, web_search
 * - Storage: memory, write_todos
 * - Goals: create_goal, create_checkpoint, complete_goal, record_decision, switch_goal (DISABLED by default)
 * - Reasoning: read_reasoning
 *
 * @param registry The tool registry to register tools with
 * @param config Optional configuration for tools that require paths
 *
 * @example
 * ```typescript
 * import { ToolRegistry, registerBuiltInTools } from '@ollm/core';
 *
 * const registry = new ToolRegistry();
 * registerBuiltInTools(registry);
 *
 * // Now the registry has all built-in tools available
 * const schemas = registry.getFunctionSchemas();
 * ```
 */
export function registerBuiltInTools(registry: ToolRegistry, config?: BuiltInToolsConfig): void {
  // IMPORTANT: This registers 13-18 tools depending on config.
  // Goal tools are DISABLED by default because they cause LLMs to call tools
  // unnecessarily (even for simple greetings like "hi").
  // Use getFunctionSchemasForMode() to limit to 5-10 tools per mode.
  const {
    memoryPath = '~/.ollm/memory.json',
    todosPath = '~/.ollm/todos.json',
    enableGoalTools = false, // DISABLED by default
  } = config || {};

  // File reading tools
  registry.register(new ReadFileTool());
  registry.register(new ReadManyFilesTool());

  // File writing tools
  registry.register(new WriteFileTool());
  registry.register(new EditFileTool());

  // File discovery tools
  registry.register(new GlobTool());
  registry.register(new GrepTool());
  registry.register(new LsTool());

  // Shell execution
  registry.register(new ShellTool());

  // Web tools
  registry.register(new WebFetchTool());
  registry.register(new WebSearchTool(new DuckDuckGoSearchProvider()));

  // Persistent storage tools
  registry.register(new MemoryTool(memoryPath));
  registry.register(new WriteTodosTool(todosPath));

  // Goal management tools - ALWAYS REGISTERED
  // These are registered so they appear in UI as "Under Development"
  // but are disabled by default in settingsService (not passed to LLM)
  registry.register(new CreateGoalTool());
  registry.register(new CreateCheckpointTool());
  registry.register(new CompleteGoalTool());
  registry.register(new RecordDecisionTool());
  registry.register(new SwitchGoalTool());

  // Reasoning traces tool
  registry.register(new ReadReasoningTool());

  // Note: MemoryDumpTool and HotSwapTool are registered dynamically in ChatContext
  // because they require runtime dependencies (modeManager, contextManager, etc.)
}
