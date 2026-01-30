/**
 * Property-Based Tests for Prompt Orchestrator Integration
 *
 * Property 29: Prompt Structure Preservation
 * Validates: Requirements FR-16
 *
 * Tests that prompt structure is preserved during compression:
 * - System prompt always first
 * - Checkpoints come before recent messages
 * - Skills/tools/hooks preserved in system prompt
 * - No duplicate system prompts
 * - Tier limits respected
 */

import * as fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';

import { PromptOrchestrator } from '../../promptOrchestrator.js';
import { ContextTier, OperationalMode } from '../../types.js';
import { PromptOrchestratorIntegration } from '../promptOrchestratorIntegration.js';

import type { CheckpointSummary } from '../../types/storageTypes.js';
import type { Message } from '../../types.js';

describe('Property 29: Prompt Structure Preservation', () => {
  let integration: PromptOrchestratorIntegration;
  let mockOrchestrator: PromptOrchestrator;

  beforeEach(() => {
    // Create mock orchestrator
    mockOrchestrator = {
      getSystemPromptForTierAndMode: (mode: OperationalMode, tier: ContextTier) => {
        return `Tier ${tier} prompt for ${mode} mode`;
      },
      getSystemPromptTokenBudget: (tier: ContextTier) => {
        const budgets: Record<ContextTier, number> = {
          [ContextTier.TIER_1_MINIMAL]: 200,
          [ContextTier.TIER_2_BASIC]: 500,
          [ContextTier.TIER_3_STANDARD]: 1000,
          [ContextTier.TIER_4_PREMIUM]: 1500,
          [ContextTier.TIER_5_ULTRA]: 1500,
        };
        return budgets[tier] ?? 1000;
      },
    } as PromptOrchestrator;

    integration = new PromptOrchestratorIntegration(mockOrchestrator);
  });

  /**
   * Property: System prompt always first
   *
   * For any valid prompt structure, the first message must always be
   * the system prompt, regardless of how many checkpoints or messages
   * are added.
   */
  it('property: system prompt always first in integrated prompt', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary checkpoints and messages
        fc.array(arbCheckpoint(), { minLength: 0, maxLength: 10 }),
        fc.array(arbMessage(), { minLength: 0, maxLength: 20 }),
        (checkpoints, messages) => {
          // Create system prompt
          const systemPrompt = createSystemPrompt(['typescript', 'testing']);

          // Integrate checkpoints
          const prompt = integration.integrateCheckpoints(systemPrompt, checkpoints, messages);

          // Property: First message is always system prompt
          expect(prompt.length).toBeGreaterThan(0);
          expect(prompt[0].role).toBe('system');
          expect(prompt[0].id).toMatch(/^system-/);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Skills preserved in system prompt
   *
   * For any set of skills, they must be preserved in the system prompt
   * after integration, regardless of compression operations.
   */
  it('property: skills preserved in system prompt', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary skills
        fc.array(fc.constantFrom('typescript', 'javascript', 'python', 'testing', 'debugging'), {
          minLength: 1,
          maxLength: 5,
        }),
        fc.array(arbCheckpoint(), { maxLength: 5 }),
        fc.array(arbMessage(), { maxLength: 10 }),
        (skills, checkpoints, messages) => {
          // Create system prompt with skills
          const systemPrompt = createSystemPrompt(skills);

          // Integrate checkpoints
          const prompt = integration.integrateCheckpoints(systemPrompt, checkpoints, messages);

          // Property: All skills must be in system prompt
          const systemPromptContent = prompt[0].content.toLowerCase();
          for (const skill of skills) {
            expect(systemPromptContent).toContain(skill.toLowerCase());
          }

          // Property: Verification should pass
          expect(() => {
            integration.verifyPromptStructure(prompt, skills);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: No duplicate system prompts
   *
   * For any prompt structure, there must be exactly one system prompt,
   * regardless of how many times integration operations are performed.
   */
  it('property: no duplicate system prompts', () => {
    fc.assert(
      fc.property(
        fc.array(arbCheckpoint(), { maxLength: 10 }),
        fc.array(arbMessage(), { maxLength: 20 }),
        (checkpoints, messages) => {
          // Create system prompt
          const systemPrompt = createSystemPrompt(['typescript']);

          // Integrate checkpoints
          const prompt = integration.integrateCheckpoints(systemPrompt, checkpoints, messages);

          // Property: Exactly one system prompt
          const systemPrompts = prompt.filter((m) => m.role === 'system');
          expect(systemPrompts.length).toBe(1);

          // Property: Verification should pass
          expect(() => {
            integration.verifyPromptStructure(prompt, ['typescript']);
          }).not.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Checkpoints come before recent messages
   *
   * For any prompt structure, checkpoint summaries must appear after
   * the system prompt but before recent messages.
   */
  it('property: checkpoints come before recent messages', () => {
    fc.assert(
      fc.property(
        fc.array(arbCheckpoint(), { minLength: 1, maxLength: 5 }),
        fc.array(arbMessage(), { minLength: 1, maxLength: 10 }),
        (checkpoints, messages) => {
          // Create system prompt
          const systemPrompt = createSystemPrompt(['typescript']);

          // Integrate checkpoints
          const prompt = integration.integrateCheckpoints(systemPrompt, checkpoints, messages);

          // Find indices
          const firstCheckpointIndex = prompt.findIndex((m) =>
            checkpoints.some((cp) => cp.id === m.id)
          );
          const firstMessageIndex = prompt.findIndex((m) =>
            messages.some((msg) => msg.id === m.id)
          );

          // Property: If both exist, checkpoints come before messages
          if (firstCheckpointIndex !== -1 && firstMessageIndex !== -1) {
            expect(firstCheckpointIndex).toBeLessThan(firstMessageIndex);
          }

          // Property: System prompt comes before checkpoints
          if (firstCheckpointIndex !== -1) {
            expect(0).toBeLessThan(firstCheckpointIndex);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Tier limits respected
   *
   * For any tier and prompt structure, the total token count must not
   * exceed the tier-specific limits.
   */
  it('property: tier limits respected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 4000, max: 8000 }), // Ollama limit
        (tier, ollamaLimit) => {
          // Create small prompt that fits within limits
          const systemPrompt = createSystemPrompt(['typescript']);
          const checkpoints: CheckpointSummary[] = [
            {
              id: 'cp-1',
              timestamp: Date.now(),
              summary: 'Short summary',
              originalMessageIds: ['msg-1'],
              tokenCount: 10,
              compressionLevel: 3,
              compressionNumber: 1,
              metadata: {
                model: 'test-model',
                createdAt: Date.now(),
              },
            },
          ];
          const messages: Message[] = [
            {
              id: 'msg-2',
              role: 'user',
              content: 'Short message',
              timestamp: new Date(),
            },
          ];

          // Integrate checkpoints
          const prompt = integration.integrateCheckpoints(systemPrompt, checkpoints, messages);

          // Validate against tier
          const result = integration.validatePromptAgainstTier(prompt, tier, ollamaLimit);

          // Property: Validation should pass for small prompts
          expect(result.valid).toBe(true);
          expect(result.tokens).toBeLessThanOrEqual(result.limit);
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Available space calculation is consistent
   *
   * For any tier and system prompt size, the available space calculation
   * must be consistent and non-negative.
   */
  it('property: available space calculation is consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          ContextTier.TIER_1_MINIMAL,
          ContextTier.TIER_2_BASIC,
          ContextTier.TIER_3_STANDARD,
          ContextTier.TIER_4_PREMIUM,
          ContextTier.TIER_5_ULTRA
        ),
        fc.integer({ min: 100, max: 2000 }), // System prompt tokens
        fc.integer({ min: 4000, max: 8000 }), // Ollama limit
        (tier, systemPromptTokens, ollamaLimit) => {
          // Calculate available space
          const available = integration.calculateAvailableSpace(
            tier,
            systemPromptTokens,
            ollamaLimit
          );

          // Property: Available space is non-negative
          expect(available).toBeGreaterThanOrEqual(0);

          // Property: Available space is less than Ollama limit
          expect(available).toBeLessThan(ollamaLimit);

          // Property: Calculation is consistent
          const available2 = integration.calculateAvailableSpace(
            tier,
            systemPromptTokens,
            ollamaLimit
          );
          expect(available).toBe(available2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Component extraction is idempotent
   *
   * For any system prompt, extracting components multiple times should
   * yield the same result.
   */
  it('property: component extraction is idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('typescript', 'javascript', 'python', 'testing'), {
          minLength: 1,
          maxLength: 5,
        }),
        (skills) => {
          // Create system prompt
          const systemPrompt = createSystemPrompt(skills);

          // Extract components twice
          const components1 = integration.extractPreservedComponents(systemPrompt);
          const components2 = integration.extractPreservedComponents(systemPrompt);

          // Property: Results are identical
          expect(components1.skills).toEqual(components2.skills);
          expect(components1.tools).toEqual(components2.tools);
          expect(components1.hooks).toEqual(components2.hooks);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================================
// Arbitraries (Generators)
// ============================================================================

/**
 * Generate arbitrary checkpoint summary
 */
function arbCheckpoint(): fc.Arbitrary<CheckpointSummary> {
  return fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }).map((s) => `cp-${s}`),
    timestamp: fc.integer({ min: 1000000000000, max: 9999999999999 }),
    summary: fc.lorem({ maxCount: 50 }),
    originalMessageIds: fc.array(
      fc.string({ minLength: 5, maxLength: 20 }).map((s) => `msg-${s}`),
      { minLength: 1, maxLength: 10 }
    ),
    tokenCount: fc.integer({ min: 10, max: 500 }),
    compressionLevel: fc.constantFrom(1, 2, 3) as fc.Arbitrary<1 | 2 | 3>,
    compressionNumber: fc.integer({ min: 1, max: 20 }),
    metadata: fc.record({
      model: fc.constant('test-model'),
      createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
    }),
  });
}

/**
 * Generate arbitrary message
 */
function arbMessage(): fc.Arbitrary<Message> {
  return fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }).map((s) => `msg-${s}`),
    role: fc.constantFrom('user', 'assistant') as fc.Arbitrary<'user' | 'assistant'>,
    content: fc.lorem({ maxCount: 100 }),
    timestamp: fc.date({ min: new Date(2020, 0, 1), max: new Date(2026, 11, 31) }),
  });
}

/**
 * Create system prompt with skills
 */
function createSystemPrompt(skills: string[]): Message {
  const content = `
System Prompt

Active Skills: ${skills.join(', ')}

Available Tools: read-file, write-file, edit-file, shell, web-fetch, web-search

Hooks: Enabled

You are an AI assistant with the above skills and tools.
  `.trim();

  return {
    id: `system-${Date.now()}`,
    role: 'system',
    content,
    timestamp: new Date(),
  };
}
