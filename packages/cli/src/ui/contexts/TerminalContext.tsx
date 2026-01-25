/**
 * Terminal Context
 * 
 * Manages a shared terminal session using node-pty + xterm.js headless
 */

import os from 'os';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/headless';
import * as pty from 'node-pty';

import { createLogger } from '../../../../core/src/utils/logger.js';
import { serializeTerminalRange } from '../../utils/terminalSerializer.js';

import type { AnsiOutput } from '../../utils/terminalSerializer.js';

const logger = createLogger('TerminalContext');

interface TerminalContextValue {
  output: AnsiOutput;
  isRunning: boolean;
  sendCommand: (command: string) => void;
  sendRawInput: (char: string) => void;
  clear: () => void;
  interrupt: () => void;
  resize: (cols: number, rows: number) => void;
}

const TerminalContext = createContext<TerminalContextValue | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [output, setOutput] = useState<AnsiOutput>([]);
  const [isRunning, setIsRunning] = useState(false);
  const ptyProcessRef = useRef<pty.IPty | null>(null);
  const xtermRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'powershell.exe' : 'bash';
    const shellArgs = isWindows
      ? ['-NoProfile', '-NoLogo', '-NoExit', '-Command', 'Set-PSReadLineOption -PredictionSource None']
      : [];
    
    try {
      // Create xterm.js headless terminal
      const xterm = new Terminal({
        cols: 80,
        rows: 30,
        scrollback: 1000,
        allowProposedApi: true, // Required for buffer access
      });
      xtermRef.current = xterm;

      // Create PTY process
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as { [key: string]: string },
      });

      ptyProcessRef.current = ptyProcess;
      setIsRunning(true);

      // Pipe PTY output to xterm (xterm parses ANSI codes)
      const dataDisposable = ptyProcess.onData((data) => {
        try {
          xterm.write(data, () => {
            const buffer = xterm.buffer.active;
            // Use the terminal's viewportY to align with serializeTerminalRange expectations
            const viewportY = (buffer as any).viewportY ?? 0;
            const totalLines = buffer.length;
            const startIndex = Math.max(0, viewportY);
            const serialized = serializeTerminalRange(xterm, startIndex, xterm.rows);

            // Emit lightweight debug info to help diagnose missing input artefacts
            try {
              const lastLine = serialized[serialized.length - 1] || [];
              const lastText = lastLine.map(t => t.text).join('');
              logger.debug('PTY data chunk length=%d, viewportY=%d, totalLines=%d, startIndex=%d, lastLineLen=%d', data.length, viewportY, totalLines, startIndex, lastText.length);
            } catch (_e) {
              // ignore logging errors
            }

            setOutput(serialized);
          });
        } catch (err) {
          logger.error('Terminal data processing error:', err);
        }
      });

      const exitDisposable = ptyProcess.onExit(() => {
        setIsRunning(false);
      });

      return () => {
        // Dispose event listeners first
        if (dataDisposable) {
          dataDisposable.dispose();
        }
        if (exitDisposable) {
          exitDisposable.dispose();
        }
        
        // Dispose xterm
        if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
        }
        
        // Then kill the process
        if (ptyProcessRef.current) {
          try {
            ptyProcessRef.current.kill();
          } catch (error) {
            logger.warn('Failed to kill PTY process:', error);
          }
        }
        
        // Clear ref
        ptyProcessRef.current = null;
      };
    } catch (error) {
      logger.error('Failed to spawn terminal:', error);
      setIsRunning(false);
      return () => {};
    }
  }, []);

  const sendCommand = useCallback((command: string) => {
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write(command + '\r');
    }
  }, [isRunning]);

  const sendRawInput = useCallback((char: string) => {
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write(char);
    }
  }, [isRunning]);

  const clear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      setOutput([]);
    }
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write('clear\r');
    }
  }, [isRunning]);

  const interrupt = useCallback(() => {
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write('\x03'); // Ctrl+C
    }
  }, [isRunning]);

  const resize = useCallback((cols: number, rows: number) => {
    const safeRows = Math.max(1, rows);
    const safeCols = Math.max(1, cols);
    
    if (xtermRef.current) {
      try {
        xtermRef.current.resize(safeCols, safeRows);
      } catch (_err) {
        // Silently fail
      }
    }
    
    if (ptyProcessRef.current && isRunning) {
      try {
        ptyProcessRef.current.resize(safeCols, safeRows);
      } catch (_err) {
        // Silently fail
      }
    }
  }, [isRunning]);

  const value = useMemo(() => ({
    output,
    isRunning,
    sendCommand,
    sendRawInput,
    clear,
    interrupt,
    resize,
  }), [output, isRunning, sendCommand, sendRawInput, clear, interrupt, resize]);

  return (
    <TerminalContext.Provider value={value}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
