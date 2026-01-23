/**
 * React hook for keyboard shortcuts
 */

import { useEffect } from 'react';
import { useInput } from 'ink';

import { keyboardHandler, KeyboardShortcut } from '../services/keyboardHandler.js';

export interface UseKeyboardShortcutsOptions {
  shortcuts?: KeyboardShortcut[];
  context?: string;
  enabled?: boolean;
}

/**
 * Hook to register and handle keyboard shortcuts
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { shortcuts = [], context, enabled = true } = options;

  // Register shortcuts on mount
  useEffect(() => {
    if (!enabled) return;

    shortcuts.forEach((shortcut) => {
      keyboardHandler.register({
        ...shortcut,
        context: shortcut.context || context,
      });
    });

    return () => {
      shortcuts.forEach((shortcut) => {
        keyboardHandler.unregister(shortcut.key, shortcut.context || context);
      });
    };
  }, [shortcuts, context, enabled]);

  // Set active context
  useEffect(() => {
    if (!enabled) return;
    
    keyboardHandler.setContext(context || null);
    
    return () => {
      keyboardHandler.setContext(null);
    };
  }, [context, enabled]);

  // Handle keyboard input
  useInput(
    async (input, key) => {
      if (!enabled) return;
      await keyboardHandler.handle(input, key);
    },
    { isActive: enabled }
  );
}

/**
 * Hook to register global keyboard shortcuts
 */
export function useGlobalKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useKeyboardShortcuts({ shortcuts, enabled: true });
}

/**
 * Hook to register context-specific keyboard shortcuts
 */
export function useContextKeyboardShortcuts(
  context: string,
  shortcuts: KeyboardShortcut[]
) {
  useKeyboardShortcuts({ shortcuts, context, enabled: true });
}
