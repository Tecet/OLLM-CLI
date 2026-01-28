/**
 * Feature flags for gradual rollout of new context compression system
 * 
 * These flags allow switching between legacy and new implementations
 * during the migration period. Once the new system is stable, these
 * flags will be removed.
 */

export interface FeatureFlags {
  /**
   * Use new compression system with LLM summarization
   * Default: false (use legacy system)
   */
  USE_NEW_COMPRESSION: boolean;

  /**
   * Use new context manager with storage layer separation
   * Default: false (use legacy system)
   */
  USE_NEW_CONTEXT_MANAGER: boolean;

  /**
   * Use new checkpoint lifecycle with aging
   * Default: false (use legacy system)
   */
  USE_NEW_CHECKPOINTS: boolean;

  /**
   * Use new snapshot lifecycle with proper separation
   * Default: false (use legacy system)
   */
  USE_NEW_SNAPSHOTS: boolean;

  /**
   * Use new validation service with pre-send checks
   * Default: false (use legacy system)
   */
  USE_NEW_VALIDATION: boolean;
}

/**
 * Get feature flags from environment variables
 * All flags default to false (legacy system) for safety
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    USE_NEW_COMPRESSION: process.env.OLLM_NEW_COMPRESSION === 'true',
    USE_NEW_CONTEXT_MANAGER: process.env.OLLM_NEW_CONTEXT === 'true',
    USE_NEW_CHECKPOINTS: process.env.OLLM_NEW_CHECKPOINTS === 'true',
    USE_NEW_SNAPSHOTS: process.env.OLLM_NEW_SNAPSHOTS === 'true',
    USE_NEW_VALIDATION: process.env.OLLM_NEW_VALIDATION === 'true',
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
