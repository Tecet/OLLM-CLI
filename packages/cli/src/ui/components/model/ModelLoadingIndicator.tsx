/**
 * Model Loading Indicator
 * Shows warmup progress with attempt number, elapsed time, and skip option
 */

import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

import { useModel } from '../../../features/context/ModelContext.js';

export function ModelLoadingIndicator() {
  const { modelLoading, warmupStatus } = useModel();
  
  if (!modelLoading || !warmupStatus?.active) {
    return null;
  }
  
  const { attempt, elapsedMs } = warmupStatus;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  
  return (
    <Box flexDirection="column" marginY={1} paddingX={2}>
      <Box>
        <Text color="cyan">
          <Spinner type="dots" />
        </Text>
        <Text> Loading model </Text>
        <Text dimColor>(attempt {attempt}/3)</Text>
      </Box>
      <Box marginTop={0}>
        <Text dimColor>Elapsed: {elapsedSec}s</Text>
      </Box>
      <Box marginTop={0}>
        <Text dimColor>Press </Text>
        <Text color="yellow">Ctrl+C</Text>
        <Text dimColor> to skip warmup</Text>
      </Box>
    </Box>
  );
}
