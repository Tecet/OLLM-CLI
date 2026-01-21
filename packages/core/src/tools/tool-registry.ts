/**
 * Tool Registry
 * 
 * Central registry for tool registration, discovery, and schema exposure.
 * Manages the lifecycle of tools and provides access to tool schemas for LLM consumption.
 */

import type { DeclarativeTool, ToolSchema, ToolContext, ToolInvocation } from './types.js';
import { globalValidator, type ValidationError } from './validation.js';

/**
 * Interface for checking tool enabled state
 * This allows the ToolRegistry to filter tools based on user preferences
 */
export interface ToolStateProvider {
  getToolState(toolId: string): boolean;
}

/**
 * Central registry for managing tools
 * 
 * The Tool Registry stores all registered tools and provides methods to:
 * - Register new tools
 * - Unregister existing tools
 * - Retrieve tools by name
 * - List all registered tools
 * - Generate function schemas for LLM consumption (with filtering)
 * - Validate parameters and create tool invocations
 */
export class ToolRegistry {
  private tools: Map<string, DeclarativeTool<unknown, unknown>>;
  private toolStateProvider?: ToolStateProvider;

  constructor(toolStateProvider?: ToolStateProvider) {
    this.tools = new Map();
    this.toolStateProvider = toolStateProvider;
  }

  /**
   * Register a tool in the registry
   * 
   * If a tool with the same name already exists, it will be replaced.
   * The tool's schema is registered for parameter validation.
   * 
   * @param tool The tool to register
   */
  register(tool: DeclarativeTool<unknown, unknown>): void {
    this.tools.set(tool.name, tool);
    // Register the schema for validation
    globalValidator.registerSchema(tool.name, tool.schema);
  }

  /**
   * Unregister a tool from the registry
   * 
   * @param name The name of the tool to unregister
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get a tool by name
   * 
   * @param name The name of the tool to retrieve
   * @returns The tool if found, undefined otherwise
   */
  get(name: string): DeclarativeTool<unknown, unknown> | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   * 
   * Tools are returned in alphabetical order by name for consistency.
   * 
   * @returns Array of all registered tools, sorted alphabetically by name
   */
  list(): DeclarativeTool<unknown, unknown>[] {
    return Array.from(this.tools.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Get function schemas for all registered tools
   * 
   * Converts all registered tools to provider-compatible schemas
   * for LLM consumption. The schemas are returned in the same order
   * as list() (alphabetically by name).
   * 
   * This method applies user preference filtering - only tools that are
   * enabled in the user's settings will be included.
   * 
   * @returns Array of tool schemas for enabled tools only
   */
  getFunctionSchemas(): ToolSchema[] {
    return this.list()
      .filter((tool) => {
        // If no tool state provider, include all tools (backward compatibility)
        if (!this.toolStateProvider) {
          return true;
        }
        // Filter based on user preference
        return this.toolStateProvider.getToolState(tool.name);
      })
      .map((tool) => tool.schema);
  }

  /**
   * Get function schemas filtered by mode permissions and user preferences
   * 
   * This combines both user preference filtering and mode-based filtering
   * into a single pass for better performance. This is the recommended method
   * for getting tool schemas when a mode manager is available.
   * 
   * @param mode - The current mode type
   * @param modeManager - Object with isToolAllowed method for mode-based filtering
   * @returns Array of tool schemas filtered by both user prefs and mode permissions
   */
  getFunctionSchemasForMode<M = string, T extends { isToolAllowed: (name: string, mode: M) => boolean } = { isToolAllowed: (name: string, mode: M) => boolean }>(
    mode: M,
    modeManager: T
  ): ToolSchema[] {
    return this.list()
      .filter((tool) => {
        // Layer 1a: User preference filter
        if (this.toolStateProvider && !this.toolStateProvider.getToolState(tool.name)) {
          return false;
        }
        // Layer 1b: Mode permission filter
        return modeManager.isToolAllowed(tool.name, mode);
      })
      .map((tool) => tool.schema);
  }

  /**
   * Get all enabled tools
   * 
   * Returns only the tools that are enabled according to user preferences.
   * If no tool state provider is configured, returns all tools.
   * 
   * @returns Array of enabled tools, sorted alphabetically by name
   */
  getEnabledTools(): DeclarativeTool<unknown, unknown>[] {
    return this.list().filter((tool) => {
      // If no tool state provider, include all tools (backward compatibility)
      if (!this.toolStateProvider) {
        return true;
      }
      // Filter based on user preference
      return this.toolStateProvider.getToolState(tool.name);
    });
  }

  /**
   * Create a validated tool invocation
   * 
   * Validates the parameters against the tool's schema before creating
   * the invocation. Returns a validation error if parameters are invalid.
   * 
   * @param toolName Name of the tool to invoke
   * @param params Parameters for the tool invocation
   * @param context Tool context (message bus, policy engine)
   * @returns Tool invocation if valid, or validation error
   */
  createInvocation(
    toolName: string,
    params: Record<string, unknown>,
    context: ToolContext
  ): ToolInvocation<unknown, unknown> | ValidationError {
    // Get the tool
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        message: `Tool not found: ${toolName}`,
        type: 'ValidationError',
      };
    }

    // Validate parameters
    const validationError = globalValidator.validate(toolName, params);
    if (validationError) {
      return validationError;
    }

    // Create and return the invocation
    return tool.createInvocation(params, context);
  }
}
