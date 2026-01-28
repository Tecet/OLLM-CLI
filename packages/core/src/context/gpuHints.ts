import type { GPUInfo } from '../services/gpuMonitor.js';

export interface GPUPlacementHints {
  num_gpu: number;
  gpu_layers: number;
}

const MIN_FREE_VRAM_BYTES = 1 * 1024 ** 3; // 1 GB
const GPU_LAYER_CHUNK_BYTES = 256 * 1024 * 1024; // 256 MB per layer (heuristic)
const MIN_GPU_LAYERS = 4;
const MAX_GPU_LAYERS = 96;

export type GPUInfoSource = GPUInfo | { vramFree?: number; available?: number } | null | undefined;

export function deriveGPUPlacementHints(
  info: GPUInfoSource,
  contextSize: number
): GPUPlacementHints | undefined {
  if (!info || contextSize <= 0) {
    return undefined;
  }

  if ('available' in info && typeof info.available === 'boolean' && !info.available) {
    return undefined;
  }

  let freeVram: number | undefined;
  if ('vramFree' in info && typeof info.vramFree === 'number') {
    freeVram = info.vramFree;
  } else if ('available' in info && typeof info.available === 'number') {
    freeVram = info.available;
  }

  if (!freeVram || freeVram < MIN_FREE_VRAM_BYTES) {
    return undefined;
  }

  const normalizedContextSize = Math.max(contextSize, 512);
  const layersByVram = Math.floor(freeVram / GPU_LAYER_CHUNK_BYTES);
  const contextLayerLimit = Math.max(8, Math.floor(normalizedContextSize / 512));

  const gpuLayers = Math.min(
    MAX_GPU_LAYERS,
    Math.max(MIN_GPU_LAYERS, Math.min(layersByVram, contextLayerLimit))
  );

  if (gpuLayers <= 0) {
    return undefined;
  }

  // num_gpu in Ollama is the number of layers to load on GPU (not number of GPUs)
  // Setting it to 999 forces all model layers to GPU
  // We don't set gpu_layers as it can conflict with num_gpu
  return {
    num_gpu: 999,
    gpu_layers: 0, // Not used, kept for compatibility
  };
}
