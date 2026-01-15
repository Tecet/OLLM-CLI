/**
 * UI Test Helpers for Ink Component Testing
 * 
 * This module provides utilities for testing Ink components with React 19.
 * It includes helpers for rendering components, simulating user input,
 * and asserting on UI output.
 */

import type { ReactElement, ReactNode } from 'react';

/**
 * Strip ANSI escape codes from a string for easier assertions.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Extract text content from a rendered frame, removing ANSI codes.
 */
export function getTextContent(frame: string | undefined): string {
  if (!frame) return '';
  return stripAnsi(frame);
}

/**
 * Check if a frame contains specific text (case-insensitive by default).
 */
export function frameContains(
  frame: string | undefined,
  text: string,
  options: { caseSensitive?: boolean } = {}
): boolean {
  if (!frame) return false;
  const content = getTextContent(frame);
  const searchText = options.caseSensitive ? text : text.toLowerCase();
  const searchContent = options.caseSensitive ? content : content.toLowerCase();
  return searchContent.includes(searchText);
}

/**
 * Check if a frame matches a regular expression.
 */
export function frameMatches(frame: string | undefined, pattern: RegExp): boolean {
  if (!frame) return false;
  const content = getTextContent(frame);
  return pattern.test(content);
}

/**
 * Count occurrences of text in a frame.
 */
export function countOccurrences(frame: string | undefined, text: string): number {
  if (!frame) return 0;
  const content = getTextContent(frame);
  const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * Extract lines from a frame.
 */
export function getLines(frame: string | undefined): string[] {
  if (!frame) return [];
  const content = getTextContent(frame);
  return content.split('\n').filter((line) => line.trim().length > 0);
}

/**
 * Get a specific line from a frame (0-indexed).
 */
export function getLine(frame: string | undefined, lineNumber: number): string {
  const lines = getLines(frame);
  return lines[lineNumber] || '';
}

/**
 * Check if frame is empty or contains only whitespace.
 */
export function isEmptyFrame(frame: string | undefined): boolean {
  if (!frame) return true;
  const content = getTextContent(frame);
  return content.trim().length === 0;
}

/**
 * Keyboard input simulation helpers.
 */
export const KeyboardInput = {
  /**
   * Enter key (carriage return).
   */
  ENTER: '\r',
  
  /**
   * Newline (line feed).
   */
  NEWLINE: '\n',
  
  /**
   * Tab key.
   */
  TAB: '\t',
  
  /**
   * Escape key.
   */
  ESCAPE: '\x1B',
  
  /**
   * Backspace key.
   */
  BACKSPACE: '\x7F',
  
  /**
   * Delete key.
   */
  DELETE: '\x1B[3~',
  
  /**
   * Arrow up.
   */
  ARROW_UP: '\x1B[A',
  
  /**
   * Arrow down.
   */
  ARROW_DOWN: '\x1B[B',
  
  /**
   * Arrow right.
   */
  ARROW_RIGHT: '\x1B[C',
  
  /**
   * Arrow left.
   */
  ARROW_LEFT: '\x1B[D',
  
  /**
   * Ctrl+C (interrupt).
   */
  CTRL_C: '\x03',
  
  /**
   * Ctrl+D (end of transmission).
   */
  CTRL_D: '\x04',
  
  /**
   * Ctrl+Z (suspend).
   */
  CTRL_Z: '\x1A',
  
  /**
   * Home key.
   */
  HOME: '\x1B[H',
  
  /**
   * End key.
   */
  END: '\x1B[F',
  
  /**
   * Page up.
   */
  PAGE_UP: '\x1B[5~',
  
  /**
   * Page down.
   */
  PAGE_DOWN: '\x1B[6~',
};

/**
 * Simulate typing text character by character.
 */
export function typeText(stdin: { write: (data: string) => void }, text: string): void {
  for (const char of text) {
    stdin.write(char);
  }
}

/**
 * Simulate typing text and pressing Enter.
 */
export function typeAndSubmit(stdin: { write: (data: string) => void }, text: string): void {
  typeText(stdin, text);
  stdin.write(KeyboardInput.ENTER);
}

/**
 * Wait for a condition to be true with timeout.
 */
export async function waitForCondition(
  condition: () => boolean,
  options: { timeout?: number; interval?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100, message = 'Condition not met' } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`${message} within ${timeout}ms`);
}

/**
 * Wait for frame to contain specific text.
 */
export async function waitForText(
  getFrame: () => string | undefined,
  text: string,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  await waitForCondition(
    () => frameContains(getFrame(), text),
    {
      ...options,
      message: `Frame did not contain "${text}"`,
    }
  );
}

/**
 * Wait for frame to match a pattern.
 */
export async function waitForPattern(
  getFrame: () => string | undefined,
  pattern: RegExp,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  await waitForCondition(
    () => frameMatches(getFrame(), pattern),
    {
      ...options,
      message: `Frame did not match pattern ${pattern}`,
    }
  );
}

/**
 * Wait for frame to update (change from current value).
 */
export async function waitForFrameUpdate(
  getFrame: () => string | undefined,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const initialFrame = getFrame();
  await waitForCondition(
    () => getFrame() !== initialFrame,
    {
      ...options,
      message: 'Frame did not update',
    }
  );
}

/**
 * Mock theme for testing UI components.
 */
export const mockTheme = {
  name: 'test-theme',
  text: {
    primary: '#d4d4d4',
    secondary: '#858585',
    accent: '#4ec9b0',
    error: '#f48771',
    warning: '#dcdcaa',
    success: '#4ec9b0',
    muted: '#6a6a6a',
  },
  bg: {
    primary: '#1e1e1e',
    secondary: '#252526',
    tertiary: '#2d2d30',
    highlight: '#2a2d2e',
  },
  border: {
    default: '#3e3e42',
    active: '#007acc',
  },
  status: {
    success: '#4ec9b0',
    warning: '#dcdcaa',
    error: '#f48771',
    info: '#569cd6',
  },
  role: {
    user: '#4fc3f7',
    assistant: '#81c784',
    system: '#ffb74d',
    tool: '#ce93d8',
  },
  diff: {
    added: '#4ec9b0',
    removed: '#f48771',
  },
};

/**
 * Mock keybinds for testing UI components.
 */
export const mockKeybinds = {
  send: 'return',
  newline: 'shift+return',
  editPrevious: 'up',
  cancel: 'ctrl+c',
  clear: 'ctrl+l',
  help: 'ctrl+h',
  quit: 'ctrl+q',
};

/**
 * Create a test wrapper component that provides common context providers.
 * This is a type-safe helper that can be used with any context providers.
 * 
 * Note: This function returns a component factory. Use it in your test files
 * which should be .tsx files to support JSX syntax.
 * 
 * Example:
 * ```tsx
 * const TestWrapper = createTestWrapper([
 *   { Provider: UIProvider },
 *   { Provider: ChatProvider }
 * ]);
 * 
 * render(<TestWrapper><MyComponent /></TestWrapper>);
 * ```
 */
export function createTestWrapper(
  providers: Array<{ Provider: unknown; props?: Record<string, unknown> }>
): unknown {
  // Return a function that can be used as a React component
  // The actual JSX will be in the test files (.tsx)
  return function TestWrapper({ children }: { children: ReactNode }) {
    // This will be implemented in the consuming .tsx file
    // We provide the structure here for type safety
    return children;
  };
}

/**
 * Assertion helpers for UI testing.
 */
export const UIAssertions = {
  /**
   * Assert that a frame contains specific text.
   */
  assertContains(frame: string | undefined, text: string, message?: string): void {
    if (!frameContains(frame, text)) {
      const content = getTextContent(frame);
      throw new Error(
        message || `Expected frame to contain "${text}"\nActual content:\n${content}`
      );
    }
  },

  /**
   * Assert that a frame does not contain specific text.
   */
  assertNotContains(frame: string | undefined, text: string, message?: string): void {
    if (frameContains(frame, text)) {
      const content = getTextContent(frame);
      throw new Error(
        message || `Expected frame not to contain "${text}"\nActual content:\n${content}`
      );
    }
  },

  /**
   * Assert that a frame matches a pattern.
   */
  assertMatches(frame: string | undefined, pattern: RegExp, message?: string): void {
    if (!frameMatches(frame, pattern)) {
      const content = getTextContent(frame);
      throw new Error(
        message || `Expected frame to match ${pattern}\nActual content:\n${content}`
      );
    }
  },

  /**
   * Assert that a frame is not empty.
   */
  assertNotEmpty(frame: string | undefined, message?: string): void {
    if (isEmptyFrame(frame)) {
      throw new Error(message || 'Expected frame not to be empty');
    }
  },

  /**
   * Assert that a frame is empty.
   */
  assertEmpty(frame: string | undefined, message?: string): void {
    if (!isEmptyFrame(frame)) {
      const content = getTextContent(frame);
      throw new Error(message || `Expected frame to be empty\nActual content:\n${content}`);
    }
  },

  /**
   * Assert that a frame has a specific number of lines.
   */
  assertLineCount(frame: string | undefined, count: number, message?: string): void {
    const lines = getLines(frame);
    if (lines.length !== count) {
      throw new Error(
        message ||
          `Expected ${count} lines, got ${lines.length}\nLines:\n${lines.join('\n')}`
      );
    }
  },

  /**
   * Assert that a specific line contains text.
   */
  assertLineContains(
    frame: string | undefined,
    lineNumber: number,
    text: string,
    message?: string
  ): void {
    const line = getLine(frame, lineNumber);
    if (!line.includes(text)) {
      throw new Error(
        message || `Expected line ${lineNumber} to contain "${text}"\nActual line: ${line}`
      );
    }
  },
};

/**
 * Performance measurement helpers for UI tests.
 */
export const UIPerformance = {
  /**
   * Measure render time of a component.
   */
  async measureRenderTime<T>(fn: () => T | Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },

  /**
   * Assert that render time is within acceptable limits.
   */
  assertRenderSpeed(duration: number, maxMs: number, componentName: string): void {
    if (duration > maxMs) {
      throw new Error(
        `Component "${componentName}" took ${duration.toFixed(2)}ms to render, exceeding limit of ${maxMs}ms`
      );
    }
  },
};

/**
 * Snapshot testing helpers.
 */
export const UISnapshot = {
  /**
   * Normalize a frame for snapshot testing (remove timestamps, IDs, etc.).
   */
  normalizeFrame(frame: string | undefined): string {
    if (!frame) return '';
    
    let normalized = getTextContent(frame);
    
    // Remove timestamps (various formats)
    normalized = normalized.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<TIMESTAMP>');
    normalized = normalized.replace(/\d{2}:\d{2}:\d{2}/g, '<TIME>');
    
    // Remove IDs (call_xxx, uuid-like patterns)
    normalized = normalized.replace(/call_[a-z0-9]{9}/g, '<CALL_ID>');
    normalized = normalized.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>');
    
    // Remove file paths (absolute paths)
    normalized = normalized.replace(/\/[^\s]+\.(ts|tsx|js|jsx)/g, '<FILE_PATH>');
    
    // Normalize whitespace
    normalized = normalized.replace(/\s+$/gm, ''); // Remove trailing whitespace
    
    return normalized;
  },

  /**
   * Compare two frames for equality (ignoring dynamic content).
   */
  framesEqual(frame1: string | undefined, frame2: string | undefined): boolean {
    return this.normalizeFrame(frame1) === this.normalizeFrame(frame2);
  },
};

/**
 * Component state helpers.
 */
export const UIState = {
  /**
   * Check if a component is in loading state.
   */
  isLoading(frame: string | undefined): boolean {
    return frameContains(frame, 'loading') || frameMatches(frame, /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  },

  /**
   * Check if a component shows an error.
   */
  hasError(frame: string | undefined): boolean {
    return frameContains(frame, 'error') || frameContains(frame, '❌') || frameContains(frame, '✗');
  },

  /**
   * Check if a component shows success.
   */
  hasSuccess(frame: string | undefined): boolean {
    return frameContains(frame, 'success') || frameContains(frame, '✓') || frameContains(frame, '✔');
  },

  /**
   * Check if a component shows a warning.
   */
  hasWarning(frame: string | undefined): boolean {
    return frameContains(frame, 'warning') || frameContains(frame, '⚠');
  },
};

/**
 * Export all helpers as a single namespace for convenience.
 */
export const UITestHelpers = {
  stripAnsi,
  getTextContent,
  frameContains,
  frameMatches,
  countOccurrences,
  getLines,
  getLine,
  isEmptyFrame,
  KeyboardInput,
  typeText,
  typeAndSubmit,
  waitForCondition,
  waitForText,
  waitForPattern,
  waitForFrameUpdate,
  mockTheme,
  mockKeybinds,
  createTestWrapper,
  ...UIAssertions,
  ...UIPerformance,
  ...UISnapshot,
  ...UIState,
};
