/**
 * Terminal Context
 * 
 * Manages a shared terminal session using node-pty + xterm.js headless
 */

import os from 'os';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pty from 'node-pty';
import { Terminal } from '@xterm/headless';

import { serializeTerminalToObject, type AnsiOutput } from '../../utils/terminalSerializer.js';

interface TerminalContextValue {
  output: AnsiOutput;
  isRunning: boolean;
  sendCommand: (command: string) => void;
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
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    
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
      const ptyProcess = pty.spawn(shell, [], {
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
          xterm.write(data);
          
          // Simple approach: Just extract all lines from buffer
          const simpleOutput: AnsiOutput = [];
          for (let i = 0; i < xterm.rows; i++) {
            const line = xterm.buffer.active.getLine(i);
            if (line) {
              const text = line.translateToString(false); // false = don't trim
              // Always add the line, even if empty
              simpleOutput.push([{ 
                text: text || ' ', 
                bold: false, 
                italic: false, 
                underline: false, 
                dim: false, 
                inverse: false, 
                fg: '', 
                bg: '' 
              }]);
            }
          }
          
          setOutput(simpleOutput);
        } catch (err) {
          console.error('Terminal data processing error:', err);
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
            console.warn('Failed to kill PTY process:', error);
          }
        }
        
        // Clear ref
        ptyProcessRef.current = null;
      };
    } catch (error) {
      console.error('Failed to spawn terminal:', error);
      setIsRunning(false);
      return () => {};
    }
  }, []);

  const sendCommand = useCallback((command: string) => {
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write(command + '\r');
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
      } catch (err) {
        // Silently fail
      }
    }
    
    if (ptyProcessRef.current && isRunning) {
      try {
        ptyProcessRef.current.resize(safeCols, safeRows);
      } catch (err) {
        // Silently fail
      }
    }
  }, [isRunning]);

  const value = useMemo(() => ({
    output,
    isRunning,
    sendCommand,
    clear,
    interrupt,
    resize,
  }), [output, isRunning, sendCommand, clear, interrupt, resize]);

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
