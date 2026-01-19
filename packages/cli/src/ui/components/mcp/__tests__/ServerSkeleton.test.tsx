/**
 * ServerSkeleton Component Tests
 * 
 * Tests for the ServerSkeleton component that displays loading placeholders.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { ServerSkeleton } from '../ServerSkeleton.js';

describe('ServerSkeleton', () => {
  it('should render default number of skeleton items', () => {
    const { lastFrame } = render(<ServerSkeleton />);
    
    const frame = lastFrame();
    // Should contain skeleton placeholders (█ characters)
    expect(frame).toContain('████');
  });

  it('should render specified number of skeleton items', () => {
    const { lastFrame } = render(<ServerSkeleton count={5} />);
    
    const frame = lastFrame();
    // Should contain skeleton placeholders
    expect(frame).toContain('████');
  });

  it('should render with toggle and status indicators', () => {
    const { lastFrame } = render(<ServerSkeleton count={1} />);
    
    const frame = lastFrame();
    // Should contain expand icon and status indicators
    expect(frame).toContain('▸');
    expect(frame).toContain('○');
    expect(frame).toContain('●');
  });

  it('should render multiple skeleton items', () => {
    const { lastFrame } = render(<ServerSkeleton count={3} />);
    
    const frame = lastFrame();
    // Should contain multiple skeleton items
    const skeletonCount = (frame.match(/▸/g) || []).length;
    expect(skeletonCount).toBe(3);
  });
});
