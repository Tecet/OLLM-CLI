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
   * Map tool schemas to Ollama function calling format.
   */
  private mapTools(tools: ToolSchema[]): unknown[] {
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
        yield {
          type: 'tool_call',
          value: {
            id: toolCall.id ?? crypto.randomUUID(),
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}'),
          },
        };
      }
    }

    if (chunk.done) {
      yield { type: 'finish', reason: chunk.done_reason || 'stop' };
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
