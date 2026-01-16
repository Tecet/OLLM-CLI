/**
 * ChatHistory Component Tests
 * 
 * Tests for the ChatHistory component rendering and display.
 * Validates Requirements 10.1, 10.2, 10.3
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { ChatHistory } from '../ChatHistory.js';
import { Message } from '../../../../features/context/ChatContext.js';
import { mockTheme } from '../../__tests__/testUtils.js';

describe('ChatHistory Component', () => {
  const defaultTheme = mockTheme;

  describe('User Message Display', () => {
    it('renders user messages correctly', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello, how are you?',
          timestamp: new Date('2026-01-15T10:00:00Z'),
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain('Hello, how are you?');
    });

    it('renders multiple user messages', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'First message',
          timestamp: new Date('2026-01-15T10:00:00Z'),
        },
        {
          id: '2',
          role: 'user',
          content: 'Second message',
          timestamp: new Date('2026-01-15T10:01:00Z'),
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('First message');
      expect(frame).toContain('Second message');
    });
  });

  describe('Assistant Message Display', () => {
    it('renders assistant messages correctly', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content: 'I am doing well, thank you!',
          timestamp: new Date('2026-01-15T10:00:00Z'),
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain('I am doing well, thank you!');
    });

    it('renders assistant messages with metrics', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content: 'Response with metrics',
          timestamp: new Date('2026-01-15T10:00:00Z'),
          metrics: {
            promptTokens: 10,
            completionTokens: 20,
            totalDuration: 1000000000,
            promptDuration: 500000000,
            evalDuration: 500000000,
            tokensPerSecond: 20,
            timeToFirstToken: 0.5,
            totalSeconds: 1.0,
          },
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          metricsConfig={{ enabled: true, compactMode: false }}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('Response with metrics');
    });
  });

  describe('Tool Call Display', () => {
    it('renders tool calls correctly', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content: '',
          timestamp: new Date('2026-01-15T10:00:00Z'),
          toolCalls: [
            {
              id: 'call_123',
              name: 'get_weather',
              arguments: { location: 'Seattle' },
              status: 'success',
              result: 'Sunny, 72°F',
            },
          ],
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain('get_weather');
    });

    it('renders multiple tool calls', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'assistant',
          content: '',
          timestamp: new Date('2026-01-15T10:00:00Z'),
          toolCalls: [
            {
              id: 'call_123',
              name: 'get_weather',
              arguments: { location: 'Seattle' },
              status: 'success',
            },
            {
              id: 'call_456',
              name: 'get_time',
              arguments: { timezone: 'PST' },
              status: 'success',
            },
          ],
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('get_weather');
      expect(frame).toContain('get_time');
    });
  });

  describe('Streaming Indicators', () => {
    it('renders without error when streaming', () => {
      const messages: Message[] = [];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={true}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Streaming indicator is shown in StaticInputArea, not ChatHistory
    });

    it('renders without error when waiting for response', () => {
      const messages: Message[] = [];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={true}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      // Waiting indicator (Llama animation) is shown in StaticInputArea, not ChatHistory
    });

    it('renders messages when not streaming or waiting', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
      expect(frame).toContain('Hello');
    });
  });

  describe('Empty State', () => {
    it('renders empty chat history', () => {
      const messages: Message[] = [];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toBeDefined();
    });
  });

  describe('Mixed Message Types', () => {
    it('renders conversation with mixed message types', () => {
      const messages: Message[] = [
        {
          id: '1',
          role: 'user',
          content: 'What is the weather?',
          timestamp: new Date('2026-01-15T10:00:00Z'),
        },
        {
          id: '2',
          role: 'assistant',
          content: '',
          timestamp: new Date('2026-01-15T10:00:01Z'),
          toolCalls: [
            {
              id: 'call_123',
              name: 'get_weather',
              arguments: { location: 'Seattle' },
              status: 'success',
              result: 'Sunny, 72°F',
            },
          ],
        },
        {
          id: '3',
          role: 'assistant',
          content: 'The weather in Seattle is sunny and 72°F.',
          timestamp: new Date('2026-01-15T10:00:02Z'),
        },
      ];

      const { lastFrame } = render(
        <ChatHistory
          messages={messages}
          streaming={false}
          waitingForResponse={false}
          theme={defaultTheme}
          width={80}
        />
      );

      const frame = lastFrame();
      expect(frame).toContain('What is the weather?');
      expect(frame).toContain('get_weather');
      expect(frame).toContain('The weather in Seattle is sunny and 72°F.');
    });
  });
});
