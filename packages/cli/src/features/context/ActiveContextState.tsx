import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useContextManager } from './ContextManagerContext.js';
import type { ModeType, Role, MessagePart } from '@ollm/ollm-cli-core';

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

    // ModeChangedEvent interface removed as it was unused and replaced by ModeTransitionPayload locally


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
    debugger: {
      icon: '🐛',
      color: 'red',
      persona: 'Senior Debugging Specialist'
    },
    reviewer: {
      icon: '👀',
      color: 'orange',
      persona: 'Senior Code Reviewer'
    }
  };
  
  return metadata[mode] || metadata.assistant;
}

const ActiveContextContext = createContext<ActiveContextContextType | undefined>(undefined);

export const ActiveContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use the correct hook which returns { state, actions }
  const { state: contextState, actions } = useContextManager();
  
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

  // Initial Sync with ModeManager
  useEffect(() => {
    // Only sync if context manager is active
    if (!contextState.active) return;

    const modeManager = actions.getModeManager();
    if (modeManager) {
      const mode = modeManager.getCurrentMode();
      // Apply initial metadata
      const metadata = getModeMetadata(mode);
      const allowedTools = modeManager.getAllowedTools(mode);
      
      setState(prev => ({
        ...prev,
        currentMode: mode,
        currentPersona: metadata.persona,
        modeIcon: metadata.icon,
        modeColor: metadata.color,
        allowedTools
      }));
    }
  }, [contextState.active, actions]); // Run whenever active state changes

  useEffect(() => {
    // Only attach listeners if context manager is active
    if (!contextState.active) return;

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
    
    // Define the event payload type from ContextManager
    interface ModeTransitionPayload {
      from: ModeType;
      to: ModeType;
      timestamp: string; // ISO string from ContextManager
      trigger: 'auto' | 'manual' | 'tool' | 'explicit';
      confidence: number;
    }
    
    const handleModeTransition = async (data: unknown) => {
      // Cast safely and validate
      const event = data as ModeTransitionPayload;
      if (!event || !event.to) return;
      
      const metadata = getModeMetadata(event.to);
      
      // Get allowed tools from ModeManager
      const modeManager = actions.getModeManager();
      const allowedTools = modeManager ? modeManager.getAllowedTools(event.to) : [];
      
      // Get suggested modes from ContextAnalyzer
      // Helper function to get messages safely
      let messages: Array<{ role: Role; parts: MessagePart[] }> = [];
      try {
          if (actions.getContext) {
            const contextMessages = await actions.getContext();
            // Convert to provider messages expected by ContextAnalyzer
            messages = contextMessages.map(msg => ({
              role: msg.role,
              parts: [{ type: 'text', text: msg.content || '' }]
            }));
          }
      } catch (err) {
          console.warn('Failed to get context for analysis:', err);
      }

      const contextAnalyzer = modeManager?.getContextAnalyzer();
      const suggestedModes = contextAnalyzer && messages.length > 0
        ? contextAnalyzer.getSuggestedModes(messages, event.to, 3)
        : [];
      
      // Reset mode start time
      setModeStartTime(new Date(event.timestamp || new Date()));
      
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
        
        // Listen for mode-transition from manager (legacy/proxy)
        actions.on('mode-transition', handleModeTransition);

        // Listen DIRECTLY to ModeManager for robust updates
        const modeManager = actions.getModeManager();
        if (modeManager) {
            // We can reuse the same handler as the payload structure is compatible
            // But we need to be careful about not doubling up if manager also re-emits.
            // However, React batching usually handles this, or we can debounce.
            // For now, robust updates are better than no updates.
            modeManager.on('mode-changed', handleModeTransition);
            modeManager.on('skills-changed', (skills: string[]) => {
                setState(prev => ({ ...prev, activeSkills: skills }));
            });
        }
        
        actions.on('cleared', handleClear);
    }

    return () => {
      if (actions.off) {
          actions.off('active-skills-updated', () => {});
          actions.off('active-tools-updated', () => {});
          actions.off('active-hooks-updated', () => {});
          actions.off('active-mcp-updated', () => {});
          
          actions.off('mode-transition', handleModeTransition);
          actions.off('cleared', handleClear);
      }
      
      const modeManager = actions.getModeManager();
      if (modeManager) {
          modeManager.off('mode-changed', handleModeTransition);
          modeManager.off('skills-changed', () => {});
      }
    };
  }, [contextState.active, actions]);

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
