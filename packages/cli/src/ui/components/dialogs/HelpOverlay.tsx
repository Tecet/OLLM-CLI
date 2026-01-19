/**
 * HelpOverlay Component
 * 
 * Displays comprehensive help information for the MCP Panel UI.
 * Shows keyboard shortcuts, navigation instructions, and feature descriptions.
 * 
 * Triggered by pressing '?' key in the MCP panel.
 * 
 * Validates: NFR-9
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Dialog } from './Dialog.js';

export interface HelpOverlayProps {
  /** Callback when help overlay is closed */
  onClose: () => void;
  /** Current context (main panel, marketplace, dialog) */
  context?: 'main' | 'marketplace' | 'dialog';
}

/**
 * Help section component
 */
const HelpSection: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Box flexDirection="column" marginY={1}>
    <Text bold color="cyan">
      {title}
    </Text>
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      {children}
    </Box>
  </Box>
);

/**
 * Help item component
 */
const HelpItem: React.FC<{ keys: string; description: string }> = ({
  keys,
  description,
}) => (
  <Box marginY={0}>
    <Box width={20}>
      <Text bold color="yellow">
        {keys}
      </Text>
    </Box>
    <Text dimColor>{description}</Text>
  </Box>
);

/**
 * HelpOverlay Component
 * 
 * Displays context-sensitive help information.
 */
export const HelpOverlay: React.FC<HelpOverlayProps> = ({
  onClose,
  context = 'main',
}) => {
  return (
    <Dialog
      title="MCP Panel Help"
      onClose={onClose}
      width={80}
    >
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {/* Main Panel Help */}
        {context === 'main' && (
          <>
            <HelpSection title="Navigation">
              <HelpItem keys="↑ / ↓" description="Navigate between servers" />
              <HelpItem keys="← / →" description="Toggle server enabled/disabled" />
              <HelpItem keys="Enter" description="Expand/collapse server details" />
              <HelpItem keys="Tab" description="Return to main navigation bar" />
              <HelpItem keys="Esc / 0" description="Exit to Browse Mode (auto-saves changes)" />
            </HelpSection>

            <HelpSection title="Server Management">
              <HelpItem keys="C" description="Configure server settings" />
              <HelpItem keys="R" description="Restart server" />
              <HelpItem keys="U" description="Uninstall server" />
              <HelpItem keys="V" description="View and manage server tools" />
              <HelpItem keys="L" description="View server logs" />
            </HelpSection>

            <HelpSection title="OAuth & Authentication">
              <HelpItem keys="O" description="Configure OAuth settings" />
              <Text dimColor marginLeft={2}>
                • Authorize with external services
              </Text>
              <Text dimColor marginLeft={2}>
                • Refresh expired tokens
              </Text>
              <Text dimColor marginLeft={2}>
                • Revoke access
              </Text>
            </HelpSection>

            <HelpSection title="Monitoring & Troubleshooting">
              <HelpItem keys="H" description="Open health monitor" />
              <Text dimColor marginLeft={2}>
                • View server health status
              </Text>
              <Text dimColor marginLeft={2}>
                • Configure auto-restart
              </Text>
              <Text dimColor marginLeft={2}>
                • Check response times
              </Text>
            </HelpSection>

            <HelpSection title="Marketplace">
              <HelpItem keys="M" description="Browse and install servers" />
              <Text dimColor marginLeft={2}>
                • Search available servers
              </Text>
              <Text dimColor marginLeft={2}>
                • View ratings and install counts
              </Text>
              <Text dimColor marginLeft={2}>
                • Install with guided configuration
              </Text>
            </HelpSection>

            <HelpSection title="Server Status Indicators">
              <Box flexDirection="column" marginLeft={2}>
                <Box marginY={0}>
                  <Text color="green">● Healthy</Text>
                  <Text dimColor> - Server running normally</Text>
                </Box>
                <Box marginY={0}>
                  <Text color="yellow">⚠ Degraded</Text>
                  <Text dimColor> - Slow response or rate limited</Text>
                </Box>
                <Box marginY={0}>
                  <Text color="red">✗ Unhealthy</Text>
                  <Text dimColor> - Server error or not responding</Text>
                </Box>
                <Box marginY={0}>
                  <Text color="gray">○ Stopped</Text>
                  <Text dimColor> - Server disabled by user</Text>
                </Box>
                <Box marginY={0}>
                  <Text color="blue">⟳ Connecting</Text>
                  <Text dimColor> - Server starting up</Text>
                </Box>
              </Box>
            </HelpSection>

            <HelpSection title="Tips">
              <Text dimColor marginLeft={2}>
                • Changes to server settings are saved immediately
              </Text>
              <Text dimColor marginLeft={2}>
                • Use left/right arrows for quick enable/disable
              </Text>
              <Text dimColor marginLeft={2}>
                • Expand servers to see detailed statistics
              </Text>
              <Text dimColor marginLeft={2}>
                • OAuth tokens are encrypted and stored securely
              </Text>
              <Text dimColor marginLeft={2}>
                • Press ? anytime to show this help
              </Text>
            </HelpSection>
          </>
        )}

        {/* Marketplace Help */}
        {context === 'marketplace' && (
          <>
            <HelpSection title="Marketplace Navigation">
              <HelpItem keys="↑ / ↓" description="Navigate server list" />
              <HelpItem keys="/" description="Focus search box" />
              <HelpItem keys="I" description="Install selected server" />
              <HelpItem keys="Esc" description="Close marketplace" />
            </HelpSection>

            <HelpSection title="Server Information">
              <Text dimColor marginLeft={2}>
                • ★ Rating - User ratings (1-5 stars)
              </Text>
              <Text dimColor marginLeft={2}>
                • Install count - Number of installations
              </Text>
              <Text dimColor marginLeft={2}>
                • 🔐 OAuth required - Needs authentication
              </Text>
              <Text dimColor marginLeft={2}>
                • Requirements - System dependencies
              </Text>
            </HelpSection>

            <HelpSection title="Installation">
              <Text dimColor marginLeft={2}>
                1. Select a server from the list
              </Text>
              <Text dimColor marginLeft={2}>
                2. Press 'I' to open installation dialog
              </Text>
              <Text dimColor marginLeft={2}>
                3. Configure required settings (API keys, etc.)
              </Text>
              <Text dimColor marginLeft={2}>
                4. Choose auto-approve options
              </Text>
              <Text dimColor marginLeft={2}>
                5. Confirm installation
              </Text>
            </HelpSection>
          </>
        )}

        {/* Dialog Help */}
        {context === 'dialog' && (
          <>
            <HelpSection title="Dialog Navigation">
              <HelpItem keys="Tab" description="Move to next field" />
              <HelpItem keys="Shift+Tab" description="Move to previous field" />
              <HelpItem keys="Enter" description="Confirm/Submit" />
              <HelpItem keys="Esc" description="Cancel and close" />
            </HelpSection>

            <HelpSection title="Form Fields">
              <Text dimColor marginLeft={2}>
                • Required fields are marked with *
              </Text>
              <Text dimColor marginLeft={2}>
                • Help text appears below each field
              </Text>
              <Text dimColor marginLeft={2}>
                • Validation errors shown in red
              </Text>
              <Text dimColor marginLeft={2}>
                • Secret fields (API keys) are masked
              </Text>
            </HelpSection>
          </>
        )}

        {/* Close instruction */}
        <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
          <Text dimColor>Press Esc or ? to close this help</Text>
        </Box>
      </Box>
    </Dialog>
  );
};
