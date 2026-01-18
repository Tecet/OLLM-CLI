import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { TabType } from '../../../../features/context/UIContext.js';
import { tabs } from '../TabBar.js';

/**
 * Property 10: Tab Keyboard Shortcuts
 * Feature: stage-06-cli-ui, Property 10: Tab Keyboard Shortcuts
 * Validates: Requirements 4.2
 * 
 * For any keyboard shortcut Ctrl+1 through Ctrl+7, the tab bar should switch
 * to the corresponding tab (Chat, Tools, Files, Search, Docs, GitHub, Settings).
 */
describe('Property 10: Tab Keyboard Shortcuts', () => {
  it('should map keyboard shortcuts to correct tabs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        (shortcutNumber) => {
          // Map shortcut number to expected tab
          const expectedTabs: TabType[] = ['chat', 'tools', 'hooks', 'files', 'search', 'docs', 'github', 'settings'];
          const expectedTab = expectedTabs[shortcutNumber - 1];
          
          // Verify the tab at this index has the correct shortcut
          const tab = tabs[shortcutNumber - 1];
          const expectedShortcut = `Ctrl+${shortcutNumber}`;
          
          // Property: The shortcut should match the expected format
          expect(tab.shortcut).toBe(expectedShortcut);
          
          // Property: The tab ID should match the expected tab
          expect(tab.id).toBe(expectedTab);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have unique shortcuts for all tabs', () => {
    fc.assert(
      fc.property(
        fc.constant(tabs),
        (allTabs) => {
          const shortcuts = allTabs.map(t => t.shortcut);
          const uniqueShortcuts = new Set(shortcuts);
          
          // Property: All shortcuts should be unique
          expect(uniqueShortcuts.size).toBe(shortcuts.length);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain correct tab order for shortcuts', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 7 }), { minLength: 2, maxLength: 8 }),
        (indices) => {
          // Remove duplicates and sort
          const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
          
          if (uniqueIndices.length < 2) {
            return true; // Skip if not enough unique indices
          }
          
          // Property: Tab shortcuts should be in ascending order
          for (let i = 0; i < uniqueIndices.length - 1; i++) {
            const currentTab = tabs[uniqueIndices[i]];
            const nextTab = tabs[uniqueIndices[i + 1]];
            
            const currentNum = parseInt(currentTab.shortcut.replace('Ctrl+', ''));
            const nextNum = parseInt(nextTab.shortcut.replace('Ctrl+', ''));
            
            expect(currentNum).toBeLessThan(nextNum);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
