import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

import { LocalProvider } from '../provider/localProvider.js';

// Mock core imports used by LocalProvider
vi.mock('@ollm/core', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, error: () => {} }),
  createVRAMMonitor: () => ({ getInfo: async () => ({ available: 0, used: 0, total: 0 }) }),
}));
vi.mock('@ollm/core/context/gpuHints.js', () => ({ deriveGPUPlacementHints: () => undefined }));

describe('LocalProvider option key mapping', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async (_url: string, opts: any) => {
      // Capture the body JSON and return a minimal successful response
      const body = JSON.parse(opts.body);
      // Return a response-like object with body.getReader()
      return {
        ok: true,
        body: {
          getReader() {
            return {
              async read() {
                return { done: true, value: undefined };
              },
            };
          },
        },
        async text() {
          return JSON.stringify(body);
        },
      } as any;
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
  });

  it('mirrors maxTokens to max_new_tokens and max_tokens', async () => {
    const provider = new LocalProvider({ baseUrl: 'localhost:11434', timeout: 1000 });

    let capturedBody: any = null;

    // Replace global.fetch with a spy that captures the body
    (global.fetch as unknown as Mock).mockImplementation(async (_url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        body: {
          getReader() {
            return {
              async read() {
                return { done: true, value: undefined };
              },
            };
          },
        },
        async text() {
          return JSON.stringify(capturedBody);
        },
      } as any;
    });

    const request = {
      model: 'llama3.2:3b',
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      options: { num_ctx: 3482, maxTokens: 1200 },
      think: false,
    } as any;

    // Drain the async iterable
    for await (const _ of provider.chatStream(request)) {
      // noop
    }

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.options).toBeDefined();
    expect(capturedBody.options.maxTokens).toBe(1200);
    expect(capturedBody.options.max_new_tokens).toBe(1200);
    expect(capturedBody.options.max_tokens).toBe(1200);
  });
});
