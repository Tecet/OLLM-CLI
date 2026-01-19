/**
 * ProgressIndicator Component Tests
 * 
 * Tests for the ProgressIndicator component that displays operation progress.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ProgressIndicator } from '../ProgressIndicator.js';

describe('ProgressIndicator', () => {
  it('should render install operation', () => {
    const { lastFrame } = render(
      <ProgressIndicator operation="install" serverName="test-server" />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Installing');
    expect(frame).toContain('test-server');
  });

  it('should render restart operation', () => {
    const { lastFrame } = render(
      <ProgressIndicator operation="restart" serverName="test-server" />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Restarting');
    expect(frame).toContain('test-server');
  });

  it('should render configure operation', () => {
    const { lastFrame } = render(
      <ProgressIndicator operation="configure" serverName="test-server" />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Configuring');
    expect(frame).toContain('test-server');
  });

  it('should render uninstall operation', () => {
    const { lastFrame } = render(
      <ProgressIndicator operation="uninstall" serverName="test-server" />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Uninstalling');
    expect(frame).toContain('test-server');
  });

  it('should render with progress percentage', () => {
    const { lastFrame } = render(
      <ProgressIndicator 
        operation="install" 
        serverName="test-server"
        progress={50}
      />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('50%');
  });

  it('should render with step description', () => {
    const { lastFrame } = render(
      <ProgressIndicator 
        operation="install" 
        serverName="test-server"
        step="Downloading dependencies..."
      />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Downloading dependencies...');
  });

  it('should render complete state', () => {
    const { lastFrame } = render(
      <ProgressIndicator 
        operation="install" 
        serverName="test-server"
        complete={true}
      />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('✓');
    expect(frame).toContain('Complete');
  });

  it('should render error state', () => {
    const { lastFrame } = render(
      <ProgressIndicator 
        operation="install" 
        serverName="test-server"
        error="Installation failed"
      />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('✗');
    expect(frame).toContain('Failed');
    expect(frame).toContain('Installation failed');
  });

  it('should render without server name', () => {
    const { lastFrame } = render(
      <ProgressIndicator operation="loading" />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Loading');
  });

  it('should show spinner when in progress', () => {
    const { lastFrame } = render(
      <ProgressIndicator operation="install" serverName="test-server" />
    );
    
    const frame = lastFrame();
    // Should contain spinner character
    expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });
});
