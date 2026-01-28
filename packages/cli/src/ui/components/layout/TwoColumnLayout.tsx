/**
 * Reusable two-column layout component
 *
 * Provides a standardized two-column layout used across multiple tabs
 * (HooksTab, MCPTab, SearchTab, SettingsTab). Handles width calculations
 * and consistent styling.
 *
 * @example
 * ```typescript
 * <TwoColumnLayout
 *   leftColumn={<HooksList />}
 *   rightColumn={<HookDetails />}
 *   leftWidth={30}
 *   height={20}
 *   theme={theme}
 * />
 * ```
 */

import React from 'react';
import { Box } from 'ink';

import type { Theme } from '../../../config/types.js';

export interface TwoColumnLayoutProps {
  /** Content for the left column */
  leftColumn: React.ReactNode;
  /** Content for the right column */
  rightColumn: React.ReactNode;
  /** Width percentage for left column (0-100, default: 30) */
  leftWidth?: number;
  /** Total height of the layout */
  height?: number;
  /** Total width of the layout */
  width?: number;
  /** Theme for styling */
  theme: Theme;
  /** Border color for left column */
  leftBorderColor?: string;
  /** Border color for right column */
  rightBorderColor?: string;
  /** Whether to show borders (default: true) */
  showBorders?: boolean;
  /** Gap between columns (default: 0) */
  gap?: number;
}

/**
 * Two-column layout component with configurable widths
 *
 * Features:
 * - Percentage-based width for left column
 * - Automatic right column width calculation
 * - Optional borders with theme colors
 * - Configurable gap between columns
 * - Responsive to terminal size
 */
export const TwoColumnLayout: React.FC<TwoColumnLayoutProps> = ({
  leftColumn,
  rightColumn,
  leftWidth = 30,
  height,
  width,
  theme,
  leftBorderColor,
  rightBorderColor,
  showBorders = true,
  gap = 0,
}) => {
  // Calculate column widths
  const leftColumnWidth = width ? Math.floor((width * leftWidth) / 100) : undefined;
  const rightColumnWidth = width && leftColumnWidth ? width - leftColumnWidth - gap : undefined;

  // Default border colors from theme
  const leftBorder = leftBorderColor || theme.border.primary;
  const rightBorder = rightBorderColor || theme.border.primary;

  return (
    <Box flexDirection="row" height={height} width={width}>
      {/* Left Column */}
      <Box
        width={leftColumnWidth}
        flexDirection="column"
        borderStyle={showBorders ? 'single' : undefined}
        borderColor={leftBorder}
      >
        {leftColumn}
      </Box>

      {/* Gap */}
      {gap > 0 && <Box width={gap} />}

      {/* Right Column */}
      <Box
        width={rightColumnWidth}
        flexDirection="column"
        borderStyle={showBorders ? 'single' : undefined}
        borderColor={rightBorder}
      >
        {rightColumn}
      </Box>
    </Box>
  );
};
