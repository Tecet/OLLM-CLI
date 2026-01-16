import React from 'react';
import { Box, Text, useInput } from 'ink';
import { TabType } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { Theme } from '../../../config/uiSettings.js';

export interface Tab {
  id: TabType;
  label: string;
  icon: string;
  shortcut: string;
}

export const tabs: Tab[] = [
  { id: 'search', label: 'Search', icon: '🔍', shortcut: 'Ctrl+1' },
  { id: 'files', label: 'Files', icon: '📁', shortcut: 'Ctrl+2' },
  { id: 'github', label: 'GitHub', icon: '🐙', shortcut: 'Ctrl+3' },
  { id: 'tools', label: 'Tools', icon: '🔧', shortcut: 'Ctrl+4' },
  { id: 'docs', label: 'Docs', icon: '📚', shortcut: 'Ctrl+5' },
  { id: 'settings', label: 'Settings', icon: '⚙️', shortcut: 'Ctrl+6' },
];

export interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  notifications: Map<TabType, number>;
  theme: Theme;
}

export function TabBar({ activeTab, onTabChange, notifications, theme, noBorder }: TabBarProps & { noBorder?: boolean }) {
  const { isFocused } = useFocusManager();
  const hasFocus = isFocused('nav-bar');

  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.leftArrow) {
       const currentIndex = tabs.findIndex(t => t.id === activeTab);
       const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
       onTabChange(tabs[prevIndex].id);
    }
    if (key.rightArrow) {
       const currentIndex = tabs.findIndex(t => t.id === activeTab);
       const nextIndex = (currentIndex + 1) % tabs.length;
       onTabChange(tabs[nextIndex].id);
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="row" {...(!noBorder && { borderStyle: "single", borderColor: hasFocus ? theme.border.active : theme.border.primary })}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const notificationCount = notifications.get(tab.id) || 0;
        const hasNotifications = notificationCount > 0;
        
        // Active Text Color: Yellow if Focused, Accent if Active but not focused, Secondary otherwise
        let textColor = theme.text.secondary;
        if (isActive) {
            textColor = hasFocus ? 'yellow' : theme.text.accent;
        }

        return (
          <Box key={tab.id} paddingX={1}>
            <Text
              color={textColor}
              bold={isActive}
              backgroundColor={isActive && hasFocus ? undefined : undefined} // Could add bg if needed
            >
              {tab.icon} {tab.label}
              {hasNotifications && (
                <Text color={theme.text.accent}> ({notificationCount})</Text>
              )}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
