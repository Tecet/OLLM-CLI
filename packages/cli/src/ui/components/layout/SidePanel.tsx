import React from 'react';
import { Box, Text } from 'ink';
import { TabBar } from './TabBar.js';
import { TabType } from '../../../features/context/UIContext.js';

export interface SectionConfig {
  id: string;
  title: string;
  component: React.ComponentType;
  collapsed: boolean;
}

export interface SidePanelProps {
  visible: boolean;
  sections: SectionConfig[];
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

interface SidePanelSectionProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: SidePanelProps['theme'];
}

function SidePanelSection({ title, collapsed, children, theme }: Omit<SidePanelSectionProps, 'onToggle'>) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={theme.text.accent} bold>
          {collapsed ? '▶' : '▼'} {title}
        </Text>
      </Box>
      {!collapsed && (
        <Box flexDirection="column" paddingLeft={2}>
          {children}
        </Box>
      )}
    </Box>
  );
}

export function SidePanel({ visible, sections, activeTab, onTabChange, notifications, theme }: SidePanelProps) {
  const collapsedSections = new Set(sections.filter(s => s.collapsed).map(s => s.id));

  if (!visible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="single"
      borderColor={theme.text.secondary}
      paddingX={1}
    >
      {/* Navigation Tabs at the top of side panel */}
      <Box 
        borderStyle="single" 
        borderColor={theme.text.secondary} 
        marginY={1}
        paddingX={1}
      >
        <TabBar
          activeTab={activeTab}
          onTabChange={onTabChange}
          notifications={notifications}
          theme={theme}
          noBorder
        />
      </Box>

      {sections.map(section => {
        const Component = section.component;
        const isCollapsed = collapsedSections.has(section.id);
        
        return (
          <SidePanelSection
            key={section.id}
            title={section.title}
            collapsed={isCollapsed}
            theme={theme}
          >
            <Component />
          </SidePanelSection>
        );
      })}
    </Box>
  );
}

export function GitSection() {
  return (
    <Box flexDirection="column">
      <Text dimColor>No git repository</Text>
    </Box>
  );
}

export function ReviewSection() {
  return (
    <Box flexDirection="column">
      <Text dimColor>No pending reviews</Text>
    </Box>
  );
}

export function ToolsSection() {
  return (
    <Box flexDirection="column">
      <Text dimColor>No active tools</Text>
    </Box>
  );
}
