import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useContextManager } from './ContextManagerContext.js';
import type { ModeType } from '@ollm/ollm-cli-core';

interface ActiveContextState {
  activeSkills: string[];
  activeTools: string[];
  activeHooks: string[];
  activeMcpServers: string[];
  activePrompts: string[];
  currentPersona: string;
  contextStrategy: 'Standard' | 'Hot Swap';
  currentMode: ModeType;
  allowedTools: string[];
  modeIcon: string;
  modeColor: string;
  // Confidence display fields
  currentModeConfidence: number;
  modeDuration: number; // milliseconds in current mode
  suggestedModes: Array<{
    mode: ModeType;
    icon: string;
    confidence: number;
    reason: string;
  }>;
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

interface ModeChangedEvent {
  from: ModeType;
  to: ModeType;
  timestamp: Date;
  trigger: 'auto' | 'manual' | 'tool' | 'explicit';
  confidence: number;
}

/**
 * Get mode metadata (icon, color, persona)
 */
function getModeMetadata(mode: ModeType): { icon: string; color: string; persona: string } {
  const metadata: Record<ModeType, { icon: string; color: string; persona: string }> = {
    assistant: {
      icon: '💬',
      color: 'blue',
      persona: 'Helpful AI Assistant'
    },
    planning: {
      icon: '📋',
      color: 'yellow',
      persona: 'Technical Architect & Planner'
    },
    developer: {
      icon: '👨‍💻',
      color: 'green',
      persona: 'Senior Software Engineer'
    },
    tool: {
      icon: '🔧',
      color: 'cyan',
      persona: 'Senior Software Engineer + Tool Expert'
    },
    debugger: {
      icon: '🐛',
      color: 'red',
      persona: 'Senior Debugging Specialist'
    },
    security: {
      icon: '🔒',
      color: 'purple',
      persona: 'Security Auditor & Specialist'
    },
    reviewer: {
      icon: '👀',
      color: 'orange',
      persona: 'Senior Code Reviewer'
    },
    performance: {
      icon: '⚡',
      color: 'magenta',
      persona: 'Performance Engineer'
    }
  };
  
  return metadata[mode] || metadata.assistant;
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
    currentPersona: 'Helpful AI Assistant',
    contextStrategy: 'Standard',
    currentMode: 'assistant',
    allowedTools: [],
    modeIcon: '💬',
    modeColor: 'blue',
    currentModeConfidence: 1.0,
    modeDuration: 0,
    suggestedModes: []
  });
  
  const [modeStartTime, setModeStartTime] = useState<Date>(new Date());

  // Update mode duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const duration = now.getTime() - modeStartTime.getTime();
      setState(prev => ({ ...prev, modeDuration: duration }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [modeStartTime]);

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
           contextStrategy: 'Standard',
           suggestedModes: []
       }));
    };
    
    const handleModeChanged = (data: unknown) => {
      const event = data as ModeChangedEvent;
      const metadata = getModeMetadata(event.to);
      
      // Get allowed tools from ModeManager
      const modeManager = actions.getModeManager();
      const allowedTools = modeManager ? modeManager.getAllowedTools(event.to) : [];
      
      // Get suggested modes from ContextAnalyzer
      const contextAnalyzer = modeManager?.getContextAnalyzer();
      const messages = actions.getMessages ? actions.getMessages() : [];
      const suggestedModes = contextAnalyzer && messages.length > 0
        ? contextAnalyzer.getSuggestedModes(messages, event.to, 3)
        : [];
      
      // Reset mode start time
      setModeStartTime(new Date());
      
      setState(prev => ({
        ...prev,
        currentMode: event.to,
        currentPersona: metadata.persona,
        modeIcon: metadata.icon,
        modeColor: metadata.color,
        allowedTools,
        currentModeConfidence: event.confidence,
        modeDuration: 0, // Reset duration on mode change
        suggestedModes
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
        actions.on('mode-changed', handleModeChanged);
        actions.on('cleared', handleClear);
    }

    return () => {
      if (actions.off) {
          actions.off('active-skills-updated', () => {});
          actions.off('active-tools-updated', () => {});
          actions.off('active-hooks-updated', () => {});
          actions.off('active-mcp-updated', () => {});
          actions.off('mode-changed', handleModeChanged);
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
