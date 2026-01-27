/**
 * Tests for validateAndBuildPrompt (Phase 1: Pre-Send Validation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import { ContextTier, OperationalMode } from '../types.js';
import type { Message, ModelInfo } from '../types.js';

describe('validateAndBuildPrompt', () => {
  let contextManager: ConversationContextManager;
  const sessionId = 'test-session';
  
  const modelInfo: ModelInfo = {
    modelId: 'test-model',
    parameters: 7000000000,
    contextLimit: 8192,
    contextProfiles: [
      { size: 4096, ollama_context_size: 3481 },
      { size: 8192, ollama_context_size: 6963 },
      { size: 16384, ollama_context_size: 13926 }
    ]
  };

  beforeEach(() => {
    contextManager = new ConversationContextManager(
      sessionId,
      modelInfo,
      {
        targetSize: 8192,
        autoSize: false
      }
    );
  });

  it('should validate prompt successfully when under threshold', async () => {
    // Add a small message
    const message: Message = {
      id: 'test-1',
      role: 'user',
      content: 'Hello, world!',
      timestamp: new Date()
    };

    const result = await contextManager.validateAndBuildPrompt(message);

    expect(result.valid).toBe(true);
    expect(result.prompt.length).toBeGreaterThan(0);
    expect(result.ollamaLimit).toBe(6963);
  });

  it('should include new message in token calculation', async () => {
    const newMessage: Message = {
      id: 'test-new',
      role: 'user',
      content: 'This is a new message',
      timestamp: new Date()
    };

    const result = await contextManager.validateAndBuildPrompt(newMessage);

    expect(result.valid).toBe(true);
    expect(result.prompt).toContain(newMessage);
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('should handle validation errors gracefully', async () => {
    // Mock getBudget to throw error
    vi.spyOn(contextManager, 'getBudget').mockImplementation(() => {
      throw new Error('Budget calculation failed');
    });

    const message: Message = {
      id: 'test-1',
      role: 'user',
      content: 'Hello',
      timestamp: new Date()
    };

    await expect(contextManager.validateAndBuildPrompt(message)).rejects.toThrow('Budget calculation failed');
  });

  it('should calculate budget correctly', async () => {
    // Add some messages
    for (let i = 0; i < 5; i++) {
      await contextManager.addMessage({
        id: `msg-${i}`,
        role: 'user',
        content: `Message ${i} with some content to make it longer`,
        timestamp: new Date()
      });
    }

    const result = await contextManager.validateAndBuildPrompt();

    expect(result.valid).toBe(true);
    expect(result.totalTokens).toBeGreaterThan(0);
    
    // Budget should be calculated
    const budget = contextManager.getBudget();
    expect(budget.totalOllamaSize).toBe(6963);
    expect(budget.availableBudget).toBeGreaterThan(0);
  });

  it('should trigger emergency compression when usage is high', async () => {
    // Mock compress method
    const compressSpy = vi.spyOn(contextManager, 'compress').mockResolvedValue();
    
    // Mock getBudget to return high usage (96%)
    vi.spyOn(contextManager, 'getBudget').mockReturnValue({
      totalOllamaSize: 6963,
      systemPromptTokens: 100,
      checkpointTokens: 0,
      availableBudget: 6863,
      conversationTokens: 6600, // 96% of available
      budgetPercentage: 96
    });

    const result = await contextManager.validateAndBuildPrompt();

    expect(result.emergencyAction).toBe('compression');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should trigger emergency rollover when at 100%', async () => {
    // Mock createSnapshot method
    const snapshotSpy = vi.spyOn(contextManager, 'createSnapshot').mockResolvedValue({
      id: 'snapshot-1',
      sessionId,
      timestamp: new Date(),
      context: {
        sessionId,
        messages: [],
        systemPrompt: {
          id: 'system-1',
          role: 'system',
          content: '',
          timestamp: new Date()
        },
        tokenCount: 0,
        maxTokens: 6963,
        checkpoints: [],
        architectureDecisions: [],
        neverCompressed: [],
        metadata: {
          model: 'test-model',
          contextSize: 6963,
          compressionHistory: []
        }
      },
      metadata: {
        reason: 'emergency',
        tokenCount: 0,
        messageCount: 0
      }
    });
    
    // Mock getBudget to return 100%+ usage
    vi.spyOn(contextManager, 'getBudget').mockReturnValue({
      totalOllamaSize: 6963,
      systemPromptTokens: 100,
      checkpointTokens: 0,
      availableBudget: 6863,
      conversationTokens: 6900, // 100%+ of available
      budgetPercentage: 100.5
    });

    const result = await contextManager.validateAndBuildPrompt();

    expect(snapshotSpy).toHaveBeenCalled();
    expect(result.emergencyAction).toBe('rollover');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('should return valid result after successful rollover', async () => {
    // Mock createSnapshot
    vi.spyOn(contextManager, 'createSnapshot').mockResolvedValue({
      id: 'snapshot-1',
      sessionId,
      timestamp: new Date(),
      context: {
        sessionId,
        messages: [],
        systemPrompt: {
          id: 'system-1',
          role: 'system',
          content: '',
          timestamp: new Date()
        },
        tokenCount: 0,
        maxTokens: 6963,
        checkpoints: [],
        architectureDecisions: [],
        neverCompressed: [],
        metadata: {
          model: 'test-model',
          contextSize: 6963,
          compressionHistory: []
        }
      },
      metadata: {
        reason: 'emergency',
        tokenCount: 0,
        messageCount: 0
      }
    });
    
    // Mock getBudget to return 100%+ usage
    vi.spyOn(contextManager, 'getBudget').mockReturnValue({
      totalOllamaSize: 6963,
      systemPromptTokens: 100,
      checkpointTokens: 0,
      availableBudget: 6863,
      conversationTokens: 6900,
      budgetPercentage: 100.5
    });

    const result = await contextManager.validateAndBuildPrompt();

    // After rollover, result should be valid
    expect(result.valid).toBe(true);
    expect(result.emergencyAction).toBe('rollover');
  });

  it('should emit warnings at different thresholds', async () => {
    const getBudgetSpy = vi.spyOn(contextManager, 'getBudget');
    
    // Test 70% threshold
    getBudgetSpy.mockReturnValue({
      totalOllamaSize: 6963,
      systemPromptTokens: 100,
      checkpointTokens: 0,
      availableBudget: 6863,
      conversationTokens: 4800, // 70%
      budgetPercentage: 70
    });

    let result = await contextManager.validateAndBuildPrompt();
    // At 70%, should have INFO warning
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('INFO'))).toBe(true);

    // Test 80% threshold
    getBudgetSpy.mockReturnValue({
      totalOllamaSize: 6963,
      systemPromptTokens: 100,
      checkpointTokens: 0,
      availableBudget: 6863,
      conversationTokens: 5490, // 80%
      budgetPercentage: 80
    });

    result = await contextManager.validateAndBuildPrompt();
    // At 80%, should have INFO warning about compression
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('INFO') || w.includes('compression'))).toBe(true);
    
    getBudgetSpy.mockRestore();
  });
});
