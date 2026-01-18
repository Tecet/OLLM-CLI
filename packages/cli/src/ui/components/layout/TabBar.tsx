import React from 'react';
import { Box, Text, useInput } from 'ink';
import { TabType } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { Theme } from '../../../config/types.js';

export interface Tab {
  id: TabType;
  label: string;
  icon: string;
  shortcut: string;
}

export const tabs: Tab[] = [
  { id: 'chat', label: 'Chat', icon: '\u{1F4AC}', shortcut: 'Ctrl+1' },
  { id: 'tools', label: 'Tools', icon: '\u{1F6E0}', shortcut: 'Ctrl+2' },
  { id: 'hooks', label: 'Hooks', icon: '\u{1F4CC}', shortcut: 'Ctrl+3' },
  { id: 'files', label: 'Files', icon: '\u{1F4C1}', shortcut: 'Ctrl+4' },
  { id: 'search', label: 'Search', icon: '\u{1F50D}', shortcut: 'Ctrl+5' },
  { id: 'docs', label: 'Docs', icon: '\u{1F4DA}', shortcut: 'Ctrl+6' },
  { id: 'github', label: 'GitHub', icon: '\u{1F680}', shortcut: 'Ctrl+7' },
  { id: 'settings', label: 'Settings', icon: '\u{2699}', shortcut: 'Ctrl+8' },
];

export interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  notifications: Map<TabType, number>;
  theme: Theme;
}

export function TabBar({ activeTab, onTabChange, notifications, theme, noBorder }: TabBarProps & { noBorder?: boolean }) {
  const { isFocused, activateContent, setFocus } = useFocusManager();
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
    if (key.return) {
       // Activate current tab content (switch to active mode)
       activateContent(activeTab);
    }
    if (key.escape) {
       // Focus chat input (without changing tab)
       setFocus('chat-input');
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="row" {...(!noBorder && { borderStyle: "single", borderColor: hasFocus ? theme.border.active : theme.border.primary })}>
      {tabs.map((tab) => {
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
              backgroundColor={isActive && hasFocus ? undefined : undefined}
            >
              {tab.icon}  {tab.label}
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
