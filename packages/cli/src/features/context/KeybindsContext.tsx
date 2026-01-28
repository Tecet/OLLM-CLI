import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { keybindsData } from '../../config/keybinds.js';
import { KeybindsService } from '../../services/KeybindsService.js';

type KeybindsData = typeof keybindsData;

interface KeybindsContextType {
  activeKeybinds: KeybindsData;
  defaultKeybinds: KeybindsData;
  setUserBind: (category: string, id: string, key: string) => void;
  restoreDefault: (category?: string, id?: string) => void;
  checkConflict: (key: string) => { category: string; id: string } | null;
}

const KeybindsContext = createContext<KeybindsContextType | undefined>(undefined);

export function useKeybinds() {
  const context = useContext(KeybindsContext);
  if (!context) {
    // Graceful fallback to avoid runtime crashes during dev/init
    console.warn('useKeybinds: Context missing, returning defaults');
    return {
      activeKeybinds: keybindsData,
      defaultKeybinds: keybindsData,
      setUserBind: () => {},
      restoreDefault: () => {},
      checkConflict: () => null,
    };
  }
  return context;
}

interface KeybindsProviderProps {
  children: ReactNode;
}

export function KeybindsProvider({ children }: KeybindsProviderProps) {
  const [activeKeybinds, setActiveKeybinds] = useState<KeybindsData>(keybindsData);
  const keybindsService = KeybindsService.getInstance();

  useEffect(() => {
    // Load persisted keybinds on mount
    const loaded = keybindsService.load();
    setActiveKeybinds(loaded);
  }, [keybindsService]);

  const setUserBind = (category: string, id: string, key: string) => {
    setActiveKeybinds((prev) => {
      const newKeybinds = {
        ...prev,
        [category]: {
          ...((prev as any)[category] || {}),
          [id]: key,
        },
      };
      // Persist changes
      keybindsService.save(newKeybinds);
      return newKeybinds;
    });
  };

  const restoreDefault = (category?: string, id?: string) => {
    if (category && id) {
      // Restore specific key
      const defaultKey = (keybindsData as any)[category]?.[id];
      if (defaultKey) {
        setUserBind(category, id, defaultKey);
      }
    } else {
      // Restore all
      const defaults = keybindsService.resetAll();
      setActiveKeybinds(defaults);
    }
  };

  const checkConflict = (key: string): { category: string; id: string } | null => {
    const normalizedNewKey = normalizeKey(key);

    for (const [catName, catValues] of Object.entries(activeKeybinds)) {
      for (const [actionId, actionKey] of Object.entries(catValues as Record<string, string>)) {
        if (normalizeKey(actionKey) === normalizedNewKey) {
          return { category: catName, id: actionId };
        }
      }
    }
    return null;
  };

  return (
    <KeybindsContext.Provider
      value={{
        activeKeybinds,
        defaultKeybinds: keybindsData,
        setUserBind,
        restoreDefault,
        checkConflict,
      }}
    >
      {children}
    </KeybindsContext.Provider>
  );
}

// Simple key normalizer for comparison (lowercase, trimmed, space removed)
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, '');
}
