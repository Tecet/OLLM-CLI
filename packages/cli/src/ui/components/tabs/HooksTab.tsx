import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { HookRegistry } from '@ollm/ollm-cli-core/hooks/hookRegistry.js';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { useHooks } from '../../contexts/HooksContext.js';
import { AddHookDialog, type HookFormData } from '../dialogs/AddHookDialog.js';
import { DeleteConfirmationDialog } from '../dialogs/DeleteConfirmationDialog.js';
import { EditHookDialog } from '../dialogs/EditHookDialog.js';
import { TestHookDialog } from '../dialogs/TestHookDialog.js';
import { HookItem } from '../hooks/HookItem.js';

import type { Hook } from '@ollm/ollm-cli-core/hooks/types.js';

// Category icon mapping with enhanced visual icons
const getCategoryIcon = (categoryName: string): string => {
  const icons: Record<string, string> = {
    'Session Events': '🔄',
    'Agent Events': '🤖',
    'Model Events': '🧠',
    'Tool Events': '🔧',
    'Compression Events': '📦',
    Notifications: '🔔',
    'File Events': '📝',
    'Prompt Events': '💬',
    'User Triggered': '👤',
  };
  return icons[categoryName] || '📦';
};

// Action icons for keyboard shortcuts
const ACTION_ICONS = {
  add: '➕',
  edit: '✏️',
  delete: '🗑️',
  test: '🧪',
  toggle: '🔄',
  exit: '⬅️',
} as const;

export interface HooksTabProps {
  windowSize?: number;
  windowWidth?: number;
}

/**
 * HooksTab component
 *
 * Main container for the Hooks Panel UI with two-column layout:
 * - Left (30%): Hook list organized by category with Exit item
 * - Right (70%): Detailed information for selected hook
 *
 * Features:
 * - Windowed rendering for large hook lists
 * - Keyboard navigation (↑↓ for navigation, ←→/Enter for toggle)
 * - Enable/disable hooks with visual indicators (● enabled, ○ disabled)
 * - Dialog state management for Add/Edit/Delete/Test operations
 *
 * Requirements: 1.1, 1.2, 1.3
 */
export function HooksTab({ windowSize = 30, windowWidth }: HooksTabProps) {
  const { state: uiState } = useUI();
  const { isFocused, exitToNavBar } = useFocusManager();
  const { state: hooksState, toggleHook, isHookEnabled, refreshHooks } = useHooks();

  // Calculate absolute widths if windowWidth is provided
  const absoluteLeftWidth = windowWidth ? Math.floor(windowWidth * 0.3) : undefined;
  const absoluteRightWidth =
    windowWidth && absoluteLeftWidth ? windowWidth - absoluteLeftWidth : undefined;

  // Get HookRegistry instance for checking editability
  const hookRegistry = useMemo(() => new HookRegistry(), []);

  // Check if this panel has focus
  const hasFocus = isFocused('hooks-panel');

  // Navigation state
  const [selectedCategoryIndex, setSelectedCategoryIndex] = useState(0);
  const [selectedHookIndex, setSelectedHookIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isOnExitItem, setIsOnExitItem] = useState(false);

  // Dialog state management
  const [dialogState, setDialogState] = useState<{
    type: 'add' | 'edit' | 'delete' | 'test' | null;
    hookId?: string;
  }>({ type: null });

  // Calculate total items for windowed rendering
  const totalItems = useMemo(() => {
    return hooksState.categories.reduce((sum, cat) => sum + cat.hooks.length + 1, 0) + 1; // +1 for category header, +1 for Exit item
  }, [hooksState.categories]);

  // Calculate which categories and hooks should be visible in the current window
  const visibleItems = useMemo(() => {
    const items: Array<{
      type: 'exit' | 'category' | 'hook';
      categoryIndex: number;
      hookIndex?: number;
      position: number;
    }> = [];

    let position = 0;

    // Add Exit item at position 0
    items.push({
      type: 'exit',
      categoryIndex: -1,
      position: position++,
    });

    hooksState.categories.forEach((category, catIndex) => {
      // Add category header
      items.push({
        type: 'category',
        categoryIndex: catIndex,
        position: position++,
      });

      // Add hooks
      category.hooks.forEach((_, hookIndex) => {
        items.push({
          type: 'hook',
          categoryIndex: catIndex,
          hookIndex,
          position: position++,
        });
      });
    });

    // Filter to visible window
    return items.filter(
      (item) => item.position >= scrollOffset && item.position < scrollOffset + windowSize
    );
  }, [hooksState.categories, scrollOffset, windowSize]);

  // Get currently selected hook
  const selectedHook = useMemo(() => {
    if (isOnExitItem) return null;

    if (selectedCategoryIndex >= 0 && selectedCategoryIndex < hooksState.categories.length) {
      const category = hooksState.categories[selectedCategoryIndex];
      if (selectedHookIndex >= 0 && selectedHookIndex < category.hooks.length) {
        return category.hooks[selectedHookIndex];
      }
    }
    return null;
  }, [hooksState.categories, selectedCategoryIndex, selectedHookIndex, isOnExitItem]);

  // Navigation handlers
  const handleNavigateUp = () => {
    if (isOnExitItem) {
      // Already at Exit, can't go up
      return;
    }

    if (selectedHookIndex > 0) {
      setSelectedHookIndex((prev) => prev - 1);
    } else if (selectedCategoryIndex > 0) {
      // Move to previous category's last hook
      const prevCategory = hooksState.categories[selectedCategoryIndex - 1];
      setSelectedCategoryIndex((prev) => prev - 1);
      setSelectedHookIndex(prevCategory.hooks.length - 1);
    } else {
      // At first hook of first category, move to Exit
      setIsOnExitItem(true);
      setScrollOffset(0);
    }
  };

  const handleNavigateDown = () => {
    if (isOnExitItem) {
      // Move from Exit to first hook
      setIsOnExitItem(false);
      setSelectedCategoryIndex(0);
      setSelectedHookIndex(0);
      return;
    }

    const currentCategory = hooksState.categories[selectedCategoryIndex];
    if (!currentCategory) return;

    if (selectedHookIndex < currentCategory.hooks.length - 1) {
      setSelectedHookIndex((prev) => prev + 1);
    } else if (selectedCategoryIndex < hooksState.categories.length - 1) {
      // Move to next category's first hook
      setSelectedCategoryIndex((prev) => prev + 1);
      setSelectedHookIndex(0);
    }
  };

  const handleToggleCurrent = () => {
    // Check if we're on the Exit item
    if (isOnExitItem) {
      exitToNavBar();
      return;
    }

    if (selectedHook) {
      toggleHook(selectedHook.id);
    }
  };

  // Dialog handlers
  const openAddDialog = () => {
    setDialogState({ type: 'add' });
  };

  const openEditDialog = () => {
    if (selectedHook) {
      setDialogState({ type: 'edit', hookId: selectedHook.id });
    }
  };

  const openDeleteDialog = () => {
    if (selectedHook) {
      setDialogState({ type: 'delete', hookId: selectedHook.id });
    }
  };

  const openTestDialog = () => {
    if (selectedHook) {
      setDialogState({ type: 'test', hookId: selectedHook.id });
    }
  };

  const closeDialog = () => {
    setDialogState({ type: null });
  };

  // Dialog action handlers
  const handleAddHook = async (formData: HookFormData) => {
    try {
      // Generate hook ID from name
      const hookId = formData.name.toLowerCase().replace(/\s+/g, '-');

      // Create hook object
      const _newHook: Hook = {
        id: hookId,
        name: formData.name,
        command: formData.command,
        args: formData.args.length > 0 ? formData.args : undefined,
        source: 'user',
      };

      // Save hook to file (this will need to be implemented in HookRegistry)
      // For now, just refresh hooks
      await refreshHooks();

      // Close dialog
      closeDialog();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create hook');
    }
  };

  const handleEditHook = async (_hookId: string, _updates: Partial<Hook>) => {
    try {
      // Update hook (this will need to be implemented in HookRegistry)
      // For now, just refresh hooks
      await refreshHooks();

      // Close dialog
      closeDialog();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update hook');
    }
  };

  const handleDeleteHook = async () => {
    if (!selectedHook) return;

    try {
      // Delete hook (this will need to be implemented in HookRegistry)
      // For now, just refresh hooks
      await refreshHooks();

      // Close dialog
      closeDialog();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to delete hook');
    }
  };

  // Handle keyboard input
  useInput(
    (input, key) => {
      // Handle dialog keyboard input
      if (dialogState.type !== null) {
        if (key.escape || input === 'c' || input === 'C') {
          closeDialog();
        } else if (input === 's' || input === 'S') {
          // Save action handled by dialog component
        } else if (input === 'd' || input === 'D') {
          // Delete action handled by dialog component
        }
        return;
      }

      // Allow ESC to bubble to global handler when no dialog is open
      if (key.escape) return;

      // Handle navigation
      if (key.upArrow) {
        handleNavigateUp();
      } else if (key.downArrow) {
        handleNavigateDown();
      } else if (key.leftArrow || key.rightArrow || key.return) {
        handleToggleCurrent();
      } else if (input === '0') {
        // '0' still works as shortcut to exit
        exitToNavBar();
      } else if (input === 'a' || input === 'A') {
        openAddDialog();
      } else if (input === 'e' || input === 'E') {
        openEditDialog();
      } else if (input === 'd' || input === 'D') {
        openDeleteDialog();
      } else if (input === 't' || input === 'T') {
        openTestDialog();
      }
    },
    { isActive: hasFocus }
  );

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (isOnExitItem) {
      setScrollOffset(0);
      return;
    }

    let currentPosition = 1; // Start at 1 because Exit is at position 0
    for (let i = 0; i < selectedCategoryIndex; i++) {
      currentPosition += hooksState.categories[i].hooks.length + 1;
    }
    currentPosition += selectedHookIndex + 1; // +1 for category header

    if (currentPosition < scrollOffset) {
      setScrollOffset(currentPosition);
    } else if (currentPosition >= scrollOffset + windowSize) {
      setScrollOffset(currentPosition - windowSize + 1);
    }
  }, [
    selectedCategoryIndex,
    selectedHookIndex,
    hooksState.categories,
    scrollOffset,
    windowSize,
    isOnExitItem,
  ]);

  // Loading state with enhanced styling
  if (hooksState.isLoading) {
    return (
      <Box flexDirection="column" padding={2} alignItems="center" justifyContent="center">
        <Text color="cyan" bold>
          ⏳ Loading hooks...
        </Text>
      </Box>
    );
  }

  // Error state with enhanced styling
  if (hooksState.error) {
    return (
      <Box flexDirection="column" padding={2}>
        <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={1}>
          <Text color="redBright" bold>
            ⚠️ Error loading hooks
          </Text>
        </Box>
        <Box marginTop={1} paddingLeft={2}>
          <Text color={uiState.theme.text.secondary}>{hooksState.error}</Text>
        </Box>
      </Box>
    );
  }

  // No hooks available with enhanced styling
  if (hooksState.categories.length === 0) {
    return (
      <Box flexDirection="column" padding={2} alignItems="center" justifyContent="center">
        <Box borderStyle="round" borderColor={uiState.theme.text.accent} paddingX={2} paddingY={1}>
          <Text color={uiState.theme.text.accent} bold>
            📭 No hooks available
          </Text>
        </Box>
        <Box marginTop={2}>
          <Text color={uiState.theme.text.secondary}>
            Press{' '}
            <Text color="cyan" bold>
              A
            </Text>{' '}
            to add a new hook
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%" width={windowWidth}>
      {/* Header */}
      <Box
        borderStyle="single"
        borderColor={hasFocus ? uiState.theme.text.accent : uiState.theme.text.secondary}
        paddingX={1}
        flexShrink={0}
      >
        <Box justifyContent="space-between" width="100%" overflow="hidden">
          <Box flexShrink={0}>
            <Text bold color={hasFocus ? uiState.theme.text.accent : uiState.theme.text.primary}>
              🎣 Hooks Configuration
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text
              wrap="truncate-end"
              color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}
            >
              ↑↓:Nav Enter:Toggle A:Add E:Edit D:Del T:Test 0/Esc:Exit
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Show corrupted hooks warning */}
      {hooksState.corruptedHooks.length > 0 && (
        <Box paddingX={1} paddingY={1} flexShrink={0}>
          <Box borderStyle="round" borderColor="yellow" paddingX={1}>
            <Text color="yellow" bold>
              ⚠️ {hooksState.corruptedHooks.length} corrupted hook(s) found
            </Text>
          </Box>
        </Box>
      )}

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden" width="100%">
        {/* Left column: Hook list (30%) */}
        <Box
          flexDirection="column"
          width={absoluteLeftWidth ?? '30%'}
          height="100%"
          borderStyle="single"
          borderColor={hasFocus ? 'cyan' : uiState.theme.border.primary}
          paddingY={1}
        >
          {/* Scroll indicator at top - STICKY with improved styling */}
          {scrollOffset > 0 && (
            <>
              <Box
                justifyContent="center"
                paddingX={1}
                borderStyle="round"
                borderColor={uiState.theme.text.secondary}
              >
                <Text color="cyan" bold>
                  ▲ More above
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
                // Render Exit item with icon
                return (
                  <React.Fragment key="exit-item">
                    <Box paddingY={0}>
                      <Text
                        bold={isOnExitItem && hasFocus}
                        color={
                          isOnExitItem && hasFocus
                            ? uiState.theme.text.accent
                            : uiState.theme.text.primary
                        }
                      >
                        {ACTION_ICONS.exit} Exit
                      </Text>
                    </Box>
                    <Text> </Text>
                    <Box
                      borderStyle="single"
                      borderColor={uiState.theme.border.primary}
                      width="100%"
                    >
                      <Text> </Text>
                    </Box>
                    <Text> </Text>
                  </React.Fragment>
                );
              } else if (item.type === 'category') {
                const category = hooksState.categories[item.categoryIndex];

                const hasVisibleHooks = visibleItems.some(
                  (vi) => vi.type === 'hook' && vi.categoryIndex === item.categoryIndex
                );

                if (!hasVisibleHooks) return null;

                return (
                  <Box
                    key={`cat-${item.categoryIndex}`}
                    marginTop={item.categoryIndex > 0 ? 1 : 0}
                    paddingY={0}
                  >
                    <Text bold color="cyan">
                      {getCategoryIcon(category.name)} {category.name}
                    </Text>
                  </Box>
                );
              } else {
                // Render hook item using HookItem component
                const category = hooksState.categories[item.categoryIndex];
                const hook = category.hooks[item.hookIndex!];
                const isSelectedCategory = item.categoryIndex === selectedCategoryIndex;
                const isHookSelected =
                  hasFocus &&
                  !isOnExitItem &&
                  isSelectedCategory &&
                  item.hookIndex === selectedHookIndex;
                const isEnabled = isHookEnabled(hook.id);

                return (
                  <HookItem
                    key={`hook-${hook.id}`}
                    hook={hook}
                    isSelected={isHookSelected}
                    hasFocus={hasFocus}
                    isEnabled={isEnabled}
                    theme={uiState.theme}
                  />
                );
              }
            })}
          </Box>

          {/* Scroll indicator at bottom - STICKY with improved styling */}
          {scrollOffset + windowSize < totalItems && (
            <>
              <Text> </Text>
              <Box
                justifyContent="center"
                paddingX={1}
                borderStyle="round"
                borderColor={uiState.theme.text.secondary}
              >
                <Text color="cyan" bold>
                  ▼ More below
                </Text>
              </Box>
            </>
          )}
        </Box>

        {/* Right column: Hook details (70%) */}
        <Box
          flexDirection="column"
          width={absoluteRightWidth ?? '70%'}
          height="100%"
          borderStyle="single"
          borderColor={uiState.theme.border.primary}
          paddingX={2}
          paddingY={2}
        >
          {selectedHook ? (
            <>
              {/* Hook name with icon */}
              <Box>
                <Text bold color={uiState.theme.text.accent}>
                  🎯 {selectedHook.name}
                </Text>
              </Box>

              {/* Hook ID with subtle styling */}
              <Box marginTop={1} paddingLeft={2}>
                <Text color={uiState.theme.text.secondary} dimColor>
                  ID: {selectedHook.id}
                </Text>
              </Box>

              {/* Divider */}
              <Box marginTop={1} marginBottom={1}>
                <Text color={uiState.theme.border.primary}>
                  ────────────────────────────────────
                </Text>
              </Box>

              {/* Hook command with icon */}
              <Box marginTop={1}>
                <Text color="cyan" bold>
                  💻 Command:
                </Text>
              </Box>
              <Box paddingLeft={2} marginTop={0}>
                <Text color={uiState.theme.text.primary}>{selectedHook.command}</Text>
              </Box>

              {/* Hook arguments with icon */}
              {selectedHook.args && selectedHook.args.length > 0 && (
                <>
                  <Box marginTop={1}>
                    <Text color="cyan" bold>
                      📋 Arguments:
                    </Text>
                  </Box>
                  <Box paddingLeft={2} marginTop={0}>
                    <Text color={uiState.theme.text.primary}>{selectedHook.args.join(' ')}</Text>
                  </Box>
                </>
              )}

              {/* Divider */}
              <Box marginTop={1} marginBottom={1}>
                <Text color={uiState.theme.border.primary}>
                  ────────────────────────────────────
                </Text>
              </Box>

              {/* Hook source with icon */}
              <Box marginTop={1}>
                <Text color="magenta" bold>
                  📦 Source:
                </Text>
                <Box marginLeft={1}>
                  <Text color={uiState.theme.text.secondary}>{selectedHook.source}</Text>
                </Box>
              </Box>

              {/* Extension name if applicable with icon */}
              {selectedHook.extensionName && (
                <Box marginTop={1}>
                  <Text color="magenta" bold>
                    🔌 Extension:
                  </Text>
                  <Box marginLeft={1}>
                    <Text color={uiState.theme.text.secondary}>{selectedHook.extensionName}</Text>
                  </Box>
                </Box>
              )}

              {/* Divider */}
              <Box marginTop={1} marginBottom={1}>
                <Text color={uiState.theme.border.primary}>
                  ────────────────────────────────────
                </Text>
              </Box>

              {/* Hook status with enhanced visual distinction */}
              <Box
                marginTop={1}
                paddingX={1}
                paddingY={1}
                borderStyle="round"
                borderColor={isHookEnabled(selectedHook.id) ? 'green' : 'red'}
              >
                <Text color={isHookEnabled(selectedHook.id) ? 'green' : 'red'} bold>
                  {isHookEnabled(selectedHook.id) ? '✓ Enabled' : '✗ Disabled'}
                </Text>
              </Box>
            </>
          ) : (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
              <Text color={uiState.theme.text.secondary} dimColor>
                {isOnExitItem
                  ? '⬅️  Press Enter or Esc to exit'
                  : '👆 Select a hook to view details'}
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* TODO: Render dialogs when dialog components are implemented */}
      {dialogState.type === 'add' && (
        <Box alignItems="center" justifyContent="center" marginTop={2} marginBottom={2}>
          <AddHookDialog onSave={handleAddHook} onCancel={closeDialog} />
        </Box>
      )}
      {dialogState.type === 'edit' && selectedHook && (
        <Box alignItems="center" justifyContent="center" marginTop={2} marginBottom={2}>
          <EditHookDialog
            hook={selectedHook}
            onSave={handleEditHook}
            onCancel={closeDialog}
            isEditable={hookRegistry.isEditable(selectedHook.id)}
          />
        </Box>
      )}
      {dialogState.type === 'delete' && selectedHook && (
        <Box alignItems="center" justifyContent="center" marginTop={2} marginBottom={2}>
          <DeleteConfirmationDialog
            hook={selectedHook}
            onConfirm={handleDeleteHook}
            onCancel={closeDialog}
            isDeletable={hookRegistry.isDeletable(selectedHook.id)}
          />
        </Box>
      )}
      {dialogState.type === 'test' && selectedHook && (
        <Box alignItems="center" justifyContent="center" marginTop={2} marginBottom={2}>
          <TestHookDialog hook={selectedHook} onClose={closeDialog} />
        </Box>
      )}
    </Box>
  );
}
