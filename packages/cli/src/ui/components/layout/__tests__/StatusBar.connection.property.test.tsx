import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render, stripAnsi } from '../../../../test/ink-testing.js';
import { StatusBar, ConnectionStatus } from '../StatusBar.js';

/**
 * Property 16: Connection Status Indicators
 * Feature: stage-06-cli-ui, Property 16: Connection Status Indicators
 * Validates: Requirements 6.1
 * 
 * For any provider connection state (connected, connecting, disconnected),
 * the status bar should display the corresponding color indicator (🟢, 🟡, 🔴).
 */
describe('Property 16: Connection Status Indicators', () => {
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

  const defaultProps = {
    model: 'llama3.2:3b',
    tokens: { current: 100, max: 4096 },
    git: null,
    gpu: null,
    reviews: 0,
    cost: 0,
    theme: defaultTheme,
  };

  it('should display correct indicator for connected status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (provider) => {
          const connection: ConnectionStatus = {
            status: 'connected',
            provider,
          };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} connection={connection} />
          );

          const output = lastFrame();
          
          // Property: Connected status should show green indicator
          expect(output).toContain('🟢');
          expect(output).toContain(provider);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display correct indicator for connecting status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (provider) => {
          const connection: ConnectionStatus = {
            status: 'connecting',
            provider,
          };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} connection={connection} />
          );

          const output = lastFrame();
          
          // Property: Connecting status should show yellow indicator
          expect(output).toContain('🟡');
          expect(output).toContain(provider);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display correct indicator for disconnected status', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        (provider) => {
          const connection: ConnectionStatus = {
            status: 'disconnected',
            provider,
          };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} connection={connection} />
          );

          const output = lastFrame();
          
          // Property: Disconnected status should show red indicator
          expect(output).toContain('🔴');
          expect(output).toContain(provider);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should map all connection states to unique indicators', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<ConnectionStatus['status']>('connected', 'connecting', 'disconnected'),
        (status) => {
          const connection: ConnectionStatus = {
            status,
            provider: 'ollama',
          };

          const { lastFrame } = render(
            <StatusBar {...defaultProps} connection={connection} />
          );

          const output = lastFrame();
          
          // Property: Each status should have a unique indicator
          const indicators = {
            connected: '🟢',
            connecting: '🟡',
            disconnected: '🔴',
          };
          
          expect(output).toContain(indicators[status]);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain indicator consistency across re-renders', () => {
    fc.assert(
      fc.property(
        fc.record({
          status: fc.constantFrom<ConnectionStatus['status']>('connected', 'connecting', 'disconnected'),
          provider: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        ({ status, provider }) => {
          const connection: ConnectionStatus = { status, provider };

          // First render
          const { lastFrame: firstFrame, rerender } = render(
            <StatusBar {...defaultProps} connection={connection} />
          );

          const firstOutput = firstFrame();
          
          const indicators = {
            connected: '🟢',
            connecting: '🟡',
            disconnected: '🔴',
          };
          
          expect(firstOutput).toContain(indicators[status]);

          // Re-render with same connection
          rerender(<StatusBar {...defaultProps} connection={connection} />);

          const secondOutput = firstFrame();
          
          // Property: Indicator should remain consistent
          expect(secondOutput).toContain(indicators[status]);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
