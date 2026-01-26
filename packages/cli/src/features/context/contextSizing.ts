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

function sortProfiles(profiles: ContextProfile[] = []): ContextProfile[] {
  return [...profiles].sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
}

export function getMaxContextWindow(entry: UserModelEntry): number {
  const sortedProfiles = sortProfiles(entry.context_profiles ?? []);
  const largestProfileSize = sortedProfiles.length > 0 ? sortedProfiles[sortedProfiles.length - 1].size ?? 0 : 0;
  const fallback = largestProfileSize || entry.default_context || 4096;
  return Math.max(1, entry.max_context_window ?? fallback);
}

export function clampContextSize(requested: number, entry: UserModelEntry): number {
  if (!Number.isFinite(requested) || requested <= 0) {
    return Math.max(1, entry.default_context ?? 4096);
  }
  return Math.min(requested, getMaxContextWindow(entry));
}

export function calculateContextSizing(
  requested: number,
  entry: UserModelEntry,
  contextCapRatio: number = 0.85
): ContextSizingResult {
  const max = getMaxContextWindow(entry);
  const allowed = Math.max(1, Math.min(requested, max));
  const sortedProfiles = sortProfiles(entry.context_profiles ?? []);
  const matchingProfile = sortedProfiles.find(profile => profile.size === allowed);
  const fallbackProfile = matchingProfile ?? (sortedProfiles.length > 0 ? sortedProfiles[sortedProfiles.length - 1] : undefined);
  const safeRatio = Number.isFinite(contextCapRatio) ? Math.min(1, Math.max(0.01, contextCapRatio)) : 0.85;
  const ollamaContextSize = fallbackProfile?.ollama_context_size ?? Math.max(1, Math.floor(allowed * safeRatio));
  const ratio = Math.min(1, Math.max(0.01, ollamaContextSize / allowed));

  return {
    requested,
    allowed,
    max,
    matchingProfile,
    ollamaContextSize,
    ratio,
  };
}

export function validateManualContext(entry: UserModelEntry, value: number): ManualContextValidation {
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
