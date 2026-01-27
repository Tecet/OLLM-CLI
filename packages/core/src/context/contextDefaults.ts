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
    threshold: 0.80, // Trigger at 80% of available context budget
    strategy: 'hybrid',
    preserveRecent: 4096,
    summaryMaxTokens: 1024
  },
  snapshots: {
    enabled: true,
    maxCount: 5,
    autoCreate: true,
    autoThreshold: 0.85 // Create snapshot at 85% usage
  }
};
