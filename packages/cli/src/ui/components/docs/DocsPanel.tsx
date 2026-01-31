import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';
import { documentService } from '../../../services/documentService.js';
import { useTabEscapeHandler } from '../../hooks/useTabEscapeHandler.js';

// Keep WINDOW_SIZE as a fallback, but we'll calculate it dynamically

/**
 * DocsPanel Component
 *
 * Two-column documentation browser:
 * - Left (30%): Document navigation tree
 * - Right (70%): Document content viewer
 *
 * Navigation:
 * - Up/Down: Navigate documents (left column)
 * - Left/Right: Switch between columns
 * - Up/Down: Scroll content (right column)
 * - Enter: Select document
 * - Esc/0: Exit to nav-bar
 */
interface DocsPanelProps {
  height: number;
  windowWidth?: number;
}

export function DocsPanel({ height, windowWidth }: DocsPanelProps) {
  const { state: uiState } = useUI();
  const focusManager = useFocusManager();
  const hasFocus = focusManager.isFocused('docs-panel');

  // Use shared escape handler for consistent navigation
  useTabEscapeHandler(hasFocus);

  // Calculate absolute widths if windowWidth is provided
  const absoluteLeftWidth = windowWidth ? Math.floor(windowWidth * 0.3) : undefined;
  const absoluteRightWidth =
    windowWidth && absoluteLeftWidth ? windowWidth - absoluteLeftWidth : undefined;

  // State
  const [selectedFolderIndex, setSelectedFolderIndex] = useState(0);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [focusedColumn, setFocusedColumn] = useState<'left' | 'right'>('left');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [contentScrollOffset, setContentScrollOffset] = useState(0);
  const [isOnExitItem, setIsOnExitItem] = useState(false);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);

  // Discover documents
  const folders = useMemo(() => documentService.discoverDocuments(), []);

  // Calculate total items for windowed rendering
  const totalItems = useMemo(() => {
    return folders.reduce((sum, folder) => sum + folder.documents.length + 1, 0) + 1; // +1 for folder header, +1 for Exit
  }, [folders]);

  // Get currently selected document
  const selectedDocument = useMemo(() => {
    if (isOnExitItem || selectedFolderIndex >= folders.length) {
      return null;
    }
    const folder = folders[selectedFolderIndex];
    if (selectedDocIndex >= folder.documents.length) {
      return null;
    }
    return folder.documents[selectedDocIndex];
  }, [folders, selectedFolderIndex, selectedDocIndex, isOnExitItem]);

  // Load document content when selection changes
  useEffect(() => {
    if (!selectedDocument) {
      setDocumentContent('');
      return;
    }

    const loadContent = async () => {
      setLoadingContent(true);
      try {
        const content = await documentService.loadDocument(selectedDocument.path);
        setDocumentContent(content);
        setContentScrollOffset(0); // Reset scroll when loading new document
      } catch (error) {
        setDocumentContent(`Error loading document: ${error}`);
      } finally {
        setLoadingContent(false);
      }
    };

    loadContent();
  }, [selectedDocument]);

  // Calculate visible items for windowed rendering
  const visibleItems = useMemo(() => {
    const items: Array<{
      type: 'exit' | 'folder' | 'document';
      folderIndex: number;
      docIndex?: number;
      position: number;
    }> = [];

    let position = 0;

    // Add Exit item
    items.push({
      type: 'exit',
      folderIndex: -1,
      position: position++,
    });

    // Add folders and documents
    folders.forEach((folder, folderIdx) => {
      items.push({
        type: 'folder',
        folderIndex: folderIdx,
        position: position++,
      });

      folder.documents.forEach((_, docIdx) => {
        items.push({
          type: 'document',
          folderIndex: folderIdx,
          docIndex: docIdx,
          position: position++,
        });
      });
    });

    // Dynamic WINDOW_SIZE based on height
    // Height - Header(3) - ScrollIndicators(2?) - Borders(2)
    // We can approximate content area:
    const effectiveWindowSize = Math.max(5, height - 6);

    return items.filter(
      (item) => item.position >= scrollOffset && item.position < scrollOffset + effectiveWindowSize
    );
  }, [folders, scrollOffset, height]);

  // Navigation handlers
  const handleNavigateUp = () => {
    if (focusedColumn === 'right') {
      // Scroll content up
      setContentScrollOffset((prev) => Math.max(0, prev - 1));
      return;
    }

    // Left column navigation
    if (isOnExitItem) {
      return; // Already at top
    }

    if (selectedDocIndex > 0) {
      setSelectedDocIndex((prev) => prev - 1);
    } else if (selectedFolderIndex > 0) {
      // Move to previous folder's last document
      const prevFolder = folders[selectedFolderIndex - 1];
      setSelectedFolderIndex((prev) => prev - 1);
      setSelectedDocIndex(prevFolder.documents.length - 1);
    } else {
      // Move to Exit
      setIsOnExitItem(true);
      setScrollOffset(0);
    }
  };

  const handleNavigateDown = () => {
    if (focusedColumn === 'right') {
      // Scroll content down
      const contentLines = documentContent.split('\n').length;
      setContentScrollOffset((prev) => Math.min(contentLines - 1, prev + 1));
      return;
    }

    // Left column navigation
    if (isOnExitItem) {
      // Move from Exit to first document
      setIsOnExitItem(false);
      setSelectedFolderIndex(0);
      setSelectedDocIndex(0);
      return;
    }

    const currentFolder = folders[selectedFolderIndex];
    if (selectedDocIndex < currentFolder.documents.length - 1) {
      setSelectedDocIndex((prev) => prev + 1);
    } else if (selectedFolderIndex < folders.length - 1) {
      // Move to next folder's first document
      setSelectedFolderIndex((prev) => prev + 1);
      setSelectedDocIndex(0);
    }
  };

  const handleSwitchColumn = (direction: 'left' | 'right') => {
    if (direction === 'right' && focusedColumn === 'left' && selectedDocument) {
      setFocusedColumn('right');
    } else if (direction === 'left' && focusedColumn === 'right') {
      setFocusedColumn('left');
    }
  };

  /**
   * Keyboard Navigation
   *
   * Navigation Keys:
   * - ↑/↓: Navigate documents or scroll content
   * - ←/→: Switch between columns
   * - Enter: Select document
   * - ESC/0: Exit to nav bar (handled by useTabEscapeHandler)
   *
   * Note: ESC handling is now managed by the shared useTabEscapeHandler hook
   * for consistent hierarchical navigation across all tab components.
   */
  useInput(
    (input, key) => {
      if (!hasFocus) return;

      if (key.upArrow) {
        handleNavigateUp();
      } else if (key.downArrow) {
        handleNavigateDown();
      } else if (key.leftArrow) {
        handleSwitchColumn('left');
      } else if (key.rightArrow) {
        handleSwitchColumn('right');
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

    let currentPosition = 1; // Start at 1 (Exit is at 0)
    for (let i = 0; i < selectedFolderIndex; i++) {
      currentPosition += folders[i].documents.length + 1;
    }
    currentPosition += selectedDocIndex + 1; // +1 for folder header

    const effectiveWindowSize = Math.max(5, height - 6);

    if (currentPosition < scrollOffset) {
      setScrollOffset(currentPosition);
    } else if (currentPosition >= scrollOffset + effectiveWindowSize) {
      setScrollOffset(currentPosition - effectiveWindowSize + 1);
    }
  }, [selectedFolderIndex, selectedDocIndex, isOnExitItem, folders, scrollOffset, height]);

  // Render content lines for right column
  const contentLines = useMemo(() => {
    return documentContent.split('\n');
  }, [documentContent]);

  const visibleContentLines = useMemo(() => {
    // Height - Borders(2) - PaddingY(2) - Title(1) - Spacer(1) - ScrollIndicator(1) - Safety(5ish)
    const maxLines = Math.max(5, height - 12);
    return contentLines.slice(contentScrollOffset, contentScrollOffset + maxLines);
  }, [contentLines, contentScrollOffset, height]);

  return (
    <Box flexDirection="column" height={height} width={windowWidth}>
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
              Documentation
            </Text>
          </Box>
          <Box flexShrink={1} marginLeft={1}>
            <Text
              wrap="truncate-end"
              color={hasFocus ? uiState.theme.text.primary : uiState.theme.text.secondary}
            >
              ↑↓:Nav ←→:Column Enter:Select 0/Esc:Exit
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden" flexDirection="row" width="100%">
        {/* Left column: Document list (30%) */}
        <Box
          flexDirection="column"
          width={absoluteLeftWidth ?? '30%'}
          height="100%"
          borderStyle="single"
          borderColor={
            focusedColumn === 'left' && hasFocus
              ? uiState.theme.text.accent
              : uiState.theme.border.primary
          }
          paddingY={1}
        >
          {/* Scroll indicator at top */}
          {scrollOffset > 0 && (
            <>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>▲ Scroll up for more</Text>
              </Box>
              <Text> </Text>
            </>
          )}

          {/* Scrollable content area */}
          <Box flexDirection="column" flexGrow={1} paddingX={1}>
            {/* Render only visible items */}
            {visibleItems.map((item) => {
              if (item.type === 'exit') {
                return (
                  <React.Fragment key="exit-item">
                    <Box>
                      <Text
                        bold={isOnExitItem && hasFocus}
                        color={isOnExitItem && hasFocus ? 'yellow' : uiState.theme.text.primary}
                      >
                        ← Exit
                      </Text>
                    </Box>
                    <Text> </Text>
                    <Text> </Text>
                  </React.Fragment>
                );
              } else if (item.type === 'folder') {
                const folder = folders[item.folderIndex];
                return (
                  <Box key={`folder-${item.folderIndex}`} marginTop={item.folderIndex > 0 ? 1 : 0}>
                    <Text bold color={uiState.theme.text.primary}>
                      📁 {folder.name}
                    </Text>
                  </Box>
                );
              } else {
                // Document item
                const folder = folders[item.folderIndex];
                const doc = folder.documents[item.docIndex!];
                const isSelected =
                  !isOnExitItem &&
                  item.folderIndex === selectedFolderIndex &&
                  item.docIndex === selectedDocIndex &&
                  focusedColumn === 'left';

                return (
                  <Box key={`doc-${doc.path}`} paddingLeft={2} marginBottom={1} width="100%">
                    <Text
                      bold={isSelected && hasFocus}
                      color={isSelected && hasFocus ? 'yellow' : uiState.theme.text.primary}
                      wrap="truncate-end"
                    >
                      📄 {doc.title}
                    </Text>
                  </Box>
                );
              }
            })}
          </Box>

          {/* Scroll indicator at bottom */}
          {scrollOffset + Math.max(5, height - 6) < totalItems && (
            <>
              <Text> </Text>
              <Box justifyContent="center" paddingX={1}>
                <Text color={uiState.theme.text.secondary}>▼ Scroll down for more</Text>
              </Box>
            </>
          )}
        </Box>

        {/* Right column: Document content (70%) */}
        <Box
          flexDirection="column"
          width={absoluteRightWidth ?? '70%'}
          height="100%"
          borderStyle="single"
          borderColor={
            focusedColumn === 'right' && hasFocus
              ? uiState.theme.text.accent
              : uiState.theme.border.primary
          }
          paddingX={2}
          paddingY={1}
        >
          {selectedDocument ? (
            <>
              {/* Document title */}
              <Box paddingLeft={1} flexShrink={0}>
                <Text bold color="yellow">
                  {selectedDocument.title}
                </Text>
              </Box>

              <Text> </Text>

              {/* Document content */}
              {loadingContent ? (
                <Text color={uiState.theme.text.secondary}>Loading...</Text>
              ) : (
                <Box flexDirection="column" flexGrow={1} overflow="hidden">
                  {visibleContentLines.map((line, idx) => (
                    <Text key={idx} color={uiState.theme.text.primary} wrap="truncate-end">
                      {line || ' '}
                    </Text>
                  ))}
                </Box>
              )}

              {/* Scroll indicator for content */}
              {contentScrollOffset + visibleContentLines.length < contentLines.length && (
                <Box marginTop={1} flexShrink={0}>
                  <Text color={uiState.theme.text.secondary}>▼ Scroll down for more</Text>
                </Box>
              )}
            </>
          ) : (
            <Text color={uiState.theme.text.secondary}>Select a document to view</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
}
