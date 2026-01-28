/**
 * Mock provider for testing the core runtime without a real LLM backend.
 * Supports configurable event sequences, error simulation, and delays.
 */

import type {
  ProviderAdapter,
  ProviderRequest,
  ProviderEvent,
  ModelInfo,
  PullProgress,
} from '@ollm/core';

/**
 * Configuration for a mock provider instance.
 */
export interface MockProviderConfig {
  /** Name of the mock provider */
  name?: string;

  /** Predefined sequence of events to emit */
  eventSequence?: ProviderEvent[];

  /** Delay in milliseconds before emitting each event */
  eventDelay?: number;

  /** Whether to simulate an error */
  simulateError?: boolean;

  /** Error to throw/emit if simulateError is true */
  error?: { message: string; code?: string };

  /** Deterministic token count to return */
  tokenCount?: number;

  /** Mock models to return from listModels */
  models?: ModelInfo[];
}

/**
 * Mock provider adapter for testing.
 * Emits configurable event sequences with optional delays and errors.
 */
export class MockProvider implements ProviderAdapter {
  readonly name: string;
  private config: MockProviderConfig;

  constructor(config: MockProviderConfig = {}) {
    this.name = config.name ?? 'mock';
    this.config = config;
  }

  /**
   * Stream chat completion with configurable event sequence.
   */
  async *chatStream(request: ProviderRequest): AsyncIterable<ProviderEvent> {
    // Check for abort signal
    if (request.abortSignal?.aborted) {
      yield { type: 'finish', reason: 'stop' };
      return;
    }

    // Simulate error if configured
    if (this.config.simulateError) {
      yield {
        type: 'error',
        error: this.config.error ?? { message: 'Mock error', code: 'MOCK_ERROR' },
      };
      return;
    }

    // Emit configured event sequence
    const events = this.config.eventSequence ?? [
      { type: 'text', value: 'Mock response' },
      { type: 'finish', reason: 'stop' },
    ];

    for (const event of events) {
      // Check abort signal before each event
      if (request.abortSignal?.aborted) {
        yield { type: 'finish', reason: 'stop' };
        return;
      }

      // Apply delay if configured
      if (this.config.eventDelay && this.config.eventDelay > 0) {
        await this.delay(this.config.eventDelay);
      }

      yield event as ProviderEvent;
    }
  }

  /**
   * Return deterministic token count if configured.
   */
  async countTokens(request: ProviderRequest): Promise<number> {
    if (this.config.tokenCount !== undefined) {
      return this.config.tokenCount;
    }

    // Fallback: count characters in messages
    let totalChars = 0;

    if (request.systemPrompt) {
      totalChars += request.systemPrompt.length;
    }

    for (const message of request.messages) {
      for (const part of message.parts) {
        if (part.type === 'text') {
          totalChars += part.text.length;
        }
      }
    }

    return Math.ceil(totalChars / 4);
  }

  /**
   * Return mock models if configured.
   */
  async listModels(): Promise<ModelInfo[]> {
    return (
      this.config.models ?? [
        {
          name: 'mock-model',
          sizeBytes: 1000000,
          modifiedAt: new Date().toISOString(),
        },
      ]
    );
  }

  /**
   * Simulate model pulling with progress callbacks.
   */
  async pullModel(_name: string, onProgress?: (progress: PullProgress) => void): Promise<void> {
    const steps = [
      { status: 'downloading', completed: 0, total: 100 },
      { status: 'downloading', completed: 50, total: 100 },
      { status: 'downloading', completed: 100, total: 100 },
      { status: 'complete', completed: 100, total: 100 },
    ];

    for (const step of steps) {
      if (this.config.eventDelay && this.config.eventDelay > 0) {
        await this.delay(this.config.eventDelay);
      }
      onProgress?.(step);
    }
  }

  /**
   * Mock delete model operation.
   */
  async deleteModel(_name: string): Promise<void> {
    // No-op for mock
  }

  /**
   * Return mock model info.
   */
  async showModel(name: string): Promise<ModelInfo> {
    return {
      name,
      sizeBytes: 1000000,
      modifiedAt: new Date().toISOString(),
      details: { mock: true },
    };
  }

  /**
   * Helper to create a delay.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a mock provider with a simple text response.
 */
export function createSimpleMockProvider(text: string = 'Mock response'): MockProvider {
  return new MockProvider({
    eventSequence: [
      { type: 'text', value: text },
      { type: 'finish', reason: 'stop' },
    ],
  });
}

/**
 * Create a mock provider that emits tool calls.
 */
export function createToolCallMockProvider(
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>
): MockProvider {
  const events: ProviderEvent[] = [
    { type: 'text', value: 'Calling tools...' },
    ...toolCalls.map((tc) => ({ type: 'tool_call' as const, value: tc })),
    { type: 'finish', reason: 'tool' as const },
  ];

  return new MockProvider({
    eventSequence: events,
  });
}

/**
 * Create a mock provider that simulates an error.
 */
export function createErrorMockProvider(
  message: string = 'Mock error',
  code?: string
): MockProvider {
  return new MockProvider({
    simulateError: true,
    error: { message, code },
  });
}

/**
 * Create a mock provider with configurable delay for testing parallel execution.
 */
export function createDelayedMockProvider(
  delayMs: number,
  text: string = 'Delayed response'
): MockProvider {
  return new MockProvider({
    eventDelay: delayMs,
    eventSequence: [
      { type: 'text', value: text },
      { type: 'finish', reason: 'stop' },
    ],
  });
}
