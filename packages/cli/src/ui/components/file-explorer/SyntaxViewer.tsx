/**
 * SyntaxViewer Component
 *
 * Provides read-only viewing of files with line numbers and scrolling.
 * Supports common programming languages and configuration formats.
 * Includes scrolling support with arrow keys.
 *
 * Note: Syntax highlighting is disabled for terminal display.
 * The component shows plain text with line numbers.
 *
 * Requirements: 5.4, 5.5
 */

import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';

/**
 * Props for SyntaxViewer component
 */
export interface SyntaxViewerProps {
  /** Absolute path to the file being viewed */
  filePath: string;
  /** File content to display */
  content: string;
  /** Optional language override (auto-detected from extension if not provided) */
  language?: string;
  /** Optional theme (defaults to 'github-dark') */
  theme?: string;
  /** Whether to show line numbers (defaults to true) */
  showLineNumbers?: boolean;
  /** Height of the visible window (defaults to 20 lines) */
  windowHeight?: number;
  /** Whether the viewer has focus for input handling */
  hasFocus?: boolean;
}

/**
 * SyntaxViewer component for displaying syntax-highlighted code
 */
export const SyntaxViewer: React.FC<SyntaxViewerProps> = ({
  filePath,
  content,
  language: languageOverride,
  theme = 'github-dark',
  showLineNumbers = true,
  windowHeight = 20,
  hasFocus = true,
}) => {
  const [highlightedContent, setHighlightedContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    const highlightCode = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // For terminal display, we'll just show the original content
        // Shiki's HTML output is designed for browsers, not terminals
        // In the future, we could use a terminal-specific syntax highlighter
        setHighlightedContent(content);
      } catch (err) {
        // If highlighting fails, fall back to plain text
        console.error('Syntax highlighting error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setHighlightedContent(content);
      } finally {
        setIsLoading(false);
      }
    };

    highlightCode();
  }, [filePath, content, languageOverride, theme]);

  // Split content into lines for line number display
  const lines = highlightedContent.split('\n');
  const totalLines = lines.length;

  // Handle keyboard input for scrolling
  useInput(
    (input, key) => {
      if (!hasFocus) return;

      if (key.downArrow || input === 'j') {
        // Scroll down
        setScrollOffset((prev) => Math.min(prev + 1, Math.max(0, totalLines - windowHeight)));
      } else if (key.upArrow || input === 'k') {
        // Scroll up
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.pageDown || input === 'd') {
        // Page down (half window)
        const pageSize = Math.floor(windowHeight / 2);
        setScrollOffset((prev) =>
          Math.min(prev + pageSize, Math.max(0, totalLines - windowHeight))
        );
      } else if (key.pageUp || input === 'u') {
        // Page up (half window)
        const pageSize = Math.floor(windowHeight / 2);
        setScrollOffset((prev) => Math.max(0, prev - pageSize));
      } else if (input === 'g') {
        // Go to top
        setScrollOffset(0);
      } else if (input === 'G') {
        // Go to bottom
        setScrollOffset(Math.max(0, totalLines - windowHeight));
      }
    },
    { isActive: hasFocus }
  );

  if (isLoading) {
    return (
      <Box flexDirection="column">
        <Text color="gray">Loading syntax highlighting...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">⚠ Syntax highlighting failed: {error}</Text>
        <Text color="gray">Displaying as plain text:</Text>
        <Box marginTop={1}>
          <Text>{content}</Text>
        </Box>
      </Box>
    );
  }

  // Calculate visible window
  const visibleLines = lines.slice(scrollOffset, scrollOffset + windowHeight);
  const hasMoreAbove = scrollOffset > 0;
  const hasMoreBelow = scrollOffset + windowHeight < totalLines;

  return (
    <Box flexDirection="column" height="100%" width="100%">
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text color="cyan" bold>
          📄 {filePath.split(/[/\\]/).pop()}
        </Text>
        <Text color="gray">
          {' '}
          - Lines {scrollOffset + 1}-{Math.min(scrollOffset + windowHeight, totalLines)} of{' '}
          {totalLines}
        </Text>
      </Box>

      {hasMoreAbove && (
        <Box justifyContent="center">
          <Text color="gray" dimColor>
            ▲ More lines above (scroll up) ▲
          </Text>
        </Box>
      )}

      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {visibleLines.map((line, index) => {
          const lineNumber = scrollOffset + index + 1;
          return (
            <Box key={lineNumber}>
              {showLineNumbers && (
                <Box width={6} marginRight={1}>
                  <Text color="gray">{lineNumber.toString().padStart(5, ' ')}</Text>
                </Box>
              )}
              <Text>{line}</Text>
            </Box>
          );
        })}
      </Box>

      {hasMoreBelow && (
        <Box justifyContent="center">
          <Text color="gray" dimColor>
            ▼ More lines below (scroll down) ▼
          </Text>
        </Box>
      )}

      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text color="gray" dimColor>
          ↑/↓: Scroll | PgUp/PgDn: Page | g: Top | G: Bottom | Esc: Close
        </Text>
      </Box>
    </Box>
  );
};
