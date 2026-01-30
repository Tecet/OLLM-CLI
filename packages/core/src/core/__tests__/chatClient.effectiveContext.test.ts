import { describe, it, expect } from 'vitest';

import { ChatClient } from '../chatClient';

describe('ChatClient effective num_ctx', () => {
  it('sets maxTokens and num_ctx based on usage and ollama limit', async () => {
    let capturedRequest: any = null;

    const provider = {
      async *chatStream(request: any) {
        capturedRequest = request;
        // Immediately finish the stream
        yield { type: 'finish' };
      },
    };

    const providerRegistry = {
      getDefault: () => provider,
    } as any;

    const toolRegistry = {} as any;

    const contextMgmtManager = {
      getUsage: () => ({ maxTokens: 4096, currentTokens: 2000, percentage: 50 }),
      getOllamaContextLimit: () => 3482,
      isSummarizationInProgress: () => false,
      waitForSummarization: async () => {},
      addMessage: async () => {},
      getMessages: async () => [],
    } as any;

    const client = new ChatClient(providerRegistry, toolRegistry, {
      contextMgmtManager,
    });

    // Drive the chat generator to completion
    for await (const _ of client.chat('hello')) {
      // noop
    }

    expect(capturedRequest).not.toBeNull();

    // remaining = 3482 - 2000 = 1482
    // safeMax = remaining - 100 = 1382
    // effectiveNumCtx = min(3482, 2000 + 1382) = 3382
    expect(capturedRequest.options.maxTokens).toBe(1382);
    expect(capturedRequest.options.num_ctx).toBe(3382);
  });
});
