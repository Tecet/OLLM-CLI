/**
 * ContextSizeCalculator
 * 
 * ONE file that does ALL context size calculations.
 * Uses model profiles from LLM_profiles.json (via ~/.ollm/LLM_profiles.json)
 * No hardcoded values, no side effects, pure functions, testable.
 */

import { ContextTier } from './types.js';

import type { ContextProfile } from './types.js';

export interface TierOption {
  tier: ContextTier;
  size: number; // UI display size (e.g., 4096)
  ollamaSize: number; // Actual size sent to Ollama (~85% of size)
  label: string;
  description: string;
  vramRequired: number; // GB
}

export interface AvailableTiers {
  minTier: ContextTier;
  maxTier: ContextTier;
  options: TierOption[];
}

/**
 * Map context size to tier enum
 */
function sizeToTier(size: number): ContextTier {
  if (size <= 4096) return ContextTier.TIER_1_MINIMAL;
  if (size <= 8192) return ContextTier.TIER_2_BASIC;
  if (size <= 16384) return ContextTier.TIER_3_STANDARD;
  if (size <= 32768) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

/**
 * Calculate available context tiers based on VRAM and model's context profiles
 * 
 * @param availableVRAM - Available VRAM in GB
 * @param contextProfiles - Model's context profiles from LLM_profiles.json
 * @param maxContextWindow - Model's maximum context window
 */
export function calculateAvailableTiers(
  availableVRAM: number,
  contextProfiles: ContextProfile[],
  maxContextWindow: number
): AvailableTiers {
  if (!contextProfiles || contextProfiles.length === 0) {
    // Fallback if no profiles (shouldn't happen)
    const fallbackTier: TierOption = {
      tier: ContextTier.TIER_2_BASIC,
      size: 8192,
      ollamaSize: Math.floor(8192 * 0.85),
      label: '8K',
      description: 'Standard context',
      vramRequired: 4.0
    };
    return {
      minTier: ContextTier.TIER_2_BASIC,
      maxTier: ContextTier.TIER_2_BASIC,
      options: [fallbackTier]
    };
  }

  // Filter profiles that fit in available VRAM
  const availableProfiles = contextProfiles.filter(profile => {
    const vramRequired = profile.vram_estimate_gb || 0;
    return vramRequired <= availableVRAM && profile.size <= maxContextWindow;
  });

  if (availableProfiles.length === 0) {
    // No profiles fit, use smallest one
    const smallest = contextProfiles[0];
    const tier: TierOption = {
      tier: sizeToTier(smallest.size),
      size: smallest.size,
      ollamaSize: smallest.ollama_context_size || Math.floor(smallest.size * 0.85),
      label: smallest.size_label || `${smallest.size}`,
      description: `${smallest.vram_estimate || 'Unknown VRAM'}`,
      vramRequired: smallest.vram_estimate_gb || 0
    };
    return {
      minTier: tier.tier,
      maxTier: tier.tier,
      options: [tier]
    };
  }

  // Convert profiles to tier options
  const options: TierOption[] = availableProfiles.map(profile => ({
    tier: sizeToTier(profile.size),
    size: profile.size,
    ollamaSize: profile.ollama_context_size || Math.floor(profile.size * 0.85),
    label: profile.size_label || `${profile.size}`,
    description: `${profile.vram_estimate || 'Unknown VRAM'}`,
    vramRequired: profile.vram_estimate_gb || 0
  }));

  return {
    minTier: options[0].tier,
    maxTier: options[options.length - 1].tier,
    options
  };
}


/**
 * Determine which tier a given context size belongs to
 */
export function determineTier(contextSize: number): ContextTier {
  if (contextSize <= 4096) return ContextTier.TIER_1_MINIMAL;
  if (contextSize <= 8192) return ContextTier.TIER_2_BASIC;
  if (contextSize <= 16384) return ContextTier.TIER_3_STANDARD;
  if (contextSize <= 32768) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

/**
 * Get the Ollama context size for a given user-facing size from profiles
 * Returns the pre-calculated ollama_context_size (~85%)
 */
export function getOllamaContextSize(
  userSize: number,
  contextProfiles: ContextProfile[]
): number {
  if (!contextProfiles || contextProfiles.length === 0) {
    // Fallback: calculate 85%
    return Math.floor(userSize * 0.85);
  }

  // Find exact match first
  const exactMatch = contextProfiles.find(p => p.size === userSize);
  if (exactMatch && exactMatch.ollama_context_size) {
    return exactMatch.ollama_context_size;
  }

  // Find closest profile that meets or exceeds user size
  const matchingProfile = contextProfiles.find(p => p.size >= userSize);
  if (matchingProfile && matchingProfile.ollama_context_size) {
    return matchingProfile.ollama_context_size;
  }

  // Use largest profile as fallback
  if (contextProfiles.length > 0) {
    const largestProfile = contextProfiles[contextProfiles.length - 1];
    if (largestProfile.ollama_context_size) {
      return largestProfile.ollama_context_size;
    }
  }

  // Final fallback: calculate 85%
  return Math.floor(userSize * 0.85);
}

/**
 * Get user-facing size from Ollama context size
 */
export function getUserSizeFromOllama(
  ollamaSize: number,
  contextProfiles: ContextProfile[]
): number {
  if (!contextProfiles || contextProfiles.length === 0) {
    // Fallback: reverse 85% calculation
    return Math.floor(ollamaSize / 0.85);
  }

  // Find profile with matching ollama_context_size
  const matchingProfile = contextProfiles.find(p => p.ollama_context_size === ollamaSize);
  if (matchingProfile) {
    return matchingProfile.size;
  }

  // Find closest profile
  const closestProfile = contextProfiles.reduce((closest, current) => {
    const currentDiff = Math.abs((current.ollama_context_size || 0) - ollamaSize);
    const closestDiff = Math.abs((closest.ollama_context_size || 0) - ollamaSize);
    return currentDiff < closestDiff ? current : closest;
  });

  return closestProfile.size;
}

/**
 * Validate if a context size is valid for the given model
 */
export function isValidContextSize(
  size: number,
  contextProfiles: ContextProfile[],
  maxContextWindow: number
): boolean {
  // Must be within model's max context
  if (size > maxContextWindow) return false;

  // Must match one of the available profiles
  return contextProfiles.some(p => p.size === size);
}

/**
 * Calculate bytes per token for KV cache based on model parameters and quantization
 * 
 * Formula: 2 (K+V) × layers × hidden_dim × bytes_per_value
 * 
 * For typical transformer models:
 * - 7B model: ~32 layers, 4096 hidden
 * - 13B model: ~40 layers, 5120 hidden
 * - 70B model: ~80 layers, 8192 hidden
 * 
 * Simplified approximation: (params_in_billions * 37,500) * bytes_per_value
 */
export function calculateBytesPerToken(
  modelParams: number,
  quantization: 'f16' | 'q8_0' | 'q4_0'
): number {
  // Bytes per value based on quantization type
  const bytesPerValue: Record<string, number> = {
    'f16': 2,    // 2 bytes per value
    'q8_0': 1,   // 1 byte per value
    'q4_0': 0.5  // 0.5 bytes per value
  };

  const bytes = bytesPerValue[quantization] || 1;
  return modelParams * 37500 * bytes;
}

/**
 * Calculate optimal context size based on available VRAM
 * 
 * @param availableVRAM - Available VRAM in bytes
 * @param reserveBuffer - Safety buffer in bytes (e.g., 512MB)
 * @param modelParams - Model parameters in billions
 * @param quantization - KV cache quantization type
 * @param modelContextLimit - Model's maximum context window
 * @param minSize - Minimum allowed context size
 * @param maxSize - Maximum allowed context size
 * @returns Optimal context size in tokens
 */
export function calculateOptimalContextSize(
  availableVRAM: number,
  reserveBuffer: number,
  modelParams: number,
  quantization: 'f16' | 'q8_0' | 'q4_0',
  modelContextLimit: number,
  minSize: number = 2048,
  maxSize: number = 131072
): number {
  // Calculate usable VRAM
  const usableVRAM = availableVRAM - reserveBuffer;

  // Ensure we have positive usable VRAM
  if (usableVRAM <= 0) {
    return minSize;
  }

  // Calculate bytes per token
  const bytesPerToken = calculateBytesPerToken(modelParams, quantization);

  // Calculate optimal size
  const optimalSize = Math.floor(usableVRAM / bytesPerToken);

  // Clamp to min/max and model limit
  return Math.max(minSize, Math.min(optimalSize, modelContextLimit, maxSize));
}

/**
 * Clamp size to min/max bounds
 */
export function clampContextSize(
  size: number,
  minSize: number = 2048,
  maxSize: number = 131072
): number {
  return Math.max(minSize, Math.min(size, maxSize));
}