/**
 * Property 26: TTFT Conditional Display
 * Feature: stage-06-cli-ui, Property 26: TTFT Conditional Display
 * Validates: Requirements 15.5
 * 
 * For any response with time-to-first-token data available, the metrics
 * display should include the TTFT value.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '../../../../test/ink-testing.js';
import { MetricsDisplay } from '../MetricsDisplay.js';
import type { InferenceMetrics } from '../../../../../../core/src/types/metrics.js';

describe('Property 26: TTFT Conditional Display', () => {
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

  // Arbitrary for generating metrics with TTFT
  const metricsWithTTFTArbitrary = fc.record({
    promptTokens: fc.integer({ min: 1, max: 10000 }),
    completionTokens: fc.integer({ min: 1, max: 10000 }),
    totalDuration: fc.integer({ min: 1_000_000_000, max: 100_000_000_000 }), // 1-100 seconds
    promptDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }),
    evalDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }),
    timeToFirstToken: fc.float({ min: Math.fround(0.01), max: Math.fround(10.0) }), // 0.01-10 seconds
  }).map((raw): InferenceMetrics => {
    const totalSeconds = raw.totalDuration / 1_000_000_000;
    const tokensPerSecond = raw.completionTokens / totalSeconds;
    
    return {
      ...raw,
      tokensPerSecond,
      totalSeconds,
    };
  }).filter((metrics) => !isNaN(metrics.timeToFirstToken)); // Filter out NaN values

  // Arbitrary for generating metrics without TTFT
  const metricsWithoutTTFTArbitrary = fc.record({
    promptTokens: fc.integer({ min: 1, max: 10000 }),
    completionTokens: fc.integer({ min: 1, max: 10000 }),
    totalDuration: fc.integer({ min: 1_000_000_000, max: 100_000_000_000 }),
    promptDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }),
    evalDuration: fc.integer({ min: 100_000_000, max: 10_000_000_000 }),
  }).map((raw): InferenceMetrics => {
    const totalSeconds = raw.totalDuration / 1_000_000_000;
    const tokensPerSecond = raw.completionTokens / totalSeconds;
    
    return {
      ...raw,
      tokensPerSecond,
      timeToFirstToken: 0, // No TTFT
      totalSeconds,
    };
  });

  it('should display TTFT when available and greater than zero', () => {
    fc.assert(
      fc.property(metricsWithTTFTArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: TTFT should be displayed when timeToFirstToken > 0
        expect(output).toContain('TTFT:');
        
        // Verify the TTFT value is present with correct format
        const ttftMatch = output.match(/TTFT:\s+([\d.]+)s/);
        expect(ttftMatch).toBeTruthy();
        
        if (ttftMatch) {
          const displayedTTFT = parseFloat(ttftMatch[1]);
          const expectedTTFT = parseFloat(metrics.timeToFirstToken.toFixed(1));
          expect(displayedTTFT).toBeCloseTo(expectedTTFT, 1);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should not display TTFT when zero', () => {
    fc.assert(
      fc.property(metricsWithoutTTFTArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: TTFT should NOT be displayed when timeToFirstToken is 0
        expect(output).not.toContain('TTFT:');

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should display TTFT as the last metric when present', () => {
    fc.assert(
      fc.property(metricsWithTTFTArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: TTFT should appear after all other metrics
        const tpsIndex = output.indexOf('⚡');
        const inputIndex = output.indexOf('📥');
        const outputIndex = output.indexOf('📤');
        const timeIndex = output.indexOf('⏱️');
        const ttftIndex = output.indexOf('TTFT:');

        expect(ttftIndex).toBeGreaterThan(tpsIndex);
        expect(ttftIndex).toBeGreaterThan(inputIndex);
        expect(ttftIndex).toBeGreaterThan(outputIndex);
        expect(ttftIndex).toBeGreaterThan(timeIndex);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should display TTFT with one decimal place precision', () => {
    fc.assert(
      fc.property(metricsWithTTFTArbitrary, (metrics) => {
        const { lastFrame } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const output = lastFrame();

        // Property: TTFT should be formatted with one decimal place
        const ttftMatch = output.match(/TTFT:\s+([\d.]+)s/);
        expect(ttftMatch).toBeTruthy();
        
        if (ttftMatch) {
          const ttftStr = ttftMatch[1];
          const decimalIndex = ttftStr.indexOf('.');
          
          if (decimalIndex !== -1) {
            const decimalPlaces = ttftStr.length - decimalIndex - 1;
            expect(decimalPlaces).toBe(1);
          }
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('should handle very small TTFT values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.1) }).filter((v) => !isNaN(v)),
        (ttft) => {
          const metrics: InferenceMetrics = {
            promptTokens: 100,
            completionTokens: 50,
            totalDuration: 5_000_000_000, // 5 seconds
            promptDuration: 100_000_000,
            evalDuration: 4_900_000_000,
            tokensPerSecond: 10,
            timeToFirstToken: ttft,
            totalSeconds: 5,
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

          // Property: Even very small TTFT values should be displayed
          expect(output).toContain('TTFT:');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle large TTFT values', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(5.0), max: Math.fround(30.0) }).filter((v) => !isNaN(v)),
        (ttft) => {
          const metrics: InferenceMetrics = {
            promptTokens: 1000,
            completionTokens: 500,
            totalDuration: 50_000_000_000, // 50 seconds
            promptDuration: 1_000_000_000,
            evalDuration: 49_000_000_000,
            tokensPerSecond: 10,
            timeToFirstToken: ttft,
            totalSeconds: 50,
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

          // Property: Large TTFT values should be displayed correctly
          expect(output).toContain('TTFT:');
          
          const ttftMatch = output.match(/TTFT:\s+([\d.]+)s/);
          expect(ttftMatch).toBeTruthy();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not display TTFT in compact mode regardless of availability', () => {
    fc.assert(
      fc.property(metricsWithTTFTArbitrary, (metrics) => {
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

  it('should add extra pipe separator when TTFT is present', () => {
    fc.assert(
      fc.property(
        metricsWithTTFTArbitrary,
        metricsWithoutTTFTArbitrary,
        (metricsWithTTFT, metricsWithoutTTFT) => {
          const { lastFrame: withTTFT } = render(
            <MetricsDisplay
              metrics={metricsWithTTFT}
              compact={false}
              theme={defaultTheme}
              visible={true}
            />
          );

          const { lastFrame: withoutTTFT } = render(
            <MetricsDisplay
              metrics={metricsWithoutTTFT}
              compact={false}
              theme={defaultTheme}
              visible={true}
            />
          );

          const outputWithTTFT = withTTFT();
          const outputWithoutTTFT = withoutTTFT();

          // Property: Output with TTFT should have one more pipe separator
          const pipesWithTTFT = (outputWithTTFT.match(/│/g) || []).length;
          const pipesWithoutTTFT = (outputWithoutTTFT.match(/│/g) || []).length;

          expect(pipesWithTTFT).toBe(pipesWithoutTTFT + 1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain consistent format across re-renders', () => {
    fc.assert(
      fc.property(metricsWithTTFTArbitrary, (metrics) => {
        const { lastFrame, rerender } = render(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const firstOutput = lastFrame();
        expect(firstOutput).toContain('TTFT:');

        // Re-render with same metrics
        rerender(
          <MetricsDisplay
            metrics={metrics}
            compact={false}
            theme={defaultTheme}
            visible={true}
          />
        );

        const secondOutput = lastFrame();

        // Property: TTFT display should be consistent across re-renders
        expect(secondOutput).toContain('TTFT:');
        expect(firstOutput).toBe(secondOutput);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
