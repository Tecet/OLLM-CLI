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
          • Press <Text bold color={theme.text.accent}>any key</Text> to start chatting
        </Text>
        <Text color={theme.text.primary}>
          • Type <Text bold color={theme.text.accent}>/help</Text> for available commands
        </Text>
        <Text color={theme.text.primary}>
          • Press <Text bold color={theme.text.accent}>Ctrl+5</Text> to view documentation
        </Text>
        <Text color={theme.text.primary}>
          • Press <Text bold color={theme.text.accent}>Ctrl+6</Text> for settings
        </Text>
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor color={theme.text.secondary}>
          Documentation: docs/README.md
        </Text>
      </Box>
    </Box>
  );
};
