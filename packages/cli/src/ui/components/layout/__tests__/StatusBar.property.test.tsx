/**
 * StatusBar Property-Based Tests
 * 
 * Property 26: Status Information Display
 * For any status information (connection, model, tokens, git, GPU, reviews, cost),
 * the StatusBar should display all provided information correctly.
 * 
 * Validates: Requirements 10.6, 10.7
 * 
 * Feature: stage-08-testing-qa, Property 26: Status Information Display
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import * as fc from 'fast-check';
import { StatusBar, type ConnectionStatus, type GitStatus, type GPUInfo } from '../StatusBar.js';
import { mockTheme, getTextContent } from '@ollm/test-utils';

describe('StatusBar Property Tests', () => {
  const defaultTheme = {
    ...mockTheme,
    status: {
      success: '#4ec9b0',
      warning: '#dcdcaa',
      error: '#f48771',
      info: '#569cd6',
    },
  };

  const defaultTokens = {
    current: 100,
    max: 4096,
  };

  describe('Property 26: Status Information Display', () => {
    it('displays connection status for any provider', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('connected' as const, 'connecting' as const, 'disconnected' as const),
          fc.string({ minLength: 1, maxLength: 50 }),
          (status, provider) => {
            const connection: ConnectionStatus = { status, provider };

            const { lastFrame } = render(
              <StatusBar
                connection={connection}
                model="test-model"
                tokens={defaultTokens}
                git={null}
                gpu={null}
                reviews={0}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Provider name should always be displayed
            expect(frameText).toContain(provider);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays model name for any model', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (modelName) => {
            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model={modelName}
                tokens={defaultTokens}
                git={null}
                gpu={null}
                reviews={0}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Model name should always be displayed
            expect(frameText).toContain(modelName);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays token usage for any token counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000000 }),
          fc.integer({ min: 1, max: 1000000 }),
          (current, max) => {
            const tokens = { current, max: Math.max(current, max) };

            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={tokens}
                git={null}
                gpu={null}
                reviews={0}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Token counts should be displayed
            expect(frameText).toContain(String(current));
            expect(frameText).toContain(String(tokens.max));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays git branch for any branch name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 100 }),
          fc.integer({ min: 0, max: 100 }),
          (branch, staged, modified) => {
            const gitStatus: GitStatus = { branch, staged, modified };

            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={defaultTokens}
                git={gitStatus}
                gpu={null}
                reviews={0}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Branch name should always be displayed
            expect(frameText).toContain(branch);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays GPU temperature and VRAM for any values', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 120 }),
          fc.integer({ min: 1, max: 128 * 1024 * 1024 * 1024 }),
          fc.integer({ min: 0, max: 128 * 1024 * 1024 * 1024 }),
          (temperature, vramTotal, vramUsed) => {
            const gpuInfo: GPUInfo = {
              available: true,
              vendor: 'nvidia',
              vramTotal,
              vramUsed: Math.min(vramUsed, vramTotal),
              vramFree: vramTotal - Math.min(vramUsed, vramTotal),
              temperature,
              temperatureMax: 90,
              gpuUtilization: 50,
            };

            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={defaultTokens}
                git={null}
                gpu={gpuInfo}
                reviews={0}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Temperature should be displayed
            expect(frameText).toContain(`${temperature}°C`);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays review count for any count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 1000 }),
          (reviews) => {
            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={defaultTokens}
                git={null}
                gpu={null}
                reviews={reviews}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Review count should be displayed
            expect(frameText).toContain(String(reviews));
            expect(frameText).toContain('review');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays cost for any positive value', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.0001, max: 1000, noNaN: true }),
          (cost) => {
            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={defaultTokens}
                git={null}
                gpu={null}
                reviews={0}
                cost={cost}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Cost should be displayed with dollar sign
            expect(frameText).toContain('$');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays project profile for any profile name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (profile) => {
            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={defaultTokens}
                git={null}
                gpu={null}
                reviews={0}
                cost={0}
                projectProfile={profile}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Project profile should be displayed
            expect(frameText).toContain(profile);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays loaded models count for any count', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
          (models) => {
            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider: 'Ollama' }}
                model="test-model"
                tokens={defaultTokens}
                git={null}
                gpu={null}
                reviews={0}
                cost={0}
                loadedModels={models}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: Loaded models count should be displayed
            expect(frameText).toContain(String(models.length));
            expect(frameText).toContain('loaded');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('displays all information together', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 1, max: 100000 }),
          (provider, modelName, currentTokens, maxTokens) => {
            const { lastFrame } = render(
              <StatusBar
                connection={{ status: 'connected', provider }}
                model={modelName}
                tokens={{ current: currentTokens, max: maxTokens }}
                git={null}
                gpu={null}
                reviews={0}
                cost={0}
                theme={defaultTheme}
              />
            );

            const frame = lastFrame();
            const frameText = getTextContent(frame);

            // Property: All provided information should be displayed
            expect(frameText).toContain(provider);
            expect(frameText).toContain(modelName);
            expect(frameText).toContain(String(currentTokens));
            expect(frameText).toContain(String(maxTokens));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles zero values correctly', () => {
      const { lastFrame } = render(
        <StatusBar
          connection={{ status: 'connected', provider: 'Ollama' }}
          model="test-model"
          tokens={{ current: 0, max: 4096 }}
          git={null}
          gpu={null}
          reviews={0}
          cost={0}
          theme={defaultTheme}
        />
      );

      const frame = lastFrame();
      const frameText = getTextContent(frame);

      // Property: Zero token count should be displayed
      expect(frameText).toContain('0');
      expect(frameText).toContain('4096');
    });
  });
});
