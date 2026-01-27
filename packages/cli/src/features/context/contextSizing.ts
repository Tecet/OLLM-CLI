/**
 * Context Sizing - CLI Layer Utilities
 * 
 * Provides CLI-specific context sizing utilities that delegate to core ContextSizeCalculator.
 * This file bridges the CLI layer (which uses UserModelEntry) with the core layer.
 * 
 * Responsibilities:
 * - Extract context profiles from UserModelEntry
 * - Validate user input for manual context sizing
 * - Calculate context sizing results for CLI display
 * 
 * Does NOT:
 * - Calculate tiers (core ContextSizeCalculator does this)
 * - Manage VRAM (core does this)
 * - Store state (just pure functions)
 */

import * as ContextSizeCalculator from '@ollm/core/context/ContextSizeCalculator';

import type { ContextProfile, UserModelEntry } from '../../config/types.js';

export interface ContextSizingResult {
  requested: number;
  allowed: number;
  max: number;
  matchingProfile?: ContextProfile;
  ollamaContextSize: number;
  ratio: number;
}

export interface ManualContextValidation {
  valid: boolean;
  max: number;
  message?: string;
}

/**
 * Get maximum context window for a model
 */
export function getMaxContextWindow(entry: UserModelEntry): number {
  const profiles = entry.context_profiles ?? [];
  
  if (profiles.length === 0) {
    return entry.max_context_window ?? entry.default_context ?? 4096;
  }

  // Find largest profile size
  const largestProfile = profiles.reduce((max, profile) => 
    (profile.size ?? 0) > (max.size ?? 0) ? profile : max
  );

  const largestSize = largestProfile.size ?? 0;
  const fallback = largestSize || entry.default_context || 4096;
  
  return Math.max(1, entry.max_context_window ?? fallback);
}

/**
 * Clamp context size to valid range for model
 */
export function clampContextSize(requested: number, entry: UserModelEntry): number {
  if (!Number.isFinite(requested) || requested <= 0) {
    return Math.max(1, entry.default_context ?? 4096);
  }
  
  const max = getMaxContextWindow(entry);
  return ContextSizeCalculator.clampContextSize(requested, 1, max);
}

/**
 * Calculate context sizing result for CLI display
 * Delegates to core ContextSizeCalculator for Ollama size calculation
 */
export function calculateContextSizing(
  requested: number,
  entry: UserModelEntry,
  contextCapRatio: number = 0.85
): ContextSizingResult {
  const max = getMaxContextWindow(entry);
  const allowed = clampContextSize(requested, entry);
  const profiles = entry.context_profiles ?? [];
  
  // Find matching profile
  const matchingProfile = profiles.find(profile => profile.size === allowed);
  
  // Get Ollama context size using core calculator
  const ollamaContextSize = ContextSizeCalculator.getOllamaContextSize(
    allowed,
    profiles
  );
  
  // Calculate ratio
  const ratio = allowed > 0 ? ollamaContextSize / allowed : 0.85;

  return {
    requested,
    allowed,
    max,
    matchingProfile,
    ollamaContextSize,
    ratio,
  };
}

/**
 * Validate manual context input from user
 */
export function validateManualContext(
  entry: UserModelEntry,
  value: number
): ManualContextValidation {
  const max = getMaxContextWindow(entry);
  
  if (value <= 0) {
    return {
      valid: false,
      max,
      message: 'Context size must be a positive integer.',
    };
  }
  
  if (value > max) {
    const displayName = entry.name || entry.id;
    return {
      valid: false,
      max,
      message: `Maximum context for ${displayName} is ${max} tokens. Enter ${max} or a smaller value, or type "cancel" to abort.`,
    };
  }

  return { valid: true, max };
}
