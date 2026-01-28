/**
 * EditorMockup Component
 *
 * A visual mockup of the code editor showing syntax-highlighted TypeScript code.
 * Displays sample code from LlamaAnimation.tsx with proper color coding.
 * This is a placeholder until the full editor is implemented.
 *
 * Performance Optimizations:
 * - React.memo to prevent unnecessary re-renders
 * - useMemo for visible lines calculation
 * - Memoized line rendering components
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

interface EditorMockupProps {
  width?: number;
  height?: number;
}

/**
 * Sample code lines with syntax highlighting
 * Colors follow the spec:
 * - Green: Strings
 * - Gray: Comments
 * - Yellow: Numbers, parameters
 * - Magenta: Keywords
 * - Cyan: Operators, types
 * - Blue: Functions
 * - Red: Classes, this
 * - White: Default
 */
const SAMPLE_CODE = [
  {
    line: 1,
    content: [
      { text: 'import', color: 'magenta' },
      { text: ' React, ', color: 'white' },
      { text: '{', color: 'white' },
      { text: ' useState, useEffect, useReducer ', color: 'white' },
      { text: '}', color: 'white' },
      { text: ' from ', color: 'magenta' },
      { text: "'react'", color: 'green' },
      { text: ';', color: 'white' },
    ],
  },
  {
    line: 2,
    content: [
      { text: 'import', color: 'magenta' },
      { text: ' ', color: 'white' },
      { text: '{', color: 'white' },
      { text: ' Box, Text, useStdout ', color: 'white' },
      { text: '}', color: 'white' },
      { text: ' from ', color: 'magenta' },
      { text: "'ink'", color: 'green' },
      { text: ';', color: 'white' },
    ],
  },
  {
    line: 3,
    content: [
      { text: 'import', color: 'magenta' },
      { text: ' ', color: 'white' },
      { text: '{', color: 'white' },
      { text: ' Jimp, ResizeStrategy ', color: 'white' },
      { text: '}', color: 'white' },
      { text: ' from ', color: 'magenta' },
      { text: "'jimp'", color: 'green' },
      { text: ';', color: 'white' },
    ],
  },
  {
    line: 4,
    content: [
      { text: 'import', color: 'magenta' },
      { text: ' path ', color: 'white' },
      { text: 'from', color: 'magenta' },
      { text: " 'path'", color: 'green' },
      { text: ';', color: 'white' },
    ],
  },
  { line: 5, content: [] },
  { line: 6, content: [{ text: '// --- CONFIGURATION ---', color: 'gray' }] },
  {
    line: 7,
    content: [
      { text: 'const', color: 'magenta' },
      { text: ' __filename ', color: 'white' },
      { text: '=', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'fileURLToPath', color: 'blue' },
      { text: '(import.meta.url);', color: 'white' },
    ],
  },
  {
    line: 8,
    content: [
      { text: 'const', color: 'magenta' },
      { text: ' __dirname ', color: 'white' },
      { text: '=', color: 'cyan' },
      { text: ' path.', color: 'white' },
      { text: 'dirname', color: 'blue' },
      { text: '(__filename);', color: 'white' },
    ],
  },
  { line: 9, content: [] },
  { line: 10, content: [{ text: '// Assets now live adjacent to the component', color: 'gray' }] },
  {
    line: 11,
    content: [
      { text: 'const', color: 'magenta' },
      { text: ' ASSETS_PATH ', color: 'white' },
      { text: '=', color: 'cyan' },
      { text: ' path.', color: 'white' },
      { text: 'resolve', color: 'blue' },
      { text: '(__dirname, ', color: 'white' },
      { text: "'lama_sprite'", color: 'green' },
      { text: ');', color: 'white' },
    ],
  },
  { line: 12, content: [] },
  {
    line: 13,
    content: [
      { text: 'type', color: 'magenta' },
      { text: ' Direction ', color: 'white' },
      { text: '=', color: 'cyan' },
      { text: " 'left'", color: 'green' },
      { text: ' | ', color: 'cyan' },
      { text: "'right'", color: 'green' },
      { text: ';', color: 'white' },
    ],
  },
  {
    line: 14,
    content: [
      { text: 'type', color: 'magenta' },
      { text: ' Size ', color: 'white' },
      { text: '=', color: 'cyan' },
      { text: " 'standard'", color: 'green' },
      { text: ' | ', color: 'cyan' },
      { text: "'small'", color: 'green' },
      { text: ' | ', color: 'cyan' },
      { text: "'xsmall'", color: 'green' },
      { text: ';', color: 'white' },
    ],
  },
  { line: 15, content: [] },
  {
    line: 16,
    content: [
      { text: 'interface', color: 'magenta' },
      { text: ' ', color: 'white' },
      { text: 'LlamaAnimationProps', color: 'red' },
      { text: ' {', color: 'white' },
    ],
  },
  {
    line: 17,
    content: [
      { text: '    ', color: 'white' },
      { text: 'size', color: 'yellow' },
      { text: '?:', color: 'cyan' },
      { text: ' Size;', color: 'cyan' },
    ],
  },
  {
    line: 18,
    content: [
      { text: '    ', color: 'white' },
      { text: 'paddingLeft', color: 'yellow' },
      { text: '?:', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'number', color: 'cyan' },
      { text: ';', color: 'white' },
    ],
  },
  {
    line: 19,
    content: [
      { text: '    ', color: 'white' },
      { text: 'movementRatio', color: 'yellow' },
      { text: '?:', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'number', color: 'cyan' },
      { text: '; ', color: 'white' },
      { text: '// Fraction of viewport width', color: 'gray' },
    ],
  },
  {
    line: 20,
    content: [
      { text: '    ', color: 'white' },
      { text: 'enabled', color: 'yellow' },
      { text: '?:', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'boolean', color: 'cyan' },
      { text: '; ', color: 'white' },
      { text: '// Controls animation (default: false)', color: 'gray' },
    ],
  },
  { line: 21, content: [{ text: '}', color: 'white' }] },
  { line: 22, content: [] },
  { line: 23, content: [{ text: '// Frame data structure', color: 'gray' }] },
  {
    line: 24,
    content: [
      { text: 'interface', color: 'magenta' },
      { text: ' ', color: 'white' },
      { text: 'FrameData', color: 'red' },
      { text: ' {', color: 'white' },
    ],
  },
  {
    line: 25,
    content: [
      { text: '    ', color: 'white' },
      { text: 'rows', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'string', color: 'cyan' },
      { text: '[];  ', color: 'white' },
      { text: '// Individual rows', color: 'gray' },
    ],
  },
  {
    line: 26,
    content: [
      { text: '    ', color: 'white' },
      { text: 'spriteWidth', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'number', color: 'cyan' },
      { text: '; ', color: 'white' },
      { text: '// Character width', color: 'gray' },
    ],
  },
  { line: 27, content: [{ text: '}', color: 'white' }] },
  { line: 28, content: [] },
  { line: 29, content: [{ text: '// Helper: Integer to RGBA', color: 'gray' }] },
  {
    line: 30,
    content: [
      { text: 'function', color: 'magenta' },
      { text: ' ', color: 'white' },
      { text: 'intToRGBA', color: 'blue' },
      { text: '(', color: 'white' },
      { text: 'i', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: 'number', color: 'cyan' },
      { text: ') {', color: 'white' },
    ],
  },
  {
    line: 31,
    content: [
      { text: '    ', color: 'white' },
      { text: 'return', color: 'magenta' },
      { text: ' {', color: 'white' },
    ],
  },
  {
    line: 32,
    content: [
      { text: '        ', color: 'white' },
      { text: 'r', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' (i ', color: 'white' },
      { text: '>>>', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '24', color: 'yellow' },
      { text: ') ', color: 'white' },
      { text: '&', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '0xFF', color: 'yellow' },
      { text: ',', color: 'white' },
    ],
  },
  {
    line: 33,
    content: [
      { text: '        ', color: 'white' },
      { text: 'g', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' (i ', color: 'white' },
      { text: '>>>', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '16', color: 'yellow' },
      { text: ') ', color: 'white' },
      { text: '&', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '0xFF', color: 'yellow' },
      { text: ',', color: 'white' },
    ],
  },
  {
    line: 34,
    content: [
      { text: '        ', color: 'white' },
      { text: 'b', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' (i ', color: 'white' },
      { text: '>>>', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '8', color: 'yellow' },
      { text: ') ', color: 'white' },
      { text: '&', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '0xFF', color: 'yellow' },
      { text: ',', color: 'white' },
    ],
  },
  {
    line: 35,
    content: [
      { text: '        ', color: 'white' },
      { text: 'a', color: 'yellow' },
      { text: ':', color: 'cyan' },
      { text: ' i ', color: 'white' },
      { text: '&', color: 'cyan' },
      { text: ' ', color: 'white' },
      { text: '0xFF', color: 'yellow' },
    ],
  },
  { line: 36, content: [{ text: '    };', color: 'white' }] },
  { line: 37, content: [{ text: '}', color: 'white' }] },
];

/**
 * Memoized code line component for efficient rendering
 * Only re-renders when the line data changes
 */
const CodeLine = React.memo<{ line: (typeof SAMPLE_CODE)[0] }>(function CodeLine({ line }) {
  return (
    <Box key={line.line} width="100%">
      {/* Line number */}
      <Box width={4} marginRight={1} flexShrink={0}>
        <Text color="gray">{line.line.toString().padStart(3, ' ')}</Text>
      </Box>

      {/* Code content with syntax highlighting */}
      <Box flexGrow={1} overflow="hidden">
        {line.content.length === 0 ? (
          <Text> </Text>
        ) : (
          line.content.map((token, idx) => (
            <Text key={idx} color={token.color as any}>
              {token.text}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
});

export const EditorMockup = React.memo<EditorMockupProps>(function EditorMockup({
  width = 80,
  height = 30,
}) {
  // Memoize visible lines calculation to avoid recomputing on every render
  const displayLines = useMemo(() => {
    const contentHeight = Math.max(1, height - 2);
    const visibleLines = Math.min(contentHeight, SAMPLE_CODE.length);
    return SAMPLE_CODE.slice(0, visibleLines);
  }, [height]);

  // Memoize stats for header
  const stats = useMemo(
    () => ({
      visibleCount: displayLines.length,
      totalCount: SAMPLE_CODE.length,
    }),
    [displayLines.length]
  );

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} width="100%">
        <Text color="cyan" bold>
          📄 LlamaAnimation.tsx
        </Text>
        <Text color="gray"> [Read-Only Preview]</Text>
        <Text color="white"> | </Text>
        <Text color="gray">
          Line {stats.visibleCount}/{stats.totalCount}
        </Text>
      </Box>

      {/* Code Content */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} width="100%" overflow="hidden">
        {displayLines.map((line) => (
          <CodeLine key={line.line} line={line} />
        ))}
      </Box>

      {/* Footer */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} width="100%">
        <Text color="yellow">⚠️ Code Editor Coming Soon</Text>
        <Text color="gray"> | </Text>
        <Text color="white">This is a preview mockup</Text>
      </Box>
    </Box>
  );
});
