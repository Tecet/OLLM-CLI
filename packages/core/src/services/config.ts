/**
 * Service configuration management
 * Provides default values and validation for all service configurations
 */

import { z } from 'zod';
import type {
  ServicesConfig,
  CompressionStrategy,
  LoopDetectionConfig,
  SanitizationConfig,
} from './types.js';

/**
 * Zod schema for service configuration validation
 */
export const servicesConfigSchema = z.object({
  session: z
    .object({
      dataDir: z.string().optional(),
      maxSessions: z.number().int().positive().optional(),
      autoSave: z.boolean().optional(),
    })
    .optional(),
  compression: z
    .object({
      enabled: z.boolean().optional(),
      threshold: z.number().min(0).max(1).optional(),
      strategy: z.enum(['summarize', 'truncate', 'hybrid']).optional(),
      preserveRecent: z.number().int().positive().optional(),
    })
    .optional(),
  loopDetection: z
    .object({
      enabled: z.boolean().optional(),
      maxTurns: z.number().int().positive().optional(),
      repeatThreshold: z.number().int().positive().optional(),
    })
    .optional(),
  fileDiscovery: z
    .object({
      maxDepth: z.number().int().positive().optional(),
      followSymlinks: z.boolean().optional(),
      builtinIgnores: z.array(z.string()).optional(),
    })
    .optional(),
  environment: z
    .object({
      allowList: z.array(z.string()).optional(),
      denyPatterns: z.array(z.string()).optional(),
    })
    .optional(),
  contextManagement: z
    .object({
      targetSize: z.number().int().positive().optional(),
      minSize: z.number().int().positive().optional(),
      maxSize: z.number().int().positive().optional(),
      autoSize: z.boolean().optional(),
      vramBuffer: z.number().int().positive().optional(),
      kvQuantization: z.enum(['f16', 'q8_0', 'q4_0']).optional(),
      compression: z
        .object({
          enabled: z.boolean().optional(),
          threshold: z.number().min(0).max(1).optional(),
          strategy: z.enum(['summarize', 'truncate', 'hybrid']).optional(),
          preserveRecent: z.number().int().positive().optional(),
          summaryMaxTokens: z.number().int().positive().optional(),
        })
        .optional(),
      snapshots: z
        .object({
          enabled: z.boolean().optional(),
          maxCount: z.number().int().positive().optional(),
          autoCreate: z.boolean().optional(),
          autoThreshold: z.number().min(0).max(1).optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Default service configuration values
 */
export const DEFAULT_SERVICES_CONFIG: Required<ServicesConfig> = {
  session: {
    dataDir: '~/.ollm/session-data',
    maxSessions: 100,
    autoSave: true,
  },
  compression: {
    enabled: true,
    threshold: 0.8,
    strategy: 'hybrid' as CompressionStrategy,
    preserveRecent: 4096,
  },
  loopDetection: {
    enabled: true,
    maxTurns: 50,
    repeatThreshold: 3,
  },
  fileDiscovery: {
    maxDepth: 10,
    followSymlinks: false,
    builtinIgnores: ['node_modules', '.git', 'dist', 'build', '.next', '.cache'],
  },
  environment: {
    allowList: ['PATH', 'HOME', 'USER', 'SHELL', 'TERM', 'LANG'],
    denyPatterns: [
      '*_KEY',
      '*_SECRET',
      '*_TOKEN',
      '*_PASSWORD',
      '*_CREDENTIAL',
      'AWS_*',
      'GITHUB_*',
    ],
  },
  contextManagement: {
    targetSize: 8192,
    minSize: 2048,
    maxSize: 131072,
    autoSize: true,
    vramBuffer: 512 * 1024 * 1024, // 512MB
    kvQuantization: 'q8_0',
    compression: {
      enabled: true,
      threshold: 0.8,
      strategy: 'hybrid',
      preserveRecent: 4096,
      summaryMaxTokens: 1024,
    },
    snapshots: {
      enabled: true,
      maxCount: 5,
      autoCreate: true,
      autoThreshold: 0.8,
    },
  },
};

/**
 * Merge user configuration with defaults
 */
export function mergeServicesConfig(
  userConfig: Partial<ServicesConfig> = {}
): Required<ServicesConfig> {
  return {
    session: {
      ...DEFAULT_SERVICES_CONFIG.session,
      ...userConfig.session,
    },
    compression: {
      ...DEFAULT_SERVICES_CONFIG.compression,
      ...userConfig.compression,
    },
    loopDetection: {
      ...DEFAULT_SERVICES_CONFIG.loopDetection,
      ...userConfig.loopDetection,
    },
    fileDiscovery: {
      ...DEFAULT_SERVICES_CONFIG.fileDiscovery,
      ...userConfig.fileDiscovery,
      builtinIgnores: userConfig.fileDiscovery?.builtinIgnores
        ? [...DEFAULT_SERVICES_CONFIG.fileDiscovery.builtinIgnores, ...userConfig.fileDiscovery.builtinIgnores]
        : DEFAULT_SERVICES_CONFIG.fileDiscovery.builtinIgnores,
    },
    environment: {
      ...DEFAULT_SERVICES_CONFIG.environment,
      ...userConfig.environment,
      allowList: userConfig.environment?.allowList
        ? [...DEFAULT_SERVICES_CONFIG.environment.allowList, ...userConfig.environment.allowList]
        : DEFAULT_SERVICES_CONFIG.environment.allowList,
      denyPatterns: userConfig.environment?.denyPatterns
        ? [...DEFAULT_SERVICES_CONFIG.environment.denyPatterns, ...userConfig.environment.denyPatterns]
        : DEFAULT_SERVICES_CONFIG.environment.denyPatterns,
    },
    contextManagement: {
      ...DEFAULT_SERVICES_CONFIG.contextManagement,
      ...userConfig.contextManagement,
      compression: {
        ...DEFAULT_SERVICES_CONFIG.contextManagement.compression,
        ...userConfig.contextManagement?.compression,
      },
      snapshots: {
        ...DEFAULT_SERVICES_CONFIG.contextManagement.snapshots,
        ...userConfig.contextManagement?.snapshots,
      },
    },
  };
}

/**
 * Validate service configuration
 * @throws {z.ZodError} if configuration is invalid
 */
export function validateServicesConfig(config: unknown): ServicesConfig {
  return servicesConfigSchema.parse(config);
}

/**
 * Get loop detection configuration from services config
 */
export function getLoopDetectionConfig(
  servicesConfig: Required<ServicesConfig>
): LoopDetectionConfig {
  return {
    enabled: servicesConfig.loopDetection.enabled,
    maxTurns: servicesConfig.loopDetection.maxTurns,
    repeatThreshold: servicesConfig.loopDetection.repeatThreshold,
  };
}

/**
 * Get environment sanitization configuration from services config
 */
export function getSanitizationConfig(
  servicesConfig: Required<ServicesConfig>
): SanitizationConfig {
  return {
    allowList: servicesConfig.environment.allowList,
    denyPatterns: servicesConfig.environment.denyPatterns,
  };
}
