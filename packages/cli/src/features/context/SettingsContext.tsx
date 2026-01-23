import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

import { useUI } from './UIContext.js';
import { SettingsService, UserSettings } from '../../config/settingsService.js';
import { builtInThemes } from '../../config/styles.js';

type SettingValue = string | number | boolean;

interface SettingsContextValue {
  settings: UserSettings;
  updateLLMSetting: (key: string, value: SettingValue) => void;
  updateUISetting: (key: string, value: SettingValue) => void;
  updateToolRouting: (key: string, value: unknown) => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const service = SettingsService.getInstance();
  const [settings, setSettingsState] = useState<UserSettings>(service.getSettings());
  const { setTheme } = useUI();

  const updateLLMSetting = useCallback((key: string, value: SettingValue) => {
    // Update service (persists)
    if (key === 'model') service.setModel(value as string);
    else if (key === 'contextSize') service.setContextSize(value as number);
    else {
        service.updateLLMSetting(key, value);
    }
    
    setSettingsState(service.getSettings());
  }, [service]);

  const updateUISetting = useCallback((key: string, value: SettingValue) => {
    if (key === 'theme') {
      const themeName = value as string;
      service.setTheme(themeName);
      const themeObj = builtInThemes[themeName];
      if (themeObj) {
        setTheme(themeObj);
      }
    } else {
        service.updateUISetting(key, value);
    }
    
    setSettingsState(service.getSettings());
  }, [setTheme, service]);

  const updateToolRouting = useCallback((key: string, value: unknown) => {
    const current = service.getSettings();
    // Ensure llm object exists
    if (!current.llm) {
        service.updateLLMSetting('model', 'llama3.2:3b');
    }
    
    const settingsCopy = service.getSettings();
    
    // Ensure toolRouting object exists
    if (!settingsCopy.llm.toolRouting) {
        settingsCopy.llm.toolRouting = {};
    }

    if (key.startsWith('bindings.')) {
        const bindingKey = key.split('.')[1];
        
        if (!settingsCopy.llm.toolRouting.bindings) {
            settingsCopy.llm.toolRouting.bindings = {};
        }
        settingsCopy.llm.toolRouting.bindings[bindingKey] = value as string;
    } else {
        // Direct property update
        (settingsCopy.llm.toolRouting as Record<string, unknown>)[key] = value;
    }
    
    service.updateLLMSetting('toolRouting', settingsCopy.llm.toolRouting);
    setSettingsState(service.getSettings());
  }, [service]);

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateLLMSetting, 
      updateUISetting,
      updateToolRouting
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
