/**
 * Property 27: Compact Metrics Format
 * Feature: stage-06-cli-ui, Property 27: Compact Metrics Format
 * Validates: Requirements 15.6
 * 
 * For any metrics display in compact mode, the output should be abbreviated
 * to show only tokens per second, output tokens, and total time.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '../../../../test/ink-testing.js';
import { MetricsDisplay } from '../MetricsDisplay.js';
import type { InferenceMetrics } from '../../../../../../core/src/types/metrics.js';

describe('Property 27: Compact Metrics Format', () => {
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
    totalDuration: fc.integer({ min: 1_000_000_000, max: 100_000_000_000 }), // 1-100 seconds
    promptDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }),
    evalDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }),
    timeToFirstToken: fc.float({ min: Math.fround(0.01), max: Math.fround(10.0) }),
  }).map((raw): InferenceMetrics => {
    const totalSeconds = raw.totalDuration / 1_000_000_000;
    const tokensPerSecond = raw.completionTokens / totalSeconds;
    
    return {
      ...raw,
      tokensPerSecond,
      totalSeconds,
    };
  });

  it('should display only three metrics in compact mode', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Compact mode should show exactly 3 metrics
        // 1. Tokens per second
        expect(output).toMatch(/⚡.*t\/s/);
        
        // 2. Output tokens (completion tokens only, not input)
        expect(output).toContain(`${metrics.completionTokens} tokens`);
        
        // 3. Total time
        expect(output).toMatch(/\d+\.\d+s/);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should not display input tokens in compact mode', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Input tokens (📥) should NOT be displayed in compact mode
        // The key indicator is the absence of the 📥 icon
        expect(output).not.toContain('📥');
        
        // Verify only completion tokens are shown (not prompt tokens)
        // In compact mode, we should see exactly one occurrence of "tokens"
        const tokenMatches = output.match(/\d+\s+tokens/g);
        expect(tokenMatches).toBeTruthy();
        if (tokenMatches) {
          expect(tokenMatches.length).toBe(1);
          // The single token count should be the completion tokens
          expect(tokenMatches[0]).toContain(String(metrics.completionTokens));
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should not display TTFT in compact mode', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: TTFT should NOT be displayed in compact mode
        expect(output).not.toContain('TTFT:');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should use exactly two pipe separators in compact mode', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: 3 metrics = 2 separators
        const pipeCount = (output.match(/│/g) || []).length;
        expect(pipeCount).toBe(2);

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
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: TPS should be displayed with one decimal place
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

  it('should display output tokens as integer', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Output tokens should be integer (no decimal)
        expect(output).toContain(`${metrics.completionTokens} tokens`);
        
        // Verify no decimal point in the token count
        const tokenMatch = output.match(/(\d+)\s+tokens/);
        expect(tokenMatch).toBeTruthy();
        if (tokenMatch) {
          expect(tokenMatch[1]).toBe(String(metrics.completionTokens));
        }

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
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Total time should be displayed with one decimal place
        // Strip ANSI codes for matching
        // eslint-disable-next-line no-control-regex
        const strippedOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
        const timeMatch = strippedOutput.match(/([\d.]+)s$/);
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

  it('should maintain consistent order in compact mode', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: Order should be TPS, tokens, time
        const tpsIndex = output.indexOf('⚡');
        const tokensIndex = output.indexOf('tokens');
        const timeMatch = output.match(/\d+\.\d+s/);
        const timeIndex = timeMatch ? output.indexOf(timeMatch[0]) : -1;

        expect(tpsIndex).toBeLessThan(tokensIndex);
        expect(tokensIndex).toBeLessThan(timeIndex);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should be shorter than full mode output', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame: compactFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );

        const { lastFrame: fullFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const compactOutput = compactFrame();
        const fullOutput = fullFrame();

        // Property: Compact output should be shorter than full output
        expect(compactOutput.length).toBeLessThan(fullOutput.length);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle very fast speeds in compact mode', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 100, max: 1000 }),
        (completionTokens, totalDurationMs) => {
          const totalSeconds = totalDurationMs / 1000;
          const tokensPerSecond = completionTokens / totalSeconds;

          const metrics: InferenceMetrics = {
            promptTokens: 100,
            completionTokens,
            totalDuration: totalDurationMs * 1_000_000,
            promptDuration: 100_000_000,
            evalDuration: totalDurationMs * 1_000_000 - 100_000_000,
            tokensPerSecond,
            timeToFirstToken: 0,
            totalSeconds,
          };

          const { lastFrame } = render(
            <MetricsDisplay
              metrics={metrics}
              compact={true}
              theme={defaultTheme}
              visible={true}
            />
          );

          const output = lastFrame();

          // Property: Should display all 3 metrics even for very fast speeds
          expect(output).toContain('⚡');
          expect(output).toContain('tokens');
          expect(output).toMatch(/\d+\.\d+s/);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle very slow speeds in compact mode', () => {
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
            totalDuration: totalDurationMs * 1_000_000,
            promptDuration: 100_000_000,
            evalDuration: totalDurationMs * 1_000_000 - 100_000_000,
            tokensPerSecond,
            timeToFirstToken: 0,
            totalSeconds,
          };

          const { lastFrame } = render(
            <MetricsDisplay
              metrics={metrics}
              compact={true}
              theme={defaultTheme}
              visible={true}
            />
          );

          const output = lastFrame();

          // Property: Should display all 3 metrics even for very slow speeds
          expect(output).toContain('⚡');
          expect(output).toContain('tokens');
          expect(output).toMatch(/\d+\.\d+s/);

          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain consistent format across re-renders', () => {
    fc.assert(
      fc.property(metricsArbitrary, (metrics) => {
        const { lastFrame, rerender } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );
        
        const firstOutput = lastFrame();

        // Re-render with same metrics
        rerender(
          <MetricsDisplay
            metrics={metrics}
            compact={true}
            theme={defaultTheme}
            visible={true}
          />
        );
        
        const secondOutput = lastFrame();

        // Property: Output should be identical across re-renders
        expect(firstOutput).toBe(secondOutput);

        return true;
      }),
      { numRuns: 20 }
    );
  });
});