import React from 'react';
import { Box, Text } from 'ink';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Theme } from '../../../config/types.js';

// Get package.json path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../../../../package.json');

// Read version from package.json
let version = '0.1.0';
try {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  version = packageJson.version;
} catch (_error) {
  // Fallback to default version if package.json can't be read
}

interface VersionBannerProps {
  theme: Theme;
  modelInfo?: {
    name: string;
    size?: string;
  };
  gpuInfo?: {
    name: string;
    vram: string;
    utilization?: string;
  };
}

export const VersionBanner: React.FC<VersionBannerProps> = ({ theme, modelInfo, gpuInfo }) => {
  return (
    <Box flexDirection="column" alignItems="center">
      <Box
        flexDirection="column"
        alignItems="center"
        borderStyle="round"
        borderColor={theme.border.active}
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

      {(modelInfo || gpuInfo) && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          {modelInfo && (
            <Text color={theme.text.primary}>
              Model: <Text bold color={theme.text.accent}>{modelInfo.name}</Text>
            </Text>
          )}
          {gpuInfo && (
            <Text color={theme.text.primary} dimColor>
              GPU: {gpuInfo.name} | VRAM: {gpuInfo.vram}
            </Text>
          )}
        </Box>
      )}
      
      <Box marginTop={1}>
        <Text color={theme.text.accent} dimColor>
          Press any key to start...
        </Text>
      </Box>
    </Box>
  );
};
