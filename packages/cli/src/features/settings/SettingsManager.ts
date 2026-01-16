import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface HardwareInfo {
  gpuCount: number;
  totalVRAM: number; // Bytes
  gpuName: string;
}

export interface SystemSettings {
  theme: string;
  lastModel?: string;
  keybindings?: Record<string, string>;
  hardware?: HardwareInfo;
}

const DEFAULT_SETTINGS: SystemSettings = {
  theme: 'default',
};

export class SettingsManager {
  private configDir: string;
  private settingsPath: string;
  private settings: SystemSettings;

  constructor() {
    this.configDir = path.join(__dirname, '../../config');
    // Ensure it exists
    if (!fs.existsSync(this.configDir)) {
        try { fs.mkdirSync(this.configDir, { recursive: true }); } catch (e) { /* ignore */ }
    }
    
    this.settingsPath = path.join(this.configDir, 'system_settings.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): SystemSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }

  public saveSettings(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  public get<K extends keyof SystemSettings>(key: K): SystemSettings[K] {
    return this.settings[key];
  }

  public set<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]): void {
    this.settings[key] = value;
    this.saveSettings();
  }

  public getHardwareInfo(): HardwareInfo | undefined {
    return this.settings.hardware;
  }

  public updateHardwareInfo(info: HardwareInfo): void {
    this.settings.hardware = info;
    this.saveSettings();
  }
}

export const settingsManager = new SettingsManager();
