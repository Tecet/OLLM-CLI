/**
 * Default configuration values
 */

import type { Config } from './types.js';

export const defaultConfig: Config = {
  provider: {
    default: 'ollama',
    ollama: {
      host: 'http://localhost:11434',
      timeout: 30000,
    },
  },
  model: {
    default: 'llama3.2:3b',
    temperature: 0.7,
    maxTokens: 4096,
  },
  ui: {
    layout: 'hybrid',
    sidePanel: true,
    showGpuStats: true,
    showCost: true,
    metrics: {
      enabled: true,
      compactMode: false,
      showPromptTokens: true,
      showTTFT: true,
      showInStatusBar: true,
    },
    reasoning: {
      enabled: true,
      maxVisibleLines: 8,
      autoCollapseOnComplete: true,
    },
  },
  status: {
    pollInterval: 5000,
    highTempThreshold: 80,
    lowVramThreshold: 512,
  },
  review: {
    enabled: true,
    inlineThreshold: 5,
  },
  session: {
    autoSave: true,
    saveInterval: 60000,
  },
};
