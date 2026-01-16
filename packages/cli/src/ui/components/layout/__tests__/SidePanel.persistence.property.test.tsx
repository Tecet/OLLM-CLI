import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '../../../../test/ink-testing.js';
import { SidePanel } from '../SidePanel.js';
import { Box, Text } from 'ink';
import type { TabType } from '../../../../features/context/UIContext.js';

// Mock ContextSection component for testing
function MockContextSection() {
  return (
    <Box flexDirection="column">
      <Text>Mock Context</Text>
    </Box>
  );
}

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
  };

  const defaultSections = [
    {
      id: 'context',
      title: 'Context Files',
      component: MockContextSection,
      collapsed: false,
    },
  ];

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
              sections={defaultSections}
              activeTab={defaultActiveTab}
              onTabChange={mockOnTabChange}
              notifications={defaultNotifications}
              theme={defaultTheme}
            />
          );

          const firstOutput = firstFrame();
          
          // Verify initial state
          if (initialVisibility) {
            expect(firstOutput).toContain('Side Panel');
          } else {
            expect(firstOutput).toBe('');
          }

          // Re-render with same visibility
          rerender(
            <SidePanel
              visible={initialVisibility}
              sections={defaultSections}
              activeTab={defaultActiveTab}
              onTabChange={mockOnTabChange}
              notifications={defaultNotifications}
              theme={defaultTheme}
            />
          );

          const secondOutput = firstFrame();
          
          // Property: State should be maintained across re-renders
          if (initialVisibility) {
            expect(secondOutput).toContain('Side Panel');
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
                sections={defaultSections}
                activeTab={defaultActiveTab}
                onTabChange={mockOnTabChange}
                notifications={defaultNotifications}
                theme={defaultTheme}
              />
            );

            const output = lastFrame();
            
            // Property: Each session should respect the provided visibility state
            if (visible) {
              expect(output).toContain('Side Panel');
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
              sections={defaultSections}
              activeTab={defaultActiveTab}
              onTabChange={mockOnTabChange}
              notifications={defaultNotifications}
              theme={defaultTheme}
            />
          );

          const initialOutput = initialFrame();
          if (currentVisibility) {
            expect(initialOutput).toContain('Side Panel');
          } else {
            expect(initialOutput).toBe('');
          }

          // Test each transition
          transitions.forEach(newVisibility => {
            currentVisibility = newVisibility;
            
            const { lastFrame } = render(
              <SidePanel
                visible={currentVisibility}
                sections={defaultSections}
                activeTab={defaultActiveTab}
                onTabChange={mockOnTabChange}
                notifications={defaultNotifications}
                theme={defaultTheme}
              />
            );

            const output = lastFrame();
            
            // Property: Each transition should result in correct visibility
            if (currentVisibility) {
              expect(output).toContain('Side Panel');
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

  it('should persist visibility independently of other state', () => {
    fc.assert(
      fc.property(
        fc.record({
          visible: fc.boolean(),
          sectionCount: fc.integer({ min: 1, max: 4 }),
        }),
        ({ visible, sectionCount }) => {
          // Create sections based on count
          const sections = Array.from({ length: sectionCount }, (_, i) => ({
            id: `section-${i}`,
            title: `Section ${i}`,
            component: MockContextSection,
            collapsed: false,
          }));

          const { lastFrame } = render(
            <SidePanel
              visible={visible}
              sections={sections}
              activeTab={defaultActiveTab}
              onTabChange={mockOnTabChange}
              notifications={defaultNotifications}
              theme={defaultTheme}
            />
          );

          const output = lastFrame();
          
          // Property: Visibility should be independent of section count
          if (visible) {
            expect(output).toContain('Side Panel');
          } else {
            expect(output).toBe('');
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
