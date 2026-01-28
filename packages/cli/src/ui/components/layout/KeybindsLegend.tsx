import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';

export interface KeybindsLegendProps {
  theme: Theme;
  version?: string;
}

/**
 * KeybindsLegend - Displays main keyboard shortcuts in a compact, organized layout
 */
export function KeybindsLegend({ theme, version = '0.1.0-alpha' }: KeybindsLegendProps) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header with version - centered */}
      <Box marginBottom={1} justifyContent="center">
        <Text bold color={theme.text.accent}>
          OLLM CLI
        </Text>
        <Text dimColor> v{version}</Text>
      </Box>

      {/* Navigation section */}
      <Box marginBottom={1}>
        <Text bold color={theme.status.info}>
          Navigation
        </Text>
      </Box>

      {/* Keybinds grid - Row 1 */}
      <Box flexDirection="row" marginBottom={0}>
        <Box width={28}>
          <Text bold color={theme.text.primary}>
            Tab
          </Text>
          <Text dimColor>        Cycle focus</Text>
        </Box>
        <Text dimColor> │ </Text>
        <Box>
          <Text bold color={theme.text.primary}>
            ↑↓
          </Text>
          <Text dimColor>        Navigate items</Text>
        </Box>
      </Box>

      {/* Keybinds grid - Row 2 */}
      <Box flexDirection="row" marginBottom={0}>
        <Box width={28}>
          <Text bold color={theme.text.primary}>
            Ctrl+←→
          </Text>
          <Text dimColor>    Switch panel</Text>
        </Box>
        <Text dimColor> │ </Text>
        <Box>
          <Text bold color={theme.text.primary}>
            Enter
          </Text>
          <Text dimColor>     Select/Open</Text>
        </Box>
      </Box>

      {/* Footer - Row 3 */}
      <Box marginTop={1}>
        <Text dimColor>Type </Text>
        <Text color={theme.text.accent}>/help</Text>
        <Text dimColor> for more commands</Text>
        <Text dimColor> │ </Text>
        <Text bold color={theme.text.primary}>
          Ctrl+P
        </Text>
        <Text dimColor>    Close panel</Text>
      </Box>
    </Box>
  );
}
