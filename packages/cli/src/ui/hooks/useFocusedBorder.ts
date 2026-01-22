/**
 * Hook for consistent border styling based on focus state
 * 
 * Provides a standardized way to style component borders based on whether
 * the component currently has focus. Uses theme colors for consistency.
 * 
 * @example
 * ```typescript
 * const borderColor = useFocusedBorder('chat-history');
 * 
 * return (
 *   <Box borderStyle="single" borderColor={borderColor}>
 *     {content}
 *   </Box>
 * );
 * ```
 */

import { useFocusManager } from '../../features/context/FocusContext.js';
import { useUI } from '../../features/context/UIContext.js';

/**
 * Returns the appropriate border color based on focus state
 * 
 * @param focusId - The focus ID to check
 * @returns Border color string (active or primary from theme)
 */
export function useFocusedBorder(focusId: string): string {
  const { isFocused } = useFocusManager();
  const { uiState } = useUI();
  const theme = uiState.theme;

  const hasFocus = isFocused(focusId);

  return hasFocus ? theme.border.active : theme.border.primary;
}

/**
 * Returns focus state and border color
 * 
 * @param focusId - The focus ID to check
 * @returns Object with hasFocus boolean and borderColor string
 */
export function useFocusedState(focusId: string): {
  hasFocus: boolean;
  borderColor: string;
} {
  const { isFocused } = useFocusManager();
  const { uiState } = useUI();
  const theme = uiState.theme;

  const hasFocus = isFocused(focusId);
  const borderColor = hasFocus ? theme.border.active : theme.border.primary;

  return { hasFocus, borderColor };
}
