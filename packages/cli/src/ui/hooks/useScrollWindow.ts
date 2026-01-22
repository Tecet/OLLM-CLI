/**
 * Hook for managing scrollable window with automatic scroll adjustment
 * 
 * Provides scroll management for lists that are larger than the visible area.
 * Automatically adjusts scroll offset to keep the selected item visible.
 * 
 * @example
 * ```typescript
 * const { scrollOffset, visibleItems } = useScrollWindow({
 *   items: allItems,
 *   selectedIndex: 5,
 *   windowSize: 10
 * });
 * 
 * return (
 *   <Box flexDirection="column">
 *     {visibleItems.map((item, index) => (
 *       <Text key={index}>{item}</Text>
 *     ))}
 *   </Box>
 * );
 * ```
 */

import { useState, useEffect, useMemo } from 'react';

export interface ScrollWindowOptions<T> {
  /** Array of all items */
  items: T[];
  /** Currently selected item index */
  selectedIndex: number;
  /** Number of items visible in the window */
  windowSize: number;
}

export interface ScrollWindowResult<T> {
  /** Current scroll offset */
  scrollOffset: number;
  /** Items visible in the current window */
  visibleItems: T[];
  /** Whether there are more items above */
  hasMore: boolean;
  /** Whether there are more items below */
  hasMoreBelow: boolean;
  /** Total number of items */
  totalItems: number;
}

/**
 * Hook for managing scrollable window with automatic scroll adjustment
 * 
 * Automatically adjusts scroll offset to keep the selected item visible:
 * - If selected item is above the window, scroll up
 * - If selected item is below the window, scroll down
 * - Otherwise, maintain current scroll position
 */
export function useScrollWindow<T>(
  options: ScrollWindowOptions<T>
): ScrollWindowResult<T> {
  const { items, selectedIndex, windowSize } = options;

  const [scrollOffset, setScrollOffset] = useState(0);

  // Adjust scroll offset to keep selected item visible
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      // Selected item is above the window, scroll up
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + windowSize) {
      // Selected item is below the window, scroll down
      setScrollOffset(selectedIndex - windowSize + 1);
    }
  }, [selectedIndex, scrollOffset, windowSize]);

  // Calculate visible items
  const visibleItems = useMemo(() => {
    return items.slice(scrollOffset, scrollOffset + windowSize);
  }, [items, scrollOffset, windowSize]);

  // Calculate scroll indicators
  const hasMore = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + windowSize < items.length;

  return {
    scrollOffset,
    visibleItems,
    hasMore,
    hasMoreBelow,
    totalItems: items.length,
  };
}
