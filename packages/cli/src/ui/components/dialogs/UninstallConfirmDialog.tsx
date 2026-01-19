/**
 * UninstallConfirmDialog - Confirmation dialog for uninstalling MCP servers
 * 
 * Features:
 * - Display server name and warning message
 * - Warn that action is permanent
 * - List what will be removed (config, OAuth tokens, logs)
 * - Confirm and Cancel buttons
 * - Prevent accidental uninstallation
 * 
 * Validates: Requirements 11.1-11.7
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Dialog } from './Dialog.js';
import { Button, ButtonGroup } from '../forms/Button.js';

export interface UninstallConfirmDialogProps {
  /** Name of the server to uninstall */
  serverName: string;
  /** Whether the server has OAuth tokens configured */
  hasOAuthTokens?: boolean;
  /** Whether the server has logs */
  hasLogs?: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when uninstall is confirmed */
  onConfirm: (serverName: string) => Promise<void>;
}

/**
 * UninstallConfirmDialog component
 * 
 * Provides a confirmation dialog for uninstalling MCP servers:
 * - Clear warning that action is permanent
 * - List of what will be removed
 * - Confirmation and cancellation options
 * - Loading state during uninstallation
 * - Error handling
 */
export function UninstallConfirmDialog({
  serverName,
  hasOAuthTokens = false,
  hasLogs = false,
  onClose,
  onConfirm,
}: UninstallConfirmDialogProps) {
  const [isUninstalling, setIsUninstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle uninstall confirmation
   */
  const handleConfirm = useCallback(async () => {
    setIsUninstalling(true);
    setError(null);

    try {
      await onConfirm(serverName);
      // Close dialog after successful uninstall
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall server');
      setIsUninstalling(false);
    }
  }, [serverName, onConfirm, onClose]);

  return (
    <Dialog
      title="Confirm Uninstall"
      onClose={onClose}
      width={70}
      borderColor="red"
      titleColor="red"
    >
      <Box flexDirection="column" paddingX={1}>
        {/* Warning Message */}
        <Box flexDirection="column" marginBottom={2}>
          <Text bold color="red">⚠ Warning: This action is permanent!</Text>
          <Text dimColor>
            You are about to uninstall the following MCP server:
          </Text>
        </Box>

        {/* Server Name */}
        <Box marginBottom={2} paddingX={2}>
          <Text bold color="yellow">{serverName}</Text>
        </Box>

        {/* What Will Be Removed */}
        <Box flexDirection="column" marginBottom={2}>
          <Text bold>The following will be removed:</Text>
          
          <Box flexDirection="column" marginTop={1} marginLeft={2}>
            {/* Server Configuration */}
            <Box>
              <Text color="red">✗ </Text>
              <Text>Server configuration from mcp.json</Text>
            </Box>

            {/* OAuth Tokens */}
            {hasOAuthTokens && (
              <Box>
                <Text color="red">✗ </Text>
                <Text>OAuth tokens and authentication data</Text>
              </Box>
            )}

            {/* Server Logs */}
            {hasLogs && (
              <Box>
                <Text color="red">✗ </Text>
                <Text>Server logs and diagnostic data</Text>
              </Box>
            )}

            {/* Auto-approve Settings */}
            <Box>
              <Text color="red">✗ </Text>
              <Text>Tool auto-approve settings</Text>
            </Box>

            {/* Environment Variables */}
            <Box>
              <Text color="red">✗ </Text>
              <Text>Environment variables and credentials</Text>
            </Box>
          </Box>
        </Box>

        {/* Additional Warning */}
        <Box
          marginBottom={2}
          borderStyle="single"
          borderColor="yellow"
          padding={1}
        >
          <Box flexDirection="column">
            <Text color="yellow">⚠ Important Notes:</Text>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>• The server will be stopped before removal</Text>
              <Text dimColor>• This action cannot be undone</Text>
              <Text dimColor>• You can reinstall the server later from the marketplace</Text>
              <Text dimColor>• Reinstalling will require reconfiguration</Text>
            </Box>
          </Box>
        </Box>

        {/* Error Message */}
        {error && (
          <Box marginBottom={2}>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}

        {/* Action Buttons */}
        <Box marginTop={1} gap={2}>
          <ButtonGroup
            buttons={[
              {
                label: 'Confirm Uninstall',
                onPress: handleConfirm,
                variant: 'danger',
                loading: isUninstalling,
                disabled: isUninstalling,
                shortcut: 'Enter',
                icon: '✗',
              },
              {
                label: 'Cancel',
                onPress: onClose,
                variant: 'secondary',
                disabled: isUninstalling,
                shortcut: 'Esc',
              },
            ]}
          />
        </Box>

        {/* Help Text */}
        <Box marginTop={2}>
          <Text dimColor>
            💡 Tip: Press Esc to cancel or Enter to confirm uninstall
          </Text>
        </Box>
      </Box>
    </Dialog>
  );
}
