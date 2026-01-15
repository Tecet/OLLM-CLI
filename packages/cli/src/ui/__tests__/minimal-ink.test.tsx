// Minimal test to isolate React 19 + Ink 6 issues
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Box, Text } from 'ink';

describe('Minimal Ink Tests', () => {
  it('renders simple Text', () => {
    const { lastFrame } = render(<Text>Hello</Text>);
    expect(lastFrame()).toContain('Hello');
  });

  it('renders simple Box with Text', () => {
    const { lastFrame } = render(
      <Box>
        <Text>Hello</Text>
      </Box>
    );
    expect(lastFrame()).toContain('Hello');
  });

  it('renders Box with flexDirection row and gap', () => {
    const { lastFrame } = render(
      <Box flexDirection="row" gap={2}>
        <Text>A</Text>
        <Text>B</Text>
      </Box>
    );
    expect(lastFrame()).toContain('A');
    expect(lastFrame()).toContain('B');
  });

  it('renders nested Box components', () => {
    const { lastFrame } = render(
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Text>Left</Text>
          <Text>Right</Text>
        </Box>
      </Box>
    );
    expect(lastFrame()).toContain('Left');
    expect(lastFrame()).toContain('Right');
  });

  it('renders conditional children', () => {
    const showExtra = true;
    const { lastFrame } = render(
      <Box flexDirection="column">
        <Text>Always</Text>
        {showExtra && <Text>Extra</Text>}
      </Box>
    );
    expect(lastFrame()).toContain('Always');
    expect(lastFrame()).toContain('Extra');
  });

  it('renders Text with children expression', () => {
    const value = 42;
    const { lastFrame } = render(
      <Text>Value: {value}</Text>
    );
    expect(lastFrame()).toContain('Value: 42');
  });

  it('renders borderStyle', () => {
    const { lastFrame } = render(
      <Box borderStyle="single" borderColor="#555">
        <Text>Inside</Text>
      </Box>
    );
    expect(lastFrame()).toContain('Inside');
  });

  it('renders multiple conditionals in row', () => {
    const a = true;
    const b = false;
    const { lastFrame } = render(
      <Box flexDirection="row">
        <Text>Base</Text>
        {a && <Text> AAA</Text>}
        {b && <Text> BBB</Text>}
      </Box>
    );
    expect(lastFrame()).toContain('Base');
    expect(lastFrame()).toContain('AAA');
    expect(lastFrame()).not.toContain('BBB');
  });
});
