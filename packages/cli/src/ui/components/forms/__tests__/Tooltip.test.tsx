/**
 * Tooltip Component Tests
 * 
 * Tests the tooltip component for displaying contextual help.
 */

import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Tooltip, InfoIcon } from '../Tooltip.js';

describe('Tooltip', () => {
  describe('Inline Display', () => {
    it('should render tooltip inline by default', () => {
      const { lastFrame } = render(
        <Tooltip text="This is help text" />
      );

      const output = lastFrame();
      expect(output).toContain('ℹ');
      expect(output).toContain('This is help text');
    });

    it('should use custom icon', () => {
      const { lastFrame } = render(
        <Tooltip text="Help text" icon="🔒" />
      );

      const output = lastFrame();
      expect(output).toContain('🔒');
      expect(output).toContain('Help text');
    });

    it('should render inline when inline prop is true', () => {
      const { lastFrame } = render(
        <Tooltip text="Help text" inline={true} />
      );

      const output = lastFrame();
      expect(output).toContain('ℹ');
      expect(output).toContain('Help text');
    });
  });

  describe('Block Display', () => {
    it('should render as block when inline is false', () => {
      const { lastFrame } = render(
        <Tooltip text="Help text" inline={false} />
      );

      const output = lastFrame();
      expect(output).toContain('ℹ');
      expect(output).toContain('Help text');
    });
  });

  describe('InfoIcon', () => {
    it('should render info icon', () => {
      const { lastFrame } = render(<InfoIcon />);

      const output = lastFrame();
      expect(output).toContain('ℹ');
    });

    it('should use custom color', () => {
      const { lastFrame } = render(<InfoIcon color="yellow" />);

      const output = lastFrame();
      expect(output).toContain('ℹ');
    });
  });

  describe('Long Text', () => {
    it('should handle long help text', () => {
      const longText = 'This is a very long help text that explains a complex concept in detail';
      const { lastFrame } = render(
        <Tooltip text={longText} />
      );

      const output = lastFrame();
      expect(output).toContain(longText);
    });
  });

  describe('Special Characters', () => {
    it('should handle special characters in text', () => {
      const { lastFrame } = render(
        <Tooltip text="Use API_KEY, TOKEN, or SECRET for sensitive values" />
      );

      const output = lastFrame();
      expect(output).toContain('API_KEY');
      expect(output).toContain('TOKEN');
      expect(output).toContain('SECRET');
    });
  });
});
