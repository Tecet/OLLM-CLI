/**
 * HelpPanel - Keyboard shortcuts help panel
 * 
 * Displays a modal with all available keyboard shortcuts for the file explorer.
 * Accessible via the '?' key.
 * 
 * Requirements: 11.2 (Show keyboard shortcuts in help panel)
 */

import React from 'react';
import { Box, Text } from 'ink';

/**
 * Props for HelpPanel component
 */
export interface HelpPanelProps {
  /** Whether the help panel is visible */
  isOpen: boolean;
  /** Callback when the panel should be closed */
  onClose: () => void;
}

/**
 * Keyboard shortcut definition
 */
interface Shortcut {
  key: string;
  description: string;
  category: string;
}

/**
 * All available keyboard shortcuts
 */
const SHORTCUTS: Shortcut[] = [
  // Navigation
  { key: 'j / ↓', description: 'Move cursor down', category: 'Navigation' },
  { key: 'k / ↑', description: 'Move cursor up', category: 'Navigation' },
  { key: 'h / ←', description: 'Collapse directory', category: 'Navigation' },
  { key: 'l / →', description: 'Expand directory', category: 'Navigation' },
  { key: 'Ctrl+O', description: 'Quick Open (fuzzy search)', category: 'Navigation' },
  
  // File Operations
  { key: 'f', description: 'Toggle focus on file', category: 'File Operations' },
  { key: 'v', description: 'View file (syntax highlighting)', category: 'File Operations' },
  { key: 'e', description: 'Edit file in external editor', category: 'File Operations' },
  { key: 'a', description: 'Open quick actions menu', category: 'File Operations' },
  
  // Features
  { key: 'F', description: 'Toggle Follow Mode', category: 'Features' },
  { key: '?', description: 'Show this help panel', category: 'Features' },
  
  // General
  { key: 'Esc', description: 'Close modal/menu', category: 'General' },
];

/**
 * HelpPanel component
 * 
 * Displays a modal with keyboard shortcuts organized by category.
 * Press Esc or '?' to close.
 */
export function HelpPanel({ isOpen, onClose: _onClose }: HelpPanelProps) {
  if (!isOpen) {
    return null;
  }

  // Group shortcuts by category
  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
      width={70}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Keyboard Shortcuts
        </Text>
        <Text dimColor> (Press Esc or ? to close)</Text>
      </Box>

      {/* Shortcuts by category */}
      {categories.map((category, idx) => (
        <Box key={category} flexDirection="column" marginBottom={idx < categories.length - 1 ? 1 : 0}>
          {/* Category header */}
          <Text bold color="yellow">
            {category}
          </Text>

          {/* Shortcuts in this category */}
          {SHORTCUTS.filter(s => s.category === category).map((shortcut) => (
            <Box key={shortcut.key} flexDirection="row" marginLeft={2}>
              <Box width={20}>
                <Text color="green">{shortcut.key}</Text>
              </Box>
              <Text dimColor>{shortcut.description}</Text>
            </Box>
          ))}
        </Box>
      ))}

      {/* Footer */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          Tip: Use vim-style keys (hjkl) or arrow keys for navigation
        </Text>
      </Box>
    </Box>
  );
}
