/**
 * ToolsPanel Component - Rewritten from scratch
 *
 * Two-column layout for tools configuration:
 * - Left column (30%): Tool list organized by category (read-only navigation)
 * - Right column (70%): Tool details + per-mode settings
 *
 * Navigation:
 * - Up/Down: Navigate through tools
 * - Tab: Switch between left/right panels
 * - Enter/Space: Toggle mode setting (right panel)
 * - A: Apply changes
 * - R: Reset to defaults
 * - Esc: Exit to nav bar
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useTools } from '../../contexts/ToolsContext.js';
import { useTabEscapeHandler } from '../../hooks/useTabEscapeHandler.js';
import { ToolModeSettings } from './ToolModeSettings.js';

export interface ToolsPanelProps {
  modelSupportsTools?: boolean;
  windowWidth?: number;
}

type LeftNavItem = 'exit' | 'tool';

const MODES = ['developer', 'debugger', 'assistant', 'planning', 'user'];

/**
 * ToolsPanel Component
 */
export function ToolsPanel({ modelSupportsTools = true, windowWidth }: ToolsPanelProps) {
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const { state: toolsState, getModeSettings, setModeSettings, resetToDefaults } = useTools();

  const hasFocus = isFocused('tools-panel');
  useTabEscapeHandler(hasFocus);

  // Navigation state
  const [activeColumn, setActiveColumn] = useState<'left' | 'right'>('left');
  const [leftNavItem, setLeftNavItem] = useState<LeftNavItem>('exit');
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [selectedModeIndex, setSelectedModeIndex] = useState(0);

  // Mode settings state
  const [localModeSettings, setLocalModeSettings] = useState<Record<string, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Calculate widths
  const leftWidth = windowWidth ? Math.floor(windowWidth * 0.3) : undefined;
  const rightWidth = windowWidth && leftWidth ? windowWidth - leftWidth : undefined;

  // Get categories and tools
  const categories = toolsState.categories;

  // Get currently selected tool
  const selectedTool = useMemo(() => {
    if (selectedCategoryIndex >= 0 && selectedCategoryIndex < categories.length) {
      const category = categories[selectedCategoryIndex];
      if (selectedToolIndex >= 0 && selectedToolIndex < category.tools.length) {
        return category.tools[selectedToolIndex];
      }
    }
    return null;
  }, [categories, selectedCategoryIndex, selectedToolIndex]);

  // Load mode settings when tool changes
  useEffect(() => {
    if (selectedTool) {
      const settings = getModeSettings(selectedTool.id);
      setLocalModeSettings(settings);
      setHasUnsavedChanges(false);
    }
  }, [selectedTool, getModeSettings]);

  // Handle mode toggle
  const handleModeToggle = (mode: string) => {
    setLocalModeSettings((prev) => ({
      ...prev,
      [mode]: !prev[mode],
    }));
    setHasUnsavedChanges(true);
  };

  // Handle apply
  const handleApply = () => {
    if (!selectedTool) return;

    // Save all mode settings
    Object.entries(localModeSettings).forEach(([mode, enabled]) => {
      setModeSettings(selectedTool.id, mode, enabled);
    });

    setHasUnsavedChanges(false);
  };

  // Handle reset
  const handleReset = () => {
    if (!selectedTool) return;

    resetToDefaults(selectedTool.id);

    // Reload settings
    const settings = getModeSettings(selectedTool.id);
    setLocalModeSettings(settings);
    setHasUnsavedChanges(false);
  };

  // Left column navigation
  const handleLeftUp = () => {
    if (leftNavItem === 'exit') {
      // Already at top
      return;
    }

    if (leftNavItem === 'tool') {
      if (selectedToolIndex > 0) {
        setSelectedToolIndex((prev) => prev - 1);
      } else if (selectedCategoryIndex > 0) {
        // Move to previous category's last tool
        const prevCategory = categories[selectedCategoryIndex - 1];
        setSelectedCategoryIndex((prev) => prev - 1);
        setSelectedToolIndex(prevCategory.tools.length - 1);
      } else {
        // Move to exit
        setLeftNavItem('exit');
      }
    }
  };

  const handleLeftDown = () => {
    if (leftNavItem === 'exit') {
      // Move to first tool
      if (categories.length > 0 && categories[0].tools.length > 0) {
        setLeftNavItem('tool');
        setSelectedCategoryIndex(0);
        setSelectedToolIndex(0);
      }
      return;
    }

    if (leftNavItem === 'tool') {
      const currentCategory = categories[selectedCategoryIndex];
      if (selectedToolIndex < currentCategory.tools.length - 1) {
        setSelectedToolIndex((prev) => prev + 1);
      } else if (selectedCategoryIndex < categories.length - 1) {
        // Move to next category's first tool
        setSelectedCategoryIndex((prev) => prev + 1);
        setSelectedToolIndex(0);
      }
    }
  };

  // Right column navigation
  const handleRightUp = () => {
    if (selectedModeIndex > 0) {
      setSelectedModeIndex((prev) => prev - 1);
    }
  };

  const handleRightDown = () => {
    if (selectedModeIndex < MODES.length - 1) {
      setSelectedModeIndex((prev) => prev + 1);
    }
  };

  const handleRightToggle = () => {
    const mode = MODES[selectedModeIndex];
    handleModeToggle(mode);
  };

  // Keyboard input
  useInput(
    (input, key) => {
      if (!hasFocus) return;

      // Tab to switch columns
      if (key.tab) {
        setActiveColumn((prev) => (prev === 'left' ? 'right' : 'left'));
        return;
      }

      if (activeColumn === 'left') {
        if (key.upArrow) {
          handleLeftUp();
        } else if (key.downArrow) {
          handleLeftDown();
        }
      } else {
        // Right column
        if (key.upArrow) {
          handleRightUp();
        } else if (key.downArrow) {
          handleRightDown();
        } else if (key.return || input === ' ') {
          handleRightToggle();
        } else if (input === 'a' || input === 'A') {
          handleApply();
        } else if (input === 'r' || input === 'R') {
          handleReset();
        }
      }
    },
    { isActive: hasFocus }
  );

  return (
    <Box flexDirection="column" height="100%" width={windowWidth}>
      {/* Header */}
      <Box
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" width="100%">
          <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
            Tools Configuration
          </Text>
          <Text color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
            Tab:Switch ↑↓:Nav Enter:Toggle A:Apply R:Reset Esc:Exit
            {hasUnsavedChanges && <Text color="yellow"> *</Text>}
          </Text>
        </Box>
      </Box>

      {/* Warning if model doesn't support tools */}
      {!modelSupportsTools && (
        <Box paddingX={1} paddingY={1} flexShrink={0}>
          <Box paddingX={1} borderStyle="round" borderColor={uiState.theme.status.warning}>
            <Text color={uiState.theme.status.warning} bold>
              ⚠ Model doesn't support tools. Settings will apply when you switch to a compatible
              model.
            </Text>
          </Box>
        </Box>
      )}

      {/* Two-column layout */}
      <Box flexGrow={1} flexDirection="row" width="100%">
        {/* Left column: Tool list (30%) */}
        <Box
          flexDirection="column"
          width={leftWidth ?? '30%'}
          borderStyle="single"
          borderColor={
            activeColumn === 'left' && hasFocus
              ? uiState.theme.border.active
              : uiState.theme.border.primary
          }
          paddingY={1}
        >
          {/* Exit item */}
          <Box paddingX={1} flexShrink={0}>
            <Text
              bold={leftNavItem === 'exit' && activeColumn === 'left'}
              color={
                leftNavItem === 'exit' && activeColumn === 'left'
                  ? uiState.theme.text.accent
                  : uiState.theme.text.primary
              }
            >
              {leftNavItem === 'exit' && activeColumn === 'left' ? '▶ ' : '  '}← Exit
            </Text>
          </Box>

          <Text> </Text>

          {/* Tool list */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            {categories.map((category, catIndex) => (
              <Box key={category.category} flexDirection="column">
                {/* Category header */}
                <Text bold color={uiState.theme.text.primary}>
                  {category.icon} {category.displayName}
                </Text>

                {/* Tools in category */}
                {category.tools.map((tool, toolIndex) => {
                  const isSelected =
                    leftNavItem === 'tool' &&
                    catIndex === selectedCategoryIndex &&
                    toolIndex === selectedToolIndex &&
                    activeColumn === 'left';

                  return (
                    <Box key={tool.id} paddingLeft={2}>
                      <Text
                        bold={isSelected}
                        color={isSelected ? uiState.theme.text.accent : uiState.theme.text.primary}
                      >
                        {isSelected ? '▶ ' : '  '}• {tool.displayName}
                      </Text>
                    </Box>
                  );
                })}

                <Text> </Text>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right column: Tool details + mode settings (70%) */}
        <Box
          flexDirection="column"
          width={rightWidth ?? '70%'}
          borderStyle="single"
          borderColor={
            activeColumn === 'right' && hasFocus
              ? uiState.theme.border.active
              : uiState.theme.border.primary
          }
          paddingX={2}
          paddingY={1}
        >
          {selectedTool ? (
            <>
              {/* Tool name */}
              <Text bold color={uiState.theme.text.accent}>
                {selectedTool.displayName}
              </Text>

              {/* Tool status */}
              <Box marginTop={1}>
                <Text
                  color={
                    selectedTool.enabled
                      ? uiState.theme.status.success
                      : uiState.theme.status.error
                  }
                >
                  Status: {selectedTool.enabled ? '✓ Enabled Globally' : '✗ Disabled Globally'}
                </Text>
              </Box>

              <Text> </Text>

              {/* Tool description */}
              <Box flexDirection="column">
                <Text color={uiState.theme.text.primary}>{selectedTool.description}</Text>
              </Box>

              <Text> </Text>
              <Text> </Text>

              {/* Per-Mode Settings */}
              <ToolModeSettings
                toolId={selectedTool.id}
                modeSettings={localModeSettings}
                onToggle={handleModeToggle}
                onApply={handleApply}
                onReset={handleReset}
                focused={activeColumn === 'right' && hasFocus}
                selectedIndex={selectedModeIndex}
                onSelectionChange={setSelectedModeIndex}
              />
            </>
          ) : (
            <Text color={uiState.theme.text.secondary}>Select a tool to view details</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
