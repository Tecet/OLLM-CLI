/**
 * MetricsDisplay Component
 *
 * Displays performance metrics for inference generations
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7
 */

import React from 'react';
import { Box, Text } from 'ink';

import type { Theme } from '../../../config/types.js';

export interface InferenceMetrics {
  promptTokens: number;
  completionTokens: number;
  totalDuration: number;
  promptDuration: number;
  evalDuration: number;
  tokensPerSecond: number;
  timeToFirstToken: number;
  totalSeconds: number;
  loadDuration?: number;
}

export interface MetricsDisplayProps {
  metrics: InferenceMetrics;
  compact: boolean;
  theme: Theme;
  visible?: boolean;
}

/**
 * Displays inference performance metrics
 *
 * Full format:
 * ⚡ 42.3 t/s │ 📥 847 tokens │ 📤 156 tokens │ ⏱️ 3.68s │ TTFT: 0.12s
 *
 * Compact format:
 * ⚡ 42.3 t/s │ 156 tokens │ 3.68s
 */
export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  metrics,
  compact,
  theme,
  visible = true,
}) => {
  if (!visible) {
    return null;
  }

  const formatNumber = (num: number, decimals: number = 1): string => {
    return num.toFixed(decimals);
  };

  if (compact) {
    // Compact format: tokens/sec, output tokens, total time
    return (
      <Box>
        <Text color={theme.text.secondary}>
          ⚡ {formatNumber(metrics.tokensPerSecond)} t/s │ {metrics.completionTokens} tokens │{' '}
          {formatNumber(metrics.totalSeconds)}s
        </Text>
      </Box>
    );
  }

  // Full format: tokens/sec, input tokens, output tokens, total time, TTFT (if available)
  const parts: string[] = [
    `⚡ ${formatNumber(metrics.tokensPerSecond)} t/s`,
    `📥 ${metrics.promptTokens} tokens`,
    `📤 ${metrics.completionTokens} tokens`,
    `⏱️ ${formatNumber(metrics.totalSeconds)}s`,
  ];

  // Add TTFT if available
  if (metrics.timeToFirstToken > 0) {
    parts.push(`TTFT: ${formatNumber(metrics.timeToFirstToken)}s`);
  }

  return (
    <Box>
      <Text color={theme.text.secondary}>{parts.join(' │ ')}</Text>
    </Box>
  );
};
