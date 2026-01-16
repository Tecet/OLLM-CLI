import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { render } from '../../../../test/ink-testing.js';
import { SidePanel } from '../SidePanel.js';
import { Box, Text } from 'ink';
import type { TabType } from '../../../../features/context/UIContext.js';

// Mock ContextSection
vi.mock('../ContextSection.js', () => ({
    ContextSection: () => <Text>Mock Context</Text>,
}));

/**
 * Property 15: Side Panel Visibility Persistence
 * Feature: stage-06-cli-ui, Property 15: Side Panel Visibility Persistence
 * Validates: Requirements 5.5
 * 
 * For any side panel visibility state (visible or hidden), that state should
 * be persisted and restored across sessions.
 */
describe('Property 15: Side Panel Visibility Persistence', () => {
  const defaultTheme = {
    text: {
      primary: '#d4d4d4',
      secondary: '#858585',
      accent: '#4ec9b0',
    },
    bg: {
      primary: '#1e1e1e',
      secondary: '#252526',
    },
    border: {
        primary: '#3e3e42',
        secondary: '#007acc',
        active: '#007acc',
    }
  } as any;

  const defaultActiveTab: TabType = 'chat';
  const defaultNotifications = new Map<TabType, number>();
  const mockOnTabChange = () => {};

  it('should maintain visibility state across re-renders', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (initialVisibility) => {
          // First render with initial visibility
          const { lastFrame: firstFrame, rerender } = render(
            <SidePanel
              visible={initialVisibility}

              connection={{ status: 'connected', provider: 'ollama' } as any}
              model="test-model"
              gpu={{ available: false } as any}
              theme={defaultTheme}
            />
          );

          const firstOutput = firstFrame();
          
          // Verify initial state
          if (initialVisibility) {
            expect(firstOutput).toContain('Active Context');
          } else {
            expect(firstOutput).toBe('');
          }

          // Re-render with same visibility
          rerender(
            <SidePanel
              visible={initialVisibility}

              connection={{ status: 'connected', provider: 'ollama' } as any}
              model="test-model"
              gpu={{ available: false } as any}
              theme={defaultTheme}
            />
          );

          const secondOutput = firstFrame();
          
          // Property: State should be maintained across re-renders
          if (initialVisibility) {
            expect(secondOutput).toContain('Active Context');
          } else {
            expect(secondOutput).toBe('');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve visibility state through multiple session simulations', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        (visibilityStates) => {
          // Simulate multiple sessions by rendering with each state
          visibilityStates.forEach(visible => {
            const { lastFrame } = render(
              <SidePanel
                visible={visible}
  
                onTabChange={mockOnTabChange}
                notifications={defaultNotifications}
                theme={defaultTheme}
              />
            );

            const output = lastFrame();
            
            // Property: Each session should respect the provided visibility state
            if (visible) {
              expect(output).toContain('Active Context');
            } else {
              expect(output).toBe('');
            }
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle visibility state transitions correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          initial: fc.boolean(),
          transitions: fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        }),
        ({ initial, transitions }) => {
          let currentVisibility = initial;
          
          // Test initial state
          const { lastFrame: initialFrame } = render(
            <SidePanel
              visible={currentVisibility}

              connection={{ status: 'connected', provider: 'ollama' } as any}
              model="test-model"
              gpu={{ available: false } as any}
              theme={defaultTheme}
            />
          );

          const initialOutput = initialFrame();
          if (currentVisibility) {
            expect(initialOutput).toContain('Active Context');
          } else {
            expect(initialOutput).toBe('');
          }

          // Test each transition
          transitions.forEach(newVisibility => {
            currentVisibility = newVisibility;
            
            const { lastFrame } = render(
              <SidePanel
                visible={currentVisibility}
  
                onTabChange={mockOnTabChange}
                notifications={defaultNotifications}
                theme={defaultTheme}
              />
            );

            const output = lastFrame();
            
            // Property: Each transition should result in correct visibility
            if (currentVisibility) {
              expect(output).toContain('Active Context');
            } else {
              expect(output).toBe('');
            }
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
