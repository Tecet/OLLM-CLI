import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../contexts/UIContext.js';

/**
 * SearchTab component (Scaffold)
 * 
 * Placeholder for semantic search functionality.
 * Full implementation will be completed in Stage 11.
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
export function SearchTab() {
  const { state: uiState } = useUI();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <Box flexDirection="column" height="100%" padding={2}>
      {/* Search Input */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiState.theme.text.accent}
        paddingX={1}
        marginBottom={2}
        flexShrink={0}
      >
        <Text bold color={uiState.theme.text.accent} marginBottom={1}>
          Semantic Search
        </Text>
        
        <Box>
          <Text color={uiState.theme.text.secondary}>
            🔍 Search: <Text color={uiState.theme.text.primary}>{searchQuery || '_'}</Text>
          </Text>
        </Box>
      </Box>

      {/* Results Placeholder */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={uiState.theme.text.secondary}
        paddingX={1}
        paddingY={1}
        flexGrow={1}
      >
        <Text bold color={uiState.theme.text.secondary} marginBottom={1}>
          Search Results
        </Text>
        
        <Box flexDirection="column" gap={1}>
          <Text color={uiState.theme.text.secondary}>
            No results yet. Enter a search query to begin.
          </Text>
        </Box>
      </Box>

      {/* Implementation Note */}
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={uiState.theme.status.info}
        paddingX={1}
        paddingY={1}
        marginTop={2}
        flexShrink={0}
      >
        <Text bold color={uiState.theme.status.info} marginBottom={1}>
          📝 Implementation Note
        </Text>
        
        <Text color={uiState.theme.text.secondary}>
          Full semantic search functionality will be implemented in Stage 11.
        </Text>
        <Text color={uiState.theme.text.secondary}>
          This includes:
        </Text>
        <Text color={uiState.theme.text.secondary}>
          • Codebase indexing with embeddings
        </Text>
        <Text color={uiState.theme.text.secondary}>
          • Vector similarity search
        </Text>
        <Text color={uiState.theme.text.secondary}>
          • Code snippet preview
        </Text>
        <Text color={uiState.theme.text.secondary}>
          • Add to context functionality
        </Text>
        <Text color={uiState.theme.text.secondary}>
          • File type filtering
        </Text>
      </Box>
    </Box>
  );
}
