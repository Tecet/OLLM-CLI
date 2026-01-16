import React from 'react';
import { Box, Text } from 'ink';
import { useActiveContext } from '../../../features/context/ActiveContextState.js';

export function ContextSection() {
  const { 
    currentPersona, 
    activeSkills, 
    activeTools, 
    activeHooks,
    activeMcpServers,
    activePrompts,
  } = useActiveContext();

  return (
    <Box flexDirection="row" width="100%">
      {/* Left Column */}
      <Box flexDirection="column" flexGrow={1} width="50%" paddingRight={1}>
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

        {/* Tools */}
        <Box marginBottom={1} flexDirection="column">
          <Text color="yellow" bold>Active Tools:</Text>
          {activeTools.length === 0 ? (
            <Text dimColor>None</Text>
          ) : (
            activeTools.map((tool: string) => (
              <Text key={tool}>- {tool}</Text>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}
