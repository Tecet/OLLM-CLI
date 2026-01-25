import { describe, it, expect } from 'vitest';

import { deriveGPUPlacementHints } from '../gpuHints.js';

import type { GPUInfo } from '@ollm/core';

const GB = 1024 ** 3;

function makeGpuInfo(overrides: Partial<GPUInfo> = {}): GPUInfo {
  return {
    available: true,
    vendor: 'nvidia',
    model: 'Test GPU',
    vramTotal: 16 * GB,
    vramUsed: 8 * GB,
    vramFree: 8 * GB,
    temperature: 55,
    temperatureMax: 90,
    gpuUtilization: 32,
    ...overrides,
  };
}

describe('deriveGPUPlacementHints', () => {
  it('returns undefined when GPU info is null', () => {
    const hints = deriveGPUPlacementHints(null, 8192);
    expect(hints).toBeUndefined();
  });

  it('returns undefined when GPU is unavailable', () => {
    const info = makeGpuInfo({ available: false });
    const hints = deriveGPUPlacementHints(info, 8192);
    expect(hints).toBeUndefined();
  });

  it('returns undefined when not enough free VRAM', () => {
    const info = makeGpuInfo({ vramFree: 512 * 1024 * 1024 });
    const hints = deriveGPUPlacementHints(info, 8192);
    expect(hints).toBeUndefined();
  });

  it('calculates hints limited by context', () => {
    const info = makeGpuInfo();
    const hints = deriveGPUPlacementHints(info, 8192);
    expect(hints).toEqual({ num_gpu: 1, gpu_layers: 16 });
  });

  it('clamps layers by max and context size', () => {
    const info = makeGpuInfo({ vramFree: 32 * GB });
    const hints = deriveGPUPlacementHints(info, 65536);
    expect(hints).toEqual({ num_gpu: 1, gpu_layers: 96 });
  });
});
