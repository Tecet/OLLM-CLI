/**
 * Prompt Utility Functions
 * 
 * Helper functions for prompt management and tier resolution.
 * Extracted from ChatContext.tsx for better organization.
 */

import { existsSync, readFileSync } from 'fs';
import path from 'path';

import {
  ContextTier,
  OperationalMode,
  TieredPromptStore,
} from '@ollm/core';

const tieredPromptStore = new TieredPromptStore();
tieredPromptStore.load();

/**
 * Resolve context tier based on size
 */
export function resolveTierForSize(size: number): ContextTier {
  if (size < 8192) return ContextTier.TIER_1_MINIMAL;
  if (size < 16384) return ContextTier.TIER_2_BASIC;
  if (size < 32768) return ContextTier.TIER_3_STANDARD;
  if (size < 65536) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
}

/**
 * Convert mode string to OperationalMode enum
 */
export function toOperationalMode(mode: string): OperationalMode {
  switch (mode) {
    case 'assistant':
      return OperationalMode.ASSISTANT;
    case 'planning':
      return OperationalMode.PLANNING;
    case 'debugger':
      return OperationalMode.DEBUGGER;
    case 'developer':
    default:
      return OperationalMode.DEVELOPER;
  }
}

/**
 * Convert tier to key string for prompt loading
 */
export function tierToKey(tier: ContextTier): string {
  switch (tier) {
    case ContextTier.TIER_1_MINIMAL:
      return 'tier1';
    case ContextTier.TIER_2_BASIC:
      return 'tier2';
    case ContextTier.TIER_3_STANDARD:
      return 'tier3';
    case ContextTier.TIER_4_PREMIUM:
    case ContextTier.TIER_5_ULTRA:
      return 'tier4';
    default:
      return 'tier3';
  }
}

/**
 * Load tier prompt with fallback to file system
 */
export function loadTierPromptWithFallback(mode: OperationalMode, tier: ContextTier): string {
  const fromStore = tieredPromptStore.get(mode, tier);
  if (fromStore) {
    return fromStore;
  }

  const tierKey = tierToKey(tier);
  const candidates = [
    path.join(process.cwd(), 'packages', 'core', 'dist', 'prompts', 'templates', mode, `${tierKey}.txt`),
    path.join(process.cwd(), 'packages', 'core', 'src', 'prompts', 'templates', mode, `${tierKey}.txt`),
  ];

  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        const content = readFileSync(candidate, 'utf8').trim();
        if (content) {
          return content;
        }
      }
    } catch (_e) {
      // ignore and keep trying
    }
  }

  return '';
}

/**
 * Strip a section from source string
 */
export function stripSection(source: string, section: string): string {
  if (!section) return source;
  const trimmed = source.trim();
  const target = section.trim();
  if (!target) return source;
  const index = trimmed.indexOf(target);
  if (index === -1) return source;
  const before = trimmed.slice(0, index).trim();
  const after = trimmed.slice(index + target.length).trim();
  return [before, after].filter(Boolean).join('\n\n').trim();
}
