import { Box, Text, BoxProps } from 'ink';

import { Theme } from '../../../config/types.js';

export interface StatusBarProps {
  connection: {
    status: 'connected' | 'disconnected';
    provider: string;
  };
  model: string;
  theme: Theme;
  height?: number;
}

/**
 * StatusBar - Shows Ollama connection status and current model
 * Displays: [ ● ollama | LLM: llama3.2:3b ]
 */
export function StatusBar({ connection, model, theme, height = 1 }: StatusBarProps) {
  const connectionIndicator = connection.status === 'connected' ? '●' : '○';
  const connectionColor = connection.status === 'connected' ? 'green' : 'red';
  const providerText = connection.provider || 'ollama';

  return (
    <Box
      height={height}
      width="100%"
      borderStyle={theme.border.style as BoxProps['borderStyle']}
      borderColor={theme.border.primary}
      paddingX={1}
      alignItems="center"
      justifyContent="flex-start"
    >
      <Text color={connectionColor}>{connectionIndicator}</Text>
      <Text> </Text>
      <Text color={theme.text.primary}>{providerText}</Text>
      <Text color={theme.text.secondary}> | </Text>
      <Text color={theme.text.secondary}>LLM: </Text>
      <Text color={theme.text.accent}>{model || 'none'}</Text>
    </Box>
  );
}
