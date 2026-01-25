/**
 * Workflow Status Component
 * 
 * Displays the current workflow progress and status
 */

import React from 'react';
import { Box, Text } from 'ink';

import type { WorkflowProgress } from '@ollm/ollm-cli-core/prompts/index.js';

export interface WorkflowStatusProps {
  /** Current workflow progress */
  progress: WorkflowProgress | null;
  /** Theme colors */
  theme: {
    text: {
      primary: string;
      secondary: string;
      accent: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  /** Whether to show in compact mode */
  compact?: boolean;
}

/**
 * Get mode icon
 */
function getModeIcon(mode: string): string {
  const icons: Record<string, string> = {
    assistant: '💬',
    planning: '📋',
    developer: '👨‍💻',
    debugger: '🐛'
  };
  return icons[mode] || '📝';
}

/**
 * Get progress bar
 */
function getProgressBar(percent: number, width: number = 20): string {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Workflow Status Component
 * 
 * Displays current workflow progress in the UI
 */
export function WorkflowStatus({ progress, theme, compact = false }: WorkflowStatusProps) {
  // Don't render if no active workflow
  if (!progress) {
    return null;
  }

  if (compact) {
    // Compact mode: just show workflow name and progress
    return (
      <Box flexDirection="row" alignItems="center">
        <Text color={theme.text.secondary}>Workflow: </Text>
        <Text color={theme.text.accent}>{progress.workflowName}</Text>
        <Text color={theme.text.secondary}> </Text>
        <Text color={theme.status.info}>
          {progress.currentStep}/{progress.totalSteps}
        </Text>
        {progress.paused && (
          <>
            <Text color={theme.text.secondary}> </Text>
            <Text color={theme.status.warning}>⏸ Paused</Text>
          </>
        )}
      </Box>
    );
  }

  // Full mode: show detailed progress
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" alignItems="center">
        <Text color={theme.text.accent} bold>
          Workflow: {progress.workflowName}
        </Text>
        {progress.paused && (
          <>
            <Text color={theme.text.secondary}> </Text>
            <Text color={theme.status.warning} bold>
              ⏸ PAUSED
            </Text>
          </>
        )}
      </Box>
      
      <Box flexDirection="column" marginTop={1}>
        {/* Progress bar */}
        <Box flexDirection="row" alignItems="center">
          <Text color={theme.text.secondary}>Progress: </Text>
          <Text color={theme.status.info}>
            {getProgressBar(progress.percentComplete)}
          </Text>
          <Text color={theme.text.secondary}> </Text>
          <Text color={theme.status.info}>
            {progress.percentComplete}%
          </Text>
        </Box>
        
        {/* Current step */}
        <Box flexDirection="row" alignItems="center" marginTop={1}>
          <Text color={theme.text.secondary}>Step {progress.currentStep}/{progress.totalSteps}: </Text>
          <Text color={theme.text.primary}>{progress.currentStepDescription}</Text>
        </Box>
        
        {/* Current mode */}
        <Box flexDirection="row" alignItems="center">
          <Text color={theme.text.secondary}>Mode: </Text>
          <Text color={theme.text.accent}>
            {getModeIcon(progress.currentMode)} {progress.currentMode}
          </Text>
        </Box>
        
        {/* Steps completed */}
        <Box flexDirection="row" alignItems="center">
          <Text color={theme.text.secondary}>Completed: </Text>
          <Text color={theme.status.success}>
            {progress.stepsCompleted}/{progress.totalSteps} steps
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
