/**
 * Global Keyboard Shortcuts Hook
 * 
 * Centralizes all global keyboard shortcuts in one place for better maintainability.
 * This hook handles:
 * - Tab navigation (Ctrl+1-9)
 * - Layout shortcuts (toggle panel, command palette, debug)
 * - Chat shortcuts (clear, save, cancel)
 * - Scroll shortcuts (Ctrl+PageUp/Down)
 * - Focus management shortcuts (Tab, Shift+Tab, focus shortcuts)
 * 
 * Architecture:
 * - Uses keybinds configuration for customizable shortcuts
 * - Integrates with FocusContext for hierarchical navigation
 * - Respects chat state for context-aware behavior
 * 
 * @example
 * ```typescript
 * function App() {
 *   useGlobalKeyboardShortcuts();
 *   return <Box>...</Box>;
 * }
 * ```
 */

import { useInput } from 'ink';
import { useCallback } from 'react';
import { isKey } from '../utils/keyUtils.js';
import { useKeybinds } from '../../features/context/KeybindsContext.js';
import { useUI, TabType } from '../../features/context/UIContext.js';
import { useChat } from '../../features/context/ChatContext.js';
import { useFocusManager } from '../../features/context/FocusContext.js';

interface UseGlobalKeyboardShortcutsOptions {
  onToggleDebug?: () => void;
  onCommandPalette?: () => void;
  onSaveSession?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
}

/**
 * Hook that registers all global keyboard shortcuts
 * 
 * This hook should be called once at the top level of the application.
 * It handles all global shortcuts that should work regardless of which
 * component has focus.
 * 
 * @param options - Optional callbacks for specific actions
 */
export function useGlobalKeyboardShortcuts(options: UseGlobalKeyboardShortcutsOptions = {}) {
  const { activeKeybinds } = useKeybinds();
  const { setActiveTab, toggleSidePanel } = useUI();
  const { clearChat, cancelGeneration, state: chatState } = useChat();
  const focusManager = useFocusManager();

  const {
    onToggleDebug,
    onCommandPalette,
    onSaveSession,
    onScrollUp,
    onScrollDown,
  } = options;

  /**
   * Handle tab switching
   * Switches to the specified tab and focuses the nav bar
   */
  const handleTabSwitch = useCallback((tab: TabType) => {
    setActiveTab(tab);
    focusManager.setFocus('nav-bar');
    focusManager.setMode('browse');
  }, [setActiveTab, focusManager]);

  /**
   * Handle cancel action
   * Cancels generation if streaming, otherwise exits one level
   */
  const handleCancel = useCallback(() => {
    if (chatState.streaming || chatState.waitingForResponse) {
      cancelGeneration();
    } else {
      focusManager.exitOneLevel();
    }
  }, [chatState.streaming, chatState.waitingForResponse, cancelGeneration, focusManager]);

  // Register global keyboard shortcuts
  useInput((input, key) => {
    // Tab Navigation (Ctrl+1-9)
    if (isKey(input, key, activeKeybinds.tabNavigation.tabChat)) {
      handleTabSwitch('chat');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabTools)) {
      handleTabSwitch('tools');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabHooks)) {
      handleTabSwitch('hooks');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabFiles)) {
      handleTabSwitch('files');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabSearch)) {
      handleTabSwitch('search');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabDocs)) {
      handleTabSwitch('docs');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabGithub)) {
      handleTabSwitch('github');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabMcp)) {
      handleTabSwitch('mcp');
    } else if (isKey(input, key, activeKeybinds.tabNavigation.tabSettings)) {
      handleTabSwitch('settings');
    }

    // Layout Shortcuts
    else if (isKey(input, key, activeKeybinds.layout.togglePanel)) {
      toggleSidePanel();
    } else if (isKey(input, key, activeKeybinds.layout.commandPalette)) {
      onCommandPalette?.();
    } else if (isKey(input, key, activeKeybinds.layout.toggleDebug)) {
      onToggleDebug?.();
    }

    // Chat Shortcuts
    else if (isKey(input, key, activeKeybinds.chat.clearChat)) {
      clearChat();
    } else if (isKey(input, key, activeKeybinds.chat.saveSession)) {
      onSaveSession?.();
    } else if (isKey(input, key, activeKeybinds.chat.cancel)) {
      handleCancel();
    }

    // Scroll Chat Shortcuts
    // Note: These use hardcoded keys as they're not in the keybinds config
    else if (isKey(input, key, 'ctrl+pageup') || isKey(input, key, 'meta+up')) {
      onScrollUp?.();
    } else if (isKey(input, key, 'ctrl+pagedown') || isKey(input, key, 'meta+down')) {
      onScrollDown?.();
    }

    // Focus Management Shortcuts
    else if (isKey(input, key, activeKeybinds.global.cycleNext)) {
      focusManager.cycleFocus('next');
    } else if (isKey(input, key, activeKeybinds.global.cyclePrev)) {
      focusManager.cycleFocus('previous');
    } else if (isKey(input, key, activeKeybinds.global.focusChatInput)) {
      focusManager.setFocus('chat-input');
    } else if (isKey(input, key, activeKeybinds.global.focusNavigation)) {
      focusManager.setFocus('nav-bar');
    } else if (isKey(input, key, activeKeybinds.global.focusContext)) {
      focusManager.setFocus('context-panel');
    } else if (isKey(input, key, activeKeybinds.global.focusFileTree)) {
      focusManager.setFocus('file-tree');
    } else if (isKey(input, key, activeKeybinds.global.focusFunctions)) {
      focusManager.setFocus('functions');
    }
  }, { isActive: true });
}
