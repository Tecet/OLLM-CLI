/**
 * Hook to get border color based on focus state
 *
 * Returns the appropriate border color for a component based on whether
 * it currently has focus. Uses the theme's focus color when focused,
 * and the border color when not focused.
 *
 * @param focusId - The focus ID to check
 * @returns The border color to use
 *
 * @example
 * ```typescript
 * const borderColor = useFocusedBorder('tools-panel');
 * <Box borderColor={borderColor}>...</Box>
 * ```
 */

import { useFocusManager } from '../../features/context/FocusContext.js';
import { useUI } from '../../features/context/UIContext.js';

import type { FocusableId } from '../../features/context/FocusContext.js';

export function useFocusedBorder(focusId: FocusableId): string {
  const focusManager = useFocusManager();
  const { state } = useUI();
  const theme = state.theme;

  const isFocused = focusManager.isFocused(focusId);

  return isFocused ? theme.border.active : theme.border.primary;
}
