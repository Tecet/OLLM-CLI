import React, { useState } from 'react';
import { Box, Text } from 'ink';

export interface ModelResult {
  model: string;
  response: string;
  tokenCount: number;
  latencyMs: number;
  tokensPerSecond: number;
  error?: string;
}

export interface ComparisonResult {
  prompt: string;
  timestamp: Date;
  results: ModelResult[];
}

export interface ComparisonViewProps {
  result: ComparisonResult;
  onSelectPreferred?: (model: string) => void;
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
}

function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTokensPerSecond(tps: number): string {
  return `${tps.toFixed(1)} tok/s`;
}

export function ComparisonView({ result, onSelectPreferred, theme }: ComparisonViewProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const _handleSelect = (model: string) => {
    setSelectedModel(model);
    if (onSelectPreferred) {
      onSelectPreferred(model);
    }
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={theme.text.accent}>
          Model Comparison Results
        </Text>
      </Box>

      {/* Prompt */}
      <Box marginBottom={1} flexDirection="column">
        <Text color={theme.text.secondary}>Prompt:</Text>
        <Text color={theme.text.primary}>{result.prompt}</Text>
      </Box>

      {/* Results Grid */}
      <Box flexDirection="row" gap={2}>
        {result.results.map((modelResult, index) => (
          <Box
            key={modelResult.model}
            flexDirection="column"
            borderStyle="single"
            borderColor={
              selectedModel === modelResult.model
                ? theme.status.success
                : modelResult.error
                  ? theme.status.error
                  : theme.text.secondary
            }
            paddingX={1}
            paddingY={1}
            flexGrow={1}
            flexBasis={0}
          >
            {/* Model Header */}
            <Box marginBottom={1} justifyContent="space-between">
              <Text bold color={theme.text.accent}>
                {modelResult.model}
              </Text>
              {selectedModel === modelResult.model && (
                <Text color={theme.status.success}>✓ Selected</Text>
              )}
            </Box>

            {/* Performance Metrics */}
            {!modelResult.error && (
              <Box flexDirection="column" marginBottom={1}>
                <Text color={theme.text.secondary}>
                  Latency:{' '}
                  <Text color={theme.text.primary}>{formatLatency(modelResult.latencyMs)}</Text>
                </Text>
                <Text color={theme.text.secondary}>
                  Speed:{' '}
                  <Text color={theme.text.primary}>
                    {formatTokensPerSecond(modelResult.tokensPerSecond)}
                  </Text>
                </Text>
                <Text color={theme.text.secondary}>
                  Tokens: <Text color={theme.text.primary}>{modelResult.tokenCount}</Text>
                </Text>
              </Box>
            )}

            {/* Response or Error */}
            <Box flexDirection="column" flexGrow={1}>
              {modelResult.error ? (
                <Box flexDirection="column">
                  <Text color={theme.status.error} bold>
                    Error:
                  </Text>
                  <Text color={theme.status.error}>{modelResult.error}</Text>
                </Box>
              ) : (
                <Box flexDirection="column">
                  <Text color={theme.text.secondary} bold>
                    Response:
                  </Text>
                  <Text color={theme.text.primary}>{modelResult.response}</Text>
                </Box>
              )}
            </Box>

            {/* Selection Action */}
            {!modelResult.error && onSelectPreferred && (
              <Box marginTop={1}>
                <Text color={theme.text.secondary}>
                  Press <Text color={theme.text.accent}>{index + 1}</Text> to select
                </Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* Timestamp */}
      <Box marginTop={1}>
        <Text color={theme.text.secondary}>Compared at: {result.timestamp.toLocaleString()}</Text>
      </Box>
    </Box>
  );
}
