/**
 * FileSearchDialog - Search file contents using grep tool
 * 
 * Provides a dialog for searching file contents with:
 * - Pattern input (regex supported)
 * - Case sensitivity toggle
 * - File pattern filtering
 * - Results list with preview
 * - Integration with grep tool
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

import { createLogger } from '../../../../../core/src/utils/logger.js';

import type { ToolRegistry } from '@ollm/ollm-cli-core/tools/tool-registry.js';
import type { ToolInvocation } from '@ollm/ollm-cli-core/tools/types.js';

const logger = createLogger('FileSearchDialog');

/**
 * Search result from grep tool
 */
export interface SearchResult {
  /** File path */
  path: string;
  /** Line number */
  line: number;
  /** Matched line content */
  content: string;
  /** Column where match starts */
  column?: number;
}

/**
 * Props for FileSearchDialog
 */
export interface FileSearchDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
  /** Callback when a result is selected */
  onSelect: (result: SearchResult) => void;
  /** Tool registry for grep tool */
  toolRegistry?: ToolRegistry;
  /** Root path to search in */
  rootPath: string;
}

/**
 * FileSearchDialog component
 * 
 * Provides file content search functionality using the grep tool.
 */
export function FileSearchDialog({
  visible,
  onClose,
  onSelect,
  toolRegistry,
  rootPath,
}: FileSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filePattern, setFilePattern] = useState('*');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [inputMode, setInputMode] = useState<'query' | 'pattern' | 'results'>('query');

  // Reset state when dialog becomes visible
  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setFilePattern('*');
      setCaseSensitive(false);
      setResults([]);
      setSelectedIndex(0);
      setInputMode('query');
    }
  }, [visible]);

  // Perform search using grep tool
  const performSearch = useCallback(async () => {
    if (!searchQuery.trim() || !toolRegistry) {
      return;
    }

    setIsSearching(true);
    setInputMode('results');

    try {
      const grepTool = toolRegistry.get('grep');
      if (!grepTool || !grepTool.createInvocation) {
        logger.error('grep tool not available');
        setIsSearching(false);
        return;
      }

      // Create tool invocation with minimal context
      const invocation = grepTool.createInvocation(
        {
          pattern: searchQuery,
          path: rootPath,
          filePattern: filePattern === '*' ? undefined : filePattern,
          caseSensitive,
          maxResults: 100,
        },
        {
          messageBus: undefined as any, // grep is read-only, doesn't need message bus
          policyEngine: undefined as any, // grep is read-only, doesn't need policy
        }
      ) as ToolInvocation<any, any>;

      // Execute search
      const result = await invocation.execute(new AbortController().signal);

      // Parse results from grep output
      const parsedResults = parseGrepOutput(String(result.llmContent || ''));
      setResults(parsedResults);
      setSelectedIndex(0);
    } catch (error) {
      logger.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, filePattern, caseSensitive, toolRegistry, rootPath]);

  // Handle keyboard input
  useInput((input, key) => {
    if (!visible) return;

    // ESC to close
    if (key.escape) {
      onClose();
      return;
    }

    // Handle different input modes
    if (inputMode === 'query') {
      if (key.return) {
        // Enter to move to file pattern or search
        if (filePattern) {
          performSearch();
        } else {
          setInputMode('pattern');
        }
      } else if (key.tab) {
        setInputMode('pattern');
      }
    } else if (inputMode === 'pattern') {
      if (key.return) {
        performSearch();
      } else if (key.tab) {
        setInputMode('query');
      }
    } else if (inputMode === 'results') {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(results.length - 1, prev + 1));
      } else if (key.return && results[selectedIndex]) {
        onSelect(results[selectedIndex]);
        onClose();
      } else if (input === 'c' && key.ctrl) {
        setCaseSensitive((prev) => !prev);
      } else if (input === 'n' && key.ctrl) {
        // New search
        setInputMode('query');
        setResults([]);
      }
    }
  }, { isActive: visible });

  if (!visible) {
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
        <Text bold color="cyan">
          🔍 Search Files
        </Text>
      </Box>

      {/* Search Query Input */}
      <Box flexDirection="row" marginBottom={1}>
        <Box width={15}>
          <Text color={inputMode === 'query' ? 'cyan' : 'gray'}>
            Search:
          </Text>
        </Box>
        <Box flexGrow={1}>
          {inputMode === 'query' ? (
            <TextInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Enter search pattern (regex supported)"
            />
          ) : (
            <Text>{searchQuery || '(empty)'}</Text>
          )}
        </Box>
      </Box>

      {/* File Pattern Input */}
      <Box flexDirection="row" marginBottom={1}>
        <Box width={15}>
          <Text color={inputMode === 'pattern' ? 'cyan' : 'gray'}>
            Files:
          </Text>
        </Box>
        <Box flexGrow={1}>
          {inputMode === 'pattern' ? (
            <TextInput
              value={filePattern}
              onChange={setFilePattern}
              placeholder="*.ts, *.js, etc."
            />
          ) : (
            <Text>{filePattern}</Text>
          )}
        </Box>
      </Box>

      {/* Options */}
      <Box flexDirection="row" marginBottom={1}>
        <Text dimColor>
          Case Sensitive: {caseSensitive ? '✓' : '✗'} (Ctrl+C to toggle)
        </Text>
      </Box>

      {/* Results */}
      {inputMode === 'results' && (
        <>
          <Box borderStyle="single" borderColor="gray" marginBottom={1}>
            <Text>
              {isSearching
                ? 'Searching...'
                : `${results.length} result${results.length === 1 ? '' : 's'} found`}
            </Text>
          </Box>

          {results.length > 0 && (
            <Box flexDirection="column" height={10} overflow="hidden">
              {results.slice(0, 10).map((result, index) => (
                <Box
                  key={`${result.path}-${result.line}`}
                  backgroundColor={index === selectedIndex ? 'blue' : undefined}
                  paddingX={1}
                >
                  <Text>
                    <Text color="cyan">{result.path}</Text>
                    <Text color="yellow">:{result.line}</Text>
                    <Text dimColor> {result.content.trim().substring(0, 60)}</Text>
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}

      {/* Help */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          {inputMode === 'query' && 'Tab: File pattern | Enter: Search | ESC: Close'}
          {inputMode === 'pattern' && 'Tab: Search query | Enter: Search | ESC: Close'}
          {inputMode === 'results' && '↑↓: Navigate | Enter: Open | Ctrl+N: New search | ESC: Close'}
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Parse grep tool output into search results
 * 
 * Expected format: "path:line:content"
 */
function parseGrepOutput(output: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse format: path:line:content
    const match = line.match(/^(.+?):(\d+):(.+)$/);
    if (match) {
      results.push({
        path: match[1],
        line: parseInt(match[2], 10),
        content: match[3],
      });
    }
  }

  return results;
}
