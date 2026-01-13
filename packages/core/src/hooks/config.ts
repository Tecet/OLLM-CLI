/**
 * Hook system configuration management
 * Provides default values and validation for hook configurations
 */

import { z } from 'zod';

/**
 * Hook configuration interface
 */
export interface HooksConfig {
  /** Enable or disable all hooks */
  enabled?: boolean;
  /** Hook execution timeout in milliseconds */
  timeout?: number;
  /** Auto-trust workspace hooks without approval */
  trustWorkspace?: boolean;
}

/**
 * Zod schema for hook configuration validation
 */
export const hooksConfigSchema = z.object({
  enabled: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  trustWorkspace: z.boolean().optional(),
});

/**
 * Default hook configuration values
 */
export const DEFAULT_HOOKS_CONFIG: Required<HooksConfig> = {
  enabled: true,
  timeout: 30000, // 30 seconds
  trustWorkspace: false,
};

/**
 * Merge user configuration with defaults
 */
export function mergeHooksConfig(
  userConfig: Partial<HooksConfig> = {}
): Required<HooksConfig> {
  return {
    ...DEFAULT_HOOKS_CONFIG,
    ...userConfig,
  };
}

/**
 * Validate hook configuration
 * @throws {z.ZodError} if configuration is invalid
 */
export function validateHooksConfig(config: unknown): HooksConfig {
  return hooksConfigSchema.parse(config);
}
