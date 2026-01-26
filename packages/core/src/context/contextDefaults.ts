/**
 * Default context configuration values.
 *
 * Keep these in a single module so the manager can focus on orchestration.
 */
import type { ContextConfig } from './types.js';

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  targetSize: 8192,
  minSize: 2048,
  maxSize: 131072,
  autoSize: true,
  vramBuffer: 512 * 1024 * 1024, // 512MB
  kvQuantization: 'q8_0',
  compression: {
    enabled: true,
    threshold: 0.68, // ~80% of the Ollama cap (85% of user context) per spec
    strategy: 'hybrid',
    preserveRecent: 4096,
    summaryMaxTokens: 1024
  },
  snapshots: {
    enabled: true,
    maxCount: 5,
    autoCreate: true,
    autoThreshold: 0.85 // Aligned with Ollama's 85% context limit
  }
};
