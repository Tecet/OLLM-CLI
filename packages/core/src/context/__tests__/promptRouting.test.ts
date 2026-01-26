import { TieredPromptStore } from '../../prompts/tieredPromptStore.js';
import { createContextManager } from '../contextManager.js';
import { ContextTier, OperationalMode } from '../types.js';

const store = new TieredPromptStore();
process.stdout.write('[TEST] About to load store...\n');
store.load();
process.stdout.write(`[TEST] Store loaded, templates count: ${(store as any).templates.size}\n`);

const getTierForSize = (size: number): ContextTier => {
  if (size < 8192) return ContextTier.TIER_1_MINIMAL;
  if (size < 16384) return ContextTier.TIER_2_BASIC;
  if (size < 32768) return ContextTier.TIER_3_STANDARD;
  if (size < 65536) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
};

describe('Prompt routing - tier × mode', () => {
  test('applies tier1-assistant when autoSize is false and targetSize=4096', async () => {
    const manager = createContextManager('test-session', { parameters: 13, contextLimit: 4096 }, { autoSize: false, targetSize: 4096 });
    // start() will initialize tiers and apply prompt
    await manager.start();

    // Ensure mode is assistant
    manager.setMode(OperationalMode.ASSISTANT);

    const prompt = manager.getSystemPrompt();
    expect(prompt).toBeTruthy();
    const expected = store.get(OperationalMode.ASSISTANT, ContextTier.TIER_1_MINIMAL);
    process.stdout.write(`[TEST] Expected value type: ${typeof expected}, value: "${expected?.substring(0, 50)}..."\n`);
    process.stdout.write(`[TEST] Prompt contains expected: ${prompt.includes(expected || '')}\n`);
    expect(expected).toBeTruthy();
    expect(prompt).toContain(expected as string);
  });

  test('full matrix: 5 tiers × 4 modes include tiered prompt content', async () => {
    const tiers: Array<{ size: number; name: string }> = [
      { size: 2048, name: 'tier1' },
      { size: 4096, name: 'tier1-high' },
      { size: 8192, name: 'tier2' },
      { size: 16384, name: 'tier3' },
      { size: 32768, name: 'tier4' },
      { size: 65536, name: 'tier5' }
    ];

    const modes = [
      OperationalMode.DEVELOPER,
      OperationalMode.PLANNING,
      OperationalMode.ASSISTANT,
      OperationalMode.DEBUGGER
    ];

    for (const tier of tiers) {
      // create manager in manual mode so prompts follow target size
      const manager = createContextManager('matrix-session', { parameters: 13, contextLimit: tier.size }, { autoSize: false, targetSize: tier.size });
      await manager.start();

      for (const mode of modes) {
        manager.setMode(mode);
        const prompt = manager.getSystemPrompt();
        expect(prompt).toBeTruthy();
        const expected = store.get(mode, getTierForSize(tier.size));
        expect(expected).toBeTruthy();
        expect(prompt).toContain(expected as string);
      }
    }
  }, 20000);

  test('exhaustive: each tier × mode uses the correct prompt file content', async () => {
    const tierCases: Array<{ size: number; key: string }> = [
      { size: 2048, key: 'tier1' },
      { size: 4096, key: 'tier1-high' },
      { size: 10000, key: 'tier2' },
      { size: 16000, key: 'tier3' },
      { size: 50000, key: 'tier4' },
      { size: 100000, key: 'tier5' }
    ];

    const modes = [
      OperationalMode.DEVELOPER,
      OperationalMode.PLANNING,
      OperationalMode.ASSISTANT,
      OperationalMode.DEBUGGER
    ];

    for (const tierCase of tierCases) {
      const manager = createContextManager('exhaustive-session', { parameters: 13, contextLimit: tierCase.size }, { autoSize: false, targetSize: tierCase.size });
      await manager.start();

      for (const mode of modes) {
        manager.setMode(mode);

        const prompt = manager.getSystemPrompt();
        const expected = store.get(mode, getTierForSize(tierCase.size));
        expect(expected).toBeTruthy();
        expect(prompt).toContain(expected as string);
      }
    }
  }, 30000);
});
