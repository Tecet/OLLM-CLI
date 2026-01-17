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
    [key: string]: unknown;
  };
  hardware?: {
    gpuCount?: number;
    gpuName?: string;
    totalVRAM?: number;
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
        llm: { model: 'llama3.2:3b' } 
    }; 
    
    this.ensureConfigExists(configDir);
    this.loadSettings();
  }

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
            hardware: loaded.hardware 
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

  public getSettings(): UserSettings {
    return JSON.parse(JSON.stringify(this.settings));
  }

  public setTheme(theme: string): void {
    this.settings.ui.theme = theme;
    this.saveSettings();
  }

  public getTheme(): string {
    return this.settings.ui.theme;
  }

  public setModel(model: string): void {
    this.settings.llm.model = model;
    this.saveSettings();
  }

  public getModel(): string {
    return this.settings.llm.model;
  }

  public setContextSize(size: number): void {
    this.settings.llm.contextSize = size;
    this.saveSettings();
  }

  public getContextSize(): number | undefined {
    return this.settings.llm.contextSize;
  }
  public setHardwareInfo(info: { gpuCount?: number; gpuName?: string; totalVRAM?: number }): void {
    this.settings.hardware = {
      ...this.settings.hardware,
      ...info
    };
    this.saveSettings();
  }

  public getHardwareInfo(): UserSettings['hardware'] {
    return this.settings.hardware;
  }
}
