/**
 * HookApprovalDialog - Prompts user to approve untrusted hooks
 * 
 * Displays hook details, source information, and allows user to approve or deny
 * hook execution. Integrates with TrustedHooks system for security.
 */

import React, { useState } from 'react';
import { Box, Text } from 'ink';
import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';
import { Theme } from '../../../config/types.js';

export interface HookApprovalDialogProps {
  /** The hook requesting approval */
  hook: Hook;
  /** Hash of the hook script */
  hash: string;
  /** Theme for styling */
  theme: Theme;
  /** Callback when user approves */
  onApprove: () => void;
  /** Callback when user denies */
  onDeny: () => void;
  /** Whether dialog is visible */
  visible: boolean;
}

/**
 * Dialog for approving untrusted hooks
 */
export function HookApprovalDialog({
  hook,
  hash,
  theme,
  onApprove,
  onDeny,
  visible,
}: HookApprovalDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'approve' | 'deny'>('deny');

  if (!visible) {
    return null;
  }

  // Determine source description
  const sourceDescription = (() => {
    switch (hook.source) {
      case 'workspace':
        return 'Workspace Hook (from .ollm/extensions/)';
      case 'downloaded':
        return 'Downloaded Extension';
      case 'user':
        return 'User Hook (from ~/.ollm/extensions/)';
      case 'builtin':
        return 'Built-in Hook';
      default:
        return 'Unknown Source';
    }
  })();

  // Determine risk level
  const riskLevel = hook.source === 'downloaded' ? 'HIGH' : 'MEDIUM';
  const riskColor = riskLevel === 'HIGH' ? theme.status.error : theme.status.warning;

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={theme.text.accent}
      padding={1}
      width="80%"
    >
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          🔒 Hook Approval Required
        </Text>
      </Box>

      {/* Warning */}
      <Box marginBottom={1}>
        <Text color={riskColor}>
          ⚠️  This hook requires your approval before it can execute.
        </Text>
      </Box>

      {/* Hook Details */}
      <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
        <Box>
          <Text color={theme.text.secondary}>Name: </Text>
          <Text color={theme.text.primary} bold>
            {hook.name}
          </Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Source: </Text>
          <Text color={theme.text.primary}>{sourceDescription}</Text>
        </Box>

        {hook.extensionName && (
          <Box>
            <Text color={theme.text.secondary}>Extension: </Text>
            <Text color={theme.text.primary}>{hook.extensionName}</Text>
          </Box>
        )}

        <Box>
          <Text color={theme.text.secondary}>Command: </Text>
          <Text color={theme.text.primary}>{hook.command}</Text>
        </Box>

        {hook.args && hook.args.length > 0 && (
          <Box>
            <Text color={theme.text.secondary}>Arguments: </Text>
            <Text color={theme.text.primary}>{hook.args.join(' ')}</Text>
          </Box>
        )}

        <Box>
          <Text color={theme.text.secondary}>Risk Level: </Text>
          <Text color={riskColor} bold>
            {riskLevel}
          </Text>
        </Box>

        <Box>
          <Text color={theme.text.secondary}>Hash: </Text>
          <Text color={theme.text.secondary} dimColor>
            {hash.substring(0, 16)}...
          </Text>
        </Box>
      </Box>

      {/* Security Notice */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.secondary}
        padding={1}
        marginBottom={1}
      >
        <Text color={theme.status.warning} bold>
          Security Notice:
        </Text>
        <Text color={theme.text.secondary}>
          • Hooks can execute arbitrary commands on your system
        </Text>
        <Text color={theme.text.secondary}>
          • Only approve hooks from sources you trust
        </Text>
        <Text color={theme.text.secondary}>
          • Approval is stored and won't be asked again unless the hook changes
        </Text>
      </Box>

      {/* Options */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text color={theme.text.secondary}>Do you want to approve this hook?</Text>
        </Box>

        <Box marginTop={1} paddingLeft={2}>
          <Box marginRight={4}>
            <Text
              color={
                selectedOption === 'approve'
                  ? theme.text.accent
                  : theme.text.secondary
              }
              bold={selectedOption === 'approve'}
            >
              {selectedOption === 'approve' ? '▶' : ' '} [A] Approve
            </Text>
          </Box>

          <Box>
            <Text
              color={
                selectedOption === 'deny' ? theme.text.accent : theme.text.secondary
              }
              bold={selectedOption === 'deny'}
            >
              {selectedOption === 'deny' ? '▶' : ' '} [D] Deny
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Instructions */}
      <Box>
        <Text color={theme.text.secondary} dimColor>
          Press A to approve, D to deny, or Esc to cancel
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Hook approval dialog with keyboard input handling
 */
export function HookApprovalDialogWithInput({
  hook,
  hash,
  theme,
  onApprove,
  onDeny,
  visible,
}: HookApprovalDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'approve' | 'deny'>('deny');

  // Handle keyboard input
  const handleInput = (input: string, key: any) => {
    if (!visible) return;

    if (key.escape) {
      onDeny();
      return;
    }

    const lowerInput = input.toLowerCase();

    if (lowerInput === 'a') {
      setSelectedOption('approve');
      onApprove();
    } else if (lowerInput === 'd') {
      setSelectedOption('deny');
      onDeny();
    } else if (key.return) {
      // Enter key confirms current selection
      if (selectedOption === 'approve') {
        onApprove();
      } else {
        onDeny();
      }
    } else if (key.upArrow || key.leftArrow) {
      setSelectedOption('approve');
    } else if (key.downArrow || key.rightArrow) {
      setSelectedOption('deny');
    }
  };

  // Note: Input handling would be integrated with Ink's useInput hook
  // in the parent component that renders this dialog

  return (
    <HookApprovalDialog
      hook={hook}
      hash={hash}
      theme={theme}
      onApprove={onApprove}
      onDeny={onDeny}
      visible={visible}
    />
  );
}
