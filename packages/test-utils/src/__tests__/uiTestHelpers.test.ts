/**
 * Tests for UI test helpers
 */

import { describe, it, expect } from 'vitest';

import {
  stripAnsi,
  getTextContent,
  frameContains,
  frameMatches,
  countOccurrences,
  getLines,
  getLine,
  isEmptyFrame,
  KeyboardInput,
  UIAssertions,
  UISnapshot,
  UIState,
} from '../uiTestHelpers.js';

describe('UI Test Helpers', () => {
  describe('stripAnsi', () => {
    it('should remove ANSI escape codes', () => {
      const input = '\x1B[31mRed text\x1B[0m';
      const output = stripAnsi(input);
      expect(output).toBe('Red text');
    });

    it('should handle text without ANSI codes', () => {
      const input = 'Plain text';
      const output = stripAnsi(input);
      expect(output).toBe('Plain text');
    });

    it('should handle empty string', () => {
      const output = stripAnsi('');
      expect(output).toBe('');
    });
  });

  describe('getTextContent', () => {
    it('should extract text from frame', () => {
      const frame = '\x1B[32mSuccess\x1B[0m';
      const text = getTextContent(frame);
      expect(text).toBe('Success');
    });

    it('should handle undefined frame', () => {
      const text = getTextContent(undefined);
      expect(text).toBe('');
    });
  });

  describe('frameContains', () => {
    it('should find text in frame', () => {
      const frame = 'Hello world';
      expect(frameContains(frame, 'Hello')).toBe(true);
      expect(frameContains(frame, 'world')).toBe(true);
    });

    it('should be case-insensitive by default', () => {
      const frame = 'Hello World';
      expect(frameContains(frame, 'hello')).toBe(true);
      expect(frameContains(frame, 'WORLD')).toBe(true);
    });

    it('should support case-sensitive search', () => {
      const frame = 'Hello World';
      expect(frameContains(frame, 'hello', { caseSensitive: true })).toBe(false);
      expect(frameContains(frame, 'Hello', { caseSensitive: true })).toBe(true);
    });

    it('should handle undefined frame', () => {
      expect(frameContains(undefined, 'test')).toBe(false);
    });
  });

  describe('frameMatches', () => {
    it('should match regex pattern', () => {
      const frame = 'Count: 42';
      expect(frameMatches(frame, /\d+/)).toBe(true);
      expect(frameMatches(frame, /Count: \d+/)).toBe(true);
    });

    it('should return false for non-matching pattern', () => {
      const frame = 'Hello world';
      expect(frameMatches(frame, /\d+/)).toBe(false);
    });

    it('should handle undefined frame', () => {
      expect(frameMatches(undefined, /test/)).toBe(false);
    });
  });

  describe('countOccurrences', () => {
    it('should count text occurrences', () => {
      const frame = 'test test test';
      expect(countOccurrences(frame, 'test')).toBe(3);
    });

    it('should return 0 for non-existent text', () => {
      const frame = 'Hello world';
      expect(countOccurrences(frame, 'test')).toBe(0);
    });

    it('should handle undefined frame', () => {
      expect(countOccurrences(undefined, 'test')).toBe(0);
    });

    it('should handle special characters', () => {
      const frame = 'a.b.c.d';
      expect(countOccurrences(frame, '.')).toBe(3);
    });
  });

  describe('getLines', () => {
    it('should split frame into lines', () => {
      const frame = 'Line 1\nLine 2\nLine 3';
      const lines = getLines(frame);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should filter empty lines', () => {
      const frame = 'Line 1\n\nLine 2\n  \nLine 3';
      const lines = getLines(frame);
      expect(lines).toEqual(['Line 1', 'Line 2', 'Line 3']);
    });

    it('should handle undefined frame', () => {
      const lines = getLines(undefined);
      expect(lines).toEqual([]);
    });
  });

  describe('getLine', () => {
    it('should get specific line', () => {
      const frame = 'Line 1\nLine 2\nLine 3';
      expect(getLine(frame, 0)).toBe('Line 1');
      expect(getLine(frame, 1)).toBe('Line 2');
      expect(getLine(frame, 2)).toBe('Line 3');
    });

    it('should return empty string for out of bounds', () => {
      const frame = 'Line 1\nLine 2';
      expect(getLine(frame, 5)).toBe('');
    });

    it('should handle undefined frame', () => {
      expect(getLine(undefined, 0)).toBe('');
    });
  });

  describe('isEmptyFrame', () => {
    it('should detect empty frame', () => {
      expect(isEmptyFrame('')).toBe(true);
      expect(isEmptyFrame('   ')).toBe(true);
      expect(isEmptyFrame('\n\n')).toBe(true);
    });

    it('should detect non-empty frame', () => {
      expect(isEmptyFrame('Hello')).toBe(false);
      expect(isEmptyFrame('  Hello  ')).toBe(false);
    });

    it('should handle undefined frame', () => {
      expect(isEmptyFrame(undefined)).toBe(true);
    });
  });

  describe('KeyboardInput', () => {
    it('should have correct key codes', () => {
      expect(KeyboardInput.ENTER).toBe('\r');
      expect(KeyboardInput.NEWLINE).toBe('\n');
      expect(KeyboardInput.TAB).toBe('\t');
      expect(KeyboardInput.ESCAPE).toBe('\x1B');
      expect(KeyboardInput.CTRL_C).toBe('\x03');
    });

    it('should have arrow keys', () => {
      expect(KeyboardInput.ARROW_UP).toBe('\x1B[A');
      expect(KeyboardInput.ARROW_DOWN).toBe('\x1B[B');
      expect(KeyboardInput.ARROW_RIGHT).toBe('\x1B[C');
      expect(KeyboardInput.ARROW_LEFT).toBe('\x1B[D');
    });
  });

  describe('UIAssertions', () => {
    describe('assertContains', () => {
      it('should pass when text is present', () => {
        expect(() => {
          UIAssertions.assertContains('Hello world', 'Hello');
        }).not.toThrow();
      });

      it('should throw when text is missing', () => {
        expect(() => {
          UIAssertions.assertContains('Hello world', 'Goodbye');
        }).toThrow('Expected frame to contain "Goodbye"');
      });
    });

    describe('assertNotContains', () => {
      it('should pass when text is absent', () => {
        expect(() => {
          UIAssertions.assertNotContains('Hello world', 'Goodbye');
        }).not.toThrow();
      });

      it('should throw when text is present', () => {
        expect(() => {
          UIAssertions.assertNotContains('Hello world', 'Hello');
        }).toThrow('Expected frame not to contain "Hello"');
      });
    });

    describe('assertMatches', () => {
      it('should pass when pattern matches', () => {
        expect(() => {
          UIAssertions.assertMatches('Count: 42', /\d+/);
        }).not.toThrow();
      });

      it('should throw when pattern does not match', () => {
        expect(() => {
          UIAssertions.assertMatches('Hello world', /\d+/);
        }).toThrow('Expected frame to match');
      });
    });

    describe('assertNotEmpty', () => {
      it('should pass when frame has content', () => {
        expect(() => {
          UIAssertions.assertNotEmpty('Hello');
        }).not.toThrow();
      });

      it('should throw when frame is empty', () => {
        expect(() => {
          UIAssertions.assertNotEmpty('');
        }).toThrow('Expected frame not to be empty');
      });
    });

    describe('assertEmpty', () => {
      it('should pass when frame is empty', () => {
        expect(() => {
          UIAssertions.assertEmpty('');
        }).not.toThrow();
      });

      it('should throw when frame has content', () => {
        expect(() => {
          UIAssertions.assertEmpty('Hello');
        }).toThrow('Expected frame to be empty');
      });
    });

    describe('assertLineCount', () => {
      it('should pass when line count matches', () => {
        expect(() => {
          UIAssertions.assertLineCount('Line 1\nLine 2\nLine 3', 3);
        }).not.toThrow();
      });

      it('should throw when line count does not match', () => {
        expect(() => {
          UIAssertions.assertLineCount('Line 1\nLine 2', 3);
        }).toThrow('Expected 3 lines, got 2');
      });
    });

    describe('assertLineContains', () => {
      it('should pass when line contains text', () => {
        expect(() => {
          UIAssertions.assertLineContains('Line 1\nLine 2\nLine 3', 1, 'Line 2');
        }).not.toThrow();
      });

      it('should throw when line does not contain text', () => {
        expect(() => {
          UIAssertions.assertLineContains('Line 1\nLine 2\nLine 3', 1, 'Wrong');
        }).toThrow('Expected line 1 to contain "Wrong"');
      });
    });
  });

  describe('UISnapshot', () => {
    describe('normalizeFrame', () => {
      it('should remove timestamps', () => {
        const frame = 'Time: 2024-01-15T10:30:00.000Z';
        const normalized = UISnapshot.normalizeFrame(frame);
        expect(normalized).toBe('Time: <TIMESTAMP>');
      });

      it('should remove call IDs', () => {
        const frame = 'Call: call_abc123def';
        const normalized = UISnapshot.normalizeFrame(frame);
        expect(normalized).toBe('Call: <CALL_ID>');
      });

      it('should remove UUIDs', () => {
        const frame = 'ID: 550e8400-e29b-41d4-a716-446655440000';
        const normalized = UISnapshot.normalizeFrame(frame);
        expect(normalized).toBe('ID: <UUID>');
      });

      it('should remove file paths', () => {
        const frame = 'File: /path/to/file.ts';
        const normalized = UISnapshot.normalizeFrame(frame);
        expect(normalized).toBe('File: <FILE_PATH>');
      });

      it('should handle undefined frame', () => {
        const normalized = UISnapshot.normalizeFrame(undefined);
        expect(normalized).toBe('');
      });
    });

    describe('framesEqual', () => {
      it('should compare normalized frames', () => {
        const frame1 = 'Call: call_abc123def at 10:30:00';
        const frame2 = 'Call: call_xyz789ghi at 11:45:00';
        expect(UISnapshot.framesEqual(frame1, frame2)).toBe(true);
      });

      it('should detect different content', () => {
        const frame1 = 'Hello world';
        const frame2 = 'Goodbye world';
        expect(UISnapshot.framesEqual(frame1, frame2)).toBe(false);
      });
    });
  });

  describe('UIState', () => {
    describe('isLoading', () => {
      it('should detect loading text', () => {
        expect(UIState.isLoading('Loading...')).toBe(true);
        expect(UIState.isLoading('Please wait, loading')).toBe(true);
      });

      it('should detect spinner characters', () => {
        expect(UIState.isLoading('⠋ Processing')).toBe(true);
        expect(UIState.isLoading('⠙ Loading')).toBe(true);
      });

      it('should return false for non-loading state', () => {
        expect(UIState.isLoading('Ready')).toBe(false);
      });
    });

    describe('hasError', () => {
      it('should detect error text', () => {
        expect(UIState.hasError('Error: Something went wrong')).toBe(true);
        expect(UIState.hasError('❌ Failed')).toBe(true);
        expect(UIState.hasError('✗ Error')).toBe(true);
      });

      it('should return false for non-error state', () => {
        expect(UIState.hasError('Success')).toBe(false);
      });
    });

    describe('hasSuccess', () => {
      it('should detect success text', () => {
        expect(UIState.hasSuccess('Success!')).toBe(true);
        expect(UIState.hasSuccess('✓ Done')).toBe(true);
        expect(UIState.hasSuccess('✔ Complete')).toBe(true);
      });

      it('should return false for non-success state', () => {
        expect(UIState.hasSuccess('Error')).toBe(false);
      });
    });

    describe('hasWarning', () => {
      it('should detect warning text', () => {
        expect(UIState.hasWarning('Warning: Check this')).toBe(true);
        expect(UIState.hasWarning('⚠ Caution')).toBe(true);
      });

      it('should return false for non-warning state', () => {
        expect(UIState.hasWarning('Success')).toBe(false);
      });
    });
  });
});
