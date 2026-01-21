import { useState, useEffect, useRef } from 'react';
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

export function useMouse(onMouse: (event: MouseEvent) => void) {
  const { stdin, isRawModeSupported, setRawMode } = useStdin();
  const isEnabled = useRef(false);

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
    const handleData = (data: Buffer) => {
      const input = data.toString();
      
      // Check for SGR mouse sequence: \x1b[<button;x;yM (or m)
      const mouseRegex = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/;
      const match = input.match(mouseRegex);

      if (match) {
        const rawButton = parseInt(match[1], 10);
        const x = parseInt(match[2], 10);
        const y = parseInt(match[3], 10);
        const type = match[4]; // M = down/scroll, m = up

        let action: MouseAction = 'move';
        let button: MouseButton = 'none';
        
        // Decode button/action
        // 0: Left, 1: Middle, 2: Right
        // +4: Shift, +8: Alt, +16: Ctrl
        // +32: Drag
        // +64: Scroll
        
        let mod = rawButton;
        const scroll = (mod & 64) === 64;
        mod &= ~64;
        const drag = (mod & 32) === 32;
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
          button = 'none'; // Scroll doesn't really have a button in this context
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

        onMouse({
          x,
          y,
          action,
          button,
          shift,
          alt,
          ctrl
        });
      }
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin, onMouse]);
}
