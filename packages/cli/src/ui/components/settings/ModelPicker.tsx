import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../config/types.js';

export interface Model {
  name: string;
  size: string;
  modified: Date;
}

export interface ModelPickerProps {
  /** Available models */
  models: Model[];
  
  /** Currently selected model */
  selectedModel: string;
  
  /** Callback when a model is selected */
  onSelect: (modelName: string) => void;
  
  /** Theme for styling */
  theme: Theme;
}

/**
 * ModelPicker component
 * 
 * Displays available models and allows selection.
 * Shows model name, size, and last modified date.
 */
export function ModelPicker({
  models,
  selectedModel,
  onSelect: _onSelect,
  theme,
}: ModelPickerProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.border.active} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Model Selection
        </Text>
      </Box>

      {models.length === 0 ? (
        <Box paddingY={1}>
          <Text color={theme.text.secondary}>
            No models available. Use /model pull to download models.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          {models.map((model) => {
            const isSelected = model.name === selectedModel;
            
            return (
              <Box
                key={model.name}
                borderStyle={isSelected ? 'single' : undefined}
                borderColor={isSelected ? theme.status.success : undefined}
                paddingX={1}
                marginBottom={1}
              >
                <Box flexDirection="column">
                  <Text
                    color={isSelected ? theme.status.success : theme.text.primary}
                    bold={isSelected}
                  >
                    {isSelected ? '✓ ' : '  '}
                    {model.name}
                  </Text>
                  <Text color={theme.text.secondary} dimColor>
                    Size: {model.size} | Modified: {model.modified.toLocaleDateString()}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
