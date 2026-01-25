import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { modelDatabase, refreshModelDatabase } from '../modelDatabase.js';

const RUNTIME_BASE = join(tmpdir(), `ollm-vitest-${process.pid}`);
const RUNTIME_STORE_PATH = join(RUNTIME_BASE, '.ollm', 'user_models.json');

describe('ModelDatabase runtime store sync', () => {
  const originalVitest = process.env.VITEST;

  beforeEach(() => {
    process.env.VITEST = '1';
  });

  afterEach(async () => {
    await fs.rm(RUNTIME_BASE, { recursive: true, force: true });
    refreshModelDatabase();
    if (originalVitest === undefined) {
      delete process.env.VITEST;
    } else {
      process.env.VITEST = originalVitest;
    }
  });

  it('reloads entries from ~/.ollm/user_models.json when sync runs', async () => {
    await fs.mkdir(join(RUNTIME_BASE, '.ollm'), { recursive: true });

    const store = {
      user_models: [],
    };

    store.user_models.push({
      id: 'test-model:custom',
      name: 'Test Model',
      max_context_window: 5120,
      context_profiles: [
        {
          size: 8192,
          ollama_context_size: 4096,
        },
      ],
      capabilities: {
        toolCalling: true,
        vision: false,
        streaming: true,
      },
    });

    await fs.writeFile(RUNTIME_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    refreshModelDatabase();

    expect(modelDatabase.getContextWindow('test-model:custom')).toBe(5120);
  });
});
