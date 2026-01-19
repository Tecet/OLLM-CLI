import { describe, it, expect } from 'vitest';
import { CompressionService } from '../compressionService.js';

describe('CompressionService API mismatch (context vs services)', () => {
  it('shows different behavior when used with ChatClient-style args vs expected args', async () => {
    const service = new CompressionService();

    // Simulate a session message array (ChatClient-style call)
    const sessionMessages: any[] = [
      { role: 'user', content: 'A'.repeat(4000), timestamp: new Date() }
    ];

    const tokenLimit = 1000;
    const threshold = 0.8;

    // Expected usage: pass tokenCount (number) and threshold
    const actualTokenCount = Math.ceil(4000 / 4); // matches other heuristics in repo
    expect(actualTokenCount).toBe(1000);

    // When called with the correct signature, shouldCompress behaves as expected
    const expectTrue = (service as any).shouldCompress(actualTokenCount, threshold);
    expect(expectTrue).toBe(true);

    // When called with ChatClient-style parameters (messages, tokenLimit, threshold), behavior differs
    // This demonstrates the mismatch: ChatClient calls shouldCompress(sessionMessages, tokenLimit, threshold)
    // while context/compression's shouldCompress expects (tokenCount, threshold).
    const chatClientStyleCall = (service as any).shouldCompress(sessionMessages, tokenLimit, threshold);
    // We expect this to NOT equal the intended decision based on token counts (i.e., a mismatch)
    expect(chatClientStyleCall).not.toBe(expectTrue);
  });
});
