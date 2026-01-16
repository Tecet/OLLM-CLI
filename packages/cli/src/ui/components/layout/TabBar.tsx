import React from 'react';
import { Box, Text } from 'ink';
import { TabType } from '../../../features/context/UIContext.js';

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
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    bg: {
      primary: string;
      secondary: string;
    };
  };
}

export function TabBar({ activeTab, onTabChange, notifications, theme, noBorder }: TabBarProps & { noBorder?: boolean }) {
  return (
    <Box flexDirection="row" {...(!noBorder && { borderStyle: "single", borderColor: theme.text.secondary })}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const notificationCount = notifications.get(tab.id) || 0;
        const hasNotifications = notificationCount > 0;

        return (
          <Box key={tab.id} paddingX={1}>
            <Text
              color={isActive ? theme.text.accent : theme.text.secondary}
              bold={isActive}
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
