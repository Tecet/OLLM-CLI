import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { ToolToggle } from './ToolToggle.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useTools } from '../../contexts/ToolsContext.js';
import { useTabEscapeHandler } from '../../hooks/useTabEscapeHandler.js';

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

// Enhanced tool descriptions
const getEnhancedDescription = (toolId: string): string => {
  const descriptions: Record<string, string> = {
    'glob': 'This powerful tool searches your entire codebase for files matching specific patterns. It supports glob syntax with wildcards, allowing you to quickly locate files by name, extension, or path structure. Perfect for finding configuration files, source code, or any files matching a specific naming convention across your project.',
    'grep': 'A sophisticated text search tool that scans through file contents to find specific patterns or text. It uses regular expressions for advanced pattern matching, making it ideal for finding function definitions, variable usage, or any text pattern across multiple files. Essential for code analysis and refactoring tasks.',
    'read-file': 'Reads and displays the complete contents of a single file from your workspace. This tool is fundamental for examining source code, configuration files, documentation, or any text-based file. It provides the full context needed to understand file structure and content.',
    'read-multiple-files': 'Efficiently reads multiple files at once, allowing you to examine several related files simultaneously. This is particularly useful when you need to understand how different parts of your codebase interact, compare implementations, or review related configuration files together.',
    'edit-file': 'A precise file editing tool that modifies specific sections of a file using search-and-replace operations. It ensures safe, targeted changes by requiring exact text matching, preventing accidental modifications. Ideal for refactoring, bug fixes, and incremental code updates.',
    'write-file': 'Creates new files or completely overwrites existing ones with new content. This tool is essential for generating new source files, creating configuration files, or replacing entire file contents when needed. Use with caution as it replaces all existing content.',
    'list-directory': 'Provides a detailed directory listing showing files, folders, sizes, and permissions. It helps you understand project structure, locate specific directories, and navigate the file system hierarchy. Supports recursive listing to explore nested directory structures.',
    'search-web': 'Searches the internet for current information, documentation, tutorials, and solutions to technical problems. This tool is invaluable when you need up-to-date information about libraries, frameworks, APIs, or when researching solutions to coding challenges.',
    'fetch-web': 'Retrieves and displays content from specific web URLs. Perfect for accessing online documentation, reading API specifications, fetching remote configuration files, or examining web resources. It brings external web content directly into your workflow.',
    'execute-shell': 'Executes shell commands directly in your system terminal. This powerful tool allows you to run build scripts, install packages, run tests, manage git operations, or execute any command-line operation. Essential for development workflows and automation.',
    'memory': 'Stores and retrieves important information across conversation sessions. Use it to save key decisions, project context, coding patterns, or any information you want to remember for future reference. It creates persistent memory that survives session restarts.',
    'complete-goal': 'Marks a specific goal or task as completed in your workflow. This tool helps track progress on multi-step projects, ensuring that completed objectives are properly recorded and acknowledged.',
    'create-checkpoint': 'Creates a snapshot of the current conversation state, allowing you to save important decision points or milestones. You can return to these checkpoints later if needed, making it easier to explore different approaches.',
    'create-goal': 'Defines a new goal or objective for the AI to work towards. This tool helps structure complex projects by breaking them into manageable, trackable goals that can be pursued systematically.',
    'manage-todos': 'Manages a list of pending tasks and action items. Add, complete, or review todos to keep track of what needs to be done in your project. Essential for organizing work and maintaining focus on priorities.',
    'read-past-reasoning': 'Retrieves and reviews previous reasoning, decisions, and thought processes from earlier in the conversation. This helps maintain context and consistency across long development sessions.',
    'record-decision': 'Documents important decisions made during development, including the rationale behind them. This creates a decision log that helps maintain project consistency and provides context for future changes.',
    'switch-goal': 'Changes focus from one goal to another, allowing you to manage multiple objectives and switch between different aspects of your project as needed.',
  };
  return descriptions[toolId] || 'No detailed description available for this tool.';
};

// Tool usage examples with command highlighting
const getToolUsageExample = (toolId: string, accentColor: string): string => {
  const examples: Record<string, string> = {
    'glob': 'Use this tool when you need to find files by pattern. For example, to find all TypeScript files: "Find all *.ts files" or "Show me all configuration files matching *.config.js". The tool supports wildcards like * and ** for recursive searches.',
    'grep': 'Use this tool to search for text within files. For example: "Search for the function definition of handleSubmit" or "Find all TODO comments in the codebase". You can use regular expressions for advanced pattern matching.',
    'read-file': 'Use this tool when you need to examine a specific file. Simply mention the file: "Show me the contents of @src/index.ts" or "Read the package.json file". The @ symbol can be used to reference files explicitly.',
    'read-multiple-files': 'Use this tool to read several related files at once. For example: "Show me both the component and its test file" or "Read all configuration files in the config directory".',
    'edit-file': 'Use this tool for precise file modifications. Describe the change you want: "Change the port from 3000 to 8080 in server.ts" or "Update the function name from oldName to newName". The tool will show you a diff before applying changes.',
    'write-file': 'Use this tool to create new files or replace entire file contents. For example: "Create a new component file called Button.tsx" or "Generate a README.md file for this project".',
    'list-directory': 'Use this tool to explore directory structure. For example: "Show me what\'s in the src folder" or "List all files in the current directory". Use the /ls command for quick directory listings.',
    'search-web': 'Use this tool when you need current information from the internet. For example: "Search for the latest React 19 features" or "Find documentation for the Express.js middleware API".',
    'fetch-web': 'Use this tool to retrieve content from specific URLs. For example: "Fetch the content from https://api.example.com/docs" or "Get the README from the GitHub repository URL".',
    'execute-shell': 'Use this tool to run terminal commands. For example: "Run npm install" or "Execute the test suite with npm test". Use the /shell command for quick command execution.',
    'memory': 'Use this tool to save important information. For example: "Remember that we\'re using TypeScript strict mode" or "Save the API endpoint URL for later". Use /memory to manage stored information.',
    'complete-goal': 'Use this tool when you finish a task. For example: "Mark the authentication feature as complete" or "Complete the goal of setting up the database".',
    'create-checkpoint': 'Use this tool to save progress points. For example: "Create a checkpoint before refactoring" or "Save the current state as a milestone".',
    'create-goal': 'Use this tool to define new objectives. For example: "Create a goal to implement user authentication" or "Add a goal for writing unit tests".',
    'manage-todos': 'Use this tool to track tasks. For example: "Add a todo to fix the login bug" or "Show me all pending todos". Use /todos to quickly manage your task list.',
    'read-past-reasoning': 'Use this tool to review previous decisions. For example: "What was our reasoning for choosing this architecture?" or "Review the decisions made about the database schema".',
    'record-decision': 'Use this tool to document important choices. For example: "Record the decision to use PostgreSQL instead of MongoDB" or "Document why we chose this design pattern".',
    'switch-goal': 'Use this tool to change focus. For example: "Switch to working on the frontend" or "Change focus to the testing goal".',
  };
  return examples[toolId] || 'This tool can be used by describing what you want to accomplish in natural language.';
};

export interface ToolsPanelProps {
  modelSupportsTools?: boolean;
  windowSize?: number;
  windowWidth?: number;
}

/**
 * ToolsPanel component
 * 
 * Displays all available tools organized by category with enable/disable toggles.
 * Supports keyboard navigation and windowed rendering for scrolling.
 * 
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 23.1, 23.5, 24.1, 24.2, 24.3, 24.4, 25.1, 25.2, 25.3, 25.4
 */
export function ToolsPanel({ modelSupportsTools = true, windowSize = 30, windowWidth }: ToolsPanelProps) {
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const { state: toolsState, toggleTool, refreshTools } = useTools();
  
  // Check if this panel has focus
  const hasFocus = isFocused('tools-panel');
  
  // Use shared escape handler for consistent navigation
  useTabEscapeHandler(hasFocus);

  // Calculate absolute widths if windowWidth is provided
  const absoluteLeftWidth = windowWidth ? Math.floor(windowWidth * 0.3) : undefined;
  const absoluteRightWidth = windowWidth && absoluteLeftWidth ? (windowWidth - absoluteLeftWidth) : undefined;
  
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

  // Handle save (currently unused - settings auto-persist via toggleTool)
  const _handleSave = () => {
    // Settings are already persisted via toggleTool
    // Just clear the unsaved changes flag and refresh
    setHasUnsavedChanges(false);
    refreshTools();
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
    const currentCategory = categoryData[selectedCategoryIndex];
    const currentTool = currentCategory.tools[selectedToolIndex];
    if (currentTool) {
      handleToggle(currentTool.id);
    }
  };

  /**
   * Keyboard Navigation
   * 
   * Navigation Keys:
   * - ↑/↓: Navigate through tools
   * - ←/→/Enter: Toggle tool enable/disable
   * - ESC/0: Exit to nav bar (handled by useTabEscapeHandler)
   * 
   * Note: ESC handling is now managed by the shared useTabEscapeHandler hook
   * for consistent hierarchical navigation across all tab components.
   */
  useInput((input, key) => {
    if (!hasFocus) return;

    if (key.upArrow) {
      handleNavigateUp();
    } else if (key.downArrow) {
      handleNavigateDown();
    } else if (key.leftArrow || key.rightArrow || key.return) {
      handleToggleCurrent();
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

  return (
    <Box flexDirection="column" height="100%" width={windowWidth}>
      {/* Header */}
      <Box
        flexDirection="column"
        paddingX={1}
        flexShrink={0}
      >
        {!modelSupportsTools && (
          <Box marginBottom={1} paddingX={1} borderStyle="round" borderColor={uiState.theme.status.warning}>
            <Text color={uiState.theme.status.warning} bold>
              ⚠ Model doesn't support tools. These settings will take effect when you switch to a compatible model.
            </Text>
          </Box>
        )}
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              Tools Configuration
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text wrap="truncate-end" color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}>
              ↑↓:Nav Enter:Toggle 0/Esc:Exit{hasUnsavedChanges ? '*' : ''}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden" width="100%" flexDirection="row">
        {/* Left column: Tool list (30%) */}
        <Box 
          flexDirection="column" 
          width={absoluteLeftWidth ?? "30%"} 
          borderStyle="single" 
          borderColor={hasFocus ? uiState.theme.border.active : uiState.theme.border.primary}
          paddingY={1}
        >
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
                        color={isOnExitItem && hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}
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
                        color={isToolSelected ? uiState.theme.text.accent : uiState.theme.text.primary}
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
        <Box 
          flexDirection="column" 
          width={absoluteRightWidth ?? "70%"} 
          borderStyle="single" 
          borderColor={uiState.theme.border.primary} 
          paddingX={2} 
          paddingY={2}
        >
          {selectedTool ? (
            <>
              {/* Tool name */}
              <Text bold color={uiState.theme.text.accent}>
                {selectedTool.displayName}
              </Text>

              {/* Tool version */}
              <Box marginTop={1}>
                <Text color={uiState.theme.text.secondary}>
                  Version: v0.1.0
                </Text>
              </Box>

              {/* Tool status */}
              <Box marginTop={1}>
                <Text color={toolStates[selectedTool.id] ? uiState.theme.status.success : uiState.theme.status.error}>
                  Status: {toolStates[selectedTool.id] ? '✓ Enabled' : '✗ Disabled'}
                </Text>
              </Box>

              <Text></Text>
              <Text></Text>

              {/* Enhanced tool description */}
              <Box marginTop={1} flexDirection="column">
                <Text color={uiState.theme.text.primary}>
                  {getEnhancedDescription(selectedTool.id)}
                </Text>
              </Box>

              {/* Example of use */}
              <Box marginTop={2} flexDirection="column">
                <Text bold color={uiState.theme.text.primary}>Example of use:</Text>
                <Text></Text>
                <Text color={uiState.theme.text.secondary}>
                  {getToolUsageExample(selectedTool.id, uiState.theme.text.accent)}
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
