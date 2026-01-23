import React from 'react';
import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';
import { DocEntry } from '../../services/docsService.js';

export interface DocNavProps {
  /** Documentation entries */
  entries: DocEntry[];
  
  /** Currently selected entry path */
  selectedPath: string | null;
  
  /** Callback when an entry is selected */
  onSelect: (path: string) => void;
  
  /** Theme for styling */
  theme: Theme;
}

/**
 * DocNav component
 * 
 * Navigation sidebar for documentation.
 * Shows list of available documents.
 * Highlights the currently selected document.
 */
export function DocNav({ entries, selectedPath, onSelect: _onSelect, theme }: DocNavProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border.active} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Documentation
        </Text>
      </Box>

      {entries.map((entry) => {
        const isSelected = entry.path === selectedPath;
        
        return (
          <Box
            key={entry.path}
            borderStyle={isSelected ? 'single' : undefined}
            borderColor={isSelected ? theme.text.accent : undefined}
            paddingX={1}
            marginBottom={1}
          >
            <Box flexDirection="column">
              <Text
                color={isSelected ? theme.text.accent : theme.text.primary}
                bold={isSelected}
              >
                {isSelected ? '▶ ' : '  '}
                {entry.title}
              </Text>
              {entry.description && (
                <Text color={theme.text.secondary} dimColor>
                  {entry.description}
                </Text>
              )}
            </Box>
          </Box>
        );
      })}

      <Box marginTop={1} borderStyle="single" borderColor={theme.text.secondary} paddingX={1}>
        <Text color={theme.text.secondary} dimColor>
          j/k: scroll | Enter: select
        </Text>
      </Box>
    </Box>
  );
}
