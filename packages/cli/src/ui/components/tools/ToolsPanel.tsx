import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useTools, type ToolCategoryGroup } from '../../contexts/ToolsContext.js';
import { ToolToggle } from './ToolToggle.js';

// Category icon mapping (kept for backward compatibility, but now also in ToolsContext)
const getCategoryIcon = (category: string): string => {
  const categoryIcons: Record<string, string> = {
    'file-operations': '📝',
    'file-discovery': '🔍',
    'shell': '⚡',
    'web': '🌐',
    'memory': '💾',
    'context': '🔄',
    'mcp': '🔌',
    'extension': '🧩',
    'other': '📦',
  };
  return categoryIcons[category] || '📦';
};

export interface ToolsPanelProps {
  modelSupportsTools?: boolean;
  windowSize?: number;
}

/**
 * ToolsPanel component
 * 
 * Displays all available tools organized by category with enable/disable toggles.
 * Supports keyboard navigation and windowed rendering for scrolling.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 23.1, 23.5, 24.1, 24.2, 24.3, 24.4, 25.1, 25.2, 25.3, 25.4
 */
export function ToolsPanel({ modelSupportsTools = true, windowSize = 15 }: ToolsPanelProps) {
  const { state: uiState } = useUI();
  const { isFocused, exitToNavBar } = useFocusManager();
  const { state: toolsState, toggleTool, refreshTools } = useTools();
  
  // Check if this panel has focus
  const hasFocus = isFocused('tools-panel');
  
  // State for navigation
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isOnExitItem, setIsOnExitItem] = useState(false); // Track if Exit item is selected
  
  // Get categories from context (dynamic from ToolRegistry)
  const categoryData = toolsState.categories;

  // Get tool states from context
  const toolStates = useMemo(() => {
    const states: Record<string, boolean> = {};
    toolsState.allTools.forEach(tool => {
      states[tool.id] = tool.enabled;
    });
    return states;
  }, [toolsState.allTools]);

  // Calculate total items for windowed rendering
  const totalItems = useMemo(() => {
    return categoryData.reduce((sum, { tools }) => sum + tools.length + 1, 0) + 1; // +1 for category header, +1 for Exit item
  }, [categoryData]);

  // Visible window size (adjust based on terminal height)
  const WINDOW_SIZE = windowSize;

  // Calculate which categories and tools should be visible in the current window
  const visibleItems = useMemo(() => {
    const items: Array<{
      type: 'exit' | 'category' | 'tool';
      categoryIndex: number;
      toolIndex?: number;
      position: number;
    }> = [];

    let position = 0;
    
    // Add Exit item at position 0
    items.push({
      type: 'exit',
      categoryIndex: -1,
      position: position++,
    });

    categoryData.forEach((categoryInfo, catIndex) => {
      // Add category header
      items.push({
        type: 'category',
        categoryIndex: catIndex,
        position: position++,
      });

      // Add tools
      categoryInfo.tools.forEach((_, toolIndex) => {
        items.push({
          type: 'tool',
          categoryIndex: catIndex,
          toolIndex,
          position: position++,
        });
      });
    });

    // Filter to visible window
    return items.filter(
      item => item.position >= scrollOffset && item.position < scrollOffset + WINDOW_SIZE
    );
  }, [categoryData, scrollOffset, WINDOW_SIZE]);

  // Handle tool toggle
  const handleToggle = async (toolId: string) => {
    await toggleTool(toolId);
    setHasUnsavedChanges(true); // Mark as changed
  };

  // Handle save
  const handleSave = () => {
    // Settings are already persisted via toggleTool
    // Just clear the unsaved changes flag and refresh
    setHasUnsavedChanges(false);
    refreshTools();
  };

  // Handle exit
  const handleExit = () => {
    if (hasUnsavedChanges) {
      // TODO: Show save prompt dialog when DialogManager is ready
      // For now, just save automatically
      handleSave();
    }
    exitToNavBar();
  };

  // Navigation handlers
  const handleNavigateUp = () => {
    if (isOnExitItem) {
      // Already at Exit, can't go up
      return;
    }
    
    if (selectedToolIndex > 0) {
      setSelectedToolIndex(prev => prev - 1);
    } else if (selectedCategoryIndex > 0) {
      // Move to previous category's last tool
      const prevCategory = categoryData[selectedCategoryIndex - 1];
      setSelectedCategoryIndex(prev => prev - 1);
      setSelectedToolIndex(prevCategory.tools.length - 1);
    } else {
      // At first tool of first category, move to Exit
      setIsOnExitItem(true);
      setScrollOffset(0);
    }
  };

  const handleNavigateDown = () => {
    if (isOnExitItem) {
      // Move from Exit to first tool
      setIsOnExitItem(false);
      setSelectedCategoryIndex(0);
      setSelectedToolIndex(0);
      return;
    }
    
    const currentCategory = categoryData[selectedCategoryIndex];
    if (selectedToolIndex < currentCategory.tools.length - 1) {
      setSelectedToolIndex(prev => prev + 1);
    } else if (selectedCategoryIndex < categoryData.length - 1) {
      // Move to next category's first tool
      setSelectedCategoryIndex(prev => prev + 1);
      setSelectedToolIndex(0);
    }
  };

  const handleToggleCurrent = () => {
    // Check if we're on the Exit item
    if (isOnExitItem) {
      handleExit();
      return;
    }
    
    const currentCategory = categoryData[selectedCategoryIndex];
    const currentTool = currentCategory.tools[selectedToolIndex];
    if (currentTool) {
      handleToggle(currentTool.id);
    }
  };

  // Handle keyboard input directly
  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.upArrow) {
      handleNavigateUp();
    } else if (key.downArrow) {
      handleNavigateDown();
    } else if (key.leftArrow || key.rightArrow || key.return) {
      handleToggleCurrent();
    } else if (key.escape || input === '0') {
      handleExit();
    }
  }, { isActive: hasFocus });

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    let currentPosition = 1; // Start at 1 because Exit is at position 0
    for (let i = 0; i < selectedCategoryIndex; i++) {
      currentPosition += categoryData[i].tools.length + 1;
    }
    currentPosition += selectedToolIndex + 1; // +1 for category header

    if (currentPosition < scrollOffset) {
      setScrollOffset(currentPosition);
    } else if (currentPosition >= scrollOffset + WINDOW_SIZE) {
      setScrollOffset(currentPosition - WINDOW_SIZE + 1);
    }
  }, [selectedCategoryIndex, selectedToolIndex, categoryData, scrollOffset, WINDOW_SIZE]);

  // Calculate enabled/disabled counts (currently unused)
  /*
  const { enabledCount, disabledCount } = useMemo(() => {
    let enabled = 0;
    let disabled = 0;
    Object.values(toolStates).forEach(state => {
      if (state) enabled++;
      else disabled++;
    });
    return { enabledCount: enabled, disabledCount: disabled };
  }, [toolStates]);
  */

  // Get currently selected tool
  const selectedTool = useMemo(() => {
    if (selectedCategoryIndex >= 0 && selectedCategoryIndex < categoryData.length) {
      const category = categoryData[selectedCategoryIndex];
      if (selectedToolIndex >= 0 && selectedToolIndex < category.tools.length) {
        return category.tools[selectedToolIndex];
      }
    }
    return null;
  }, [categoryData, selectedCategoryIndex, selectedToolIndex]);

  // Model doesn't support tools - MOVE AFTER HOOKS
  if (!modelSupportsTools) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={uiState.theme.status.warning} bold>
          ⚠ Model doesn't support tools
        </Text>
        <Box marginTop={1}>
          <Text color={uiState.theme.text.secondary}>
            The current model does not support function calling.
          </Text>
        </Box>
        <Text color={uiState.theme.text.secondary}>
          Switch to a tool-capable model to use tools.
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box
        flexDirection="column"
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between">
          <Text bold color={hasFocus ? 'yellow' : uiState.theme.text.primary}>
            Tools Configuration
          </Text>
          <Text color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
            ↑↓:Nav Enter:Toggle 0/Esc:Exit{hasUnsavedChanges ? '*' : ''}
          </Text>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden">
        {/* Left column: Tool list (30%) */}
        <Box flexDirection="column" width="30%" borderStyle="single" borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}>
          {/* Scroll indicator at top - STICKY */}
          {scrollOffset > 0 && (
            <>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>
                  ▲ Scroll up for more
                </Text>
              </Box>
              <Text> </Text>
            </>
          )}

          {/* Scrollable content area */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            {/* Render only visible items */}
            {visibleItems.map((item) => {
              if (item.type === 'exit') {
                // Render Exit item
                return (
                  <>
                    <Box key="exit-item">
                      <Text
                        bold={isOnExitItem && hasFocus}
                        color={isOnExitItem && hasFocus ? 'yellow' : uiState.theme.text.primary}
                      >
                        ← Exit
                      </Text>
                    </Box>
                    <Text> </Text>
                    <Text> </Text>
                  </>
                );
              } else if (item.type === 'category') {
                const categoryInfo = categoryData[item.categoryIndex];
                
                const hasVisibleTools = visibleItems.some(
                  vi => vi.type === 'tool' && vi.categoryIndex === item.categoryIndex
                );

                if (!hasVisibleTools) return null;

                return (
                  <Box key={`cat-${item.categoryIndex}`} marginTop={item.categoryIndex > 0 ? 1 : 0}>
                    <Text bold color={uiState.theme.text.primary}>
                      {getCategoryIcon(categoryInfo.category)} {categoryInfo.displayName}
                    </Text>
                  </Box>
                );
              } else {
                // Render tool item (compact)
                const categoryInfo = categoryData[item.categoryIndex];
                const tool = categoryInfo.tools[item.toolIndex!];
                const isSelectedCategory = item.categoryIndex === selectedCategoryIndex;
                const isToolSelected = hasFocus && isSelectedCategory && item.toolIndex === selectedToolIndex;
                const isEnabled = toolStates[tool.id] ?? true;

                return (
                  <Box key={`tool-${tool.id}`} paddingLeft={2}>
                    <Box gap={1}>
                      <ToolToggle
                        isEnabled={isEnabled}
                        isSelected={isToolSelected}
                        theme={uiState.theme}
                      />
                      <Text
                        bold={isToolSelected}
                        color={isToolSelected ? 'yellow' : uiState.theme.text.primary}
                        dimColor={!isEnabled}
                      >
                        {tool.displayName}
                      </Text>
                    </Box>
                  </Box>
                );
              }
            })}
          </Box>

          {/* Scroll indicator at bottom - STICKY */}
          {scrollOffset + WINDOW_SIZE < totalItems && (
            <>
              <Text> </Text>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>
                  ▼ Scroll down for more
                </Text>
              </Box>
            </>
          )}
        </Box>

        {/* Right column: Tool details (70%) */}
        <Box flexDirection="column" width="70%" borderStyle="single" borderColor={uiState.theme.border.primary} paddingX={2} paddingY={2}>
          {selectedTool ? (
            <>
              {/* Tool name */}
              <Text bold color="yellow">
                {selectedTool.displayName}
              </Text>

              {/* Tool version */}
              <Box marginTop={1}>
                <Text color={uiState.theme.text.secondary}>
                  Version: v0.1.0
                </Text>
              </Box>

              {/* Tool description */}
              <Box marginTop={2}>
                <Text color={uiState.theme.text.primary}>
                  {selectedTool.description}
                </Text>
              </Box>

              {/* Tool status */}
              <Box marginTop={2}>
                <Text color={toolStates[selectedTool.id] ? uiState.theme.status.success : uiState.theme.status.error}>
                  Status: {toolStates[selectedTool.id] ? '✓ Enabled' : '✗ Disabled'}
                </Text>
              </Box>
            </>
          ) : (
            <Text color={uiState.theme.text.secondary}>
              Select a tool to view details
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
