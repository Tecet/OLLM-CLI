import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package.json path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../../../package.json');

// Read version from package.json
let version = '0.1.0';
try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  version = packageJson.version;
} catch (error) {
  // Fallback to default version if package.json can't be read
}

interface VersionBannerProps {
  theme: {
    text: {
      primary: string;
      accent: string;
    };
  };
}

export const VersionBanner: React.FC<VersionBannerProps> = ({ theme }) => {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      borderStyle="round"
      borderColor={theme.text.accent}
      paddingX={2}
      paddingY={1}
    >
      <Text bold color={theme.text.accent}>
        OLLM CLI
      </Text>
      <Text color={theme.text.primary}>
        Version {version}
      </Text>
      <Text dimColor color={theme.text.primary}>
        Local-first LLM Interface
      </Text>
    </Box>
  );
};
