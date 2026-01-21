/**
 * Core type definitions for the Tool System
 * 
 * This module defines the fundamental interfaces for tools, tool invocations,
 * and tool results. These types form the foundation of the declarative tool
 * system that enables LLMs to interact with files, execute commands, and
 * perform other operations through a secure, policy-controlled interface.
 */

/**
 * Result returned by tool execution
 */
export interface ToolResult {
  /**
   * Content sent to the LLM for processing
   */
  llmContent: string;

  /**
   * Content displayed to the user (may differ from llmContent)
   */
  returnDisplay: string;

  /**
   * Error information if the tool execution failed
   */
  error?: {
    /**
     * Human-readable error message
     */
    message: string;

    /**
     * Error type for programmatic handling
     */
    type: string;
  };
}

/**
 * Details about a tool call that requires user confirmation
 */
export interface ToolCallConfirmationDetails {
  /**
   * Name of the tool being invoked
   */
  toolName: string;

  /**
   * Human-readable description of what the tool will do
   */
  description: string;

  /**
   * Risk level of the operation
   */
  risk: 'low' | 'medium' | 'high';

  /**
   * File paths or resources that will be affected by this operation
   */
  locations?: string[];
}

/**
 * Interface for a tool invocation instance
 * 
 * A tool invocation represents a specific call to a tool with concrete parameters.
 * It provides methods to describe the operation, check if confirmation is needed,
 * and execute the tool.
 */
export interface ToolInvocation<TParams extends object, TResult> {
  /**
   * The parameters for this tool invocation
   */
  params: TParams;

  /**
   * Get a human-readable description of this operation
   * 
   * @returns A string describing what this tool invocation will do
   */
  getDescription(): string;

  /**
   * Get the file paths or resources affected by this operation
   * 
   * @returns Array of paths/resources that will be read or modified
   */
  toolLocations(): string[];

  /**
   * Check if this operation requires user confirmation
   * 
   * @param abortSignal Signal to cancel the confirmation check
   * @returns Confirmation details if confirmation is needed, false otherwise
   */
  shouldConfirmExecute(
    abortSignal: AbortSignal
  ): Promise<ToolCallConfirmationDetails | false>;

  /**
   * Execute the tool operation
   * 
   * @param signal Signal to cancel the execution
   * @param updateOutput Optional callback for streaming output updates
   * @returns The result of the tool execution
   */
  execute(
    signal: AbortSignal,
    updateOutput?: (output: string) => void
  ): Promise<TResult>;
}

/**
 * JSON Schema definition for a tool
 */
export interface ToolSchema {
  /**
   * Tool name (must be unique in the registry)
   */
  name: string;

  /**
   * Human-readable description of what the tool does
   */
  description?: string;

  /**
   * JSON Schema for the tool's parameters
   */
  parameters?: Record<string, unknown>;
}

/**
 * Interface for a declarative tool definition
 * 
 * A declarative tool defines a capability that can be exposed to LLMs.
 * It includes the tool's schema (for LLM consumption) and a factory
 * method to create invocations with specific parameters.
 */
export interface DeclarativeTool<TParams extends object, TResult> {
  /**
   * Unique identifier for this tool
   */
  name: string;

  /**
   * Human-readable display name
   */
  displayName: string;

  /**
   * JSON Schema describing this tool for LLM consumption
   */
  schema: ToolSchema;

  /**
   * Create a new invocation of this tool with the given parameters
   * 
   * @param params The parameters for this invocation
   * @param context Tool context containing message bus and policy engine
   * @returns A tool invocation instance
   */
  createInvocation(
    params: TParams,
    context: ToolContext
  ): ToolInvocation<TParams, TResult>;
}

/**
 * Generic Tool type alias
 */
export type Tool = DeclarativeTool<unknown, unknown>;

/**
 * Message bus interface for requesting user confirmations
 * 
 * This is a minimal interface that tools depend on. The actual
 * implementation is provided by the confirmation-bus module.
 */
export interface MessageBus {
  /**
   * Request user confirmation for a tool operation
   * 
   * @param details Details about the operation requiring confirmation
   * @param abortSignal Optional signal to cancel the request
   * @param timeout Timeout in milliseconds (default: 60000)
   * @returns Promise that resolves to true if approved, false if denied
   */
  requestConfirmation(
    details: ToolCallConfirmationDetails,
    abortSignal?: AbortSignal,
    timeout?: number
  ): Promise<boolean>;
}

/**
 * Policy engine interface for evaluating tool execution policies
 * 
 * This is a minimal interface that tools depend on. The actual
 * implementation is provided by the policy module.
 */
export interface PolicyEngineInterface {
  /**
   * Evaluate policy for a tool invocation
   * 
   * @param toolName Name of the tool being invoked
   * @param params Parameters passed to the tool
   * @returns The policy decision (allow, deny, or ask)
   */
  evaluate(toolName: string, params?: Record<string, unknown>): 'allow' | 'deny' | 'ask';

  /**
   * Get the risk level for a tool
   * 
   * @param toolName Name of the tool
   * @returns Risk level (low, medium, or high)
   */
  getRiskLevel(toolName: string): 'low' | 'medium' | 'high';
}

/**
 * Context provided to tool invocations for policy and confirmation handling
 */
export interface ToolContext {
  /**
   * Message bus for requesting user confirmations
   */
  messageBus: MessageBus;

  /**
   * Policy engine for evaluating tool execution policies
   */
  policyEngine?: PolicyEngineInterface;

  /**
   * Goal manager for tracking goals, checkpoints, and decisions
   */
  goalManager?: import('../context/goalTypes.js').GoalManager;

  /**
   * Workspace boundary for file access validation
   */
  workspaceBoundary?: import('../workspace/workspaceBoundary.js').WorkspaceBoundary;
}
