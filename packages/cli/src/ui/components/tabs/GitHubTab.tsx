import React from 'react';
import { Box, Text } from 'ink';
import { PlannedFeaturesList } from '../github/PlannedFeaturesList.js';

/**
 * GitHubTab Component
 * 
 * Placeholder UI for GitHub integration panel.
 * This is a temporary placeholder for the GitHub integration panel.
 * Full implementation will be added in Stage-11.
 * 
 * Displays:
 * - "Coming Soon" heading
 * - Brief description
 * - List of planned features organized by category
 * - Link to Stage-11 specification
 * 
 * @see .kiro/specs/stage-11-developer-productivity-future-dev/
 */
export const GitHubTab: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Heading - centered with space above and below */}
      <Box justifyContent="center" marginTop={1} marginBottom={1}>
        <Text bold color="yellow">🚧 Coming Soon 🚧</Text>
      </Box>
      
      {/* Description - with space below */}
      <Box marginBottom={2}>
        <Text>
          GitHub integration will be available in a future release.
        </Text>
      </Box>
      
      {/* Features Section Label - with space below */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>Planned Features:</Text>
      </Box>
      
      <PlannedFeaturesList />
      
      {/* Documentation Link - with space above */}
      <Box marginTop={2}>
        <Text dimColor>
          For more information, see: .kiro/specs/stage-11-developer-productivity-future-dev/
        </Text>
      </Box>
    </Box>
  );
};
