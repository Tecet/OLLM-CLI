/**
 * Local provider adapter for Ollama (or compatible local LLM server).
 * Implements the ProviderAdapter interface to connect to a local server.
 */

import { createLogger, createVRAMMonitor } from '@ollm/core';
import { deriveGPUPlacementHints, type GPUPlacementHints } from '@ollm/core/context/gpuHints.js';

import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderEvent,
  Message,
  MessagePart,
  ToolSchema,
  ModelInfo,
  PullProgress,
} from '@ollm/core';

/**
 * Configuration for the local provider.
 */
export interface LocalProviderConfig {
  /** Base URL of the local server (e.g., 'http://localhost:11434') */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Token counting method: 'tiktoken' (accurate) or 'multiplier' (fast) */
  tokenCountingMethod?: 'tiktoken' | 'multiplier';
}

/**
 * Token counting multipliers for different model families
 * Based on empirical testing with various models
 */
const TOKEN_MULTIPLIERS: Record<string, number> = {
  'llama': 0.25,      // ~4 chars per token
  'mistral': 0.27,    // ~3.7 chars per token
  'gemma': 0.26,      // ~3.8 chars per token
  'qwen': 0.28,       // ~3.6 chars per token
  'phi': 0.26,        // ~3.8 chars per token
  'codellama': 0.25,  // ~4 chars per token
  'default': 0.25,    // Conservative default
};

const logger = createLogger('LocalProvider');

/**
 * Check if payload contains tools
 * @param payload - Request payload to check
 * @returns True if payload has non-empty tools array
 */
function payloadHasTools(payload: { tools?: unknown }): boolean {
  return Array.isArray(payload.tools) && payload.tools.length > 0;
}

/**
 * Check if error message indicates tool unsupported error
 * Uses multiple patterns to detect various Ollama error formats
 * 
 * @param errorText - Error message text from Ollama
 * @returns True if error indicates tools are not supported
 */
function isToolUnsupportedError(errorText: string): boolean {
  const patterns = [
    /tools?.*not supported/i,
    /tool_calls?.*not supported/i,
    /unknown field.*tools?/i,
    /unknown field.*tool_calls?/i,
    /function calling.*not supported/i,
    /invalid.*tools?/i,
    /model does not support.*tools?/i,
    /tools?.*not available/i,
    /tools?.*disabled/i,
  ];
  
  const matched = patterns.some(pattern => pattern.test(errorText));
  
  if (matched) {
    logger.debug('Tool unsupported error detected', { 
      errorText: errorText.substring(0, 100) 
    });
  }
  
  return matched;
}

/**
 * Format HTTP error message with status and details
 * @param status - HTTP status code
 * @param statusText - HTTP status text
 * @param details - Additional error details
 * @returns Formatted error message
 */
function formatHttpError(status: number, statusText: string, details: string): string {
  const trimmed = details.trim();
  return trimmed.length > 0
    ? `HTTP ${status}: ${statusText} - ${trimmed}`
    : `HTTP ${status}: ${statusText}`;
}

/**
 * Local provider adapter for Ollama-compatible servers.
 * 
 * This provider connects to a local Ollama server (or compatible API)
 * and implements the full ProviderAdapter interface with support for:
 * - Streaming chat completions
 * - Function/tool calling with automatic retry on unsupported errors
 * - Token counting (tiktoken + character-based fallback)
 * - Model management (list, pull, delete, show, unload)
 * - Thinking/reasoning mode
 * - Timeout and abort signal handling
 * 
 * Key Features:
 * - Automatic tool unsupported error detection and retry
 * - Healer pattern for malformed tool calls from small models
 * - Flexible token counting with multiple strategies
 * - Comprehensive tool schema validation
 * - Inactivity timeout that resets on each chunk
 * 
 * @example
 * ```typescript
 * const provider = new LocalProvider({
 *   baseUrl: 'http://localhost:11434',
 *   timeout: 30000,
 *   tokenCountingMethod: 'tiktoken',
 * });
 * 
 * for await (const event of provider.chatStream(request)) {
 *   if (event.type === 'text') {
 *     console.log(event.value);
 *   }
 * }
 * ```
 */
export class LocalProvider implements ProviderAdapter {
  readonly name = 'local';
  private readonly vramMonitor = createVRAMMonitor();

  constructor(private config: LocalProviderConfig) {}

  private async getGPUPlacementHints(numCtx?: number): Promise<GPUPlacementHints | undefined> {
    if (!numCtx || numCtx <= 0) {
      return undefined;
    }

    try {
      const vramInfo = await this.vramMonitor.getInfo();
      const source = {
        vramFree: vramInfo.available,
        available: vramInfo.available,
      };
      return deriveGPUPlacementHints(source, numCtx);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug('Failed to derive GPU placement hints', { error: message });
      return undefined;
    }
  }

  /**
   * Stream chat completion from the local Ollama server.
   * 
   * This method implements the core streaming functionality with:
   * - Automatic retry on tool unsupported errors (removes tools and retries)
   * - Inactivity timeout that resets on each chunk received
   * - Abort signal support for request cancellation
   * - NDJSON stream parsing with error recovery
   * - Healer pattern for malformed tool calls
   * 
   * Error Handling:
   * - HTTP errors: Emits error event with status code
   * - Tool unsupported: Emits error event, then retries without tools
   * - Network errors: Emits error event
   * - Abort: Emits finish event and returns
   * - Malformed JSON: Logs warning and continues (doesn't break stream)
   * 
   * @param request - The chat request with messages, tools, and options
   * @returns Async iterable of provider events
   * 
   * @example
   * ```typescript
   * const request: ProviderRequest = {
   *   model: 'llama3.2',
   *   messages: [{ role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
   *   tools: [{ name: 'search', description: 'Search the web' }],
   *   options: { temperature: 0.7, num_ctx: 8192 },
   *   timeout: 30000,
   * };
   * 
   * for await (const event of provider.chatStream(request)) {
   *   console.log(event);
   * }
   * ```
   */
  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    const url = `${this.config.baseUrl}/api/chat`;
    const gpuHints = await this.getGPUPlacementHints(request.options?.num_ctx);
    const generationOptions = request.options ?? {};
    const optionsPayload = {
      ...generationOptions,
      ...(gpuHints ?? {}),
    };
    const defaultFinishEvent: ProviderEvent = {
      type: 'finish',
      reason: 'stop',
      metrics: {
        totalDuration: 0,
        loadDuration: 0,
        promptEvalCount: 0,
        promptEvalDuration: 0,
        evalCount: 0,
        evalDuration: 0,
      },
    };
    let sawFinish = false;

    const body = {
      model: request.model,
      messages: this.mapMessages(request.messages, request.systemPrompt),
      tools: request.tools ? this.mapTools(request.tools) : undefined,
      options: optionsPayload, // Pass options (temperature, num_ctx, etc.) to Ollama
      stream: true,
      think: request.think, // Pass thinking parameter to Ollama
    };

    // Log context window configuration for debugging
    if (request.options?.num_ctx) {
      logger.debug('Sending context window configuration to Ollama', { 
        model: request.model,
        num_ctx: request.options.num_ctx 
      });
    }

    // Use request-specific timeout if provided, otherwise use config timeout, default to 30s
    const timeout = request.timeout ?? this.config.timeout ?? 30000;
    const controller = new AbortController();
    const { signal } = controller;

    // Link incoming abort signal
    if (request.abortSignal) {
      if (request.abortSignal.aborted) {
        yield { 
          type: 'error', 
          error: { message: 'Request aborted by user' } 
        };
        return;
      }
      request.abortSignal.addEventListener('abort', () => {
        controller.abort(request.abortSignal?.reason);
      }, { once: true });
    }

    // Set inactivity timeout - resets on each chunk received
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        controller.abort(new Error(`Ollama request timed out after ${timeout}ms of inactivity`));
      }, timeout);
    };
    
    // Start initial timeout
    resetTimeout();

    try {
      const sendRequest = async (payload: typeof body): Promise<Response> => {
        return fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });
      };

      let response = await sendRequest(body);

      if (!response.ok) {
        let errorText = await response.text();
        const looksLikeToolError = response.status === 400
          && payloadHasTools(body)
          && isToolUnsupportedError(errorText);

        if (looksLikeToolError) {
          // Emit detailed error event for tool error before retry
          const details = errorText.trim();
          logger.info('Tool unsupported error, retrying without tools', { 
            model: request.model,
            error: details.substring(0, 200) 
          });
          
          yield {
            type: 'error',
            error: {
              message: details.length > 0
                ? `Tool support error: ${details}`
                : 'Model does not support function calling',
              code: 'TOOL_UNSUPPORTED',
              httpStatus: response.status,
              originalError: details,
            },
          };

          // Retry without tools
          const retryBody = { ...body, tools: undefined };
          response = await sendRequest(retryBody);
          if (!response.ok) {
            errorText = await response.text();
          }
        }

        if (!response.ok) {
          if (timeoutId) clearTimeout(timeoutId);
          const details = errorText.trim();
          logger.error('HTTP error from Ollama', { 
            status: response.status, 
            statusText: response.statusText,
            error: details.substring(0, 200) 
          });
          
          yield {
            type: 'error',
            error: {
              message: formatHttpError(response.status, response.statusText, details),
              code: String(response.status),
            },
          };
          return;
        }
      }

      if (!response.body) {
        if (timeoutId) clearTimeout(timeoutId);
        yield {
          type: 'error',
          error: { message: 'No response body' },
        };
        return;
      }

      // Parse NDJSON stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Reset inactivity timeout - we received data
        resetTimeout();

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line);
            if (chunk && typeof chunk === 'object' && 'done' in chunk && chunk.done) {
              sawFinish = true;
            }
            yield* this.mapChunkToEvents(chunk);
          } catch (error) {
            // Log malformed JSON in debug mode
            logger.debug('Malformed JSON in stream', {
              line: line.substring(0, 100), // First 100 chars
              error: error instanceof Error ? error.message : String(error),
            });
            // Continue processing (don't break stream)
          }
        }
      }

      const trailing = buffer.trim();
      if (trailing.length > 0) {
        try {
          const chunk = JSON.parse(trailing);
          if (chunk && typeof chunk === 'object' && 'done' in chunk && chunk.done) {
            sawFinish = true;
          }
          yield* this.mapChunkToEvents(chunk);
        } catch (error) {
          // Log malformed JSON in trailing buffer
          logger.debug('Malformed JSON in trailing buffer', {
            buffer: trailing.substring(0, 100),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (!sawFinish) {
        yield defaultFinishEvent;
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          if (!sawFinish) {
            yield defaultFinishEvent;
          }
          return;
        }
        yield {
          type: 'error',
          error: { message: error.message },
        };
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Map internal messages to Ollama format.
   * 
   * Converts the internal Message format to Ollama's expected format:
   * - Adds system prompt as first message if provided
   * - Concatenates message parts (text and image placeholders)
   * - Maps tool calls to Ollama's tool_calls format
   * - Preserves tool call IDs for tool responses
   * 
   * @param messages - Internal message array
   * @param systemPrompt - Optional system prompt to prepend
   * @returns Array of Ollama-formatted messages
   */
  private mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
    const mapped = [];

    if (systemPrompt) {
      mapped.push({ role: 'system', content: systemPrompt });
    }

    // Configuration for message part concatenation
    const IMAGE_PLACEHOLDER = '[image]';

    for (const msg of messages) {
      const content = msg.parts
        .map((part: MessagePart) => (part.type === 'text' ? part.text : IMAGE_PLACEHOLDER))
        .join(''); // Direct concatenation - parts should handle their own spacing

      mapped.push({
        role: msg.role === 'tool' ? 'tool' : msg.role,
        content,
        ...(msg.name && { name: msg.name }),
        ...(msg.toolCalls && {
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.args // Ollama expects an object, not a JSON string
            }
          }))
        }),
        ...(msg.toolCallId && { tool_call_id: msg.toolCallId })
      });
    }

    return mapped;
  }

  /**
   * Validate a tool schema for correctness.
   * Throws an error with a descriptive message if the schema is invalid.
   */
  private validateToolSchema(tool: ToolSchema): void {
    // Validate tool name
    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Tool schema validation failed: Tool name is required and must be a non-empty string');
    }

    const trimmedName = tool.name.trim();
    if (trimmedName === '') {
      throw new Error('Tool schema validation failed: Tool name cannot be empty or whitespace only');
    }

    // Relaxed validation: Allow dots and slashes for namespaced tools (e.g., "mcp.search", "github/issues")
    // Must start with letter or underscore, can contain alphanumeric, underscore, dash, dot, or slash
    if (!/^[a-zA-Z_][a-zA-Z0-9_./-]*$/.test(tool.name)) {
      throw new Error(
        `Tool schema validation failed: Tool name "${tool.name}" is invalid. ` +
        'Tool names must start with a letter or underscore and contain only letters, numbers, underscores, dashes, dots, or slashes'
      );
    }

    // Validate parameters if present
    if (tool.parameters !== undefined && tool.parameters !== null) {
      this.validateJsonSchema(tool.parameters, `tool "${tool.name}"`);
    }
  }

  /**
   * Validate a JSON Schema object for correctness.
   * Throws an error with a descriptive message if the schema is invalid.
   */
  private validateJsonSchema(schema: unknown, context: string): void {
    // Check for circular references
    const seen = new WeakSet();
    const checkCircular = (obj: unknown, path: string = 'root'): void => {
      if (obj === null || typeof obj !== 'object') return;
      
      if (seen.has(obj)) {
        throw new Error(
          `Tool schema validation failed: Circular reference detected in ${context} at ${path}`
        );
      }
      
      seen.add(obj);
      
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => checkCircular(item, `${path}[${index}]`));
      } else if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => checkCircular((obj as Record<string, unknown>)[key], `${path}.${key}`));
      }
    };

    checkCircular(schema);

    const s = schema as Record<string, unknown>;
    // Validate type field if present
    if (s.type !== undefined) {
      const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
      if (typeof s.type !== 'string' || !validTypes.includes(s.type)) {
        throw new Error(
          `Tool schema validation failed: Invalid type "${s.type}" in ${context}. ` +
          `Valid types are: ${validTypes.join(', ')}`
        );
      }

      // Validate type-specific constraints
      if (s.type === 'object') {
        // Validate properties structure
        if (s.properties !== undefined) {
          if (typeof s.properties !== 'object' || Array.isArray(s.properties)) {
            throw new Error(
              `Tool schema validation failed: "properties" must be an object in ${context}`
            );
          }

          // Recursively validate nested properties
          for (const [propName, propSchema] of Object.entries(s.properties as Record<string, unknown>)) {
            this.validateJsonSchema(propSchema, `${context}.properties.${propName}`);
          }
        }

        // Validate required field
        if (s.required !== undefined) {
          if (!Array.isArray(s.required)) {
            throw new Error(
              `Tool schema validation failed: "required" must be an array in ${context}`
            );
          }
          for (const req of s.required) {
            if (typeof req !== 'string') {
              throw new Error(`Tool schema validation failed: "required" elements must be strings in ${context}`);
            }
          }
        }
      }

      if (s.type === 'array') {
        // Array schemas should have items definition (but it's not strictly required in JSON Schema)
        // We'll only validate items if it's present
        if (s.items !== undefined && s.items !== null) {
          this.validateJsonSchema(s.items, `${context}.items`);
        }
      }
    } else {
      // If no type is specified, check if properties field exists (implies object type)
      if (s.properties !== undefined) {
        // This is likely an object schema without explicit type
        // Validate properties structure
        if (typeof s.properties !== 'object' || Array.isArray(s.properties)) {
          throw new Error(
            `Tool schema validation failed: "properties" must be an object in ${context}`
          );
        }

        // Recursively validate nested properties
        for (const [propName, propSchema] of Object.entries(s.properties as Record<string, unknown>)) {
          this.validateJsonSchema(propSchema, `${context}.properties.${propName}`);
        }
      }

      // Validate required field even without type
      if (s.required !== undefined) {
        if (!Array.isArray(s.required)) {
          throw new Error(
            `Tool schema validation failed: "required" must be an array in ${context}`
          );
        }
        for (const req of s.required) {
          if (typeof req !== 'string') {
            throw new Error(`Tool schema validation failed: "required" elements must be strings in ${context}`);
          }
        }
      }
    }

    // Validate enum if present
    if (s.enum !== undefined) {
      if (!Array.isArray(s.enum)) {
        throw new Error(
          `Tool schema validation failed: "enum" must be an array in ${context}`
        );
      }

      if (s.enum.length === 0) {
        throw new Error(
          `Tool schema validation failed: "enum" array cannot be empty in ${context}`
        );
      }
    }

    // Validate numeric constraints
    if (s.minimum !== undefined && s.maximum !== undefined) {
      if (typeof s.minimum === 'number' && typeof s.maximum === 'number') {
        if (s.minimum > s.maximum) {
          throw new Error(
            `Tool schema validation failed: Conflicting constraints in ${context} - ` +
            `minimum (${s.minimum}) cannot be greater than maximum (${s.maximum})`
          );
        }
      }
    }

    // Validate string length constraints
    if (s.minLength !== undefined && s.maxLength !== undefined) {
      if (typeof s.minLength === 'number' && typeof s.maxLength === 'number') {
        if (s.minLength > s.maxLength) {
          throw new Error(
            `Tool schema validation failed: Conflicting constraints in ${context} - ` +
            `minLength (${s.minLength}) cannot be greater than maxLength (${s.maxLength})`
          );
        }
      }
    }

    // Validate array item constraints
    if (s.minItems !== undefined && s.maxItems !== undefined) {
      if (typeof s.minItems === 'number' && typeof s.maxItems === 'number') {
        if (s.minItems > s.maxItems) {
          throw new Error(
            `Tool schema validation failed: Conflicting constraints in ${context} - ` +
            `minItems (${s.minItems}) cannot be greater than maxItems (${s.maxItems})`
          );
        }
      }
    }
  }

  /**
   * Map tool schemas to Ollama function calling format.
   * 
   * Validates each tool schema before mapping to ensure:
   * - Tool names are valid (alphanumeric, underscore, dash, dot, slash)
   * - Parameters are valid JSON Schema
   * - No circular references in schemas
   * - Constraints are not conflicting
   * 
   * @param tools - Array of tool schemas to map
   * @returns Array of Ollama-formatted function definitions
   * @throws {Error} If any tool schema is invalid
   */
  private mapTools(tools: ToolSchema[]): unknown[] {
    // Validate each tool schema before mapping
    for (const tool of tools) {
      this.validateToolSchema(tool);
    }

    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Map Ollama response chunks to provider events.
   * 
   * This method handles several edge cases:
   * 
   * 1. Thinking Mode: Ollama's native thinking support is mapped to
   *    thinking events for display to the user.
   * 
   * 2. Healer Pattern: Some small models output tool calls as JSON strings
   *    in the content field instead of using tool_calls. We detect and
   *    convert these to proper tool_call events using conservative heuristics:
   *    - Must be valid JSON object
   *    - Must have 'name' field (string, no spaces, < 50 chars)
   *    - Must have 'parameters' or 'args' field
   * 
   * 3. Tool Call Arguments: Ollama can send arguments as either a string
   *    (JSON) or an object. We normalize to object format and handle
   *    parsing errors gracefully.
   * 
   * 4. Finish Reason: Maps Ollama's done_reason to standard finish reasons
   *    (stop, length, tool).
   * 
   * @param chunk - Raw chunk from Ollama NDJSON stream
   * @yields ProviderEvent objects (text, thinking, tool_call, finish)
   */
  private *mapChunkToEvents(chunk: unknown): Iterable<ProviderEvent> {
    const c = chunk as Record<string, unknown>;
    const message = c.message as Record<string, unknown> | undefined;
    
    // Handle thinking field (Ollama native thinking support)
    if (message?.thinking !== undefined) {
      const thinking = message.thinking as string;
      if (thinking.length > 0) {
        yield { type: 'thinking', value: thinking };
      }
    }
    
    if (message?.content !== undefined) {
      const content = message.content as string;
      
      // Healer: Detect if small model outputted tool call as a JSON string in content
      // This is a workaround for models that don't properly format tool calls
      // Made more conservative to reduce false positives
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
          try {
              const possibleToolCall = JSON.parse(content.trim());
              
              // More conservative check: Must look like a function call structure
              // Requires: name (string), and either parameters or args (present, any type)
              // Also check that it's not just any JSON object (e.g., data response)
              const hasName = typeof possibleToolCall.name === 'string' && possibleToolCall.name.length > 0;
              const hasParams = possibleToolCall.parameters !== undefined || possibleToolCall.args !== undefined;
              
              // Additional heuristic: Check if name looks like a function name (not a sentence)
              // Function names typically don't have spaces and are relatively short
              const looksLikeFunction = hasName && 
                                       !possibleToolCall.name.includes(' ') && 
                                       possibleToolCall.name.length < 50;
              
              // Only treat as tool call if it has the right structure AND looks like a function
              if (hasName && hasParams && looksLikeFunction) {
                  // Handle parameters/args that might not be objects
                  let args: Record<string, unknown>;
                  const rawParams = possibleToolCall.parameters || possibleToolCall.args;
                  
                  if (typeof rawParams === 'object' && rawParams !== null) {
                      args = rawParams as Record<string, unknown>;
                  } else {
                      // Wrap non-object values in an object to match ToolCall interface
                      args = { value: rawParams };
                  }
                  
                  yield {
                      type: 'tool_call',
                      value: {
                          id: crypto.randomUUID(),
                          name: possibleToolCall.name,
                          args
                      }
                  };
                  return; // Skip yielding as text
              }
          } catch {
              // Not a valid tool call JSON, fall through to normal text
          }
      }
      
      yield { type: 'text', value: content };
    }

    const toolCalls = message?.tool_calls as Array<{
      id?: string;
      function: {
        name: string;
        arguments: unknown; // arguments can be string or object from Ollama
      }
    }> | undefined;
    if (toolCalls) {
      for (const toolCall of toolCalls) {
        let args: Record<string, unknown>;
        const rawArgs = toolCall.function.arguments;
        
        if (typeof rawArgs === 'object' && rawArgs !== null) {
          args = rawArgs as Record<string, unknown>;
        } else {
          const stringArgs = typeof rawArgs === 'string' ? rawArgs : '{}';
          try {
            if (typeof rawArgs === 'string' && rawArgs.trim().length === 0) {
              args = {};
            } else {
            const parsed = JSON.parse(stringArgs);
            // Ensure args is always an object, even if JSON.parse returns a primitive
            args = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
            }
          } catch (error) {
            // If JSON parsing fails, propagate the error so the system can heal it
            const err = error as Error;
            args = {
              __parsing_error__: true,
              message: err.message,
              raw: rawArgs
            };
          }
        }

        yield {
          type: 'tool_call',
          value: {
            id: toolCall.id ?? crypto.randomUUID(),
            name: toolCall.function.name,
            args,
          },
        };
      }
    }

    if (c.done) {
      // Map server's done_reason to ProviderEvent finish reason
      let reason: 'stop' | 'length' | 'tool' = 'stop';
      if (c.done_reason === 'length') {
        reason = 'length';
      } else if (c.done_reason === 'tool_calls' || c.done_reason === 'tool') {
        reason = 'tool';
      }

      yield {
        type: 'finish',
        reason,
        metrics: {
          totalDuration: (c.total_duration as number) || 0,
          loadDuration: (c.load_duration as number) || 0,
          promptEvalCount: (c.prompt_eval_count as number) || 0,
          promptEvalDuration: (c.prompt_eval_duration as number) || 0,
          evalCount: (c.eval_count as number) || 0,
          evalDuration: (c.eval_duration as number) || 0,
        }
      };
    }
  }

  /**
   * Get token multiplier for a specific model family.
   * 
   * Uses empirical testing data to determine the average characters per token
   * for different model families. Falls back to a conservative default if the
   * model family is not recognized.
   * 
   * Multipliers:
   * - llama: 0.25 (~4 chars/token)
   * - mistral: 0.27 (~3.7 chars/token)
   * - gemma: 0.26 (~3.8 chars/token)
   * - qwen: 0.28 (~3.6 chars/token)
   * - phi: 0.26 (~3.8 chars/token)
   * - codellama: 0.25 (~4 chars/token)
   * - default: 0.25 (conservative)
   * 
   * @param model - Model name to get multiplier for
   * @returns Token multiplier (chars per token)
   */
  private getTokenMultiplier(model: string): number {
    const modelLower = model.toLowerCase();
    
    for (const [family, multiplier] of Object.entries(TOKEN_MULTIPLIERS)) {
      if (modelLower.includes(family)) {
        logger.debug('Using token multiplier for model family', { 
          model, 
          family, 
          multiplier 
        });
        return multiplier;
      }
    }
    
    logger.debug('Using default token multiplier', { model });
    return TOKEN_MULTIPLIERS.default;
  }

  /**
   * Count tokens using tiktoken library (accurate method).
   * 
   * Uses the tiktoken library with cl100k_base encoding (used by GPT-3.5/4)
   * as a good approximation for most models. This method is more accurate
   * than character-based estimation but requires loading the tiktoken library.
   * 
   * Falls back to multiplier method if tiktoken fails to load or encounters
   * an error during encoding.
   * 
   * @param request - Provider request to count tokens for
   * @returns Token count
   */
  private async countTokensWithTiktoken(request: ProviderRequest): Promise<number> {
    try {
      // Dynamic import to avoid loading tiktoken if not needed
      const { encoding_for_model } = await import('tiktoken');
      
      // Use cl100k_base encoding (used by GPT-3.5/4, good approximation for most models)
      const encoding = encoding_for_model('gpt-3.5-turbo');
      
      let totalTokens = 0;
      
      if (request.systemPrompt) {
        totalTokens += encoding.encode(request.systemPrompt).length;
      }
      
      for (const msg of request.messages) {
        for (const part of msg.parts) {
          if (part.type === 'text') {
            totalTokens += encoding.encode(part.text).length;
          }
        }
      }
      
      encoding.free(); // Clean up
      
      logger.debug('Token count (tiktoken)', { 
        model: request.model, 
        tokens: totalTokens 
      });
      
      return totalTokens;
    } catch (error) {
      logger.warn('Tiktoken failed, falling back to multiplier method', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return this.countTokensWithMultiplier(request);
    }
  }

  /**
   * Count tokens using character multiplier (fast fallback method).
   * 
   * Estimates token count by multiplying character count by a model-specific
   * multiplier. This method is fast but less accurate than tiktoken.
   * 
   * The multiplier is determined by the model family (llama, mistral, etc.)
   * and represents the average characters per token for that family.
   * 
   * @param request - Provider request to count tokens for
   * @returns Estimated token count
   */
  private countTokensWithMultiplier(request: ProviderRequest): Promise<number> {
    let totalChars = 0;
    
    if (request.systemPrompt) {
      totalChars += request.systemPrompt.length;
    }
    
    for (const msg of request.messages) {
      for (const part of msg.parts) {
        if (part.type === 'text') {
          totalChars += part.text.length;
        }
      }
    }
    
    const multiplier = this.getTokenMultiplier(request.model);
    const tokens = Math.ceil(totalChars * multiplier);
    
    logger.debug('Token count (multiplier)', { 
      model: request.model, 
      chars: totalChars, 
      multiplier, 
      tokens 
    });
    
    return Promise.resolve(tokens);
  }

  /**
   * Count tokens in a request using fallback estimation.
   * 
   * Supports two token counting methods:
   * - 'tiktoken': Accurate counting using tiktoken library (default)
   * - 'multiplier': Fast character-based estimation
   * 
   * The method can be configured via LocalProviderConfig.tokenCountingMethod.
   * Tiktoken method automatically falls back to multiplier if it fails.
   * 
   * @param request - The chat request to count tokens for
   * @returns Estimated token count
   */
  async countTokens(request: ProviderRequest): Promise<number> {
    const method = this.config.tokenCountingMethod || 'tiktoken';
    
    if (method === 'tiktoken') {
      return this.countTokensWithTiktoken(request);
    } else {
      return this.countTokensWithMultiplier(request);
    }
  }

  /**
   * List available models from the local Ollama server.
   * 
   * Fetches the list of models from the /api/tags endpoint and maps
   * them to the ModelInfo format.
   * 
   * @returns Array of model information
   * @throws {Error} If the request fails
   */
  async listModels(): Promise<ModelInfo[]> {
    const url = `${this.config.baseUrl}/api/tags`;
    const response = await fetch(url);
    const data = await response.json();

    return data.models.map((model: { name: string; size: number; modified_at: string; details: { format: string; family: string; families: string[]; parameter_size: string; quantization_level: string } }) => ({
      name: model.name,
      sizeBytes: model.size,
      modifiedAt: model.modified_at,
      details: model.details,
    }));
  }

  /**
   * Pull/download a model from the Ollama registry.
   * 
   * Downloads a model and streams progress updates via the onProgress callback.
   * The download is streamed as NDJSON with status and progress information.
   * 
   * @param name - Model name to pull (e.g., 'llama3.2', 'mistral:7b')
   * @param onProgress - Optional callback for progress updates
   * @throws {Error} If the request fails
   * 
   * @example
   * ```typescript
   * await provider.pullModel('llama3.2', (progress) => {
   *   console.log(`${progress.status}: ${progress.completed}/${progress.total}`);
   * });
   * ```
   */
  async pullModel(
    name: string,
    onProgress?: (progress: PullProgress) => void
  ): Promise<void> {
    const url = `${this.config.baseUrl}/api/pull`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
    });

    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const progress = JSON.parse(line);
          onProgress?.({
            status: progress.status,
            completed: progress.completed,
            total: progress.total,
          });
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  /**
   * Delete a model from the local Ollama server.
   * 
   * Permanently removes a model from local storage.
   * This operation cannot be undone.
   * 
   * @param name - Model name to delete
   * @throws {Error} If the request fails
   */
  async deleteModel(name: string): Promise<void> {
    const url = `${this.config.baseUrl}/api/delete`;
    await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
  }

  /**
   * Unload a model from memory (Ollama keep_alive=0).
   * 
   * Frees memory by unloading a model that is currently loaded.
   * This is useful for managing memory on systems with limited resources.
   * 
   * @param name - Model name to unload
   * @throws {Error} If the model cannot be unloaded
   */
  async unloadModel(name: string): Promise<void> {
    const url = `${this.config.baseUrl}/api/generate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: name,
        prompt: '',
        keep_alive: 0,
        stream: false,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Failed to unload model "${name}": ${formatHttpError(response.status, response.statusText, details)}`
      );
    }
  }

  /**
   * Get detailed information about a model.
   * 
   * Fetches comprehensive information about a specific model including
   * size, modification date, and model details (format, family, parameters).
   * 
   * @param name - Model name to inspect
   * @returns Detailed model information
   * @throws {Error} If the request fails or model not found
   */
  async showModel(name: string): Promise<ModelInfo> {
    const url = `${this.config.baseUrl}/api/show`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();
    return {
      name: data.name,
      sizeBytes: data.size,
      modifiedAt: data.modified_at,
      details: data.details,
    };
  }
}
