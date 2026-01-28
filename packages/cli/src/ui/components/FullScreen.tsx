/**
 * FullScreen component - Uses alternate screen buffer for flicker-free rendering
 *
 * This component switches to the terminal's alternate screen buffer (like vim/htop)
 * which eliminates flickering during re-renders. The alternate buffer is a separate
 * screen that doesn't affect the main terminal scrollback.
 *
 * ANSI escape codes:
 * - \x1b[?1049h - Enter alternate screen buffer
 * - \x1b[?1049l - Leave alternate screen buffer
 */
import React, { useEffect, ReactNode } from 'react';

import {
  enterAlternateScreen,
  exitAlternateScreen,
  hideCursor as hideCursorFn,
  showCursor as showCursorFn,
  enableBracketedPasteMode,
  disableBracketedPasteMode,
} from '../../utils/terminal.js';

export interface FullScreenProps {
  children: ReactNode;
  /** Whether to hide the cursor (default: false) */
  hideCursor?: boolean;
}

/**
 * Wraps children in an alternate screen buffer for flicker-free full-screen rendering.
 * Automatically cleans up on unmount to restore the terminal to its original state.
 */
export function FullScreen({ children, hideCursor = false }: FullScreenProps) {
  useEffect(() => {
    // Enter alternate screen buffer
    enterAlternateScreen();
    // Enable bracketed paste mode so pasted blocks are delimited
    try {
      enableBracketedPasteMode();
    } catch (_e) {
      // best-effort
    }

    if (hideCursor) {
      hideCursorFn();
    }

    // Cleanup: restore terminal state on unmount or crash
    const cleanup = () => {
      if (hideCursor) {
        showCursorFn();
      }
      // Disable bracketed paste on cleanup
      try {
        disableBracketedPasteMode();
      } catch (_e) {
        // best-effort
      }
      exitAlternateScreen();
    };

    // Handle process exit to ensure cleanup. Use named handlers so we can remove them later.
    const handleExit = () => cleanup();
    const handleSigint = () => {
      cleanup();
      process.exit(0);
    };
    const handleSigterm = () => {
      cleanup();
      process.exit(0);
    };

    process.on('exit', handleExit);
    process.on('SIGINT', handleSigint);
    process.on('SIGTERM', handleSigterm);

    return () => {
      cleanup();
      process.removeListener('exit', handleExit);
      process.removeListener('SIGINT', handleSigint);
      process.removeListener('SIGTERM', handleSigterm);
    };
  }, [hideCursor]);

  return <>{children}</>;
}

export default FullScreen;
