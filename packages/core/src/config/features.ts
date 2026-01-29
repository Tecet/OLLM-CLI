/**
 * Feature flags for gradual rollout of new context compression system
 * 
 * NEW SYSTEM IS NOW ENABLED BY DEFAULT (v0.1.1+)
 * 
 * These flags allow switching back to legacy implementations if needed.
 * Set environment variables to 'false' to disable specific features.
 */

export interface FeatureFlags {
  /**
   * Use new compression system with LLM summarization
   * Default: true (new system enabled)
   */
  USE_NEW_COMPRESSION: boolean;

  /**
   * Use new context manager with storage layer separation
   * Default: true (new system enabled)
   */
  USE_NEW_CONTEXT_MANAGER: boolean;

  /**
   * Use new checkpoint lifecycle with aging
   * Default: true (new system enabled)
   */
  USE_NEW_CHECKPOINTS: boolean;

  /**
   * Use new snapshot lifecycle with proper separation
   * Default: true (new system enabled)
   */
  USE_NEW_SNAPSHOTS: boolean;

  /**
   * Use new validation service with pre-send checks
   * Default: true (new system enabled)
   */
  USE_NEW_VALIDATION: boolean;
}

/**
 * Get feature flags from environment variables
 * 
 * NEW SYSTEM ENABLED BY DEFAULT (v0.1.1+)
 * All flags default to TRUE - set environment variable to 'false' to disable
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    USE_NEW_COMPRESSION: process.env.OLLM_NEW_COMPRESSION !== 'false',
    USE_NEW_CONTEXT_MANAGER: process.env.OLLM_NEW_CONTEXT !== 'false',
    USE_NEW_CHECKPOINTS: process.env.OLLM_NEW_CHECKPOINTS !== 'false',
    USE_NEW_SNAPSHOTS: process.env.OLLM_NEW_SNAPSHOTS !== 'false',
    USE_NEW_VALIDATION: process.env.OLLM_NEW_VALIDATION !== 'false',
  };
}

/**
 * Global feature flags instance
 * Initialized once at startup
 */
export const FEATURES = getFeatureFlags();

/**
 * Check if all new features are enabled
 * Used to determine if we can fully switch to new system
 */
export function isNewSystemEnabled(): boolean {
  return (
    FEATURES.USE_NEW_COMPRESSION &&
    FEATURES.USE_NEW_CONTEXT_MANAGER &&
    FEATURES.USE_NEW_CHECKPOINTS &&
    FEATURES.USE_NEW_SNAPSHOTS &&
    FEATURES.USE_NEW_VALIDATION
  );
}

/**
 * Check if any new features are enabled
 * Used to determine if we're in migration mode
 */
export function isInMigrationMode(): boolean {
  return (
    FEATURES.USE_NEW_COMPRESSION ||
    FEATURES.USE_NEW_CONTEXT_MANAGER ||
    FEATURES.USE_NEW_CHECKPOINTS ||
    FEATURES.USE_NEW_SNAPSHOTS ||
    FEATURES.USE_NEW_VALIDATION
  );
}

/**
 * Get feature flag status for logging/debugging
 */
export function getFeatureFlagStatus(): Record<string, boolean> {
  return {
    'New Compression': FEATURES.USE_NEW_COMPRESSION,
    'New Context Manager': FEATURES.USE_NEW_CONTEXT_MANAGER,
    'New Checkpoints': FEATURES.USE_NEW_CHECKPOINTS,
    'New Snapshots': FEATURES.USE_NEW_SNAPSHOTS,
    'New Validation': FEATURES.USE_NEW_VALIDATION,
    'Full New System': isNewSystemEnabled(),
    'Migration Mode': isInMigrationMode(),
  };
}
