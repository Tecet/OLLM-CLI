import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ContextTier, OperationalMode } from '../context/types.js';

const TIER_KEY_BY_CONTEXT: Record<ContextTier, string> = {
  [ContextTier.TIER_1_MINIMAL]: 'tier1',
  [ContextTier.TIER_2_BASIC]: 'tier2',
  [ContextTier.TIER_3_STANDARD]: 'tier3',
  [ContextTier.TIER_4_PREMIUM]: 'tier4',
  [ContextTier.TIER_5_ULTRA]: 'tier5',
};

const MODES: OperationalMode[] = [
  OperationalMode.ASSISTANT,
  OperationalMode.DEVELOPER,
  OperationalMode.PLANNING,
  OperationalMode.DEBUGGER,
];

export class TieredPromptStore {
  private templates: Map<string, string> = new Map();
  private baseDir: string;

  constructor(baseDir?: string) {
    if (baseDir) {
      this.baseDir = baseDir;
      return;
    }

    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    this.baseDir = path.resolve(moduleDir, 'templates');
  }

  load(): void {
    for (const mode of MODES) {
      for (const tierKey of ['tier1', 'tier2', 'tier3', 'tier4', 'tier5']) {
        const filePath = path.join(this.baseDir, mode, `${tierKey}.txt`);
        try {
          const content = fs.readFileSync(filePath, 'utf8').trim();
          this.templates.set(this.makeKey(mode, tierKey), content);
        } catch (_error) {
          console.warn(`[TieredPromptStore] Missing prompt template: ${filePath}`);
        }
      }
    }
  }

  get(mode: OperationalMode, tier: ContextTier): string | undefined {
    const tierKey = TIER_KEY_BY_CONTEXT[tier];
    return this.templates.get(this.makeKey(mode, tierKey));
  }

  private makeKey(mode: OperationalMode, tierKey: string): string {
    return `${mode}:${tierKey}`;
  }
}
