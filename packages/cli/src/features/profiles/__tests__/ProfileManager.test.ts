import { describe, expect, it, beforeEach, vi } from 'vitest';

const fileStore = new Map<string, string>();
const dirStore = new Set<string>();

vi.mock('os', () => ({
  homedir: () => 'C:/test-home',
}));

vi.mock('fs', () => ({
  existsSync: (path: string) => fileStore.has(path) || dirStore.has(path),
  mkdirSync: (path: string) => {
    dirStore.add(path);
  },
  readFileSync: (path: string) => {
    const data = fileStore.get(path);
    if (data === undefined) {
      throw new Error(`Missing file: ${path}`);
    }
    return data;
  },
  writeFileSync: (path: string, data: string) => {
    fileStore.set(path, data);
  },
}));

describe('ProfileManager', () => {
  beforeEach(() => {
    fileStore.clear();
    dirStore.clear();
  });

  it('persists user models alongside static profiles', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();
    const userModels = [{ id: 'llama3:8b', name: 'llama3:8b', source: 'ollama' }];

    manager.setUserModels(userModels);

    let stored: string | undefined;
    for (const key of fileStore.keys()) {
      const normalized = key.replace(/\\/g, '/');
      if (normalized.endsWith('/.ollm/user_models.json')) {
        stored = fileStore.get(key);
        break;
      }
    }
    expect(stored).toBeDefined();

    const parsed = JSON.parse(stored as string) as { user_models?: unknown[] };
    expect(parsed.user_models).toEqual(userModels);
  });

  it('prefers user models in combined list when available', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();

    manager.setUserModels([{ id: 'llama3:8b', name: 'llama3:8b', source: 'ollama' }]);

    const combined = manager.getCombinedModels();
    expect(combined[0]?.id).toBe('llama3:8b');
  });

  it('merges manual context when updating from list', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();

    manager.setUserModels([{ id: 'llama3:8b', name: 'llama3:8b', manual_context: 8192 }]);
    manager.updateUserModelsFromList([{ name: 'llama3:8b' }]);

    const entry = manager.getUserModels()[0];
    expect(entry?.manual_context).toBe(8192);
  });
});
