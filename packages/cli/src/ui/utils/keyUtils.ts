import { Key } from 'ink';

/**
 * Normalizes a keybind string for comparison.
 * Removes spaces and converts to lowercase.
 */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, '');
}

/**
 * Checks if an Ink input event matches a configured keybind string.
 * Supports modifiers like "ctrl+c", "shift+enter", "meta+s".
 * 
 * @param input The raw input string from Ink
 * @param key The Key object from Ink containing modifiers and special keys
 * @param configKey The configured keybind string to match against (e.g. "ctrl+s")
 */
export function isKey(input: string, key: Key, configKey: string | undefined): boolean {
  if (!configKey) return false;

  const parts: string[] = [];

  // Add modifiers in a consistent order
  if (key.ctrl) parts.push('ctrl');
  if (key.meta) parts.push('meta'); // 'meta' corresponds to Alt/Option usually in terminals, or Command on Mac
  if (key.shift) parts.push('shift');

  // Add the main key
  if (key.return) {
    parts.push('return'); // We use 'return' in config for Enter
  } else if (key.escape) {
    parts.push('escape');
  } else if (key.tab) {
    parts.push('tab');
  } else if (key.backspace) {
    parts.push('backspace');
  } else if (key.delete) {
    parts.push('delete');
  } else if (key.upArrow) {
    parts.push('up');
  } else if (key.downArrow) {
    parts.push('down');
  } else if (key.leftArrow) {
    parts.push('left');
  } else if (key.rightArrow) {
    parts.push('right');
  } else if (key.pageUp) {
    parts.push('pageup');
  } else if (key.pageDown) {
    parts.push('pagedown');
  } else {
    // Regular character
    if (input) {
      parts.push(input.toLowerCase());
    }
  }

  const inputKeyString = parts.join('+');
  return normalizeKey(inputKeyString) === normalizeKey(configKey);
}
