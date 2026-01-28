/**
 * ReasoningBox Component
 *
 * Displays reasoning/thinking content from reasoning models in a nested scrollable container.
 * Requirements: 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 25.2, 25.3
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';

import type { ReasoningBlock } from '../../../../../core/src/services/reasoningParser.js';

export interface ReasoningBoxProps {
  reasoning: ReasoningBlock;
  expanded?: boolean;
  onToggle?: () => void;
  maxVisibleLines?: number;
  autoScroll?: boolean;
  autoCollapseOnComplete?: boolean;
  theme?: Theme;
}

/**
 * ReasoningBox displays thinking content from reasoning models
 *
 * Features:
 * - Nested scrollable container with configurable visible height
 * - Expand/collapse toggle (click or Ctrl+R)
 * - Auto-scroll during streaming
 * - Auto-collapse on completion
 * - Shows token count and duration when collapsed
 */
export const ReasoningBox: React.FC<ReasoningBoxProps> = ({
  reasoning,
  expanded: controlledExpanded,
  onToggle: _onToggle,
  maxVisibleLines = 8,
  autoScroll = true,
  autoCollapseOnComplete = true,
  theme = {
    name: 'default',
    bg: { primary: '#1e1e1e', secondary: '#252526', tertiary: '#333333' },
    text: { primary: '#d4d4d4', secondary: '#858585', accent: '#4ec9b0' },
    role: { user: '#4ec9b0', assistant: '#ce9178', system: '#569cd6', tool: '#b5cea8' },
    status: { success: '#4ec9b0', warning: '#ce9178', error: '#f48771', info: '#569cd6' },
    border: { primary: '#555555', secondary: '#4ec9b0', active: '#4ec9b0' },
    diff: { added: '#4ec9b0', removed: '#f48771' },
  },
}) => {
  // Initialize internal expanded state based on completion status
  const [internalExpanded, setInternalExpanded] = useState(() => !reasoning.complete);
  const [scrollOffset, setScrollOffset] = useState(0);
  const contentRef = useRef<string>(reasoning.content);
  const wasCompleteRef = useRef(reasoning.complete);

  // Use controlled or internal expanded state
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  // Handle toggle via controls (kept in sink for future use or parent control)

  // Auto-collapse when reasoning completes
  useEffect(() => {
    if (autoCollapseOnComplete && !wasCompleteRef.current && reasoning.complete) {
      if (controlledExpanded === undefined) {
        setInternalExpanded(false);
      } else if (_onToggle && isExpanded) {
        // If controlled, call onToggle to collapse
        _onToggle();
      }
    }
    wasCompleteRef.current = reasoning.complete;
  }, [reasoning.complete, autoCollapseOnComplete, controlledExpanded, _onToggle, isExpanded]);

  // Auto-scroll when content changes during streaming
  useEffect(() => {
    if (autoScroll && !reasoning.complete && reasoning.content !== contentRef.current) {
      const lines = reasoning.content.split('\n');
      if (lines.length > maxVisibleLines) {
        setScrollOffset(lines.length - maxVisibleLines);
      }
      contentRef.current = reasoning.content;
    }
  }, [reasoning.content, reasoning.complete, autoScroll, maxVisibleLines]);

  // Split content into lines for scrolling
  const lines = reasoning.content.split('\n');
  const totalLines = lines.length;
  const hasScroll = totalLines > maxVisibleLines;

  // Get visible lines based on scroll offset
  const visibleLines = hasScroll
    ? lines.slice(scrollOffset, scrollOffset + maxVisibleLines)
    : lines;

  // Calculate scroll indicators
  const canScrollUp = scrollOffset > 0;
  const canScrollDown = scrollOffset + maxVisibleLines < totalLines;

  if (!isExpanded) {
    // Collapsed state: show summary with token count and duration
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme?.border?.active || '#4ec9b0'}
        paddingX={1}
      >
        <Box justifyContent="space-between">
          <Text color={theme.text.accent}>
            🧠 Reasoning ({reasoning.tokenCount} tokens
            {reasoning.duration > 0 && `, ${reasoning.duration.toFixed(1)}s`})
          </Text>
          <Text color={theme.text.secondary} dimColor>
            [▶ Expand]
          </Text>
        </Box>
      </Box>
    );
  }

  // Expanded state: show scrollable content
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme?.border?.active || '#4ec9b0'}
      paddingX={1}
    >
      {/* Header */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text color={theme.text.accent}>🧠 Reasoning</Text>
        <Text color={theme.text.secondary} dimColor>
          [▼ Collapse]
        </Text>
      </Box>

      {/* Content area with scroll indicators */}
      <Box flexDirection="column">
        {/* Scroll up indicator */}
        {canScrollUp && (
          <Box justifyContent="flex-end">
            <Text color={theme.text.secondary} dimColor>
              ↑
            </Text>
          </Box>
        )}

        {/* Visible content */}
        <Box flexDirection="column" minHeight={maxVisibleLines}>
          {visibleLines.map((line: string, index: number) => (
            <Text key={scrollOffset + index} color={theme.text.primary} wrap="wrap">
              {line || ' '}
            </Text>
          ))}
        </Box>

        {/* Scroll down indicator */}
        {canScrollDown && (
          <Box justifyContent="flex-end">
            <Text color={theme.text.secondary} dimColor>
              ↓
            </Text>
          </Box>
        )}
      </Box>

      {/* Footer with status */}
      {!reasoning.complete && (
        <Box marginTop={1}>
          <Text color={theme.text.secondary} dimColor>
            Streaming...
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Hook for managing ReasoningBox state with keyboard shortcuts
 */
export const useReasoningBox = (initialExpanded = true) => {
  const [expanded, setExpanded] = useState(initialExpanded);

  const toggle = () => setExpanded(!expanded);
  const expand = () => setExpanded(true);
  const collapse = () => setExpanded(false);

  return {
    expanded,
    toggle,
    expand,
    collapse,
  };
};
