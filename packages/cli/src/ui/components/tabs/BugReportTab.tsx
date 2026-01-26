import { exec } from 'child_process';

import { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useTabEscapeHandler } from '../../hooks/useTabEscapeHandler.js';

export interface BugReportTabProps {
  width?: number;
}

type Platform = 'discord' | 'github';
type ConfirmSelection = 'yes' | 'no';

/**
 * BugReportTab component
 * 
 * Provides users with information and links to report bugs via Discord or GitHub.
 * Includes guidelines for effective bug reporting and platform selection.
 */
export function BugReportTab({ width }: BugReportTabProps) {
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('discord');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmSelection, setConfirmSelection] = useState<ConfirmSelection>('yes');
  
  // Check if this tab has focus
  const hasFocus = isFocused('bug-report-tab');
  
  // Use shared escape handler for consistent navigation
  useTabEscapeHandler(hasFocus);

  // Helper function to open URLs
  const openURL = (url: string) => {
    const command = 
      process.platform === 'win32' ? `start "" "${url}"` :
      process.platform === 'darwin' ? `open "${url}"` :
      `xdg-open "${url}"`;
      
    exec(command, (error: Error | null) => {
      if (error) {
        console.error(`Failed to open URL: ${error.message}`);
      }
    });
  };

  /**
   * Keyboard Navigation
   * 
   * Navigation Keys:
   * - ↑/↓: Navigate between Discord and GitHub (main screen)
   * - ←/→: Navigate between Yes and No (confirmation dialog)
   * - Enter: Open selected platform or confirm action
   * - ESC/0: Exit to nav bar or close dialog (handled by useTabEscapeHandler)
   */
  useInput((input, key) => {
    if (!hasFocus) return;

    if (showConfirmation) {
      // Confirmation dialog navigation
      if (key.leftArrow) {
        setConfirmSelection('yes');
      } else if (key.rightArrow) {
        setConfirmSelection('no');
      } else if (key.return) {
        if (confirmSelection === 'yes') {
          // Open the URL
          if (selectedPlatform === 'discord') {
            openURL('https://discord.gg/9GuCwdrB');
          } else {
            openURL('https://github.com/Tecet/OLLM/issues');
          }
        }
        // Close dialog regardless of choice
        setShowConfirmation(false);
        setConfirmSelection('yes'); // Reset to yes
      } else if (key.escape) {
        setShowConfirmation(false);
        setConfirmSelection('yes'); // Reset to yes
      }
    } else {
      // Main screen navigation
      if (key.upArrow) {
        setSelectedPlatform('discord');
      } else if (key.downArrow) {
        setSelectedPlatform('github');
      } else if (key.return) {
        // Show confirmation dialog
        setShowConfirmation(true);
      }
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="column" height="100%" width={width} position="relative">
      {/* Header */}
      <Box
        flexDirection="column"
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              🐛 Bug Report
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text wrap="truncate-end" color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
              {showConfirmation ? '←→:Select Enter:Confirm Esc:Cancel' : '↑↓:Navigate Enter:Open 0/Esc:Exit'}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Main Content - Centered Container */}
      <Box 
        flexDirection="column" 
        flexGrow={1}
        justifyContent="center"
        alignItems="center"
        paddingX={4}
      >
        <Box flexDirection="column" width="80%">
          {/* Welcome Message */}
          <Box justifyContent="center" marginBottom={1}>
            <Text bold color={uiState.theme.text.accent}>
              🐛 Found a Bug? We're Here to Help!
            </Text>
          </Box>
          
          <Box justifyContent="center" marginBottom={1}>
            <Text color={uiState.theme.text.primary}>
              Hey there! 👋
            </Text>
          </Box>
          
          <Box justifyContent="center" marginBottom={1}>
            <Text color={uiState.theme.text.secondary}>
              Thanks for helping us make OLLM CLI better. Whether you've found a bug,
            </Text>
          </Box>
          <Box justifyContent="center" marginBottom={2}>
            <Text color={uiState.theme.text.secondary}>
              have a feature suggestion, or just need help - we'd love to hear from you!
            </Text>
          </Box>
          
          {/* Before You Report */}
          <Box marginBottom={1}>
            <Text bold color={uiState.theme.text.primary}>
              📝 Before You Report:
            </Text>
          </Box>
          
          <Text color={uiState.theme.text.secondary}>
              ✓ Check if the issue still happens after restarting OLLM CLI
          </Text>
          <Text color={uiState.theme.text.secondary}>
              ✓ Make sure you're running the latest version (v0.1.0)
          </Text>
          <Box marginBottom={2}>
            <Text color={uiState.theme.text.secondary}>
              ✓ Try to reproduce the issue to confirm it's consistent
            </Text>
          </Box>
          
          {/* What Makes a Great Bug Report */}
          <Box marginBottom={1}>
            <Text bold color={uiState.theme.text.primary}>
              📋 What Makes a Great Bug Report:
            </Text>
          </Box>
          
          <Text color={uiState.theme.text.secondary}>
              • Clear description of what went wrong
          </Text>
          <Text color={uiState.theme.text.secondary}>
              • Steps to reproduce (1, 2, 3...)
          </Text>
          <Text color={uiState.theme.text.secondary}>
              • Expected vs actual behavior
          </Text>
          <Text color={uiState.theme.text.secondary}>
              • Your OS and OLLM CLI version
          </Text>
          <Box marginBottom={2}>
            <Text color={uiState.theme.text.secondary}>
              • Screenshots or error messages (if applicable)
            </Text>
          </Box>
          
          {/* Choose Your Platform */}
          <Box marginBottom={1}>
            <Text bold color={uiState.theme.text.primary}>
              🚀 Choose Your Platform:
            </Text>
          </Box>
          
          <Box justifyContent="center" marginBottom={1}>
            <Text color={uiState.theme.text.secondary}>
              ───────────────────────────────────────────────────────────────────
            </Text>
          </Box>
          
          <Text></Text>
          
          {/* Discord Option */}
          <Box marginBottom={1}>
            <Text color={uiState.theme.text.accent} bold={selectedPlatform === 'discord' && hasFocus}>
              {selectedPlatform === 'discord' && hasFocus ? '▶ ' : '  '}Report on Discord
            </Text>
          </Box>
          <Box marginBottom={2} paddingLeft={2}>
            <Text color={uiState.theme.text.secondary} dimColor>
              Chat with the community, get instant feedback, and report bugs
            </Text>
          </Box>
          
          {/* GitHub Option */}
          <Box marginBottom={1}>
            <Text color={uiState.theme.text.accent} bold={selectedPlatform === 'github' && hasFocus}>
              {selectedPlatform === 'github' && hasFocus ? '▶ ' : '  '}Report on GitHub
            </Text>
          </Box>
          <Box marginBottom={2} paddingLeft={2}>
            <Text color={uiState.theme.text.secondary} dimColor>
              Create a formal issue with full details and tracking
            </Text>
          </Box>
          
          {/* Pro Tip */}
          <Box justifyContent="center" marginTop={1}>
            <Text color={uiState.theme.text.secondary} dimColor>
              💡 Pro Tip: Discord is great for quick questions, GitHub for detailed tracking
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Confirmation Dialog Overlay - Rendered LAST to be on top */}
      {showConfirmation && (
        <Box
          position="absolute"
          width="100%"
          height="100%"
          justifyContent="center"
          alignItems="center"
        >
          {/* Semi-transparent background */}
          <Box
            position="absolute"
            width="100%"
            height="100%"
          />
          
          {/* Dialog box */}
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={uiState.theme.border.active}
            paddingX={3}
            paddingY={2}
            width="60%"
            backgroundColor="black"
          >
            <Box justifyContent="center" marginBottom={1}>
              <Text bold color={uiState.theme.text.accent}>
                Open {selectedPlatform === 'discord' ? 'Discord' : 'GitHub'}?
              </Text>
            </Box>
            
            <Box justifyContent="center" marginBottom={1}>
              <Text color={uiState.theme.text.secondary}>
                This will open {selectedPlatform === 'discord' ? 'Discord' : 'GitHub'} in your default browser.
              </Text>
            </Box>
            
            <Box justifyContent="center" marginBottom={2}>
              <Text color={uiState.theme.text.secondary} dimColor>
                {selectedPlatform === 'discord' ? 'https://discord.gg/9GuCwdrB' : 'https://github.com/Tecet/OLLM/issues'}
              </Text>
            </Box>
            
            <Box justifyContent="center" gap={4}>
              <Box
                borderStyle="round"
                borderColor={confirmSelection === 'yes' ? uiState.theme.border.active : uiState.theme.border.primary}
                paddingX={2}
              >
                <Text bold={confirmSelection === 'yes'} color={confirmSelection === 'yes' ? uiState.theme.text.accent : uiState.theme.text.secondary}>
                  Yes
                </Text>
              </Box>
              
              <Box
                borderStyle="round"
                borderColor={confirmSelection === 'no' ? uiState.theme.border.active : uiState.theme.border.primary}
                paddingX={2}
              >
                <Text bold={confirmSelection === 'no'} color={confirmSelection === 'no' ? uiState.theme.text.accent : uiState.theme.text.secondary}>
                  No
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
