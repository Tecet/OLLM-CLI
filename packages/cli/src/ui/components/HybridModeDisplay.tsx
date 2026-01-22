/**
 * Hybrid Mode Display Component
 * 
 * Displays the current hybrid mode status in the UI.
 * Shows combined mode icons, persona, and active modes.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { HybridMode } from '@ollm/core';

export interface HybridModeDisplayProps {
  hybridMode: HybridMode | null;
  compact?: boolean;
}

/**
 * Hybrid Mode Display Component
 */
export function HybridModeDisplay({ hybridMode, compact = false }: HybridModeDisplayProps) {
  if (!hybridMode) {
    return null;
  }
  
  if (compact) {
    return (
      <Box flexDirection="row" gap={1}>
        <Text color={hybridMode.color}>{hybridMode.icon}</Text>
        <Text bold color={hybridMode.color}>
          {hybridMode.name}
        </Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor={hybridMode.color}>
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text color={hybridMode.color}>{hybridMode.icon}</Text>
        <Text bold color={hybridMode.color}>
          {hybridMode.name}
        </Text>
      </Box>
      
      <Box flexDirection="column" gap={0}>
        <Text dimColor>
          {hybridMode.description}
        </Text>
        
        <Box marginTop={1}>
          <Text dimColor>Persona: </Text>
          <Text>{hybridMode.persona}</Text>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>Active Modes: </Text>
          <Text>{hybridMode.modes.join(', ')}</Text>
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Hybrid Mode Badge Component
 * 
 * Small badge showing hybrid mode status
 */
export interface HybridModeBadgeProps {
  hybridMode: HybridMode | null;
}

export function HybridModeBadge({ hybridMode }: HybridModeBadgeProps) {
  if (!hybridMode) {
    return null;
  }
  
  return (
    <Box
      flexDirection="row"
      gap={1}
      paddingX={1}
      borderStyle="round"
      borderColor={hybridMode.color}
    >
      <Text color={hybridMode.color}>{hybridMode.icon}</Text>
      <Text color={hybridMode.color}>{hybridMode.name}</Text>
    </Box>
  );
}

/**
 * Hybrid Mode List Component
 * 
 * Displays a list of available hybrid modes
 */
export interface HybridModeListProps {
  hybridModes: HybridMode[];
  onSelect?: (hybridMode: HybridMode) => void;
  selectedId?: string;
}

export function HybridModeList({ hybridModes, onSelect, selectedId }: HybridModeListProps) {
  if (hybridModes.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No hybrid modes available</Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" gap={1}>
      {hybridModes.map((mode) => {
        const isSelected = mode.id === selectedId;
        
        return (
          <Box
            key={mode.id}
            flexDirection="column"
            paddingX={1}
            paddingY={1}
            borderStyle={isSelected ? 'double' : 'single'}
            borderColor={isSelected ? mode.color : 'gray'}
          >
            <Box flexDirection="row" gap={1}>
              <Text color={mode.color}>{mode.icon}</Text>
              <Text bold={isSelected} color={mode.color}>
                {mode.name}
              </Text>
              {isSelected && <Text color="green"> ✓</Text>}
            </Box>
            
            <Box marginTop={1}>
              <Text dimColor>{mode.description}</Text>
            </Box>
            
            <Box marginTop={1}>
              <Text dimColor>Modes: </Text>
              <Text>{mode.modes.join(', ')}</Text>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
