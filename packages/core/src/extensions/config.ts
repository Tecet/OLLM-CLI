/**
 * Extension system configuration management
 * Provides default values and validation for extension configurations
 */

import { z } from 'zod';

/**
 * Extension configuration interface
 */
export interface ExtensionsConfig {
  /** Enable or disable all extensions */
  enabled?: boolean;
  /** Directories to scan for extensions */
  directories?: string[];
  /** Auto-enable new extensions when discovered */
  autoEnable?: boolean;
}

/**
 * Zod schema for extension configuration validation
 */
export const extensionsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  directories: z.array(z.string()).optional(),
  autoEnable: z.boolean().optional(),
});

/**
 * Default extension configuration values
 */
export const DEFAULT_EXTENSIONS_CONFIG: Required<ExtensionsConfig> = {
  enabled: true,
  directories: ['~/.ollm/extensions', '.ollm/extensions'],
  autoEnable: true,
};

/**
 * Merge user configuration with defaults
 */
export function mergeExtensionsConfig(
  userConfig: Partial<ExtensionsConfig> = {}
): Required<ExtensionsConfig> {
  return {
    enabled: userConfig.enabled ?? DEFAULT_EXTENSIONS_CONFIG.enabled,
    directories: userConfig.directories ?? DEFAULT_EXTENSIONS_CONFIG.directories,
    autoEnable: userConfig.autoEnable ?? DEFAULT_EXTENSIONS_CONFIG.autoEnable,
  };
}

/**
 * Validate extension configuration
 * @throws {z.ZodError} if configuration is invalid
 */
export function validateExtensionsConfig(config: unknown): ExtensionsConfig {
  return extensionsConfigSchema.parse(config);
}
