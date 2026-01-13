import React, { useState } from 'react';
import { Box, Text } from 'ink';

export interface SectionConfig {
  id: string;
  title: string;
  component: React.ComponentType;
  collapsed: boolean;
}

export interface SidePanelProps {
  visible: boolean;
  sections: SectionConfig[];
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

function SidePanelSection({ title, collapsed, onToggle, children, theme }: SidePanelSectionProps) {
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

export function SidePanel({ visible, sections, theme }: SidePanelProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(sections.filter(s => s.collapsed).map(s => s.id))
  );

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!visible) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      width={30}
      borderStyle="single"
      borderColor={theme.text.secondary}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text color={theme.text.accent} bold>
          Side Panel
        </Text>
      </Box>
      {sections.map(section => {
        const Component = section.component;
        const isCollapsed = collapsedSections.has(section.id);
        
        return (
          <SidePanelSection
            key={section.id}
            title={section.title}
            collapsed={isCollapsed}
            onToggle={() => toggleSection(section.id)}
            theme={theme}
          >
            <Component />
          </SidePanelSection>
        );
      })}
    </Box>
  );
}

// Section Components

export function ContextSection() {
  return (
    <Box flexDirection="column">
      <Text dimColor>No context files</Text>
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
