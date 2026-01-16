import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useContextManager } from './ContextManagerContext.js';

interface ActiveContextState {
  activeSkills: string[];
  activeTools: string[];
  activeHooks: string[];
  activeMcpServers: string[];
  activePrompts: string[];
  currentPersona: string;
  contextStrategy: 'Standard' | 'Hot Swap';
}

interface ActiveContextContextType extends ActiveContextState {
  updateContextState: (newState: Partial<ActiveContextState>) => void;
}

interface DataEvent {
  skills?: string[];
  tools?: string[];
  hooks?: string[];
  servers?: string[];
}

const ActiveContextContext = createContext<ActiveContextContextType | undefined>(undefined);

export const ActiveContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use the correct hook which returns { state, actions }
  const { actions } = useContextManager();
  
  const [state, setState] = useState<ActiveContextState>({
    activeSkills: [],
    activeTools: [],
    activeHooks: [],
    activeMcpServers: [],
    activePrompts: [],
    currentPersona: 'Standard CLI Agent',
    contextStrategy: 'Standard'
  });

  useEffect(() => {
    // Listen for events from ContextManager
    const handleClear = () => {
       setState(prev => ({ 
           ...prev, 
           activeSkills: [], 
           activeTools: [],
           activeHooks: [],
           activeMcpServers: [],
           activePrompts: [],
           contextStrategy: 'Standard' 
       }));
    };

    // Assuming ContextManagerContext exposes 'on' which wires to the internal emitter
    if (actions.on) {
        actions.on('active-skills-updated', (data: unknown) => {
            const d = data as DataEvent;
            setState(prev => ({ ...prev, activeSkills: d.skills || [], contextStrategy: 'Hot Swap' }));
        });
        actions.on('active-tools-updated', (data: unknown) => {
            const d = data as DataEvent;
            setState(prev => ({ ...prev, activeTools: d.tools || [] }));
        });
        actions.on('active-hooks-updated', (data: unknown) => {
            const d = data as DataEvent;
            setState(prev => ({ ...prev, activeHooks: d.hooks || [] }));
        });
        actions.on('active-mcp-updated', (data: unknown) => {
            const d = data as DataEvent;
            setState(prev => ({ ...prev, activeMcpServers: d.servers || [] }));
        });
        actions.on('cleared', handleClear);
    }

    return () => {
      if (actions.off) {
          actions.off('active-skills-updated', () => {});
          actions.off('active-tools-updated', () => {});
          actions.off('active-hooks-updated', () => {});
          actions.off('active-mcp-updated', () => {});
          actions.off('cleared', handleClear);
      }
    };
  }, [actions]);

  const updateContextState = (newState: Partial<ActiveContextState>) => {
    setState(prev => ({ ...prev, ...newState }));
  };

  return (
    <ActiveContextContext.Provider value={{ ...state, updateContextState }}>
      {children}
    </ActiveContextContext.Provider>
  );
};

export const useActiveContext = () => {
  const context = useContext(ActiveContextContext);
  if (context === undefined) {
    throw new Error('useActiveContext must be used within an ActiveContextProvider');
  }
  return context;
};
