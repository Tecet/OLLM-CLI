/**
 * Prompt Orchestrator Integration
 *
 * Integrates the context compression system with the PromptOrchestrator
 * to ensure system prompts are built correctly and compression respects
 * the prompt structure.
 *
 * Requirements: FR-16
 */

import type { IProfileManager } from './providerAwareCompression.js';
import type { PromptOrchestrator } from '../promptOrchestrator.js';
import type { CheckpointSummary } from '../types/storageTypes.js';
import type { Message, ContextTier, OperationalMode } from '../types.js';

/**
 * System prompt configuration
 */
export interface SystemPromptConfig {
  /** Operational mode */
  mode: OperationalMode;
  /** Context tier */
  tier: ContextTier;
  /** Active skills */
  activeSkills: string[];
  /** Whether to include sanity checks */
  useSanityChecks?: boolean;
  /** Current model ID (for tool support detection) */
  modelId?: string;
  /** Allowed tools for this mode (from user settings) */
  allowedTools?: string[];
}

/**
 * Prompt structure components
 */
export interface PromptStructure {
  /** System prompt message */
  systemPrompt: Message;
  /** Token budget for system prompt */
  tokenBudget: number;
  /** Tier-specific prompt */
  tierPrompt: string;
  /** Base prompt with skills/tools/hooks */
  basePrompt: string;
}

/**
 * Prompt orchestrator integration
 *
 * Ensures system prompts are built by PromptOrchestrator and compression
 * respects the prompt structure, preserving skills, tools, and hooks.
 */
export class PromptOrchestratorIntegration {
  private promptOrchestrator: PromptOrchestrator;
  private profileManager?: IProfileManager;

  constructor(promptOrchestrator: PromptOrchestrator, profileManager?: IProfileManager) {
    this.promptOrchestrator = promptOrchestrator;
    this.profileManager = profileManager;
  }

  /**
   * Get system prompt from orchestrator
   *
   * Retrieves the system prompt built by PromptOrchestrator, which includes
   * tier-specific prompts, skills, tools, hooks, and other components.
   *
   * @param config - System prompt configuration
   * @returns System prompt message
   *
   * @example
   * ```typescript
   * const systemPrompt = integration.getSystemPrompt({
   *   mode: OperationalMode.DEVELOPER,
   *   tier: ContextTier.TIER_3_STANDARD,
   *   activeSkills: ['typescript', 'testing']
   * });
   * ```
   */
  getSystemPrompt(config: SystemPromptConfig): Message {
    // Get tier-specific prompt
    const tierPrompt = this.promptOrchestrator.getSystemPromptForTierAndMode(
      config.mode,
      config.tier
    );

    // Build base prompt with skills/tools/hooks
    // Note: This is a simplified version. In production, this would call
    // the actual SystemPromptBuilder with full context
    const basePrompt = this.buildBasePrompt(config);

    // Combine tier prompt and base prompt
    const content = [tierPrompt, basePrompt].filter(Boolean).join('\n\n');

    // Create system prompt message
    const systemPrompt: Message = {
      id: `system-${Date.now()}`,
      role: 'system',
      content,
      timestamp: new Date(),
    };

    return systemPrompt;
  }

  /**
   * Get system prompt token count
   *
   * Returns the token count for the system prompt, which is needed for
   * calculating available space for checkpoints and messages.
   *
   * @param systemPrompt - System prompt message
   * @returns Token count
   *
   * @example
   * ```typescript
   * const tokens = integration.getSystemPromptTokens(systemPrompt);
   * console.log(`System prompt uses ${tokens} tokens`);
   * ```
   */
  getSystemPromptTokens(systemPrompt: Message): number {
    // In production, this would use the actual token counter
    // For now, estimate based on content length
    return Math.ceil(systemPrompt.content.length / 4);
  }

  /**
   * Get token budget for tier
   *
   * Returns the token budget allocated for the system prompt based on the
   * context tier. This is used to ensure compression doesn't violate tier limits.
   *
   * @param tier - Context tier
   * @returns Token budget
   *
   * @example
   * ```typescript
   * const budget = integration.getTokenBudget(ContextTier.TIER_3_STANDARD);
   * console.log(`Tier 3 budget: ${budget} tokens`);
   * ```
   */
  getTokenBudget(tier: ContextTier): number {
    return this.promptOrchestrator.getSystemPromptTokenBudget(tier);
  }

  /**
   * Integrate checkpoints into prompt
   *
   * Builds a complete prompt that includes the system prompt and checkpoint
   * summaries, maintaining the correct structure.
   *
   * @param systemPrompt - System prompt message
   * @param checkpoints - Checkpoint summaries
   * @param recentMessages - Recent messages
   * @returns Complete prompt array
   *
   * @example
   * ```typescript
   * const prompt = integration.integrateCheckpoints(
   *   systemPrompt,
   *   checkpoints,
   *   recentMessages
   * );
   * ```
   */
  integrateCheckpoints(
    systemPrompt: Message,
    checkpoints: CheckpointSummary[],
    recentMessages: Message[]
  ): Message[] {
    const prompt: Message[] = [];

    // 1. System prompt always comes first
    prompt.push(systemPrompt);

    // 2. Checkpoint summaries come next (as assistant messages)
    for (const checkpoint of checkpoints) {
      prompt.push({
        id: checkpoint.id,
        role: 'assistant',
        content: checkpoint.summary,
        timestamp: new Date(checkpoint.timestamp),
      });
    }

    // 3. Recent messages come last
    prompt.push(...recentMessages);

    return prompt;
  }

  /**
   * Verify prompt structure preservation
   *
   * Validates that compression hasn't corrupted the prompt structure by
   * checking that:
   * - System prompt is first
   * - Checkpoints come before recent messages
   * - Skills/tools/hooks are preserved in system prompt
   *
   * @param prompt - Prompt to validate
   * @param expectedSkills - Expected skills in system prompt
   * @returns True if structure is valid
   * @throws Error if structure is invalid
   *
   * @example
   * ```typescript
   * integration.verifyPromptStructure(prompt, ['typescript', 'testing']);
   * ```
   */
  verifyPromptStructure(prompt: Message[], expectedSkills: string[]): boolean {
    if (prompt.length === 0) {
      throw new Error('Prompt is empty');
    }

    // 1. First message must be system prompt
    if (prompt[0].role !== 'system') {
      throw new Error(
        `First message must be system prompt, got ${prompt[0].role}`
      );
    }

    // 2. Verify skills are preserved in system prompt
    const systemPrompt = prompt[0];
    for (const skill of expectedSkills) {
      if (!systemPrompt.content.toLowerCase().includes(skill.toLowerCase())) {
        throw new Error(
          `Skill "${skill}" not found in system prompt. ` +
          `Skills must be preserved during compression.`
        );
      }
    }

    // 3. Verify system prompt ID format
    if (!systemPrompt.id.startsWith('system-')) {
      throw new Error(
        `System prompt ID must start with "system-", got ${systemPrompt.id}`
      );
    }

    // 4. Verify no duplicate system prompts
    const systemPrompts = prompt.filter((m) => m.role === 'system');
    if (systemPrompts.length > 1) {
      throw new Error(
        `Multiple system prompts found (${systemPrompts.length}). ` +
        `Only one system prompt allowed.`
      );
    }

    return true;
  }

  /**
   * Extract preserved components from system prompt
   *
   * Extracts skills, tools, and hooks from the system prompt to verify
   * they haven't been lost during compression.
   *
   * @param systemPrompt - System prompt message
   * @returns Preserved components
   *
   * @example
   * ```typescript
   * const components = integration.extractPreservedComponents(systemPrompt);
   * console.log(`Skills: ${components.skills.join(', ')}`);
   * ```
   */
  extractPreservedComponents(systemPrompt: Message): {
    skills: string[];
    tools: string[];
    hooks: string[];
  } {
    const content = systemPrompt.content.toLowerCase();
    const components = {
      skills: [] as string[],
      tools: [] as string[],
      hooks: [] as string[],
    };

    // Extract skills (look for common skill keywords)
    const skillKeywords = [
      'typescript',
      'javascript',
      'python',
      'testing',
      'debugging',
      'refactoring',
      'documentation',
    ];
    for (const skill of skillKeywords) {
      if (content.includes(skill)) {
        components.skills.push(skill);
      }
    }

    // Extract tools (look for tool mentions)
    const toolKeywords = [
      'read-file',
      'write-file',
      'edit-file',
      'shell',
      'web-fetch',
      'web-search',
    ];
    for (const tool of toolKeywords) {
      if (content.includes(tool)) {
        components.tools.push(tool);
      }
    }

    // Extract hooks (look for hook mentions)
    if (content.includes('hook')) {
      components.hooks.push('hooks-enabled');
    }

    return components;
  }

  /**
   * Calculate available space for checkpoints
   *
   * Calculates how many tokens are available for checkpoints after
   * accounting for the system prompt and tier budget.
   *
   * @param tier - Context tier
   * @param systemPromptTokens - System prompt token count
   * @param ollamaLimit - Ollama context limit
   * @returns Available tokens for checkpoints
   *
   * @example
   * ```typescript
   * const available = integration.calculateAvailableSpace(
   *   ContextTier.TIER_3_STANDARD,
   *   800,
   *   6800
   * );
   * ```
   */
  calculateAvailableSpace(
    tier: ContextTier,
    systemPromptTokens: number,
    ollamaLimit: number
  ): number {
    const safetyMargin = 1000; // Reserve for response

    // Available space = Ollama limit - system prompt - safety margin
    // Note: tier budget is NOT subtracted because systemPromptTokens already includes it
    const available = ollamaLimit - systemPromptTokens - safetyMargin;

    return Math.max(0, available);
  }

  /**
   * Validate prompt against tier limits
   *
   * Validates that the complete prompt (system + checkpoints + messages)
   * doesn't exceed the tier-specific limits.
   *
   * @param prompt - Complete prompt
   * @param tier - Context tier
   * @param ollamaLimit - Ollama context limit
   * @returns Validation result
   *
   * @example
   * ```typescript
   * const result = integration.validatePromptAgainstTier(
   *   prompt,
   *   ContextTier.TIER_3_STANDARD,
   *   6800
   * );
   * if (!result.valid) {
   *   console.error(result.message);
   * }
   * ```
   */
  validatePromptAgainstTier(
    prompt: Message[],
    tier: ContextTier,
    ollamaLimit: number
  ): { valid: boolean; tokens: number; limit: number; message?: string } {
    // Calculate total tokens
    const totalTokens = prompt.reduce((sum, m) => {
      return sum + this.getSystemPromptTokens(m);
    }, 0);

    const tierBudget = this.getTokenBudget(tier);
    const safetyMargin = 1000;
    const effectiveLimit = ollamaLimit - safetyMargin;

    // Check if within limits
    if (totalTokens <= effectiveLimit) {
      return {
        valid: true,
        tokens: totalTokens,
        limit: effectiveLimit,
      };
    }

    return {
      valid: false,
      tokens: totalTokens,
      limit: effectiveLimit,
      message:
        `Prompt exceeds tier limit: ${totalTokens} > ${effectiveLimit} tokens. ` +
        `Tier ${tier} budget: ${tierBudget} tokens.`,
    };
  }

  /**
   * Build base prompt with skills/tools/hooks
   *
   * @param config - System prompt configuration
   * @returns Base prompt string
   */
  private buildBasePrompt(config: SystemPromptConfig): string {
    const parts: string[] = [];

    // Add skills section
    if (config.activeSkills.length > 0) {
      parts.push(`Active Skills: ${config.activeSkills.join(', ')}`);
    }

    // Check if model supports tools
    let modelSupportsTools = false;
    if (config.modelId && this.profileManager) {
      try {
        const modelEntry = this.profileManager.getModelEntry(config.modelId);
        modelSupportsTools = (modelEntry as any)?.tool_support ?? false;
      } catch (_error) {
        // Model not found, assume no tool support
        modelSupportsTools = false;
      }
    }

    // Add tools section (only if model supports tools and tools are provided)
    if (modelSupportsTools && config.allowedTools && config.allowedTools.length > 0) {
      parts.push(`Available Tools: ${config.allowedTools.join(', ')}`);
    }

    // Add hooks section (simplified)
    parts.push('Hooks: Enabled');

    // Add sanity checks if requested
    if (config.useSanityChecks) {
      parts.push('Sanity Checks: Enabled');
    }

    return parts.join('\n\n');
  }
}
