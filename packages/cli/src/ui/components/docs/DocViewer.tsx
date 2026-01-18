import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../features/context/UIContext.js';

export interface DocViewerProps {
  /** Document content (markdown) */
  content: string;
  
  /** Document title */
  title: string;
  
  /** Theme for styling */
  theme: Theme;
  
  /** Whether content is loading */
  loading?: boolean;
  
  /** Error message if loading failed */
  error?: string;
}

/**
 * DocViewer component
 * 
 * Displays markdown documentation content.
 * Supports basic markdown rendering.
 * Shows loading and error states.
 */
export function DocViewer({
  content,
  title,
  theme,
  loading = false,
  error,
}: DocViewerProps) {
  if (loading) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={theme.text.secondary}>Loading documentation...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color={theme.status.error}>Error: {error}</Text>
      </Box>
    );
  }

  // Split content into lines for rendering
  const lines = content.split('\n');

  const renderLine = (line: string, index: number) => {
    // Headers
    if (line.startsWith('# ')) {
      return (
        <Box key={index} marginTop={1} marginBottom={1}>
          <Text bold color={theme.text.accent}>
            {line.substring(2)}
          </Text>
        </Box>
      );
    }

    if (line.startsWith('## ')) {
      return (
        <Box key={index} marginTop={1}>
          <Text bold color={theme.text.primary}>
            {line.substring(3)}
          </Text>
        </Box>
      );
    }

    if (line.startsWith('### ')) {
      return (
        <Box key={index}>
          <Text color={theme.text.primary}>
            {line.substring(4)}
          </Text>
        </Box>
      );
    }

    // Code blocks
    if (line.startsWith('```')) {
      return (
        <Box key={index}>
          <Text color={theme.text.secondary} dimColor>
            {line}
          </Text>
        </Box>
      );
    }

    // Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <Box key={index}>
          <Text color={theme.text.primary}>
            • {line.substring(2)}
          </Text>
        </Box>
      );
    }

    // Numbered lists
    if (/^\d+\.\s/.test(line)) {
      return (
        <Box key={index}>
          <Text color={theme.text.primary}>{line}</Text>
        </Box>
      );
    }

    // Empty lines
    if (line.trim() === '') {
      return <Box key={index} height={1} />;
    }

    // Regular text
    return (
      <Box key={index}>
        <Text color={theme.text.primary}>{line}</Text>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.text.accent} paddingX={1}>
      {/* Title */}
      <Box borderStyle="single" borderColor={theme.text.accent} paddingX={1} marginBottom={1}>
        <Text bold color={theme.text.accent}>
          {title}
        </Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1}>
        {lines.map((line, index) => renderLine(line, index))}
      </Box>

      {/* Navigation hint */}
      <Box marginTop={1} borderStyle="single" borderColor={theme.text.secondary} paddingX={1}>
        <Text color={theme.text.secondary} dimColor>
          j/k: scroll | Backspace: back to list
        </Text>
      </Box>
    </Box>
  );
}
