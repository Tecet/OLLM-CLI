import type { WindowType } from '../contexts/WindowContext.js';

/**
 * Display labels for left column windows (purely presentation)
 */
export function leftWindowLabel(window: WindowType): string {
  switch (window) {
    case 'chat':
      return 'Chat';
    case 'terminal':
      return 'Terminal';
    case 'editor':
      return 'Editor';
    default:
      return '';
  }
}

/**
 * Header label for the right-side panel based on which left window is active.
 * - active 'chat'  => 'Tools'
 * - active 'terminal' => 'Workspace'
 * For any other window we default to 'Tools' for now.
 */
export function rightPanelHeaderLabel(activeWindow: WindowType): string {
  if (activeWindow === 'chat') return 'Tools';
  if (activeWindow === 'terminal') return 'Workspace';
  return 'Tools';
}
