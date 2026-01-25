import { describe, it, expect } from 'vitest';

import { calculateContextSizing, getMaxContextWindow, validateManualContext } from '../contextSizing.js';

import type { UserModelEntry } from '../../../config/types.js';

const baseEntry: UserModelEntry = {
  id: 'test-model:7b',
  name: 'Test Model',
  description: 'Testing entry',
  source: 'profile',
  abilities: [],
  context_profiles: [
    { size: 4096, size_label: '4k', vram_estimate: '2 GB', ollama_context_size: 3000 },
    { size: 8192, size_label: '8k', vram_estimate: '3 GB', ollama_context_size: 6000 },
  ],
  default_context: 4096,
  max_context_window: 10000,
};

describe('contextSizing utilities', () => {
  it('calculates a max context from max_context_window', () => {
    const max = getMaxContextWindow(baseEntry);
    expect(max).toBe(10000);
  });

  it('falls back to the largest profile if max_context_window is missing', () => {
    const entryWithoutMax = { ...baseEntry, max_context_window: undefined };
    const max = getMaxContextWindow(entryWithoutMax);
    expect(max).toBe(8192);
  });

  it('clamps requested context and returns profile-based ollama cap', () => {
    const sizing = calculateContextSizing(15000, baseEntry);
    expect(sizing.allowed).toBe(10000);
    expect(sizing.max).toBe(10000);
    expect(sizing.ollamaContextSize).toBe(6000);
    expect(sizing.ratio).toBeCloseTo(0.6);
  });

  it('uses the matching profile when available', () => {
    const sizing = calculateContextSizing(8192, baseEntry);
    expect(sizing.allowed).toBe(8192);
    expect(sizing.ollamaContextSize).toBe(6000);
    expect(sizing.ratio).toBeCloseTo(6000 / 8192);
  });

  it('falls back to the 85% cap when a profile omits ollama_context_size', () => {
    const fallbackEntry = {
      ...baseEntry,
      context_profiles: [
        { size: 8192 }
      ],
      default_context: 8192
    };

    const sizing = calculateContextSizing(8192, fallbackEntry);
    const expectedCap = Math.floor(8192 * 0.85);

    expect(sizing.allowed).toBe(8192);
    expect(sizing.ollamaContextSize).toBe(expectedCap);
    expect(sizing.ratio).toBeCloseTo(expectedCap / 8192);
  });

  it('validates manual context values against the cap', () => {
    const validation = validateManualContext(baseEntry, 12000);
    expect(validation.valid).toBe(false);
    expect(validation.max).toBe(10000);
    expect(validation.message).toContain('Maximum context for');

    const valid = validateManualContext(baseEntry, 5000);
    expect(valid.valid).toBe(true);
  });
});
