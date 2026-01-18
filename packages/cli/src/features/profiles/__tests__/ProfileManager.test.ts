import { describe, expect, it, beforeEach, vi } from 'vitest';

// Helper to wait for a condition
const waitFor = async (condition: () => boolean | Promise<boolean>, timeout = 1000) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timeout waiting for condition');
};

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

  it('preserves tool support metadata when updating from list', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();

    const timestamp = '2026-01-17T10:30:00Z';
    manager.setUserModels([{
      id: 'custom-model:latest',
      name: 'Custom Model',
      tool_support: true,
      tool_support_source: 'user_confirmed',
      tool_support_confirmed_at: timestamp,
    }]);

    manager.updateUserModelsFromList([{ name: 'custom-model:latest' }]);

    const entry = manager.getUserModels()[0];
    expect(entry?.tool_support_source).toBe('user_confirmed');
    expect(entry?.tool_support_confirmed_at).toBe(timestamp);
  });

  it('never overrides user_confirmed tool support with profile data', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();

    const timestamp = '2026-01-17T10:30:00Z';
    // User has confirmed that llama3:8b does NOT support tools (even though profile says it does)
    manager.setUserModels([{
      id: 'llama3:8b',
      name: 'Llama 3 8B',
      tool_support: false,
      tool_support_source: 'user_confirmed',
      tool_support_confirmed_at: timestamp,
    }]);

    // Update from list (which would normally pull profile data)
    manager.updateUserModelsFromList([{ name: 'llama3:8b' }]);

    const entry = manager.getUserModels()[0];
    // User's confirmation should be preserved, not overridden by profile
    expect(entry?.tool_support).toBe(false);
    expect(entry?.tool_support_source).toBe('user_confirmed');
    expect(entry?.tool_support_confirmed_at).toBe(timestamp);
  });

  it('allows profile data to override non-user-confirmed tool support', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();

    // Model has auto-detected tool support
    // Using qwen2.5:7b which has tool_support: true in profile
    manager.setUserModels([{
      id: 'qwen2.5:7b',
      name: 'Qwen2.5 7B',
      tool_support: false,
      tool_support_source: 'auto_detected',
      tool_support_confirmed_at: '2026-01-17T10:00:00Z',
    }]);

    // Update from list (profile data should override auto-detected)
    manager.updateUserModelsFromList([{ name: 'qwen2.5:7b' }]);

    const entry = manager.getUserModels()[0];
    // Profile data should override auto-detected value
    // Note: qwen2.5:7b profile has tool_support: true
    expect(entry?.tool_support).toBe(true);
    // Metadata should still be preserved
    expect(entry?.tool_support_source).toBe('auto_detected');
    expect(entry?.tool_support_confirmed_at).toBe('2026-01-17T10:00:00Z');
  });


  it('handles models without tool support metadata', async () => {
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();

    manager.setUserModels([{
      id: 'basic-model:latest',
      name: 'Basic Model',
      tool_support: false,
    }]);

    const entry = manager.getUserModels()[0];
    expect(entry?.tool_support).toBe(false);
    expect(entry?.tool_support_source).toBeUndefined();
    expect(entry?.tool_support_confirmed_at).toBeUndefined();
  });

  it('refreshMetadataAsync silently fails when Ollama is unavailable', async () => {
    // Mock fetch to simulate Ollama being unavailable
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const { ProfileManager } = await import('../ProfileManager.js');
    
    // Should not throw - constructor should complete successfully
    expect(() => new ProfileManager()).not.toThrow();
    
    // Wait a bit for async refresh to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  it('refreshMetadataAsync handles timeout gracefully', async () => {
    // Mock fetch to simulate timeout
    global.fetch = vi.fn().mockImplementation(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 3000)
      )
    );

    const { ProfileManager } = await import('../ProfileManager.js');
    
    // Should not throw - constructor should complete successfully
    expect(() => new ProfileManager()).not.toThrow();
    
    // Wait a bit for async refresh to complete
    await new Promise(resolve => setTimeout(resolve, 300));
  });

  it('refreshMetadataAsync updates models when Ollama is available', async () => {
    // Mock successful Ollama response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3:8b', size: 4661224448 },
          { name: 'codellama:7b', size: 3825819519 }
        ]
      })
    });

    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();
    
    // Wait for async refresh to complete
    await waitFor(() => manager.getUserModels().length > 0);
    
    const models = manager.getUserModels();
    expect(models.length).toBeGreaterThan(0);
    
    // Check that models were updated
    const llama3 = models.find(m => m.id === 'llama3:8b');
    expect(llama3).toBeDefined();
  });

  it('refreshMetadataAsync preserves user overrides during update', async () => {
    // Set up initial user model with overrides
    const { ProfileManager } = await import('../ProfileManager.js');
    const manager = new ProfileManager();
    
    const timestamp = '2026-01-17T10:30:00Z';
    manager.setUserModels([{
      id: 'llama3:8b',
      name: 'Llama 3 8B',
      tool_support: true,
      tool_support_source: 'user_confirmed',
      tool_support_confirmed_at: timestamp,
      manual_context: 16384,
    }]);

    // Mock successful Ollama response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llama3:8b', size: 4661224448 }
        ]
      })
    });

    // Trigger refresh by creating new instance
    const manager2 = new ProfileManager();
    
    // Wait for async refresh to complete
    await waitFor(() => {
        const m = manager2.getUserModels();
        return m.some(x => x.id === 'llama3:8b');
    });
    
    const models = manager2.getUserModels();
    const llama3 = models.find(m => m.id === 'llama3:8b');
    
    // Verify user overrides were preserved
    expect(llama3?.tool_support_source).toBe('user_confirmed');
    expect(llama3?.tool_support_confirmed_at).toBe(timestamp);
    expect(llama3?.manual_context).toBe(16384);
  });
});
