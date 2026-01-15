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

// Standard animation uses 24 lines height (matches LlamaAnimation logicalHeight for 'standard' size)
const STANDARD_ANIMATION_HEIGHT = 24;
const STANDARD_ANIMATION_WIDTH = STANDARD_ANIMATION_HEIGHT * 2;

// Fixed layout constants - these don't change with terminal size
const LAYOUT = {
  topPadding: 3,        // Lines from top to banner
  afterBanner: 2,       // Lines between banner and quick actions  
  afterQuickActions: 3, // Lines between quick actions and animation area
};

const LaunchHeader = React.memo(({ theme }: { theme: LaunchScreenProps['theme'] }) => (
  <Box flexDirection="column" alignItems="center" width="100%">
    <Box marginTop={LAYOUT.topPadding}>
      <VersionBanner theme={theme} />
    </Box>

    <Box marginTop={LAYOUT.afterBanner}>
      <QuickActions theme={theme} />
    </Box>
  </Box>
));
LaunchHeader.displayName = 'LaunchHeader';

const LaunchFooter = React.memo(
  ({ theme, recentSessions }: { theme: LaunchScreenProps['theme']; recentSessions: Session[] }) => (
    <Box flexDirection="column" alignItems="center" width="100%">
      {recentSessions.length > 0 && (
        <Box marginTop={1}>
          <RecentSessions sessions={recentSessions} theme={theme} />
        </Box>
      )}
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
  
  // Animation sprite is 48 chars wide (24 lines * 2), need space for movement
  // Use 80% of terminal width but ensure at least sprite width + some movement room
  const minAnimationWidth = STANDARD_ANIMATION_WIDTH + 20; // sprite + minimal movement
  const animationWidth = Math.max(minAnimationWidth, Math.floor(termWidth * 0.8));

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start"
      height={rootHeight}
      overflow="hidden"
    >
      <LaunchHeader theme={theme} />

      <LaunchFooter theme={theme} recentSessions={recentSessions} />

      {/* Animation at the bottom - fixed position from content */}
      <Box flexDirection="column" alignItems="center" width="100%" marginTop={LAYOUT.afterQuickActions}>
        <Box height={STANDARD_ANIMATION_HEIGHT} justifyContent="center">
          <LlamaAnimation size="standard" movementRatio={0.85} enabled />
        </Box>
      </Box>
    </Box>
  );
};
