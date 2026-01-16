import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '../../../../test/ink-testing.js';
import { ComparisonView } from '../ComparisonView.js';

interface ComparisonResult {
  prompt: string;
  timestamp: Date;
  results: {
    model: string;
    response: string;
    tokenCount: number;
    latencyMs: number;
    tokensPerSecond: number;
    error?: string;
  }[];
}

describe('ComparisonView', () => {
  const defaultTheme = {
    name: 'test-theme',
    bg: {
      primary: '#1e1e1e',
      secondary: '#252526',
      tertiary: '#2d2d30',
    },
    text: {
      primary: '#d4d4d4',
      secondary: '#858585',
      accent: '#4ec9b0',
    },
    role: {
      user: '#569cd6',
      assistant: '#4ec9b0',
      system: '#858585',
      tool: '#dcdcaa',
    },
    status: {
      success: '#4ec9b0',
      warning: '#ce9178',
      error: '#f48771',
      info: '#569cd6',
    },
    border: {
      primary: '#858585',
      secondary: '#555555',
      active: 'green',
    },
    diff: {
      added: '#4ec9b0',
      removed: '#f48771',
    },
  };

  const mockResult: ComparisonResult = {
    prompt: 'What is 2+2?',
    timestamp: new Date('2026-01-14T12:00:00Z'),
    results: [
      {
        model: 'llama3.1:8b',
        response: 'The answer is 4.',
        tokenCount: 50,
        latencyMs: 1500,
        tokensPerSecond: 33.3,
      },
      {
        model: 'phi3:mini',
        response: '2+2 equals 4.',
        tokenCount: 45,
        latencyMs: 800,
        tokensPerSecond: 56.3,
      },
    ],
  };

  describe('Rendering', () => {
    it('should render comparison results with all models', () => {
      const { lastFrame } = render(
        <ComparisonView result={mockResult} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      // Should show header
      expect(output).toContain('Model Comparison Results');

      // Should show prompt
      expect(output).toContain('Prompt:');
      expect(output).toContain('What is 2+2?');

      // Should show both models
      expect(output).toContain('llama3.1:8b');
      expect(output).toContain('phi3:mini');

      // Should show responses
      expect(output).toContain('The answer is 4.');
      expect(output).toContain('2+2 equals 4.');
    });

    it('should display performance metrics for each model', () => {
      const { lastFrame } = render(
        <ComparisonView result={mockResult} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      // Should show latency
      expect(output).toContain('Latency:');
      expect(output).toContain('1.50s'); // 1500ms formatted
      expect(output).toContain('800ms');

      // Should show speed
      expect(output).toContain('Speed:');
      expect(output).toContain('33.3 tok/s');
      expect(output).toContain('56.3 tok/s');

      // Should show token count
      expect(output).toContain('Tokens:');
      expect(output).toContain('50');
      expect(output).toContain('45');
    });

    it('should display timestamp', () => {
      const { lastFrame } = render(
        <ComparisonView result={mockResult} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      expect(output).toContain('Compared at:');
      // Timestamp will be locale-specific, just check it's present
      expect(output).toMatch(/Compared at:.*2026/);
    });

    it('should handle model errors gracefully', () => {
      const resultWithError: ComparisonResult = {
        ...mockResult,
        results: [
          mockResult.results[0],
          {
            model: 'broken-model',
            response: '',
            tokenCount: 0,
            latencyMs: 100,
            tokensPerSecond: 0,
            error: 'Model not found',
          },
        ],
      };

      const { lastFrame } = render(
        <ComparisonView result={resultWithError} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      // Should show error
      expect(output).toContain('Error:');
      expect(output).toContain('Model not found');

      // Should still show successful model
      expect(output).toContain('llama3.1:8b');
      expect(output).toContain('The answer is 4.');
    });

    it('should not show metrics for failed models', () => {
      const resultWithError: ComparisonResult = {
        ...mockResult,
        results: [
          {
            model: 'failed-model',
            response: '',
            tokenCount: 0,
            latencyMs: 50,
            tokensPerSecond: 0,
            error: 'Connection timeout',
          },
        ],
      };

      const { lastFrame } = render(
        <ComparisonView result={resultWithError} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      // Should not show performance metrics for failed model
      const lines = output.split('\n');
      const errorSection = lines.slice(
        lines.findIndex((l) => l.includes('failed-model'))
      );

      // Error section should not contain metrics
      const errorText = errorSection.join('\n');
      expect(errorText).not.toContain('Latency:');
      expect(errorText).not.toContain('Speed:');
      expect(errorText).not.toContain('Tokens:');
    });
  });

  describe('Selection', () => {
    it('should call onSelectPreferred when provided', () => {
      const onSelectPreferred = vi.fn();

      const { lastFrame } = render(
        <ComparisonView
          result={mockResult}
          theme={defaultTheme}
          onSelectPreferred={onSelectPreferred}
        />
      );

      const output = lastFrame() || '';

      // Should show selection instructions
      expect(output).toContain('Press');
      expect(output).toContain('to select');
    });

    it('should not show selection instructions when onSelectPreferred is not provided', () => {
      const { lastFrame } = render(
        <ComparisonView result={mockResult} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      // Should not show selection instructions
      expect(output).not.toContain('to select');
    });

    it('should not show selection for failed models', () => {
      const resultWithError: ComparisonResult = {
        ...mockResult,
        results: [
          {
            model: 'failed-model',
            response: '',
            tokenCount: 0,
            latencyMs: 50,
            tokensPerSecond: 0,
            error: 'Connection timeout',
          },
        ],
      };

      const onSelectPreferred = vi.fn();

      const { lastFrame } = render(
        <ComparisonView
          result={resultWithError}
          theme={defaultTheme}
          onSelectPreferred={onSelectPreferred}
        />
      );

      const output = lastFrame() || '';

      // Should not show selection for failed model
      const lines = output.split('\n');
      const errorSection = lines.slice(
        lines.findIndex((l) => l.includes('failed-model'))
      );
      const errorText = errorSection.join('\n');
      expect(errorText).not.toContain('to select');
    });
  });

  describe('Formatting', () => {
    it('should format latency under 1 second as milliseconds', () => {
      const result: ComparisonResult = {
        ...mockResult,
        results: [
          {
            model: 'fast-model',
            response: 'Quick response',
            tokenCount: 10,
            latencyMs: 250,
            tokensPerSecond: 40,
          },
        ],
      };

      const { lastFrame } = render(
        <ComparisonView result={result} theme={defaultTheme} />
      );

      const output = lastFrame() || '';
      expect(output).toContain('250ms');
    });

    it('should format latency over 1 second as seconds', () => {
      const result: ComparisonResult = {
        ...mockResult,
        results: [
          {
            model: 'slow-model',
            response: 'Slow response',
            tokenCount: 100,
            latencyMs: 2500,
            tokensPerSecond: 40,
          },
        ],
      };

      const { lastFrame } = render(
        <ComparisonView result={result} theme={defaultTheme} />
      );

      const output = lastFrame() || '';
      expect(output).toContain('2.50s');
    });

    it('should format tokens per second with one decimal place', () => {
      const result: ComparisonResult = {
        ...mockResult,
        results: [
          {
            model: 'test-model',
            response: 'Test',
            tokenCount: 100,
            latencyMs: 1000,
            tokensPerSecond: 123.456,
          },
        ],
      };

      const { lastFrame } = render(
        <ComparisonView result={result} theme={defaultTheme} />
      );

      const output = lastFrame() || '';
      expect(output).toContain('123.5 tok/s');
    });
  });

  describe('Layout', () => {
    it('should display models side-by-side', () => {
      const { lastFrame } = render(
        <ComparisonView result={mockResult} theme={defaultTheme} />
      );

      const output = lastFrame() || '';
      const lines = output.split('\n');

      // Find lines containing model names
      const modelLines = lines.filter(
        (line) => line.includes('llama3.1:8b') || line.includes('phi3:mini')
      );

      // Both models should appear (in headers)
      expect(modelLines.length).toBeGreaterThan(0);
    });

    it('should handle single model comparison', () => {
      const singleResult: ComparisonResult = {
        ...mockResult,
        results: [mockResult.results[0]],
      };

      const { lastFrame } = render(
        <ComparisonView result={singleResult} theme={defaultTheme} />
      );

      const output = lastFrame() || '';

      // Should render without errors
      expect(output).toContain('llama3.1:8b');
      expect(output).toContain('The answer is 4.');
    });

    it('should handle three or more models', () => {
      const multiResult: ComparisonResult = {
        ...mockResult,
        results: [
          ...mockResult.results,
          {
            model: 'mistral:7b',
            response: 'Four is the answer.',
            tokenCount: 40,
            latencyMs: 1200,
            tokensPerSecond: 33.3,
          },
        ],
      };

      const { lastFrame } = render(
        <ComparisonView result={multiResult} theme={defaultTheme} />
      );

      const output = lastFrame();

      // Should show all three models
      expect(output).toContain('llama3.1:8b');
      expect(output).toContain('phi3:mini');
      expect(output).toContain('mistral:7b');
    });
  });
});
