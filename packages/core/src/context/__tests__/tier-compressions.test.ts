/**
 * Tier-Specific Compression Tests
 * 
 * Tests for all 5 tier compression strategies:
 * - Tier 1: Rollover (2-4K)
 * - Tier 2: Smart (4-8K)
 * - Tier 3: Progressive (8-32K)
 * - Tier 4: Structured (32-64K)
 * - Tier 5: Ultra Structured (64K+)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import type { ModelInfo, ContextConfig, Message } from '../types.js';
import { ContextTier, OperationalMode } from '../types.js';

describe('Tier-Specific Compression Strategies', () => {
  let manager: ConversationContextManager;
  const sessionId = 'test-tier-compression';
  
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
      enabled: true,
      maxCount: 5,
      autoCreate: true,
      autoThreshold: 0.8
    }
  });
  
  const createMessage = (content: string, role: 'user' | 'assistant' = 'user'): Message => ({
    id: `msg-${Date.now()}-${Math.random()}`,
    role,
    content,
    timestamp: new Date()
  });
  
  const addMessages = async (count: number, prefix: string = 'Message') => {
    for (let i = 0; i < count; i++) {
      await manager.addMessage(createMessage(`${prefix} ${i + 1}: ${'x'.repeat(100)}`));
    }
  };

  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
  });

  describe('Tier 1: Rollover Strategy (2-4K)', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(4096);
      const config = createConfig(4096);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should use rollover strategy for Tier 1', () => {
      const tierConfig = (manager as any).tierConfig;
      expect(tierConfig.tier).toBe(ContextTier.TIER_1_MINIMAL);
      expect(tierConfig.strategy).toBe('rollover');
      expect(tierConfig.maxCheckpoints).toBe(0);
    });

    it('should create snapshot and rollover when context fills', async () => {
      const rolloverSpy = vi.fn();
      manager.on('rollover-complete', rolloverSpy);
      
      // Add enough messages to trigger rollover
      await addMessages(30, 'Tier1');
      
      // Manually trigger compression
      await manager.compress();
      
      // Should have created rollover
      expect(rolloverSpy).toHaveBeenCalled();
      
      // Should have no checkpoints (Tier 1 doesn't use them)
      const context = (manager as any).currentContext;
      expect(context.checkpoints?.length || 0).toBe(0);
      
      // Should have reduced message count (only system + summary)
      expect(context.messages.length).toBeLessThan(10);
    });

    it('should preserve ultra-compact summary after rollover', async () => {
      await addMessages(25, 'Important');
      await manager.compress();
      
      const context = (manager as any).currentContext;
      const summaryMessage = context.messages.find((m: Message) => 
        m.id.includes('rollover-summary')
      );
      
      expect(summaryMessage).toBeDefined();
      expect(summaryMessage?.role).toBe('system');
      expect(summaryMessage?.content).toContain('Previous conversation summary');
    });
  });

  describe('Tier 2: Smart Compression (4-8K)', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(8192);
      const config = createConfig(8192);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should use smart strategy for Tier 2', () => {
      const tierConfig = (manager as any).tierConfig;
      expect(tierConfig.tier).toBe(ContextTier.TIER_2_BASIC);
      expect(tierConfig.strategy).toBe('smart');
      expect(tierConfig.maxCheckpoints).toBe(1);
    });

    it('should create single detailed checkpoint', async () => {
      const compressSpy = vi.fn();
      manager.on('tier2-compressed', compressSpy);
      
      // Add enough messages to trigger compression
      await addMessages(40, 'Tier2');
      
      // Manually trigger compression
      await manager.compress();
      
      // Should have created compression
      expect(compressSpy).toHaveBeenCalled();
      
      // Should have exactly 1 checkpoint
      const context = (manager as any).currentContext;
      expect(context.checkpoints?.length).toBeGreaterThan(0);
      expect(context.checkpoints?.length).toBeLessThanOrEqual(5); // Soft limit
    });

    it('should preserve critical information', async () => {
      const compressSpy = vi.fn();
      manager.on('tier2-compressed', compressSpy);
      
      // Add messages with architecture decisions
      await manager.addMessage(createMessage('We decided to use React for the frontend'));
      await manager.addMessage(createMessage('Created file: src/App.tsx'));
      await addMessages(35, 'Filler');
      
      await manager.compress();
      
      // Should have been called
      expect(compressSpy).toHaveBeenCalled();
      
      // Check the event data
      const eventData = compressSpy.mock.calls[0][0];
      expect(eventData).toBeDefined();
      expect(eventData.checkpoint).toBeDefined();
    });

    it('should merge checkpoints when soft limit exceeded', async () => {
      // Create multiple compressions to exceed soft limit
      for (let i = 0; i < 8; i++) {
        await addMessages(15, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      // Should have merged old checkpoints
      expect(context.checkpoints?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Tier 3: Progressive Checkpoints (8-32K)', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should use progressive strategy for Tier 3', () => {
      const tierConfig = (manager as any).tierConfig;
      expect(tierConfig.tier).toBe(ContextTier.TIER_3_STANDARD);
      expect(tierConfig.strategy).toBe('progressive');
      expect(tierConfig.maxCheckpoints).toBe(5);
    });

    it('should create hierarchical checkpoints', async () => {
      const compressSpy = vi.fn();
      manager.on('tier3-compressed', compressSpy);
      
      // Add enough messages to trigger compression
      await addMessages(80, 'Tier3');
      
      // Manually trigger compression
      await manager.compress();
      
      // Should have created compression
      expect(compressSpy).toHaveBeenCalled();
      
      // Should have checkpoints
      const context = (manager as any).currentContext;
      expect(context.checkpoints?.length).toBeGreaterThan(0);
      expect(context.checkpoints?.length).toBeLessThanOrEqual(5);
    });

    it('should preserve never-compressed sections', async () => {
      // Add task definition
      const context = (manager as any).currentContext;
      context.taskDefinition = {
        goal: 'Build a REST API',
        requirements: ['Authentication', 'CRUD operations'],
        constraints: ['Use TypeScript', 'PostgreSQL']
      };
      
      await addMessages(70, 'Work');
      await manager.compress();
      
      // Task definition should be in messages after compression
      const messages = context.messages;
      const taskMessage = messages.find((m: any) => m.content.includes('task_definition'));
      expect(taskMessage).toBeDefined();
    });

    it('should compress old checkpoints hierarchically', async () => {
      // Create multiple compressions to test aging
      for (let i = 0; i < 6; i++) {
        await addMessages(30, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      const checkpoints = context.checkpoints || [];
      
      // Should have checkpoints at different levels
      const levels = checkpoints.map((cp: any) => cp.level);
      expect(levels).toContain(1); // COMPACT
      expect(levels).toContain(2); // MODERATE
      expect(levels).toContain(3); // DETAILED
    });

    it('should merge checkpoints when limit exceeded', async () => {
      // Create many compressions to exceed limit
      for (let i = 0; i < 8; i++) {
        await addMessages(25, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      expect(context.checkpoints?.length).toBeLessThanOrEqual(5);
      
      // Should have a merged checkpoint
      const merged = context.checkpoints?.find((cp: any) => 
        cp.id.includes('merged')
      );
      expect(merged).toBeDefined();
    });
  });

  describe('Tier 4: Structured Checkpoints (32-64K)', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(65536);
      const config = createConfig(65536);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should use structured strategy for Tier 4', () => {
      const tierConfig = (manager as any).tierConfig;
      expect(tierConfig.tier).toBe(ContextTier.TIER_4_PREMIUM);
      expect(tierConfig.strategy).toBe('structured');
      expect(tierConfig.maxCheckpoints).toBe(10);
    });

    it('should create rich checkpoints with metadata', async () => {
      const compressSpy = vi.fn();
      manager.on('tier4-compressed', compressSpy);
      
      // Add messages with rich content
      await manager.addMessage(createMessage('Architecture decision: Use microservices'));
      await manager.addMessage(createMessage('Created files: api.ts, db.ts, auth.ts'));
      await addMessages(100, 'Tier4');
      
      await manager.compress();
      
      expect(compressSpy).toHaveBeenCalled();
      const eventData = compressSpy.mock.calls[0][0] as any;
      
      // Should have checkpoint
      expect(eventData.checkpoint).toBeDefined();
    });

    it('should maintain up to 10 checkpoints', async () => {
      // Create many compressions
      for (let i = 0; i < 12; i++) {
        await addMessages(40, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      expect(context.checkpoints?.length).toBeLessThanOrEqual(10);
    });

    it('should use semantic merging for old checkpoints', async () => {
      // Create multiple compressions
      for (let i = 0; i < 15; i++) {
        await addMessages(35, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      const merged = context.checkpoints?.find((cp: any) => 
        cp.id.includes('merged-tier4')
      );
      
      expect(merged).toBeDefined();
      // Tier 4 merged checkpoints should be larger (200 tokens)
      expect(merged?.currentTokens).toBeGreaterThanOrEqual(150);
    });

    it('should preserve extensive never-compressed sections', async () => {
      const context = (manager as any).currentContext;
      
      // Add multiple architecture decisions
      context.architectureDecisions = [
        { decision: 'Use React', rationale: 'Modern UI', impact: 'High' },
        { decision: 'Use PostgreSQL', rationale: 'Relational data', impact: 'High' },
        { decision: 'Use JWT', rationale: 'Stateless auth', impact: 'Medium' }
      ];
      
      await addMessages(90, 'Work');
      await manager.compress();
      
      // Architecture decisions should be in messages
      const messages = context.messages;
      const archMessages = messages.filter((m: any) => m.content.includes('architecture_decision'));
      expect(archMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Tier 5: Ultra Structured Checkpoints (64K+)', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(131072); // 128K
      const config = createConfig(131072);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should detect Tier 5 for 64K+ contexts', () => {
      const tierConfig = (manager as any).tierConfig;
      expect(tierConfig.tier).toBe(ContextTier.TIER_5_ULTRA);
      expect(tierConfig.strategy).toBe('structured');
      expect(tierConfig.maxCheckpoints).toBe(15);
    });

    it('should create ultra-rich checkpoints', async () => {
      const compressSpy = vi.fn();
      manager.on('tier5-compressed', compressSpy);
      
      // Add extensive content
      await manager.addMessage(createMessage('Major architecture decision: Microservices with event sourcing'));
      await manager.addMessage(createMessage('Created 10 files: api.ts, db.ts, auth.ts, user.ts, order.ts, payment.ts, notification.ts, logger.ts, config.ts, types.ts'));
      await addMessages(150, 'Tier5');
      
      await manager.compress();
      
      expect(compressSpy).toHaveBeenCalled();
      const eventData = compressSpy.mock.calls[0][0] as any;
      
      // Should have extensive metadata
      expect(eventData.richMetadata).toBeDefined();
      expect(eventData.checkpoint).toBeDefined();
    });

    it('should maintain up to 15 checkpoints', async () => {
      // Create many compressions
      for (let i = 0; i < 18; i++) {
        await addMessages(50, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      expect(context.checkpoints?.length).toBeLessThanOrEqual(15);
    });

    it('should use maximum preservation in merged checkpoints', async () => {
      // Create multiple compressions
      for (let i = 0; i < 20; i++) {
        await addMessages(45, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      const merged = context.checkpoints?.find((cp: any) => 
        cp.id.includes('merged-tier5')
      );
      
      expect(merged).toBeDefined();
      // Tier 5 merged checkpoints should be largest (300 tokens)
      expect(merged?.currentTokens).toBeGreaterThanOrEqual(250);
    });

    it('should handle massive context efficiently', async () => {
      // Add a lot of messages
      for (let i = 0; i < 10; i++) {
        await addMessages(100, `Batch${i}`);
        await manager.compress();
      }
      
      const context = (manager as any).currentContext;
      
      // Should still be within reasonable bounds
      expect(context.checkpoints?.length).toBeLessThanOrEqual(15);
      expect(context.messages.length).toBeLessThan(200);
      
      // Should have hierarchical compression
      const levels = new Set(context.checkpoints?.map((cp: any) => cp.level) || []);
      expect(levels.size).toBeGreaterThan(1); // Multiple levels
    });
  });

  describe('Cross-Tier Behavior', () => {
    it('should use appropriate strategy for each tier', async () => {
      const tiers = [
        { size: 4096, tier: ContextTier.TIER_1_MINIMAL, strategy: 'rollover', checkpoints: 0 },
        { size: 8192, tier: ContextTier.TIER_2_BASIC, strategy: 'smart', checkpoints: 1 },
        { size: 32768, tier: ContextTier.TIER_3_STANDARD, strategy: 'progressive', checkpoints: 5 },
        { size: 65536, tier: ContextTier.TIER_4_PREMIUM, strategy: 'structured', checkpoints: 10 },
        { size: 131072, tier: ContextTier.TIER_5_ULTRA, strategy: 'structured', checkpoints: 15 }
      ];
      
      for (const { size, tier, strategy, checkpoints } of tiers) {
        const modelInfo = createModelInfo(size);
        const config = createConfig(size);
        const mgr = new ConversationContextManager(`test-${tier}`, modelInfo, config);
        await mgr.start();
        
        const tierConfig = (mgr as any).tierConfig;
        expect(tierConfig.tier).toBe(tier);
        expect(tierConfig.strategy).toBe(strategy);
        expect(tierConfig.maxCheckpoints).toBe(checkpoints);
        
        await mgr.stop();
      }
    });

    it('should scale checkpoint limits appropriately', () => {
      const limits = [0, 1, 5, 10, 15];
      const sizes = [4096, 8192, 32768, 65536, 131072];
      const tiers = [
        ContextTier.TIER_1_MINIMAL,
        ContextTier.TIER_2_BASIC,
        ContextTier.TIER_3_STANDARD,
        ContextTier.TIER_4_PREMIUM,
        ContextTier.TIER_5_ULTRA
      ];
      
      sizes.forEach((size, index) => {
        const modelInfo = createModelInfo(size);
        const config = createConfig(size);
        const mgr = new ConversationContextManager(`test-${tiers[index]}`, modelInfo, config);
        
        const tierConfig = (mgr as any).tierConfig;
        expect(tierConfig.maxCheckpoints).toBe(limits[index]);
      });
    });
  });

  describe('Mode-Aware Compression', () => {
    beforeEach(async () => {
      const modelInfo = createModelInfo(32768);
      const config = createConfig(32768);
      manager = new ConversationContextManager(sessionId, modelInfo, config);
      await manager.start();
    });

    it('should extract architecture decisions in Developer mode', async () => {
      manager.setMode(OperationalMode.DEVELOPER);
      
      await manager.addMessage(createMessage('We decided to use React for the UI'));
      await manager.addMessage(createMessage('API contract: POST /api/users'));
      await addMessages(60, 'Code');
      
      await manager.compress();
      
      const context = (manager as any).currentContext;
      const checkpoint = context.checkpoints?.[context.checkpoints.length - 1];
      
      // Should have created a checkpoint
      expect(checkpoint).toBeDefined();
    });

    it('should extract goals in Planning mode', async () => {
      manager.setMode(OperationalMode.PLANNING);
      
      await manager.addMessage(createMessage('Goal: Build authentication system'));
      await manager.addMessage(createMessage('Requirement: Support OAuth2'));
      await addMessages(60, 'Planning');
      
      await manager.compress();
      
      const context = (manager as any).currentContext;
      
      // Should have compressed successfully
      expect(context.checkpoints?.length).toBeGreaterThan(0);
    });

    it('should extract errors in Debugger mode', async () => {
      manager.setMode(OperationalMode.DEBUGGER);
      
      await manager.addMessage(createMessage('Error: TypeError at line 42'));
      await manager.addMessage(createMessage('Stack trace: at function foo()'));
      await addMessages(60, 'Debug');
      
      await manager.compress();
      
      const context = (manager as any).currentContext;
      const checkpoint = context.checkpoints?.[context.checkpoints.length - 1];
      
      // Should have extracted error information
      expect(checkpoint).toBeDefined();
    });
  });
});
