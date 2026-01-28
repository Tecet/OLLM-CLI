/**
 * MCPActions Component
 *
 * Displays available keyboard shortcuts in the footer of the MCP panel.
 * Shows context-sensitive actions based on the focused item and current state.
 *
 * Validates: Requirements 12.1-12.15, NFR-6
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface MCPActionsProps {
  /** Whether a server is currently focused */
  hasServerFocused?: boolean;
  /** Whether the focused server is expanded */
  isServerExpanded?: boolean;
  /** Whether the focused server is enabled */
  isServerEnabled?: boolean;
  /** Whether the focused server requires OAuth */
  requiresOAuth?: boolean;
  /** Whether we're in the marketplace view */
  inMarketplace?: boolean;
  /** Whether a dialog is currently open */
  dialogOpen?: boolean;
}

/**
 * Keyboard shortcut display component
 */
const Shortcut: React.FC<{ keys: string; description: string; dimmed?: boolean }> = ({
  keys,
  description,
  dimmed = false,
}) => (
  <Box marginRight={2}>
    <Text bold color={dimmed ? 'gray' : 'cyan'}>
      [{keys}]
    </Text>
    <Text dimColor={dimmed}> {description}</Text>
  </Box>
);

/**
 * MCPActions Component
 *
 * Displays keyboard shortcuts in a footer bar.
 * Shortcuts are context-sensitive based on the current focus and state.
 */
export const MCPActions: React.FC<MCPActionsProps> = ({
  hasServerFocused = false,
  isServerExpanded = false,
  isServerEnabled = false,
  requiresOAuth = false,
  inMarketplace = false,
  dialogOpen = false,
}) => {
  // If a dialog is open, show dialog-specific shortcuts
  if (dialogOpen) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
        marginTop={1}
      >
        <Box flexDirection="row" flexWrap="wrap">
          <Shortcut keys="Esc" description="Close" />
          <Shortcut keys="Tab" description="Next Field" />
          <Shortcut keys="Enter" description="Confirm" />
        </Box>
      </Box>
    );
  }

  // If in marketplace view, show marketplace-specific shortcuts
  if (inMarketplace) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
        marginTop={1}
      >
        <Box flexDirection="row" flexWrap="wrap">
          <Shortcut keys="↑↓" description="Navigate" />
          <Shortcut keys="/" description="Search" />
          <Shortcut keys="I" description="Install" />
          <Shortcut keys="Esc" description="Close" />
        </Box>
      </Box>
    );
  }

  // Main MCP panel shortcuts
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      marginTop={1}
    >
      {/* Navigation shortcuts - always visible */}
      <Box flexDirection="row" flexWrap="wrap">
        <Shortcut keys="↑↓" description="Navigate" />
        <Shortcut keys="←→" description="Toggle" dimmed={!hasServerFocused} />
        <Shortcut
          keys="Enter"
          description={isServerExpanded ? 'Collapse' : 'Expand'}
          dimmed={!hasServerFocused}
        />
        <Shortcut keys="Tab" description="Main Menu" />
        <Shortcut keys="?" description="Help" />
      </Box>

      {/* Server action shortcuts - context-sensitive */}
      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        <Shortcut keys="M" description="Marketplace" />
        <Shortcut keys="H" description="Health" />
        <Shortcut keys="V" description="View Tools" dimmed={!hasServerFocused} />
        <Shortcut keys="C" description="Configure" dimmed={!hasServerFocused} />
        <Shortcut keys="O" description="OAuth" dimmed={!hasServerFocused || !requiresOAuth} />
      </Box>

      {/* Server management shortcuts - context-sensitive */}
      <Box flexDirection="row" flexWrap="wrap" marginTop={0}>
        <Shortcut keys="R" description="Restart" dimmed={!hasServerFocused || !isServerEnabled} />
        <Shortcut keys="L" description="Logs" dimmed={!hasServerFocused} />
        <Shortcut keys="U" description="Uninstall" dimmed={!hasServerFocused} />
      </Box>
    </Box>
  );
};
