/**
 * Terminal Context
 * 
 * Manages a shared terminal session using node-pty
 */

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pty from 'node-pty';
import os from 'os';

export interface TerminalLine {
  text: string;
  timestamp: number;
}

interface TerminalContextValue {
  output: TerminalLine[];
  isRunning: boolean;
  sendCommand: (command: string) => void;
  clear: () => void;
  interrupt: () => void;
  resize: (cols: number, rows: number) => void;
  rawOutput: string[];
}

const TerminalContext = createContext<TerminalContextValue | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const [output, setOutput] = useState<TerminalLine[]>([]);
  const [rawOutput, setRawOutput] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const ptyProcessRef = useRef<pty.IPty | null>(null);

  useEffect(() => {
    const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    
    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.cwd(),
        env: process.env as { [key: string]: string },
      });

      ptyProcessRef.current = ptyProcess;
      setIsRunning(true);

      // Store disposables for cleanup
      const dataDisposable = ptyProcess.onData((data) => {
        setRawOutput(prev => [...prev.slice(-1000), data]);
        setOutput(prev => {
          const newOutput = [...prev, {
            text: data,
            timestamp: Date.now(),
          }];
          return newOutput.slice(-500); // Keep last 500 chunks
        });
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
        
        // Then kill the process
        if (ptyProcessRef.current) {
          try {
            ptyProcessRef.current.kill();
          } catch (error) {
            // Process may already be dead
            console.warn('Failed to kill PTY process:', error);
          }
        }
        
        // Clear ref
        ptyProcessRef.current = null;
      };
    } catch (error) {
      console.error('Failed to spawn terminal:', error);
      return () => {};
    }
  }, []);

  const sendCommand = useCallback((command: string) => {
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write(command + '\r');
    }
  }, [isRunning]);

  const clear = useCallback(() => {
    setOutput([]);
    setRawOutput([]);
    if (ptyProcessRef.current && isRunning) {
      // Send a sequence to clear the physical terminal screen if supported
      ptyProcessRef.current.write('clear\r');
    }
  }, [isRunning]);

  const interrupt = useCallback(() => {
    if (ptyProcessRef.current && isRunning) {
      ptyProcessRef.current.write('\x03'); // Ctrl+C
    }
  }, [isRunning]);

  const resize = useCallback((cols: number, rows: number) => {
    if (ptyProcessRef.current && isRunning) {
      try {
        ptyProcessRef.current.resize(Math.max(1, cols), Math.max(1, rows));
      } catch (_err) {
        // Silently fail if resize is called on a dead process
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
    rawOutput
  }), [output, isRunning, sendCommand, clear, interrupt, resize, rawOutput]);

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
