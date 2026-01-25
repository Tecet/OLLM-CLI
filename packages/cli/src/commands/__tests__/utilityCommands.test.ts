import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { testPromptCommand } from '../utilityCommands.js';
import * as contextContext from '../../features/context/ContextManagerContext.js';
import { profileManager } from '../../features/profiles/ProfileManager.js';
import * as gpuStore from '../../features/context/gpuHintStore.js';
import type { ContextMessage, GPUInfo } from '@ollm/core';

describe('/test prompt command', () => {
  let addSystemMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addSystemMessage = vi.fn();
    globalThis.__ollmAddSystemMessage = addSystemMessage;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.__ollmAddSystemMessage = undefined;
  });

  it('fails when the context manager is missing', async () => {
    vi.spyOn(contextContext, 'getGlobalContextManager').mockReturnValue(null);

    const result = await testPromptCommand.handler([]);

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
          metadata: { model: 'llama3.2:3b', contextSize: 4096, compressionHistory: [] },
        },
      ]) as Promise<ContextMessage[]>,
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

    const result = await testPromptCommand.handler([]);

    expect(result.success).toBe(true);
    expect(addSystemMessage).toHaveBeenCalled();
    const logged = addSystemMessage.mock.calls[0][0];
    expect(logged).toContain('=== Test Prompt Dump ===');
    expect(logged).toContain('System Prompt:');
    expect(logged).toContain('Context snippet');
    expect(logged).toContain('GPU hints:');
    expect(logged).toContain('GPU hints: num_gpu=1, gpu_layers=8');
    expect(logged).toContain('GPU info: Test GPU - 6.0 GB total / 3.0 GB free');
  });
});
