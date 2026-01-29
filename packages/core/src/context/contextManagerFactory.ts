/**
 * Context Manager Factory
 *
 * Factory for creating context managers using the new ContextOrchestrator system.
 *
 * Requirements: NFR-1 (Performance), NFR-2 (Reliability)
 *
 * @module contextManagerFactory
 */

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

  /** Provider adapter (required) */
  provider: ProviderAdapter;

  /** Storage path (required) */
  storagePath: string;

  /** Service overrides */
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
  // Create debug log file
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const logPath = path.join(os.homedir(), '.ollm', 'context-init-debug.log');
  
  const log = (msg: string) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}\n`;
    try {
      fs.appendFileSync(logPath, logMsg);
    } catch (e) {
      // Ignore write errors
    }
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
    // Build system prompt (this would normally come from PromptOrchestrator)
    const systemPrompt: Message = {
      role: 'system',
      content: 'You are a helpful AI assistant.',
      id: 'system_prompt',
      timestamp: new Date(),
    };

    // Get Ollama context limit from model info
    const ollamaLimit = getOllamaContextLimit(config.modelInfo, config.contextConfig);
    log(`[ContextManagerFactory] Ollama limit: ${ollamaLimit}`);

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

    log('[ContextManagerFactory] Creating ContextOrchestrator instance...');
    // Create new context orchestrator
    const orchestrator = new ContextOrchestrator(orchestratorConfig);
    log('[ContextManagerFactory] ContextOrchestrator created');

    // Wrap in adapter to implement legacy interface
    const adapter = new ContextOrchestratorAdapter(
      orchestrator, 
      config.contextConfig as ContextConfig
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
