import React from 'react';
import { Box, useInput, useStdout } from 'ink';
import { LlamaAnimation } from '../../../components/lama/LlamaAnimation.js';
import { VersionBanner } from './VersionBanner.js';
import { QuickActions } from './QuickActions.js';
import { RecentSessions } from './RecentSessions.js';
import type { Theme } from '../../../../config/types.js';

interface Session {
  id: string;
  timestamp: Date;
  messageCount: number;
}

interface LaunchScreenProps {
  onDismiss: () => void;
  recentSessions?: Session[];
  theme: Theme;
  modelInfo?: {
    name: string;
    size?: string;
  };
  gpuInfo?: {
    name: string;
    vram: string;
    utilization?: string;
  };
}

// Standard animation uses 24 lines height (matches LlamaAnimation logicalHeight for 'standard' size)
const STANDARD_ANIMATION_HEIGHT = 24;

// Fixed layout constants - these don't change with terminal size
const LAYOUT = {
  topPadding: 3,        // Lines from top to banner
  afterBanner: 2,       // Lines between banner and quick actions  
  afterQuickActions: 3, // Lines between quick actions and animation area
};

const LaunchHeader = React.memo(({ theme, modelInfo, gpuInfo }: { theme: LaunchScreenProps['theme'], modelInfo: LaunchScreenProps['modelInfo'], gpuInfo: LaunchScreenProps['gpuInfo'] }) => (
  <Box flexDirection="column" alignItems="center" width="100%">
    <Box marginTop={LAYOUT.topPadding}>
      <VersionBanner theme={theme} modelInfo={modelInfo} gpuInfo={gpuInfo} />
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
  modelInfo,
  gpuInfo,
}) => {
  // Handle any keypress to dismiss
  useInput((_input, _key) => {
    // Dismiss on any key press
    onDismiss();
  });

  const { stdout } = useStdout();
  const termHeight = stdout?.rows ?? 0;
  const rootHeight = termHeight > 0 ? termHeight : undefined;

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="flex-start"
      height={rootHeight}
      overflow="hidden"
    >
      <LaunchHeader theme={theme} modelInfo={modelInfo} gpuInfo={gpuInfo} />

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
