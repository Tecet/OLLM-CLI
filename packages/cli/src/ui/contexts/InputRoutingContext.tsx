import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type InputDestination = 'llm' | 'editor' | 'terminal1' | 'terminal2';
export type InputMode = 'line-buffered' | 'raw' | 'disabled';

interface InputRoutingContextValue {
  activeDestination: InputDestination;
  setActiveDestination: (dest: InputDestination) => void;
  cycleDestination: (direction: 'next' | 'prev') => void;
  inputMode: InputMode;
}

const InputRoutingContext = createContext<InputRoutingContextValue | undefined>(undefined);

export function InputRoutingProvider({ children }: { children: React.ReactNode }) {
  const [activeDestination, setActiveDestination] = useState<InputDestination>('llm');

  const inputMode = useMemo<InputMode>(() => {
    if (activeDestination === 'editor') return 'disabled';
    if (activeDestination === 'terminal1' || activeDestination === 'terminal2') return 'raw';
    return 'line-buffered';
  }, [activeDestination]);

  const cycleDestination = useCallback((direction: 'next' | 'prev') => {
    const destinations: InputDestination[] = ['llm', 'editor', 'terminal1', 'terminal2'];
    const currentIndex = destinations.indexOf(activeDestination);
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % destinations.length
      : (currentIndex - 1 + destinations.length) % destinations.length;
    setActiveDestination(destinations[nextIndex]);
  }, [activeDestination]);

  const value = useMemo(() => ({
    activeDestination,
    setActiveDestination,
    cycleDestination,
    inputMode,
  }), [activeDestination, cycleDestination, inputMode]);

  return (
    <InputRoutingContext.Provider value={value}>
      {children}
    </InputRoutingContext.Provider>
  );
}

export function useInputRouting() {
  const context = useContext(InputRoutingContext);
  if (!context) {
    throw new Error('useInputRouting must be used within InputRoutingProvider');
  }
  return context;
}
