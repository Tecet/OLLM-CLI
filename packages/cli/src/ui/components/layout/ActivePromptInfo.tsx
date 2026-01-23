import React from 'react';
import { Box, Text } from 'ink';

import { useActiveContext } from '../../../features/context/ActiveContextState.js';
import { useContextManager } from '../../../features/context/ContextManagerContext.js';
import { useUI } from '../../../features/context/UIContext.js';

// Helper to format tier display
function formatTierDisplay(tier: string): string {
  // Extract tier number from "Tier X" format
  const match = tier.match(/Tier (\d+)/);
  if (!match) return tier;
  
  const tierNum = match[1];
  const tierRanges: Record<string, string> = {
    '1': '2-4K',
    '2': '4-8K',
    '3': '8-32K',
    '4': '32-64K',
    '5': '64K+'
  };
  
  return tierRanges[tierNum] || tier;
}

// Helper to capitalize mode name
function formatModeName(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function ActivePromptInfo() {
  const { state: uiState } = useUI();
  const { state: contextState } = useContextManager();
  const { currentMode } = useActiveContext();

  const modeStr = formatModeName(currentMode);
  const tierStr = formatTierDisplay(contextState.effectivePromptTier);
  const optimizationStr = contextState.autoSizeEnabled ? 'Auto' : 'User-optimized';

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1} alignSelf="flex-start">
      <Box height={1} />
      <Text>
        <Text color={uiState.theme.status.info} bold>Active Prompt: </Text>
        <Text color={uiState.theme.text.primary}>
          {modeStr} {tierStr}
        </Text>
        <Text dimColor> ({optimizationStr})</Text>
      </Text>
      <Box marginTop={0} alignSelf="flex-start">
        <Text dimColor>
             Author: github.upstash
        </Text>
      </Box>
    </Box>
  );
}
