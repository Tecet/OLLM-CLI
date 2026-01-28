import React from 'react';
import { Box, Text } from 'ink';

export interface FeatureSectionProps {
  title: string;
  items: string[];
}

/**
 * FeatureSection Component
 *
 * Renders a single feature category with its items.
 * Part of the GitHub panel placeholder (Stage-06a).
 *
 * @see .kiro/specs/stage-11-developer-productivity-future-dev/
 */
export const FeatureSection: React.FC<FeatureSectionProps> = ({ title, items }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Category Title */}
      <Box marginBottom={0}>
        <Text color="cyan">✓ {title}</Text>
      </Box>

      {/* Feature Items */}
      <Box flexDirection="column" marginLeft={2}>
        {items.map((item, index) => (
          <Box key={index}>
            <Text dimColor>• {item}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};
