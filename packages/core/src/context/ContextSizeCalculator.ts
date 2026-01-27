/**
 * ContextSizeCalculator
 * 
 * ONE file that does ALL context size calculations.
 * No side effects, pure functions, testable.
 */

import { ContextTier } from './types.js';

export interface TierOption {
  tier: ContextTier;
  size: number;
  label: string;
  description: string;
}

export interface AvailableTiers {
  minTier: ContextTier;
  maxTier: ContextTier;
  options: TierOption[];
}

export interface ModelRequirements {
  modelContextSize: number;
  modelName: string;
}

/**
 * Calculate available context tiers based on VRAM and model requirements
 */
export function calculateAvailableTiers(
  availableVRAM: number,
  modelRequirements: ModelRequirements
): AvailableTiers {
  const { modelContextSize } = modelRequirements;

  // Define all possible tiers
  const allTiers: TierOption[] = [
    { tier: ContextTier.TIER_1_MINIMAL, size: 2048, label: 'Tier 1 (2K)', description: 'Minimal context' },
    { tier: ContextTier.TIER_2_BASIC, size: 4096, label: 'Tier 2 (4K)', description: 'Basic context' },
    { tier: ContextTier.TIER_3_STANDARD, size: 8192, label: 'Tier 3 (8K)', description: 'Standard context' },
    { tier: ContextTier.TIER_4_PREMIUM, size: 16384, label: 'Tier 4 (16K)', description: 'Extended context' },
    { tier: ContextTier.TIER_5_ULTRA, size: 32768, label: 'Tier 5 (32K)', description: 'Maximum context' },
  ];

  // Filter tiers based on model's max context size
  const modelSupportedTiers = allTiers.filter(t => t.size <= modelContextSize);

  if (modelSupportedTiers.length === 0) {
    // Model doesn't support even tier 1, return tier 1 anyway
    return {
      minTier: ContextTier.TIER_1_MINIMAL,
      maxTier: ContextTier.TIER_1_MINIMAL,
      options: [allTiers[0]]
    };
  }

  // Calculate VRAM-based max tier (rough estimation)
  // This is simplified - real calculation would be more complex
  const vramBasedMaxSize = Math.floor(availableVRAM * 1024); // Convert GB to rough token estimate
  const vramSupportedTiers = modelSupportedTiers.filter(t => t.size <= vramBasedMaxSize);

  const availableOptions = vramSupportedTiers.length > 0 ? vramSupportedTiers : [modelSupportedTiers[0]];

  return {
    minTier: availableOptions[0].tier,
    maxTier: availableOptions[availableOptions.length - 1].tier,
    options: availableOptions
  };
}

/**
 * Determine which tier a given context size belongs to
 */
export function determineTier(contextSize: number): ContextTier {
  if (contextSize <= 2048) return ContextTier.TIER_1_MINIMAL;
  if (contextSize <= 4096) return ContextTier.TIER_2_BASIC;
  if (contextSize <= 8192) return ContextTier.TIER_3_STANDARD;
  if (contextSize <= 16384) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

/**
 * Get the context size for a specific tier
 */
export function getTierSize(tier: ContextTier): number {
  const sizes: Record<ContextTier, number> = {
    [ContextTier.TIER_1_MINIMAL]: 2048,
    [ContextTier.TIER_2_BASIC]: 4096,
    [ContextTier.TIER_3_STANDARD]: 8192,
    [ContextTier.TIER_4_PREMIUM]: 16384,
    [ContextTier.TIER_5_ULTRA]: 32768
  };
  return sizes[tier] || 8192; // Default to tier 3
}

/**
 * Validate if a context size is valid for the given constraints
 */
export function isValidContextSize(
  size: number,
  modelRequirements: ModelRequirements,
  availableVRAM: number
): boolean {
  const { modelContextSize } = modelRequirements;
  
  // Must be within model's limits
  if (size > modelContextSize) return false;
  
  // Must be within VRAM limits (rough check)
  const vramBasedMaxSize = Math.floor(availableVRAM * 1024);
  if (size > vramBasedMaxSize) return false;
  
  return true;
}