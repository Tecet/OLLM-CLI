import React from 'react';
import { Box, Text } from 'ink';
import { useUI } from '../../../features/context/UIContext.js';
import { ModelPicker, Model } from '../settings/ModelPicker.js';
import { ProviderSelector, Provider } from '../settings/ProviderSelector.js';
import { ThemePicker } from '../settings/ThemePicker.js';
import { SessionInfo, SessionStats } from '../settings/SessionInfo.js';
import { OptionsPanel, Options } from '../settings/OptionsPanel.js';

export interface SettingsTabProps {
  /** Available models */
  models?: Model[];
  
  /** Selected model */
  selectedModel?: string;
  
  /** Available providers */
  providers?: Provider[];
  
  /** Selected provider */
  selectedProvider?: string;
  
  /** Available themes */
  themes?: string[];
  
  /** Session statistics */
  sessionStats?: SessionStats;
  
  /** Runtime options */
  options?: Options;
  
  /** Callback when model is selected */
  onModelSelect?: (modelName: string) => void;
  
  /** Callback when provider is selected */
  onProviderSelect?: (providerName: string) => void;
  
  /** Callback when theme is selected */
  onThemeSelect?: (themeName: string) => void;
  
  /** Callback when option is changed */
  onOptionChange?: (key: keyof Options, value: any) => void;
  
  /** Callback for quick actions */
  onQuickAction?: (action: 'save' | 'export' | 'clear') => void;
}

/**
 * SettingsTab component
 * 
 * Configuration and settings interface.
 * Displays model picker, provider selector, theme picker, session info, and options.
 * Provides quick actions for save, export, and clear.
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7
 */
export function SettingsTab({
  models = [],
  selectedModel = '',
  providers = [],
  selectedProvider = '',
  themes = ['default-dark', 'dracula', 'nord', 'monokai', 'solarized-dark'],
  sessionStats,
  options = {
    temperature: 0.7,
    maxTokens: 4096,
    reviewMode: true,
    metricsEnabled: true,
    reasoningEnabled: true,
  },
  onModelSelect,
  onProviderSelect,
  onThemeSelect,
  onOptionChange,
  onQuickAction,
}: SettingsTabProps) {
  const { state: uiState } = useUI();


  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* Quick Actions */}
      <Box
        flexDirection="row"
        borderStyle="single"
        borderColor={uiState.theme.text.accent}
        paddingX={1}
        marginBottom={1}
        gap={2}
        flexShrink={0}
      >
        <Text bold color={uiState.theme.text.accent}>
          Quick Actions:
        </Text>
        <Text color={uiState.theme.status.success}>
          [s] Save Session
        </Text>
        <Text color={uiState.theme.status.info}>
          [e] Export Session
        </Text>
        <Text color={uiState.theme.status.error}>
          [c] Clear Session
        </Text>
      </Box>

      {/* Two-column layout */}
      <Box flexGrow={1} gap={2}>
        {/* Left column */}
        <Box flexDirection="column" flexGrow={1} gap={1}>
          {/* Model Picker */}
          <Box flexShrink={0}>
            <ModelPicker
              models={models}
              selectedModel={selectedModel}
              onSelect={onModelSelect || (() => {})}
              theme={uiState.theme as any}
            />
          </Box>

          {/* Provider Selector */}
          <Box flexShrink={0}>
            <ProviderSelector
              providers={providers}
              selectedProvider={selectedProvider}
              onSelect={onProviderSelect || (() => {})}
              theme={uiState.theme}
            />
          </Box>

          {/* Theme Picker */}
          <Box flexShrink={0}>
            <ThemePicker
              themes={themes}
              selectedTheme={uiState.theme.name}
              onSelect={onThemeSelect || (() => {})}
              theme={uiState.theme}
            />
          </Box>
        </Box>

        {/* Right column */}
        <Box flexDirection="column" flexGrow={1} gap={1}>
          {/* Session Info */}
          {sessionStats && (
            <Box flexShrink={0}>
              <SessionInfo stats={sessionStats} theme={uiState.theme} />
            </Box>
          )}

          {/* Options Panel */}
          <Box flexShrink={0}>
            <OptionsPanel
              options={options}
              onChange={onOptionChange || (() => {})}
              theme={uiState.theme}
            />
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center" flexShrink={0}>
        <Text color={uiState.theme.text.secondary} dimColor>
          Press Esc to return to Chat
        </Text>
      </Box>
    </Box>
  );
}
