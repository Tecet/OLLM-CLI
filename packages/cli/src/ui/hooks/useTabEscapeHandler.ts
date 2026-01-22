/**
 * useTabEscapeHandler - Shared ESC key handler for tab components
 * 
 * Provides consistent ESC key handling for all tab components. When ESC is pressed,
 * it calls exitOneLevel() to move up one level in the focus hierarchy.
 * 
 * This hook consolidates duplicate ESC handling logic that was previously
 * implemented in every tab component.
 * 
 * @param hasFocus - Whether the component currently has focus
 * 
 * @example
 * ```typescript
 * export function MyTab() {
 *   const { isFocused } = useFocusManager();
 *   const hasFocus = isFocused('my-panel');
 *   
 *   // Automatically handles ESC key
 *   useTabEscapeHandler(hasFocus);
 *   
 *   // Handle other input
 *   useInput((input, key) => {
 *     // ... other input handling ...
 *   }, { isActive: hasFocus });
 *   
 *   return <Box>...</Box>;
 * }
 * ```
 */

import { useInput } from 'ink';
import { useFocusManager } from '../../features/context/FocusContext.js';

export function useTabEscapeHandler(hasFocus: boolean): void {
  const { exitOneLevel } = useFocusManager();
  
  useInput((input, key) => {
    if (key.escape) {
      exitOneLevel();
    }
  }, { isActive: hasFocus });
}
