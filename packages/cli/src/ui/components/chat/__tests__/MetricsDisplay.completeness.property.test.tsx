/**
 * Property 25: Metrics Display Completeness
 * Feature: stage-06-cli-ui, Property 25: Metrics Display Completeness
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4
 * 
 * For any completed response with metrics, the metrics display should show
 * tokens per second, input tokens, output tokens, and total time.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from 'ink-testing-library';
import { MetricsDisplay } from '../MetricsDisplay.js';
import type { InferenceMetrics } from '../../../../../../core/src/types/metrics.js';

describe('Property 25: Metrics Display Completeness', () => {
  const defaultTheme = {
    text: {
      primary: '#d4d4d4',
      secondary: '#858585',
      accent: '#4ec9b0',
    },
    status: {
      success: '#4ec9b0',
      warning: '#ce9178',
      error: '#f48771',
      info: '#569cd6',
    },
  };

  // Arbitrary for generating valid InferenceMetrics
  const metricsArbitrary = fc.record({
    promptTokens: fc.integer({ min: 1, max: 10000 }),
    completionTokens: fc.integer({ min: 1, max: 10000 }),
    totalDuration: fc.integer({ min: 1_000_000_000, max: 100_000_000_000 }), // 1-100 seconds in nanoseconds
    promptDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }), // 0.1-10 seconds
    evalDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }), // 0.1-10 seconds
  }).map((raw): InferenceMetrics => {
    const totalSeconds = raw.totalDuration / 1_000_000_000;
    const tokensPerSecond = raw.completionTokens / totalSeconds;
    
    return {
      ...raw,
      tokensPerSecond,
      timeToFirstToken: 0, // Will be tested separately
      totalSeconds,
    };
  });

  it('should display all required metrics in full mode', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: All four required metrics must be present
        // 1. Tokens per second (with ⚡ icon)
        expect(output).toMatch(/⚡.*t\/s/);
        
        // 2. Input tokens (with 📥 icon)
        expect(output).toContain('📥');
        expect(output).toContain(`${metrics.promptTokens} tokens`);
        
        // 3. Output tokens (with 📤 icon)
        expect(output).toContain('📤');
        expect(output).toContain(`${metrics.completionTokens} tokens`);
        
        // 4. Total time (with ⏱️ icon)
        expect(output).toContain('⏱️');
        expect(output).toMatch(/\d+\.\d+s/);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should display tokens per second with correct precision', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Tokens per second should be displayed with one decimal place
        const tpsMatch = output.match(/⚡\s+([\d.]+)\s+t\/s/);
        expect(tpsMatch).toBeTruthy();
        
        if (tpsMatch) {
          const displayedTps = parseFloat(tpsMatch[1]);
          const expectedTps = parseFloat(metrics.tokensPerSecond.toFixed(1));
          expect(displayedTps).toBeCloseTo(expectedTps, 1);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should display input and output tokens as integers', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Token counts should be integers (no decimal points)
        expect(output).toContain(`📥 ${metrics.promptTokens} tokens`);
        expect(output).toContain(`📤 ${metrics.completionTokens} tokens`);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should display total time with correct precision', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Total time should be displayed with one decimal place
        const timeMatch = output.match(/⏱️\s+([\d.]+)s/);
        expect(timeMatch).toBeTruthy();
        
        if (timeMatch) {
          const displayedTime = parseFloat(timeMatch[1]);
          const expectedTime = parseFloat(metrics.totalSeconds.toFixed(1));
          expect(displayedTime).toBeCloseTo(expectedTime, 1);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should use pipe separator between metrics', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Metrics should be separated by " │ "
        const pipeCount = (output.match(/│/g) || []).length;
        
        // Should have at least 3 pipes (4 metrics = 3 separators)
        // May have 4 pipes if TTFT is present
        expect(pipeCount).toBeGreaterThanOrEqual(3);
        expect(pipeCount).toBeLessThanOrEqual(4);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain consistent order of metrics', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Metrics should appear in order: TPS, Input, Output, Time
        const tpsIndex = output.indexOf('⚡');
        const inputIndex = output.indexOf('📥');
        const outputIndex = output.indexOf('📤');
        const timeIndex = output.indexOf('⏱️');

        expect(tpsIndex).toBeLessThan(inputIndex);
        expect(inputIndex).toBeLessThan(outputIndex);
        expect(outputIndex).toBeLessThan(timeIndex);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle very fast generation speeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1000, max: 10000 }),
        (completionTokens, totalDurationMs) => {
          const totalSeconds = totalDurationMs / 1000;
          const tokensPerSecond = completionTokens / totalSeconds;

          const metrics: InferenceMetrics = {
            promptTokens: 100,
            completionTokens,
            totalDuration: totalDurationMs * 1_000_000, // Convert to nanoseconds
            promptDuration: 100_000_000,
            evalDuration: totalDurationMs * 1_000_000 - 100_000_000,
            tokensPerSecond,
            timeToFirstToken: 0,
            totalSeconds,
          };

          const { lastFrame } = render(
            <MetricsDisplay
              metrics={metrics}
              compact={false}
              theme={defaultTheme}
              visible={true}
            />
          );

          const output = lastFrame();

          // Property: Should display all metrics even for very fast speeds
          expect(output).toContain('⚡');
          expect(output).toContain('📥');
          expect(output).toContain('📤');
          expect(output).toContain('⏱️');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle very slow generation speeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 10000, max: 100000 }),
        (completionTokens, totalDurationMs) => {
          const totalSeconds = totalDurationMs / 1000;
          const tokensPerSecond = completionTokens / totalSeconds;

          const metrics: InferenceMetrics = {
            promptTokens: 100,
            completionTokens,
            totalDuration: totalDurationMs * 1_000_000, // Convert to nanoseconds
            promptDuration: 100_000_000,
            evalDuration: totalDurationMs * 1_000_000 - 100_000_000,
            tokensPerSecond,
            timeToFirstToken: 0,
            totalSeconds,
          };

          const { lastFrame } = render(
            <MetricsDisplay
              metrics={metrics}
              compact={false}
              theme={defaultTheme}
              visible={true}
            />
          );

          const output = lastFrame();

          // Property: Should display all metrics even for very slow speeds
          expect(output).toContain('⚡');
          expect(output).toContain('📥');
          expect(output).toContain('📤');
          expect(output).toContain('⏱️');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not display when visible is false', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={false}
          />
        );

        const output = lastFrame();

        // Property: When visible=false, nothing should be rendered
        expect(output).toBe('');

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
