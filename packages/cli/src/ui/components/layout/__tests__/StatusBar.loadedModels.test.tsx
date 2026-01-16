import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, stripAnsi } from '../../../../test/ink-testing.js';
import { StatusBar, ConnectionStatus } from '../StatusBar.js';

describe('StatusBar - Loaded Models', () => {
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

  it('should display loaded models count when models are loaded', () => {
    const loadedModels = ['llama3.1:8b', 'phi3:mini'];

    const { lastFrame } = render(
      <StatusBar {...defaultProps} loadedModels={loadedModels} />
    );

    const output = lastFrame();

    // Should show count of loaded models in parentheses
    expect(output).toContain('(2)');
  });

  it('should not display loaded models when array is empty', () => {
    const { lastFrame } = render(
      <StatusBar {...defaultProps} loadedModels={[]} />
    );

    const output = lastFrame();

    // Should not show loaded models indicator
    expect(output).not.toContain('loaded');
  });

  it('should not display loaded models when prop is undefined', () => {
    const { lastFrame } = render(<StatusBar {...defaultProps} />);

    const output = lastFrame();

    // Should not show loaded models indicator
    expect(output).not.toContain('loaded');
  });

  it('should display singular form for one loaded model', () => {
    const loadedModels = ['llama3.1:8b'];

    const { lastFrame } = render(
      <StatusBar {...defaultProps} loadedModels={loadedModels} />
    );

    const output = lastFrame();

    // Should show "(1)"
    expect(output).toContain('(1)');
  });

  it('should display plural form for multiple loaded models', () => {
    const loadedModels = ['llama3.1:8b', 'phi3:mini', 'mistral:7b'];

    const { lastFrame } = render(
      <StatusBar {...defaultProps} loadedModels={loadedModels} />
    );

    const output = lastFrame();

    // Should show "(3)"
    expect(output).toContain('(3)');
  });

  it('should update when loaded models change', () => {
    const { lastFrame, rerender } = render(
      <StatusBar {...defaultProps} loadedModels={['llama3.1:8b']} />
    );

    expect(lastFrame()).toContain('(1)');

    // Add another model
    rerender(
      <StatusBar
        {...defaultProps}
        loadedModels={['llama3.1:8b', 'phi3:mini']}
      />
    );

    expect(lastFrame()).toContain('(2)');
  });

  it('should position loaded models before token usage', () => {
    const loadedModels = ['llama3.1:8b', 'phi3:mini'];

    const { lastFrame } = render(
      <StatusBar {...defaultProps} loadedModels={loadedModels} />
    );

    const output = lastFrame();

    // Find positions - loaded models show as "(2)"
    const loadedPos = output.indexOf('(2)');
    const tokensPos = output.indexOf('100/4096');

    // Loaded models should appear before tokens
    expect(loadedPos).toBeLessThan(tokensPos);
  });
});
