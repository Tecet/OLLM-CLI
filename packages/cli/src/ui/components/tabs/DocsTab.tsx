import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { DocsService, DocEntry } from '../../services/docsService.js';
import { DocNav } from '../docs/DocNav.js';
import { DocViewer } from '../docs/DocViewer.js';
import { useContextKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';

/**
 * DocsTab component
 * 
 * Documentation browser with navigation and markdown rendering.
 * Supports keyboard navigation (j/k, Enter, Backspace).
 * Displays documentation files from the docs directory.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */
export function DocsTab() {
  const { state: uiState } = useUI();
  const [docsService] = useState(() => new DocsService());
  const [entries] = useState<DocEntry[]>(() => docsService.getIndex());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [_loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [_scrollPosition, setScrollPosition] = useState(0);

  const handleBack = () => {
    setSelectedPath(null);
    setContent('');
    setError(null);
  };

  // Register docs-specific keyboard shortcuts
  useContextKeyboardShortcuts('docs', [
    {
      key: 'j',
      handler: () => setScrollPosition((prev) => prev + 1),
      description: 'Scroll down',
    },
    {
      key: 'k',
      handler: () => setScrollPosition((prev) => Math.max(0, prev - 1)),
      description: 'Scroll up',
    },
    {
      key: 'backspace',
      handler: handleBack,
      description: 'Go back to document list',
    },
  ]);

  // Load document when selection changes
  useEffect(() => {
    if (!selectedPath) {
      return;
    }

    const loadDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        const docContent = await docsService.loadDoc(selectedPath);
        setContent(docContent);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [selectedPath, docsService]);

  const handleSelect = (path: string) => {
    setSelectedPath(path);
  };

  // Show navigation list when no document is selected
  if (!selectedPath) {
    return (
      <Box flexDirection="column" height="100%" padding={1}>
        <DocNav
          entries={entries}
          selectedPath={selectedPath}
          onSelect={handleSelect}
          theme={uiState.theme}
        />
        {/* Footer */}
        <Box marginTop={1} justifyContent="center" flexShrink={0}>
          <Text color={uiState.theme.text.secondary} dimColor>
            Press Esc to return to Chat
          </Text>
        </Box>
      </Box>
    );
  }

  // Show document viewer when a document is selected
  const selectedEntry = entries.find((e) => e.path === selectedPath);
  const title = selectedEntry?.title || 'Document';

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <DocViewer
        content={content}
        title={title}
        theme={uiState.theme}
        loading={_loading}
        error={error || undefined}
      />
      {/* Footer */}
      <Box marginTop={1} justifyContent="center" flexShrink={0}>
        <Text color={uiState.theme.text.secondary} dimColor>
          Press Esc to return to Chat
        </Text>
      </Box>
    </Box>
  );
}
