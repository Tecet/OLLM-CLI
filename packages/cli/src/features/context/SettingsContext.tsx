import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SettingsService, UserSettings } from '../../config/settingsService.js';
import { useUI } from './UIContext.js';

import { builtInThemes } from '../../config/styles.js';

type SettingValue = string | number | boolean;

interface SettingsContextValue {
  settings: UserSettings;
  updateLLMSetting: (key: string, value: SettingValue) => void;
  updateUISetting: (key: string, value: SettingValue) => void;
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
        // For other LLM settings, we access the settings object directly through the service
        // Since we know the structure of UserSettings, we can safely update it
        const current = service.getSettings();
        if (current.llm) {
            (current.llm as Record<string, SettingValue>)[key] = value;
            // We use a cast here because the service doesn't have a generic update method yet,
            // but we ensure type safety through SettingValue union
            (service as any).settings.llm[key] = value;
            (service as any).saveSettings();
        }
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
        const current = service.getSettings();
        if (current.ui) {
            (current.ui as Record<string, SettingValue>)[key] = value;
            (service as any).settings.ui[key] = value;
            (service as any).saveSettings();
        }
    }
    
    setSettingsState(service.getSettings());
  }, [setTheme, service]);

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      updateLLMSetting, 
      updateUISetting 
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
