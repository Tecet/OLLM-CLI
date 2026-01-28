/**
 * MCPTab Component
 *
 * Main container for the MCP Panel UI that provides:
 * - Two-column layout (30% left, 70% right)
 * - Left column: Menu with Marketplace and Installed Servers sections
 * - Right column: Dynamic content based on selection
 * - Keyboard navigation: Up/Down within columns, Left/Right between columns
 * - Dialog management for configuration, OAuth, tools, etc.
 *
 * Validates: Requirements 1.1-1.6, 12.1-12.15, NFR-7
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useMCP, type ExtendedMCPServerStatus } from '../../contexts/MCPContext.js';
import { APIKeyInputDialog } from '../dialogs/APIKeyInputDialog.js';
import {
  ServerConfigDialog,
  OAuthConfigDialog,
  HealthMonitorDialog,
  ServerLogsViewer,
  UninstallConfirmDialog,
  DialogErrorBoundary,
  HelpOverlay,
} from '../dialogs/index.js';
import { ErrorBoundary } from '../ErrorBoundary.js';
import { ErrorBanner } from '../mcp/ErrorDisplay.js';
import { LoadingSpinner } from '../mcp/LoadingSpinner.js';
import { ServerStatusBanner } from '../mcp/ServerStatusBanner.js';
import { SystemMessages, type SystemMessage } from '../mcp/SystemMessages.js';

import type { MCPMarketplaceServer } from '../../../services/mcpMarketplace.js';

export interface MCPTabProps {
  windowWidth?: number;
}

/**
 * Detail view navigation items for server details
 */
type ServerDetailNavItem = 'exit' | 'tools' | 'editKeys' | 'enable' | 'disable' | 'delete';

/**
 * View mode for server details
 */
type ServerDetailView = 'details' | 'tools' | 'editKeys';

/**
 * Tools view navigation items
 */
type ToolsNavItem = 'exit' | 'selectAll' | 'selectNone' | 'tool' | 'save' | 'close';

/**
 * Server Details Content Component - Shows installed server details
 */
interface ServerDetailsContentProps {
  server: ExtendedMCPServerStatus;
  activeColumn: 'left' | 'right';
  onToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
  onRefreshServers: () => Promise<void>;
  initialView?: ServerDetailView;
}

function ServerDetailsContent({
  server,
  activeColumn,
  onToggle,
  onDelete,
  onRefreshServers,
  initialView = 'details',
}: ServerDetailsContentProps) {
  const { state: uiState } = useUI();
  const { setToolAutoApprove } = useMCP();
  const [view, setView] = useState<ServerDetailView>(initialView);
  const [navItem, setNavItem] = useState<ServerDetailNavItem>('exit');
  const [toolsNavItem, setToolsNavItem] = useState<ToolsNavItem>('exit');
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [toolSelections, setToolSelections] = useState<Map<string, boolean>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [toggleState, setToggleState] = useState<{
    status: 'idle' | 'toggling';
  }>({
    status: 'idle',
  });
  const [deleteState, setDeleteState] = useState<{
    status: 'idle' | 'confirm' | 'deleting' | 'success' | 'error';
    selection: 'yes' | 'no';
    error?: string;
  }>({
    status: 'idle',
    selection: 'no',
  });

  // Edit keys state
  const [editingKeyIndex, setEditingKeyIndex] = useState(0);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [keyValues, setKeyValues] = useState<Record<string, string>>(server.config.env || {});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize tool selections from server config
  useEffect(() => {
    const selections = new Map<string, boolean>();
    const autoApprove = server.config.autoApprove || [];
    server.toolsList.forEach((tool) => {
      selections.set(tool.name, autoApprove.includes(tool.name));
    });
    setToolSelections(selections);
  }, [server.toolsList, server.config.autoApprove]);

  // Initialize key values when server changes
  useEffect(() => {
    setKeyValues(server.config.env || {});
  }, [server.config.env]);

  // Handle keyboard input when right column is active
  useInput(
    (input, key) => {
      if (activeColumn !== 'right') return;

      // Handle tools view navigation
      if (view === 'tools') {
        if (key.upArrow) {
          if (toolsNavItem === 'close') {
            setToolsNavItem('save');
          } else if (toolsNavItem === 'save') {
            if (server.toolsList.length > 0) {
              setToolsNavItem('tool');
              setSelectedToolIndex(server.toolsList.length - 1);
            } else {
              setToolsNavItem('selectNone');
            }
          } else if (toolsNavItem === 'tool') {
            if (selectedToolIndex > 0) {
              setSelectedToolIndex((prev) => prev - 1);
            } else {
              setToolsNavItem('selectNone');
            }
          } else if (toolsNavItem === 'selectNone') {
            setToolsNavItem('selectAll');
          } else if (toolsNavItem === 'selectAll') {
            setToolsNavItem('exit');
          }
        } else if (key.downArrow) {
          if (toolsNavItem === 'exit') {
            setToolsNavItem('selectAll');
          } else if (toolsNavItem === 'selectAll') {
            setToolsNavItem('selectNone');
          } else if (toolsNavItem === 'selectNone') {
            if (server.toolsList.length > 0) {
              setToolsNavItem('tool');
              setSelectedToolIndex(0);
            } else {
              setToolsNavItem('save');
            }
          } else if (toolsNavItem === 'tool') {
            if (selectedToolIndex < server.toolsList.length - 1) {
              setSelectedToolIndex((prev) => prev + 1);
            } else {
              setToolsNavItem('save');
            }
          } else if (toolsNavItem === 'save') {
            setToolsNavItem('close');
          }
        } else if (key.return) {
          if (toolsNavItem === 'exit') {
            // Go back to details view
            setView('details');
            setNavItem('exit');
          } else if (toolsNavItem === 'selectAll') {
            // Select all tools (only if there are tools)
            if (server.toolsList.length > 0) {
              const newSelections = new Map(toolSelections);
              server.toolsList.forEach((tool) => {
                newSelections.set(tool.name, true);
              });
              setToolSelections(newSelections);
            }
          } else if (toolsNavItem === 'selectNone') {
            // Deselect all tools (only if there are tools)
            if (server.toolsList.length > 0) {
              const newSelections = new Map(toolSelections);
              server.toolsList.forEach((tool) => {
                newSelections.set(tool.name, false);
              });
              setToolSelections(newSelections);
            }
          } else if (toolsNavItem === 'tool') {
            // Toggle tool selection
            const tool = server.toolsList[selectedToolIndex];
            if (tool) {
              const newSelections = new Map(toolSelections);
              newSelections.set(tool.name, !toolSelections.get(tool.name));
              setToolSelections(newSelections);
            }
          } else if (toolsNavItem === 'save') {
            // Save tool selections
            setIsSaving(true);
            Promise.all(
              Array.from(toolSelections.entries()).map(([toolName, isSelected]) =>
                setToolAutoApprove(server.name, toolName, isSelected)
              )
            )
              .then(() => {
                setIsSaving(false);
                onRefreshServers().catch(console.error);
              })
              .catch((err) => {
                console.error('Failed to save tool selections:', err);
                setIsSaving(false);
              });
          } else if (toolsNavItem === 'close') {
            // Close and go back to details
            setView('details');
            setNavItem('exit');
          }
        } else if (key.escape) {
          // Go back to details view
          setView('details');
          setNavItem('exit');
        }
        return;
      }

      // Handle edit keys view navigation
      if (view === 'editKeys') {
        const envKeys = Object.keys(server.config.env || {});

        if (saveStatus === 'success' || saveStatus === 'error') {
          if (key.return || key.escape) {
            setSaveStatus('idle');
            setSaveError(null);
            if (saveStatus === 'success') {
              // Go back to details view after successful save
              setView('details');
              setNavItem('exit');
              // Refresh to show updated config
              onRefreshServers().catch(console.error);
            }
          }
          return;
        }

        if (isEditingValue) {
          if (key.return) {
            setIsEditingValue(false);
          } else if (key.escape) {
            // Cancel editing, revert to original value
            setKeyValues(server.config.env || {});
            setIsEditingValue(false);
          } else if (key.backspace || key.delete) {
            const currentKey = envKeys[editingKeyIndex];
            setKeyValues((prev) => ({
              ...prev,
              [currentKey]: (prev[currentKey] || '').slice(0, -1),
            }));
          } else if (input && !key.ctrl && !key.meta) {
            const currentKey = envKeys[editingKeyIndex];
            setKeyValues((prev) => ({
              ...prev,
              [currentKey]: (prev[currentKey] || '') + input,
            }));
          }
        } else {
          if (key.upArrow) {
            setEditingKeyIndex((prev) => Math.max(0, prev - 1));
          } else if (key.downArrow) {
            setEditingKeyIndex((prev) => Math.min(envKeys.length, prev + 1)); // +1 for Save button
          } else if (key.return) {
            if (editingKeyIndex < envKeys.length) {
              // Edit key value
              setIsEditingValue(true);
            } else {
              // Save button pressed
              setSaveStatus('saving');

              // Save to config
              (async () => {
                try {
                  const { mcpConfigService } =
                    await import('../../../services/mcpConfigService.js');
                  const updatedConfig = {
                    ...server.config,
                    env: keyValues,
                  };
                  await mcpConfigService.updateServerConfig(server.name, updatedConfig);
                  setSaveStatus('success');
                } catch (err) {
                  setSaveStatus('error');
                  setSaveError(err instanceof Error ? err.message : 'Failed to save configuration');
                }
              })();
            }
          } else if (key.escape) {
            // Go back to details view
            setView('details');
            setNavItem('exit');
          }
        }
        return;
      }

      // Handle delete confirmation
      if (deleteState.status === 'confirm') {
        if (key.upArrow) {
          setDeleteState((prev) => ({ ...prev, selection: 'yes' }));
        } else if (key.downArrow) {
          setDeleteState((prev) => ({ ...prev, selection: 'no' }));
        } else if (key.return) {
          if (deleteState.selection === 'yes') {
            // Start deletion
            setDeleteState({ status: 'deleting', selection: 'no' });

            // Perform deletion
            onDelete()
              .then(() => {
                setDeleteState({ status: 'success', selection: 'no' });
              })
              .catch((err) => {
                setDeleteState({
                  status: 'error',
                  selection: 'no',
                  error: err instanceof Error ? err.message : 'Unknown error occurred',
                });
              });
          } else {
            // Cancel
            setDeleteState({ status: 'idle', selection: 'no' });
          }
        } else if (key.escape) {
          setDeleteState({ status: 'idle', selection: 'no' });
        }
        return;
      }

      // Handle success/error dismissal
      if (deleteState.status === 'success' || deleteState.status === 'error') {
        if (key.return || key.escape) {
          if (deleteState.status === 'success') {
            // Refresh servers list after successful deletion
            onRefreshServers().catch(console.error);
          }
          setDeleteState({ status: 'idle', selection: 'no' });
        }
        return;
      }

      // Don't allow navigation during deletion
      if (deleteState.status === 'deleting') {
        return;
      }

      // Handle navigation
      if (key.upArrow) {
        if (navItem === 'delete') {
          setNavItem(server.config.disabled ? 'enable' : 'disable');
        } else if (navItem === 'enable' || navItem === 'disable') {
          // Check if server has env vars (API keys)
          if (server.config.env && Object.keys(server.config.env).length > 0) {
            setNavItem('editKeys');
          } else {
            setNavItem('tools');
          }
        } else if (navItem === 'editKeys') {
          setNavItem('tools');
        } else if (navItem === 'tools') {
          setNavItem('exit');
        }
      } else if (key.downArrow) {
        if (navItem === 'exit') {
          setNavItem('tools');
        } else if (navItem === 'tools') {
          // Check if server has env vars (API keys)
          if (server.config.env && Object.keys(server.config.env).length > 0) {
            setNavItem('editKeys');
          } else {
            setNavItem(server.config.disabled ? 'enable' : 'disable');
          }
        } else if (navItem === 'editKeys') {
          setNavItem(server.config.disabled ? 'enable' : 'disable');
        } else if (navItem === 'enable' || navItem === 'disable') {
          setNavItem('delete');
        }
      } else if (key.return) {
        if (navItem === 'exit') {
          // Exit handled by parent
        } else if (navItem === 'tools') {
          // Show tools view
          setView('tools');
          setToolsNavItem('exit');
        } else if (navItem === 'editKeys') {
          // Show edit keys view
          setView('editKeys');
        } else if (navItem === 'enable' || navItem === 'disable') {
          // Toggle server enabled/disabled
          setToggleState({ status: 'toggling' });
          onToggle()
            .then(() => {
              setToggleState({ status: 'idle' });
              // Refresh to show updated status
              onRefreshServers().catch(console.error);
            })
            .catch((err) => {
              console.error('Failed to toggle server:', err);
              setToggleState({ status: 'idle' });
            });
        } else if (navItem === 'delete') {
          // Show delete confirmation
          setDeleteState({ status: 'confirm', selection: 'no' });
        }
      }
    },
    { isActive: activeColumn === 'right' }
  );

  // Render tools view
  if (view === 'tools') {
    const autoApprovedCount = Array.from(toolSelections.values()).filter(Boolean).length;
    const allSelected =
      server.toolsList.length > 0 && autoApprovedCount === server.toolsList.length;
    const noneSelected = autoApprovedCount === 0;
    const hasTools = server.toolsList.length > 0;

    return (
      <Box flexDirection="column" height="100%" width="100%">
        {/* Help Text - Top Right */}
        <Box flexShrink={0} justifyContent="flex-end">
          <Text dimColor>↑↓: Navigate | Enter: Select | Esc: Back</Text>
        </Box>

        {/* Exit Item */}
        <Box flexShrink={0}>
          <Text bold color={toolsNavItem === 'exit' ? uiState.theme.text.accent : 'white'}>
            {toolsNavItem === 'exit' ? '▶ ' : '  '}← Exit
          </Text>
        </Box>

        <Text> </Text>

        {/* Header */}
        <Text bold color={uiState.theme.text.accent}>
          Tools: {server.name}
        </Text>
        <Text> </Text>
        <Text>
          <Text bold>Server:</Text> {server.name}
        </Text>
        <Text>
          <Text bold>Total Tools:</Text> {server.toolsList.length} |{' '}
          <Text bold>Auto-Approved:</Text> {autoApprovedCount}
        </Text>
        <Text> </Text>
        <Text> </Text>

        {/* Select All / None */}
        <Text
          bold
          color={
            toolsNavItem === 'selectAll' ? uiState.theme.text.accent : hasTools ? 'white' : 'gray'
          }
          dimColor={!hasTools}
        >
          {toolsNavItem === 'selectAll' ? '▶ ' : '  '}[A] {allSelected ? '☑' : '☐'} Select All
        </Text>
        <Text
          bold
          color={
            toolsNavItem === 'selectNone' ? uiState.theme.text.accent : hasTools ? 'white' : 'gray'
          }
          dimColor={!hasTools}
        >
          {toolsNavItem === 'selectNone' ? '▶ ' : '  '}[N] {noneSelected ? '☑' : '☐'} Select None
        </Text>
        <Text> </Text>
        <Text> </Text>

        {/* Tools List */}
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {server.toolsList.length === 0 ? (
            <Text dimColor>No tools available for this server</Text>
          ) : (
            server.toolsList.map((tool, index) => {
              const isSelected = toolsNavItem === 'tool' && selectedToolIndex === index;
              const isChecked = toolSelections.get(tool.name) || false;

              return (
                <Text
                  key={tool.name}
                  bold={isSelected}
                  color={isSelected ? uiState.theme.text.accent : 'white'}
                >
                  {isSelected ? '▶ ' : '  '}[{isChecked ? '✓' : ' '}] {tool.name}
                </Text>
              );
            })
          )}
        </Box>

        <Text> </Text>
        <Text> </Text>

        {/* Save / Close */}
        <Box flexDirection="column" flexShrink={0}>
          <Text bold color={toolsNavItem === 'save' ? uiState.theme.text.accent : 'green'}>
            {toolsNavItem === 'save' ? '▶ ' : '  '}[S] 💾 Save{isSaving ? ' (Saving...)' : ''}
          </Text>
          <Text bold color={toolsNavItem === 'close' ? uiState.theme.text.accent : 'white'}>
            {toolsNavItem === 'close' ? '▶ ' : '  '}[Esc] Close
          </Text>
          <Text> </Text>
          <Text> </Text>
          <Text color={uiState.theme.status.warning}>
            💡 Tip: Auto-approved tools will execute without confirmation prompts.
          </Text>
          <Text color={uiState.theme.status.warning}>
            Only auto-approve tools you trust completely.
          </Text>
        </Box>
      </Box>
    );
  }

  // Render edit keys view
  if (view === 'editKeys') {
    const envKeys = Object.keys(server.config.env || {});

    return (
      <Box flexDirection="column" height="100%" width="100%">
        {/* Help Text */}
        <Box flexShrink={0} justifyContent="flex-end">
          <Text dimColor>
            {isEditingValue
              ? 'Type to edit | Enter: Done | Esc: Cancel'
              : '↑↓: Navigate | Enter: Edit/Save | Esc: Back'}
          </Text>
        </Box>

        {/* Exit Item */}
        <Box flexShrink={0}>
          <Text bold color="white">
            ← Exit
          </Text>
        </Box>

        <Text> </Text>

        {/* Header */}
        <Text bold color={uiState.theme.text.accent}>
          Edit API Keys: {server.name}
        </Text>
        <Text> </Text>

        {saveStatus === 'idle' || saveStatus === 'saving' ? (
          <>
            {/* API Key Fields */}
            {envKeys.map((key, index) => {
              const isSelected = editingKeyIndex === index && !saveStatus;
              const isCurrentlyEditing = isEditingValue && editingKeyIndex === index;
              const value = keyValues[key] || '';

              return (
                <Box key={key} flexDirection="column" marginBottom={1}>
                  <Text bold color={isSelected ? uiState.theme.text.accent : 'white'}>
                    {isSelected ? '▶ ' : '  '}
                    {key}
                  </Text>

                  <Box
                    borderStyle="single"
                    borderColor={isSelected ? 'cyan' : 'gray'}
                    paddingX={1}
                    width="100%"
                  >
                    <Text>
                      {value ? '•'.repeat(Math.min(value.length, 50)) : '(not set)'}
                      {isCurrentlyEditing && <Text color="cyan">_</Text>}
                    </Text>
                  </Box>
                </Box>
              );
            })}

            <Text> </Text>

            {/* Save Button */}
            <Text
              bold
              color={editingKeyIndex === envKeys.length ? uiState.theme.text.accent : 'green'}
            >
              {editingKeyIndex === envKeys.length ? '▶ ' : '  '}[S] 💾 Save
              {saveStatus === 'saving' && ' (Saving...)'}
            </Text>

            <Text> </Text>
            <Text> </Text>

            {/* Warning */}
            <Box borderStyle="single" borderColor="yellow" paddingX={1}>
              <Text color="yellow">
                ⚠️ Keys are stored in plain text in ~/.ollm/settings/mcp.json
              </Text>
            </Box>
          </>
        ) : saveStatus === 'success' ? (
          <>
            <Text bold color="green">
              ✓ API Keys Saved Successfully!
            </Text>
            <Text> </Text>
            <Text dimColor>Press Enter to continue</Text>
          </>
        ) : (
          <>
            <Text bold color="red">
              ✗ Failed to Save API Keys
            </Text>
            <Text> </Text>
            <Text color={uiState.theme.status.error}>{saveError}</Text>
            <Text> </Text>
            <Text dimColor>Press Enter to try again</Text>
          </>
        )}
      </Box>
    );
  }

  // Render details view
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Help Text - Top Right */}
      <Box flexShrink={0} justifyContent="flex-end">
        <Text dimColor>↑↓: Navigate | Enter: Select | Esc: Back</Text>
      </Box>

      {/* Exit Item */}
      <Box flexShrink={0}>
        <Text bold color={navItem === 'exit' ? uiState.theme.text.accent : 'white'}>
          {navItem === 'exit' ? '▶ ' : '  '}← Exit
        </Text>
      </Box>

      <Text> </Text>

      {/* Status Banner - Informational Display Only */}
      <Box flexShrink={0} marginBottom={1}>
        <ServerStatusBanner phase={server.phase} isEnabled={!server.config.disabled} />
      </Box>

      <Text> </Text>
      <Text> </Text>

      {/* Server Details - Scrollable */}
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {/* Header: Name, Version */}
        <Text bold color={uiState.theme.text.accent}>
          MCP Server: {server.name}
        </Text>
        {server.config.metadata?.version && (
          <Text>
            <Text bold>Version:</Text> {server.config.metadata.version}
          </Text>
        )}
        <Text> </Text>
        <Text> </Text>

        {/* Author, Homepage, GitHub, Category, Rating - Inline */}
        {server.config.metadata?.author && (
          <Text>
            <Text bold>Author:</Text> {server.config.metadata.author}
          </Text>
        )}

        {server.config.metadata?.homepage && (
          <Text>
            <Text bold>Homepage:</Text>{' '}
            <Text color={uiState.theme.text.accent}>{server.config.metadata.homepage}</Text>
          </Text>
        )}

        {server.config.metadata?.repository && (
          <Text>
            <Text bold>GitHub Repository:</Text>{' '}
            <Text color={uiState.theme.text.accent}>{server.config.metadata.repository}</Text>
          </Text>
        )}

        {server.config.metadata?.category && (
          <Text>
            <Text bold>Category:</Text> {server.config.metadata.category}
          </Text>
        )}

        {server.config.metadata?.rating && (
          <Text>
            <Text bold>Rating:</Text> {'⭐'.repeat(Math.floor(server.config.metadata.rating))} (
            {server.config.metadata.rating}/5)
          </Text>
        )}
        <Text> </Text>
        <Text> </Text>

        {/* Description - Multi-line */}
        {server.config.metadata?.description && (
          <>
            <Text bold>Description:</Text>
            <Text wrap="wrap">{server.config.metadata.description}</Text>
            <Text> </Text>
          </>
        )}

        {/* Requirements - List */}
        {server.config.metadata?.requirements && server.config.metadata.requirements.length > 0 && (
          <>
            <Text bold>Requirements:</Text>
            {server.config.metadata.requirements.map((req, idx) => (
              <Text key={idx}> • {req}</Text>
            ))}
            <Text> </Text>
          </>
        )}

        {/* Required API Keys - Prominent */}
        {server.config.env && Object.keys(server.config.env).length > 0 && (
          <>
            <Text bold color={uiState.theme.status.warning}>
              ⚠️ This server requires:
            </Text>
            {Object.keys(server.config.env).map((key) => (
              <Text key={key} color={uiState.theme.status.warning}>
                {' '}
                • {key}
              </Text>
            ))}
            <Text> </Text>
          </>
        )}

        {/* Command, Tools, Transport - Inline */}
        <Text>
          <Text bold>Command:</Text>{' '}
          <Text dimColor>
            {server.config.command} {server.config.args?.join(' ') || ''}
          </Text>
        </Text>
        <Text>
          <Text bold>Tools Available:</Text> {server.toolsList?.length || 0} tools
        </Text>
        <Text>
          <Text bold>Transport:</Text> {server.config.transport || 'stdio'}
        </Text>
        <Text> </Text>
        <Text> </Text>

        {/* API Keys Section - Show current values (masked) */}
        {server.config.env && Object.keys(server.config.env).length > 0 && (
          <>
            <Text bold>API Keys:</Text>
            {Object.entries(server.config.env).map(([key, value]) => (
              <Text key={key}>
                <Text dimColor> {key}:</Text>{' '}
                {value ? (
                  <Text color={uiState.theme.status.success}>●●●●●●●● (configured)</Text>
                ) : (
                  <Text color={uiState.theme.status.error}>(not set)</Text>
                )}
              </Text>
            ))}
            <Text dimColor> (Press [E] to edit)</Text>
            <Text> </Text>
            <Text> </Text>
          </>
        )}

        {/* Connection Status */}
        <Text>
          <Text bold>Connection Status:</Text>{' '}
          {server.status === 'connected'
            ? '✓ Connected'
            : server.status === 'error'
              ? '✗ Disconnected'
              : '○ Stopped'}
        </Text>

        {server.oauthStatus && (
          <Text>
            <Text bold>OAuth Status:</Text>{' '}
            <Text color={server.oauthStatus.connected ? 'green' : 'red'}>
              {server.oauthStatus.connected ? '✓ Connected' : '✗ Not Connected'}
            </Text>
          </Text>
        )}
      </Box>

      {/* Action Buttons - Bottom */}
      <Box flexDirection="column" flexShrink={0} marginTop={1}>
        {deleteState.status === 'idle' && (
          <>
            <Text bold>Actions:</Text>
            <Text> </Text>
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={navItem === 'tools' ? uiState.theme.text.accent : 'cyan'}>
                {navItem === 'tools' ? '▶ ' : '  '}[T] Available Tools
              </Text>
              {server.config.env && Object.keys(server.config.env).length > 0 && (
                <Text bold color={navItem === 'editKeys' ? uiState.theme.text.accent : 'yellow'}>
                  {navItem === 'editKeys' ? '▶ ' : '  '}[K] Edit API Keys
                </Text>
              )}
              {server.config.disabled ? (
                <Text bold color={navItem === 'enable' ? uiState.theme.text.accent : 'green'}>
                  {navItem === 'enable' ? '▶ ' : '  '}[E] Enable Server
                </Text>
              ) : (
                <Text bold color={navItem === 'disable' ? uiState.theme.text.accent : 'gray'}>
                  {navItem === 'disable' ? '▶ ' : '  '}[D] Disable Server
                </Text>
              )}
              <Text bold color={navItem === 'delete' ? uiState.theme.text.accent : 'red'}>
                {navItem === 'delete' ? '▶ ' : '  '}[X] Delete Server
              </Text>
            </Box>
            {toggleState.status === 'toggling' && (
              <Box marginTop={1}>
                <Text dimColor>⟳ Updating server status...</Text>
              </Box>
            )}
          </>
        )}

        {deleteState.status === 'confirm' && (
          <>
            <Text bold color="red">
              Delete {server.name}?
            </Text>
            <Box flexDirection="column" marginTop={1}>
              <Text bold color={deleteState.selection === 'yes' ? 'yellow' : 'white'}>
                {deleteState.selection === 'yes' ? '▶ ' : '  '}Yes
              </Text>
              <Text bold color={deleteState.selection === 'no' ? 'yellow' : 'white'}>
                {deleteState.selection === 'no' ? '▶ ' : '  '}No
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>↑↓: Select | Enter: Confirm | Esc: Cancel</Text>
            </Box>
          </>
        )}

        {deleteState.status === 'deleting' && (
          <>
            <Text bold color="red">
              Deleting {server.name}...
            </Text>
            <Box marginTop={1}>
              <Text dimColor>Please wait...</Text>
            </Box>
          </>
        )}

        {deleteState.status === 'success' && (
          <>
            <Text bold color="green">
              ✓ Server Deleted Successfully!
            </Text>
            <Box marginTop={1}>
              <Text dimColor>Press Enter to continue</Text>
            </Box>
          </>
        )}

        {deleteState.status === 'error' && (
          <>
            <Text bold color="red">
              ✗ Deletion Failed
            </Text>
            <Box marginTop={1}>
              <Text color={uiState.theme.status.error}>{deleteState.error}</Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Enter to dismiss</Text>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

/**
 * Marketplace Content Component - Shows marketplace in right column
 */
interface MarketplaceContentProps {
  activeColumn: 'left' | 'right';
  onRefreshServers: () => Promise<void>;
  height?: number;
  onDetailViewChange: (isInDetail: boolean) => void;
}

/**
 * View mode for marketplace content
 */
type MarketplaceView = 'list' | 'detail' | 'apikey';

/**
 * Detail view navigation items
 */
type DetailNavItem = 'exit' | 'install';

function MarketplaceContent({
  activeColumn,
  onRefreshServers,
  height: _height = 20,
  onDetailViewChange,
}: MarketplaceContentProps) {
  const { state: uiState } = useUI();
  const { searchMarketplace } = useMCP();
  const [searchQuery, setSearchQuery] = useState('');
  const [servers, setServers] = useState<MCPMarketplaceServer[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [view, setView] = useState<MarketplaceView>('list');
  const [selectedServer, setSelectedServer] = useState<MCPMarketplaceServer | null>(null);
  const [detailNavItem, setDetailNavItem] = useState<DetailNavItem>('exit');
  const [installState, setInstallState] = useState<{
    status: 'idle' | 'confirm' | 'installing' | 'success' | 'error';
    selection: 'yes' | 'no';
    error?: string;
  }>({
    status: 'idle',
    selection: 'no',
  });

  // Notify parent when entering/exiting detail view
  useEffect(() => {
    onDetailViewChange(view === 'detail' || view === 'apikey');
  }, [view, onDetailViewChange]);

  // Fixed window size - display exactly 10 servers at a time
  const windowSize = 10;

  // Load initial servers
  useEffect(() => {
    const loadServers = async () => {
      setIsLoading(true);
      try {
        const results = await searchMarketplace('');
        setServers(results);
      } catch (err) {
        console.error('Failed to load marketplace:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadServers();
  }, [searchMarketplace]);

  // Search when query changes
  useEffect(() => {
    const performSearch = async () => {
      setIsLoading(true);
      try {
        const results = await searchMarketplace(searchQuery);
        setServers(results);
        setSelectedIndex(0);
        setScrollOffset(0);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (searchQuery) {
      performSearch();
    }
  }, [searchQuery, searchMarketplace]);

  // Auto-scroll to keep selected item visible (snap to server, not line)
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + windowSize) {
      setScrollOffset(selectedIndex - windowSize + 1);
    }
  }, [selectedIndex, scrollOffset, windowSize]);

  // Get visible servers (only show what fits in the window)
  const visibleServers = useMemo(() => {
    return servers.slice(scrollOffset, scrollOffset + windowSize);
  }, [servers, scrollOffset, windowSize]);

  // Handle keyboard input when right column is active
  useInput(
    (input, key) => {
      if (activeColumn !== 'right') return;

      // Handle install confirmation
      if (installState.status === 'confirm') {
        if (key.upArrow) {
          setInstallState((prev) => ({ ...prev, selection: 'yes' }));
        } else if (key.downArrow) {
          setInstallState((prev) => ({ ...prev, selection: 'no' }));
        } else if (key.return) {
          if (installState.selection === 'yes' && selectedServer) {
            // Start installation
            setInstallState({ status: 'installing', selection: 'no' });

            // Perform installation
            (async () => {
              try {
                const { mcpMarketplace } = await import('../../../services/mcpMarketplace.js');
                // Pass the full server object instead of just ID to avoid lookup issues
                await mcpMarketplace.installServer(selectedServer, {});
                setInstallState({ status: 'success', selection: 'no' });
              } catch (err) {
                setInstallState({
                  status: 'error',
                  selection: 'no',
                  error: err instanceof Error ? err.message : 'Unknown error occurred',
                });
              }
            })();
          } else {
            // Cancel
            setInstallState({ status: 'idle', selection: 'no' });
          }
        } else if (key.escape) {
          setInstallState({ status: 'idle', selection: 'no' });
        }
        return;
      }

      // Handle success/error dismissal
      if (installState.status === 'success' || installState.status === 'error') {
        if (key.return || key.escape) {
          if (installState.status === 'success') {
            // Refresh servers list before going back
            onRefreshServers()
              .then(() => {
                setInstallState({ status: 'idle', selection: 'no' });
                // Go back to list after successful install
                setView('list');
                setSelectedServer(null);
                setDetailNavItem('exit');
              })
              .catch((err) => {
                console.error('Failed to refresh servers:', err);
                setInstallState({ status: 'idle', selection: 'no' });
                setView('list');
                setSelectedServer(null);
                setDetailNavItem('exit');
              });
          } else {
            // On error, go back to detail view to try again
            setInstallState({ status: 'idle', selection: 'no' });
            setView('detail');
          }
        }
        return;
      }

      // Don't allow navigation during installation
      if (installState.status === 'installing') {
        return;
      }

      // Handle detail view navigation (Level 3)
      if (view === 'detail') {
        if (key.upArrow) {
          setDetailNavItem('exit');
        } else if (key.downArrow) {
          setDetailNavItem('install');
        } else if (key.return) {
          if (detailNavItem === 'exit') {
            // Back to list (Level 3 → Level 2)
            setView('list');
            setSelectedServer(null);
            setDetailNavItem('exit');
          } else if (detailNavItem === 'install' && selectedServer) {
            // Check if server requires API keys
            const hasEnvVars = selectedServer.env && Object.keys(selectedServer.env).length > 0;

            if (hasEnvVars) {
              // Show API key input dialog
              setView('apikey');
            } else {
              // No API keys needed, show confirmation directly
              setInstallState({ status: 'confirm', selection: 'no' });
            }
          }
        } else if (key.escape) {
          // Back to list (Level 3 → Level 2)
          setView('list');
          setSelectedServer(null);
          setDetailNavItem('exit');
        }
        return;
      }

      // Handle search input
      if (isSearchFocused) {
        if (key.backspace || key.delete) {
          setSearchQuery((prev) => prev.slice(0, -1));
        } else if (key.return) {
          setIsSearchFocused(false);
        } else if (input && !key.ctrl && !key.meta) {
          setSearchQuery((prev) => prev + input);
        }
        return;
      }

      // / to focus search
      if (input === '/') {
        setIsSearchFocused(true);
        return;
      }

      // Navigation - snap to server names (skip descriptions)
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(servers.length - 1, prev + 1));
      } else if (key.return && servers[selectedIndex]) {
        // Show server details (Level 2 → Level 3)
        setSelectedServer(servers[selectedIndex]);
        setView('detail');
        setDetailNavItem('exit');
      }
    },
    { isActive: activeColumn === 'right' }
  );

  if (isLoading) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
        <LoadingSpinner
          message="Loading marketplace..."
          spinnerType="dots"
          color={uiState.theme.text.accent}
          centered
          padded
        />
      </Box>
    );
  }

  const showScrollUp = scrollOffset > 0;
  const showScrollDown = scrollOffset + windowSize < servers.length;

  // Render API key input view
  if (view === 'apikey' && selectedServer) {
    return (
      <APIKeyInputDialog
        server={selectedServer}
        onInstall={async (envVars) => {
          // Start installation with provided API keys
          setInstallState({ status: 'installing', selection: 'no' });

          try {
            const { mcpMarketplace } = await import('../../../services/mcpMarketplace.js');
            // Pass the full server object instead of just ID to avoid lookup issues
            await mcpMarketplace.installServer(selectedServer, { env: envVars });
            setInstallState({ status: 'success', selection: 'no' });
          } catch (err) {
            setInstallState({
              status: 'error',
              selection: 'no',
              error: err instanceof Error ? err.message : 'Unknown error occurred',
            });
          }
        }}
        onCancel={() => {
          // Go back to detail view
          setView('detail');
        }}
      />
    );
  }

  // Render detail view
  if (view === 'detail' && selectedServer) {
    return (
      <Box flexDirection="column" height="100%" width="100%">
        {/* Help Text - Top Right */}
        <Box flexShrink={0} justifyContent="flex-end">
          <Text dimColor>↑↓: Navigate | Enter: Select | Esc: Back</Text>
        </Box>

        {/* Exit Item - Top */}
        <Box flexShrink={0}>
          <Text bold color={detailNavItem === 'exit' ? uiState.theme.text.accent : 'white'}>
            {detailNavItem === 'exit' ? '▶ ' : '  '}← Exit
          </Text>
        </Box>

        <Text> </Text>
        <Text> </Text>

        {/* Server Details - Scrollable */}
        <Box flexDirection="column" flexGrow={1} overflow="hidden">
          {/* Header: Name, Version, Updated */}
          <Text bold color={uiState.theme.text.accent}>
            MCP Server: {selectedServer.name}
          </Text>
          <Text>
            <Text bold>Version:</Text> {selectedServer.version || 'N/A'}
          </Text>
          <Text> </Text>
          <Text> </Text>

          {/* Author, Homepage, GitHub, Category, Rating - Inline */}
          <Text>
            <Text bold>Author:</Text> {selectedServer.author || 'Unknown'}
          </Text>

          {selectedServer.homepage && (
            <Text>
              <Text bold>Homepage:</Text> <Text color="cyan">{selectedServer.homepage}</Text>
            </Text>
          )}

          {selectedServer.repository && (
            <Text>
              <Text bold>GitHub Repository:</Text>{' '}
              <Text color="cyan">{selectedServer.repository}</Text>
            </Text>
          )}

          <Text>
            <Text bold>Category:</Text> {selectedServer.category || 'Utilities'}
          </Text>

          <Text>
            <Text bold>Rating:</Text> {'⭐'.repeat(Math.floor(selectedServer.rating))} (
            {selectedServer.rating}/5)
          </Text>
          <Text> </Text>
          <Text> </Text>

          {/* Description - Multi-line */}
          <Text bold>Description:</Text>
          <Text wrap="wrap">{selectedServer.description}</Text>
          <Text> </Text>

          {/* Requirements - List */}
          {selectedServer.requirements.length > 0 && (
            <>
              <Text bold>Requirements:</Text>
              {selectedServer.requirements.map((req, idx) => (
                <Text key={idx}> • {req}</Text>
              ))}
              <Text> </Text>
            </>
          )}

          {/* Required API Keys - Prominent */}
          {selectedServer.env && Object.keys(selectedServer.env).length > 0 && (
            <>
              <Text bold color="yellow">
                ⚠️ This server requires:
              </Text>
              {Object.keys(selectedServer.env).map((key) => (
                <Text key={key} color="yellow">
                  {' '}
                  • {key}
                </Text>
              ))}
              <Text> </Text>
              <Text> </Text>
            </>
          )}

          {/* Command - Inline */}
          <Text>
            <Text bold>Command:</Text>{' '}
            <Text dimColor>
              {selectedServer.command} {selectedServer.args?.join(' ')}
            </Text>
          </Text>
          <Text> </Text>
          <Text> </Text>

          {/* API Keys Section - Placeholder for future editable input */}
          {selectedServer.env && Object.keys(selectedServer.env).length > 0 && (
            <>
              <Text bold>API Keys:</Text>
              <Text dimColor> (Configure during installation)</Text>
              <Text> </Text>
              <Text> </Text>
            </>
          )}
        </Box>

        {/* Install Button / Confirmation / Status - Bottom */}
        <Box flexDirection="column" flexShrink={0} marginTop={1}>
          {installState.status === 'idle' && (
            <Text bold color={detailNavItem === 'install' ? 'yellow' : 'green'}>
              {detailNavItem === 'install' ? '▶ ' : '  '}[I] Install
            </Text>
          )}

          {installState.status === 'confirm' && (
            <>
              <Text bold color="cyan">
                Install {selectedServer.name}?
              </Text>
              <Box flexDirection="column" marginTop={1}>
                <Text bold color={installState.selection === 'yes' ? 'yellow' : 'white'}>
                  {installState.selection === 'yes' ? '▶ ' : '  '}Yes
                </Text>
                <Text
                  bold
                  color={installState.selection === 'no' ? uiState.theme.text.accent : 'white'}
                >
                  {installState.selection === 'no' ? '▶ ' : '  '}No
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>↑↓: Select | Enter: Confirm | Esc: Cancel</Text>
              </Box>
            </>
          )}

          {installState.status === 'installing' && (
            <>
              <Text bold color="cyan">
                Installing {selectedServer.name}...
              </Text>
              <Box marginTop={1}>
                <Text dimColor>Please wait...</Text>
              </Box>
            </>
          )}

          {installState.status === 'success' && (
            <>
              <Text bold color="green">
                ✓ Installation Successful!
              </Text>
              <Box marginTop={1}>
                <Text dimColor>Press Enter to continue</Text>
              </Box>
            </>
          )}

          {installState.status === 'error' && (
            <>
              <Text bold color="red">
                ✗ Installation Failed
              </Text>
              <Box marginTop={1}>
                <Text color={uiState.theme.status.error}>{installState.error}</Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>Press Enter to dismiss</Text>
              </Box>
            </>
          )}
        </Box>
      </Box>
    );
  }

  // Render list view
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Line 0: Title and Help - STATIC */}
      <Box flexDirection="column" flexShrink={0}>
        <Text bold color="cyan">
          🏪 MCP Marketplace
        </Text>
        <Text dimColor>
          {isSearchFocused
            ? 'Type to search, Enter to finish'
            : `↑↓: Navigate | Enter: View Details | /: Search | ${servers.length} servers`}
        </Text>
      </Box>

      <Text> </Text>

      {/* Search Container - STATIC */}
      <Box flexShrink={0}>
        <Text bold color={uiState.theme.text.accent}>
          Search:{' '}
        </Text>
        <Text color={isSearchFocused ? 'yellow' : 'gray'}>
          {searchQuery || 'type / to search'}
          {isSearchFocused && <Text color="yellow">_</Text>}
        </Text>
      </Box>

      <Text> </Text>
      <Text> </Text>

      {/* Scroll up indicator */}
      {showScrollUp && (
        <Box justifyContent="center" flexShrink={0}>
          <Text color="cyan" bold>
            ▲ More above
          </Text>
        </Box>
      )}

      {/* Results Container - SCROLLABLE with overflow hidden */}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
        {visibleServers.map((server, index) => {
          const actualIndex = scrollOffset + index;
          const isSelected = actualIndex === selectedIndex;

          return (
            <Box key={server.id} flexDirection="column" flexShrink={0}>
              {/* Server name and version - selectable line */}
              <Text bold color={isSelected ? 'yellow' : 'cyan'}>
                {isSelected ? '▶ ' : '  '}
                {server.name}
                {server.version ? ` v${server.version}` : ''}
              </Text>

              {/* Description - separate line with padding */}
              <Text dimColor>
                {'   '}
                {server.description}
              </Text>

              {/* Empty line separator */}
              <Text> </Text>
            </Box>
          );
        })}
      </Box>

      {/* Scroll down indicator */}
      {showScrollDown && (
        <Box justifyContent="center" flexShrink={0}>
          <Text color="cyan" bold>
            ▼ More below
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Dialog state type
 */
type DialogType =
  | 'configure'
  | 'oauth'
  | 'health'
  | 'logs'
  | 'marketplace'
  | 'install'
  | 'uninstall'
  | 'help'
  | null;

interface DialogState {
  type: DialogType;
  serverName?: string;
  serverId?: string;
}

/**
 * Menu item types for left column
 */
type MenuItemType = 'exit' | 'marketplace' | 'server';

interface MenuItem {
  type: MenuItemType;
  label: string;
  icon: string;
  server?: ExtendedMCPServerStatus;
}

/**
 * MCPTab Component
 *
 * Main tab component that orchestrates the MCP panel UI with two-column layout.
 * Handles keyboard navigation, dialog management, and server operations.
 */
export function MCPTab({ windowWidth }: MCPTabProps) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <Box flexDirection="column" padding={2}>
          <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
            <Text color="red" bold>
              ⚠️ MCP Panel Error
            </Text>
          </Box>
          <Box marginTop={1} paddingLeft={2}>
            <Text dimColor>{error.message}</Text>
          </Box>
          <Box marginTop={2}>
            <Text dimColor>The MCP panel encountered an error. Press </Text>
            <Text bold color="cyan">
              Esc or 0
            </Text>
            <Text dimColor> to return to main menu.</Text>
          </Box>
        </Box>
      )}
    >
      <MCPTabContent windowWidth={windowWidth} />
    </ErrorBoundary>
  );
}

/**
 * MCPTab Content Component (wrapped by error boundary)
 */
function MCPTabContent({ windowWidth }: { windowWidth?: number }) {
  const { state: uiState } = useUI();
  const { isFocused, isActive, exitToNavBar } = useFocusManager();
  const { stdout } = useStdout();

  // Calculate absolute widths if windowWidth is provided
  const absoluteLeftWidth = windowWidth ? Math.floor(windowWidth * 0.3) : undefined;
  const absoluteRightWidth =
    windowWidth && absoluteLeftWidth ? windowWidth - absoluteLeftWidth : undefined;

  const {
    state,
    toggleServer,
    restartServer,
    configureServer,
    uninstallServer,
    refreshServers,
    clearError,
    subscribeToSystemMessages,
  } = useMCP();

  // Check if this panel has focus (for navigation and dialogs)
  const hasFocus = isFocused('mcp-panel');
  // Check if we're in active mode (for state-modifying actions like toggle)
  const _canModifyState = hasFocus && isActive();

  // Get terminal height for calculating content area
  const terminalHeight = (stdout?.rows || 24) - 1;

  // Navigation state
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeColumn, setActiveColumn] = useState<'left' | 'right'>('left');
  const [scrollOffset, setScrollOffset] = useState(0);
  const windowSize = 15; // Number of items visible in left column

  // Track if we're in a detail view (Level 3) to prevent ESC from bubbling
  const [isInDetailView, setIsInDetailView] = useState(false);

  // Track initial view for server details (details or tools)
  const [serverDetailInitialView, setServerDetailInitialView] =
    useState<ServerDetailView>('details');

  // Callback for child components to notify when entering/exiting detail views
  const handleDetailViewChange = useCallback((isInDetail: boolean) => {
    setIsInDetailView(isInDetail);
  }, []);

  // Dialog state
  const [dialogState, setDialogState] = useState<DialogState>({ type: null });

  // Status message for operations
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // System messages for errors and notifications
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);

  // Subscribe to system messages from MCPContext
  useEffect(() => {
    const unsubscribe = subscribeToSystemMessages((messages) => {
      setSystemMessages(messages);
    });

    return unsubscribe;
  }, [subscribeToSystemMessages]);

  // Build menu items for left column
  const menuItems = useMemo((): MenuItem[] => {
    const items: MenuItem[] = [];

    // Exit item
    items.push({
      type: 'exit',
      label: 'Exit',
      icon: '←',
    });

    // Marketplace item
    items.push({
      type: 'marketplace',
      label: 'Marketplace',
      icon: '🏪',
    });

    // Installed servers
    const serverList = Array.from(state.servers.values());
    serverList.forEach((server) => {
      items.push({
        type: 'server',
        label: server.name,
        icon: server.config.disabled ? '○' : '●',
        server,
      });
    });

    return items;
  }, [state.servers]);

  // Get visible items for windowed rendering
  const visibleItems = useMemo(() => {
    return menuItems.slice(scrollOffset, scrollOffset + windowSize);
  }, [menuItems, scrollOffset, windowSize]);

  // Get currently selected item
  const selectedItem = useMemo(() => {
    if (selectedIndex >= 0 && selectedIndex < menuItems.length) {
      return menuItems[selectedIndex];
    }
    return null;
  }, [menuItems, selectedIndex]);

  // Reset server detail view when selection changes
  useEffect(() => {
    setServerDetailInitialView('details');
  }, [selectedItem]);

  // Navigation handlers
  const handleNavigateUp = useCallback(() => {
    if (activeColumn === 'left') {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    }
    // TODO: Handle right column navigation when content supports it
  }, [activeColumn]);

  const handleNavigateDown = useCallback(() => {
    if (activeColumn === 'left') {
      setSelectedIndex((prev) => Math.min(menuItems.length - 1, prev + 1));
    }
    // TODO: Handle right column navigation when content supports it
  }, [activeColumn, menuItems.length]);

  const handleNavigateLeft = useCallback(() => {
    setActiveColumn('left');
  }, []);

  const handleNavigateRight = useCallback(() => {
    setActiveColumn('right');
  }, []);

  const handleSelect = useCallback(async () => {
    if (!selectedItem) return;

    switch (selectedItem.type) {
      case 'exit':
        exitToNavBar();
        break;

      case 'marketplace':
        // Don't open dialog, just stay selected to show marketplace in right column
        // The right column will detect selectedItem.type === 'marketplace' and show content
        break;

      case 'server':
        // Server selection just shows details in right column
        // Enable/disable happens in the detail view, not here
        break;
    }
  }, [selectedItem, exitToNavBar]);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + windowSize) {
      setScrollOffset(selectedIndex - windowSize + 1);
    }
  }, [selectedIndex, scrollOffset, windowSize]);

  /**
   * Close dialog handler
   */
  const handleCloseDialog = useCallback(() => {
    setDialogState({ type: null });
  }, []);

  /**
   * Render the appropriate dialog based on dialog state
   */
  const renderDialog = () => {
    if (dialogState.type === null) return null;

    switch (dialogState.type) {
      case 'configure':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Server Configuration">
            <ServerConfigDialog
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
              onSave={async (config) => {
                setStatusMessage('Saving configuration...');
                await configureServer(dialogState.serverName!, config);
                setStatusMessage('Configuration saved successfully');
                setTimeout(() => setStatusMessage(null), 3000);
                handleCloseDialog();
              }}
            />
          </DialogErrorBoundary>
        );

      case 'oauth':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="OAuth Configuration">
            <OAuthConfigDialog serverName={dialogState.serverName} onClose={handleCloseDialog} />
          </DialogErrorBoundary>
        );

      case 'health':
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Health Monitor">
            <HealthMonitorDialog onClose={handleCloseDialog} />
          </DialogErrorBoundary>
        );

      case 'logs':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Server Logs">
            <ServerLogsViewer serverName={dialogState.serverName} onClose={handleCloseDialog} />
          </DialogErrorBoundary>
        );

      case 'uninstall':
        if (!dialogState.serverName) return null;
        return (
          <DialogErrorBoundary onClose={handleCloseDialog} dialogName="Uninstall Confirmation">
            <UninstallConfirmDialog
              serverName={dialogState.serverName}
              onClose={handleCloseDialog}
              onConfirm={async () => {
                const serverName = dialogState.serverName!;
                setStatusMessage(`Uninstalling ${serverName}...`);
                await uninstallServer(serverName);
                setStatusMessage(`${serverName} uninstalled successfully`);
                setTimeout(() => setStatusMessage(null), 3000);
                handleCloseDialog();
              }}
            />
          </DialogErrorBoundary>
        );

      case 'help':
        return <HelpOverlay onClose={handleCloseDialog} context="main" />;

      default:
        return null;
    }
  };

  /**
   * Handle keyboard navigation
   *
   * MCP Tab uses a 3-level hierarchy:
   * - Level 1: Left column (menu/list)
   * - Level 2: Right column (content area)
   * - Level 3: Detail views (handled by child components via modal system)
   */
  useInput(
    (input, key) => {
      // Don't handle input during loading
      if (state.isLoading) {
        return;
      }

      // Handle error state input
      if (state.error) {
        if (key.return || key.escape || input === '0') {
          // Clear error and return to main menu
          clearError();
          exitToNavBar();
        }
        return; // Don't process other inputs in error state
      }

      // Handle dialog keyboard input (Level 3+)
      if (dialogState.type !== null) {
        if (key.escape) {
          handleCloseDialog();
        } else if (input === '?') {
          setDialogState({ type: 'help' });
        }
        return;
      }

      // Handle ESC hierarchically:
      // Level 2 (right column) → Level 1 (left column)
      // Level 1 (left column) → Exit tab (bubble to global handler)
      if (key.escape) {
        // Don't handle ESC if we're in a detail view (Level 3) - let child handle it
        if (isInDetailView) {
          return;
        }

        if (activeColumn === 'right') {
          // Go back to left column
          setActiveColumn('left');
          return; // Don't bubble - we handled it
        }
        // If in left column, allow ESC to bubble to exit the tab
        return;
      }

      // Show help overlay on '?' key
      if (input === '?') {
        setDialogState({ type: 'help' });
        return;
      }

      // Handle navigation
      if (key.upArrow) {
        handleNavigateUp();
      } else if (key.downArrow) {
        handleNavigateDown();
      } else if (key.leftArrow) {
        handleNavigateLeft();
      } else if (key.rightArrow) {
        handleNavigateRight();
      } else if (key.return) {
        handleSelect();
      } else if (input === '0') {
        // '0' still works as shortcut to exit
        exitToNavBar();
      } else if (input === 'r' || input === 'R') {
        // Restart server
        if (selectedItem?.type === 'server' && selectedItem.server) {
          const server = selectedItem.server;
          setStatusMessage(`Restarting ${server.name}...`);
          restartServer(server.name)
            .then(() => {
              setStatusMessage(`${server.name} restarted successfully`);
              setTimeout(() => setStatusMessage(null), 3000);
            })
            .catch((err) => {
              setStatusMessage(
                `Failed to restart: ${err instanceof Error ? err.message : 'Unknown error'}`
              );
              setTimeout(() => setStatusMessage(null), 5000);
            });
        }
      } else if (input === 'c' || input === 'C') {
        // Configure server
        if (selectedItem?.type === 'server' && selectedItem.server) {
          setDialogState({ type: 'configure', serverName: selectedItem.server.name });
        }
      } else if (input === 'u' || input === 'U') {
        // Uninstall server
        if (selectedItem?.type === 'server' && selectedItem.server) {
          setDialogState({ type: 'uninstall', serverName: selectedItem.server.name });
        }
      } else if (input === 't' || input === 'T') {
        // Open tools view for selected server
        if (selectedItem?.type === 'server' && selectedItem.server) {
          setServerDetailInitialView('tools');
          setActiveColumn('right');
        }
      } else if (input === 'l' || input === 'L') {
        // View logs
        if (selectedItem?.type === 'server' && selectedItem.server) {
          setDialogState({ type: 'logs', serverName: selectedItem.server.name });
        }
      } else if (input === 'o' || input === 'O') {
        // OAuth configuration
        if (selectedItem?.type === 'server' && selectedItem.server) {
          setDialogState({ type: 'oauth', serverName: selectedItem.server.name });
        }
      } else if (input === 'h' || input === 'H') {
        setDialogState({ type: 'health' });
      }
    },
    { isActive: hasFocus }
  );

  // Note: Removed full-screen loading check - loading state now shown in left column
  // This allows marketplace to remain accessible during server loading

  // Error state with back navigation
  if (state.error) {
    return (
      <Box flexDirection="column" padding={2}>
        <ErrorBanner message={state.error} />
        <Box marginTop={2}>
          <Text bold color={uiState.theme.text.accent}>
            ▶ ← Back
          </Text>
          <Text dimColor> - Press </Text>
          <Text bold color="cyan">
            Enter, Esc or 0
          </Text>
          <Text dimColor> to return to main menu</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header with focus indicator */}
      <Box flexDirection="column" paddingX={1} paddingY={1} flexShrink={0}>
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              🔌 MCP Servers
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text
              wrap="truncate-end"
              color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}
              dimColor={!hasFocus}
            ></Text>
          </Box>
        </Box>
      </Box>

      {/* Two-column layout - Hide when dialog is open to focus on dialog */}
      {dialogState.type === null && (
        <Box flexGrow={1} overflow="hidden" flexDirection="row">
          {/* Left Column: Menu (30%) */}
          <Box
            flexDirection="column"
            width={absoluteLeftWidth ?? '30%'}
            flexShrink={0}
            borderStyle="single"
            borderColor={
              hasFocus && activeColumn === 'left'
                ? uiState.theme.text.accent
                : uiState.theme.border.primary
            }
            paddingY={1}
          >
            {/* Scroll indicator at top */}
            {scrollOffset > 0 && (
              <>
                <Box justifyContent="center" paddingX={1}>
                  <Text color={uiState.theme.text.accent} bold>
                    ▲ More above
                  </Text>
                </Box>
                <Text> </Text>
              </>
            )}

            {/* Scrollable content area */}
            <Box flexDirection="column" flexGrow={1} paddingX={1}>
              {visibleItems.map((item, index) => {
                const actualIndex = scrollOffset + index;
                const isSelected =
                  hasFocus && activeColumn === 'left' && actualIndex === selectedIndex;

                // Render Exit item
                if (item.type === 'exit') {
                  return (
                    <Box key="exit" flexDirection="column">
                      <Text
                        bold={isSelected}
                        color={isSelected ? uiState.theme.text.accent : uiState.theme.text.primary}
                      >
                        {item.icon} {item.label}
                      </Text>
                    </Box>
                  );
                }

                // Render Marketplace item
                if (item.type === 'marketplace') {
                  return (
                    <Box key="marketplace" flexDirection="column">
                      <Text> </Text>
                      <Text> </Text>
                      <Text bold={isSelected} color={isSelected ? 'yellow' : 'cyan'}>
                        {item.icon} {item.label}
                      </Text>
                    </Box>
                  );
                }

                return null;
              })}

              {/* Installed Servers Header - Always visible */}
              <Text> </Text>
              <Text> </Text>
              <Text bold color={uiState.theme.text.accent}>
                📦 Installed Servers
              </Text>
              <Text> </Text>

              {/* Loading indicator when servers are loading */}
              {state.isLoading && (
                <Box paddingLeft={2} flexDirection="column">
                  <LoadingSpinner
                    message="Loading MCP servers..."
                    spinnerType="dots"
                    color="cyan"
                    centered={false}
                    padded={false}
                  />
                </Box>
              )}

              {/* Render Server items */}
              {!state.isLoading &&
              visibleItems.filter((item) => item.type === 'server').length === 0 ? (
                <Text dimColor> No servers installed</Text>
              ) : !state.isLoading ? (
                visibleItems.map((item, index) => {
                  const actualIndex = scrollOffset + index;
                  const isSelected =
                    hasFocus && activeColumn === 'left' && actualIndex === selectedIndex;

                  // Render Server item
                  if (item.type === 'server' && item.server) {
                    const phase = item.server.phase || 'stopped';
                    const isDisabled = item.server.config.disabled;

                    // Determine icon color based on phase
                    let iconColor = 'gray';
                    if (!isDisabled) {
                      if (phase === 'connected') {
                        iconColor = 'green';
                      } else if (
                        phase === 'starting' ||
                        phase === 'connecting' ||
                        phase === 'health-check'
                      ) {
                        iconColor = 'yellow';
                      } else if (phase === 'unhealthy' || phase === 'error') {
                        iconColor = 'red';
                      }
                    }

                    // Determine status text and color based on phase
                    let statusText = '○ Stopped';
                    let statusColor = 'gray';

                    if (isDisabled) {
                      statusText = '○ Disabled';
                      statusColor = 'gray';
                    } else {
                      switch (phase) {
                        case 'starting':
                          statusText = '⟳ Starting...';
                          statusColor = 'yellow';
                          break;
                        case 'connecting':
                          statusText = '⟳ Connecting...';
                          statusColor = 'yellow';
                          break;
                        case 'health-check':
                          statusText = '⟳ Checking health...';
                          statusColor = 'yellow';
                          break;
                        case 'connected':
                          statusText = '✓ Connected';
                          statusColor = 'green';
                          break;
                        case 'unhealthy':
                          statusText = '✗ Unhealthy';
                          statusColor = 'red';
                          break;
                        case 'error':
                          statusText = '✗ Connection failed';
                          statusColor = 'red';
                          break;
                        default:
                          statusText = '○ Stopped';
                          statusColor = 'gray';
                      }
                    }

                    return (
                      <Box key={item.server.name} flexDirection="column">
                        <Text
                          bold={isSelected}
                          color={
                            isSelected
                              ? uiState.theme.text.accent
                              : isDisabled
                                ? 'gray'
                                : uiState.theme.text.primary
                          }
                          dimColor={isDisabled}
                        >
                          <Text color={iconColor}>{item.icon}</Text> {item.label}
                        </Text>
                        {/* Always show status line (not just when selected) */}
                        <Box paddingLeft={2}>
                          <Text dimColor={isDisabled} color={statusColor}>
                            {statusText}
                          </Text>
                        </Box>
                        {/* Empty line for visual separation */}
                        <Text> </Text>
                      </Box>
                    );
                  }

                  return null;
                })
              ) : null}
            </Box>

            {/* Scroll indicator at bottom */}
            {scrollOffset + windowSize < menuItems.length && (
              <>
                <Text> </Text>
                <Box justifyContent="center" paddingX={1}>
                  <Text color={uiState.theme.text.accent} bold>
                    ▼ More below
                  </Text>
                </Box>
              </>
            )}

            {/* System Messages at bottom of left column */}
            {systemMessages.length > 0 && (
              <Box flexShrink={0} marginTop={1}>
                <SystemMessages
                  messages={systemMessages}
                  onDismiss={(id) => {
                    setSystemMessages((prev) => prev.filter((m) => m.id !== id));
                  }}
                  isActive={hasFocus && activeColumn === 'left'}
                />
              </Box>
            )}
          </Box>

          {/* Right Column: Dynamic Content (70%) */}
          <Box
            flexDirection="column"
            width={absoluteRightWidth ?? '70%'}
            flexShrink={0}
            paddingX={2}
            paddingY={2}
          >
            {/* Top Right Navigation Hints */}
            <Box flexShrink={0} justifyContent="flex-end" marginBottom={1}>
              <Text dimColor>↑↓:Nav ←→:Column Enter:Select</Text>
            </Box>

            <Box flexDirection="column" flexGrow={1} overflow="hidden">
              {(!selectedItem || selectedItem?.type === 'exit') && (
                <Box
                  flexDirection="column"
                  paddingX={2}
                  paddingY={1}
                  alignItems="center"
                  width="100%"
                >
                  <Text></Text>
                  <Text></Text>
                  <Text></Text>
                  <Text></Text>

                  <Text bold color={uiState.theme.text.accent}>
                    ═══════════════════════════════════════════════════════════════════
                  </Text>
                  <Text></Text>
                  <Text bold color={uiState.theme.text.accent}>
                    MCP Registry - Marketplace
                  </Text>
                  <Text></Text>
                  <Text>The MCP registry provides MCP clients with a list of MCP servers.</Text>
                  <Text></Text>
                  <Text></Text>
                  <Text bold color={uiState.theme.text.accent}>
                    OLLM CLI use Official Open Source MCP Registry
                  </Text>
                  <Text></Text>
                  <Text>MCP Registry: https://registry.modelcontextprotocol.io/</Text>
                  <Text>
                    MCP Registry Documentation: https://registry.modelcontextprotocol.io/docs
                  </Text>
                  <Text></Text>
                  <Text></Text>
                  <Text color={uiState.theme.text.secondary}>
                    ───────────────────────────────────────────────────────────────────
                  </Text>
                  <Text></Text>
                  <Text bold>Documentation:</Text>
                  <Text></Text>
                  <Text>
                    📄 <Text color={uiState.theme.text.accent}>Public-facing docs</Text> - Published
                    on modelcontextprotocol.io
                  </Text>
                  <Text></Text>
                  <Text>
                    🏗️ <Text color={uiState.theme.text.accent}>Design documentation</Text> -
                    Architecture, vision, and roadmap
                  </Text>
                  <Text></Text>
                  <Text>
                    📖 <Text color={uiState.theme.text.accent}>Reference</Text> - Technical
                    specifications
                  </Text>
                  <Text></Text>
                  <Text>
                    🔧 <Text color={uiState.theme.text.accent}>Contributing guides</Text> - How to
                    contribute
                  </Text>
                  <Text></Text>
                  <Text>
                    🔒 <Text color={uiState.theme.text.accent}>Administration</Text> - Admin
                    operations
                  </Text>
                  <Text></Text>
                  <Text color={uiState.theme.text.secondary}>
                    ───────────────────────────────────────────────────────────────────
                  </Text>
                  <Text></Text>
                  <Text color={uiState.theme.text.secondary} dimColor>
                    Press Enter to browse marketplace or ↑↓ to navigate
                  </Text>
                  <Text></Text>
                  <Text bold color={uiState.theme.text.accent}>
                    ═══════════════════════════════════════════════════════════════════
                  </Text>
                </Box>
              )}

              {selectedItem?.type === 'marketplace' && (
                <MarketplaceContent
                  activeColumn={activeColumn}
                  height={terminalHeight}
                  onRefreshServers={refreshServers}
                  onDetailViewChange={handleDetailViewChange}
                />
              )}

              {selectedItem?.type === 'server' && selectedItem.server && (
                <ServerDetailsContent
                  server={selectedItem.server}
                  activeColumn={activeColumn}
                  initialView={serverDetailInitialView}
                  onToggle={async () => {
                    // Toggle server enabled/disabled in settings
                    try {
                      await toggleServer(selectedItem.server!.name);
                    } catch (err) {
                      // Error is already set in MCPContext state, just log it
                      console.error('Toggle failed:', err);
                    }
                  }}
                  onDelete={async () => {
                    // Permanently delete server from settings
                    await uninstallServer(selectedItem.server!.name);
                  }}
                  onRefreshServers={refreshServers}
                />
              )}

              {!selectedItem && (
                <Box
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  height="100%"
                >
                  <Text color={uiState.theme.text.secondary} dimColor>
                    👆 Select an item to view details
                  </Text>
                </Box>
              )}
            </Box>

            {/* Bottom Status Area */}
            <Box
              flexShrink={0}
              marginTop={1}
              height={3}
              borderStyle="single"
              borderColor={uiState.theme.border.primary}
              paddingX={1}
            >
              {statusMessage ? (
                <Text color={uiState.theme.text.primary}>{statusMessage}</Text>
              ) : state.operationsInProgress.size > 0 ? (
                <Text color={uiState.theme.text.secondary}>
                  {Array.from(state.operationsInProgress.entries())
                    .map(([name, op]) => `${name}: ${op}...`)
                    .join(' | ')}
                </Text>
              ) : (
                <Text dimColor> </Text>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {dialogState.type !== null && renderDialog()}

      {/* Render active dialog (moved inside conditional above) */}
    </Box>
  );
}
