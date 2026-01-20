import { describe, it, expect, vi } from 'vitest';
import { createContextPool } from '../contextPool.js';
import { createMemoryGuard } from '../memoryGuard.js';

describe('MemoryGuard automatic compression invocation', () => {
  it('invokes compressionService.compress with ConversationContext object (exposes API mismatch)', async () => {
    // Create small pool so percentages are easy to reason about
    const pool = createContextPool({ targetContextSize: 1000 });
    pool.setCurrentTokens(850); // 85% -> WARNING (soft: 80%)

    // Minimal fake VRAM monitor (only methods used by MemoryGuard are stubbed)
    const fakeVram: any = {
      getInfo: async () => ({ total: 1000, used: 900, available: 100, modelLoaded: 0 }),
      onLowMemory: () => {},
      startMonitoring: () => {},
      stopMonitoring: () => {},
      setLowMemoryThreshold: () => {},
      resetCooldown: () => {},
      clearCache: () => {}
    };

    const guard = createMemoryGuard(fakeVram as any, pool);

    // Mock compression service that records the argument it received
    const mockCompression: any = {
      compress: vi.fn(async (_arg: unknown) => {
        // Return a resolved promise to allow MemoryGuard to continue
        return { summary: null };
      })
    };

    const mockSnapshot: any = { createSnapshot: vi.fn(async () => ({ id: 'snap-1' })) };

    guard.setServices({ compression: mockCompression, snapshot: mockSnapshot });

    // Set a ConversationContext that the MemoryGuard will pass to compression.compress()
    const conversationContext: any = {
      sessionId: 'session-123',
      messages: [
        { id: 'm1', role: 'system', content: 'system', timestamp: new Date(), tokenCount: 10 }
      ],
      systemPrompt: null,
      tokenCount: 10,
      maxTokens: 1000,
      metadata: { contextSize: 1000 }
    };

    guard.setContext(conversationContext);

    // Act: trigger check that should call compression at WARNING level
    await guard.checkMemoryLevelAndAct();

    // Assert: compression.compress was called once and argument is the ConversationContext object
    expect(mockCompression.compress).toHaveBeenCalledTimes(1);
    const calledWith = mockCompression.compress.mock.calls[0][0];
    expect(calledWith).toBe(conversationContext);

    // This demonstrates the API mismatch: MemoryGuard calls compress(this.currentContext)
    // while context/compression service implementations expect (messages, strategy) arguments.
  });
});
