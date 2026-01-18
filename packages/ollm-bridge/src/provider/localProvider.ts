/**
 * Local provider adapter for Ollama (or compatible local LLM server).
 * Implements the ProviderAdapter interface to connect to a local server.
 */

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
}

function payloadHasTools(payload: { tools?: unknown }): boolean {
  return Array.isArray(payload.tools) && payload.tools.length > 0;
}

/**
 * Local provider adapter for Ollama-compatible servers.
 */
export class LocalProvider implements ProviderAdapter {
  readonly name = 'local';

  constructor(private config: LocalProviderConfig) {}

  /**
   * Stream chat completion from the local server.
   */
  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    const url = `${this.config.baseUrl}/api/chat`;
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
      options: request.options, // Pass options (temperature, num_ctx, etc.) to Ollama
      stream: true,
      think: request.think, // Pass thinking parameter to Ollama
    };

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

    // Set internal timeout
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Ollama request timed out after ${timeout}ms`));
    }, timeout);

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
          && /tools?|tool_calls?|unknown field/i.test(errorText);

        if (looksLikeToolError) {
          // Emit detailed error event for tool error before retry
          const details = errorText.trim();
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
          clearTimeout(timeoutId);
          const details = errorText.trim();
          yield {
            type: 'error',
            error: {
              message: details.length > 0
                ? `HTTP ${response.status}: ${response.statusText} - ${details}`
                : `HTTP ${response.status}: ${response.statusText}`,
              code: String(response.status),
            },
          };
          return;
        }
      }

      if (!response.body) {
        clearTimeout(timeoutId);
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
          } catch (_error) {
            // Skip malformed JSON
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
        } catch (_error) {
          // Skip malformed JSON in trailing buffer
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
      clearTimeout(timeoutId);
    }
  }

  /**
   * Map internal messages to Ollama format.
   */
  private mapMessages(messages: Message[], systemPrompt?: string): unknown[] {
    const mapped = [];

    if (systemPrompt) {
      mapped.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      const content = msg.parts
        .map((part: MessagePart) => (part.type === 'text' ? part.text : '[image]'))
        .join('');

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

    // Validate tool name format (must start with letter or underscore, contain only alphanumeric, underscore, or dash)
    if (!/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(tool.name)) {
      throw new Error(
        `Tool schema validation failed: Tool name "${tool.name}" is invalid. ` +
        'Tool names must start with a letter or underscore and contain only letters, numbers, underscores, or dashes'
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
   * Map server response chunks to provider events.
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
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
          try {
              const possibleToolCall = JSON.parse(content.trim());
              if (possibleToolCall.name && (possibleToolCall.parameters || possibleToolCall.args)) {
                  yield {
                      type: 'tool_call',
                      value: {
                          id: crypto.randomUUID(),
                          name: possibleToolCall.name,
                          args: possibleToolCall.parameters || possibleToolCall.args || {}
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
   * Count tokens in a request using fallback estimation.
   * Ollama doesn't provide token counting, so we use character count / 4.
   */
  async countTokens(request: ProviderRequest): Promise<number> {
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

    return Math.ceil(totalChars / 4);
  }

  /**
   * List available models from the local server.
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
   * Pull/download a model from the local server.
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
   * Delete a model from the local server.
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
      const suffix = details.trim();
      throw new Error(
        suffix.length > 0
          ? `Failed to unload model "${name}": HTTP ${response.status} ${response.statusText} - ${suffix}`
          : `Failed to unload model "${name}": HTTP ${response.status} ${response.statusText}`
      );
    }
  }

  /**
   * Get detailed information about a model.
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
