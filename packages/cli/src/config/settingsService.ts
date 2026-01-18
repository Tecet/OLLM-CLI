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
    
    // Default settings
    this.settings = { 
        ui: { theme: 'default' }, 
        llm: { model: 'llama3.2:3b' },
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
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  private ensureConfigExists(configDir: string): void {
      try {
          if (!existsSync(configDir)) {
              mkdirSync(configDir, { recursive: true });
          }
          
          // If file doesn't exist, save our defaults there immediately
          if (!existsSync(this.settingsPath)) {
              this.saveSettings();
          }
      } catch (error) {
          console.warn('Failed to initialize settings directory:', error);
      }
  }

  private loadSettings(): void {
    try {
      if (existsSync(this.settingsPath)) {
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
}
