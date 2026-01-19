/**
 * LoadingSpinner Component Tests
 * 
 * Tests for the LoadingSpinner component that displays animated loading states.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { LoadingSpinner } from '../LoadingSpinner.js';

describe('LoadingSpinner', () => {
  it('should render with default props', () => {
    const { lastFrame } = render(<LoadingSpinner />);
    
    const frame = lastFrame();
    expect(frame).toContain('Loading...');
  });

  it('should render with custom message', () => {
    const { lastFrame } = render(
      <LoadingSpinner message="Loading MCP servers..." />
    );
    
    const frame = lastFrame();
    expect(frame).toContain('Loading MCP servers...');
  });

  it('should render centered by default', () => {
    const { lastFrame } = render(<LoadingSpinner />);
    
    // Should render without errors
    expect(lastFrame()).toBeTruthy();
  });

  it('should render non-centered when specified', () => {
    const { lastFrame } = render(
      <LoadingSpinner centered={false} />
    );
    
    // Should render without errors
    expect(lastFrame()).toBeTruthy();
  });

  it('should render with padding by default', () => {
    const { lastFrame } = render(<LoadingSpinner />);
    
    // Should render without errors
    expect(lastFrame()).toBeTruthy();
  });

  it('should render without padding when specified', () => {
    const { lastFrame } = render(
      <LoadingSpinner padded={false} />
    );
    
    // Should render without errors
    expect(lastFrame()).toBeTruthy();
  });

  it('should use dots spinner by default', () => {
    const { lastFrame } = render(<LoadingSpinner />);
    
    const frame = lastFrame();
    // Should contain one of the dots spinner frames
    expect(frame).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it('should use line spinner when specified', () => {
    const { lastFrame } = render(
      <LoadingSpinner spinnerType="line" />
    );
    
    const frame = lastFrame();
    // Should contain one of the line spinner frames
    expect(frame).toMatch(/[|/\-\\]/);
  });
});
