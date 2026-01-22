import { join } from 'path';
import { HotSwapService } from '../HotSwapService.js';
import { SnapshotManager } from '../../prompts/SnapshotManager.js';

describe('HotSwap reasoning traces', () => {
  test('stores reasoningTraces in transition snapshot when messages contain <think> blocks', async () => {
    const snapshotManager = new SnapshotManager({ storagePath: join(process.cwd(), '.test-snapshots') });
    // Minimal prompt registry mock
    const promptRegistry = { register: (_: any) => {} };

    // Provider that yields no events (generateSnapshot will return empty string)
    const provider = {
      async *chatStream(_req: any) {
        // no output required for this test
      }
    };

    const modeManager = {
      getCurrentMode: () => 'assistant',
      getActiveSkills: () => [] as string[],
      switchMode: (_: any, __: any, ___: any) => {},
      updateSkills: (_: string[]) => {},
      buildPrompt: (_: any) => 'system prompt'
    } as any;

    const contextManager = {
      getMessages: async () => [
        { role: 'user', content: 'Please debug this.' },
        { role: 'assistant', content: 'I will inspect. <think>Root cause: missing semicolon</think> I suggest fix.' },
        { role: 'user', content: 'Proceed with fix.' }
      ],
      clear: async () => {},
      setSystemPrompt: (_: string) => {},
      addMessage: async (_: any) => {},
      emit: (_: string, __: any) => {}
    } as any;

    await snapshotManager.initialize();

    const svc = new HotSwapService(contextManager as any, promptRegistry as any, provider as any, 'llama3.1:abc', modeManager, snapshotManager);

    // Trigger swap with preserveHistory=false to force snapshot creation
    await svc.swap(undefined, false);

    const snap = snapshotManager.getSnapshot('assistant' as any, 'assistant' as any);
    expect(snap).toBeTruthy();
    // reasoningTraces should be present and contain the extracted block
    expect((snap as any).reasoningTraces).toBeDefined();
    expect((snap as any).reasoningTraces.length).toBeGreaterThan(0);
    expect(String((snap as any).reasoningTraces[0].content)).toMatch(/root cause: missing semicolon/i);
  });
});
