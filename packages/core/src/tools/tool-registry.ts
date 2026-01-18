/**
 * Tool Registry
 * 
 * Central registry for tool registration, discovery, and schema exposure.
 * Manages the lifecycle of tools and provides access to tool schemas for LLM consumption.
 */

import type { DeclarativeTool, ToolSchema, ToolContext, ToolInvocation } from './types.js';
import { globalValidator, type ValidationError } from './validation.js';

/**
 * Central registry for managing tools
 * 
 * The Tool Registry stores all registered tools and provides methods to:
 * - Register new tools
 * - Unregister existing tools
 * - Retrieve tools by name
 * - List all registered tools
 * - Generate function schemas for LLM consumption
 * - Validate parameters and create tool invocations
 */
export class ToolRegistry {
  private tools: Map<string, DeclarativeTool<Record<string, unknown>, unknown>>;

  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a tool in the registry
   * 
   * If a tool with the same name already exists, it will be replaced.
   * The tool's schema is registered for parameter validation.
   * 
   * @param tool The tool to register
   */
  register(tool: DeclarativeTool<Record<string, unknown>, unknown>): void {
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
  get(name: string): DeclarativeTool<Record<string, unknown>, unknown> | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   * 
   * Tools are returned in alphabetical order by name for consistency.
   * 
   * @returns Array of all registered tools, sorted alphabetically by name
   */
  list(): DeclarativeTool<Record<string, unknown>, unknown>[] {
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
   * @returns Array of tool schemas
   */
  getFunctionSchemas(): ToolSchema[] {
    return this.list().map((tool) => tool.schema);
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
  ): ToolInvocation<Record<string, unknown>, unknown> | ValidationError {
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
