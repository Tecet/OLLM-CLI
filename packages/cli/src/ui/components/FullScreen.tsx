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
    
    if (hideCursor) {
      hideCursorFn();
    }

    // Cleanup: restore terminal state on unmount or crash
    const cleanup = () => {
      if (hideCursor) {
        showCursorFn();
      }
      exitAlternateScreen();
    };

    // Handle process exit to ensure cleanup
    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(0);
    });

    return () => {
      cleanup();
      process.removeListener('exit', cleanup);
    };
  }, [hideCursor]);

  return <>{children}</>;
}

export default FullScreen;
