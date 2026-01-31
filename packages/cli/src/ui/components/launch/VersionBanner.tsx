import React from 'react';
import { Box, Text } from 'ink';

import { Theme } from '../../../config/types.js';

// ASCII art logo - "OLLM" only
// Using semicolons/colons for "O" (red) and plus signs for "LLM" (orange)
const WELCOME_ASCII_LINES = [
  '                         .......             :++++++++++++;:          .         ',
  '                         :++++++.            ;++++++++++++++     ++++++          ',
  '              ....       :++++++.            ......,++++++++,   ,++++++,         ',
  '      ,:;;;;;;;;;;;;;,   :++++++,         ++++;;,  ,+++++++++   +++++++;         ',
  '     ;;;;;;;;;;;;;;;;;;  ,++++++,         ++++++:  ;+++++++++: ;++++++++         ',
  '    .;;;;;;;:...:;;;;;;. ,++++++,         ++++++:  +++++++++++:+++++++++.        ',
  '    :;;;;;;;.    :;;;;;, ,++++++,         ++++++:  +++++;+++++++++;+++++:        ',
  '    :;;;;;;;     ,;;;;;: ,++++++,         ++++++: .+++++;:+++++++.,+++++;        ',
  '    ;;;;;;;;     ,;;;;;: ,++++++,         ++++++: ,+++++:.++++++: .++++++        ',
  '    :;;;;;;;     .;;;;;: ,++++++,     ..  ++++++: :+++++, ;++++;   ++++++,       ',
  '    ,;;;;;;;:...,;;;;;;: ,++++++++++++++, ++++++: ;+++++. .++++.   ++++++;       ',
  '     ,;;;;;;;;;;;;;;;;;  ,++++++++++++++, ++++++: ::::::   .,.     ::::,,        ',
  '       ,:;;;;;;;;;;;:,   .::::::::,,,,,,  ++++++,                                ',
  '              .                           ++++++;,,,,,,,,.                       ',
  '                                          +++++++++++++++;                       ',
  '                                         .+++++++++++++++;                       ',
  '                                                 ........                        ',
];

// Color mapping for OLLM
// "O" (semicolons/colons) = Red (#ea3829)
// "LLM" (plus signs) = Orange (#f69500)
const getColorForChar = (char: string): string | undefined => {
  if (char === ' ') return undefined;

  // "O" - semicolons and colons (red)
  if (char === ';' || char === ':') {
    return '#ea3829';
  }

  // "LLM" - plus signs (orange)
  if (char === '+') {
    return '#f69500';
  }

  // Dots and commas (brown/dark orange)
  if (char === '.' || char === ',') {
    return '#8c5500';
  }

  return undefined;
};

// Render a line with colors
const ColoredLine: React.FC<{ line: string }> = ({ line }) => {
  const segments: Array<{ text: string; color?: string }> = [];
  let currentColor: string | undefined;
  let currentText = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const color = getColorForChar(char);

    if (color === currentColor) {
      currentText += char;
    } else {
      if (currentText) {
        segments.push({ text: currentText, color: currentColor });
      }
      currentColor = color;
      currentText = char;
    }
  }

  if (currentText) {
    segments.push({ text: currentText, color: currentColor });
  }

  return (
    <>
      {segments.map((seg, idx) => (
        <Text key={idx} color={seg.color}>
          {seg.text}
        </Text>
      ))}
    </>
  );
};

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
      {/* Display colored ASCII art logo */}
      <Box flexDirection="column" alignItems="center">
        {WELCOME_ASCII_LINES.map((line, idx) => (
          <Box key={idx}>
            <ColoredLine line={line} />
          </Box>
        ))}
      </Box>

      {/* Version info with 2 lines padding */}
      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text bold color={theme.text.accent}>
          OLLM CLI v0.1.4b alpha
        </Text>
        <Text color={theme.text.accent} dimColor>
          Press any key to continue
        </Text>
      </Box>

      {/* Optional model and GPU info */}
      {(modelInfo || gpuInfo) && (
        <Box marginTop={1} flexDirection="column" alignItems="center">
          {modelInfo && (
            <Text color={theme.text.primary}>
              Model:{' '}
              <Text bold color={theme.text.accent}>
                {modelInfo.name}
              </Text>
            </Text>
          )}
          {gpuInfo && (
            <Text color={theme.text.primary} dimColor>
              GPU: {gpuInfo.name} | VRAM: {gpuInfo.vram}
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
