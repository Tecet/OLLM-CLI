import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as contextContext from '../../features/context/ContextManagerContext.js';
import * as gpuStore from '../../features/context/gpuHintStore.js';
import { profileManager } from '../../features/profiles/ProfileManager.js';
import { testPromptCommand } from '../utilityCommands.js';

import type { ContextMessage, GPUInfo } from '@ollm/core';

describe('/test prompt command', () => {
  let addSystemMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSystemMessage = vi.fn();
    globalThis.__ollmAddSystemMessage = addSystemMessage as unknown as (message: string) => void;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.__ollmAddSystemMessage = undefined;
  });

  it('fails when the context manager is missing', async () => {
    vi.spyOn(contextContext, 'getGlobalContextManager').mockReturnValue(null);

    const handler = testPromptCommand.handler;
    expect(handler).toBeDefined();
    const result = await handler!([], {});

    expect(result.success).toBe(false);
    expect(result.message).toContain('Context Manager not initialized');
    expect(addSystemMessage).not.toHaveBeenCalled();
  });

  it('posts a debug dump when ready', async () => {
    const fakeManager = {
      getContext: vi.fn().mockResolvedValue([
        {
          id: 'user-1',
          role: 'user',
          content: 'Hello',
          timestamp: new Date(),
        },
      ] as ContextMessage[]),
      getSystemPrompt: vi.fn().mockReturnValue('System prompt'),
      getCurrentMode: vi.fn().mockReturnValue('assistant'),
      getUsage: vi.fn().mockReturnValue({
        currentTokens: 32,
        maxTokens: 4096,
        percentage: 0.78,
        vramUsed: 0,
        vramTotal: 0,
      }),
    };

    vi.spyOn(contextContext, 'getGlobalContextManager').mockReturnValue(fakeManager as any);

    vi.spyOn(profileManager, 'getModelEntry').mockReturnValue({
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B',
      context_profiles: [
        { size: 4096, ollama_context_size: 3500 },
      ],
      default_context: 4096,
      max_context_window: 4096,
      quantization: 'auto',
    } as any);

    const gpuInfo: GPUInfo = {
      available: true,
      vendor: 'nvidia',
      model: 'Test GPU',
      vramTotal: 6 * 1024 ** 3,
      vramUsed: 3 * 1024 ** 3,
      vramFree: 3 * 1024 ** 3,
      temperature: 55,
      temperatureMax: 90,
      gpuUtilization: 20,
    };
    vi.spyOn(gpuStore, 'getLastGPUInfo').mockReturnValue(gpuInfo);

    const handler = testPromptCommand.handler;
    expect(handler).toBeDefined();
    const result = await handler!([], {});

    expect(result.success).toBe(true);
    expect(addSystemMessage).toHaveBeenCalled();
    const logged = addSystemMessage.mock.calls[0][0];
    expect(logged).toContain('=== Options ===');
    expect(logged).toContain('=== Assistant Tier 1 ===');
    expect(logged).toContain('=== Rules ===');
    expect(logged).toContain('=== Mock User Message ===');
    expect(logged).toContain('=== Ollama Payload (collapsed) ===');
  });
});
