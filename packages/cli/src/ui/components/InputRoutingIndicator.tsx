import React from 'react';
import { Box, Text } from 'ink';

import type { Theme } from '../../config/types.js';
import type { InputDestination } from '../contexts/InputRoutingContext.js';

interface InputRoutingIndicatorProps {
  activeDestination: InputDestination;
  theme: Theme;
}

export function InputRoutingIndicator({ activeDestination, theme }: InputRoutingIndicatorProps) {
  const destinations: Array<{ id: InputDestination; label: string }> = [
    { id: 'llm', label: 'LLM' },
    { id: 'editor', label: 'E' },
    { id: 'terminal1', label: 'T1' },
    { id: 'terminal2', label: 'T2' },
  ];

  return (
    <Box flexDirection="row" gap={1} paddingX={1}>
      <Text color={theme.text.secondary}>[</Text>
      {destinations.map((dest, index) => (
        <React.Fragment key={dest.id}>
          {index > 0 && <Text color={theme.text.secondary}> | </Text>}
          <Text
            color={activeDestination === dest.id ? theme.text.accent : theme.text.secondary}
            bold={activeDestination === dest.id}
          >
            {activeDestination === dest.id ? '●' : ''}
            {dest.label}
          </Text>
        </React.Fragment>
      ))}
      <Text color={theme.text.secondary}>]</Text>
    </Box>
  );
}
