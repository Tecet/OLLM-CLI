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
  | 'context';

export type ToolRisk = 'low' | 'medium' | 'high';

export interface ToolMetadata {
  id: string;
  displayName: string;
  category: ToolCategory;
  description: string;
  docLink?: string;
  risk: ToolRisk;
}

/**
 * Default tool registry
 * 
 * All 15 built-in tools with their metadata.
 * Tools are organized into 6 categories:
 * - File Operations: read, write, edit files
 * - File Discovery: search and list files
 * - Shell: execute shell commands
 * - Web: fetch and search web content
 * - Memory: store and retrieve information
 * - Context: manage conversation context
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
    id: 'memory-dump',
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
    id: 'hot-swap',
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
];

/**
 * Get tool metadata by ID
 * @param toolId - The tool identifier
 * @returns The tool metadata if found, undefined otherwise
 */
export function getToolMetadata(toolId: string): ToolMetadata | undefined {
  return DEFAULT_TOOLS.find(tool => tool.id === toolId);
}

/**
 * Get all tools in a specific category
 * @param category - The tool category to filter by
 * @returns Array of tool metadata for the specified category
 */
export function getToolsByCategory(category: ToolCategory): ToolMetadata[] {
  return DEFAULT_TOOLS.filter(tool => tool.category === category);
}

/**
 * Get all available categories
 * @returns Array of all tool categories
 */
export function getAllCategories(): ToolCategory[] {
  return [
    'file-operations',
    'file-discovery',
    'shell',
    'web',
    'memory',
    'context',
  ];
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
    'shell': 'Shell',
    'web': 'Web',
    'memory': 'Memory',
    'context': 'Context',
  };
  return displayNames[category];
}
