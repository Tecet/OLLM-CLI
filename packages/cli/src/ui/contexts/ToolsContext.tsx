/**
 * ToolsContext - Manages tool state and operations for the Tools Panel UI
 * 
 * Provides centralized state management for:
 * - Loading tools from ToolRegistry (dynamic)
 * - Managing enabled/disabled state via SettingsService
 * - Categorizing tools by type
 * - Real-time updates when tools are registered/unregistered
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';

import { SettingsService } from '../../config/settingsService.js';
import { useServices } from '../../features/context/ServiceContext.js';

import type { DeclarativeTool, ToolSchema } from '@ollm/ollm-cli-core/tools/types.js';

/**
 * Tool category for organizing tools in the UI
 */
export type ToolCategory = 
  | 'file-operations'
  | 'file-discovery'
  | 'shell'
  | 'web'
  | 'memory'
  | 'context'
  | 'mcp'
  | 'extension'
  | 'other';

/**
 * Tool information for UI display
 */
export interface ToolInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: ToolCategory;
  enabled: boolean;
  schema: ToolSchema;
}

/**
 * Tool category group
 */
export interface ToolCategoryGroup {
  category: ToolCategory;
  displayName: string;
  icon: string;
  tools: ToolInfo[];
}

/**
 * Tools state in the context
 */
export interface ToolsState {
  /** All tools organized by category */
  categories: ToolCategoryGroup[];
  /** All tools as a flat array */
  allTools: ToolInfo[];
  /** Set of enabled tool IDs */
  enabledTools: Set<string>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
}

/**
 * Tools context value
 */
export interface ToolsContextValue {
  /** Current state */
  state: ToolsState;
  /** Reload tools from registry */
  refreshTools: () => void;
  /** Toggle tool enabled state */
  toggleTool: (toolId: string) => Promise<void>;
  /** Check if a tool is enabled */
  isToolEnabled: (toolId: string) => boolean;
  /** Get tool by ID */
  getTool: (toolId: string) => ToolInfo | undefined;
}

const ToolsContext = createContext<ToolsContextValue | undefined>(undefined);

/**
 * Hook to access tools context
 */
export function useTools(): ToolsContextValue {
  const context = useContext(ToolsContext);
  if (!context) {
    throw new Error('useTools must be used within a ToolsProvider');
  }
  return context;
}

export interface ToolsProviderProps {
  children: ReactNode;
  /** Optional SettingsService instance (for testing) */
  settingsService?: SettingsService;
}

/**
 * Categorize a tool based on its name and description
 */
function categorizeTool(tool: DeclarativeTool<any, any>): ToolCategory {
  const name = String(tool.name).toLowerCase();
  
  // File Discovery: glob, grep, ls
  if (name === 'glob' || name === 'grep' || name === 'ls') {
    return 'file-discovery';
  }
  
  // File Operations: read_file, read_many_files, edit_file, write_file
  if (name === 'read_file' || name === 'read_many_files' || name === 'edit_file' || name === 'write_file') {
    return 'file-operations';
  }
  
  // Shell: shell
  if (name === 'shell') {
    return 'shell';
  }
  
  // Memory: memory, remember, write_memory_dump
  if (name === 'memory' || name === 'remember' || name === 'write_memory_dump') {
    return 'memory';
  }
  
  // Context: create_goal, complete_goal, create_checkpoint, record_decision, switch_goal, read_reasoning, trigger_hot_swap
  if (name === 'create_goal' || name === 'complete_goal' || name === 'create_checkpoint' || 
      name === 'record_decision' || name === 'switch_goal' || name === 'read_reasoning' || 
      name === 'trigger_hot_swap') {
    return 'context';
  }
  
  // Web: web_search, web_fetch
  if (name === 'web_search' || name === 'web_fetch') {
    return 'web';
  }
  
  // MCP tools (from Model Context Protocol)
  if (name.startsWith('mcp_')) {
    return 'mcp';
  }
  
  // Extension tools
  if (name.includes('extension')) {
    return 'extension';
  }
  
  // Other: write_todos, search_documentation, and anything else
  return 'other';
}

/**
 * Get display name for a category
 */
function getCategoryDisplayName(category: ToolCategory): string {
  const names: Record<ToolCategory, string> = {
    'file-discovery': 'File Discovery',
    'file-operations': 'File Operations',
    'shell': 'Shell',
    'memory': 'Memory',
    'context': 'Context',
    'web': 'Web',
    'other': 'Other',
    'mcp': 'MCP Tools',
    'extension': 'Extensions',
  };
  return names[category];
}

/**
 * Get icon for a category
 */
function getCategoryIcon(category: ToolCategory): string {
  const icons: Record<ToolCategory, string> = {
    'file-discovery': '🔍',
    'file-operations': '📝',
    'shell': '⚡',
    'memory': '💾',
    'context': '🔄',
    'web': '🌐',
    'other': '📦',
    'mcp': '🔌',
    'extension': '🧩',
  };
  return icons[category];
}

/**
 * Get sort order for categories
 */
function getCategorySortOrder(category: ToolCategory): number {
  const order: Record<ToolCategory, number> = {
    'file-discovery': 1,
    'file-operations': 2,
    'shell': 3,
    'memory': 4,
    'context': 5,
    'web': 6,
    'other': 7,
    'mcp': 8,
    'extension': 9,
  };
  return order[category] || 999;
}

/**
 * Provider for tools management
 */
export function ToolsProvider({ 
  children, 
  settingsService: customSettings
}: ToolsProviderProps) {
  const [state, setState] = useState<ToolsState>({
    categories: [],
    allTools: [],
    enabledTools: new Set(),
    isLoading: true,
    error: null,
  });

  // Get central tool registry from service container
  const { container } = useServices();
  const toolRegistry = useMemo(() => {
    if (!container) return null;
    return container.getToolRegistry();
  }, [container]);
  
  const settingsService = useMemo(() => customSettings || SettingsService.getInstance(), [customSettings]);

  /**
   * Load tools from registry and settings
   */
  const refreshTools = useCallback(() => {
    // Don't proceed if tool registry is not available yet
    if (!toolRegistry) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Tool registry not initialized' }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get all tools from registry
      const registeredTools = toolRegistry.list();
      
      // Convert to ToolInfo with categorization
      const allTools: ToolInfo[] = registeredTools.map(tool => {
        const category = categorizeTool(tool);
        const enabled = settingsService.getToolState(tool.name);
        
        return {
          id: tool.name,
          name: tool.name,
          displayName: tool.displayName || tool.name,
          description: tool.schema.description || 'No description available',
          category,
          enabled,
          schema: tool.schema,
        };
      });
      
      // Get enabled state from settings
      const enabledTools = new Set<string>();
      for (const tool of allTools) {
        if (tool.enabled) {
          enabledTools.add(tool.id);
        }
      }
      
      // Group by category
      const categoryMap = new Map<ToolCategory, ToolInfo[]>();
      for (const tool of allTools) {
        const existing = categoryMap.get(tool.category) || [];
        existing.push(tool);
        categoryMap.set(tool.category, existing);
      }
      
      // Convert to category groups
      const categories: ToolCategoryGroup[] = Array.from(categoryMap.entries())
        .map(([category, tools]) => ({
          category,
          displayName: getCategoryDisplayName(category),
          icon: getCategoryIcon(category),
          tools: tools.sort((a, b) => a.displayName.localeCompare(b.displayName)),
        }))
        .sort((a, b) => getCategorySortOrder(a.category) - getCategorySortOrder(b.category));

      setState({
        categories,
        allTools,
        enabledTools,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load tools',
      }));
    }
  }, [toolRegistry, settingsService]);

  /**
   * Toggle tool enabled state
   */
  const toggleTool = useCallback(async (toolId: string) => {
    try {
      const currentlyEnabled = state.enabledTools.has(toolId);
      const newEnabledState = !currentlyEnabled;

      // Update settings
      settingsService.setToolState(toolId, newEnabledState);

      // Update local state
      setState(prev => {
        const newEnabledTools = new Set(prev.enabledTools);
        if (newEnabledState) {
          newEnabledTools.add(toolId);
        } else {
          newEnabledTools.delete(toolId);
        }

        // Update tool in allTools and categories
        const updatedAllTools = prev.allTools.map(tool =>
          tool.id === toolId ? { ...tool, enabled: newEnabledState } : tool
        );
        
        const updatedCategories = prev.categories.map(cat => ({
          ...cat,
          tools: cat.tools.map(tool =>
            tool.id === toolId ? { ...tool, enabled: newEnabledState } : tool
          ),
        }));

        return {
          ...prev,
          enabledTools: newEnabledTools,
          allTools: updatedAllTools,
          categories: updatedCategories,
        };
      });
    } catch (error) {
      // Revert on error
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to toggle tool',
      }));
    }
  }, [state.enabledTools, settingsService]);

  /**
   * Check if a tool is enabled
   */
  const isToolEnabled = useCallback((toolId: string): boolean => {
    return state.enabledTools.has(toolId);
  }, [state.enabledTools]);

  /**
   * Get tool by ID
   */
  const getTool = useCallback((toolId: string): ToolInfo | undefined => {
    return state.allTools.find(t => t.id === toolId);
  }, [state.allTools]);

  // Load tools on mount and when registry changes
  useEffect(() => {
    refreshTools();
  }, [refreshTools]);

  const value: ToolsContextValue = {
    state,
    refreshTools,
    toggleTool,
    isToolEnabled,
    getTool,
  };

  return <ToolsContext.Provider value={value}>{children}</ToolsContext.Provider>;
}
