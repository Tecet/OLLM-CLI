/**
 * Hook for managing interactive menu system
 */

import { useCallback } from 'react';

import type { MenuOption, MenuState } from '../types.js';

export interface UseMenuSystemProps {
  menuState: MenuState;
  setMenuState: React.Dispatch<React.SetStateAction<MenuState>>;
  setInputMode: React.Dispatch<React.SetStateAction<'text' | 'menu'>>;
}

export interface UseMenuSystemReturn {
  /** Activate menu with options */
  activateMenu: (options: MenuOption[], messageId?: string) => void;

  /** Navigate menu up or down */
  navigateMenu: (direction: 'up' | 'down') => void;

  /** Execute the currently selected menu option */
  executeMenuOption: () => Promise<void>;

  /** Update menu state partially */
  updateMenuState: (updates: Partial<MenuState>) => void;
}

/**
 * Manages interactive menu system for user selections
 */
export function useMenuSystem({
  menuState,
  setMenuState,
  setInputMode,
}: UseMenuSystemProps): UseMenuSystemReturn {
  /**
   * Activate menu with given options
   */
  const activateMenu = useCallback(
    (options: MenuOption[], messageId?: string) => {
      // Order options: back and exit first, then others
      const orderedOptions = [
        ...options.filter((option) => option.id === 'opt-back'),
        ...options.filter((option) => option.id === 'opt-exit'),
        ...options.filter((option) => option.id !== 'opt-back' && option.id !== 'opt-exit'),
      ];

      setMenuState({
        active: true,
        options: orderedOptions,
        selectedIndex: 0,
        messageId,
      });
      setInputMode('menu');
    },
    [setMenuState, setInputMode]
  );

  /**
   * Navigate menu selection
   */
  const navigateMenu = useCallback(
    (direction: 'up' | 'down') => {
      setMenuState((prev) => {
        const count = prev.options.length;
        if (count === 0) return prev;

        let nextIndex = prev.selectedIndex;
        if (direction === 'up') {
          nextIndex = (prev.selectedIndex - 1 + count) % count;
        } else {
          nextIndex = (prev.selectedIndex + 1) % count;
        }

        return { ...prev, selectedIndex: nextIndex };
      });
    },
    [setMenuState]
  );

  /**
   * Execute the currently selected menu option
   */
  const executeMenuOption = useCallback(async () => {
    if (!menuState.active || !menuState.options[menuState.selectedIndex]) return;

    const option = menuState.options[menuState.selectedIndex];

    // Deactivate menu and return to text mode
    setInputMode('text');
    setMenuState((prev) => ({ ...prev, active: false }));

    // Execute the option's action
    await option.action();
  }, [menuState, setInputMode, setMenuState]);

  /**
   * Update menu state partially
   */
  const updateMenuState = useCallback(
    (updates: Partial<MenuState>) => {
      setMenuState((prev) => ({ ...prev, ...updates }));
    },
    [setMenuState]
  );

  return {
    activateMenu,
    navigateMenu,
    executeMenuOption,
    updateMenuState,
  };
}
