/**
 * Context Manager Factory
 *
 * Factory for creating context managers with feature flag support.
 * Allows gradual migration from legacy system to new system.
 *
 * During migration:
 * - Feature flags control which implementation is used
 * - Legacy system is default (safe fallback)
 * - New system can be enabled via environment variables
 *
 * After migration:
 * - This factory will be removed
 * - Only new system will remain
 *
 * Requirements: NFR-1 (Performance), NFR-2 (Reliability)
 *
 * @module contextManagerFactory
 */

import { FEATURES, getFeatureFlagStatus } from '../config/features.js';
import { ConversationContextManager } from './contextManager.js';
import { ContextOrchestrator, type ContextOrchestratorConfig } from './orchestration/contextOrchestrator.js';
import { LegacyContextAdapter } from './adapters/legacyContextAdapter.js';
import type { ContextManager, ContextConfig, ModelInfo } from './types.js';
import type { ContextModuleOverrides } from './contextModules.js';
import type { VRAMMonitor, TokenCounter, ContextPool } from './types.js';
import type { ProviderAdapter } from '../provider/types.js';

/**
 * Factory configuration for creating context managers
 */
export interface ContextManagerFactoryConfig {
  /** Session identifier */
  sessionId: string;

  /** Model information */
  modelInfo: ModelInfo;

  /** Context configuration */
  contextConfig?: Partial<ContextConfig>;

  /** Provider adapter (required for new system) */
  provider?: ProviderAdapter;

  /** Storage path (required for new system) */
  storagePath?: string;

  /** Service overrides (for legacy system) */
  services?: ContextModuleOverrides & {
    vramMonitor?: VRAMMonitor;
    tokenCounter?: TokenCounter;
    contextPool?: ContextPool;
  };
}

/**
 * Context manager factory result
 */
export interface ContextManagerFactoryResult {
  /** The context manager instance */
  manager: ContextManager | ContextOrchestrator;

  /** Whether new system is being used */
  isNewSystem: boolean;

  /** Feature flag status at creation time */
  featureFlags: Record<string, boolean>;
}

/**
 * Create a context manager based on feature flags
 *
 * @param config - Factory configuration
 * @returns Context manager instance and metadata
 *
 * @example
 * ```typescript
 * // Create with legacy system (default)
 * const { manager, isNewSystem } = createContextManager({
 *   sessionId: 'session_123',
 *   modelInfo: { ... },
 *   contextConfig: { ... }
 * });
 *
 * // Create with new system (when enabled)
 * const { manager, isNewSystem } = createContextManager({
 *   sessionId: 'session_123',
 *   modelInfo: { ... },
 *   provider: ollamaProvider,
 *   storagePath: '/path/to/storage'
 * });
 * ```
 */
export function createContextManager(
  config: ContextManagerFactoryConfig
): ContextManagerFactoryResult {
  const featureFlags = getFeatureFlagStatus();

  // Log feature flag status (for debugging)
  if (process.env.OLLM_DEBUG === 'true') {
    console.log('[ContextManagerFactory] Feature flags:', featureFlags);
  }

  // Use new system if all flags are enabled
  if (FEATURES.USE_NEW_CONTEXT_MANAGER) {
    return createNewContextManager(config, featureFlags);
  }

  // Default to legacy system
  return createLegacyContextManager(config, featureFlags);
}

/**
 * Create new context manager (ContextOrchestrator)
 */
function createNewContextManager(
  config: ContextManagerFactoryConfig,
  featureFlags: Record<string, boolean>
): ContextManagerFactoryResult {
  // Validate required configuration for new system
  if (!config.provider) {
    throw new Error(
      'Provider adapter is required for new context manager. ' +
      'Either provide a provider or disable USE_NEW_CONTEXT_MANAGER flag.'
    );
  }

  if (!config.storagePath) {
    throw new Error(
      'Storage path is required for new context manager. ' +
      'Either provide a storage path or disable USE_NEW_CONTEXT_MANAGER flag.'
    );
  }

  // Build system prompt (this would normally come from PromptOrchestrator)
  // For now, create a basic system prompt
  const systemPrompt = {
    role: 'system' as const,
    content: 'You are a helpful AI assistant.',
    id: 'system_prompt',
    timestamp: Date.now(),
  };

  // Get Ollama context limit from model info
  const ollamaLimit = getOllamaContextLimit(config.modelInfo, config.contextConfig);

  // Create orchestrator configuration
  const orchestratorConfig: ContextOrchestratorConfig = {
    systemPrompt,
    ollamaLimit,
    tokenCounter: config.services?.tokenCounter || createDefaultTokenCounter(),
    provider: config.provider,
    model: config.modelInfo.id,
    sessionId: config.sessionId,
    storagePath: config.storagePath,
    keepRecentCount: config.contextConfig?.keepRecentCount || 5,
  };

  // Create new context orchestrator
  const manager = new ContextOrchestrator(orchestratorConfig);

  return {
    manager,
    isNewSystem: true,
    featureFlags,
  };
}

/**
 * Create legacy context manager (ConversationContextManager)
 */
function createLegacyContextManager(
  config: ContextManagerFactoryConfig,
  featureFlags: Record<string, boolean>
): ContextManagerFactoryResult {
  // Create legacy context manager
  const manager = new ConversationContextManager(
    config.sessionId,
    config.modelInfo,
    config.contextConfig,
    config.services
  );

  return {
    manager,
    isNewSystem: false,
    featureFlags,
  };
}

/**
 * Get Ollama context limit from model info and config
 */
function getOllamaContextLimit(
  modelInfo: ModelInfo,
  contextConfig?: Partial<ContextConfig>
): number {
  // Try to get from context config
  if (contextConfig?.ollamaContextSize) {
    return contextConfig.ollamaContextSize;
  }

  // Try to get from model info context profiles
  if (modelInfo.contextProfiles && modelInfo.contextProfiles.length > 0) {
    const targetSize = contextConfig?.targetSize || 8192;
    const profile = modelInfo.contextProfiles.find(p => p.size === targetSize);
    if (profile) {
      return profile.ollama_context_size;
    }
  }

  // Default to 6800 (85% of 8K)
  return 6800;
}

/**
 * Create default token counter (fallback)
 */
function createDefaultTokenCounter(): any {
  return {
    countTokens: (text: string | { content: string }) => {
      const content = typeof text === 'string' ? text : text.content;
      // Simple approximation: ~4 chars per token
      return Math.ceil(content.length / 4);
    },
  };
}

/**
 * Migrate session from legacy to new system
 *
 * @param legacyManager - Legacy context manager
 * @param newManager - New context orchestrator
 * @returns Migration result
 *
 * @example
 * ```typescript
 * const legacyManager = createLegacyContextManager(...);
 * const newManager = createNewContextManager(...);
 *
 * const result = await migrateSession(legacyManager, newManager);
 * if (result.success) {
 *   console.log(`Migrated ${result.messageCount} messages`);
 * }
 * ```
 */
export async function migrateSession(
  legacyManager: ConversationContextManager,
  newManager: ContextOrchestrator
): Promise<{
  success: boolean;
  messageCount: number;
  checkpointCount: number;
  error?: string;
}> {
  try {
    // Get current context from legacy manager
    const legacyContext = legacyManager.getCurrentContext();

    // Use adapter to convert to new format
    const migratedData = LegacyContextAdapter.migrateSession({
      sessionId: legacyManager['sessionId'],
      messages: legacyContext.messages,
      metadata: {
        checkpoints: [], // Legacy system doesn't have proper checkpoints
      },
    });

    // Add messages to new manager
    for (const message of migratedData.messages) {
      await newManager.addMessage(message);
    }

    return {
      success: true,
      messageCount: migratedData.messages.length,
      checkpointCount: migratedData.checkpoints.length,
    };
  } catch (error) {
    return {
      success: false,
      messageCount: 0,
      checkpointCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if migration is needed
 *
 * @param manager - Context manager to check
 * @returns Whether migration is needed
 */
export function needsMigration(
  manager: ContextManager | ContextOrchestrator
): boolean {
  // If new system is enabled but we have a legacy manager, migration is needed
  return (
    FEATURES.USE_NEW_CONTEXT_MANAGER &&
    manager instanceof ConversationContextManager
  );
}

/**
 * Get migration status
 *
 * @returns Migration status information
 */
export function getMigrationStatus(): {
  newSystemEnabled: boolean;
  migrationNeeded: boolean;
  featureFlags: Record<string, boolean>;
} {
  return {
    newSystemEnabled: FEATURES.USE_NEW_CONTEXT_MANAGER,
    migrationNeeded: FEATURES.USE_NEW_CONTEXT_MANAGER,
    featureFlags: getFeatureFlagStatus(),
  };
}
