/**
 * Default Configuration Values
 * 
 * This file acts as the single source of truth for all application fallbacks.
 * It defines:
 * - Default behavior (timeouts, intervals)
 * - Default appearance (typography, keybinds)
 * - Default feature flags
 */

import type { Config, Typography, Keybinds, ContextSettings } from './types.js';
import { keybindsData } from './keybinds.js';

/**
 * Default Context Behavior
 * Strategies for managing context window overflow and summarizing conversations.
 */
export const defaultContextBehavior: ContextSettings = {
  activeProfile: "standard",
  profiles: {
    "standard": {
      "name": "Standard (High VRAM)",
      "contextWindow": 4096,
      "compressionThreshold": 0.7,
      "retentionRatio": 0.3,
      "strategy": "summarize",
      "summaryPrompt": "Concisely summarize the conversation history above that is about to be archived. Focus on the user's technical goals, constraints, and any important code details or decisions made. Ignore the instruction to summarize this text."
    },
    "low_vram": {
      "name": "Low VRAM / Aggressive",
      "contextWindow": 2048,
      "compressionThreshold": 0.5,
      "retentionRatio": 0.2,
      "strategy": "summarize",
      "summaryPrompt": "Briefly summarize the key points of the conversation above. Focus on technical details."
    }
  }
};

/**
 * Default Typography Settings
 */
export const defaultTypography: Typography = {
  headers: { bold: true, underline: false },
  code: { dim: false, italic: false },
  emphasis: { bold: true },
  bullets: '•',
  checkmark: '✓',
  cross: '✗',
  arrow: '→',
  spinner: 'dots',
  borders: 'round',
};

/**
 * Default Keybinds
 */
export const defaultKeybinds: Keybinds = {
  ...keybindsData.tabNavigation,
  ...keybindsData.layout,
  ...keybindsData.chat,
  ...keybindsData.review,
  // Map navigation keys explicitly to match interface
  scrollDown: keybindsData.navigation.scrollDown,
  scrollUp: keybindsData.navigation.scrollUp,
  select: keybindsData.navigation.select,
  back: keybindsData.navigation.back,
  cycleFocus: keybindsData.navigation.cycleFocus,
};

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
    temperature: 0.1,  // Changed from 0.3 - Better for coding (deterministic)
    maxTokens: 4096,
  },
  ui: {
    layout: 'hybrid',
    sidePanel: true,
    theme: 'default-dark',
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
  prompt: {
    mode: 'auto',
    switching: {
      enabled: true,
      confidenceThreshold: 0.7,
      minDuration: 30000, // 30 seconds
      cooldown: 10000, // 10 seconds
    },
    modes: {
      assistant: { enabled: true },
      planning: { enabled: true },
      developer: { enabled: true },
      tool: { enabled: true },
      debugger: { enabled: true },
      security: { enabled: true },
      reviewer: { enabled: true },
      performance: { enabled: true },
    },
  },
};
