import { createLogger } from '../../../core/src/utils/logger.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const logger = createLogger('KeybindsService');

import { keybindsData } from '../config/keybinds.js';

export class KeybindsService {
  private static instance: KeybindsService;
  private configPath: string;

  private constructor() {
    const homeDir = homedir();
    const configDir = join(homeDir, '.ollm');
    this.configPath = join(configDir, 'user_keybinds.json');
    
    // Ensure directory exists
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
  }

  public static getInstance(): KeybindsService {
    if (!KeybindsService.instance) {
      KeybindsService.instance = new KeybindsService();
    }
    return KeybindsService.instance;
  }

  public load(): typeof keybindsData {
    try {
      if (!existsSync(this.configPath)) {
        // First run: Create file with defaults
        this.save(keybindsData);
        return keybindsData;
      }

      const content = readFileSync(this.configPath, 'utf-8');
      const userKeybinds = JSON.parse(content);
      
      // Merge with defaults to ensure new keys are present
      // We do a deep merge strategy here: Default keys that are missing in user config are added.
      // User keys that are present override defaults.
      return this.deepMerge(keybindsData, userKeybinds);
    } catch (error) {
      logger.error('Failed to load user keybinds:', error);
      return keybindsData;
    }
  }

  public save(keybinds: typeof keybindsData): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(keybinds, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save user keybinds:', error);
    }
  }

  public resetAll(): typeof keybindsData {
    this.save(keybindsData);
    return keybindsData;
  }

  private deepMerge(target: any, source: any): any {
    const output = Object.assign({}, target);
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target))
            Object.assign(output, { [key]: source[key] });
          else
            output[key] = this.deepMerge(target[key], source[key]);
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    return output;
  }

  private isObject(item: any): boolean {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
}
