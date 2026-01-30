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

import { ToolModeSettings } from './ToolModeSettings.js';
import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useTools } from '../../contexts/ToolsContext.js';
import { useTabEscapeHandler } from '../../hooks/useTabEscapeHandler.js';

export interface ToolsPanelProps {
  modelSupportsTools?: boolean;
  windowWidth?: number;
}

type LeftNavItem = 'exit' | 'tool';

const MODES = ['developer', 'debugger', 'assistant', 'planning', 'user'];

// Enhanced tool descriptions
const getEnhancedDescription = (toolId: string): string => {
  const descriptions: Record<string, string> = {
    // File Discovery Tools
    glob: 'This powerful tool searches your entire codebase for files matching specific patterns. It supports glob syntax with wildcards, allowing you to quickly locate files by name, extension, or path structure. Perfect for finding configuration files, source code, or any files matching a specific naming convention across your project.',
    ls: 'Provides a detailed directory listing showing files, folders, sizes, and permissions. It helps you understand project structure, locate specific directories, and navigate the file system hierarchy. Supports recursive listing to explore nested directory structures.',
    grep: 'A sophisticated text search tool that scans through file contents to find specific patterns or text. It uses regular expressions for advanced pattern matching, making it ideal for finding function definitions, variable usage, or any text pattern across multiple files. Essential for code analysis and refactoring tasks.',

    // File Operations Tools
    edit_file:
      'A precise file editing tool that modifies specific sections of a file using search-and-replace operations. It ensures safe, targeted changes by requiring exact text matching, preventing accidental modifications. Ideal for refactoring, bug fixes, and incremental code updates.',
    read_file:
      'Reads and displays the complete contents of a single file from your workspace. This tool is fundamental for examining source code, configuration files, documentation, or any text-based file. It provides the full context needed to understand file structure and content.',
    read_many_files:
      'Efficiently reads multiple files at once, allowing you to examine several related files simultaneously. This is particularly useful when you need to understand how different parts of your codebase interact, compare implementations, or review related configuration files together.',
    write_file:
      'Creates new files or completely overwrites existing ones with new content. This tool is essential for generating new source files, creating configuration files, or replacing entire file contents when needed. Use with caution as it replaces all existing content.',

    // Memory Tools
    memory:
      'Stores and retrieves important information across conversation sessions. Use it to save key decisions, project context, coding patterns, or any information you want to remember for future reference. It creates persistent memory that survives session restarts.',
    remember:
      'A simplified memory tool for quickly storing important facts or information. It provides an easy way to save context that you want the AI to remember throughout your conversation and future sessions.',
    write_memory_dump:
      'Creates a comprehensive snapshot of the current conversation context and memory state. This tool is useful for debugging, creating backups, or exporting the current state of your working session.',

    // Context Tools
    create_goal:
      'Defines a new goal or objective for the AI to work towards. This tool helps structure complex projects by breaking them into manageable, trackable goals that can be pursued systematically. Essential for organizing multi-step development tasks.',
    complete_goal:
      'Marks a specific goal or task as completed in your workflow. This tool helps track progress on multi-step projects, ensuring that completed objectives are properly recorded and acknowledged.',
    create_checkpoint:
      'Creates a snapshot of the current conversation state, allowing you to save important decision points or milestones. You can return to these checkpoints later if needed, making it easier to explore different approaches.',
    record_decision:
      'Documents important decisions made during development, including the rationale behind them. This creates a decision log that helps maintain project consistency and provides context for future changes.',
    switch_goal:
      'Changes focus from one goal to another, allowing you to manage multiple objectives and switch between different aspects of your project as needed. Useful for managing complex projects with multiple workstreams.',
    read_reasoning:
      'Retrieves and reviews previous reasoning, decisions, and thought processes from earlier in the conversation. This helps maintain context and consistency across long development sessions, allowing you to understand why certain decisions were made.',
    trigger_hot_swap:
      'Dynamically switches between different AI models or configurations during a conversation. This advanced tool allows you to leverage different model capabilities for different tasks without restarting your session.',

    // Shell Tool
    shell:
      'Executes shell commands directly in your system terminal. This powerful tool allows you to run build scripts, install packages, run tests, manage git operations, or execute any command-line operation. Essential for development workflows and automation.',

    // Web Tools
    web_search:
      'Searches the internet for current information, documentation, tutorials, and solutions to technical problems. This tool is invaluable when you need up-to-date information about libraries, frameworks, APIs, or when researching solutions to coding challenges.',
    web_fetch:
      'Retrieves and displays content from specific web URLs. Perfect for accessing online documentation, reading API specifications, fetching remote configuration files, or examining web resources. It brings external web content directly into your workflow.',

    // Other Tools
    write_todos:
      'Manages a list of pending tasks and action items. Add, complete, or review todos to keep track of what needs to be done in your project. Essential for organizing work and maintaining focus on priorities.',
    search_documentation:
      'Searches through project documentation and indexed content using semantic search. This tool helps you find relevant information in large documentation sets by understanding the meaning of your query, not just keyword matching.',
  };
  return (
    descriptions[toolId] ||
    'This tool provides specialized functionality for your development workflow. Enable it to access its capabilities during your conversations.'
  );
};

// Tool usage examples
const getToolUsageExample = (toolId: string): string => {
  const examples: Record<string, string> = {
    // File Discovery Tools
    glob: 'Use this tool when you need to find files by pattern. For example, to find all TypeScript files: "Find all *.ts files" or "Show me all configuration files matching *.config.js". The tool supports wildcards like * and ** for recursive searches.',
    ls: 'Use this tool to explore directory structure. For example: "Show me what\'s in the src folder" or "List all files in the current directory". Use the /ls command for quick directory listings.',
    grep: 'Use this tool to search for text within files. For example: "Search for the function definition of handleSubmit" or "Find all TODO comments in the codebase". You can use regular expressions for advanced pattern matching.',

    // File Operations Tools
    edit_file:
      'Use this tool for precise file modifications. Describe the change you want: "Change the port from 3000 to 8080 in server.ts" or "Update the function name from oldName to newName". The tool will show you a diff before applying changes.',
    read_file:
      'Use this tool when you need to examine a specific file. Simply mention the file: "Show me the contents of @src/index.ts" or "Read the package.json file". The @ symbol can be used to reference files explicitly.',
    read_many_files:
      'Use this tool to read several related files at once. For example: "Show me both the component and its test file" or "Read all configuration files in the config directory".',
    write_file:
      'Use this tool to create new files or replace entire file contents. For example: "Create a new component file called Button.tsx" or "Generate a README.md file for this project".',

    // Memory Tools
    memory:
      'Use this tool to save important information. For example: "Remember that we\'re using TypeScript strict mode" or "Save the API endpoint URL for later". Use /memory to manage stored information.',
    remember:
      'Use this tool to quickly store facts. For example: "Remember that the database port is 5432" or "Store the fact that we use ESLint for linting".',
    write_memory_dump:
      'Use this tool to create a snapshot of the current session. For example: "Create a memory dump for debugging" or "Export the current conversation state".',

    // Context Tools
    create_goal:
      'Use this tool to define new objectives. For example: "Create a goal to implement user authentication" or "Add a goal for writing unit tests".',
    complete_goal:
      'Use this tool when you finish a task. For example: "Mark the authentication feature as complete" or "Complete the goal of setting up the database".',
    create_checkpoint:
      'Use this tool to save progress points. For example: "Create a checkpoint before refactoring" or "Save the current state as a milestone".',
    record_decision:
      'Use this tool to document important choices. For example: "Record the decision to use PostgreSQL instead of MongoDB" or "Document why we chose this design pattern".',
    switch_goal:
      'Use this tool to change focus. For example: "Switch to working on the frontend" or "Change focus to the testing goal".',
    read_reasoning:
      'Use this tool to review previous decisions. For example: "What was our reasoning for choosing this architecture?" or "Review the decisions made about the database schema".',
    trigger_hot_swap:
      'Use this tool to switch models mid-conversation. For example: "Switch to a faster model for simple tasks" or "Use a more capable model for complex reasoning".',

    // Shell Tool
    shell:
      'Use this tool to run terminal commands. For example: "Run npm install" or "Execute the test suite with npm test". Use the /shell command for quick command execution.',

    // Web Tools
    web_search:
      'Use this tool when you need current information from the internet. For example: "Search for the latest React 19 features" or "Find documentation for the Express.js middleware API".',
    web_fetch:
      'Use this tool to retrieve content from specific URLs. For example: "Fetch the content from https://api.example.com/docs" or "Get the README from the GitHub repository URL".',

    // Other Tools
    write_todos:
      'Use this tool to track tasks. For example: "Add a todo to fix the login bug" or "Show me all pending todos". Use /todos to quickly manage your task list.',
    search_documentation:
      'Use this tool to find information in documentation. For example: "Search the docs for authentication examples" or "Find information about the API endpoints".',
  };
  return (
    examples[toolId] ||
    'This tool can be used by describing what you want to accomplish in natural language. The AI will automatically invoke it when appropriate.'
  );
};

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

      // Left/Right to switch columns
      if (key.leftArrow && activeColumn === 'right') {
        setActiveColumn('left');
        return;
      }
      if (key.rightArrow && activeColumn === 'left') {
        setActiveColumn('right');
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
            ←→:Switch ↑↓:Nav Enter:Toggle A:Apply R:Reset Esc:Exit
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
                    selectedTool.enabled ? uiState.theme.status.success : uiState.theme.status.error
                  }
                >
                  Status: {selectedTool.enabled ? '✓ Enabled Globally' : '✗ Disabled Globally'}
                </Text>
              </Box>

              <Text> </Text>

              {/* Enhanced tool description */}
              <Box flexDirection="column">
                <Text color={uiState.theme.text.primary}>
                  {getEnhancedDescription(selectedTool.id)}
                </Text>
              </Box>

              <Text> </Text>

              {/* Example of use */}
              <Box flexDirection="column">
                <Text bold color={uiState.theme.text.primary}>
                  Example of use:
                </Text>
                <Text> </Text>
                <Text color={uiState.theme.text.secondary}>
                  {getToolUsageExample(selectedTool.id)}
                </Text>
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
