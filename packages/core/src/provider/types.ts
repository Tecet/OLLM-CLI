import { createLogger } from '../utils/logger.js';

const logger = createLogger('types');
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
  num_ctx?: number;
  /** Hint for how many GPUs to use (Ollama placement guidance) */
  num_gpu?: number;
  /** Hint for how many layers to keep on GPU (Ollama placement guidance) */
  gpu_layers?: number;
  /** Ollama-specific alias for GPU layer placement */
  num_gpu_layers?: number;
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
  think?: boolean | string; // Enable thinking/reasoning mode (true/false or 'low'/'medium'/'high' for GPT-OSS)
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
  | { type: 'thinking'; value: string }
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
 * 
 * Implementations connect the core runtime to specific LLM backends.
 * All providers must implement chatStream, while other methods are optional.
 * 
 * Provider Lifecycle:
 * 1. Provider instantiated with configuration
 * 2. chatStream called for each inference request
 * 3. Events streamed back to caller via AsyncIterable
 * 4. Provider cleaned up on application exit
 * 
 * Error Handling:
 * - Providers should emit error events rather than throwing
 * - Network errors should be caught and converted to error events
 * - Validation errors can throw during initialization
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const provider = new LocalProvider({ baseUrl: 'http://localhost:11434' });
 * 
 * for await (const event of provider.chatStream(request)) {
 *   if (event.type === 'text') {
 *     logger.info(event.value);
 *   } else if (event.type === 'error') {
 *     logger.error(event.error.message);
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // With tool calling
 * const request: ProviderRequest = {
 *   model: 'llama3.2',
 *   messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
 *   tools: [{ name: 'search', description: 'Search the web' }],
 * };
 * 
 * for await (const event of provider.chatStream(request)) {
 *   if (event.type === 'tool_call') {
 *     logger.info('Tool called:', event.value.name);
 *   }
 * }
 * ```
 */
export interface ProviderAdapter {
  /** 
   * Unique identifier for this provider.
   * Used for provider selection and logging.
   * Should be lowercase and URL-safe (e.g., 'local', 'vllm', 'openai').
   */
  name: string;

  /**
   * Stream chat completion from the provider.
   * 
   * This is the core method that all providers must implement.
   * It should stream events as they arrive from the LLM backend.
   * 
   * Event Types:
   * - `text`: Incremental text tokens from the model
   * - `thinking`: Reasoning/thinking tokens (if supported)
   * - `tool_call`: Function/tool call requests from the model
   * - `finish`: Completion with reason and optional metrics
   * - `error`: Error information (should not throw)
   * 
   * Timeout Handling:
   * - Providers should respect request.timeout if provided
   * - Providers should respect request.abortSignal for cancellation
   * - Inactivity timeouts should reset on each chunk received
   * 
   * @param request - The chat request with messages, tools, and options
   * @returns Async iterable of provider events
   * 
   * @example
   * ```typescript
   * async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
   *   const response = await fetch(url, { body: JSON.stringify(request) });
   *   
   *   for await (const chunk of parseStream(response.body)) {
   *     if (chunk.content) {
   *       yield { type: 'text', value: chunk.content };
   *     }
   *   }
   *   
   *   yield { type: 'finish', reason: 'stop' };
   * }
   * ```
   */
  chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent>;

  /**
   * Count tokens in a request (optional).
   * 
   * Provides an estimate of how many tokens the request will consume.
   * Used for context window management and cost estimation.
   * 
   * Implementation Strategies:
   * - Accurate: Use tiktoken or model-specific tokenizer
   * - Fast: Use character-based estimation (chars * multiplier)
   * - Fallback: Return undefined if not supported
   * 
   * @param request - The chat request to count tokens for
   * @returns Estimated token count, or undefined if not supported
   * 
   * @example
   * ```typescript
   * async countTokens(request: ProviderRequest): Promise<number> {
   *   let total = 0;
   *   if (request.systemPrompt) {
   *     total += this.tokenize(request.systemPrompt).length;
   *   }
   *   for (const msg of request.messages) {
   *     for (const part of msg.parts) {
   *       if (part.type === 'text') {
   *         total += this.tokenize(part.text).length;
   *       }
   *     }
   *   }
   *   return total;
   * }
   * ```
   */
  countTokens?(request: ProviderRequest): Promise<number>;

  /**
   * List available models (optional).
   * 
   * Returns information about models available from this provider.
   * Used for model selection UI and validation.
   * 
   * @returns Array of model information
   * @throws {Error} If the provider cannot list models
   * 
   * @example
   * ```typescript
   * async listModels(): Promise<ModelInfo[]> {
   *   const response = await fetch(`${this.baseUrl}/api/tags`);
   *   const data = await response.json();
   *   return data.models.map(m => ({
   *     name: m.name,
   *     sizeBytes: m.size,
   *     modifiedAt: m.modified_at,
   *   }));
   * }
   * ```
   */
  listModels?(): Promise<ModelInfo[]>;

  /**
   * Pull/download a model (optional).
   * 
   * Downloads a model from a registry or repository.
   * Progress updates are provided via the onProgress callback.
   * 
   * @param name - Model name or identifier
   * @param onProgress - Optional callback for progress updates
   * @throws {Error} If the model cannot be pulled
   * 
   * @example
   * ```typescript
   * await provider.pullModel('llama3.2', (progress) => {
   *   logger.info(`${progress.status}: ${progress.completed}/${progress.total}`);
   * });
   * ```
   */
  pullModel?(
    name: string,
    onProgress?: (progress: PullProgress) => void
  ): Promise<void>;

  /**
   * Delete a model (optional).
   * 
   * Removes a model from local storage.
   * This operation is typically irreversible.
   * 
   * @param name - Model name to delete
   * @throws {Error} If the model cannot be deleted
   * 
   * @example
   * ```typescript
   * await provider.deleteModel('llama3.2');
   * ```
   */
  deleteModel?(name: string): Promise<void>;

  /**
   * Get detailed information about a model (optional).
   * 
   * Returns comprehensive information about a specific model,
   * including size, parameters, and capabilities.
   * 
   * @param name - Model name to inspect
   * @returns Detailed model information
   * @throws {Error} If the model cannot be found
   * 
   * @example
   * ```typescript
   * const info = await provider.showModel('llama3.2');
   * logger.info(`Model size: ${info.sizeBytes} bytes`);
   * logger.info(`Parameters: ${info.details?.parameter_size}`);
   * ```
   */
  showModel?(name: string): Promise<ModelInfo>;

  /**
   * Unload a model from memory (optional).
   * 
   * Frees memory by unloading a model that is currently loaded.
   * Useful for managing memory on systems with limited resources.
   * 
   * @param name - Model name to unload
   * @throws {Error} If the model cannot be unloaded
   * 
   * @example
   * ```typescript
   * // Unload model to free memory
   * await provider.unloadModel('llama3.2');
   * ```
   */
  unloadModel?(name: string): Promise<void>;
}
