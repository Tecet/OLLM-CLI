import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Goal management tools - GLOBALLY DISABLED (Under Development)
// These tools are registered but permanently disabled because they cause LLMs
// to call tools unnecessarily, even for simple greetings like "hi".
// They appear in the UI as "Under Development" but cannot be enabled.
const GLOBALLY_DISABLED_TOOLS = [
  'create_goal',
  'create_checkpoint',
  'complete_goal',
  'record_decision',
  'switch_goal',
];

// Default tool sets per mode
// IMPORTANT: Limit tools to prevent LLM confusion. Too many tools (18+) causes
// the LLM to launch multiple unnecessary tools. Keep essential tools only.
// Goal management tools (create_goal, etc.) should NOT be in default sets.
const DEFAULT_TOOLS_BY_MODE: Record<string, string[]> = {
  // Developer mode: Core development tools only (8 tools)
  developer: [
    'read_file',
    'read_multiple_files',
    'write_file',
    'edit_file',
    'grep_search',
    'file_search',
    'list_directory',
    'shell',
  ],
  // Debugger mode: Debugging and analysis tools (7 tools)
  debugger: [
    'read_file',
    'read_multiple_files',
    'grep_search',
    'file_search',
    'list_directory',
    'get_diagnostics',
    'shell',
  ],
  // Assistant mode: Minimal tools for general assistance (3 tools)
  // NO goal tools - these confuse the LLM for simple conversations
  assistant: ['read_file', 'web_search', 'web_fetch'],
  // Planning mode: Research and analysis tools (10 tools)
  planning: [
    'read_file',
    'read_multiple_files',
    'grep_search',
    'file_search',
    'list_directory',
    'web_search',
    'web_fetch',
    'get_diagnostics',
    'write_memory_dump',
    'mcp:*',
  ],
  // User mode: Balanced set of common tools (10 tools)
  // NO goal tools - these are for advanced workflows only
  user: [
    'read_file',
    'read_multiple_files',
    'write_file',
    'edit_file',
    'grep_search',
    'file_search',
    'list_directory',
    'web_search',
    'web_fetch',
    'memory',
  ],
};

export interface UserSettings {
  ui: {
    theme: string;
    [key: string]: unknown;
  };
  llm: {
    model: string;
    contextSize?: number;
    temperature?: number;
    modeLinkedTemperature?: boolean;
    contextCapRatio?: number;
    forceNumGpu?: number;
    ollamaAutoStart?: boolean;
    ollamaHealthCheck?: boolean;
    warmup?: {
      enabled?: boolean;
      maxAttempts?: number;
      timeout?: number;
    };
    clearContextOnModelSwitch?: boolean; // NEW: Make context clearing optional
    toolRouting?: {
      enabled?: boolean;
      bindings?: Record<string, string>;
      enableFallback?: boolean;
    };
    [key: string]: unknown;
  };
  hardware?: {
    gpuCount?: number;
    gpuName?: string;
    totalVRAM?: number;
  };
  tools?: {
    [toolId: string]: boolean;
  };
  toolsByMode?: {
    [mode: string]: {
      [toolId: string]: boolean;
    };
  };
  prompt?: {
    mode?: string;
    autoSwitch?: boolean;
  };
  hooks?: {
    enabled: {
      [hookId: string]: boolean;
    };
  };
}

export class SettingsService {
  private static instance: SettingsService;
  private settingsPath: string;
  private settings: UserSettings;
  private listeners: (() => void)[] = [];

  private constructor() {
    // Strategy: Use ~/.ollm/settings.json
    // This ensures persistence across updates and works for global installs

    const homeDir = homedir();
    const configDir = join(homeDir, '.ollm');
    this.settingsPath = join(configDir, 'settings.json');
    console.log(`[SettingsService] Initializing with path: ${this.settingsPath}`);

    // Default settings
    this.settings = {
      ui: { theme: 'default' },
      llm: {
        model: 'llama3.2:3b',
        modeLinkedTemperature: true,
        contextCapRatio: 0.85,
        forceNumGpu: 999,
        ollamaAutoStart: false,
        ollamaHealthCheck: true,
      },
      tools: {},
    };

    this.ensureConfigExists(configDir);
    this.loadSettings();
  }

  /**
   * Get singleton instance of SettingsService
   * @returns The SettingsService instance
   */
  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      console.log('[SettingsService] Creating new instance');
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  private ensureConfigExists(configDir: string): void {
    try {
      if (!existsSync(configDir)) {
        console.log(`[SettingsService] Creating config directory: ${configDir}`);
        mkdirSync(configDir, { recursive: true });
      }

      // If file doesn't exist, save our defaults there immediately
      if (!existsSync(this.settingsPath)) {
        console.log(`[SettingsService] Creating default settings file: ${this.settingsPath}`);
        this.saveSettings();
      }
    } catch (error) {
      console.warn('Failed to initialize settings directory:', error);
    }
  }

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
        console.log(`[SettingsService] Loading settings from: ${this.settingsPath}`);
        const content = readFileSync(this.settingsPath, 'utf-8');
        const loaded = JSON.parse(content);

        // Migrate old settings if needed
        const migrated = this.migrateSettings(loaded);

        // Shallow merge defaults with loaded to ensure structure exists
        this.settings = {
          ...this.settings,
          ...migrated,
          ui: { ...this.settings.ui, ...(migrated.ui || {}) },
          llm: { ...this.settings.llm, ...(migrated.llm || {}) },
          hardware: migrated.hardware,
          tools: migrated.tools || {},
          toolsByMode: migrated.toolsByMode || {},
        };
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  }

  /**
   * Migrate old settings format to new format
   */
  private migrateSettings(loaded: Partial<UserSettings>): Partial<UserSettings> {
    // If toolsByMode doesn't exist, initialize with defaults
    if (!loaded.toolsByMode) {
      loaded.toolsByMode = {};
    }

    return loaded;
  }

  private saveSettings(): void {
    try {
      console.log(`[SettingsService] Saving settings to: ${this.settingsPath}`);
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save system settings:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('[SettingsService] Error in listener:', error);
      }
    });
  }

  /**
   * Subscribe to settings changes
   * @param listener Callback function
   * @returns Unsubscribe function
   */
  public addChangeListener(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Remove a change listener
   * @param listener Callback function to remove
   */
  public removeChangeListener(listener: () => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Get a copy of all settings
   * @returns A deep copy of the current settings
   */
  public getSettings(): UserSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  /**
   * Set the UI theme
   * @param theme - The theme name to set
   */
  public setTheme(theme: string): void {
    this.settings.ui.theme = theme;
    this.saveSettings();
  }

  /**
   * Get the current UI theme
   * @returns The current theme name
   */
  public getTheme(): string {
    return this.settings.ui.theme;
  }

  /**
   * Set the default LLM model
   * @param model - The model ID to set as default
   */
  public setModel(model: string): void {
    this.settings.llm.model = model;
    this.saveSettings();
  }

  /**
   * Get the default LLM model
   * @returns The default model ID
   */
  public getModel(): string {
    return this.settings.llm.model;
  }

  /**
   * Set the context size for the LLM
   * @param size - The context size in tokens
   */
  public setContextSize(size: number): void {
    this.settings.llm.contextSize = size;
    this.saveSettings();
  }

  /**
   * Get the context size for the LLM
   * @returns The context size in tokens, or undefined if not set
   */
  public getContextSize(): number | undefined {
    return this.settings.llm.contextSize;
  }

  /**
   * Set hardware information
   * @param info - Hardware information to store
   */
  public setHardwareInfo(info: { gpuCount?: number; gpuName?: string; totalVRAM?: number }): void {
    this.settings.hardware = {
      ...this.settings.hardware,
      ...info,
    };
    this.saveSettings();
  }

  /**
   * Get hardware information
   * @returns The stored hardware information
   */
  public getHardwareInfo(): UserSettings['hardware'] {
    return this.settings.hardware;
  }

  /**
   * Get the enabled state of a tool
   *
   * NOTE: Goal management tools (create_goal, create_checkpoint, complete_goal,
   * record_decision, switch_goal) are GLOBALLY DISABLED and marked as
   * "Under Development". They cannot be enabled through settings because they
   * cause LLMs to call tools unnecessarily, even for simple greetings like "hi".
   *
   * @param toolId The ID of the tool to check
   * @returns true if enabled (default), false if disabled
   */
  public getToolState(toolId: string): boolean {
    // Check if tool is globally disabled (under development)
    if (GLOBALLY_DISABLED_TOOLS.includes(toolId)) {
      return false; // Always disabled, no exceptions
    }

    // Default to true (enabled) if not explicitly set
    if (!this.settings.tools) {
      return true;
    }
    return this.settings.tools[toolId] ?? true;
  }

  /**
   * Set the enabled state of a tool
   *
   * @param toolId The ID of the tool to configure
   * @param enabled Whether the tool should be enabled
   */
  public setToolState(toolId: string, enabled: boolean): void {
    if (!this.settings.tools) {
      this.settings.tools = {};
    }
    this.settings.tools[toolId] = enabled;
    this.saveSettings();
  }

  /**
   * Get the current prompt mode
   *
   * @returns The current mode, or undefined if not set
   */
  public getMode(): string | undefined {
    return this.settings.prompt?.mode;
  }

  /**
   * Set the current prompt mode
   *
   * @param mode The mode to set
   */
  public setMode(mode: string): void {
    if (!this.settings.prompt) {
      this.settings.prompt = {};
    }
    this.settings.prompt.mode = mode;
    this.saveSettings();
  }

  /**
   * Get the auto-switch preference
   *
   * @returns true if auto-switch is enabled (default), false if disabled
   */
  public getAutoSwitch(): boolean {
    // Default to true (enabled) if not explicitly set
    return this.settings.prompt?.autoSwitch ?? true;
  }

  /**
   * Set the auto-switch preference
   *
   * @param enabled Whether auto-switch should be enabled
   */
  public setAutoSwitch(enabled: boolean): void {
    if (!this.settings.prompt) {
      this.settings.prompt = {};
    }
    this.settings.prompt.autoSwitch = enabled;
    this.saveSettings();
  }

  /**
   * Get all hook settings
   *
   * @returns Object containing enabled state for all hooks
   */
  public getHookSettings(): { enabled: Record<string, boolean> } {
    return this.settings.hooks || { enabled: {} };
  }

  /**
   * Set the enabled state of a hook
   *
   * @param hookId The ID of the hook to configure
   * @param enabled Whether the hook should be enabled
   */
  public setHookEnabled(hookId: string, enabled: boolean): void {
    if (!this.settings.hooks) {
      this.settings.hooks = { enabled: {} };
    }
    this.settings.hooks.enabled[hookId] = enabled;
    this.saveSettings();
  }

  /**
   * Remove a hook setting (cleanup when hook is deleted)
   *
   * @param hookId The ID of the hook to remove from settings
   */
  public removeHookSetting(hookId: string): void {
    if (this.settings.hooks?.enabled) {
      delete this.settings.hooks.enabled[hookId];
      this.saveSettings();
    }
  }

  /**
   * Set tool routing configuration
   */
  public setToolRoutingConfig(config: UserSettings['llm']['toolRouting']): void {
    if (!this.settings.llm) {
      this.settings.llm = { model: 'llama3.2:3b' };
    }
    this.settings.llm.toolRouting = config;
    this.saveSettings();
  }

  /**
   * Get tool routing configuration
   */
  public getToolRoutingConfig(): UserSettings['llm']['toolRouting'] {
    return this.settings.llm.toolRouting;
  }

  /**
   * Get whether temperature is linked to mode
   */
  public isModeLinkedTemperature(): boolean {
    return this.settings.llm.modeLinkedTemperature ?? true;
  }

  /**
   * Set whether temperature should be linked to mode
   */
  /**
   * Set whether temperature should be linked to mode
   */
  public setModeLinkedTemperature(enabled: boolean): void {
    this.settings.llm.modeLinkedTemperature = enabled;
    this.saveSettings();
  }

  /**
   * Update a specific LLM setting
   */
  public updateLLMSetting(key: string, value: unknown): void {
    if (!this.settings.llm) {
      this.settings.llm = { model: 'llama3.2:3b' };
    }
    (this.settings.llm as Record<string, unknown>)[key] = value;
    this.saveSettings();
  }

  /**
   * Update a specific UI setting
   */
  public updateUISetting(key: string, value: unknown): void {
    if (!this.settings.ui) {
      this.settings.ui = { theme: 'default' };
    }
    (this.settings.ui as Record<string, unknown>)[key] = value;
    this.saveSettings();
  }

  /**
   * Manually trigger a save of the current settings
   */
  public triggerSave(): void {
    this.saveSettings();
  }

  /**
   * Get tools enabled for a specific mode
   * @param mode The mode to get tools for
   * @returns Array of tool IDs enabled for this mode
   */
  public getToolsForMode(mode: string): string[] {
    // Get globally enabled tools
    const globallyEnabled = Object.entries(this.settings.tools || {})
      .filter(([_, enabled]) => enabled)
      .map(([toolId, _]) => toolId);

    // Get mode-specific settings (or use defaults)
    const modeSettings = this.settings.toolsByMode?.[mode];

    if (!modeSettings || Object.keys(modeSettings).length === 0) {
      // Use defaults if user hasn't customized
      const defaults = DEFAULT_TOOLS_BY_MODE[mode] || [];
      if (defaults.includes('*')) {
        return globallyEnabled; // All enabled tools
      }
      return globallyEnabled.filter((tool) => defaults.includes(tool));
    }

    // User has customized this mode
    return globallyEnabled.filter((toolId) => {
      return modeSettings[toolId] === true;
    });
  }

  /**
   * Set tool enabled state for a specific mode
   * @param mode The mode to configure
   * @param toolId The tool to enable/disable
   * @param enabled Whether the tool should be enabled
   */
  public setToolForMode(mode: string, toolId: string, enabled: boolean): void {
    if (!this.settings.toolsByMode) {
      this.settings.toolsByMode = {};
    }

    if (!this.settings.toolsByMode[mode]) {
      this.settings.toolsByMode[mode] = {};
    }

    this.settings.toolsByMode[mode][toolId] = enabled;
    this.saveSettings();
  }

  /**
   * Reset tool settings to defaults for all modes
   * @param toolId The tool to reset
   */
  public resetToolToDefaults(toolId: string): void {
    if (!this.settings.toolsByMode) {
      return;
    }

    // Remove custom settings for this tool across all modes
    for (const mode of Object.keys(this.settings.toolsByMode)) {
      if (this.settings.toolsByMode[mode]?.[toolId] !== undefined) {
        delete this.settings.toolsByMode[mode][toolId];
      }
    }

    this.saveSettings();
  }

  /**
   * Get mode settings for a specific tool
   * @param toolId The tool to get settings for
   * @returns Object with mode -> enabled mapping
   */
  public getModeSettingsForTool(toolId: string): Record<string, boolean> {
    const result: Record<string, boolean> = {};

    for (const mode of Object.keys(DEFAULT_TOOLS_BY_MODE)) {
      const modeSettings = this.settings.toolsByMode?.[mode];

      if (!modeSettings || Object.keys(modeSettings).length === 0) {
        // Use defaults
        const defaults = DEFAULT_TOOLS_BY_MODE[mode] || [];
        result[mode] = defaults.includes('*') || defaults.includes(toolId);
      } else {
        // Use custom settings
        result[mode] = modeSettings[toolId] ?? false;
      }
    }

    return result;
  }

  /**
   * Initialize tool settings for all available tools
   * This ensures all tools are present in the settings file with their defaults
   * @param toolIds Array of all available tool IDs
   */
  public initializeToolSettings(toolIds: string[]): void {
    let needsSave = false;

    // Initialize tools object if not exists
    if (!this.settings.tools) {
      this.settings.tools = {};
      needsSave = true;
    }

    // Initialize toolsByMode if not exists
    if (!this.settings.toolsByMode) {
      this.settings.toolsByMode = {};
      needsSave = true;
    }

    // Add any missing tools to global tools list (default: enabled)
    for (const toolId of toolIds) {
      if (this.settings.tools[toolId] === undefined) {
        this.settings.tools[toolId] = true;
        needsSave = true;
      }
    }

    // Initialize per-mode settings for all tools
    for (const mode of Object.keys(DEFAULT_TOOLS_BY_MODE)) {
      if (!this.settings.toolsByMode[mode]) {
        this.settings.toolsByMode[mode] = {};
      }

      const defaults = DEFAULT_TOOLS_BY_MODE[mode] || [];
      const isWildcard = defaults.includes('*');

      for (const toolId of toolIds) {
        // Only initialize if not already set by user
        if (this.settings.toolsByMode[mode][toolId] === undefined) {
          // Check if tool should be enabled by default for this mode
          const shouldEnable = isWildcard || defaults.includes(toolId);
          this.settings.toolsByMode[mode][toolId] = shouldEnable;
          needsSave = true;
        }
      }
    }

    // Save if any changes were made
    if (needsSave) {
      this.saveSettings();
    }
  }
}
