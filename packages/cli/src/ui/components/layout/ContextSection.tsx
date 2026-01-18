import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useActiveContext } from '../../../features/context/ActiveContextState.js';
import { ModeConfidenceDisplay } from './ModeConfidenceDisplay.js';

export function ContextSection() {
  const { 
    currentPersona, 
    activeSkills, 
    activeTools, 
    activeHooks,
    activeMcpServers,
    activePrompts,
    currentMode,
    allowedTools,
    modeIcon,
    modeColor,
    currentModeConfidence,
    modeDuration,
    suggestedModes,
  } = useActiveContext();

  // State for transition animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [previousMode, setPreviousMode] = useState(currentMode);

  // Handle mode transition animation
  useEffect(() => {
    if (currentMode !== previousMode) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setPreviousMode(currentMode);
      }, 500); // Animation duration
      return () => clearTimeout(timer);
    }
  }, [currentMode, previousMode]);

  // Get mode display name
  const getModeDisplayName = (mode: string): string => {
    const names: Record<string, string> = {
      assistant: 'Assistant',
      planning: 'Planning',
      developer: 'Developer',
      tool: 'Tool',
      debugger: 'Debugger',
      security: 'Security',
      reviewer: 'Reviewer',
      performance: 'Performance'
    };
    return names[mode] || mode;
  };

  return (
    <Box flexDirection="column" width="100%">
      {/* Mode Confidence Display */}
      <Box marginBottom={1}>
        <ModeConfidenceDisplay
          currentMode={currentMode}
          currentModeIcon={modeIcon}
          currentModeConfidence={currentModeConfidence}
          modeDuration={modeDuration}
          suggestedModes={suggestedModes}
        />
      </Box>
      
      {/* Divider */}
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(60)}</Text>
      </Box>
      
      <Box flexDirection="row" width="100%">
      {/* Left Column */}
      <Box flexDirection="column" flexGrow={1} width="50%" paddingRight={1}>
        {/* Current Mode */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="cyan" bold>Active Mode:</Text>
          <Box flexDirection="row" gap={1}>
            <Text>{modeIcon}</Text>
            <Text color={modeColor as any} bold={isTransitioning}>
              {getModeDisplayName(currentMode)}
              {isTransitioning && ' ⟳'}
            </Text>
          </Box>
        </Box>

        {/* Persona */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="blue" bold>Persona:</Text>
          <Text>{currentPersona}</Text>
        </Box>

        {/* Prompts */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="red" bold>Active Prompts:</Text>
          {activePrompts.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            activePrompts.map((prompt: string) => (
              <Text key={prompt}>- {prompt}</Text>
            ))
          )}
        </Box>

        {/* Skills */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="green" bold>Active Skills:</Text>
          {activeSkills.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            activeSkills.map((skill: string) => (
              <Text key={skill}>- {skill}</Text>
            ))
          )}
        </Box>

        {/* Allowed Tools for Current Mode */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="yellow" bold>Allowed Tools:</Text>
          {allowedTools.length === 0 ? (
            <Text dimColor>None (read-only mode)</Text>
          ) : allowedTools.includes('*') ? (
            <Text color="green">All tools available</Text>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>({allowedTools.length} tools)</Text>
              {allowedTools.slice(0, 5).map((tool: string) => (
                <Text key={tool} dimColor>- {tool}</Text>
              ))}
              {allowedTools.length > 5 && (
                <Text dimColor>... and {allowedTools.length - 5} more</Text>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Right Column */}
      <Box flexDirection="column" flexGrow={1} width="50%" paddingLeft={1}>
        {/* MCP */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="magenta" bold>MCP Servers:</Text>
          {activeMcpServers.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            activeMcpServers.map((server: string) => (
              <Text key={server}>- {server}</Text>
            ))
          )}
        </Box>

        {/* Hooks */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="cyan" bold>Active Hooks:</Text>
          {activeHooks.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            activeHooks.map((hook: string) => (
              <Text key={hook}>- {hook}</Text>
            ))
          )}
        </Box>

        {/* Active Tools (from tool registry) */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="yellow" bold>Registered Tools:</Text>
          {activeTools.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            <Box flexDirection="column">
              <Text dimColor>({activeTools.length} total)</Text>
              {activeTools.slice(0, 3).map((tool: string) => (
                <Text key={tool} dimColor>- {tool}</Text>
              ))}
              {activeTools.length > 3 && (
                <Text dimColor>... and {activeTools.length - 3} more</Text>
              )}
            </Box>
          )}
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
