import { createLogger } from '../../../../../core/src/utils/logger.js';

const logger = createLogger('SearchTab');
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

import { useFocusManager } from '../../../features/context/FocusContext.js';
import { useUI } from '../../../features/context/UIContext.js';

/**
 * SearchTab component
 * 
 * Two-column search interface:
 * - Header: Search input
 * - Left (30%): Search Results
 * - Right (70%): Details / Preview
 * 
 * Navigation:
 * - Header Input: Type query. Enter -> Search. Arrow Down -> Results.
 * - Results List: Arrow Up -> Header. Enter -> Select.
 * - Esc: Exit to Nav.
 */
export interface SearchTabProps {
  width?: number;
}

export function SearchTab({ width }: SearchTabProps) {
  const { state: uiState } = useUI();
  const { isFocused } = useFocusManager();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Calculate absolute widths if width is provided
  const absoluteLeftWidth = width ? Math.floor(width * 0.3) : undefined;
  const absoluteRightWidth = width && absoluteLeftWidth ? (width - absoluteLeftWidth) : undefined;

  // Internal focus state: 'input' (header) or 'results' (left column)
  const [activeRegion, setActiveRegion] = useState<'input' | 'results'>('input');
  
  const hasFocus = isFocused('search-panel');

  useInput((input, key) => {
    if (!hasFocus) return;

    // Allow ESC to bubble to global handler
    if (key.escape) return;

    // Input Region Handling
    if (activeRegion === 'input') {
      if (key.downArrow) {
        setActiveRegion('results');
        return;
      }
      
      if (key.return) {
        // Trigger Search (Mock)
        // logger.info('Searching for:', searchQuery);
        return;
      }

      if (key.backspace || key.delete) {
        setSearchQuery(prev => prev.slice(0, -1));
        return;
      }

      if (input) {
        setSearchQuery(prev => prev + input);
      }
    }
    // Results Region Handling
    else if (activeRegion === 'results') {
      if (key.upArrow) {
        setActiveRegion('input');
        return;
      }
      
      // Future: Navigate list up/down
    }
  }, { isActive: hasFocus });

  return (
    <Box flexDirection="column" height="100%" width={width}>
      {/* Header with Search Input */}
      <Box
        borderStyle="single"
        borderColor={hasFocus && activeRegion === 'input' ? uiState.theme.border.active : uiState.theme.border.primary}
        paddingX={1}
        flexShrink={0}
        flexDirection="row"
        width="100%"
        overflow="hidden"
      >
        <Box width={absoluteLeftWidth ?? "30%"} borderStyle="single" borderTop={false} borderBottom={false} borderLeft={false} borderRight={true} borderColor={uiState.theme.border.primary} marginRight={1} flexShrink={0}>
           <Text bold color={uiState.theme.text.accent}>Semantic Search</Text>
        </Box>
        <Box flexGrow={1} flexShrink={1}>
           <Text color={uiState.theme.text.secondary} wrap="truncate-end">
            🔍 Search: <Text color={uiState.theme.text.primary}>
              {searchQuery}
              {hasFocus && activeRegion === 'input' && <Text inverse> </Text>}
            </Text>
          </Text>
        </Box>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} overflow="hidden" flexDirection="row" width="100%">
        {/* Left column: Search Results (30%) */}
        <Box 
          flexDirection="column" 
          width={absoluteLeftWidth ?? "30%"} 
          borderStyle="single" 
          borderColor={hasFocus && activeRegion === 'results' ? uiState.theme.border.active : uiState.theme.border.primary}
          padding={1}
          flexShrink={0}
        >
          <Box marginBottom={1}>
            <Text bold color={uiState.theme.text.secondary}>Search Results</Text>
          </Box>
          <Text color={uiState.theme.text.secondary}>No results yet. Enter a search query to begin.</Text>
          
           <Box marginTop={1} justifyContent="center" flexShrink={0}>
            <Text color={uiState.theme.text.secondary} dimColor>
              Press Esc to return to Chat
            </Text>
          </Box>
        </Box>

        {/* Right column: Details / Preview (70%) */}
        <Box 
          flexDirection="column" 
          width={absoluteRightWidth ?? "70%"} 
          borderStyle="single" 
          borderColor={uiState.theme.border.primary} 
          padding={1}
          justifyContent="center"
          alignItems="center"
          flexShrink={0}
        >
          <Box borderStyle="single" borderColor={uiState.theme.status.info} flexDirection="column" padding={1} width="90%">
             <Box marginBottom={1} justifyContent="center">
                <Text bold color={uiState.theme.status.info}>📝 Implementation Note</Text>
             </Box>
             <Text color={uiState.theme.text.secondary}>Full semantic search functionality will be implemented in Stage 11.</Text>
             <Text color={uiState.theme.text.secondary}>This includes:</Text>
             <Text color={uiState.theme.text.secondary}>• Codebase indexing with embeddings</Text>
             <Text color={uiState.theme.text.secondary}>• Vector similarity search</Text>
             <Text color={uiState.theme.text.secondary}>• Code snippet preview</Text>
             <Text color={uiState.theme.text.secondary}>• Add to context functionality</Text>
             <Text color={uiState.theme.text.secondary}>• File type filtering</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
