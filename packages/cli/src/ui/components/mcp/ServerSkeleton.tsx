/**
 * ServerSkeleton Component
 *
 * Skeleton screen for server items during loading.
 * Provides visual feedback while server data is being fetched.
 *
 * Validates: NFR-7
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface ServerSkeletonProps {
  /** Number of skeleton items to display */
  count?: number;
}

/**
 * Single skeleton item
 */
function SkeletonItem() {
  return (
    <Box flexDirection="column" marginY={1} paddingX={1}>
      {/* Server name placeholder */}
      <Box>
        <Text dimColor>▸ ████████████</Text>
        <Box marginLeft={2}>
          <Text dimColor>○</Text>
        </Box>
        <Box marginLeft={2}>
          <Text dimColor>●</Text>
        </Box>
      </Box>

      {/* Description placeholder */}
      <Box marginLeft={2} marginTop={1}>
        <Text dimColor>████████████████████████████</Text>
      </Box>
    </Box>
  );
}

/**
 * ServerSkeleton Component
 *
 * Displays skeleton placeholders for server items while loading.
 * Shows a shimmer effect to indicate loading state.
 */
export function ServerSkeleton({ count = 3 }: ServerSkeletonProps) {
  return (
    <Box flexDirection="column">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} />
      ))}
    </Box>
  );
}
