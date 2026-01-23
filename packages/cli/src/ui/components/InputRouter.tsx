/**
 * Input Router Component
 * 
 * Routes input to either LLM chat or terminal based on active window.
 * Handles left/right arrow keys for window switching.
 */

import { useState } from 'react';
import { useInput } from 'ink';

import { useWindow } from '../contexts/WindowContext.js';
import { useTerminal } from '../hooks/useTerminal.js';

interface InputRouterProps {
  onChatSubmit: (input: string) => void;
  disabled?: boolean;
}

export function InputRouter({ onChatSubmit, disabled = false }: InputRouterProps) {
  const { switchWindow, isTerminalActive } = useWindow();
  const { sendCommand, interrupt, clear } = useTerminal();
  const [input, setInput] = useState('');

  useInput((inputChar, key) => {
    if (disabled) return;

    // Handle left/right arrow keys for window switching
    if (key.leftArrow || key.rightArrow) {
      switchWindow();
      return;
    }

    // Handle Enter - submit to active window
    if (key.return) {
      if (input.trim()) {
        if (isTerminalActive) {
          sendCommand(input);
        } else {
          onChatSubmit(input);
        }
        setInput('');
      }
      return;
    }

    // Handle backspace
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    // Handle Ctrl+C in terminal mode
    if (key.ctrl && inputChar === 'c' && isTerminalActive) {
      interrupt();
      return;
    }

    // Handle Ctrl+L to clear
    if (key.ctrl && inputChar === 'l') {
      if (isTerminalActive) {
        clear();
      }
      return;
    }

    // Add character to input
    if (inputChar && !key.ctrl && !key.meta) {
      setInput(prev => prev + inputChar);
    }
  });

  return {
    input,
    setInput,
  };
}
