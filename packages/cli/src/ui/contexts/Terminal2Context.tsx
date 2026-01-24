/**
 * Terminal 2 Context
 *
 * Manages a second terminal session using node-pty + xterm.js headless.
 */

import os from 'os';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Terminal } from '@xterm/headless';
import * as pty from 'node-pty';

import type { AnsiOutput } from '../../utils/terminalSerializer.js';

interface Terminal2ContextValue {
  output: AnsiOutput;
  isRunning: boolean;
  sendCommand: (command: string) => void;
  sendRawInput: (char: string) => void;
  clear: () => void;
  interrupt: () => void;
  resize: (cols: number, rows: number) => void;
}

const Terminal2Context = createContext<Terminal2ContextValue | undefined>(undefined);

export function Terminal2Provider({ children }: { children: React.ReactNode }) {
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
      const xterm = new Terminal({
        cols: 80,
        rows: 30,
        scrollback: 1000,
        allowProposedApi: true,
      });
      xtermRef.current = xterm;

      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as { [key: string]: string },
      });

      ptyProcessRef.current = ptyProcess;
      setIsRunning(true);

      const dataDisposable = ptyProcess.onData((data) => {
        try {
          xterm.write(data, () => {
            const simpleOutput: AnsiOutput = [];
            const buffer = xterm.buffer.active;
            const totalLines = buffer.length;
            const startIndex = Math.max(0, totalLines - xterm.rows);
            for (let i = startIndex; i < totalLines; i++) {
              const line = buffer.getLine(i);
              if (line) {
                const text = line.translateToString(false);
                simpleOutput.push([{
                  text: text || ' ',
                  bold: false,
                  italic: false,
                  underline: false,
                  dim: false,
                  inverse: false,
                  fg: '',
                  bg: '',
                }]);
              }
            }
            setOutput(simpleOutput);
          });
        } catch (err) {
          console.error('Terminal 2 data processing error:', err);
        }
      });

      const exitDisposable = ptyProcess.onExit(() => {
        setIsRunning(false);
      });

      return () => {
        if (dataDisposable) {
          dataDisposable.dispose();
        }
        if (exitDisposable) {
          exitDisposable.dispose();
        }

        if (xtermRef.current) {
          xtermRef.current.dispose();
          xtermRef.current = null;
        }

        if (ptyProcessRef.current) {
          try {
            ptyProcessRef.current.kill();
          } catch (error) {
            console.warn('Failed to kill Terminal 2 PTY process:', error);
          }
        }

        ptyProcessRef.current = null;
      };
    } catch (error) {
      console.error('Failed to spawn Terminal 2:', error);
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
      ptyProcessRef.current.write('\x03');
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
    <Terminal2Context.Provider value={value}>
      {children}
    </Terminal2Context.Provider>
  );
}

export function useTerminal2() {
  const context = useContext(Terminal2Context);
  if (context === undefined) {
    throw new Error('useTerminal2 must be used within Terminal2Provider');
  }
  return context;
}
