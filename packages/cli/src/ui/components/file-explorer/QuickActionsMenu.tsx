/**
 * QuickActionsMenu - Context menu for file operations
 * 
 * Displays a menu with common file operations: Open, Focus, Edit, Rename,
 * Delete, and Copy Path. The menu is triggered by keyboard shortcut (e.g., 'a')
 * and allows users to quickly perform actions on the selected file.
 * 
 * Requirements: 7.4
 */

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { useKeybinds } from '../../../features/context/KeybindsContext.js';
import type { FileNode } from './types.js';

/**
 * Available actions in the quick actions menu
 */
export type QuickAction = 
  | 'open'
  | 'focus'
  | 'edit'
  | 'rename'
  | 'delete'
  | 'copyPath';

/**
 * Menu option definition
 */
export interface MenuOption {
  /** Action identifier */
  action: QuickAction;
  /** Display label */
  label: string;
  /** Keyboard shortcut key */
  key: string;
  /** Whether this option is available for the current selection */
  enabled: boolean;
}

/**
 * Props for QuickActionsMenu component
 */
export interface QuickActionsMenuProps {
  /** The currently selected file node */
  selectedNode: FileNode | null;
  /** Whether the menu is currently open */
  isOpen: boolean;
  /** Callback when an action is selected */
  onAction: (action: QuickAction) => void;
  /** Callback when the menu is closed */
  onClose: () => void;
}

/**
 * Get menu options based on the selected node
 * 
 * Some options are only available for files (not directories):
 * - Open: Files only
 * - Focus: Files only
 * - Edit: Files only
 * 
 * All other options are available for both files and directories.
 */
function getMenuOptions(selectedNode: FileNode | null): MenuOption[] {
  const isFile = selectedNode?.type === 'file';
  const isDirectory = selectedNode?.type === 'directory';
  
  return [
    {
      action: 'open',
      label: 'Open (View)',
      key: 'o',
      enabled: isFile,
    },
    {
      action: 'focus',
      label: 'Focus (Add to Context)',
      key: 'f',
      enabled: isFile,
    },
    {
      action: 'edit',
      label: 'Edit (External Editor)',
      key: 'e',
      enabled: isFile,
    },
    {
      action: 'rename',
      label: 'Rename',
      key: 'r',
      enabled: isFile || isDirectory,
    },
    {
      action: 'delete',
      label: 'Delete',
      key: 'd',
      enabled: isFile || isDirectory,
    },
    {
      action: 'copyPath',
      label: 'Copy Path',
      key: 'c',
      enabled: isFile || isDirectory,
    },
  ];
}

/**
 * QuickActionsMenu component
 * 
 * Displays a modal menu with file operation options. The menu can be
 * navigated with arrow keys or by pressing the shortcut key for each option.
 * 
 * Keyboard shortcuts:
 * - Up/Down: Navigate menu options
 * - Enter: Select current option
 * - Esc: Close menu
 * - o/f/e/r/d/c: Direct action shortcuts
 */
export function QuickActionsMenu({
  selectedNode,
  isOpen,
  onAction,
  onClose,
}: QuickActionsMenuProps) {
  const menuOptions = getMenuOptions(selectedNode);
  const enabledOptions = menuOptions.filter(opt => opt.enabled);
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  /**
   * Handle action selection
   */
  const handleSelect = useCallback((action: QuickAction) => {
    onAction(action);
    onClose();
  }, [onAction, onClose]);

  /**
   * Handle keyboard input
   */
   
  const { activeKeybinds } = useKeybinds();

  useInput((input, key) => {
    if (!isOpen) return;

    // Helper to check key against config
    const isKey = (cfgKey: string) => {
        if (!cfgKey) return false;
        const norm = (k: string) => k.toLowerCase().replace(/\s/g, '');
        const inputKey = [
            key.ctrl ? 'ctrl' : '',
            key.meta ? 'meta' : '',
            key.shift ? 'shift' : '',
            input
        ].filter(Boolean).join('+');

        // Handle special keys if needed, though here we mostly use chars
        return norm(inputKey) === norm(cfgKey);
    };

    // Close menu on Esc
    if (key.escape) {
      onClose();
      return;
    }

    // Navigate with arrow keys
    if (key.upArrow) {
      setSelectedIndex(prev =>
        prev > 0 ? prev - 1 : enabledOptions.length - 1
      );
      return;
    }

    if (key.downArrow) {
      setSelectedIndex(prev =>
        prev < enabledOptions.length - 1 ? prev + 1 : 0
      );
      return;
    }

    // Select with Enter
    if (key.return) {
      if (enabledOptions[selectedIndex]) {
        handleSelect(enabledOptions[selectedIndex].action);
      }
      return;
    }

    // Keybinds from config
    const kb = activeKeybinds.fileExplorer || {};

    // Direct action shortcuts
    // Note: The original code checked `opt.key === input`.
    // The new `isKey` helper checks for combined keys (ctrl+o, etc.).
    // We need to map the keybinds to the actions.
    const findAndHandleKeybind = (keybind: string | undefined, action: QuickAction) => {
      if (isKey(keybind || menuOptions.find(opt => opt.action === action)?.key || '')) {
        const option = enabledOptions.find(opt => opt.action === action);
        if (option) {
          handleSelect(option.action);
          return true;
        }
      }
      return false;
    };

    if (findAndHandleKeybind(kb.open, 'open')) return;
    if (findAndHandleKeybind(kb.focus, 'focus')) return;
    if (findAndHandleKeybind(kb.edit, 'edit')) return;
    if (findAndHandleKeybind(kb.rename, 'rename')) return; // Assuming 'reveal' maps to 'rename' based on original keys
    if (findAndHandleKeybind(kb.delete, 'delete')) return;
    if (findAndHandleKeybind(kb.copyPath, 'copyPath')) return;
  });

  // Don't render if menu is not open
  if (!isOpen) {
    return null;
  }

  // Don't render if no node is selected
  if (!selectedNode) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        padding={1}
      >
        <Text color="yellow">No file or folder selected</Text>
        <Text dimColor>Press Esc to close</Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      minWidth={40}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Quick Actions
        </Text>
        <Text dimColor> - {selectedNode.name}</Text>
      </Box>

      {/* Menu options */}
      <Box flexDirection="column">
        {enabledOptions.map((option, index) => {
          const isSelected = index === selectedIndex;
          
          return (
            <Box key={option.action} flexDirection="row">
              {/* Selection indicator */}
              <Text bold={isSelected} inverse={isSelected}>
                {isSelected ? '>' : ' '}
              </Text>
              
              <Text> </Text>
              
              {/* Shortcut key */}
              <Text color="green" bold>
                [{option.key}]
              </Text>
              
              <Text> </Text>
              
              {/* Option label */}
              <Text bold={isSelected}>
                {option.label}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor>
          Use arrow keys or shortcuts • Enter to select • Esc to close
        </Text>
      </Box>
    </Box>
  );
}
