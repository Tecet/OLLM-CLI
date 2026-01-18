/**
 * Core types and interfaces for the provider system.
 * These types define the contract between the chat runtime and LLM provider adapters.
 */

/**
 * Role of a message in the conversation.
 */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

/**
 * A part of a message, which can be text or image content.
 */
export type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

/**
 * A message in the conversation.
 * Messages have a role and contain one or more parts (text or images).
 * Tool messages must include a name field identifying the tool.
 */
export interface Message {
  role: Role;
  parts: MessagePart[];
  name?: string; // Identification for tool role (legacy or specific providers)
  toolCalls?: ToolCall[]; // For assistant role
  toolCallId?: string; // For tool role
}

/**
 * Schema definition for a tool that can be called by the model.
 */
export interface ToolSchema {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>; // JSON Schema
}

/**
 * A tool call request from the model.
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/**
 * Generation options for controlling model behavior.
 */
export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  seed?: number;
}

/**
 * Request to a provider for chat completion.
 */
export interface ProviderRequest {
  model: string;
  systemPrompt?: string;
  messages: Message[];
  tools?: ToolSchema[];
  toolChoice?: 'auto' | 'none' | { name: string };
  options?: GenerationOptions;
  abortSignal?: AbortSignal;
  timeout?: number; // Request-specific timeout in milliseconds
}

/**
 * Metrics from the provider for an inference run.
 */
export interface ProviderMetrics {
  totalDuration: number;
  loadDuration: number;
  promptEvalCount: number;
  promptEvalDuration: number;
  evalCount: number;
  evalDuration: number;
}

/**
 * Error information from a provider.
 */
export interface ProviderError {
  /** Human-readable error message */
  message: string;
  /** Error code (e.g., 'TOOL_UNSUPPORTED', '400', '500') */
  code?: string;
  /** HTTP status code if applicable */
  httpStatus?: number;
  /** Original error text from provider */
  originalError?: string;
}

/**
 * Events emitted by a provider during streaming.
 */
export type ProviderEvent =
  | { type: 'text'; value: string }
  | { type: 'tool_call'; value: ToolCall }
  | { 
      type: 'finish'; 
      reason: 'stop' | 'length' | 'tool';
      metrics?: ProviderMetrics;
    }
  | { type: 'error'; error: ProviderError };

/**
 * Information about a model.
 */
export interface ModelInfo {
  name: string;
  sizeBytes?: number;
  modifiedAt?: string;
  details?: Record<string, unknown>;
}

/**
 * Progress information for model pulling.
 */
export interface PullProgress {
  status: string;
  completed?: number;
  total?: number;
}

/**
 * Provider adapter interface.
 * Implementations connect the core runtime to specific LLM backends.
 */
export interface ProviderAdapter {
  /** Unique name for this provider */
  name: string;

  /**
   * Stream chat completion from the provider.
   * @param request The chat request
   * @returns Async iterable of provider events
   */
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;

  /**
   * Count tokens in a request (optional).
   * @param request The chat request
   * @returns Estimated token count
   */
  countTokens?(request: ProviderRequest): Promise<number>;

  /**
   * List available models (optional).
   * @returns Array of model information
   */
  listModels?(): Promise<ModelInfo[]>;

  /**
   * Pull/download a model (optional).
   * @param name Model name
   * @param onProgress Progress callback
   */
  pullModel?(
    name: string,
    onProgress?: (progress: PullProgress) => void
  ): Promise<void>;

  /**
   * Delete a model (optional).
   * @param name Model name
   */
  deleteModel?(name: string): Promise<void>;

  /**
   * Get detailed information about a model (optional).
   * @param name Model name
   * @returns Model information
   */
  showModel?(name: string): Promise<ModelInfo>;

  /**
   * Unload a model from memory (optional).
   * @param name Model name
   */
  unloadModel?(name: string): Promise<void>;
}
