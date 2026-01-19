import React from 'react';
import { ServiceProvider } from '../../features/context/ServiceContext.js';
import { DialogProvider } from '../contexts/DialogContext.js';
import { UIProvider } from '../../features/context/UIContext.js';
import { FocusProvider } from '../../features/context/FocusContext.js';
import { ToolsProvider } from '../contexts/ToolsContext.js';
import { MCPProvider } from '../contexts/MCPContext.js';
import type { Config } from '../../config/types.js';
import type { ProviderAdapter } from '@ollm/ollm-cli-core/provider/types.js';
import { SettingsService } from '../../config/settingsService.js';

const mockProvider = {} as ProviderAdapter;

const defaultConfig: Config = {
  provider: { default: 'mock' },
  model: { default: 'gpt', temperature: 0.7, maxTokens: 1024 },
  ui: {
    layout: 'hybrid',
    sidePanel: true,
    theme: undefined,
    showGpuStats: false,
    showCost: false,
    metrics: {
      enabled: false,
      compactMode: true,
      showPromptTokens: false,
      showTTFT: false,
      showInStatusBar: false,
    },
    reasoning: {
      enabled: false,
      maxVisibleLines: 80,
      autoCollapseOnComplete: false,
    },
  },
  status: { pollInterval: 5000, highTempThreshold: 80, lowVramThreshold: 200 },
  review: { enabled: false, inlineThreshold: 0.5 },
  session: { autoSave: false, saveInterval: 60000 },
};

// Ensure SettingsService singleton has a test-friendly instance
const defaultUserSettings = {
  ui: { theme: 'default' },
  llm: { model: 'gpt', toolRouting: { enabled: false } },
  tools: {},
  hooks: { enabled: {} },
};

;(SettingsService as any).instance = {
  getSettings: () => defaultUserSettings,
  addChangeListener: (_: () => void) => () => {},
  getHookSettings: () => ({ enabled: {} }),
};

// Also override the static getter to return our mock (covers different import interop cases)
(SettingsService as any).getInstance = () => (SettingsService as any).instance;

export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <DialogProvider>
      <ServiceProvider provider={mockProvider} config={defaultConfig}>
        <UIProvider>
          <FocusProvider>
            <ToolsProvider>
              <MCPProvider>{children}</MCPProvider>
            </ToolsProvider>
          </FocusProvider>
        </UIProvider>
      </ServiceProvider>
    </DialogProvider>
  );
}

export default TestProviders;
