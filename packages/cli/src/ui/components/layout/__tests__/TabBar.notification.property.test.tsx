import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import React from 'react';
import { render } from '../../../../test/ink-testing.js';
import { TabBar } from '../TabBar.js';
import { FocusProvider } from '../../../../features/context/FocusContext.js';
import { TabType } from '../../../../features/context/UIContext.js';

/**
 * Property 11: Notification Badge Display
 * Feature: stage-06-cli-ui, Property 11: Notification Badge Display
 * Validates: Requirements 4.3
 * 
 * For any tab with a notification count greater than zero, the tab bar should
 * display a badge with that count.
 */
describe('Property 11: Notification Badge Display', () => {
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

  it('should display badge for tabs with notification count > 0', () => {
    fc.assert(
      fc.property(
        fc.record({
          tab: fc.constantFrom<TabType>('chat', 'tools', 'hooks', 'files', 'search', 'docs', 'settings'),
          count: fc.integer({ min: 1, max: 999 }),
        }),
        ({ tab, count }) => {
          const notifications = new Map<TabType, number>();
          notifications.set(tab, count);

          const { lastFrame } = render(
            <FocusProvider>
              <TabBar
                activeTab="chat"
                onTabChange={() => {}}
                notifications={notifications}
                theme={defaultTheme}
                noBorder
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: Output should contain the notification count
          expect(output).toContain(`(${count})`);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not display badge for tabs with notification count = 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<TabType>('chat', 'tools', 'hooks', 'files', 'search', 'docs', 'settings'),
        (tab) => {
          const notifications = new Map<TabType, number>();
          notifications.set(tab, 0);

          const { lastFrame } = render(
            <FocusProvider>
              <TabBar
                activeTab="chat"
                onTabChange={() => {}}
                notifications={notifications}
                theme={defaultTheme}
                noBorder
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: Output should not contain notification parentheses for this tab
          // We check that there are no (0) badges
          const zeroCountPattern = /\(0\)/;
          expect(output).not.toMatch(zeroCountPattern);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display multiple notification badges correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            tab: fc.constantFrom<TabType>('chat', 'tools', 'hooks', 'files', 'search', 'docs', 'settings'),
            count: fc.integer({ min: 1, max: 99 }),
          }),
          { minLength: 1, maxLength: 7 }
        ),
        (notificationData) => {
          // Create unique notifications (last one wins for duplicates)
          const notifications = new Map<TabType, number>();
          notificationData.forEach(({ tab, count }) => {
            notifications.set(tab, count);
          });

          const { lastFrame } = render(
            <FocusProvider>
              <TabBar
                activeTab="chat"
                onTabChange={() => {}}
                notifications={notifications}
                theme={defaultTheme}
                noBorder
              />
            </FocusProvider>
          );

          const output = lastFrame();
          
          // Property: Each notification count should appear in the output
          notifications.forEach((count, tab) => {
            expect(output).toContain(`(${count})`);
          });
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
