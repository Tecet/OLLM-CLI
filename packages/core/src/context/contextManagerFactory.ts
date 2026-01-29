/**
 * Context Manager Factory
 *
 * @status REWORK - Simplified (2026-01-29)
 * @date 2026-01-29
 * @changes Removed legacy system, removed feature flags, simplified to only create ContextOrchestrator
 *
 * Factory for creating context managers using the new ContextOrchestrator system.
 *
 * Requirements: NFR-1 (Performance), NFR-2 (Reliability)
 *
 * @module contextManagerFactory
 */

import { ContextOrchestratorAdapter } from './adapters/contextOrchestratorAdapter.js';
import { PromptOrchestratorIntegration } from './integration/promptOrchestratorIntegration.js';
import { ContextOrchestrator, type ContextOrchestratorConfig } from './orchestration/contextOrchestrator.js';
import { PromptOrchestrator } from './promptOrchestrator.js';
import { ContextTier, OperationalMode } from './types.js';

import type { ContextManager, ContextConfig, ModelInfo, VRAMMonitor, TokenCounter, ContextPool } from './types.js';
import type { ProviderAdapter } from '../provider/types.js';

/**
 * Service overrides for context manager factory
 * Allows injecting custom implementations of services
 */
export interface ContextModuleOverrides {
  vramMonitor?: VRAMMonitor;
  tokenCounter?: TokenCounter;
  contextPool?: ContextPool;
  profileManager?: any;
  goalManager?: any;
  promptOrchestrator?: any;
}

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

  /** Provider adapter (required) */
  provider: ProviderAdapter;

  /** Storage path (required) */
  storagePath: string;

  /** Service overrides */
  services?: ContextModuleOverrides;
}

/**
 * Context manager factory result
 */
export interface ContextManagerFactoryResult {
  /** The context manager instance */
  manager: ContextManager;
}

/**
 * Create a context manager using the new ContextOrchestrator system
 *
 * @param config - Factory configuration
 * @returns Context manager instance
 *
 * @example
 * ```typescript
 * const { manager } = createContextManager({
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
  // Create debug log file using dynamic import
  const logToFile = async (msg: string) => {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      const logPath = path.join(os.homedir(), '.ollm', 'context-init-debug.log');
      const timestamp = new Date().toISOString();
      const logMsg = `[${timestamp}] ${msg}\n`;
      fs.appendFileSync(logPath, logMsg);
    } catch (_e) {
      // Ignore write errors
    }
  };
  
  // Log synchronously by wrapping in promise (fire and forget)
  const log = (msg: string) => {
    logToFile(msg).catch(() => {});
  };
  
  log('[ContextManagerFactory] Creating ContextOrchestrator');
  log(`[ContextManagerFactory] Config: ${JSON.stringify({
    sessionId: config.sessionId,
    hasProvider: !!config.provider,
    hasStoragePath: !!config.storagePath,
    modelId: config.modelInfo?.modelId,
  })}`);

  // Validate required configuration
  if (!config.provider) {
    log('[ContextManagerFactory] ERROR: Provider is required');
    throw new Error('Provider is required for context manager');
  }

  if (!config.storagePath) {
    log('[ContextManagerFactory] ERROR: Storage path is required');
    throw new Error('Storage path is required for context manager');
  }

  try {
    // Determine the actual context size to use
    // Priority: contextConfig.targetSize > modelInfo.contextSize > 8192 default
    const actualContextSize = config.contextConfig?.targetSize || config.modelInfo.contextSize || 8192;
    
    // Get Ollama context limit from model info
    const ollamaLimit = getOllamaContextLimit(config.modelInfo, actualContextSize);
    log(`[ContextManagerFactory] Context size: ${actualContextSize}, Ollama limit: ${ollamaLimit}`);

    // Create token counter (reuse for all components)
    const tokenCounter = config.services?.tokenCounter || createDefaultTokenCounter();
    
    // Get tier and mode based on actual context size
    const tier = config.contextConfig?.tier || calculateTierFromSize(actualContextSize);
    const mode = config.contextConfig?.mode || OperationalMode.ASSISTANT;
    
    log(`[ContextManagerFactory] Tier: ${tier}, Mode: ${mode}`);
    
    // Create prompt orchestrator
    const promptOrchestrator = config.services?.promptOrchestrator || createDefaultPromptOrchestrator(tokenCounter);
    
    // Build system prompt using PromptOrchestratorIntegration
    const promptIntegration = new PromptOrchestratorIntegration(promptOrchestrator);
    const systemPrompt = promptIntegration.getSystemPrompt({
      mode,
      tier,
      activeSkills: [], // TODO: Get from config
      useSanityChecks: false,
    });
    
    log(`[ContextManagerFactory] System prompt tokens: ${promptIntegration.getSystemPromptTokens(systemPrompt)}`);
    
    // Create orchestrator configuration
    const orchestratorConfig: ContextOrchestratorConfig = {
      systemPrompt,
      ollamaLimit,
      tokenCounter,
      provider: config.provider,
      model: config.modelInfo.modelId || 'unknown',
      sessionId: config.sessionId,
      storagePath: config.storagePath,
      
      // Integration dependencies (use defaults if not provided)
      tier,
      mode,
      profileManager: config.services?.profileManager || createDefaultProfileManager(),
      goalManager: config.services?.goalManager || createDefaultGoalManager(),
      promptOrchestrator,
      contextSize: actualContextSize, // Use the same value consistently
    };

    log('[ContextManagerFactory] Creating ContextOrchestrator instance...');
    // Create new context orchestrator
    const orchestrator = new ContextOrchestrator(orchestratorConfig);
    log('[ContextManagerFactory] ContextOrchestrator created');

    // Wrap in adapter to implement legacy interface
    const adapter = new ContextOrchestratorAdapter(
      orchestrator, 
      config.contextConfig as ContextConfig,
      mode,
      tier
    );
    log('[ContextManagerFactory] Adapter created, returning manager');

    return {
      manager: adapter,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : '';
    log(`[ContextManagerFactory] ERROR: ${message}`);
    log(`[ContextManagerFactory] Stack: ${stack}`);
    throw error;
  }
}

/**
 * Get Ollama context limit from model info and config
 */
function getOllamaContextLimit(
  modelInfo: ModelInfo,
  actualContextSize: number
): number {
  // Try to get from model info context profiles
  if (modelInfo.contextProfiles && modelInfo.contextProfiles.length > 0) {
    const profile = modelInfo.contextProfiles.find(p => p.size === actualContextSize);
    if (profile) {
      return profile.ollama_context_size;
    }
  }

  // Calculate 85% of context size as fallback
  return Math.floor(actualContextSize * 0.85);
}

/**
 * Calculate tier from context size
 */
function calculateTierFromSize(contextSize: number): ContextTier {
  if (contextSize <= 4096) return ContextTier.TIER_1_MINIMAL;
  if (contextSize <= 8192) return ContextTier.TIER_2_BASIC;
  if (contextSize <= 16384) return ContextTier.TIER_3_STANDARD;
  if (contextSize <= 32768) return ContextTier.TIER_4_PREMIUM;
  return ContextTier.TIER_5_ULTRA;
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
function createDefaultPromptOrchestrator(tokenCounter?: TokenCounter): any {
  // Create a real PromptOrchestrator instance that loads templates
  return new PromptOrchestrator({
    tokenCounter: tokenCounter || createDefaultTokenCounter(),
  });
}
