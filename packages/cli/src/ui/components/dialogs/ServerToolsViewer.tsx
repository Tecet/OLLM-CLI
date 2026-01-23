/**
 * ServerToolsViewer - Dialog for viewing and managing MCP server tools
 * 
 * Features:
 * - Display tools list grouped by category (if available)
 * - Show tool name and description
 * - Checkbox for auto-approve per tool
 * - Select All / Select None buttons
 * - Save and Close buttons
 * - Update mcp.json autoApprove array on save
 * 
 * Validates: Requirements 8.1-8.7
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';

import { Dialog } from './Dialog.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useMCP } from '../../contexts/MCPContext.js';
import { Button, ButtonGroup } from '../forms/Button.js';
import { Checkbox } from '../forms/Checkbox.js';

import type { MCPTool } from '@ollm/ollm-cli-core/mcp/types.js';

export interface ServerToolsViewerProps {
  /** Server name whose tools to display */
  serverName: string;
  /** Callback when dialog should close */
  onClose: () => void;
}

/**
 * Tool grouped by category
 */
interface GroupedTool {
  category: string;
  tools: MCPTool[];
}

/**
 * Extract category from tool name or description
 * Falls back to 'General' if no category can be determined
 */
function extractCategory(tool: MCPTool): string {
  // Check if tool name has a prefix (e.g., "git_commit", "file_read")
  const nameParts = tool.name.split('_');
  if (nameParts.length > 1) {
    return nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
  }

  // Check if description mentions a category
  const description = tool.description?.toLowerCase() || '';
  if (description.includes('file')) return 'File';
  if (description.includes('git')) return 'Git';
  if (description.includes('search')) return 'Search';
  if (description.includes('web') || description.includes('http')) return 'Web';
  if (description.includes('database') || description.includes('sql')) return 'Database';
  if (description.includes('api')) return 'API';

  return 'General';
}

/**
 * Group tools by category
 */
function groupToolsByCategory(tools: MCPTool[]): GroupedTool[] {
  const grouped = new Map<string, MCPTool[]>();

  tools.forEach(tool => {
    const category = extractCategory(tool);
    const existing = grouped.get(category) || [];
    grouped.set(category, [...existing, tool]);
  });

  // Convert to array and sort by category name
  return Array.from(grouped.entries())
    .map(([category, tools]) => ({ category, tools }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

/**
 * ServerToolsViewer component
 * 
 * Provides an interface for viewing and managing tool auto-approval:
 * - Displays all tools provided by the server
 * - Groups tools by category for better organization
 * - Allows toggling auto-approve for individual tools
 * - Provides Select All / Select None shortcuts
 * - Persists changes to mcp.json configuration
 */
export function ServerToolsViewer({
  serverName,
  onClose,
}: ServerToolsViewerProps) {
  const { state, getServerTools, setToolAutoApprove } = useMCP();
  const { state: uiState } = useUI();
  const server = state.servers.get(serverName);

  // Get tools for this server
  const tools = useMemo(() => getServerTools(serverName), [serverName, getServerTools]);
  
  // Group tools by category
  const groupedTools = useMemo(() => groupToolsByCategory(tools), [tools]);

  // Initialize selected tools from server config
  const [selectedTools, setSelectedTools] = useState<Set<string>>(() => {
    const autoApprove = server?.config.autoApprove || [];
    return new Set(autoApprove);
  });

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  /**
   * Toggle tool auto-approve
   */
  const handleToggleTool = useCallback((toolName: string) => {
    setSelectedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  }, []);

  /**
   * Select all tools
   */
  const handleSelectAll = useCallback(() => {
    const allToolNames = tools.map(tool => tool.name);
    setSelectedTools(new Set(allToolNames));
  }, [tools]);

  /**
   * Select none (clear all)
   */
  const handleSelectNone = useCallback(() => {
    setSelectedTools(new Set());
  }, []);

  /**
   * Save auto-approve configuration
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveResult(null);

    try {
      // Get current auto-approve list
      const currentAutoApprove = server?.config.autoApprove || [];
      const currentSet = new Set(currentAutoApprove);

      // Determine which tools need to be added or removed
      const toolsToAdd = Array.from(selectedTools).filter(tool => !currentSet.has(tool));
      const toolsToRemove = currentAutoApprove.filter(tool => !selectedTools.has(tool));

      // Update each tool's auto-approve status
      for (const toolName of toolsToAdd) {
        await setToolAutoApprove(serverName, toolName, true);
      }

      for (const toolName of toolsToRemove) {
        await setToolAutoApprove(serverName, toolName, false);
      }

      setSaveResult({
        success: true,
        message: `Auto-approve settings saved for ${selectedTools.size} tool(s)`,
      });

      // Close dialog after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save auto-approve settings',
      });
    } finally {
      setIsSaving(false);
    }
  }, [serverName, server, selectedTools, setToolAutoApprove, onClose]);

  // Calculate statistics
  const totalTools = tools.length;
  const selectedCount = selectedTools.size;

  return (
    <Dialog
      title={`Tools: ${serverName}`}
      onClose={onClose}
      width={90}
    >
      <Box flexDirection="column" paddingX={1}>
        {/* Header with statistics */}
        <Box marginBottom={1} flexDirection="column">
          <Box>
            <Text bold>Server: </Text>
            <Text color={uiState.theme.text.primary}>{serverName}</Text>
          </Box>
          <Box>
            <Text bold>Total Tools: </Text>
            <Text>{totalTools}</Text>
            <Text> | </Text>
            <Text bold>Auto-Approved: </Text>
            <Text color={selectedCount > 0 ? uiState.theme.status.success : 'gray'}>
              {selectedCount}
            </Text>
          </Box>
        </Box>

        {/* Quick Actions */}
        <Box marginBottom={1} gap={2}>
          <Button
            label="Select All"
            onPress={handleSelectAll}
            variant="secondary"
            disabled={isSaving || selectedCount === totalTools}
            shortcut="A"
            icon="☑"
          />
          <Button
            label="Select None"
            onPress={handleSelectNone}
            variant="secondary"
            disabled={isSaving || selectedCount === 0}
            shortcut="N"
            icon="☐"
          />
        </Box>

        {/* Tools list grouped by category */}
        <Box flexDirection="column" marginBottom={1} height={20} overflow="hidden">
          {groupedTools.length === 0 ? (
            <Box marginY={2}>
              <Text dimColor>No tools available for this server</Text>
            </Box>
          ) : (
            groupedTools.map(({ category, tools: categoryTools }) => (
              <Box key={category} flexDirection="column" marginBottom={1}>
                {/* Category header */}
                <Box marginBottom={1}>
                  <Text bold color={uiState.theme.text.primary}>
                    {category} ({categoryTools.length})
                  </Text>
                </Box>

                {/* Tools in this category */}
                <Box flexDirection="column" marginLeft={2}>
                  {categoryTools.map(tool => (
                    <Box key={tool.name} marginBottom={1}>
                      <Checkbox
                        label={tool.name}
                        checked={selectedTools.has(tool.name)}
                        onChange={() => handleToggleTool(tool.name)}
                        disabled={isSaving}
                        description={tool.description}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            ))
          )}
        </Box>

        {/* Save Result */}
        {saveResult && (
          <Box marginY={1}>
            <Text color={saveResult.success ? 'green' : 'red'}>
              {saveResult.success ? '✓' : '✗'} {saveResult.message}
            </Text>
          </Box>
        )}

        {/* Action Buttons */}
        <Box marginTop={1} gap={2}>
          <ButtonGroup
            buttons={[
              {
                label: 'Save',
                onPress: handleSave,
                variant: 'primary',
                loading: isSaving,
                disabled: isSaving,
                shortcut: 'S',
                icon: '💾',
              },
              {
                label: 'Close',
                onPress: onClose,
                variant: 'secondary',
                disabled: isSaving,
                shortcut: 'Esc',
              },
            ]}
          />
        </Box>

        {/* Help Text */}
        <Box marginTop={2} flexDirection="column">
          <Text dimColor>
            💡 Tip: Auto-approved tools will execute without confirmation prompts.
          </Text>
          <Text dimColor>
            Only auto-approve tools you trust completely.
          </Text>
        </Box>
      </Box>
    </Dialog>
  );
}
