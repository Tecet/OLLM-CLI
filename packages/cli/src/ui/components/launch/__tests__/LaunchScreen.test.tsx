import React from 'react';
import { render, stripAnsi } from '../../../../test/ink-testing.js';
import { describe, it, expect, vi } from 'vitest';
import { LaunchScreen } from '../LaunchScreen.js';

describe('LaunchScreen', () => {
  const mockTheme = {
    text: {
      primary: '#ffffff',
      secondary: '#888888',
      accent: '#00ff00',
    },
  };

  it('should render without crashing', () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(
      <LaunchScreen onDismiss={onDismiss} theme={mockTheme} />
    );
    
    expect(lastFrame()).toBeTruthy();
  });

  it('should display version banner', () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(
      <LaunchScreen onDismiss={onDismiss} theme={mockTheme} />
    );
    
    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('OLLM CLI');
    expect(output).toContain('Version');
  });

  it('should display quick actions', () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(
      <LaunchScreen onDismiss={onDismiss} theme={mockTheme} />
    );
    
    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Quick Actions');
    expect(output).toContain('/help');
  });

  it('should display recent sessions when provided', () => {
    const onDismiss = vi.fn();
    const sessions = [
      {
        id: 'session-123',
        timestamp: new Date(),
        messageCount: 5,
      },
    ];
    
    const { lastFrame } = render(
      <LaunchScreen
        onDismiss={onDismiss}
        theme={mockTheme}
        recentSessions={sessions}
      />
    );
    
    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Recent Sessions');
    expect(output).toContain('session-');
  });

  it('should not display recent sessions when empty', () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(
      <LaunchScreen onDismiss={onDismiss} theme={mockTheme} recentSessions={[]} />
    );
    
    const output = stripAnsi(lastFrame() || '');
    expect(output).not.toContain('Recent Sessions');
  });

  it('should display footer hint', () => {
    const onDismiss = vi.fn();
    const { lastFrame } = render(
      <LaunchScreen onDismiss={onDismiss} theme={mockTheme} />
    );
    
    const output = stripAnsi(lastFrame() || '');
    expect(output).toContain('Press any key to continue...');
  });
});
