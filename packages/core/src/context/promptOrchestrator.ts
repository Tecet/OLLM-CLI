/**
 * PromptOrchestrator
 *
 * Loads tiered prompt templates and builds the active system prompt.
 */
import { join } from 'path';

import { SystemPromptBuilder } from './SystemPromptBuilder.js';
import { ContextTier, OperationalMode } from './types.js';
import { PromptRegistry } from '../prompts/PromptRegistry.js';
import { TieredPromptStore } from '../prompts/tieredPromptStore.js';

import type { ContextPool, ConversationContext, Message, TokenCounter } from './types.js';

type EmitFn = (event: string, payload?: unknown) => void;

interface PromptOrchestratorOptions {
  tokenCounter: TokenCounter;
  promptRegistry?: PromptRegistry;
  promptStore?: TieredPromptStore;
}

interface UpdateSystemPromptArgs {
  mode: OperationalMode;
  tier: ContextTier;
  activeSkills: string[];
  currentContext: ConversationContext;
  contextPool: ContextPool;
  emit?: EmitFn;
}

export class PromptOrchestrator {
  private readonly tokenCounter: TokenCounter;
  private readonly promptRegistry: PromptRegistry;
  private readonly promptStore: TieredPromptStore;
  private readonly systemPromptBuilder: SystemPromptBuilder;

  constructor({ tokenCounter, promptRegistry, promptStore }: PromptOrchestratorOptions) {
    this.tokenCounter = tokenCounter;
    this.promptRegistry = promptRegistry ?? new PromptRegistry();
    this.promptStore = promptStore ?? PromptOrchestrator.createPromptStore();
    this.systemPromptBuilder = new SystemPromptBuilder(this.promptRegistry);
  }

  /**
   * Load the tiered prompt store with fallbacks (dist -> src) for dev flows.
   */
  static createPromptStore(): TieredPromptStore {
    const store = new TieredPromptStore();
    store.load();

    if (!store.get(OperationalMode.ASSISTANT, ContextTier.TIER_1_MINIMAL)) {
      const fallbackStore = new TieredPromptStore(
        join(process.cwd(), 'packages', 'core', 'dist', 'prompts', 'templates')
      );
      fallbackStore.load();
      if (fallbackStore.get(OperationalMode.ASSISTANT, ContextTier.TIER_1_MINIMAL)) {
        return fallbackStore;
      }

      const srcStore = new TieredPromptStore(
        join(process.cwd(), 'packages', 'core', 'src', 'prompts', 'templates')
      );
      srcStore.load();
      return srcStore;
    }

    return store;
  }

  /**
   * Resolve a mode + tier template, falling back to a safe developer tier.
   */
  getSystemPromptForTierAndMode(mode: OperationalMode, tier: ContextTier): string {
    const template = this.promptStore.get(mode, tier);
    if (!template) {
      console.warn(
        `[ContextManager] No prompt template found for ${mode} in tier ${tier}, using fallback`
      );
      const fallback = this.promptStore.get(OperationalMode.DEVELOPER, ContextTier.TIER_3_STANDARD);
      return fallback ?? '';
    }
    return template;
  }

  /**
   * Token budgets scale with tier to protect the user context window.
   */
  getSystemPromptTokenBudget(tier: ContextTier): number {
    const budgets: Record<ContextTier, number> = {
      [ContextTier.TIER_1_MINIMAL]: 200,
      [ContextTier.TIER_2_BASIC]: 500,
      [ContextTier.TIER_3_STANDARD]: 1000,
      [ContextTier.TIER_4_PREMIUM]: 1500,
      [ContextTier.TIER_5_ULTRA]: 1500,
    };
    return budgets[tier] ?? 1000;
  }

  /**
   * Construct and inject the active system prompt into the conversation.
   */
  updateSystemPrompt({
    mode,
    tier,
    activeSkills,
    currentContext,
    contextPool,
    emit,
  }: UpdateSystemPromptArgs): { message: Message; tokenBudget: number } {
    const basePrompt = this.systemPromptBuilder.build({
      interactive: true,
      useSanityChecks: false,
      skills: activeSkills,
    });
    const tierPrompt = this.getSystemPromptForTierAndMode(mode, tier);
    const newPrompt = [tierPrompt, basePrompt].filter(Boolean).join('\n\n');

    const systemPrompt: Message = {
      id: `system-${Date.now()}`,
      role: 'system',
      content: newPrompt,
      timestamp: new Date(),
      tokenCount: this.tokenCounter.countTokensCached(`system-${Date.now()}`, newPrompt),
    };

    currentContext.messages = currentContext.messages.filter((m) => !m.id.startsWith('system-'));

    currentContext.messages.unshift(systemPrompt);
    currentContext.systemPrompt = systemPrompt;

    // Recalculate total tokens (system prompt changed, so full recalc needed)
    // This includes the new system prompt + all existing messages
    currentContext.tokenCount = this.tokenCounter.countConversationTokens(currentContext.messages);
    contextPool.setCurrentTokens(currentContext.tokenCount);

    emit?.('system-prompt-updated', { content: newPrompt });

    return {
      message: systemPrompt,
      tokenBudget: this.getSystemPromptTokenBudget(tier),
    };
  }
}
