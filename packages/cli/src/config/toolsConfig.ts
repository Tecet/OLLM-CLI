/**
 * Tool Configuration Registry
 *
 * Defines all available tools with metadata for the Tools Panel UI.
 * This is the source of truth for tool information, categories, and default states.
 */

export type ToolCategory =
  | 'file-operations'
  | 'file-discovery'
  | 'shell'
  | 'web'
  | 'memory'
  | 'context'
  | 'goals'; // Goal management tools (under development)

export type ToolRisk = 'low' | 'medium' | 'high';

export interface ToolMetadata {
  id: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  docLink?: string;
  risk: ToolRisk;
  disabled?: boolean; // If true, tool is disabled and cannot be enabled
  disabledReason?: string; // Reason why tool is disabled (e.g., "Under Development")
}

/**
 * Default tool registry
 *
 * All 20 built-in tools with their metadata (5 disabled).
 * Tools are organized into 7 categories:
 * - File Operations: read, write, edit files
 * - File Discovery: search and list files
 * - Shell: execute shell commands
 * - Web: fetch and search web content
 * - Memory: store and retrieve information
 * - Context: manage conversation context
 * - Goals: goal management (DISABLED - under development)
 */
export const DEFAULT_TOOLS: ToolMetadata[] = [
  // File Operations (3 tools)
  {
    id: 'read-file',
    displayName: 'Read File',
    category: 'file-operations',
    description: 'Read contents of a single file with optional line ranges',
    risk: 'low',
  },
  {
    id: 'write-file',
    displayName: 'Write File',
    category: 'file-operations',
    description: 'Create or overwrite files with new content',
    risk: 'high',
  },
  {
    id: 'edit-file',
    displayName: 'Edit File',
    category: 'file-operations',
    description: 'Make targeted edits to existing files using string replacement',
    risk: 'high',
  },

  // File Discovery (3 tools)
  {
    id: 'read-many-files',
    displayName: 'Read Multiple Files',
    category: 'file-discovery',
    description: 'Read contents of multiple files at once',
    risk: 'low',
  },
  {
    id: 'glob',
    displayName: 'Glob Search',
    category: 'file-discovery',
    description: 'Find files using glob patterns (e.g., **/*.ts)',
    risk: 'low',
  },
  {
    id: 'grep',
    displayName: 'Grep Search',
    category: 'file-discovery',
    description: 'Search file contents using regex patterns',
    risk: 'low',
  },
  {
    id: 'ls',
    displayName: 'List Directory',
    category: 'file-discovery',
    description: 'List files and directories with optional recursion',
    risk: 'low',
  },

  // Shell (1 tool)
  {
    id: 'shell',
    displayName: 'Shell Execute',
    category: 'shell',
    description: 'Execute shell commands in the workspace',
    risk: 'high',
  },

  // Web (2 tools)
  {
    id: 'web-fetch',
    displayName: 'Web Fetch',
    category: 'web',
    description: 'Fetch and extract content from URLs',
    risk: 'medium',
  },
  {
    id: 'web-search',
    displayName: 'Web Search',
    category: 'web',
    description: 'Search the web for information',
    risk: 'medium',
  },

  // Memory (3 tools)
  {
    id: 'memory',
    displayName: 'Memory Store',
    category: 'memory',
    description: 'Store information for later retrieval',
    risk: 'low',
  },
  {
    id: 'write_memory_dump',
    displayName: 'Memory Dump',
    category: 'memory',
    description: 'Retrieve all stored memory entries',
    risk: 'low',
  },
  {
    id: 'remember',
    displayName: 'Remember',
    category: 'memory',
    description: 'Store key-value pairs in memory',
    risk: 'low',
  },

  // Context (3 tools)
  {
    id: 'trigger_hot_swap',
    displayName: 'Model Hot Swap',
    category: 'context',
    description: 'Switch to a different model mid-conversation',
    risk: 'low',
  },
  {
    id: 'write-todos',
    displayName: 'Write TODOs',
    category: 'context',
    description: 'Create TODO lists and task tracking files',
    risk: 'medium',
  },

  // Goals (5 tools - UNDER DEVELOPMENT)
  // These tools are disabled because they cause LLMs to call tools unnecessarily
  {
    id: 'create_goal',
    displayName: 'Create Goal',
    category: 'goals',
    description: 'Create a new goal or task to work on',
    risk: 'low',
    disabled: true,
    disabledReason: 'Under Development - Causes unnecessary tool calls',
  },
  {
    id: 'create_checkpoint',
    displayName: 'Create Checkpoint',
    category: 'goals',
    description: 'Create a checkpoint for the current goal',
    risk: 'low',
    disabled: true,
    disabledReason: 'Under Development - Causes unnecessary tool calls',
  },
  {
    id: 'complete_goal',
    displayName: 'Complete Goal',
    category: 'goals',
    description: 'Mark a goal as complete',
    risk: 'low',
    disabled: true,
    disabledReason: 'Under Development - Causes unnecessary tool calls',
  },
  {
    id: 'record_decision',
    displayName: 'Record Decision',
    category: 'goals',
    description: 'Record a decision made during goal execution',
    risk: 'low',
    disabled: true,
    disabledReason: 'Under Development - Causes unnecessary tool calls',
  },
  {
    id: 'switch_goal',
    displayName: 'Switch Goal',
    category: 'goals',
    description: 'Switch to a different goal',
    risk: 'low',
    disabled: true,
    disabledReason: 'Under Development - Causes unnecessary tool calls',
  },
];

/**
 * Get tool metadata by ID
 * @param toolId - The tool identifier
 * @returns The tool metadata if found, undefined otherwise
 */
export function getToolMetadata(toolId: string): ToolMetadata | undefined {
  return DEFAULT_TOOLS.find((tool) => tool.id === toolId);
}

/**
 * Get all tools in a specific category
 * @param category - The tool category to filter by
 * @returns Array of tool metadata for the specified category
 */
export function getToolsByCategory(category: ToolCategory): ToolMetadata[] {
  return DEFAULT_TOOLS.filter((tool) => tool.category === category);
}

/**
 * Get all available categories
 * @returns Array of all tool categories
 */
export function getAllCategories(): ToolCategory[] {
  return ['file-operations', 'file-discovery', 'shell', 'web', 'memory', 'context', 'goals'];
}

/**
 * Get category display name
 * @param category - The tool category
 * @returns Human-readable display name for the category
 */
export function getCategoryDisplayName(category: ToolCategory): string {
  const displayNames: Record<ToolCategory, string> = {
    'file-operations': 'File Operations',
    'file-discovery': 'File Discovery',
    shell: 'Shell',
    web: 'Web',
    memory: 'Memory',
    context: 'Context',
    goals: 'Goals (Under Development)',
  };
  return displayNames[category];
}
