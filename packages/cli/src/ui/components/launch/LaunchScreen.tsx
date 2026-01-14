import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { LlamaAnimation } from '../../../components/lama/LlamaAnimation.js';
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
      error?: string; // Opt-in
    };
  };
}

const STANDARD_ANIMATION_HEIGHT = 20;
const STANDARD_ANIMATION_WIDTH = STANDARD_ANIMATION_HEIGHT * 2;

const LaunchHeader = React.memo(({ theme }: { theme: LaunchScreenProps['theme'] }) => (
  <Box flexDirection="column" alignItems="center" gap={1} width="100%">
    <VersionBanner theme={theme} />

    <Box flexDirection="column" alignItems="center">
      <Text color={theme.text.secondary}>Documentation: /docs</Text>
      <Text color={theme.text.secondary}>For commands use: /help</Text>
    </Box>

    <Box marginTop={1}>
      <QuickActions theme={theme} />
    </Box>
  </Box>
));
LaunchHeader.displayName = 'LaunchHeader';

const LaunchFooter = React.memo(
  ({ theme, recentSessions }: { theme: LaunchScreenProps['theme']; recentSessions: Session[] }) => (
    <Box flexDirection="column" alignItems="center" width="100%">
      {recentSessions.length > 0 && (
        <Box marginTop={2}>
          <RecentSessions sessions={recentSessions} theme={theme} />
        </Box>
      )}

      <Box marginTop={3}>
        <Text dimColor color={theme.text.secondary}>
          Press any key to continue...
        </Text>
      </Box>
    </Box>
  )
);
LaunchFooter.displayName = 'LaunchFooter';

export const LaunchScreen: React.FC<LaunchScreenProps> = ({
  onDismiss,
  recentSessions = [],
  theme,
}) => {
  // Handle any keypress to dismiss
  useInput((_input, _key) => {
    // Dismiss on any key press
    onDismiss();
  });

  const { stdout } = useStdout();
  const termWidth = stdout?.columns || 80;
  const termHeight = stdout?.rows ?? 0;
  const isCompact = termHeight > 0 && termHeight < 40;
  const rootHeight = termHeight > 0 ? termHeight : undefined;
  const animationOuterWidth = Math.max(2, Math.floor(termWidth * 0.7));
  const animationPadding = 2;
  const animationInnerWidth = Math.max(0, animationOuterWidth - 2 - animationPadding * 2);

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start"
      paddingY={isCompact ? 0 : 1}
      gap={isCompact ? 1 : 2}
      height={rootHeight}
      overflow="hidden"
    >
      <LaunchHeader theme={theme} />

      {/* Animation below the hero text */}
      <Box flexDirection="column" alignItems="center" width="100%">
        <Box
          width={animationOuterWidth}
          padding={animationPadding}
          borderStyle="single"
          borderColor={theme.text.accent}
          overflow="hidden"
          height={STANDARD_ANIMATION_HEIGHT + animationPadding * 2}
        >
          <Box
            width="100%"
            height={STANDARD_ANIMATION_HEIGHT}
            justifyContent="center"
            backgroundColor="#050505"
          >
            <LlamaAnimation size="standard" movementWidth={animationInnerWidth} />
          </Box>
        </Box>
      </Box>

      <LaunchFooter theme={theme} recentSessions={recentSessions} />
    </Box>
  );
};
