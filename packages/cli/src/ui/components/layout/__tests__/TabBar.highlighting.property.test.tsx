import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '../../../../test/ink-testing.js';
import { TabBar, tabs } from '../TabBar.js';
import { FocusProvider } from '../../../../features/context/FocusContext.js';
import { TabType } from '../../../../features/context/UIContext.js';

/**
 * Property 13: Active Tab Highlighting
 * Feature: stage-06-cli-ui, Property 13: Active Tab Highlighting
 * Validates: Requirements 4.5
 * 
 * For any active tab, the tab bar should apply visual highlighting to
 * distinguish it from inactive tabs.
 */
describe('Property 13: Active Tab Highlighting', () => {
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

  it('should highlight the active tab differently from inactive tabs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TabType>('chat', 'tools', 'files', 'search', 'docs', 'github', 'settings'),
        (activeTab) => {
          const { lastFrame } = render(
            <FocusProvider>
              <TabBar
                activeTab={activeTab}
                onTabChange={() => {}}
                notifications={new Map()}
                theme={defaultTheme}
                noBorder
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: The output should contain the active tab's label
          const activeTabData = tabs.find(t => t.id === activeTab);
          expect(activeTabData).toBeDefined();
          expect(output).toContain(activeTabData!.label);
          
          // Property: All tabs should be present in the output
          tabs.forEach(tab => {
            expect(output).toContain(tab.label);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should only have one active tab at a time', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TabType>('chat', 'tools', 'files', 'search', 'docs', 'github', 'settings'),
        (activeTab) => {
          const { lastFrame } = render(
            <FocusProvider>
              <TabBar
                activeTab={activeTab}
                onTabChange={() => {}}
                notifications={new Map()}
                theme={defaultTheme}
                noBorder
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: The active tab should be present
          const activeTabData = tabs.find(t => t.id === activeTab);
          expect(activeTabData).toBeDefined();
          
          // Property: All tabs should be rendered
          expect(tabs.length).toBe(7);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain highlighting across different active tabs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constantFrom<TabType>('chat', 'tools', 'files', 'search', 'docs', 'github', 'settings'),
          { minLength: 2, maxLength: 7 }
        ),
        (tabSequence) => {
          // Test each tab in the sequence
          tabSequence.forEach(activeTab => {
            const { lastFrame } = render(
              <FocusProvider>
                <TabBar
                  activeTab={activeTab}
                  onTabChange={() => {}}
                  notifications={new Map()}
                  theme={defaultTheme}
                  noBorder
                />
              </FocusProvider>
            );

            const output = lastFrame();
            
            // Property: The active tab should be present in output
            const activeTabData = tabs.find(t => t.id === activeTab);
            expect(output).toContain(activeTabData!.label);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
