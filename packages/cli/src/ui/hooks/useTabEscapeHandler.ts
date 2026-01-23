/**
 * Tab Escape Handler Hook
 * 
 * Provides consistent ESC key handling for tab components.
 * This hook allows ESC to bubble to the global handler (FocusContext.exitOneLevel)
 * for hierarchical navigation.
 * 
 * Architecture:
 * - Integrates with FocusContext for hierarchical navigation
 * - Only active when the component has focus
 * - Allows ESC to bubble naturally for consistent behavior
 * 
 * Usage Pattern:
 * - Use this hook in tab components (ToolsPanel, DocsPanel, SettingsPanel, etc.)
 * - The hook will automatically handle ESC navigation
 * - No need to implement custom exit logic
 * 
 * @example
 * ```typescript
 * function MyTabComponent({ hasFocus }: { hasFocus: boolean }) {
 *   useTabEscapeHandler(hasFocus);
 *   
 *   // Rest of component logic
 *   return <Box>...</Box>;
 * }
 * ```
 */

import { useInput } from 'ink';

import { useFocusManager } from '../../features/context/FocusContext.js';

/**
 * Hook that handles ESC key for tab components
 * 
 * This hook provides consistent ESC behavior across all tab components.
 * When ESC is pressed, it calls exitOneLevel() which implements the
 * hierarchical navigation pattern:
 * 
 * - Level 3 (Modals) → Level 2 (Tab Content)
 * - Level 2 (Tab Content) → Level 1 (Nav Bar)
 * - Level 1 (Nav Bar) → Chat Tab or User Input
 * 
 * @param hasFocus - Whether the component currently has focus
 */
export function useTabEscapeHandler(hasFocus: boolean) {
  const focusManager = useFocusManager();
  
  useInput((input, key) => {
    // Handle ESC key for hierarchical navigation
    if (key.escape) {
      focusManager.exitOneLevel();
    }
    
    // Handle '0' as alternative exit key (legacy pattern)
    if (input === '0') {
      focusManager.exitOneLevel();
    }
  }, { isActive: hasFocus });
}
