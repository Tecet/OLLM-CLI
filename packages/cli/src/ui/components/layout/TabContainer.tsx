/**
 * Standard tab container component
 * 
 * Provides a consistent wrapper for tab content with:
 * - Focus-aware border styling
 * - Consistent padding and layout
 * - Optional title and help text
 * - Keyboard navigation integration
 * 
 * @example
 * ```typescript
 * <TabContainer
 *   focusId="tools-panel"
 *   title="Tools Configuration"
 *   height={20}
 *   width={80}
 *   theme={theme}
 * >
 *   <ToolsPanel />
 * </TabContainer>
 * ```
 */

import React from 'react';
import { Box, Text } from 'ink';

import { useFocusedBorder } from '../../hooks/useFocusedBorder.js';
import type { FocusableId } from '../../../features/context/FocusContext.js';

import type { Theme } from '../../../config/types.js';

export interface TabContainerProps {
  /** Focus ID for this tab */
  focusId: FocusableId;
  /** Tab content */
  children: React.ReactNode;
  /** Optional title displayed at the top */
  title?: string;
  /** Optional help text displayed below title */
  helpText?: string;
  /** Container height */
  height?: number;
  /** Container width */
  width?: number;
  /** Theme for styling */
  theme: Theme;
  /** Whether to show border (default: true) */
  showBorder?: boolean;
  /** Custom border color (overrides focus-based color) */
  borderColor?: string;
  /** Padding inside the container (default: 1) */
  padding?: number;
}

/**
 * Standard tab container with focus-aware styling
 * 
 * Features:
 * - Automatic border color based on focus state
 * - Optional title and help text
 * - Consistent padding and layout
 * - Theme-aware styling
 */
export const TabContainer: React.FC<TabContainerProps> = ({
  focusId,
  children,
  title,
  helpText,
  height,
  width,
  theme,
  showBorder = true,
  borderColor,
  padding = 1,
}) => {
  // Get focus-aware border color
  const focusedBorderColor = useFocusedBorder(focusId);
  const finalBorderColor = borderColor || focusedBorderColor;

  return (
    <Box
      flexDirection="column"
      height={height}
      width={width}
      borderStyle={showBorder ? 'single' : undefined}
      borderColor={finalBorderColor}
      padding={padding}
    >
      {/* Title */}
      {title && (
        <Box marginBottom={1}>
          <Text bold color={theme.text.primary}>
            {title}
          </Text>
        </Box>
      )}

      {/* Help Text */}
      {helpText && (
        <Box marginBottom={1}>
          <Text color={theme.text.secondary}>{helpText}</Text>
        </Box>
      )}

      {/* Content */}
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
};
