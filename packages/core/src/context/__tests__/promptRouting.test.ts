import { createContextManager } from '../contextManager.js';
import { OperationalMode , SYSTEM_PROMPT_TEMPLATES } from '../types.js';


describe('Prompt routing - tier × mode', () => {
  test('applies tier1-assistant when autoSize is false and targetSize=4096', async () => {
    const manager = createContextManager('test-session', { parameters: 13, contextLimit: 4096 }, { autoSize: false, targetSize: 4096 });
    // start() will initialize tiers and apply prompt
    await manager.start();

    // Ensure mode is assistant
    manager.setMode(OperationalMode.ASSISTANT);

    const prompt = manager.getSystemPrompt();
    expect(prompt).toBeTruthy();
    // Expect the assistant Tier 1 template short phrase to be present
    expect(prompt).toMatch(/You are a helpful assistant/i);
  });

  test('full matrix: 5 tiers × 4 modes produce a prompt (smoke test)', async () => {
    const tiers: Array<{ size: number; name: string }> = [
      { size: 2048, name: 'tier1' },
      { size: 4096, name: 'tier2' },
      { size: 8192, name: 'tier3' },
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
        // basic smoke assertion: prompt contains a mode-related keyword
        if (mode === OperationalMode.DEVELOPER) expect(prompt).toMatch(/code|TypeScript|developer/i);
        if (mode === OperationalMode.PLANNING) expect(prompt).toMatch(/plan|task|estimate|Planning/i);
        if (mode === OperationalMode.ASSISTANT) expect(prompt).toMatch(/assistant|helpful|explain/i);
        if (mode === OperationalMode.DEBUGGER) expect(prompt).toMatch(/debug|error|stack trace|reproduce|reproduction/i);
      }
    }
  }, 20000);

  test('exhaustive: each tier × mode uses the correct SYSTEM_PROMPT_TEMPLATES entry', async () => {
    const tierCases: Array<{ size: number; key: string }> = [
      { size: 2048, key: 'tier1' },
      { size: 5000, key: 'tier2' },
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
        const expectedKey = `${tierCase.key}-${mode}`;
        const expected = SYSTEM_PROMPT_TEMPLATES[expectedKey];

        expect(expected).toBeDefined();
        expect(prompt).toBe(expected.template);
      }
    }
  }, 30000);
});
