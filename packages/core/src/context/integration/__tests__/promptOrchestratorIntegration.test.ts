/**
 * Integration Tests for Prompt Orchestrator Integration
 *
 * Tests integration between context compression and PromptOrchestrator:
 * - System prompt integration
 * - Checkpoint integration
 * - Skills/tools/hooks preservation
 *
 * Requirements: FR-16
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { PromptOrchestrator } from '../../promptOrchestrator.js';
import { ContextTier, OperationalMode } from '../../types.js';
import { PromptOrchestratorIntegration } from '../promptOrchestratorIntegration.js';

import type { CheckpointSummary } from '../../types/storageTypes.js';
import type { Message } from '../../types.js';

describe('PromptOrchestratorIntegration', () => {
  let integration: PromptOrchestratorIntegration;
  let mockOrchestrator: PromptOrchestrator;

  beforeEach(() => {
    // Create mock orchestrator
    mockOrchestrator = {
      getSystemPromptForTierAndMode: (mode: OperationalMode, tier: ContextTier) => {
        return `Tier ${tier} prompt for ${mode} mode with specific instructions`;
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

  describe('System Prompt Integration', () => {
    it('should get system prompt from orchestrator', () => {
      const systemPrompt = integration.getSystemPrompt({
        mode: OperationalMode.DEVELOPER,
        tier: ContextTier.TIER_3_STANDARD,
        activeSkills: ['typescript', 'testing'],
      });

      expect(systemPrompt.role).toBe('system');
      expect(systemPrompt.id).toMatch(/^system-/);
      expect(systemPrompt.content).toContain('Tier');
      expect(systemPrompt.content).toContain('mode');
      expect(systemPrompt.content).toContain('typescript');
      expect(systemPrompt.content).toContain('testing');
    });

    it('should include tier-specific prompt', () => {
      const systemPrompt = integration.getSystemPrompt({
        mode: OperationalMode.PLANNING,
        tier: ContextTier.TIER_2_BASIC,
        activeSkills: [],
      });

      expect(systemPrompt.content).toContain('Tier');
      expect(systemPrompt.content).toContain('mode');
    });

    it('should include skills in system prompt', () => {
      const skills = ['typescript', 'javascript', 'testing', 'debugging'];
      const systemPrompt = integration.getSystemPrompt({
        mode: OperationalMode.DEVELOPER,
        tier: ContextTier.TIER_3_STANDARD,
        activeSkills: skills,
      });

      for (const skill of skills) {
        expect(systemPrompt.content).toContain(skill);
      }
    });

    it('should include tools in system prompt', () => {
      const systemPrompt = integration.getSystemPrompt({
        mode: OperationalMode.DEVELOPER,
        tier: ContextTier.TIER_3_STANDARD,
        activeSkills: [],
      });

      expect(systemPrompt.content).toContain('read-file');
      expect(systemPrompt.content).toContain('write-file');
      expect(systemPrompt.content).toContain('shell');
    });

    it('should include hooks in system prompt', () => {
      const systemPrompt = integration.getSystemPrompt({
        mode: OperationalMode.DEVELOPER,
        tier: ContextTier.TIER_3_STANDARD,
        activeSkills: [],
      });

      expect(systemPrompt.content).toContain('Hooks');
    });

    it('should get correct token budget for tier', () => {
      expect(integration.getTokenBudget(ContextTier.TIER_1_MINIMAL)).toBe(200);
      expect(integration.getTokenBudget(ContextTier.TIER_2_BASIC)).toBe(500);
      expect(integration.getTokenBudget(ContextTier.TIER_3_STANDARD)).toBe(1000);
      expect(integration.getTokenBudget(ContextTier.TIER_4_PREMIUM)).toBe(1500);
      expect(integration.getTokenBudget(ContextTier.TIER_5_ULTRA)).toBe(1500);
    });
  });

  describe('Checkpoint Integration', () => {
    it('should integrate checkpoints into prompt', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const checkpoints: CheckpointSummary[] = [
        createCheckpoint('cp-1', 'Summary of first conversation'),
        createCheckpoint('cp-2', 'Summary of second conversation'),
      ];
      const messages: Message[] = [
        createMessage('msg-1', 'user', 'Hello'),
        createMessage('msg-2', 'assistant', 'Hi there'),
      ];

      const prompt = integration.integrateCheckpoints(
        systemPrompt,
        checkpoints,
        messages
      );

      // Should have: 1 system + 2 checkpoints + 2 messages = 5 total
      expect(prompt).toHaveLength(5);

      // System prompt first
      expect(prompt[0].role).toBe('system');

      // Checkpoints next
      expect(prompt[1].id).toBe('cp-1');
      expect(prompt[2].id).toBe('cp-2');

      // Messages last
      expect(prompt[3].id).toBe('msg-1');
      expect(prompt[4].id).toBe('msg-2');
    });

    it('should handle empty checkpoints', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const messages: Message[] = [
        createMessage('msg-1', 'user', 'Hello'),
      ];

      const prompt = integration.integrateCheckpoints(
        systemPrompt,
        [],
        messages
      );

      // Should have: 1 system + 0 checkpoints + 1 message = 2 total
      expect(prompt).toHaveLength(2);
      expect(prompt[0].role).toBe('system');
      expect(prompt[1].id).toBe('msg-1');
    });

    it('should handle empty messages', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const checkpoints: CheckpointSummary[] = [
        createCheckpoint('cp-1', 'Summary'),
      ];

      const prompt = integration.integrateCheckpoints(
        systemPrompt,
        checkpoints,
        []
      );

      // Should have: 1 system + 1 checkpoint + 0 messages = 2 total
      expect(prompt).toHaveLength(2);
      expect(prompt[0].role).toBe('system');
      expect(prompt[1].id).toBe('cp-1');
    });

    it('should convert checkpoints to assistant messages', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const checkpoints: CheckpointSummary[] = [
        createCheckpoint('cp-1', 'Summary of conversation'),
      ];

      const prompt = integration.integrateCheckpoints(
        systemPrompt,
        checkpoints,
        []
      );

      // Checkpoint should be converted to assistant message
      expect(prompt[1].role).toBe('assistant');
      expect(prompt[1].content).toBe('Summary of conversation');
    });
  });

  describe('Skills/Tools/Hooks Preservation', () => {
    it('should verify prompt structure with skills', () => {
      const skills = ['typescript', 'testing'];
      const systemPrompt = createSystemPrompt(skills);
      const prompt = [systemPrompt];

      expect(() => {
        integration.verifyPromptStructure(prompt, skills);
      }).not.toThrow();
    });

    it('should throw if skill missing from system prompt', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const prompt = [systemPrompt];

      expect(() => {
        integration.verifyPromptStructure(prompt, ['typescript', 'python']);
      }).toThrow(/Skill "python" not found/);
    });

    it('should throw if first message is not system prompt', () => {
      const userMessage = createMessage('msg-1', 'user', 'Hello');
      const prompt = [userMessage];

      expect(() => {
        integration.verifyPromptStructure(prompt, []);
      }).toThrow(/First message must be system prompt/);
    });

    it('should throw if multiple system prompts', () => {
      const systemPrompt1 = createSystemPrompt(['typescript']);
      const systemPrompt2 = createSystemPrompt(['javascript']);
      const prompt = [systemPrompt1, systemPrompt2];

      expect(() => {
        integration.verifyPromptStructure(prompt, ['typescript']);
      }).toThrow(/Multiple system prompts found/);
    });

    it('should throw if system prompt ID invalid', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      systemPrompt.id = 'invalid-id'; // Should start with "system-"
      const prompt = [systemPrompt];

      expect(() => {
        integration.verifyPromptStructure(prompt, ['typescript']);
      }).toThrow(/System prompt ID must start with "system-"/);
    });

    it('should extract skills from system prompt', () => {
      const systemPrompt = createSystemPrompt(['typescript', 'testing', 'debugging']);
      const components = integration.extractPreservedComponents(systemPrompt);

      expect(components.skills).toContain('typescript');
      expect(components.skills).toContain('testing');
      expect(components.skills).toContain('debugging');
    });

    it('should extract tools from system prompt', () => {
      const systemPrompt = createSystemPrompt([]);
      const components = integration.extractPreservedComponents(systemPrompt);

      expect(components.tools).toContain('read-file');
      expect(components.tools).toContain('write-file');
      expect(components.tools).toContain('shell');
    });

    it('should extract hooks from system prompt', () => {
      const systemPrompt = createSystemPrompt([]);
      const components = integration.extractPreservedComponents(systemPrompt);

      expect(components.hooks).toContain('hooks-enabled');
    });
  });

  describe('Available Space Calculation', () => {
    it('should calculate available space correctly', () => {
      const available = integration.calculateAvailableSpace(
        ContextTier.TIER_3_STANDARD,
        800, // system prompt tokens
        6800 // Ollama limit
      );

      // Available = 6800 - 800 - 1000 (tier budget) - 1000 (safety) = 4000
      expect(available).toBe(4000);
    });

    it('should return 0 if no space available', () => {
      const available = integration.calculateAvailableSpace(
        ContextTier.TIER_3_STANDARD,
        6000, // Large system prompt
        6800 // Ollama limit
      );

      // Available = 6800 - 6000 - 1000 - 1000 = -1200, clamped to 0
      expect(available).toBe(0);
    });

    it('should account for tier budget', () => {
      const available1 = integration.calculateAvailableSpace(
        ContextTier.TIER_1_MINIMAL,
        500,
        6800
      );

      const available2 = integration.calculateAvailableSpace(
        ContextTier.TIER_4_PREMIUM,
        500,
        6800
      );

      // Tier 1 has smaller budget (200) so more space available
      // Tier 4 has larger budget (1500) so less space available
      expect(available1).toBeGreaterThan(available2);
    });
  });

  describe('Tier Validation', () => {
    it('should validate prompt within tier limits', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const messages: Message[] = [
        createMessage('msg-1', 'user', 'Short message'),
      ];
      const prompt = [systemPrompt, ...messages];

      const result = integration.validatePromptAgainstTier(
        prompt,
        ContextTier.TIER_3_STANDARD,
        6800
      );

      expect(result.valid).toBe(true);
      expect(result.tokens).toBeLessThanOrEqual(result.limit);
    });

    it('should reject prompt exceeding tier limits', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      // Create a very long message that will definitely exceed limits
      const longContent = 'x'.repeat(30000); // Much longer to ensure it exceeds
      const messages: Message[] = [
        createMessage('msg-1', 'user', longContent),
      ];
      const prompt = [systemPrompt, ...messages];

      const result = integration.validatePromptAgainstTier(
        prompt,
        ContextTier.TIER_3_STANDARD,
        6800
      );

      expect(result.valid).toBe(false);
      expect(result.tokens).toBeGreaterThan(result.limit);
      expect(result.message).toContain('exceeds tier limit');
    });

    it('should include tier budget in validation message', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const longContent = 'x'.repeat(30000); // Much longer to ensure it exceeds
      const messages: Message[] = [
        createMessage('msg-1', 'user', longContent),
      ];
      const prompt = [systemPrompt, ...messages];

      const result = integration.validatePromptAgainstTier(
        prompt,
        ContextTier.TIER_2_BASIC,
        6800
      );

      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
      expect(result.message).toContain('budget');
      expect(result.message).toContain('500');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty prompt', () => {
      expect(() => {
        integration.verifyPromptStructure([], []);
      }).toThrow(/Prompt is empty/);
    });

    it('should handle system prompt with no skills', () => {
      const systemPrompt = createSystemPrompt([]);
      const prompt = [systemPrompt];

      expect(() => {
        integration.verifyPromptStructure(prompt, []);
      }).not.toThrow();
    });

    it('should handle very large checkpoint count', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const checkpoints: CheckpointSummary[] = Array.from({ length: 100 }, (_, i) =>
        createCheckpoint(`cp-${i}`, `Summary ${i}`)
      );
      const messages: Message[] = [];

      const prompt = integration.integrateCheckpoints(
        systemPrompt,
        checkpoints,
        messages
      );

      // Should have: 1 system + 100 checkpoints = 101 total
      expect(prompt).toHaveLength(101);
      expect(prompt[0].role).toBe('system');
    });

    it('should handle system prompt token count estimation', () => {
      const systemPrompt = createSystemPrompt(['typescript']);
      const tokens = integration.getSystemPromptTokens(systemPrompt);

      // Should estimate based on content length
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(systemPrompt.content.length);
    });
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

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

/**
 * Create checkpoint summary
 */
function createCheckpoint(id: string, summary: string): CheckpointSummary {
  return {
    id,
    timestamp: Date.now(),
    summary,
    originalMessageIds: [`msg-${id}`],
    tokenCount: Math.ceil(summary.length / 4),
    compressionLevel: 3,
    compressionNumber: 1,
    metadata: {
      model: 'test-model',
      createdAt: Date.now(),
    },
  };
}

/**
 * Create message
 */
function createMessage(id: string, role: 'user' | 'assistant', content: string): Message {
  return {
    id,
    role,
    content,
    timestamp: new Date(),
  };
}
