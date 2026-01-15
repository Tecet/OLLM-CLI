import React from 'react';
import { Box, Text } from 'ink';
import { TabBar } from './TabBar.js';
import { StatusBar, ConnectionStatus } from './StatusBar.js';
import type { TabType } from '../../../contexts/UIContext.js';

export interface HeaderBarProps {
  connection: ConnectionStatus;
  model: string;
  tokens: { current: number; max: number };
  gpu: any;
  theme: any;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  notifications: Map<TabType, number>;
  contextSize?: string;
}

export function HeaderBar({ connection, model, tokens, gpu, theme, activeTab, onTabChange, notifications, contextSize }: HeaderBarProps) {
  return (
    <Box flexDirection="row" width="100%" height={3} borderStyle="single" borderColor={theme.text.secondary} alignItems="center">
      {/* Left: StatusBar info */}
      <Box flexDirection="row" alignItems="center" flexGrow={1} justifyContent="flex-start">
        <StatusBar
          connection={typeof connection === 'object' ? connection : { status: 'connected', provider: '' }}
          model={model}
          tokens={tokens}
          gpu={gpu}
          git={null}
          reviews={0}
          cost={0}
          theme={theme}
          compact
        />
        {typeof contextSize === 'string' && (
          <Text color={theme.text.secondary}> │ Ctx: {contextSize}</Text>
        )}
      </Box>
      {/* Right: Navigation */}
      <Box flexDirection="row" alignItems="center" justifyContent="flex-end" flexShrink={0}>
        <TabBar
          activeTab={activeTab}
          onTabChange={onTabChange}
          notifications={notifications}
          theme={theme}
          noBorder
        />
      </Box>
    </Box>
  );
}
