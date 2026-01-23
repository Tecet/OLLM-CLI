/**
 * Shared hook for standard tab navigation patterns
 * 
 * Provides consistent keyboard navigation across all tab components:
 * - Up/Down arrow keys for vertical navigation
 * - Left/Right arrow keys for horizontal navigation or expand/collapse
 * - ESC key for exiting the current level
 * 
 * @example
 * ```typescript
 * const { handleNavigation } = useTabNavigation({
 *   hasFocus: true,
 *   onUp: () => setSelectedIndex(prev => Math.max(0, prev - 1)),
 *   onDown: () => setSelectedIndex(prev => Math.min(items.length - 1, prev + 1)),
 *   onEscape: () => focusManager.exitOneLevel()
 * });
 * ```
 */

import { useInput } from 'ink';

import { useFocusManager } from '../../features/context/FocusContext.js';

export interface TabNavigationOptions {
  /** Whether this component currently has focus */
  hasFocus: boolean;
  /** Handler for up arrow key */
  onUp?: () => void;
  /** Handler for down arrow key */
  onDown?: () => void;
  /** Handler for left arrow key */
  onLeft?: () => void;
  /** Handler for right arrow key */
  onRight?: () => void;
  /** Handler for ESC key (defaults to exitOneLevel) */
  onEscape?: () => void;
  /** Handler for Enter key */
  onEnter?: () => void;
  /** Whether to prevent default ESC behavior */
  preventDefaultEscape?: boolean;
}

/**
 * Hook for standard tab navigation patterns
 * 
 * Consolidates common keyboard navigation logic used across tab components.
 * Reduces code duplication and ensures consistent navigation behavior.
 */
export function useTabNavigation(options: TabNavigationOptions): void {
  const {
    hasFocus,
    onUp,
    onDown,
    onLeft,
    onRight,
    onEscape,
    onEnter,
    preventDefaultEscape = false,
  } = options;

  const focusManager = useFocusManager();

  useInput(
    (input, key) => {
      if (!hasFocus) return;

      // Up arrow navigation
      if (key.upArrow && onUp) {
        onUp();
        return;
      }

      // Down arrow navigation
      if (key.downArrow && onDown) {
        onDown();
        return;
      }

      // Left arrow navigation
      if (key.leftArrow && onLeft) {
        onLeft();
        return;
      }

      // Right arrow navigation
      if (key.rightArrow && onRight) {
        onRight();
        return;
      }

      // Enter key
      if (key.return && onEnter) {
        onEnter();
        return;
      }

      // ESC key - exit one level in focus hierarchy
      if (key.escape) {
        if (onEscape) {
          onEscape();
        } else if (!preventDefaultEscape) {
          focusManager.exitOneLevel();
        }
        return;
      }
    },
    { isActive: hasFocus }
  );
}
