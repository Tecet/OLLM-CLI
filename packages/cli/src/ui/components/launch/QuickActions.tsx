import React from 'react';
import { Box, Text } from 'ink';

interface QuickActionsProps {
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

export const QuickActions: React.FC<QuickActionsProps> = ({ theme }) => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color={theme.text.accent}>
        Quick Actions
      </Text>

      <Box flexDirection="column" paddingLeft={2}>
        <Text color={theme.text.primary}>
          • Type{' '}
          <Text bold color={theme.text.accent}>
            /help
          </Text>{' '}
          for available commands
        </Text>
        <Text color={theme.text.primary}>
          • Press{' '}
          <Text bold color={theme.text.accent}>
            Ctrl+6
          </Text>{' '}
          for settings
        </Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor color={theme.text.secondary}>
          Press any key to continue...
        </Text>
      </Box>
    </Box>
  );
};
