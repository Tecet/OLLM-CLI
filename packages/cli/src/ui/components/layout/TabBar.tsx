import React from 'react';
import { Box, Text, useInput, BoxProps } from 'ink';
import { TabType } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { Theme } from '../../../config/types.js';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import { isKey } from '../../utils/keyUtils.js';

export interface Tab {
  id: TabType;
  label: string;
  icon: string;
  shortcut: string;
}

export const tabs: Tab[] = [
  { id: 'chat', label: 'Chat', icon: '💬', shortcut: 'Ctrl+1' },
  { id: 'tools', label: 'Tools', icon: '🛠', shortcut: 'Ctrl+2' },
  { id: 'hooks', label: 'Hooks', icon: '🔗', shortcut: 'Ctrl+3' },
  { id: 'files', label: 'Files', icon: '📁', shortcut: 'Ctrl+4' },
  { id: 'search', label: 'Search', icon: '🔍', shortcut: 'Ctrl+5' },
  { id: 'docs', label: 'Docs', icon: '📚', shortcut: 'Ctrl+6' },
  { id: 'github', label: 'GitHub', icon: '🐙', shortcut: 'Ctrl+7' },
  { id: 'mcp', label: 'MCP', icon: '🔌', shortcut: 'Ctrl+8' },
  { id: 'settings', label: 'Settings', icon: '⚙', shortcut: 'Ctrl+9' },
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
  const { activeKeybinds } = useKeybinds();

  useInput((input, key) => {
    if (!hasFocus) return;

    if (isKey(input, key, activeKeybinds.navigation.left)) {
       const currentIndex = tabs.findIndex(t => t.id === activeTab);
       const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
       onTabChange(tabs[prevIndex].id);
    }
    if (isKey(input, key, activeKeybinds.navigation.right)) {
       const currentIndex = tabs.findIndex(t => t.id === activeTab);
       const nextIndex = (currentIndex + 1) % tabs.length;
       onTabChange(tabs[nextIndex].id);
    }
    if (isKey(input, key, activeKeybinds.navigation.select)) {
       // Activate current tab content (switch to active mode)
       activateContent(activeTab);
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="row" justifyContent="flex-start" paddingX={1} {...(!noBorder && { borderStyle: theme.border.style as BoxProps['borderStyle'], borderColor: hasFocus ? theme.border.active : theme.border.primary })}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const notificationCount = notifications.get(tab.id) || 0;
        const hasNotifications = notificationCount > 0;

        // Active Text Color: Accent if active (focused or not), Secondary otherwise
        const textColor = isActive ? theme.text.accent : theme.text.secondary;

        // Efficient spacing: Left padding only ensures separation and alignment without double gaps
        return (
          <Box key={tab.id} paddingLeft={index === 0 ? 0 : 1}>
            <Text
              color={textColor}
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
