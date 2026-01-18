import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import { Theme, Keybinds } from '../../config/types.js';
import { defaultKeybinds } from '../../config/defaults.js';
import { defaultDarkTheme } from '../../config/styles.js';

export type TabType = 'chat' | 'search' | 'files' | 'tools' | 'docs' | 'github' | 'settings';

export interface Notification {
  id: string;
  tab: TabType;
  count: number;
  type: 'info' | 'warning' | 'error';
}

export interface UIState {
  activeTab: TabType;
  sidePanelVisible: boolean;
  launchScreenVisible: boolean;
  theme: Theme;
  keybinds: Keybinds;
  notifications: Notification[];
}

export interface UIContextValue {
  state: UIState;
  setActiveTab: (tab: TabType) => void;
  toggleSidePanel: () => void;
  setLaunchScreenVisible: (visible: boolean) => void;
  setTheme: (theme: Theme) => void;
  addNotification: (tab: TabType, type: Notification['type']) => void;
  clearNotifications: (tab: TabType) => void;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export interface UIProviderProps {
  children: ReactNode;
  initialTab?: TabType;
  initialSidePanelVisible?: boolean;
  initialTheme?: Theme;
  initialKeybinds?: Keybinds;
}

export function UIProvider({
  children,
  initialTab = 'chat',
  initialSidePanelVisible = true,
  initialTheme = defaultDarkTheme,
  initialKeybinds = defaultKeybinds,
}: UIProviderProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [sidePanelVisible, setSidePanelVisible] = useState(initialSidePanelVisible);
  const [launchScreenVisible, setLaunchScreenVisible] = useState(true);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [keybinds] = useState<Keybinds>(initialKeybinds);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const toggleSidePanel = useCallback(() => {
    setSidePanelVisible((prev) => !prev);
  }, []);

  const addNotification = useCallback((tab: TabType, type: Notification['type']) => {
    setNotifications((prev) => {
      const existing = prev.find((n) => n.tab === tab && n.type === type);
      if (existing) {
        return prev.map((n) =>
          n.tab === tab && n.type === type ? { ...n, count: n.count + 1 } : n
        );
      }
      return [
        ...prev,
        {
          id: `${tab}-${type}-${Date.now()}`,
          tab,
          count: 1,
          type,
        },
      ];
    });
  }, []);

  const clearNotifications = useCallback((tab: TabType) => {
    setNotifications((prev) => prev.filter((n) => n.tab !== tab));
  }, []);

  const value: UIContextValue = {
    state: {
      activeTab,
      sidePanelVisible,
      launchScreenVisible,
      theme,
      keybinds,
      notifications,
    },
    setActiveTab,
    toggleSidePanel,
    setLaunchScreenVisible,
    setTheme,
    addNotification,
    clearNotifications,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
