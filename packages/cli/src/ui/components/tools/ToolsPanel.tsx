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
    // File Discovery Tools
    'glob': 'This powerful tool searches your entire codebase for files matching specific patterns. It supports glob syntax with wildcards, allowing you to quickly locate files by name, extension, or path structure. Perfect for finding configuration files, source code, or any files matching a specific naming convention across your project.',
    'ls': 'Provides a detailed directory listing showing files, folders, sizes, and permissions. It helps you understand project structure, locate specific directories, and navigate the file system hierarchy. Supports recursive listing to explore nested directory structures.',
    'grep': 'A sophisticated text search tool that scans through file contents to find specific patterns or text. It uses regular expressions for advanced pattern matching, making it ideal for finding function definitions, variable usage, or any text pattern across multiple files. Essential for code analysis and refactoring tasks.',
    
    // File Operations Tools
    'edit_file': 'A precise file editing tool that modifies specific sections of a file using search-and-replace operations. It ensures safe, targeted changes by requiring exact text matching, preventing accidental modifications. Ideal for refactoring, bug fixes, and incremental code updates.',
    'read_file': 'Reads and displays the complete contents of a single file from your workspace. This tool is fundamental for examining source code, configuration files, documentation, or any text-based file. It provides the full context needed to understand file structure and content.',
    'read_many_files': 'Efficiently reads multiple files at once, allowing you to examine several related files simultaneously. This is particularly useful when you need to understand how different parts of your codebase interact, compare implementations, or review related configuration files together.',
    'write_file': 'Creates new files or completely overwrites existing ones with new content. This tool is essential for generating new source files, creating configuration files, or replacing entire file contents when needed. Use with caution as it replaces all existing content.',
    
    // Memory Tools
    'memory': 'Stores and retrieves important information across conversation sessions. Use it to save key decisions, project context, coding patterns, or any information you want to remember for future reference. It creates persistent memory that survives session restarts.',
    'remember': 'A simplified memory tool for quickly storing important facts or information. It provides an easy way to save context that you want the AI to remember throughout your conversation and future sessions.',
    'write_memory_dump': 'Creates a comprehensive snapshot of the current conversation context and memory state. This tool is useful for debugging, creating backups, or exporting the current state of your working session.',
    
    // Context Tools (Goal Management & Reasoning)
    'create_goal': 'Defines a new goal or objective for the AI to work towards. This tool helps structure complex projects by breaking them into manageable, trackable goals that can be pursued systematically. Essential for organizing multi-step development tasks.',
    'complete_goal': 'Marks a specific goal or task as completed in your workflow. This tool helps track progress on multi-step projects, ensuring that completed objectives are properly recorded and acknowledged.',
    'create_checkpoint': 'Creates a snapshot of the current conversation state, allowing you to save important decision points or milestones. You can return to these checkpoints later if needed, making it easier to explore different approaches.',
    'record_decision': 'Documents important decisions made during development, including the rationale behind them. This creates a decision log that helps maintain project consistency and provides context for future changes.',
    'switch_goal': 'Changes focus from one goal to another, allowing you to manage multiple objectives and switch between different aspects of your project as needed. Useful for managing complex projects with multiple workstreams.',
    'read_reasoning': 'Retrieves and reviews previous reasoning, decisions, and thought processes from earlier in the conversation. This helps maintain context and consistency across long development sessions, allowing you to understand why certain decisions were made.',
    'trigger_hot_swap': 'Dynamically switches between different AI models or configurations during a conversation. This advanced tool allows you to leverage different model capabilities for different tasks without restarting your session.',
    
    // Shell Tool
    'shell': 'Executes shell commands directly in your system terminal. This powerful tool allows you to run build scripts, install packages, run tests, manage git operations, or execute any command-line operation. Essential for development workflows and automation.',
    
    // Web Tools
    'web_search': 'Searches the internet for current information, documentation, tutorials, and solutions to technical problems. This tool is invaluable when you need up-to-date information about libraries, frameworks, APIs, or when researching solutions to coding challenges.',
    'web_fetch': 'Retrieves and displays content from specific web URLs. Perfect for accessing online documentation, reading API specifications, fetching remote configuration files, or examining web resources. It brings external web content directly into your workflow.',
    
    // Other Tools (Task Management & Documentation)
    'write_todos': 'Manages a list of pending tasks and action items. Add, complete, or review todos to keep track of what needs to be done in your project. Essential for organizing work and maintaining focus on priorities.',
    'search_documentation': 'Searches through project documentation and indexed content using semantic search. This tool helps you find relevant information in large documentation sets by understanding the meaning of your query, not just keyword matching.',
  };
  return descriptions[toolId] || 'This tool provides specialized functionality for your development workflow. Enable it to access its capabilities during your conversations.';
};

// Tool usage examples with command highlighting
const getToolUsageExample = (toolId: string, accentColor: string): string => {
  const examples: Record<string, string> = {
    // File Discovery Tools
    'glob': 'Use this tool when you need to find files by pattern. For example, to find all TypeScript files: "Find all *.ts files" or "Show me all configuration files matching *.config.js". The tool supports wildcards like * and ** for recursive searches.',
    'ls': 'Use this tool to explore directory structure. For example: "Show me what\'s in the src folder" or "List all files in the current directory". Use the /ls command for quick directory listings.',
    'grep': 'Use this tool to search for text within files. For example: "Search for the function definition of handleSubmit" or "Find all TODO comments in the codebase". You can use regular expressions for advanced pattern matching.',
    
    // File Operations Tools
    'edit_file': 'Use this tool for precise file modifications. Describe the change you want: "Change the port from 3000 to 8080 in server.ts" or "Update the function name from oldName to newName". The tool will show you a diff before applying changes.',
    'read_file': 'Use this tool when you need to examine a specific file. Simply mention the file: "Show me the contents of @src/index.ts" or "Read the package.json file". The @ symbol can be used to reference files explicitly.',
    'read_many_files': 'Use this tool to read several related files at once. For example: "Show me both the component and its test file" or "Read all configuration files in the config directory".',
    'write_file': 'Use this tool to create new files or replace entire file contents. For example: "Create a new component file called Button.tsx" or "Generate a README.md file for this project".',
    
    // Memory Tools
    'memory': 'Use this tool to save important information. For example: "Remember that we\'re using TypeScript strict mode" or "Save the API endpoint URL for later". Use /memory to manage stored information.',
    'remember': 'Use this tool to quickly store facts. For example: "Remember that the database port is 5432" or "Store the fact that we use ESLint for linting".',
    'write_memory_dump': 'Use this tool to create a snapshot of the current session. For example: "Create a memory dump for debugging" or "Export the current conversation state".',
    
    // Context Tools (Goal Management & Reasoning)
    'create_goal': 'Use this tool to define new objectives. For example: "Create a goal to implement user authentication" or "Add a goal for writing unit tests".',
    'complete_goal': 'Use this tool when you finish a task. For example: "Mark the authentication feature as complete" or "Complete the goal of setting up the database".',
    'create_checkpoint': 'Use this tool to save progress points. For example: "Create a checkpoint before refactoring" or "Save the current state as a milestone".',
    'record_decision': 'Use this tool to document important choices. For example: "Record the decision to use PostgreSQL instead of MongoDB" or "Document why we chose this design pattern".',
    'switch_goal': 'Use this tool to change focus. For example: "Switch to working on the frontend" or "Change focus to the testing goal".',
    'read_reasoning': 'Use this tool to review previous decisions. For example: "What was our reasoning for choosing this architecture?" or "Review the decisions made about the database schema".',
    'trigger_hot_swap': 'Use this tool to switch models mid-conversation. For example: "Switch to a faster model for simple tasks" or "Use a more capable model for complex reasoning".',
    
    // Shell Tool
    'shell': 'Use this tool to run terminal commands. For example: "Run npm install" or "Execute the test suite with npm test". Use the /shell command for quick command execution.',
    
    // Web Tools
    'web_search': 'Use this tool when you need current information from the internet. For example: "Search for the latest React 19 features" or "Find documentation for the Express.js middleware API".',
    'web_fetch': 'Use this tool to retrieve content from specific URLs. For example: "Fetch the content from https://api.example.com/docs" or "Get the README from the GitHub repository URL".',
    
    // Other Tools (Task Management & Documentation)
    'write_todos': 'Use this tool to track tasks. For example: "Add a todo to fix the login bug" or "Show me all pending todos". Use /todos to quickly manage your task list.',
    'search_documentation': 'Use this tool to find information in documentation. For example: "Search the docs for authentication examples" or "Find information about the API endpoints".',
  };
  return examples[toolId] || 'This tool can be used by describing what you want to accomplish in natural language. The AI will automatically invoke it when appropriate.';
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
  const [isOnBugReportItem, setIsOnBugReportItem] = useState(false); // Track if Bug Report item is selected
  
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
    return categoryData.reduce((sum, { tools }) => sum + tools.length + 1, 0) + 2; // +1 for category header, +1 for Exit item, +1 for Bug Report item
  }, [categoryData]);

  // Visible window size (adjust based on terminal height)
  const WINDOW_SIZE = windowSize;

  // Calculate which categories and tools should be visible in the current window
  const visibleItems = useMemo(() => {
    const items: Array<{
      type: 'exit' | 'category' | 'tool' | 'bug-report';
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

    // Add Bug Report item at the end
    items.push({
      type: 'bug-report',
      categoryIndex: -1,
      position: position++,
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
    
    if (isOnBugReportItem) {
      // Move from Bug Report to last tool of last category
      const lastCategory = categoryData[categoryData.length - 1];
      setIsOnBugReportItem(false);
      setSelectedCategoryIndex(categoryData.length - 1);
      setSelectedToolIndex(lastCategory.tools.length - 1);
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
    
    if (isOnBugReportItem) {
      // Already at Bug Report, can't go down
      return;
    }
    
    const currentCategory = categoryData[selectedCategoryIndex];
    if (selectedToolIndex < currentCategory.tools.length - 1) {
      setSelectedToolIndex(prev => prev + 1);
    } else if (selectedCategoryIndex < categoryData.length - 1) {
      // Move to next category's first tool
      setSelectedCategoryIndex(prev => prev + 1);
      setSelectedToolIndex(0);
    } else {
      // At last tool of last category, move to Bug Report
      setIsOnBugReportItem(true);
    }
  };

  const handleToggleCurrent = () => {
    if (isOnExitItem || isOnBugReportItem) {
      // No toggle action for Exit or Bug Report items
      return;
    }
    
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
   * - B: Jump to Bug Report
   * - D: Open Discord (when on Bug Report)
   * - G: Open GitHub (when on Bug Report)
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
      if (!isOnBugReportItem) {
        handleToggleCurrent();
      }
    } else if (input.toLowerCase() === 'b') {
      // Jump to Bug Report
      setIsOnExitItem(false);
      setIsOnBugReportItem(true);
      // Scroll to bottom to show Bug Report
      setScrollOffset(Math.max(0, totalItems - WINDOW_SIZE));
    } else if (isOnBugReportItem && input.toLowerCase() === 'd') {
      // Open Discord
      openURL('https://discord.gg/9GuCwdrB');
    } else if (isOnBugReportItem && input.toLowerCase() === 'g') {
      // Open GitHub
      openURL('https://github.com/Tecet/OLLM/issues');
    }
  }, { isActive: hasFocus });

  // Helper function to open URLs
  const openURL = (url: string) => {
    const { exec } = require('child_process');
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

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (isOnExitItem) {
      setScrollOffset(0);
      return;
    }
    
    if (isOnBugReportItem) {
      // Scroll to bottom to show Bug Report
      setScrollOffset(Math.max(0, totalItems - WINDOW_SIZE));
      return;
    }
    
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
  }, [selectedCategoryIndex, selectedToolIndex, isOnExitItem, isOnBugReportItem, categoryData, scrollOffset, WINDOW_SIZE, totalItems]);

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

  // Get tool version and status
  const getToolVersion = (toolId: string): { version: string; status: 'Stable' | 'Beta' | 'Alpha' } => {
    const versions: Record<string, { version: string; status: 'Stable' | 'Beta' | 'Alpha' }> = {
      // File Discovery - Stable
      'glob': { version: 'v0.1.0', status: 'Stable' },
      'grep': { version: 'v0.1.0', status: 'Stable' },
      'ls': { version: 'v0.1.0', status: 'Stable' },
      
      // File Operations - Stable
      'read_file': { version: 'v0.1.0', status: 'Stable' },
      'read_many_files': { version: 'v0.1.0', status: 'Stable' },
      'edit_file': { version: 'v0.1.0', status: 'Stable' },
      'write_file': { version: 'v0.1.0', status: 'Stable' },
      
      // Shell - Stable
      'shell': { version: 'v0.1.0', status: 'Stable' },
      
      // Memory - Stable
      'memory': { version: 'v0.1.0', status: 'Stable' },
      'remember': { version: 'v0.1.0', status: 'Beta' },
      'write_memory_dump': { version: 'v0.1.0', status: 'Beta' },
      
      // Context - Beta/Alpha
      'create_goal': { version: 'v0.1.0', status: 'Beta' },
      'complete_goal': { version: 'v0.1.0', status: 'Beta' },
      'create_checkpoint': { version: 'v0.1.0', status: 'Beta' },
      'record_decision': { version: 'v0.1.0', status: 'Beta' },
      'switch_goal': { version: 'v0.1.0', status: 'Beta' },
      'read_reasoning': { version: 'v0.1.0', status: 'Beta' },
      'trigger_hot_swap': { version: 'v0.1.0', status: 'Alpha' },
      
      // Web - Stable
      'web_search': { version: 'v0.1.0', status: 'Stable' },
      'web_fetch': { version: 'v0.1.0', status: 'Stable' },
      
      // Other
      'write_todos': { version: 'v0.1.0', status: 'Stable' },
      'search_documentation': { version: 'v0.1.0', status: 'Alpha' },
    };
    return versions[toolId] || { version: 'v0.1.0', status: 'Beta' };
  };

  // Get quick commands for tools
  const getQuickCommands = (toolId: string): string[] => {
    const commands: Record<string, string[]> = {
      'ls': ['/ls'],
      'shell': ['/shell'],
      'memory': ['/memory'],
      'write_todos': ['/todos'],
    };
    return commands[toolId] || [];
  };

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
              ↑↓:Nav Enter:Toggle B:Bug 0/Esc:Exit{hasUnsavedChanges ? '*' : ''}
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
              } else if (item.type === 'bug-report') {
                // Render Bug Report item
                return (
                  <>
                    <Text key="bug-report-spacer-1"> </Text>
                    <Text key="bug-report-spacer-2"> </Text>
                    <Box key="bug-report-item">
                      <Text
                        bold={isOnBugReportItem && hasFocus}
                        color={isOnBugReportItem && hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}
                      >
                        🐛 Report Bug          [B]
                      </Text>
                    </Box>
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
                const isToolSelected = hasFocus && !isOnExitItem && !isOnBugReportItem && isSelectedCategory && item.toolIndex === selectedToolIndex;
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
          {isOnBugReportItem ? (
            // Show Bug Report panel
            <Box flexDirection="column">
              <Text bold color={uiState.theme.text.accent}>
                🐛 Found a Bug? We're Here to Help!
              </Text>
              
              <Text></Text>
              <Text></Text>
              
              <Text color={uiState.theme.text.primary}>
                Hey there! 👋
              </Text>
              
              <Text></Text>
              
              <Text color={uiState.theme.text.secondary}>
                Thanks for helping us make OLLM CLI better. Whether you've found a bug,
              </Text>
              <Text color={uiState.theme.text.secondary}>
                have a feature suggestion, or just need help - we'd love to hear from you!
              </Text>
              
              <Text></Text>
              <Text color={uiState.theme.text.secondary}>
                ───────────────────────────────────────────────────────────────────
              </Text>
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
              <Text color={uiState.theme.text.secondary}>
                ───────────────────────────────────────────────────────────────────
              </Text>
              <Text></Text>
              
              <Text bold color={uiState.theme.text.primary}>
                🚀 Choose Your Platform:
              </Text>
              
              <Text></Text>
              
              <Text color={uiState.theme.text.secondary}>
                  <Text color={uiState.theme.text.accent}>[D]</Text> Discord Community (Recommended for quick help)
              </Text>
              <Text color={uiState.theme.text.secondary}>
                      Chat with the community, get instant feedback, and report bugs
              </Text>
              <Text color={uiState.theme.text.accent}>
                      https://discord.gg/9GuCwdrB
              </Text>
              
              <Text></Text>
              
              <Text color={uiState.theme.text.secondary}>
                  <Text color={uiState.theme.text.accent}>[G]</Text> GitHub Issues (For detailed bug reports)
              </Text>
              <Text color={uiState.theme.text.secondary}>
                      Create a formal issue with full details and tracking
              </Text>
              <Text color={uiState.theme.text.accent}>
                      https://github.com/Tecet/OLLM/issues
              </Text>
              
              <Text></Text>
              <Text color={uiState.theme.text.secondary}>
                ───────────────────────────────────────────────────────────────────
              </Text>
              <Text></Text>
              
              <Text color={uiState.theme.text.secondary}>
                💡 Pro Tip: Discord is great for quick questions and discussions,
              </Text>
              <Text color={uiState.theme.text.secondary}>
                           while GitHub is better for detailed bug tracking.
              </Text>
              
              <Text></Text>
              
              <Text color={uiState.theme.text.secondary} dimColor>
                Navigation: Press D for Discord • Press G for GitHub • Esc to go back
              </Text>
            </Box>
          ) : selectedTool ? (
            <>
              {/* Tool name */}
              <Text bold color={uiState.theme.text.accent}>
                {selectedTool.displayName}
              </Text>

              {/* Tool version and status */}
              <Box marginTop={1}>
                {(() => {
                  const { version, status } = getToolVersion(selectedTool.id);
                  const statusColor = 
                    status === 'Stable' ? uiState.theme.status.success :
                    status === 'Beta' ? uiState.theme.status.warning :
                    uiState.theme.status.error;
                  
                  return (
                    <Text color={uiState.theme.text.secondary}>
                      Version: {version} <Text color={statusColor}>({status})</Text>
                    </Text>
                  );
                })()}
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

              {/* Quick Commands (if available) */}
              {(() => {
                const commands = getQuickCommands(selectedTool.id);
                if (commands.length > 0) {
                  return (
                    <Box marginTop={2} flexDirection="column">
                      <Text bold color={uiState.theme.text.primary}>Quick Commands:</Text>
                      <Text></Text>
                      {commands.map(cmd => (
                        <Text key={cmd} color={uiState.theme.text.accent}>
                          {cmd} - Quick access in chat
                        </Text>
                      ))}
                    </Box>
                  );
                }
                return null;
              })()}
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
