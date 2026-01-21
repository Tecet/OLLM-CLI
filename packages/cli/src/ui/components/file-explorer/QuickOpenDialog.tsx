/**
 * QuickOpenDialog - Fuzzy search dialog for rapid file navigation
 * 
 * Provides a Ctrl+O dialog with fuzzy search functionality to quickly
 * navigate to files in the workspace. Tracks history of opened files.
 * 
 * Requirements: 7.1, 7.2, 7.3, 12.4
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { FileNode } from './types.js';

/**
 * Fuzzy match result with score
 */
interface FuzzyMatchResult {
  node: FileNode;
  score: number;
  matchedIndices: number[];
}

/**
 * Props for QuickOpenDialog component
 */
export interface QuickOpenDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** All files in the workspace (flattened tree) */
  allFiles: FileNode[];
  /** Callback when a file is selected */
  onSelect: (node: FileNode) => void;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Quick Open history (most recent first) */
  history?: string[];
  /** Callback to update history */
  onHistoryUpdate?: (filePath: string) => void;
}

/**
 * Fuzzy match algorithm
 * 
 * Implements a simple fuzzy matching algorithm that:
 * 1. Matches characters in order (not necessarily consecutive)
 * 2. Scores matches based on:
 *    - Consecutive character matches (higher score)
 *    - Match position (earlier matches score higher)
 *    - Case sensitivity (exact case matches score higher)
 * 
 * @param query - Search query
 * @param target - Target string to match against
 * @returns Match result with score and matched indices, or null if no match
 */
function fuzzyMatch(query: string, target: string): { score: number; matchedIndices: number[] } | null {
  // Trim whitespace from query
  const trimmedQuery = query.trim();
  
  if (!trimmedQuery) {
    return { score: 0, matchedIndices: [] };
  }

  const queryLower = trimmedQuery.toLowerCase();
  const targetLower = target.toLowerCase();
  
  let queryIndex = 0;
  let targetIndex = 0;
  const matchedIndices: number[] = [];
  let score = 0;
  let consecutiveMatches = 0;

  while (queryIndex < queryLower.length && targetIndex < targetLower.length) {
    const queryChar = queryLower[queryIndex];
    const targetChar = targetLower[targetIndex];

    if (queryChar === targetChar) {
      matchedIndices.push(targetIndex);
      
      // Score calculation:
      // - Base score: 1 point per match
      // - Consecutive bonus: +2 points for consecutive matches
      // - Position bonus: Earlier matches get higher scores
      // - Case match bonus: +1 point for exact case match
      score += 1;
      
      if (consecutiveMatches > 0) {
        score += 2; // Consecutive match bonus
      }
      consecutiveMatches++;
      
      // Position bonus (earlier matches are better)
      score += Math.max(0, 10 - targetIndex);
      
      // Case match bonus (compare with trimmed query)
      if (trimmedQuery[queryIndex] === target[targetIndex]) {
        score += 1;
      }
      
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
    
    targetIndex++;
  }

  // If we didn't match all query characters, it's not a match
  if (queryIndex < queryLower.length) {
    return null;
  }

  return { score, matchedIndices };
}

/**
 * Filter and rank files by fuzzy match
 * 
 * @param files - All files to search
 * @param query - Search query
 * @param history - Quick Open history for boosting recent files
 * @returns Sorted array of match results
 */
function fuzzyFilterFiles(
  files: FileNode[],
  query: string,
  history: string[] = []
): FuzzyMatchResult[] {
  const results: FuzzyMatchResult[] = [];

  for (const node of files) {
    // Only match against files, not directories
    if (node.type !== 'file') {
      continue;
    }

    // Try to match against the file name
    const match = fuzzyMatch(query, node.name);
    
    if (match) {
      let finalScore = match.score;
      
      // Boost score for files in history (more recent = higher boost)
      const historyIndex = history.indexOf(node.path);
      if (historyIndex !== -1) {
        // Recent files get a significant boost
        finalScore += (history.length - historyIndex) * 5;
      }
      
      results.push({
        node,
        score: finalScore,
        matchedIndices: match.matchedIndices,
      });
    }
  }

  // Sort by score (descending)
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Render a file name with highlighted matched characters
 * 
 * @param name - File name
 * @param matchedIndices - Indices of matched characters
 * @returns React elements with highlighted matches
 */
function renderHighlightedName(name: string, matchedIndices: number[]): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const index of matchedIndices) {
    // Add non-matched text before this match
    if (index > lastIndex) {
      parts.push(
        <Text key={`text-${lastIndex}`}>
          {name.substring(lastIndex, index)}
        </Text>
      );
    }
    
    // Add matched character (highlighted)
    parts.push(
      <Text key={`match-${index}`} color="cyan" bold>
        {name[index]}
      </Text>
    );
    
    lastIndex = index + 1;
  }

  // Add remaining text after last match
  if (lastIndex < name.length) {
    parts.push(
      <Text key={`text-${lastIndex}`}>
        {name.substring(lastIndex)}
      </Text>
    );
  }

  return <>{parts}</>;
}

/**
 * QuickOpenDialog component
 * 
 * Displays a fuzzy search dialog for rapid file navigation.
 * Supports keyboard navigation and tracks history of opened files.
 * 
 * Keyboard shortcuts:
 * - Type to search
 * - Up/Down: Navigate results
 * - Enter: Select file
 * - Esc: Close dialog
 */
export function QuickOpenDialog({
  isOpen,
  allFiles,
  onSelect,
  onClose,
  history = [],
  onHistoryUpdate,
}: QuickOpenDialogProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter and rank files based on query
  const filteredResults = useMemo(() => {
    return fuzzyFilterFiles(allFiles, query, history);
  }, [allFiles, query, history]);

  // Limit results to top 10 for performance
  const displayResults = useMemo(() => {
    return filteredResults.slice(0, 10);
  }, [filteredResults]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [displayResults]);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  /**
   * Handle file selection
   */
  const handleSelect = useCallback(() => {
    if (displayResults.length > 0 && selectedIndex >= 0 && selectedIndex < displayResults.length) {
      const selected = displayResults[selectedIndex];
      
      // Update history
      if (onHistoryUpdate) {
        onHistoryUpdate(selected.node.path);
      }
      
      // Call onSelect callback
      onSelect(selected.node);
      
      // Close dialog
      onClose();
    }
  }, [displayResults, selectedIndex, onSelect, onClose, onHistoryUpdate]);

  /**
   * Handle keyboard input
   */
  useInput(
    (input, key) => {
      if (!isOpen) {
        return;
      }

      // Handle Escape to close
      if (key.escape) {
        onClose();
        return;
      }

      // Handle Enter to select
      if (key.return) {
        handleSelect();
        return;
      }

      // Handle Up arrow to move selection up
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
        return;
      }

      // Handle Down arrow to move selection down
      if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(displayResults.length - 1, prev + 1));
        return;
      }

      // Handle Backspace to delete character
      if (key.backspace || key.delete) {
        setQuery((prev) => prev.slice(0, -1));
        return;
      }

      // Handle regular character input
      if (input && !key.ctrl && !key.meta) {
        setQuery((prev) => prev + input);
      }
    },
    { isActive: isOpen }
  );

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width="80%"
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          Quick Open
        </Text>
        <Text color="gray"> (Ctrl+O)</Text>
      </Box>

      {/* Search input */}
      <Box marginBottom={1}>
        <Text color="yellow">Search: </Text>
        <Text>{query}</Text>
        <Text color="cyan">▊</Text>
      </Box>

      {/* Results */}
      <Box flexDirection="column">
        {displayResults.length === 0 ? (
          <Text dimColor>
            {query ? 'No matches found' : 'Type to search files...'}
          </Text>
        ) : (
          displayResults.map((result, index) => {
            const isSelected = index === selectedIndex;
            const isInHistory = history.includes(result.node.path);

            return (
              <Box key={result.node.path} flexDirection="row">
                {/* Selection indicator */}
                <Text bold={isSelected} inverse={isSelected}>
                  {isSelected ? '>' : ' '}
                </Text>
                
                <Text> </Text>
                
                {/* File name with highlighted matches */}
                <Box>
                  {renderHighlightedName(result.node.name, result.matchedIndices)}
                </Box>
                
                {/* History indicator */}
                {isInHistory && (
                  <Text color="gray"> (recent)</Text>
                )}
                
                {/* Score (for debugging, can be removed) */}
                {/* <Text color="gray"> [{result.score}]</Text> */}
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer with help text */}
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓ Navigate • Enter Select • Esc Close
        </Text>
      </Box>

      {/* Results count */}
      {filteredResults.length > displayResults.length && (
        <Box marginTop={1}>
          <Text dimColor>
            Showing {displayResults.length} of {filteredResults.length} results
          </Text>
        </Box>
      )}
    </Box>
  );
}
