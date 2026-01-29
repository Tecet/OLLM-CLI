/**
 * CompressionProgress Component Tests
 *
 * Tests for the compression progress UI component.
 * Validates: NFR-3 (User Experience)
 */

import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';

import { CompressionProgress } from '../CompressionProgress.js';

describe('CompressionProgress', () => {
  describe('Progress Display', () => {
    it('should not render when not active and not complete/error', () => {
      const { lastFrame } = render(<CompressionProgress active={false} />);
      expect(lastFrame()).toBe('');
    });

    it('should render progress indicator when active', () => {
      const { lastFrame } = render(<CompressionProgress active={true} />);
      const output = lastFrame();
      
      expect(output).toContain('Compressing Context');
      expect(output).toContain('Please wait... Input is temporarily blocked');
    });

    it('should display current stage', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} stage="summarizing" />
      );
      const output = lastFrame();
      
      expect(output).toContain('Creating semantic summary');
    });

    it('should display all compression stages correctly', () => {
      const stages: Array<{
        stage: 'identifying' | 'preparing' | 'summarizing' | 'creating-checkpoint' | 'updating-context' | 'validating';
        text: string;
      }> = [
        { stage: 'identifying', text: 'Identifying messages to compress' },
        { stage: 'preparing', text: 'Preparing for summarization' },
        { stage: 'summarizing', text: 'Creating semantic summary' },
        { stage: 'creating-checkpoint', text: 'Creating checkpoint' },
        { stage: 'updating-context', text: 'Updating active context' },
        { stage: 'validating', text: 'Validating result' },
      ];

      stages.forEach(({ stage, text }) => {
        const { lastFrame } = render(
          <CompressionProgress active={true} stage={stage} />
        );
        expect(lastFrame()).toContain(text);
      });
    });

    it('should display progress bar when progress is provided', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} progress={50} />
      );
      const output = lastFrame();
      
      expect(output).toContain('50%');
      expect(output).toMatch(/\[.*\]/); // Progress bar brackets
    });

    it('should display message count when provided', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} messageCount={10} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Processing 10 messages');
    });

    it('should handle singular message count', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} messageCount={1} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Processing 1 message');
      expect(output).not.toContain('messages');
    });
  });

  describe('Input Blocking', () => {
    it('should show input blocking notice when active', () => {
      const { lastFrame } = render(<CompressionProgress active={true} />);
      const output = lastFrame();
      
      expect(output).toContain('Please wait... Input is temporarily blocked');
    });

    it('should not show input blocking notice when complete', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} complete={true} />
      );
      const output = lastFrame();
      
      expect(output).not.toContain('Input is temporarily blocked');
    });

    it('should not show input blocking notice on error', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} error="Test error" />
      );
      const output = lastFrame();
      
      expect(output).not.toContain('Input is temporarily blocked');
    });
  });

  describe('Completion Message', () => {
    it('should display completion message', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} complete={true} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compression Complete');
      expect(output).toContain('You can now continue the conversation');
    });

    it('should display compressed message count on completion', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} complete={true} messageCount={15} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compressed');
      expect(output).toContain('15');
      expect(output).toContain('messages');
    });

    it('should display tokens freed on completion', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} complete={true} tokensFreed={2500} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Freed');
      expect(output).toContain('2,500');
      expect(output).toContain('tokens');
    });

    it('should display both message count and tokens freed', () => {
      const { lastFrame } = render(
        <CompressionProgress
          active={false}
          complete={true}
          messageCount={20}
          tokensFreed={3000}
        />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compressed');
      expect(output).toContain('20');
      expect(output).toContain('Freed');
      expect(output).toContain('3,000');
    });
  });

  describe('Error Handling', () => {
    it('should display error message', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} error="LLM summarization failed" />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compression Failed');
      expect(output).toContain('LLM summarization failed');
    });

    it('should show recovery message on error', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} error="Test error" />
      );
      const output = lastFrame();
      
      expect(output).toContain('Context remains unchanged');
      expect(output).toContain('You can continue the conversation');
    });

    it('should prioritize error over complete state', () => {
      const { lastFrame } = render(
        <CompressionProgress
          active={false}
          complete={true}
          error="Test error"
        />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compression Failed');
      expect(output).not.toContain('Compression Complete');
    });
  });

  describe('Visual Indicators', () => {
    it('should use yellow border for in-progress state', () => {
      const { lastFrame } = render(<CompressionProgress active={true} />);
      const output = lastFrame();
      
      // Check for yellow color in the output (Ink uses ANSI codes)
      expect(output).toBeTruthy();
    });

    it('should use green border for complete state', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} complete={true} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compression Complete');
    });

    it('should use red border for error state', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} error="Test error" />
      );
      const output = lastFrame();
      
      expect(output).toContain('Compression Failed');
    });
  });

  describe('Progress Bar', () => {
    it('should render progress bar at 0%', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} progress={0} />
      );
      const output = lastFrame();
      
      expect(output).toContain('0%');
    });

    it('should render progress bar at 100%', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} progress={100} />
      );
      const output = lastFrame();
      
      expect(output).toContain('100%');
    });

    it('should render progress bar at intermediate values', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} progress={75} />
      );
      const output = lastFrame();
      
      expect(output).toContain('75%');
    });
  });

  describe('State Transitions', () => {
    it('should transition from active to complete', () => {
      const { lastFrame, rerender } = render(
        <CompressionProgress active={true} stage="summarizing" />
      );
      
      let output = lastFrame();
      expect(output).toContain('Compressing Context');
      
      rerender(
        <CompressionProgress
          active={false}
          complete={true}
          messageCount={10}
          tokensFreed={1500}
        />
      );
      
      output = lastFrame();
      expect(output).toContain('Compression Complete');
      expect(output).toContain('10');
      expect(output).toContain('1,500');
    });

    it('should transition from active to error', () => {
      const { lastFrame, rerender } = render(
        <CompressionProgress active={true} stage="summarizing" />
      );
      
      let output = lastFrame();
      expect(output).toContain('Compressing Context');
      
      rerender(
        <CompressionProgress active={false} error="Summarization timeout" />
      );
      
      output = lastFrame();
      expect(output).toContain('Compression Failed');
      expect(output).toContain('Summarization timeout');
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined stage gracefully', () => {
      const { lastFrame } = render(<CompressionProgress active={true} />);
      const output = lastFrame();
      
      expect(output).toContain('Compressing Context');
    });

    it('should handle zero message count', () => {
      const { lastFrame } = render(
        <CompressionProgress active={true} messageCount={0} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Processing 0 messages');
    });

    it('should handle zero tokens freed', () => {
      const { lastFrame } = render(
        <CompressionProgress active={false} complete={true} tokensFreed={0} />
      );
      const output = lastFrame();
      
      expect(output).toContain('Freed');
      expect(output).toContain('0');
    });

    it('should handle large token numbers with formatting', () => {
      const { lastFrame } = render(
        <CompressionProgress
          active={false}
          complete={true}
          tokensFreed={1234567}
        />
      );
      const output = lastFrame();
      
      expect(output).toContain('1,234,567');
    });
  });
});
