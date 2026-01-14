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

    const body = {
      model: request.model,
      messages: this.mapMessages(request.messages, request.systemPrompt),
      tools: request.tools ? this.mapTools(request.tools) : undefined,
      options: request.options,
      stream: true,
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: request.abortSignal,
      });

      if (!response.ok) {
        yield {
          type: 'error',
          error: {
            message: `HTTP ${response.status}: ${response.statusText}`,
            code: String(response.status),
          },
        };
        return;
      }

      if (!response.body) {
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
            yield* this.mapChunkToEvents(chunk);
          } catch (error) {
            // Skip malformed JSON
          }
        }
      }

      yield { type: 'finish', reason: 'stop' };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          yield { type: 'finish', reason: 'stop' };
          return;
        }
        yield {
          type: 'error',
          error: { message: error.message },
        };
      }
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
        role: msg.role,
        content,
        ...(msg.name && { name: msg.name }),
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
  private validateJsonSchema(schema: any, context: string): void {
    // Check for circular references
    const seen = new WeakSet();
    const checkCircular = (obj: any, path: string = 'root'): void => {
      if (obj === null || typeof obj !== 'object') return;
      
      if (seen.has(obj)) {
        throw new Error(
          `Tool schema validation failed: Circular reference detected in ${context} at ${path}`
        );
      }
      
      seen.add(obj);
      
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => checkCircular(item, `${path}[${index}]`));
      } else {
        Object.keys(obj).forEach(key => checkCircular(obj[key], `${path}.${key}`));
      }
    };
    
    try {
      checkCircular(schema);
    } catch (error) {
      throw error;
    }

    // Validate type field if present
    if (schema.type !== undefined) {
      const validTypes = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'];
      if (typeof schema.type !== 'string' || !validTypes.includes(schema.type)) {
        throw new Error(
          `Tool schema validation failed: Invalid type "${schema.type}" in ${context}. ` +
          `Valid types are: ${validTypes.join(', ')}`
        );
      }

      // Validate type-specific constraints
      if (schema.type === 'object') {
        // Validate properties structure
        if (schema.properties !== undefined) {
          if (typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
            throw new Error(
              `Tool schema validation failed: "properties" must be an object in ${context}`
            );
          }
          
          // Recursively validate nested properties
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            this.validateJsonSchema(propSchema, `${context}.properties.${propName}`);
          }
        }

        // Validate required field
        if (schema.required !== undefined) {
          if (!Array.isArray(schema.required)) {
            throw new Error(
              `Tool schema validation failed: "required" must be an array in ${context}`
            );
          }
        }
      }

      if (schema.type === 'array') {
        // Array schemas should have items definition (but it's not strictly required in JSON Schema)
        // We'll only validate items if it's present
        if (schema.items !== undefined && schema.items !== null) {
          this.validateJsonSchema(schema.items, `${context}.items`);
        }
      }
    } else {
      // If no type is specified, check if properties field exists (implies object type)
      if (schema.properties !== undefined) {
        // This is likely an object schema without explicit type
        // Validate properties structure
        if (typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
          throw new Error(
            `Tool schema validation failed: "properties" must be an object in ${context}`
          );
        }
        
        // Recursively validate nested properties
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          this.validateJsonSchema(propSchema, `${context}.properties.${propName}`);
        }
      }

      // Validate required field even without type
      if (schema.required !== undefined) {
        if (!Array.isArray(schema.required)) {
          throw new Error(
            `Tool schema validation failed: "required" must be an array in ${context}`
          );
        }
      }
    }

    // Validate enum if present
    if (schema.enum !== undefined) {
      if (!Array.isArray(schema.enum)) {
        throw new Error(
          `Tool schema validation failed: "enum" must be an array in ${context}`
        );
      }
      
      if (schema.enum.length === 0) {
        throw new Error(
          `Tool schema validation failed: "enum" array cannot be empty in ${context}`
        );
      }
    }

    // Validate numeric constraints
    if (schema.minimum !== undefined && schema.maximum !== undefined) {
      if (typeof schema.minimum === 'number' && typeof schema.maximum === 'number') {
        if (schema.minimum > schema.maximum) {
          throw new Error(
            `Tool schema validation failed: Conflicting constraints in ${context} - ` +
            `minimum (${schema.minimum}) cannot be greater than maximum (${schema.maximum})`
          );
        }
      }
    }

    // Validate string length constraints
    if (schema.minLength !== undefined && schema.maxLength !== undefined) {
      if (typeof schema.minLength === 'number' && typeof schema.maxLength === 'number') {
        if (schema.minLength > schema.maxLength) {
          throw new Error(
            `Tool schema validation failed: Conflicting constraints in ${context} - ` +
            `minLength (${schema.minLength}) cannot be greater than maxLength (${schema.maxLength})`
          );
        }
      }
    }

    // Validate array item constraints
    if (schema.minItems !== undefined && schema.maxItems !== undefined) {
      if (typeof schema.minItems === 'number' && typeof schema.maxItems === 'number') {
        if (schema.minItems > schema.maxItems) {
          throw new Error(
            `Tool schema validation failed: Conflicting constraints in ${context} - ` +
            `minItems (${schema.minItems}) cannot be greater than maxItems (${schema.maxItems})`
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
  private *mapChunkToEvents(chunk: any): Iterable<ProviderEvent> {
    if (chunk.message?.content !== undefined) {
      yield { type: 'text', value: chunk.message.content };
    }

    if (chunk.message?.tool_calls) {
      for (const toolCall of chunk.message.tool_calls) {
        let args: Record<string, unknown>;
        try {
          const parsed = JSON.parse(toolCall.function.arguments || '{}');
          // Ensure args is always an object, even if JSON.parse returns a primitive
          args = typeof parsed === 'object' && parsed !== null ? parsed : {};
        } catch {
          // If JSON parsing fails, use empty object
          args = {};
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

    if (chunk.done) {
      // Map server's done_reason to ProviderEvent finish reason
      let reason: 'stop' | 'length' | 'tool' = 'stop';
      if (chunk.done_reason === 'length') {
        reason = 'length';
      } else if (chunk.done_reason === 'tool_calls' || chunk.done_reason === 'tool') {
        reason = 'tool';
      }
      yield { type: 'finish', reason };
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

    return data.models.map((model: any) => ({
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
