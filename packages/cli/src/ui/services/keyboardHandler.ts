/**
 * Keyboard shortcut handler service
 * Manages keyboard shortcuts and their execution
 */

export interface KeyboardShortcut {
  key: string;
  handler: () => void | Promise<void>;
  description: string;
  context?: string; // Optional context where shortcut is active (e.g., 'docs', 'review')
}

export interface KeyInput {
  input: string;
  key: {
    upArrow?: boolean;
    downArrow?: boolean;
    leftArrow?: boolean;
    rightArrow?: boolean;
    pageUp?: boolean;
    pageDown?: boolean;
    return?: boolean;
    escape?: boolean;
    ctrl?: boolean;
    shift?: boolean;
    tab?: boolean;
    backspace?: boolean;
    delete?: boolean;
    meta?: boolean;
  };
}

export class KeyboardHandler {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private activeContext: string | null = null;

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    const normalizedKey = this.normalizeKey(shortcut.key);
    
    // Check for conflicts
    if (this.shortcuts.has(normalizedKey)) {
      const existing = this.shortcuts.get(normalizedKey)!;
      
      // Allow same key in different contexts
      if (shortcut.context !== existing.context) {
        // Store with context prefix
        const contextKey = shortcut.context 
          ? `${shortcut.context}:${normalizedKey}` 
          : normalizedKey;
        this.shortcuts.set(contextKey, shortcut);
      } else {
        // Only warn if not in a test environment
        if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
          console.warn(
            `Keyboard shortcut conflict: ${shortcut.key} is already registered. Using default.`
          );
        }
      }
    } else {
      this.shortcuts.set(normalizedKey, shortcut);
    }
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(key: string, context?: string): void {
    const normalizedKey = this.normalizeKey(key);
    const contextKey = context ? `${context}:${normalizedKey}` : normalizedKey;
    this.shortcuts.delete(contextKey);
  }

  /**
   * Set the active context for context-specific shortcuts
   */
  setContext(context: string | null): void {
    this.activeContext = context;
  }

  /**
   * Handle keyboard input from Ink's useInput
   */
  async handle(input: string, key: KeyInput['key']): Promise<boolean> {
    const keyString = this.buildKeyString(input, key);
    const normalizedKey = this.normalizeKey(keyString);

    // Try context-specific shortcut first
    if (this.activeContext) {
      const contextKey = `${this.activeContext}:${normalizedKey}`;
      const contextShortcut = this.shortcuts.get(contextKey);
      if (contextShortcut) {
        await contextShortcut.handler();
        return true;
      }
    }

    // Try global shortcut
    const shortcut = this.shortcuts.get(normalizedKey);
    if (shortcut && !shortcut.context) {
      await shortcut.handler();
      return true;
    }

    return false;
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts for a specific context
   */
  getContextShortcuts(context: string): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(
      (s) => s.context === context
    );
  }

  /**
   * Build a key string from input and key modifiers
   */
  private buildKeyString(input: string, key: KeyInput['key']): string {
    const parts: string[] = [];

    // Add modifiers
    if (key.ctrl) parts.push('ctrl');
    if (key.shift) parts.push('shift');
    if (key.meta) parts.push('meta');

    // Add key name
    if (key.return) {
      parts.push('enter');
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
    } else if (input) {
      parts.push(input.toLowerCase());
    }

    return parts.join('+');
  }

  /**
   * Normalize a key string for consistent lookup
   */
  private normalizeKey(key: string): string {
    return key
      .toLowerCase()
      .split('+')
      .map((part) => part.trim())
      .sort((a, b) => {
        // Sort modifiers first: ctrl, shift, meta, then key
        const order = ['ctrl', 'shift', 'meta'];
        const aIndex = order.indexOf(a);
        const bIndex = order.indexOf(b);
        
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return 0;
      })
      .join('+');
  }

  /**
   * Clear all shortcuts
   */
  clear(): void {
    this.shortcuts.clear();
  }
}

// Singleton instance
export const keyboardHandler = new KeyboardHandler();
