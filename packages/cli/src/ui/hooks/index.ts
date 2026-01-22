/**
 * Shared UI Hooks
 * 
 * This module exports reusable hooks for common UI patterns:
 * - Navigation: Standard keyboard navigation for tabs
 * - Focus: Focus-aware border styling
 * - Scrolling: Scroll window management for large lists
 * - Confirmation: Confirmation dialog state management
 */

export { useTabNavigation } from './useTabNavigation.js';
export type { TabNavigationOptions } from './useTabNavigation.js';

export { useFocusedBorder, useFocusedState } from './useFocusedBorder.js';

export { useScrollWindow } from './useScrollWindow.js';
export type { ScrollWindowOptions, ScrollWindowResult } from './useScrollWindow.js';

export { useConfirmation } from './useConfirmation.js';
export type {
  ConfirmationStatus,
  ConfirmationSelection,
  ConfirmationOptions,
  ConfirmationState,
} from './useConfirmation.js';
