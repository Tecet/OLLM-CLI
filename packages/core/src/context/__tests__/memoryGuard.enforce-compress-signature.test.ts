import { describe, it, expect, vi } from 'vitest';
import { createContextPool } from '../contextPool.js';
import { createMemoryGuard } from '../memoryGuard.js';

describe('MemoryGuard compression signature enforcement (failing test)', () => {
  it('must call compression.compress(messages[], strategy) on WARNING', async () => {
    const pool = createContextPool({ targetContextSize: 1000 });
    pool.setCurrentTokens(850); // 85% -> WARNING

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

    // Mock compression service expecting (messages[], strategy)
    const mockCompression: any = {
      compress: vi.fn(async (messages: unknown[], strategy: Record<string, unknown>) => {
        return { summary: null };
      })
    };

    const mockSnapshot: any = { createSnapshot: vi.fn(async () => ({ id: 'snap-1' })) };

    guard.setServices({ compression: mockCompression, snapshot: mockSnapshot });

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

    // Act
    await guard.checkMemoryLevelAndAct();

    // Assert: Should have been called with (messages[], strategy) - this WILL fail with current code
    expect(mockCompression.compress).toHaveBeenCalled();
    const args = mockCompression.compress.mock.calls[0];
    // Expected: first arg is an array of messages, second arg is a strategy object
    expect(Array.isArray(args[0])).toBe(true);
    expect(args[1]).toBeDefined();
    expect(typeof args[1]).toBe('object');
  });
});
