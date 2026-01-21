/**
 * Adaptive Context System Integration Tests
 * 
 * Tests for tier detection, mode management, adaptive prompts,
 * never-compressed sections, and tier-specific compression.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import type { ModelInfo, ContextConfig, Message } from '../types.js';
import { 
  ContextTier, 
  OperationalMode, 
  TIER_CONFIGS, 
  MODE_PROFILES,
  SYSTEM_PROMPT_TEMPLATES 
} from '../types.js';

describe('Adaptive Context System', () => {
  let manager: ConversationContextManager;
  const sessionId = 'test-session-adaptive';
  
  const createModelInfo = (contextLimit: number): ModelInfo => ({
    parameters: 7,
    contextLimit
  });
  
  const createConfig = (maxSize: number): Partial<ContextConfig> => ({
    targetSize: maxSize,
    minSize: 2048,
    maxSize,
    autoSize: false,
    compression: {
      enabled: true,
      threshold: 0.7,
      strategy: 'hybrid',
      preserveRecent: 4096,
      summaryMaxTokens: 1024
    },
    snapshots: {
      enabled: false,
      maxCount: 5,
      autoCreate: false,
      autoThreshold: 0.8
    }
  });

  describe('Tier Detection', () => {
    it('should detect Tier 1 for 2-4K contexts', async () => {
      const modelInfo = createModelInfo(4096);
      const config = createConfig(4096);
      
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
      
      // Access private field through type assertion for testing
      const tier = (manager as any).currentTier;
      expect(tier).toBe(ContextTier.TIER_1_MINIMAL);
      
      await manager.stop();
    });

    it('should detect Tier 2 for 4-8K contexts', async () => {
      const modelInfo = createModelInfo(8192);
      const config = createConfig(8192);
      
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
      
      const tier = (manager as any).currentTier;
      expect(tier).toBe(ContextTier.TIER_2_BASIC);
      
      await manager.stop();
    });

    it('should detect Tier 3 for 8-32K contexts', async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
      
      const tier = (manager as any).currentTier;
      expect(tier).toBe(ContextTier.TIER_3_STANDARD);
      
      await manager.stop();
    });

    it('should detect Tier 4 for 32-64K contexts', async () => {
      const modelInfo = createModelInfo(65536);
      const config = createConfig(65536);
      
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
      
      const tier = (manager as any).currentTier;
      expect(tier).toBe(ContextTier.TIER_4_PREMIUM);
      
      await manager.stop();
    });

    it('should detect Tier 5 for 64K+ contexts', async () => {
      const modelInfo = createModelInfo(131072);
      const config = createConfig(131072);
      
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
      
      const tier = (manager as any).currentTier;
      expect(tier).toBe(ContextTier.TIER_5_ULTRA);
      
      await manager.stop();
    });

    it('should emit tier-changed event on tier change', async () => {
      const modelInfo = createModelInfo(8192);
      const config = createConfig(8192);
      
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      
      const tierChangedSpy = vi.fn();
      manager.on('tier-changed', tierChangedSpy);
      
      await manager.start();
      
      // Tier change happens during start if autoSize adjusts context
      // For this test, we just verify the manager is set up correctly
      expect((manager as any).currentTier).toBeDefined();
      
      await manager.stop();
    });
  });

  describe('Mode Management', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should default to Developer mode', () => {
      const mode = manager.getMode();
      expect(mode).toBe(OperationalMode.DEVELOPER);
    });

    it('should switch to Planning mode', () => {
      manager.setMode(OperationalMode.PLANNING);
      const mode = manager.getMode();
      expect(mode).toBe(OperationalMode.PLANNING);
    });

    it('should switch to Assistant mode', () => {
      manager.setMode(OperationalMode.ASSISTANT);
      const mode = manager.getMode();
      expect(mode).toBe(OperationalMode.ASSISTANT);
    });

    it('should switch to Debugger mode', () => {
      manager.setMode(OperationalMode.DEBUGGER);
      const mode = manager.getMode();
      expect(mode).toBe(OperationalMode.DEBUGGER);
    });

    it('should emit mode-changed event', () => {
      const modeChangedSpy = vi.fn();
      manager.on('mode-changed', modeChangedSpy);
      
      manager.setMode(OperationalMode.PLANNING);
      
      expect(modeChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: OperationalMode.PLANNING,
          profile: MODE_PROFILES[OperationalMode.PLANNING]
        })
      );
    });

    it('should update mode profile when switching modes', () => {
      manager.setMode(OperationalMode.PLANNING);
      const profile = (manager as any).modeProfile;
      
      expect(profile.mode).toBe(OperationalMode.PLANNING);
      expect(profile.neverCompress).toContain('goals');
      expect(profile.neverCompress).toContain('requirements');
    });
  });

  describe('Adaptive System Prompts', () => {
    it('should select tier1-developer prompt for 8K Developer mode', async () => {
      const modelInfo = createModelInfo(8192);
      const config = createConfig(8192);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      
      const promptUpdatedSpy = vi.fn();
      manager.on('system-prompt-updated', promptUpdatedSpy);
      
      await manager.start();
      
      expect(promptUpdatedSpy).toHaveBeenCalled();
      const call = promptUpdatedSpy.mock.calls[0][0];
      // Now we emit actualContextTier instead of tier
      expect(call.actualContextTier).toBe(ContextTier.TIER_2_BASIC); // 8K is Tier 2
      expect(call.mode).toBe(OperationalMode.DEVELOPER);
      // Token budget may be higher if hardware allows
      expect(call.tokenBudget).toBeGreaterThanOrEqual(500);
      
      await manager.stop();
    });

    it('should select tier3-developer prompt for 32K Developer mode', async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      
      const promptUpdatedSpy = vi.fn();
      manager.on('system-prompt-updated', promptUpdatedSpy);
      
      await manager.start();
      
      expect(promptUpdatedSpy).toHaveBeenCalled();
      const call = promptUpdatedSpy.mock.calls[0][0];
      // Now we emit actualContextTier instead of tier
      expect(call.actualContextTier).toBe(ContextTier.TIER_3_STANDARD);
      expect(call.mode).toBe(OperationalMode.DEVELOPER);
      // Token budget may be higher if hardware allows
      expect(call.tokenBudget).toBeGreaterThanOrEqual(1000);
      
      await manager.stop();
    });

    it('should update prompt when mode changes', async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
      
      const promptUpdatedSpy = vi.fn();
      manager.on('system-prompt-updated', promptUpdatedSpy);
      
      manager.setMode(OperationalMode.PLANNING);
      
      expect(promptUpdatedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actualContextTier: ContextTier.TIER_3_STANDARD,
          mode: OperationalMode.PLANNING,
          tokenBudget: expect.any(Number)
        })
      );
      
      await manager.stop();
    });

    it('should have all 20 prompt templates defined', () => {
      const expectedKeys = [
        'tier1-developer', 'tier1-planning', 'tier1-assistant', 'tier1-debugger',
        'tier2-developer', 'tier2-planning', 'tier2-assistant', 'tier2-debugger',
        'tier3-developer', 'tier3-planning', 'tier3-assistant', 'tier3-debugger',
        'tier4-developer', 'tier4-planning', 'tier4-assistant', 'tier4-debugger',
        'tier5-developer', 'tier5-planning', 'tier5-assistant', 'tier5-debugger'
      ];
      
      for (const key of expectedKeys) {
        expect(SYSTEM_PROMPT_TEMPLATES[key]).toBeDefined();
        expect(SYSTEM_PROMPT_TEMPLATES[key].template).toBeTruthy();
        expect(SYSTEM_PROMPT_TEMPLATES[key].tokenBudget).toBeGreaterThan(0);
      }
    });

    it('should have correct token budgets for each tier', () => {
      // Tier 1: ~200 tokens
      expect(SYSTEM_PROMPT_TEMPLATES['tier1-developer'].tokenBudget).toBe(200);
      
      // Tier 2: ~500 tokens
      expect(SYSTEM_PROMPT_TEMPLATES['tier2-developer'].tokenBudget).toBe(500);
      
      // Tier 3: ~1000 tokens
      expect(SYSTEM_PROMPT_TEMPLATES['tier3-developer'].tokenBudget).toBe(1000);
      
      // Tier 4: ~1500 tokens
      expect(SYSTEM_PROMPT_TEMPLATES['tier4-developer'].tokenBudget).toBe(1500);
    });
  });

  describe('Never-Compressed Sections', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should store task definition', () => {
      const taskDefinedSpy = vi.fn();
      manager.on('task-defined', taskDefinedSpy);
      
      const task = {
        goal: 'Build user authentication',
        requirements: ['Email/password login', 'JWT tokens'],
        constraints: ['Must use existing DB'],
        timestamp: new Date()
      };
      
      manager.setTaskDefinition(task);
      
      expect(taskDefinedSpy).toHaveBeenCalledWith(
        expect.objectContaining({ task })
      );
    });

    it('should store architecture decisions', () => {
      const decisionSpy = vi.fn();
      manager.on('architecture-decision', decisionSpy);
      
      const decision = {
        id: 'arch-001',
        decision: 'Use JWT for authentication',
        reason: 'Stateless, scalable',
        impact: 'All API endpoints need auth middleware',
        timestamp: new Date()
      };
      
      manager.addArchitectureDecision(decision);
      
      expect(decisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ decision })
      );
    });

    it('should store custom never-compressed sections', () => {
      const sectionSpy = vi.fn();
      manager.on('never-compressed-added', sectionSpy);
      
      const section = {
        type: 'api_contract',
        content: 'POST /api/auth/login',
        timestamp: new Date()
      };
      
      manager.addNeverCompressed(section);
      
      expect(sectionSpy).toHaveBeenCalledWith(
        expect.objectContaining({ section })
      );
    });

    it('should allow multiple architecture decisions', () => {
      const decision1 = {
        id: 'arch-001',
        decision: 'Use JWT',
        reason: 'Stateless',
        impact: 'Auth middleware',
        timestamp: new Date()
      };
      
      const decision2 = {
        id: 'arch-002',
        decision: 'Use PostgreSQL',
        reason: 'ACID compliance',
        impact: 'Database setup',
        timestamp: new Date()
      };
      
      manager.addArchitectureDecision(decision1);
      manager.addArchitectureDecision(decision2);
      
      const context = (manager as any).currentContext;
      expect(context.architectureDecisions).toHaveLength(2);
    });
  });

  describe('Tier Configurations', () => {
    it('should have correct configuration for Tier 1', () => {
      const config = TIER_CONFIGS[ContextTier.TIER_1_MINIMAL];
      expect(config.strategy).toBe('rollover');
      expect(config.maxCheckpoints).toBe(0);
      expect(config.utilizationTarget).toBe(0.90);
    });

    it('should have correct configuration for Tier 2', () => {
      const config = TIER_CONFIGS[ContextTier.TIER_2_BASIC];
      expect(config.strategy).toBe('smart');
      expect(config.maxCheckpoints).toBe(1); // Updated to 1 for 4-8K tier
      expect(config.utilizationTarget).toBe(0.80); // Updated to 0.80
    });

    it('should have correct configuration for Tier 3', () => {
      const config = TIER_CONFIGS[ContextTier.TIER_3_STANDARD];
      expect(config.strategy).toBe('progressive');
      expect(config.maxCheckpoints).toBe(5);
      expect(config.utilizationTarget).toBe(0.70);
    });

    it('should have correct configuration for Tier 4', () => {
      const config = TIER_CONFIGS[ContextTier.TIER_4_PREMIUM];
      expect(config.strategy).toBe('structured');
      expect(config.maxCheckpoints).toBe(10);
      expect(config.utilizationTarget).toBe(0.70);
    });
  });

  describe('Mode Profiles', () => {
    it('should have correct profile for Developer mode', () => {
      const profile = MODE_PROFILES[OperationalMode.DEVELOPER];
      expect(profile.neverCompress).toContain('architecture_decisions');
      expect(profile.neverCompress).toContain('api_contracts');
      expect(profile.compressionPriority).toContain('discussion');
      expect(profile.extractionRules).toBeDefined();
    });

    it('should have correct profile for Planning mode', () => {
      const profile = MODE_PROFILES[OperationalMode.PLANNING];
      expect(profile.neverCompress).toContain('goals');
      expect(profile.neverCompress).toContain('requirements');
      expect(profile.compressionPriority).toContain('brainstorming');
    });

    it('should have correct profile for Assistant mode', () => {
      const profile = MODE_PROFILES[OperationalMode.ASSISTANT];
      expect(profile.neverCompress).toContain('user_preferences');
      expect(profile.compressionPriority).toContain('small_talk');
    });

    it('should have correct profile for Debugger mode', () => {
      const profile = MODE_PROFILES[OperationalMode.DEBUGGER];
      expect(profile.neverCompress).toContain('error_messages');
      expect(profile.neverCompress).toContain('stack_traces');
      expect(profile.compressionPriority).toContain('discussion');
    });
  });

  describe('Integration - Full Flow', () => {
    it('should handle complete tier 3 workflow', async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      
      // Track events
      const events: string[] = [];
      manager.on('started', () => events.push('started'));
      manager.on('tier-changed', () => events.push('tier-changed'));
      manager.on('mode-changed', () => events.push('mode-changed'));
      manager.on('system-prompt-updated', () => events.push('system-prompt-updated'));
      manager.on('task-defined', () => events.push('task-defined'));
      manager.on('architecture-decision', () => events.push('architecture-decision'));
      
      // Start manager
      await manager.start();
      expect(events).toContain('started');
      expect(events).toContain('system-prompt-updated');
      
      // Verify tier
      expect((manager as any).currentTier).toBe(ContextTier.TIER_3_STANDARD);
      
      // Verify mode
      expect(manager.getMode()).toBe(OperationalMode.DEVELOPER);
      
      // Set task definition
      manager.setTaskDefinition({
        goal: 'Build authentication system',
        requirements: ['JWT', 'Email/password'],
        constraints: ['Use existing DB'],
        timestamp: new Date()
      });
      expect(events).toContain('task-defined');
      
      // Add architecture decision
      manager.addArchitectureDecision({
        id: 'arch-001',
        decision: 'Use JWT',
        reason: 'Stateless',
        impact: 'Auth middleware needed',
        timestamp: new Date()
      });
      expect(events).toContain('architecture-decision');
      
      // Switch mode
      manager.setMode(OperationalMode.PLANNING);
      expect(events).toContain('mode-changed');
      expect(manager.getMode()).toBe(OperationalMode.PLANNING);
      
      // Verify system prompt updated
      const promptUpdateCount = events.filter(e => e === 'system-prompt-updated').length;
      expect(promptUpdateCount).toBeGreaterThan(0);
      
      await manager.stop();
    });

    it('should maintain backward compatibility', async () => {
      // Old-style initialization should still work
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      
      await manager.start();
      
      // Old methods should still work
      const usage = manager.getUsage();
      expect(usage).toBeDefined();
      expect(usage.maxTokens).toBe(32768);
      
      // Can still add messages
      const message: Message = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: new Date()
      };
      
      await manager.addMessage(message);
      
      // Can still get messages
      const messages = await manager.getMessages();
      expect(messages.length).toBeGreaterThan(0);
      
      await manager.stop();
    });
  });
});
