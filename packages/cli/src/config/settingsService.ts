import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
    warmup?: {
      enabled?: boolean;
      maxAttempts?: number;
      timeout?: number;
    };
    clearContextOnModelSwitch?: boolean; // NEW: Make context clearing optional
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
            modeLinkedTemperature: true
        },
        tools: {}
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
        // Shallow merge defaults with loaded to ensure structure exists
        this.settings = {
            ...this.settings,
            ...loaded,
            ui: { ...this.settings.ui, ...(loaded.ui || {}) },
            llm: { ...this.settings.llm, ...(loaded.llm || {}) },
            hardware: loaded.hardware,
            tools: loaded.tools || {}
        };
      }
    } catch (error) {
      console.error('Failed to load system settings:', error);
    }
  }

  private saveSettings(): void {
    try {
      console.log(`[SettingsService] Saving settings to: ${this.settingsPath}`);
      writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save system settings:', error);
    }
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
      ...info
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
   * @param toolId The ID of the tool to check
   * @returns true if enabled (default), false if disabled
   */
  public getToolState(toolId: string): boolean {
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
   * Get whether temperature is linked to mode
   */
  public isModeLinkedTemperature(): boolean {
    return this.settings.llm.modeLinkedTemperature ?? true;
  }

  /**
   * Set whether temperature should be linked to mode
   */
  public setModeLinkedTemperature(enabled: boolean): void {
    this.settings.llm.modeLinkedTemperature = enabled;
    this.saveSettings();
  }
}
