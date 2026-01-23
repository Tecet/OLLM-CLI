import React from 'react';
import { Box, Text } from 'ink';

import { ModeConfidenceDisplay } from './ModeConfidenceDisplay.js';
import { useActiveContext } from '../../../features/context/ActiveContextState.js';
import { useContextManager } from '../../../features/context/ContextManagerContext.js';
import { useUI } from '../../../features/context/UIContext.js';

// Helper to format tier display
function _formatTierDisplay(tier: string): string {
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
function _formatModeName(mode: string): string {
  return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function ContextSection() {
  const { state: uiState } = useUI();
  const { state: contextState } = useContextManager();
  const { 
    activeSkills, 
    activeHooks,
    activeMcpServers,
    currentMode,
    allowedTools,
    modeIcon,
    modeColor,
    currentModeConfidence,
    modeDuration,
    suggestedModes,
  } = useActiveContext();

  // Debug logging
  console.log('[ContextSection] RENDER - effectivePromptTier:', contextState.effectivePromptTier);
  console.log('[ContextSection] RENDER - actualContextTier:', contextState.actualContextTier);
  console.log('[ContextSection] RENDER - currentMode:', currentMode);

  return (
    <Box flexDirection="column" alignItems="flex-start">
      {/* Mode Confidence Display */}
      <Box marginBottom={1}>
        <ModeConfidenceDisplay
          currentMode={currentMode}
          currentModeIcon={modeIcon}
          currentModeColor={modeColor}
          currentModeConfidence={currentModeConfidence}
          suggestedModes={suggestedModes}
          allowedTools={allowedTools}
          theme={uiState.theme}
        />
      </Box>
      
      <Box flexDirection="column" paddingX={1} alignItems="flex-start">
        <Box flexDirection="column" marginBottom={1} alignSelf="flex-start">
          <Text color={uiState.theme.status.success} bold>Active Skills:</Text>
          <Box marginLeft={1} alignSelf="flex-start">
            {activeSkills.length === 0 ? (
              <Text dimColor>None</Text>
            ) : (
              <Text color={uiState.theme.text.primary}>{activeSkills.join(', ')}</Text>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" marginBottom={1} alignSelf="flex-start">
          <Text color={uiState.theme.text.accent} bold>MCP Servers:</Text>
          <Box marginLeft={1} alignSelf="flex-start">
            {activeMcpServers.length === 0 ? (
              <Text dimColor>None</Text>
            ) : (
              <Text color={uiState.theme.text.primary}>{activeMcpServers.join(', ')}</Text>
            )}
          </Box>
        </Box>

        <Box flexDirection="column" alignSelf="flex-start">
          <Text color={uiState.theme.status.info} bold>Active Hooks:</Text>
          <Box marginLeft={1} alignSelf="flex-start">
            {activeHooks.length === 0 ? (
              <Text dimColor>None</Text>
            ) : (
              <Text color={uiState.theme.text.primary}>{activeHooks.join(', ')}</Text>
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
