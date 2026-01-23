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
  model: z
    .object({
      default: z.string().optional(),
      routing: z
        .object({
          enabled: z.boolean().optional(),
          defaultProfile: z.string().optional(),
          overrides: z.record(z.string(), z.string()).optional(),
        })
        .optional(),
      toolRouting: z
        .object({
          enabled: z.boolean().optional(),
          bindings: z.record(z.string(), z.string()).optional(),
          enableFallback: z.boolean().optional(),
        })
        .optional(),
      keepAlive: z
        .object({
          enabled: z.boolean().optional(),
          models: z.array(z.string()).optional(),
          timeout: z.number().int().positive().optional(),
        })
        .optional(),
      cacheTTL: z.number().int().positive().optional(),
    })
    .optional(),
  options: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      topP: z.number().min(0).max(1).optional(),
      numCtx: z.number().int().positive().optional(),
    })
    .optional(),
  memory: z
    .object({
      enabled: z.boolean().optional(),
      tokenBudget: z.number().int().positive().optional(),
      storagePath: z.string().optional(),
    })
    .optional(),
  templates: z
    .object({
      directories: z.array(z.string()).optional(),
    })
    .optional(),
  project: z
    .object({
      profile: z.string().optional(),
      autoDetect: z.boolean().optional(),
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
    model: {
      default: 'llama3.1:8b',
      routing: {
        enabled: true,
        defaultProfile: 'general',
        overrides: {},
      },
      toolRouting: {
        enabled: true,
        bindings: {},
        enableFallback: true,
      },
      keepAlive: {
        enabled: true,
        models: [],
        timeout: 300, // 5 minutes
      },
      cacheTTL: 300000, // 5 minutes
    },
  options: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 0.9,
    numCtx: 8192,
  },
  memory: {
    enabled: true,
    tokenBudget: 500,
    storagePath: '~/.ollm/memory.json',
  },
  templates: {
    directories: ['~/.ollm/templates', '.ollm/templates'],
  },
  project: {
    profile: undefined,
    autoDetect: true,
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
      builtinIgnores: [
        ...(DEFAULT_SERVICES_CONFIG.fileDiscovery.builtinIgnores ?? []),
        ...(userConfig.fileDiscovery?.builtinIgnores ?? [])
      ],
    },
    environment: {
      ...DEFAULT_SERVICES_CONFIG.environment,
      ...userConfig.environment,
      allowList: userConfig.environment?.allowList
        ? [...(DEFAULT_SERVICES_CONFIG.environment.allowList ?? []), ...(userConfig.environment.allowList ?? [])]
        : DEFAULT_SERVICES_CONFIG.environment.allowList,
      denyPatterns: userConfig.environment?.denyPatterns
        ? [...(DEFAULT_SERVICES_CONFIG.environment.denyPatterns ?? []), ...(userConfig.environment.denyPatterns ?? [])]
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
    model: {
      ...DEFAULT_SERVICES_CONFIG.model,
      ...userConfig.model,
      routing: {
        ...DEFAULT_SERVICES_CONFIG.model.routing!,
        ...userConfig.model?.routing,
        overrides: {
          ...DEFAULT_SERVICES_CONFIG.model.routing!.overrides,
          ...userConfig.model?.routing?.overrides,
        },
      },
      toolRouting: {
        ...DEFAULT_SERVICES_CONFIG.model.toolRouting!,
        ...userConfig.model?.toolRouting,
      },
      keepAlive: {
        ...DEFAULT_SERVICES_CONFIG.model.keepAlive!,
        ...userConfig.model?.keepAlive,
        models: userConfig.model?.keepAlive?.models ?? DEFAULT_SERVICES_CONFIG.model.keepAlive!.models,
      },
    },
    options: {
      ...DEFAULT_SERVICES_CONFIG.options,
      ...userConfig.options,
    },
    memory: {
      ...DEFAULT_SERVICES_CONFIG.memory,
      ...userConfig.memory,
    },
    templates: {
      ...DEFAULT_SERVICES_CONFIG.templates,
      ...userConfig.templates,
      directories: userConfig.templates?.directories ?? DEFAULT_SERVICES_CONFIG.templates.directories,
    },
    project: {
      ...DEFAULT_SERVICES_CONFIG.project,
      ...userConfig.project,
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
    enabled: servicesConfig.loopDetection.enabled ?? true,
    maxTurns: servicesConfig.loopDetection.maxTurns ?? 10,
    repeatThreshold: servicesConfig.loopDetection.repeatThreshold ?? 3,
  };
}

/**
 * Get environment sanitization configuration from services config
 */
export function getSanitizationConfig(
  servicesConfig: Required<ServicesConfig>
): SanitizationConfig {
  return {
    allowList: servicesConfig.environment.allowList ?? [],
    denyPatterns: servicesConfig.environment.denyPatterns ?? [],
  };
}

/**
 * Get model management configuration from services config
 */
export function getModelManagementConfig(
  servicesConfig: Required<ServicesConfig>
) {
  return {
    cacheTTL: servicesConfig.model.cacheTTL!,
    keepAliveEnabled: servicesConfig.model.keepAlive!.enabled,
    keepAliveTimeout: servicesConfig.model.keepAlive!.timeout,
    keepAliveModels: servicesConfig.model.keepAlive!.models,
  };
}

/**
 * Get model router configuration from services config
 */
export function getModelRouterConfig(
  servicesConfig: Required<ServicesConfig>
) {
  return {
    overrides: servicesConfig.model.routing!.overrides,
  };
}

/**
 * Get memory service configuration from services config
 */
export function getMemoryServiceConfig(
  servicesConfig: Required<ServicesConfig>
) {
  return {
    storagePath: servicesConfig.memory.storagePath!,
    tokenBudget: servicesConfig.memory.tokenBudget,
  };
}

/**
 * Get template service configuration from services config
 */
export function getTemplateServiceConfig(
  servicesConfig: Required<ServicesConfig>
) {
  return {
    userTemplatesDir: servicesConfig.templates.directories![0],
    workspaceTemplatesDir: servicesConfig.templates.directories![1],
  };
}

/**
 * Get project profile service configuration from services config
 */
export function getProjectProfileServiceConfig(
  servicesConfig: Required<ServicesConfig>
) {
  return {
    autoDetect: servicesConfig.project.autoDetect,
  };
}

/**
 * Get generation options from services config
 */
export function getGenerationOptions(
  servicesConfig: Required<ServicesConfig>
) {
  return {
    temperature: servicesConfig.options.temperature,
    maxTokens: servicesConfig.options.maxTokens,
    topP: servicesConfig.options.topP,
    numCtx: servicesConfig.options.numCtx,
  };
}

/**
 * Environment variable names for model configuration
 */
export const ENV_VAR_NAMES = {
  MODEL: 'OLLM_MODEL',
  TEMPERATURE: 'OLLM_TEMPERATURE',
  MAX_TOKENS: 'OLLM_MAX_TOKENS',
  CONTEXT_SIZE: 'OLLM_CONTEXT_SIZE',
} as const;

/**
 * Apply environment variable overrides to configuration
 * Environment variables take precedence over config file settings
 * 
 * @param config Base configuration from file
 * @returns Configuration with environment variable overrides applied
 */
export function applyEnvironmentOverrides(
  config: Partial<ServicesConfig>
): Partial<ServicesConfig> {
  const result = { ...config };

  // OLLM_MODEL overrides model.default
  const envModel = process.env[ENV_VAR_NAMES.MODEL];
  if (envModel) {
    result.model = {
      ...result.model,
      default: envModel,
    };
  }

  // OLLM_TEMPERATURE overrides options.temperature
  const envTemperature = process.env[ENV_VAR_NAMES.TEMPERATURE];
  if (envTemperature) {
    const temperature = parseFloat(envTemperature);
    if (!isNaN(temperature) && temperature >= 0 && temperature <= 2) {
      result.options = {
        ...result.options,
        temperature,
      };
    }
  }

  // OLLM_MAX_TOKENS overrides options.maxTokens
  const envMaxTokens = process.env[ENV_VAR_NAMES.MAX_TOKENS];
  if (envMaxTokens) {
    const maxTokens = parseInt(envMaxTokens, 10);
    if (!isNaN(maxTokens) && maxTokens > 0) {
      result.options = {
        ...result.options,
        maxTokens,
      };
    }
  }

  // OLLM_CONTEXT_SIZE overrides options.numCtx
  const envContextSize = process.env[ENV_VAR_NAMES.CONTEXT_SIZE];
  if (envContextSize) {
    const numCtx = parseInt(envContextSize, 10);
    if (!isNaN(numCtx) && numCtx > 0) {
      result.options = {
        ...result.options,
        numCtx,
      };
    }
  }

  return result;
}

/**
 * Load and merge configuration with environment variable precedence
 * 
 * Precedence order (highest to lowest):
 * 1. Environment variables
 * 2. User configuration
 * 3. Default configuration
 * 
 * @param userConfig User configuration from file
 * @returns Fully merged configuration with all overrides applied
 */
export function loadConfigWithEnvOverrides(
  userConfig: Partial<ServicesConfig> = {}
): Required<ServicesConfig> {
  // Apply environment variable overrides first
  const configWithEnv = applyEnvironmentOverrides(userConfig);
  
  // Then merge with defaults
  return mergeServicesConfig(configWithEnv);
}
