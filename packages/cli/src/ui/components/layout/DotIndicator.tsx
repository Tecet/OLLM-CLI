import React from 'react';
import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';

interface DotIndicatorProps {
  total: number;
  active: number;
  theme: Theme;
}

/**
 * Reusable Dot Indicator component for switchable windows.
 * Shows one dot per available window, with the active one highlighted.
 */
export function DotIndicator({ total, active, theme }: DotIndicatorProps) {
  const dots = [];
  for (let i = 0; i < total; i++) {
    const isActive = i === active;
    dots.push(
      <Text 
        key={i} 
        color={isActive ? theme.text.accent : theme.text.secondary}
        bold={isActive}
      >
        {isActive ? '●' : '○'}
      </Text>
    );
  }

  return (
    <Box flexDirection="row" gap={1} paddingX={1}>
      {dots}
    </Box>
  );
}
