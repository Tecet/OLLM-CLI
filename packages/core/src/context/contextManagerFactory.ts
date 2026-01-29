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

import { ConversationContextManager } from './contextManager.js';
import { FEATURES, getFeatureFlagStatus } from '../config/features.js';
import { ContextOrchestrator, type ContextOrchestratorConfig } from './orchestration/contextOrchestrator.js';
import { ContextOrchestratorAdapter } from './adapters/contextOrchestratorAdapter.js';
import { ContextTier, OperationalMode } from './types.js';

import type { ContextModuleOverrides } from './contextModules.js';
import type { ContextManager, ContextConfig, ModelInfo, VRAMMonitor, TokenCounter, ContextPool, Message } from './types.js';
import type { ProviderAdapter } from '../provider/types.js';

/**
 * Factory configuration for creating context managers
 */
export interface ContextManagerFactoryConfig {
  /** Session identifier */
  sessionId: string;

  /** Model information */
  modelInfo: ModelInfo & {
    contextSize?: number;
  };

  /** Context configuration */
  contextConfig?: Partial<ContextConfig> & {
    tier?: ContextTier;
    mode?: OperationalMode;
  };

  /** Provider adapter (required for new system) */
  provider?: ProviderAdapter;

  /** Storage path (required for new system) */
  storagePath?: string;

  /** Service overrides (for legacy system and new system) */
  services?: ContextModuleOverrides & {
    vramMonitor?: VRAMMonitor;
    tokenCounter?: TokenCounter;
    contextPool?: ContextPool;
    profileManager?: any;
    goalManager?: any;
    promptOrchestrator?: any;
  };
}

/**
 * Context manager factory result
 */
export interface ContextManagerFactoryResult {
  /** The context manager instance (always implements ContextManager interface) */
  manager: ContextManager;

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
  console.log('[ContextManagerFactory] Feature flags:', featureFlags);
  console.log('[ContextManagerFactory] Config:', {
    sessionId: config.sessionId,
    hasProvider: !!config.provider,
    hasStoragePath: !!config.storagePath,
    modelId: config.modelInfo?.modelId,
  });

  // Use new system if all flags are enabled
  if (FEATURES.USE_NEW_CONTEXT_MANAGER) {
    console.log('[ContextManagerFactory] Using NEW system');
    return createNewContextManager(config, featureFlags);
  }

  // Default to legacy system
  console.log('[ContextManagerFactory] Using LEGACY system');
  return createLegacyContextManager(config, featureFlags);
}

/**
 * Create new context manager (ContextOrchestrator)
 */
function createNewContextManager(
  config: ContextManagerFactoryConfig,
  featureFlags: Record<string, boolean>
): ContextManagerFactoryResult {
  console.log('[ContextManagerFactory] createNewContextManager called');
  
  // Validate required configuration for new system
  if (!config.provider) {
    console.warn('[ContextManagerFactory] No provider - falling back to legacy');
    return createLegacyContextManager(config, featureFlags);
  }

  if (!config.storagePath) {
    console.warn('[ContextManagerFactory] No storagePath - falling back to legacy');
    return createLegacyContextManager(config, featureFlags);
  }

  console.log('[ContextManagerFactory] Creating ContextOrchestrator...');

  // Build system prompt (this would normally come from PromptOrchestrator)
  // For now, create a basic system prompt
  const systemPrompt: Message = {
    role: 'system',
    content: 'You are a helpful AI assistant.',
    id: 'system_prompt',
    timestamp: new Date(),
  };

  // Get Ollama context limit from model info
  const ollamaLimit = getOllamaContextLimit(config.modelInfo, config.contextConfig);

  // Create orchestrator configuration
  const orchestratorConfig: ContextOrchestratorConfig = {
    systemPrompt,
    ollamaLimit,
    tokenCounter: config.services?.tokenCounter || createDefaultTokenCounter(),
    provider: config.provider,
    model: config.modelInfo.modelId || 'unknown',
    sessionId: config.sessionId,
    storagePath: config.storagePath,
    keepRecentCount: config.contextConfig?.compression?.preserveRecent || 5,
    
    // Integration dependencies (use defaults if not provided)
    tier: config.contextConfig?.tier || ContextTier.TIER_3_STANDARD,
    mode: config.contextConfig?.mode || OperationalMode.ASSISTANT,
    profileManager: config.services?.profileManager || createDefaultProfileManager(),
    goalManager: config.services?.goalManager || createDefaultGoalManager(),
    promptOrchestrator: config.services?.promptOrchestrator || createDefaultPromptOrchestrator(),
    contextSize: config.modelInfo.contextSize || 8192,
  };

  // Create new context orchestrator
  const orchestrator = new ContextOrchestrator(orchestratorConfig);
  console.log('[ContextManagerFactory] ContextOrchestrator created');

  // Wrap in adapter to implement legacy interface
  const adapter = new ContextOrchestratorAdapter(
    orchestrator, 
    config.contextConfig as ContextConfig
  );
  console.log('[ContextManagerFactory] Adapter created, returning manager');

  return {
    manager: adapter,
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
    countTokensCached: (id: string, text: string) => {
      // Simple approximation: ~4 chars per token
      return Math.ceil(text.length / 4);
    },
  };
}

/**
 * Create default profile manager (fallback)
 */
function createDefaultProfileManager(): any {
  return {
    getModelEntry: (modelId: string) => {
      // Return a minimal model entry with default context profiles
      return {
        id: modelId,
        name: modelId,
        provider: 'ollama',
        context_profiles: [
          {
            size: 8192,
            ollama_context_size: 6800, // 85% of 8K
            num_ctx: 8192,
          },
          {
            size: 32768,
            ollama_context_size: 27852, // 85% of 32K
            num_ctx: 32768,
          },
          {
            size: 131072,
            ollama_context_size: 111411, // 85% of 128K
            num_ctx: 131072,
          },
        ],
      };
    },
    getCurrentContextSize: () => 8192,
  };
}

/**
 * Create default goal manager (fallback)
 */
function createDefaultGoalManager(): any {
  return {
    getActiveGoal: () => null,
    updateGoal: () => {},
  };
}

/**
 * Create default prompt orchestrator (fallback)
 */
function createDefaultPromptOrchestrator(): any {
  return {
    buildSystemPrompt: () => ({
      role: 'system' as const,
      parts: [{ type: 'text' as const, text: 'You are a helpful AI assistant.' }],
    }),
    updateSystemPrompt: () => {},
    getSystemPromptTokens: () => 10,
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
    // Get messages from legacy manager
    const messages = await legacyManager.getMessages();

    // Convert messages to new format
    const convertedMessages: Message[] = messages.map((msg: any) => ({
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      toolCalls: msg.toolCalls,
      toolCallId: msg.toolCallId,
      tokenCount: msg.tokenCount,
      metadata: msg.metadata,
    }));

    // Add messages to new manager
    for (const message of convertedMessages) {
      await newManager.addMessage(message);
    }

    return {
      success: true,
      messageCount: convertedMessages.length,
      checkpointCount: 0, // Legacy system doesn't have checkpoints
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
