import type { GPUPlacementHints } from './gpuHints.js';
import type { GPUInfo } from '@ollm/core';

let lastHints: GPUPlacementHints | undefined;
let lastGPUInfo: GPUInfo | null = null;

export function setLastGPUPlacementHints(hints?: GPUPlacementHints): void {
  lastHints = hints;
}

export function getLastGPUPlacementHints(): GPUPlacementHints | undefined {
  return lastHints;
}

export function setLastGPUInfo(info: GPUInfo | null): void {
  lastGPUInfo = info;
}

export function getLastGPUInfo(): GPUInfo | null {
  return lastGPUInfo;
}
