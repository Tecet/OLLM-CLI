import React, { useEffect, useRef, createContext, useContext, useCallback, ReactNode } from 'react';
import { useStdin } from 'ink';

import { enableMouseEvents, disableMouseEvents } from '../../utils/terminal.js';

export type MouseAction = 'down' | 'up' | 'scroll-up' | 'scroll-down' | 'move';
export type MouseButton = 'left' | 'middle' | 'right' | 'none';

export interface MouseEvent {
  x: number;
  y: number;
  action: MouseAction;
  button: MouseButton;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

type MouseHandler = (event: MouseEvent) => void;

interface MouseContextType {
  subscribe: (handler: MouseHandler) => () => void;
}

const MouseContext = createContext<MouseContextType | null>(null);

interface MouseProviderProps {
  children: ReactNode;
}

export function MouseProvider({ children }: MouseProviderProps): React.ReactElement {
  const { stdin, isRawModeSupported, setRawMode } = useStdin();
  const isEnabled = useRef(false);
  const listenersRef = useRef<Set<MouseHandler>>(new Set());

  // Subscribe mechanism
  const subscribe = useCallback((handler: MouseHandler) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (isRawModeSupported) {
      setRawMode(true);
      enableMouseEvents(); 
      isEnabled.current = true;
    }

    return () => {
      if (isEnabled.current) {
        disableMouseEvents();
        isEnabled.current = false;
      }
    };
  }, [isRawModeSupported, setRawMode]);

  useEffect(() => {
    if (!stdin) return;
    
    const handleData = (data: Buffer) => {
      const input = data.toString();
      
      // Check for SGR mouse sequence: \\x1b[<button;x;yM (or m)
      const mouseRegex = /\\x1b\[<(\d+);(\d+);(\d+)([Mm])/;
      const match = input.match(mouseRegex);

      if (match) {
        const rawButton = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const type = match[4]; // M = down/scroll, m = up

        let action: MouseAction = 'move';
        let button: MouseButton = 'none';
        
        // Decode button/action
        let mod = rawButton;
        const scroll = (mod & 64) === 64;
        mod &= ~64;
        const _drag = (mod & 32) === 32;
        mod &= ~32;
        const ctrl = (mod & 16) === 16;
        mod &= ~16;
        const alt = (mod & 8) === 8;
        mod &= ~8;
        const shift = (mod & 4) === 4;
        mod &= ~4;
        
        const btnCode = mod;

        if (scroll) {
          action = btnCode === 0 ? 'scroll-up' : 'scroll-down';
          button = 'none'; 
        } else {
          if (type === 'M') {
            action = 'down';
          } else {
            action = 'up';
          }

          if (btnCode === 0) button = 'left';
          else if (btnCode === 1) button = 'middle';
          else if (btnCode === 2) button = 'right';
        }

        const event: MouseEvent = {
          x,
          y,
          action,
          button,
          shift,
          alt,
          ctrl
        };

        // Notify listeners
        listenersRef.current.forEach(listener => listener(event));
      }
    };

    stdin.on('data', handleData);

    return () => {
      // Use removeListener instead of off for better compatibility
      stdin.removeListener('data', handleData);
    };
  }, [stdin]);

  return (
    <MouseContext.Provider value={{ subscribe }}>
      {children}
    </MouseContext.Provider>
  );
}

export function useMouse(onMouse: (event: MouseEvent) => void) {
  const context = useContext(MouseContext);
  
  useEffect(() => {
    if (!context) return;
    return context.subscribe(onMouse);
  }, [context, onMouse]);

  // Fallback if used outside provider (mostly for testing or isolated components)
  // We can't easily hook into stdin here without duplicating the provider logic.
  // So we just warn or do nothing.
  useEffect(() => {
    if (!context) {
      console.warn('useMouse used outside MouseProvider - mouse events will not work');
    }
  }, [context]);
}
