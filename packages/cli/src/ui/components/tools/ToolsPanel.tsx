import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { SettingsService } from '../../../config/settingsService.js';
import { getAllCategories, getToolsByCategory, getCategoryDisplayName, ToolCategory } from '../../../config/toolsConfig.js';
import { ToolItem } from './ToolItem.js';

// Category icon mapping
const getCategoryIcon = (category: ToolCategory): string => {
  const categoryIcons: Record<ToolCategory, string> = {
    'file-operations': '📝',
    'file-discovery': '🔍',
    'shell': '⚡',
    'web': '🌐',
    'memory': '💾',
    'context': '🔄',
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
  const settingsService = SettingsService.getInstance();
  
  // Check if this panel has focus
  const hasFocus = isFocused('tools-panel');
  
  // State for navigation
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Get all categories and their tools
  const categories = useMemo(() => getAllCategories(), []);
  const categoryData = useMemo(() => {
    return categories.map(category => ({
      category,
      displayName: getCategoryDisplayName(category),
      tools: getToolsByCategory(category),
    }));
  }, [categories]);

  // Get tool states
  const [toolStates, setToolStates] = useState<Record<string, boolean>>(() => {
    const states: Record<string, boolean> = {};
    categoryData.forEach(({ tools }) => {
      tools.forEach(tool => {
        states[tool.id] = settingsService.getToolState(tool.id);
      });
    });
    return states;
  });

  // Calculate total items for windowed rendering
  const totalItems = useMemo(() => {
    return categoryData.reduce((sum, { tools }) => sum + tools.length + 1, 0); // +1 for category header
  }, [categoryData]);

  // Visible window size (adjust based on terminal height)
  const WINDOW_SIZE = windowSize;

  // Calculate which categories and tools should be visible in the current window
  const visibleItems = useMemo(() => {
    const items: Array<{
      type: 'category' | 'tool';
      categoryIndex: number;
      toolIndex?: number;
      position: number;
    }> = [];

    let position = 0;
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
  const handleToggle = (toolId: string) => {
    const newState = !toolStates[toolId];
    settingsService.setToolState(toolId, newState);
    setToolStates(prev => ({ ...prev, [toolId]: newState }));
    setHasUnsavedChanges(true); // Mark as changed
  };

  // Handle save
  const handleSave = () => {
    // Settings are already persisted via settingsService.setToolState
    // Just clear the unsaved changes flag
    setHasUnsavedChanges(false);
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
    if (selectedToolIndex > 0) {
      setSelectedToolIndex(prev => prev - 1);
    } else if (selectedCategoryIndex > 0) {
      // Move to previous category's last tool
      const prevCategory = categoryData[selectedCategoryIndex - 1];
      setSelectedCategoryIndex(prev => prev - 1);
      setSelectedToolIndex(prevCategory.tools.length - 1);
    }
  };

  const handleNavigateDown = () => {
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
    } else if (key.escape) {
      handleExit();
    }
  }, { isActive: hasFocus });

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    let currentPosition = 0;
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

  // Calculate enabled/disabled counts
  const { enabledCount, disabledCount } = useMemo(() => {
    let enabled = 0;
    let disabled = 0;
    Object.values(toolStates).forEach(state => {
      if (state) enabled++;
      else disabled++;
    });
    return { enabledCount: enabled, disabledCount: disabled };
  }, [toolStates]);

  // Model doesn't support tools
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
      {/* Header with tool count */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Box>
          <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
            {hasFocus ? '▶ ' : ''}Tools Configuration
          </Text>
        </Box>
        <Box justifyContent="space-between" marginTop={1}>
          <Text color={uiState.theme.status.success}>
            ✓ Enabled: {enabledCount}
          </Text>
          <Text color={uiState.theme.status.error}>
            ✗ Disabled: {disabledCount}
          </Text>
        </Box>
      </Box>

      {/* Categories and tools (windowed rendering) */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingY={1} overflow="hidden">
        {/* Scroll indicator at top */}
        {scrollOffset > 0 && (
          <Box justifyContent="center" marginBottom={1}>
            <Text color={uiState.theme.text.secondary}>
              ▲ Scroll up for more
            </Text>
          </Box>
        )}

        {/* Render only visible items */}
        {visibleItems.map((item) => {
          if (item.type === 'category') {
            const categoryInfo = categoryData[item.categoryIndex];
            
            // Only show category header if at least one tool from this category is visible
            const hasVisibleTools = visibleItems.some(
              vi => vi.type === 'tool' && vi.categoryIndex === item.categoryIndex
            );

            if (!hasVisibleTools) return null;

            return (
              <Box key={`cat-${item.categoryIndex}`} flexDirection="column" marginTop={item.categoryIndex > 0 ? 1 : 0}>
                {/* Simple plain header */}
                <Text bold color={uiState.theme.text.primary}>
                  {getCategoryIcon(categoryInfo.category)} {categoryInfo.displayName}
                </Text>
              </Box>
            );
          } else {
            // Render tool item
            const categoryInfo = categoryData[item.categoryIndex];
            const tool = categoryInfo.tools[item.toolIndex!];
            const isSelectedCategory = item.categoryIndex === selectedCategoryIndex;
            const isToolSelected = hasFocus && isSelectedCategory && item.toolIndex === selectedToolIndex;
            const isEnabled = toolStates[tool.id] ?? true;

            return (
              <Box key={`tool-${tool.id}`} paddingLeft={2}>
                <ToolItem
                  tool={tool}
                  isEnabled={isEnabled}
                  isSelected={isToolSelected}
                  theme={uiState.theme}
                />
              </Box>
            );
          }
        })}

        {/* Scroll indicator at bottom */}
        {scrollOffset + WINDOW_SIZE < totalItems && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={uiState.theme.text.secondary}>
              ▼ Scroll down for more
            </Text>
          </Box>
        )}
      </Box>

      {/* Help footer */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Text color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
          {hasFocus ? '⌨ ' : ''}↑/↓: Navigate  •  ←/→/Enter: Toggle  •  Esc: Exit{hasUnsavedChanges ? ' (unsaved)' : ''}
        </Text>
      </Box>
    </Box>
  );
}
