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
    primary: '#3e3e42',
    secondary: '#007acc',
    active: 'green',
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
 * Keyboard input simulation helpers.
 */
export const KeyboardInput = {
  ENTER: '\r',
  NEWLINE: '\n',
  TAB: '\t',
  ESCAPE: '\x1B',
  BACKSPACE: '\x7F',
  DELETE: '\x1B[3~',
  ARROW_UP: '\x1B[A',
  ARROW_DOWN: '\x1B[B',
  ARROW_RIGHT: '\x1B[C',
  ARROW_LEFT: '\x1B[D',
  CTRL_C: '\x03',
  CTRL_D: '\x04',
  CTRL_Z: '\x1A',
};

/**
 * Strip ANSI escape codes from a string.
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

/**
 * Extract text content from a rendered frame.
 */
export function getTextContent(frame: string | undefined): string {
  if (!frame) return '';
  return stripAnsi(frame);
}
