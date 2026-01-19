/**
 * Tool System Exports
 * 
 * This module exports all built-in tools and provides a registration function
 * to register them with a tool registry.
 */

// Import tool classes for registration function
import { ReadFileTool } from './read-file.js';
import { ReadManyFilesTool } from './read-many-files.js';
import { WriteFileTool } from './write-file.js';
import { EditFileTool } from './edit-file.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { LsTool } from './ls.js';
import { ShellTool } from './shell.js';
import { WebFetchTool } from './web-fetch.js';
import { WebSearchTool } from './web-search.js';
import { MemoryTool } from './memory.js';
import { WriteTodosTool } from './write-todos.js';
import { ToolRegistry } from './tool-registry.js';

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
export { ReadManyFilesTool, ReadManyFilesInvocation, type ReadManyFilesParams } from './read-many-files.js';
export { WriteFileTool, WriteFileInvocation, type WriteFileParams } from './write-file.js';
export { EditFileTool, EditFileInvocation, type EditFileParams /*, type FileEdit */ } from './edit-file.js';
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

/**
 * Configuration for built-in tools that require paths
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
export function registerBuiltInTools(registry: ToolRegistry, config?: BuiltInToolsConfig): void {
  const { memoryPath = '~/.ollm/memory.json', todosPath = '~/.ollm/todos.json' } = config || {};
  
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
  registry.register(new WebSearchTool());

  // Persistent storage tools
  registry.register(new MemoryTool(memoryPath));
  registry.register(new WriteTodosTool(todosPath));
  
  // Note: MemoryDumpTool and HotSwapTool are registered dynamically in ChatContext
  // because they require runtime dependencies (modeManager, contextManager, etc.)
}
