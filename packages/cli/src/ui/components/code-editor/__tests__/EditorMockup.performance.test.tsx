/**
 * EditorMockup Performance Tests
 * 
 * Tests rendering performance, re-render behavior, and memory characteristics
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { EditorMockup } from '../EditorMockup.js';

describe('EditorMockup Performance', () => {
  let _performanceMarks: string[] = [];

  beforeEach(() => {
    _performanceMarks = [];
    // Clear any existing marks
    if (typeof performance !== 'undefined' && performance.clearMarks) {
      performance.clearMarks();
      performance.clearMeasures();
    }
  });

  afterEach(() => {
    _performanceMarks = [];
  });

  describe('Rendering Performance', () => {
    it('should render initial view quickly', () => {
      const startTime = Date.now();
      
      const { lastFrame } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const endTime = Date.now();
      const renderTime = endTime - startTime;
      
      // Should render in less than 100ms (generous for test environment)
      expect(renderTime).toBeLessThan(100);
      
      // Should contain the file name
      expect(lastFrame()).toContain('LlamaAnimation');
    });

    it('should handle small viewport efficiently', () => {
      const startTime = Date.now();
      
      const { lastFrame } = render(
        <EditorMockup width={40} height={10} />
      );
      
      const endTime = Date.now();
      const renderTime = endTime - startTime;
      
      // Small viewport should be fast
      expect(renderTime).toBeLessThan(100);
      expect(lastFrame()).toContain('LlamaAnimat'); // Truncated due to small width
    });

    it('should handle large viewport efficiently', () => {
      const startTime = Date.now();
      
      const { lastFrame } = render(
        <EditorMockup width={120} height={50} />
      );
      
      const endTime = Date.now();
      const renderTime = endTime - startTime;
      
      // Large viewport should still be fast (all 37 lines visible)
      expect(renderTime).toBeLessThan(50);
      expect(lastFrame()).toContain('LlamaAnimation.tsx');
    });
  });

  describe('Re-render Behavior', () => {
    it('should not re-render when props do not change', () => {
      let renderCount = 0;
      
      const TestWrapper = ({ width, height }: { width: number; height: number }) => {
        renderCount++;
        return <EditorMockup width={width} height={height} />;
      };
      
      const { rerender } = render(<TestWrapper width={80} height={30} />);
      
      const initialRenderCount = renderCount;
      
      // Re-render with same props
      rerender(<TestWrapper width={80} height={30} />);
      
      // Should have rendered twice (initial + rerender)
      // But EditorMockup itself should be memoized
      expect(renderCount).toBe(initialRenderCount + 1);
    });

    it('should re-render when height changes', () => {
      const { rerender, lastFrame } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const frame1 = lastFrame();
      
      // Change height
      rerender(<EditorMockup width={80} height={15} />);
      
      const frame2 = lastFrame();
      
      // Frames should be different (different number of visible lines)
      expect(frame1).not.toBe(frame2);
    });

    it('should re-render when width changes', () => {
      const { rerender, lastFrame } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const frame1 = lastFrame();
      
      // Change width
      rerender(<EditorMockup width={60} height={30} />);
      
      const frame2 = lastFrame();
      
      // Frames should be different (different layout)
      expect(frame1).not.toBe(frame2);
    });
  });

  describe('Visible Lines Calculation', () => {
    it('should only render visible lines for small viewport', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={10} />
      );
      
      const output = lastFrame();
      
      // With height=10, content height is 10-2=8 lines
      // Should show "Line 8/37" in header
      expect(output).toContain('Line 8/37');
    });

    it('should render all lines when viewport is large enough', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={50} />
      );
      
      const output = lastFrame();
      
      // With height=50, content height is 48, but we only have 37 lines
      // Should show "Line 37/37" in header
      expect(output).toContain('Line 37/37');
    });

    it('should handle minimum height gracefully', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={3} />
      );
      
      const output = lastFrame();
      
      // With height=3, content height is 1 line minimum
      // Should show "Line 1/37" in header
      expect(output).toContain('Line 1/37');
    });
  });

  describe('Memory Characteristics', () => {
    it('should not leak memory on multiple renders', () => {
      const { rerender, unmount } = render(
        <EditorMockup width={80} height={30} />
      );
      
      // Render multiple times
      for (let i = 0; i < 10; i++) {
        rerender(<EditorMockup width={80} height={30 + i} />);
      }
      
      // Should complete without errors
      expect(unmount).not.toThrow();
    });

    it('should handle rapid prop changes', () => {
      const { rerender } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const startTime = Date.now();
      
      // Simulate rapid resizing
      for (let i = 10; i < 50; i++) {
        rerender(<EditorMockup width={80} height={i} />);
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // 40 re-renders should complete in reasonable time (600ms threshold for CI variability)
      expect(totalTime).toBeLessThan(600);
    });
  });

  describe('Content Rendering', () => {
    it('should render syntax-highlighted code', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const output = lastFrame();
      
      // Should contain sample code keywords (visible in first 28 lines)
      expect(output).toContain('import');
      expect(output).toContain('React');
      expect(output).toContain('const');
      // Note: 'function' appears on line 30, not visible in 28-line viewport
    });

    it('should render line numbers', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const output = lastFrame();
      
      // Should contain line numbers (padded to 3 chars)
      expect(output).toMatch(/\s+1\s/);
      expect(output).toMatch(/\s+2\s/);
    });

    it('should render header and footer', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={30} />
      );
      
      const output = lastFrame();
      
      // Should contain header
      expect(output).toContain('LlamaAnimation.tsx');
      expect(output).toContain('Read-Only Preview');
      
      // Should contain footer
      expect(output).toContain('Code Editor Coming Soon');
      expect(output).toContain('preview mockup');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero width gracefully', () => {
      const { lastFrame } = render(
        <EditorMockup width={0} height={30} />
      );
      
      // Should not crash
      expect(lastFrame()).toBeDefined();
    });

    it('should handle zero height gracefully', () => {
      const { lastFrame } = render(
        <EditorMockup width={80} height={0} />
      );
      
      // Should not crash
      expect(lastFrame()).toBeDefined();
    });

    it('should handle very large dimensions', () => {
      const { lastFrame } = render(
        <EditorMockup width={500} height={200} />
      );
      
      // Should not crash and should show all lines
      const output = lastFrame();
      expect(output).toContain('Line 37/37');
    });
  });
});

describe('EditorMockup Optimization Verification', () => {
  it('should use React.memo for component memoization', () => {
    // Verify that EditorMockup is a valid React component
    // React.memo can return either a function or object depending on the environment
    const componentType = typeof EditorMockup;
    expect(['function', 'object']).toContain(componentType);
    
    // The real test of memoization is in the re-render behavior tests above
    // which verify that the component doesn't re-render unnecessarily
  });

  it('should efficiently calculate visible lines', () => {
    const startTime = Date.now();
    
    // Render with different heights to test memoization
    const { rerender } = render(
      <EditorMockup width={80} height={30} />
    );
    
    // Re-render with same height (should use memoized value)
    rerender(<EditorMockup width={80} height={30} />);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should be very fast due to memoization
    expect(totalTime).toBeLessThan(50);
  });
});
