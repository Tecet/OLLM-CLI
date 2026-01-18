import React from 'react';
import { Box, Text } from 'ink';
import { useActiveContext } from '../../../features/context/ActiveContextState.js';
import { ModeConfidenceDisplay } from './ModeConfidenceDisplay.js';

export function ContextSection() {
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
    <Box flexDirection="column" width="100%">
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
        />
      </Box>
      
      <Box flexDirection="column" width="100%" paddingX={1}>
        {/* Active Skills */}
        <Box>
          <Text color="green" bold>Active Skills: </Text>
          {activeSkills.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            <Text>{activeSkills.join(', ')}</Text>
          )}
        </Box>

        {/* MCP Servers */}
        <Box>
          <Text color="magenta" bold>MCP Servers:  </Text>
          {activeMcpServers.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            <Text>{activeMcpServers.join(', ')}</Text>
          )}
        </Box>

        {/* Active Hooks */}
        <Box>
          <Text color="cyan" bold>Active Hooks:  </Text>
          {activeHooks.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            <Text>{activeHooks.join(', ')}</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
