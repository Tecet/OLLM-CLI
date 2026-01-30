/**
 * ToolModeSettings Component
 *
 * Shows per-mode settings for a tool, allowing users to enable/disable
 * the tool for each of the 5 operational modes.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface ToolModeSettingsProps {
  /** Tool ID */
  toolId: string;
  /** Current mode settings (mode -> enabled) */
  modeSettings: Record<string, boolean>;
  /** Callback when a mode is toggled */
  onToggle: (mode: string) => void;
  /** Callback when Apply is pressed */
  onApply: () => void;
  /** Callback when Reset is pressed */
  onReset: () => void;
  /** Whether this component has focus */
  focused: boolean;
  /** Currently selected mode index (for keyboard navigation) */
  selectedIndex: number;
  /** Callback when selection changes */
  onSelectionChange: (index: number) => void;
}

const MODES = ['developer', 'debugger', 'assistant', 'planning', 'user'];

const MODE_DISPLAY_NAMES: Record<string, string> = {
  developer: 'Developer',
  debugger: 'Debugger',
  assistant: 'Assistant',
  planning: 'Planning',
  user: 'User',
};

/**
 * ToolModeSettings Component
 */
export function ToolModeSettings({
  toolId,
  modeSettings,
  onToggle,
  onApply,
  onReset,
  focused,
  selectedIndex,
  onSelectionChange,
}: ToolModeSettingsProps) {
  // Refer to onSelectionChange to satisfy linter for unused prop when not needed here
  void onSelectionChange;
  const [localSettings, setLocalSettings] = useState(modeSettings);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local settings when props change
  useEffect(() => {
    setLocalSettings(modeSettings);
    setHasChanges(false);
  }, [modeSettings, toolId]);

  // Handle toggle
  const _handleToggle = (mode: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      [mode]: !prev[mode],
    }));
    setHasChanges(true);
    onToggle(mode);
  };

  // Handle apply
  const _handleApply = () => {
    onApply();
    setHasChanges(false);
  };

  // Handle reset
  const _handleReset = () => {
    onReset();
    setHasChanges(false);
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text bold color="cyan">
        Per-Mode Settings
      </Text>
      <Text dimColor>Configure which modes can use this tool</Text>
      <Box flexDirection="column" marginTop={1}>
        {MODES.map((mode, index) => {
          const enabled = localSettings[mode] ?? false;
          const isSelected = focused && index === selectedIndex;
          const displayName = MODE_DISPLAY_NAMES[mode] || mode;

          return (
            <Box key={mode}>
              <Text>
                {displayName.padEnd(12)}: {enabled ? '[✓ Enabled ]' : '[✗ Disabled]'}
                {isSelected && (
                  <Text color="cyan" bold>
                    {' '}
                    ←
                  </Text>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1} gap={1}>
        <Text dimColor>
          {focused ? (
            <>
              [Enter/Space] Toggle [A] Apply {hasChanges && <Text color="yellow">(unsaved)</Text>}{' '}
              [R] Reset
            </>
          ) : (
            <Text dimColor>[Tab] to navigate here</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
}
