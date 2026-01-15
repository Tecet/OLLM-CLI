import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type TabType = 'chat' | 'tools' | 'files' | 'search' | 'docs' | 'settings';

export interface Notification {
  id: string;
  tab: TabType;
  count: number;
  type: 'info' | 'warning' | 'error';
}

export interface Theme {
  name: string;
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
  };
  text: {
    primary: string;
    secondary: string;
    accent: string;
  };
  border: {
    primary: string;
    secondary: string;
  };
  role: {
    user: string;
    assistant: string;
    system: string;
    tool: string;
  };
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  diff: {
    added: string;
    removed: string;
  };
}

export interface Keybinds {
  // Tab navigation
  tabChat: string;
  tabTools: string;
  tabFiles: string;
  tabSearch: string;
  tabDocs: string;
  tabSettings: string;
  
  // Layout
  togglePanel: string;
  commandPalette: string;
  toggleDebug: string;
  
  // Chat
  clearChat: string;
  saveSession: string;
  cancel: string;
  send: string;
  newline: string;
  editPrevious: string;
  
  // Review
  approve: string;
  reject: string;
  
  // Navigation
  scrollDown: string;
  scrollUp: string;
  select: string;
  back: string;
  cycleFocus: string;
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

// Default theme (Default Dark)
const defaultTheme: Theme = {
  name: 'default-dark',
  bg: {
    primary: '#1e1e1e',
    secondary: '#252526',
    tertiary: '#2d2d30',
  },
  text: {
    primary: '#d4d4d4',
    secondary: '#858585',
    accent: '#4ec9b0',
  },
  border: {
    primary: '#858585',
    secondary: '#555555',
  },
  role: {
    user: '#569cd6',
    assistant: '#4ec9b0',
    system: '#858585',
    tool: '#dcdcaa',
  },
  status: {
    success: '#4ec9b0',
    warning: '#ce9178',
    error: '#f48771',
    info: '#569cd6',
  },
  diff: {
    added: '#4ec9b0',
    removed: '#f48771',
  },
};

// Default keybinds
const defaultKeybinds: Keybinds = {
  tabChat: 'ctrl+1',
  tabTools: 'ctrl+2',
  tabFiles: 'ctrl+3',
  tabSearch: 'ctrl+4',
  tabDocs: 'ctrl+5',
  tabSettings: 'ctrl+6',
  togglePanel: 'ctrl+p',
  commandPalette: 'ctrl+k',
  toggleDebug: 'ctrl+/',
  clearChat: 'ctrl+l',
  saveSession: 'ctrl+s',
  cancel: 'escape',
  send: 'enter',
  newline: 'shift+enter',
  editPrevious: 'up',
  approve: 'y',
  reject: 'n',
  scrollDown: 'j',
  scrollUp: 'k',
  select: 'enter',
  back: 'backspace',
  cycleFocus: 'tab',
};

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
  initialTheme = defaultTheme,
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
