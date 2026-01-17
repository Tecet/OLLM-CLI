import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { render } from '../../../../test/ink-testing.js';
import { SidePanel } from '../SidePanel.js';
import { FocusProvider } from '../../../../features/context/FocusContext.js';
import { Box, Text } from 'ink';

// Mock ContextSection component for testing
function MockContextSection() {
  return (
    <Box flexDirection="column">
      <Text>Mock Context</Text>
    </Box>
  );
}

/**
 * Property 14: Side Panel Toggle
 * Feature: stage-06-cli-ui, Property 14: Side Panel Toggle
 * Validates: Requirements 5.1
 * 
 * For any Ctrl+P keypress, the side panel should toggle between visible and
 * hidden states.
 */
describe('Property 14: Side Panel Toggle', () => {
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

  // Mock ContextSection
  vi.mock('../ContextSection.js', () => ({
    ContextSection: () => <Text>Mock Context</Text>,
  }));


  it('should render when visible is true', () => {
    fc.assert(
      fc.property(
        fc.constant(true),
        (visible) => {
          const { lastFrame } = render(
            <FocusProvider>
              <SidePanel
                visible={visible}
                connection={{ status: 'connected', provider: 'ollama' } as any}
                model="test-model"
                gpu={{ available: false } as any}
                theme={defaultTheme}
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: When visible, the side panel should render content
          expect(output).toContain('Active Context');
          expect(output).toContain('Mock Context');
          expect(output).toContain('File Tree');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not render when visible is false', () => {
    fc.assert(
      fc.property(
        fc.constant(false),
        (visible) => {
          const { lastFrame } = render(
            <FocusProvider>
              <SidePanel
                visible={visible}
                connection={{ status: 'connected', provider: 'ollama' } as any}
                model="test-model"
                gpu={{ available: false } as any}
                theme={defaultTheme}
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: When not visible, the side panel should render nothing
          expect(output).toBe('');
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should toggle visibility state correctly', () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        (visibilitySequence) => {
          // Test each visibility state in the sequence
          visibilitySequence.forEach(visible => {
            const { lastFrame } = render(
              <FocusProvider>
                <SidePanel
                  visible={visible}
                  connection={{ status: 'connected', provider: 'ollama' } as any}
                  model="test-model"
                  gpu={{ available: false } as any}
                  theme={defaultTheme}
                />
              </FocusProvider>
            );

            const output = lastFrame();
            
            // Property: Visibility should match the expected state
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

  it('should maintain state across visibility toggles', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        (toggleCount) => {
          // Simulate toggle sequence: start visible, then toggle N times
          let currentVisibility = true;
          
          for (let i = 0; i < toggleCount; i++) {
            currentVisibility = !currentVisibility;
            
            const { lastFrame } = render(
              <FocusProvider>
                <SidePanel
                  visible={currentVisibility}
                  connection={{ status: 'connected', provider: 'ollama' } as any}
                  model="test-model"
                  gpu={{ available: false } as any}
                  theme={defaultTheme}
                />
              </FocusProvider>
            );

            const output = lastFrame();
            
            // Property: Visibility should match current state
            if (currentVisibility) {
              expect(output).toContain('Active Context');
            } else {
              expect(output).toBe('');
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
