/**
 * ContextMenu
 * 
 * Display context tier selection menu.
 * NO business logic - just display what it's given.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { TierOption } from '@ollm/ollm-cli-core/context/ContextSizeCalculator.js';

export interface ContextMenuProps {
  availableTiers: TierOption[];
  currentTier: number;
  onSelect: (tier: number) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  availableTiers,
  currentTier,
  onSelect
}) => {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text bold>Available Context Tiers:</Text>
      <Box flexDirection="column" paddingLeft={2}>
        {availableTiers.map((option) => (
          <Box key={option.tier}>
            <Text color={option.tier === currentTier ? 'green' : 'white'}>
              {option.tier === currentTier ? '→ ' : '  '}
              {option.label} - {option.description}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
