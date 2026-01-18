import React from 'react';
import { Box, Text } from 'ink';
import { Theme } from '../../../config/types.js';

export interface Provider {
  name: string;
  host: string;
  status: 'connected' | 'connecting' | 'disconnected';
}

export interface ProviderSelectorProps {
  /** Available providers */
  providers: Provider[];
  
  /** Currently selected provider */
  selectedProvider: string;
  
  /** Callback when a provider is selected */
  onSelect: (providerName: string) => void;
  
  /** Theme for styling */
  theme: Theme;
}

/**
 * ProviderSelector component
 * 
 * Displays available providers and allows selection.
 * Shows provider name, host, and connection status.
 */
export function ProviderSelector({
  providers,
  selectedProvider,
  onSelect: _onSelect,
  theme,
}: ProviderSelectorProps) {
  const getStatusIcon = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
    }
  };

  const getStatusColor = (status: Provider['status']) => {
    switch (status) {
      case 'connected':
        return theme.status.success;
      case 'connecting':
        return theme.status.warning;
      case 'disconnected':
        return theme.status.error;
    }
  };

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.text.accent} paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Provider Selection
        </Text>
      </Box>

      <Box flexDirection="column">
        {providers.map((provider) => {
          const isSelected = provider.name === selectedProvider;
          
          return (
            <Box
              key={provider.name}
              borderStyle={isSelected ? 'single' : undefined}
              borderColor={isSelected ? theme.status.success : undefined}
              paddingX={1}
              marginBottom={1}
            >
              <Box flexDirection="column">
                <Box>
                  <Text
                    color={isSelected ? theme.status.success : theme.text.primary}
                    bold={isSelected}
                  >
                    {isSelected ? '✓ ' : '  '}
                    {provider.name}
                  </Text>
                  <Text> </Text>
                  <Text color={getStatusColor(provider.status)}>
                    {getStatusIcon(provider.status)}
                  </Text>
                </Box>
                <Text color={theme.text.secondary} dimColor>
                  Host: {provider.host}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
