/**
 * Unit tests for MockProvider
 */

import { describe, it, expect } from 'vitest';

import {
  MockProvider,
  createSimpleMockProvider,
  createToolCallMockProvider,
  createErrorMockProvider,
  createDelayedMockProvider,
} from '../mockProvider.js';

import type { ProviderEvent, ProviderRequest } from '@ollm/core';

describe('MockProvider', () => {
  describe('Event Sequence Emission', () => {
    it('should emit default event sequence when no config provided', async () => {
      const provider = new MockProvider();
      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'text', value: 'Mock response' });
      expect(events[1]).toEqual({ type: 'finish', reason: 'stop' });
    });

    it('should emit custom event sequence', async () => {
      const customEvents: ProviderEvent[] = [
        { type: 'text', value: 'Hello' },
        { type: 'text', value: ' World' },
        { type: 'finish', reason: 'stop' },
      ];

      const provider = new MockProvider({
        eventSequence: customEvents,
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toEqual(customEvents);
    });

    it('should emit tool call events', async () => {
      const toolCall = {
        id: 'call-1',
        name: 'test_tool',
        args: { param: 'value' },
      };

      const provider = new MockProvider({
        eventSequence: [
          { type: 'tool_call', value: toolCall },
          { type: 'finish', reason: 'tool' },
        ],
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'tool_call', value: toolCall });
      expect(events[1]).toEqual({ type: 'finish', reason: 'tool' });
    });

    it('should handle abort signal', async () => {
      const provider = new MockProvider({
        eventSequence: [
          { type: 'text', value: 'Start' },
          { type: 'text', value: 'Middle' },
          { type: 'text', value: 'End' },
          { type: 'finish', reason: 'stop' },
        ],
      });

      const abortController = new AbortController();
      abortController.abort();

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
        abortSignal: abortController.signal,
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ type: 'finish', reason: 'stop' });
    });
  });

  describe('Error Simulation', () => {
    it('should emit error event when simulateError is true', async () => {
      const provider = new MockProvider({
        simulateError: true,
        error: { message: 'Test error', code: 'TEST_ERROR' },
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        error: { message: 'Test error', code: 'TEST_ERROR' },
      });
    });

    it('should emit default error when no error config provided', async () => {
      const provider = new MockProvider({
        simulateError: true,
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        error: { message: 'Mock error', code: 'MOCK_ERROR' },
      });
    });
  });

  describe('Delay Configuration', () => {
    it('should apply delay between events', async () => {
      const delayMs = 50;
      const provider = new MockProvider({
        eventDelay: delayMs,
        eventSequence: [
          { type: 'text', value: 'First' },
          { type: 'text', value: 'Second' },
          { type: 'finish', reason: 'stop' },
        ],
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const startTime = Date.now();
      const events: ProviderEvent[] = [];

      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      const elapsed = Date.now() - startTime;

      expect(events).toHaveLength(3);
      // Should take at least 3 events * 50ms = 150ms
      expect(elapsed).toBeGreaterThanOrEqual(delayMs * 3 - 10); // Allow 10ms tolerance
    });

    it('should not delay when eventDelay is 0', async () => {
      const provider = new MockProvider({
        eventDelay: 0,
        eventSequence: [
          { type: 'text', value: 'Fast' },
          { type: 'finish', reason: 'stop' },
        ],
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const startTime = Date.now();
      const events: ProviderEvent[] = [];

      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      const elapsed = Date.now() - startTime;

      expect(events).toHaveLength(2);
      // Should be very fast (< 50ms)
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe('Token Counting', () => {
    it('should return configured token count', async () => {
      const provider = new MockProvider({
        tokenCount: 42,
      });

      const request: ProviderRequest = {
        model: 'test',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello world' }],
          },
        ],
      };

      const count = await provider.countTokens(request);
      expect(count).toBe(42);
    });

    it('should fallback to character-based estimation', async () => {
      const provider = new MockProvider();

      const request: ProviderRequest = {
        model: 'test',
        systemPrompt: 'System',
        messages: [
          {
            role: 'user',
            parts: [{ type: 'text', text: 'Hello' }],
          },
        ],
      };

      const count = await provider.countTokens(request);
      // "System" (6) + "Hello" (5) = 11 chars / 4 = 2.75 -> ceil = 3
      expect(count).toBe(3);
    });
  });

  describe('Model Management', () => {
    it('should return configured models', async () => {
      const mockModels = [
        { name: 'model-1', sizeBytes: 1000 },
        { name: 'model-2', sizeBytes: 2000 },
      ];

      const provider = new MockProvider({
        models: mockModels,
      });

      const models = await provider.listModels();
      expect(models).toEqual(mockModels);
    });

    it('should return default model when no config', async () => {
      const provider = new MockProvider();
      const models = await provider.listModels();

      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('mock-model');
    });

    it('should call progress callback during pullModel', async () => {
      const provider = new MockProvider({
        eventDelay: 10,
      });

      const progressCalls: any[] = [];
      await provider.pullModel('test-model', (progress) => {
        progressCalls.push(progress);
      });

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[0].status).toBe('downloading');
      expect(progressCalls[progressCalls.length - 1].status).toBe('complete');
    });

    it('should return model info from showModel', async () => {
      const provider = new MockProvider();
      const info = await provider.showModel('test-model');

      expect(info.name).toBe('test-model');
      expect(info.sizeBytes).toBe(1000000);
      expect(info.details).toEqual({ mock: true });
    });
  });

  describe('Helper Functions', () => {
    it('createSimpleMockProvider should create provider with text response', async () => {
      const provider = createSimpleMockProvider('Custom text');
      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'text', value: 'Custom text' });
      expect(events[1]).toEqual({ type: 'finish', reason: 'stop' });
    });

    it('createToolCallMockProvider should create provider with tool calls', async () => {
      const toolCalls = [
        { id: 'call-1', name: 'tool1', args: { a: 1 } },
        { id: 'call-2', name: 'tool2', args: { b: 2 } },
      ];

      const provider = createToolCallMockProvider(toolCalls);
      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(4); // text + 2 tool_calls + finish
      expect(events[0].type).toBe('text');
      expect(events[1]).toEqual({ type: 'tool_call', value: toolCalls[0] });
      expect(events[2]).toEqual({ type: 'tool_call', value: toolCalls[1] });
      expect(events[3]).toEqual({ type: 'finish', reason: 'tool' });
    });

    it('createErrorMockProvider should create provider that emits error', async () => {
      const provider = createErrorMockProvider('Custom error', 'CUSTOM_CODE');
      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const events: ProviderEvent[] = [];
      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        type: 'error',
        error: { message: 'Custom error', code: 'CUSTOM_CODE' },
      });
    });

    it('createDelayedMockProvider should create provider with delay', async () => {
      const provider = createDelayedMockProvider(50, 'Delayed text');
      const request: ProviderRequest = {
        model: 'test',
        messages: [],
      };

      const startTime = Date.now();
      const events: ProviderEvent[] = [];

      for await (const event of provider.chatStream(request)) {
        events.push(event);
      }

      const elapsed = Date.now() - startTime;

      expect(events).toHaveLength(2);
      expect(events[0]).toEqual({ type: 'text', value: 'Delayed text' });
      expect(elapsed).toBeGreaterThanOrEqual(50 * 2 - 10); // 2 events with 50ms delay
    });
  });
});
