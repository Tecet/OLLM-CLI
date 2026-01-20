import React from 'react';
import { Box, Text } from 'ink';
import { useActiveContext } from '../../../features/context/ActiveContextState.js';
import { ModeConfidenceDisplay } from './ModeConfidenceDisplay.js';
import { useUI } from '../../../features/context/UIContext.js';

export function ContextSection() {
  const { state: uiState } = useUI();
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


  return (
    <Box flexDirection="column" alignItems="flex-start">
      {/* Mode Confidence Display */}
      <Box marginBottom={1}>
        <ModeConfidenceDisplay
          currentMode={currentMode}
          currentModeIcon={modeIcon}
          currentModeColor={modeColor}
          currentModeConfidence={currentModeConfidence}
          modeDuration={modeDuration}
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
