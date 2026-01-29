/**
 * Shared Test Helpers for Context Tests
 * 
 * Provides mock implementations and helper functions for all context-related tests.
 */

import { vi } from 'vitest';
import { ContextTier, OperationalMode } from '../../types.js';

import type { ProviderAdapter } from '../../../provider/types.js';
import type { GoalManager } from '../../goalTypes.js';
import type { IProfileManager } from '../../integration/providerAwareCompression.js';
import type { PromptOrchestrator } from '../../promptOrchestrator.js';
import type { Message } from '../../types.js';
import type { ContextOrchestratorConfig } from '../../orchestration/contextOrchestrator.js';
import type { TokenCounterService } from '../../tokenCounter.js';

/**
 * Create a mock ProfileManager with standard test models
 */
export function createMockProfileManager(): IProfileManager {
  return {
    getModelEntry: vi.fn().mockReturnValue({
      id: 'llama3.2:3b',
      name: 'Llama 3.2 3B',
      context_profiles: [
        {
          size: 4096,
          size_label: '4k',
          vram_estimate: '3.5 GB',
          vram_estimate_gb: 3.5,
          ollama_context_size: 3482,
        },
        {
          size: 8192,
          size_label: '8k',
          vram_estimate: '3.9 GB',
          vram_estimate_gb: 3.9,
          ollama_context_size: 6963,
        },
        {
          size: 16384,
          size_label: '16k',
          vram_estimate: '4.6 GB',
          vram_estimate_gb: 4.6,
          ollama_context_size: 13926,
        },
      ],
      default_context: 8192,
    }),
    getProfiles: vi.fn().mockReturnValue([]),
  } as any;
}

/**
 * Create a mock GoalManager
 */
export function createMockGoalManager(): GoalManager {
  return {
    getActiveGoal: vi.fn().mockReturnValue(null),
    createGoal: vi.fn(),
    completeGoal: vi.fn(),
    pauseGoal: vi.fn(),
    resumeGoal: vi.fn(),
    abandonGoal: vi.fn(),
    addSubtask: vi.fn(),
    completeSubtask: vi.fn(),
    updateSubtaskStatus: vi.fn(),
    createCheckpoint: vi.fn(),
    recordDecision: vi.fn(),
    lockDecision: vi.fn(),
    recordArtifact: vi.fn(),
    addBlocker: vi.fn(),
    resolveBlocker: vi.fn(),
    getGoalById: vi.fn(),
    getCompletedGoals: vi.fn().mockReturnValue([]),
    getPausedGoals: vi.fn().mockReturnValue([]),
    getGoalProgress: vi.fn().mockReturnValue(0),
    getGoalStack: vi.fn().mockReturnValue({ goals: [], activeGoalId: null }),
    toJSON: vi.fn().mockReturnValue('{}'),
    fromJSON: vi.fn(),
  } as any;
}

/**
 * Create a mock PromptOrchestrator
 */
export function createMockPromptOrchestrator(): PromptOrchestrator {
  return {
    getSystemPromptForTierAndMode: vi.fn().mockReturnValue('Test system prompt'),
    getSystemPromptTokenBudget: vi.fn().mockReturnValue(1000),
    buildSystemPrompt: vi.fn().mockReturnValue({
      id: 'system-1',
      role: 'system',
      content: 'Test system prompt',
      timestamp: new Date(),
    }),
    updateSystemPrompt: vi.fn(),
  } as any;
}

/**
 * Create a mock Provider that can succeed or fail
 */
export function createMockProvider(shouldFail: boolean = false): ProviderAdapter {
  if (shouldFail) {
    return {
      chatStream: vi.fn(async function* () {
        throw new Error('LLM summarization failed');
        yield; // Unreachable but satisfies generator syntax
      }),
    } as unknown as ProviderAdapter;
  }

  return {
    chatStream: vi.fn(async function* () {
      yield { type: 'text' as const, value: 'This is a test summary of the conversation. Key points covered.' };
      yield { type: 'finish' as const, reason: 'stop' };
    }),
    listModels: vi.fn().mockResolvedValue([]),
    pullModel: vi.fn().mockResolvedValue(undefined),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    showModel: vi.fn().mockResolvedValue({}),
  } as unknown as ProviderAdapter;
}

/**
 * Create a complete orchestrator config with all required fields
 */
export function createOrchestratorConfig(
  overrides: Partial<ContextOrchestratorConfig> & {
    systemPrompt: Message;
    tokenCounter: TokenCounterService;
    storagePath: string;
  }
): ContextOrchestratorConfig {
  return {
    // Required fields
    systemPrompt: overrides.systemPrompt,
    ollamaLimit: 10000,
    tokenCounter: overrides.tokenCounter,
    provider: createMockProvider(),
    model: 'llama3.2:3b',
    sessionId: 'test-session',
    storagePath: overrides.storagePath,
    
    // Integration dependencies
    tier: ContextTier.TIER_3_STANDARD,
    mode: OperationalMode.DEVELOPER,
    profileManager: createMockProfileManager(),
    goalManager: createMockGoalManager(),
    promptOrchestrator: createMockPromptOrchestrator(),
    contextSize: 8192,
    
    // Optional fields
    keepRecentCount: 5,
    safetyMargin: 1000,
    
    // Apply overrides
    ...overrides,
  };
}

/**
 * Create a test message
 */
export function createMessage(
  id: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
  };
}

/**
 * Create a system prompt message
 */
export function createSystemPrompt(content: string = 'You are a helpful assistant.'): Message {
  return createMessage('system-1', 'system', content);
}
