import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { Theme } from '../../../config/types.js';

export interface ThemePickerProps {
  /** Available theme names */
  themes: string[];
  
  /** Currently selected theme */
  selectedTheme: string;
  
  /** Callback when a theme is selected */
  onSelect: (themeName: string) => void;
  
  /** Current theme for styling */
  theme: Theme;
}

/**
 * ThemePicker component
 * 
 * Displays available themes and allows selection.
 * Shows theme name and applies immediately on selection.
 */
export function ThemePicker({
  themes,
  selectedTheme,
  onSelect,
  theme,
}: ThemePickerProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.text.accent} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Theme Selection
        </Text>
      </Box>

      <Box flexDirection="column">
        {themes.map((themeName) => {
          const isSelected = themeName === selectedTheme;
          
          return (
            <Box
              key={themeName}
              borderStyle={isSelected ? 'single' : undefined}
              borderColor={isSelected ? theme.status.success : undefined}
              paddingX={1}
              marginBottom={1}
            >
              <Text
                color={isSelected ? theme.status.success : theme.text.primary}
                bold={isSelected}
              >
                {isSelected ? '✓ ' : '  '}
                {themeName}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} borderStyle="single" borderColor={theme.text.secondary} paddingX={1}>
        <Text color={theme.text.secondary} dimColor>
          Use /theme use &lt;name&gt; to switch themes
        </Text>
      </Box>
    </Box>
  );
}
