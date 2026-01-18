import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '../../../../test/ink-testing.js';
import { StatusBar, ConnectionStatus } from '../StatusBar.js';

describe('StatusBar - Project Profile', () => {
  const defaultTheme = {
    text: {
      primary: '#d4d4d4',
      secondary: '#858585',
      accent: '#4ec9b0',
    },
    status: {
      success: '#4ec9b0',
      warning: '#ce9178',
      error: '#f48771',
      info: '#569cd6',
    },
  };

  const defaultConnection: ConnectionStatus = {
    status: 'connected',
    provider: 'ollama',
  };

  const defaultProps = {
    connection: defaultConnection,
    model: 'llama3.2:3b',
    tokens: { current: 100, max: 4096 },
    git: null,
    gpu: null,
    reviews: 0,
    cost: 0,
    theme: defaultTheme,
  };

  it('should display project profile when provided', () => {
    const { lastFrame } = render(
      <StatusBar {...defaultProps} projectProfile="typescript" />
    );

    const output = lastFrame();

    // Should show project profile
    expect(output).toContain('typescript');
  });

  it('should not display project profile when undefined', () => {
    const { lastFrame } = render(<StatusBar {...defaultProps} />);

    const output = lastFrame();

    // Should not show profile-related content
    // Just verify common profile names are not present
    expect(output).not.toContain('typescript');
    expect(output).not.toContain('python');
    expect(output).not.toContain('rust');
    expect(output).not.toContain('go');
  });

  it('should position project profile after model name', () => {
    const { lastFrame } = render(
      <StatusBar {...defaultProps} projectProfile="python" />
    );

    const output = lastFrame();

    // Find positions
    const modelPos = output.indexOf('llama3.2:3b');
    const profilePos = output.indexOf('python');

    // Profile should appear after model
    expect(profilePos).toBeGreaterThan(modelPos);
  });

  it('should update when project profile changes', () => {
    const { lastFrame, rerender } = render(
      <StatusBar {...defaultProps} projectProfile="typescript" />
    );

    expect(lastFrame()).toContain('typescript');

    // Change profile
    rerender(<StatusBar {...defaultProps} projectProfile="rust" />);

    expect(lastFrame()).toContain('rust');
    expect(lastFrame()).not.toContain('typescript');
  });

  it('should handle profile removal', () => {
    const { lastFrame, rerender } = render(
      <StatusBar {...defaultProps} projectProfile="typescript" />
    );

    expect(lastFrame()).toContain('typescript');

    // Remove profile
    rerender(<StatusBar {...defaultProps} projectProfile={undefined} />);

    expect(lastFrame()).not.toContain('typescript');
  });

  it('should display both profile and loaded models', () => {
    const { lastFrame } = render(
      <StatusBar
        {...defaultProps}
        projectProfile="typescript"
        loadedModels={['llama3.1:8b', 'phi3:mini']}
      />
    );

    const output = lastFrame();

    // Should show both
    expect(output).toContain('typescript');
    expect(output).toContain('(2)');
  });

  it('should handle various profile names', () => {
    const profiles = ['typescript', 'python', 'rust', 'go', 'documentation'];

    profiles.forEach((profile) => {
      const { lastFrame } = render(
        <StatusBar {...defaultProps} projectProfile={profile} />
      );

      const output = lastFrame();
      expect(output).toContain(profile);
    });
  });

  it('should position profile in left section with connection and model', () => {
    const { lastFrame } = render(
      <StatusBar {...defaultProps} projectProfile="typescript" />
    );

    const output = lastFrame();

    // Profile should be in the left section (before token usage)
    const profilePos = output.indexOf('typescript');
    const tokensPos = output.indexOf('100/4096');

    expect(profilePos).toBeLessThan(tokensPos);
  });
});
