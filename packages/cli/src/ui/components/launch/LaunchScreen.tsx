import React, { useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LlamaAnimation } from '../../../components/LlamaAnimation.js';
import { VersionBanner } from './VersionBanner.js';
import { QuickActions } from './QuickActions.js';
import { RecentSessions } from './RecentSessions.js';

interface Session {
  id: string;
  timestamp: Date;
  messageCount: number;
}

interface LaunchScreenProps {
  onDismiss: () => void;
  recentSessions?: Session[];
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({
  onDismiss,
  recentSessions = [],
  theme,
}) => {
  // Handle any keypress to dismiss
  useInput((input, key) => {
    // Dismiss on any key press
    onDismiss();
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingY={2}
      gap={2}
    >
      {/* Llama Animation - Standard Size */}
      <Box>
        <LlamaAnimation size="standard" />
      </Box>

      {/* Version Banner */}
      <Box>
        <VersionBanner theme={theme} />
      </Box>

      {/* Quick Actions */}
      <Box marginTop={2}>
        <QuickActions theme={theme} />
      </Box>

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <Box marginTop={2}>
          <RecentSessions sessions={recentSessions} theme={theme} />
        </Box>
      )}

      {/* Footer hint */}
      <Box marginTop={2}>
        <Text dimColor color={theme.text.secondary}>
          Press any key to continue...
        </Text>
      </Box>
    </Box>
  );
};
