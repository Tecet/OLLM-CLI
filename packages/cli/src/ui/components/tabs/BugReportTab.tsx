import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { exec } from 'child_process';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useTabEscapeHandler } from '../../hooks/useTabEscapeHandler.js';

export interface BugReportTabProps {
  width?: number;
}

type Platform = 'discord' | 'github';

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
   * - ↑/↓: Navigate between Discord and GitHub
   * - Enter: Open selected platform
   * - ESC/0: Exit to nav bar (handled by useTabEscapeHandler)
   */
  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.upArrow) {
      setSelectedPlatform('discord');
    } else if (key.downArrow) {
      setSelectedPlatform('github');
    } else if (key.return) {
      if (selectedPlatform === 'discord') {
        openURL('https://discord.gg/9GuCwdrB');
      } else {
        openURL('https://github.com/Tecet/OLLM/issues');
      }
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="column" height="100%" width={width}>
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
              ↑↓:Navigate Enter:Open 0/Esc:Exit
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Main Content */}
      <Box 
        flexDirection="column" 
        flexGrow={1}
        borderStyle="single" 
        borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
        paddingX={2} 
        paddingY={2}
      >
        <Text></Text>
        <Text></Text>
        <Text></Text>
        <Text></Text>
        
        <Box justifyContent="center">
          <Text bold color={uiState.theme.text.accent}>
            🐛 Found a Bug? We're Here to Help!
          </Text>
        </Box>
        
        <Text></Text>
        <Text></Text>
        
        <Box justifyContent="center">
          <Text color={uiState.theme.text.primary}>
            Hey there! 👋
          </Text>
        </Box>
        
        <Text></Text>
        
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
            Thanks for helping us make OLLM CLI better. Whether you've found a bug,
          </Text>
        </Box>
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
            have a feature suggestion, or just need help - we'd love to hear from you!
          </Text>
        </Box>
        
        <Text></Text>
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
            ───────────────────────────────────────────────────────────────────
          </Text>
        </Box>
        <Text></Text>
        
        <Text bold color={uiState.theme.text.primary}>
          📝 Before You Report:
        </Text>
        
        <Text></Text>
        
        <Text color={uiState.theme.text.secondary}>
            ✓ Check if the issue still happens after restarting OLLM CLI
        </Text>
        <Text color={uiState.theme.text.secondary}>
            ✓ Make sure you're running the latest version (v0.1.0)
        </Text>
        <Text color={uiState.theme.text.secondary}>
            ✓ Try to reproduce the issue to confirm it's consistent
        </Text>
        
        <Text></Text>
        
        <Text bold color={uiState.theme.text.primary}>
          📋 What Makes a Great Bug Report:
        </Text>
        
        <Text></Text>
        
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
        <Text color={uiState.theme.text.secondary}>
            • Screenshots or error messages (if applicable)
        </Text>
        
        <Text></Text>
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
            ───────────────────────────────────────────────────────────────────
          </Text>
        </Box>
        <Text></Text>
        
        <Text bold color={uiState.theme.text.primary}>
          🚀 Choose Your Platform:
        </Text>
        
        <Text></Text>
        
        <Box>
          <Text color={selectedPlatform === 'discord' && hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}>
            {selectedPlatform === 'discord' && hasFocus ? '▶ ' : '  '}Discord Community (Recommended for quick help)
          </Text>
        </Box>
        <Text color={uiState.theme.text.secondary}>
                Chat with the community, get instant feedback, and report bugs
        </Text>
        <Text color={uiState.theme.text.accent}>
                https://discord.gg/9GuCwdrB
        </Text>
        
        <Text></Text>
        
        <Box>
          <Text color={selectedPlatform === 'github' && hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}>
            {selectedPlatform === 'github' && hasFocus ? '▶ ' : '  '}GitHub Issues (For detailed bug reports)
          </Text>
        </Box>
        <Text color={uiState.theme.text.secondary}>
                Create a formal issue with full details and tracking
        </Text>
        <Text color={uiState.theme.text.accent}>
                https://github.com/Tecet/OLLM/issues
        </Text>
        
        <Text></Text>
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
            ───────────────────────────────────────────────────────────────────
          </Text>
        </Box>
        <Text></Text>
        
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
            💡 Pro Tip: Discord is great for quick questions and discussions,
          </Text>
        </Box>
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary}>
                       while GitHub is better for detailed bug tracking.
          </Text>
        </Box>
        
        <Text></Text>
        
        <Box justifyContent="center">
          <Text color={uiState.theme.text.secondary} dimColor>
            Use ↑↓ to navigate • Press Enter to open • Esc to go back
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
