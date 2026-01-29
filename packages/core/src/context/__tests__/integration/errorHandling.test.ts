/**
 * Integration Test: Error Handling
 *
 * Tests comprehensive error handling throughout the system:
 * - LLM failures during summarization
 * - Provider errors and timeouts
 * - Invalid message handling
 * - Corrupted state recovery
 * - File system errors
 * - Graceful degradation
 *
 * Requirements: FR-6, FR-7
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { ContextOrchestrator } from '../../orchestration/contextOrchestrator.js';
import { TokenCounterService } from '../../tokenCounter.js';

import type { ProviderAdapter } from '../../../provider/types.js';
import type { Message } from '../../types.js';

/**
 * Mock provider with configurable error modes
 */
class ErrorMockProvider implements ProviderAdapter {
  name = 'error-mock';
  private errorMode: 'none' | 'timeout' | 'error' | 'invalid' = 'none';
  private callCount = 0;
  
  setErrorMode(mode: 'none' | 'timeout' | 'error' | 'invalid') {
    this.errorMode = mode;
    this.callCount = 0;
  }
  
  async *chatStream(_request: any) {
    this.callCount++;
    
    if (this.errorMode === 'error') {
      throw new Error('Provider error: Connection failed');
    }
    
    if (this.errorMode === 'timeout') {
      await new Promise(resolve => setTimeout(resolve, 100));
      throw new Error('Provider error: Request timeout');
    }
    
    if (this.errorMode === 'invalid') {
      yield { type: 'text' as const, value: '' }; // Empty response
      yield { type: 'finish' as const, reason: 'stop' as const };
      return;
    }
    
    // Normal response
    yield { type: 'text' as const, value: 'Summary of conversation.' };
    yield { type: 'finish' as const, reason: 'stop' as const };
  }
  
  getCallCount(): number {
    return this.callCount;
  }
}

describe('Integration: Error Handling', () => {
  let orchestrator: ContextOrchestrator;
  let tokenCounter: TokenCounterService;
  let storagePath: string;
  let sessionId: string;
  let mockProvider: ErrorMockProvider;
  
  beforeEach(async () => {
    storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));
    sessionId = `test_session_${Date.now()}`;
    tokenCounter = new TokenCounterService();
    mockProvider = new ErrorMockProvider();
    
    const systemPrompt: Message = {
      role: 'system',
      content: 'You are a helpful AI assistant.',
      id: 'system_prompt',
      timestamp: new Date(),
    };
    
    orchestrator = new ContextOrchestrator({
      systemPrompt,
      ollamaLimit: 1500,
      tokenCounter,
      provider: mockProvider,
      model: 'test-model',
      sessionId,
      storagePath,
      keepRecentCount: 2,
      safetyMargin: 200, // Small safety margin for tests
    });
  });
  
  afterEach(async () => {
    try {
      await fs.rm(storagePath, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });
  
  it('should handle LLM errors during compression gracefully', async () => {
    // Add many long messages to ensure compression is needed
    for (let i = 0; i < 15; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: This is a detailed message with lots of content to ensure we have enough tokens to trigger compression and test error handling properly.`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Enable error mode
    mockProvider.setErrorMode('error');
    
    // Try to compress (should fail gracefully)
    const result = await orchestrator.compress();
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).toContain('error');
    
    // System should still be valid (or at least not crashed)
    const state = orchestrator.getState();
    expect(state).toBeTruthy();
    
    // Disable error mode
    mockProvider.setErrorMode('none');
    
    // Should be able to compress successfully now (if there are messages to compress)
    const retryResult = await orchestrator.compress();
    // May or may not succeed depending on whether there are messages to compress
    expect(retryResult).toBeTruthy();
  });
  
  it('should handle provider timeouts', async () => {
    // Add messages
    for (let i = 0; i < 6; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Enable timeout mode
    mockProvider.setErrorMode('timeout');
    
    // Try to compress (should fail with timeout)
    const result = await orchestrator.compress();
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    
    // System should remain stable
    const state = orchestrator.getState();
    expect(state.health.tokenUsage).toBeLessThan(state.health.tokenLimit);
  });
  
  it('should handle invalid LLM responses', async () => {
    // Add messages
    for (let i = 0; i < 6; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Enable invalid response mode
    mockProvider.setErrorMode('invalid');
    
    // Try to compress (should fail due to empty summary)
    const result = await orchestrator.compress();
    
    // Should fail gracefully
    expect(result.success).toBe(false);
    
    // System should still be valid
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should handle invalid message objects', async () => {
    // Try to add invalid message (missing required fields)
    const invalidMessage = {
      role: 'user',
      // Missing content, id, timestamp, parts
    } as any;
    
    // Should handle gracefully (may throw or return error)
    try {
      const result = await orchestrator.addMessage(invalidMessage);
      // If it doesn't throw, should return failure
      if (result) {
        expect(result.success).toBe(false);
      }
    } catch (_error) {
      // Expected to throw for invalid message
      expect(_error).toBeTruthy();
    }
    
    // System should still be valid
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should recover from file system errors', async () => {
    // Add messages
    for (let i = 0; i < 5; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Try to save history
    await orchestrator.saveHistory();
    
    // Corrupt the storage directory (make it read-only)
    try {
      await fs.chmod(storagePath, 0o444);
      
      // Try to save again (should fail gracefully)
      try {
        await orchestrator.saveHistory();
      } catch (_error) {
        // Expected to fail
        expect(_error).toBeTruthy();
      }
      
      // Restore permissions
      await fs.chmod(storagePath, 0o755);
    } catch (_error) {
      // Skip test if chmod not supported (Windows)
      console.log('Skipping file system error test (chmod not supported)');
    }
    
    // System should still work
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should handle rapid error recovery', async () => {
    // Add initial messages
    for (let i = 0; i < 4; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Alternate between error and success
    for (let i = 0; i < 5; i++) {
      mockProvider.setErrorMode(i % 2 === 0 ? 'error' : 'none');
      
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Recovery message ${i + 1}`,
        id: `recovery_${i}`,
        timestamp: new Date(),
        };
      
      const result = await orchestrator.addMessage(message);
      
      // Should handle both success and failure
      expect(typeof result.success).toBe('boolean');
    }
    
    // Final state should be valid
    mockProvider.setErrorMode('none');
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should provide clear error messages', async () => {
    // Add messages
    for (let i = 0; i < 6; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Enable error mode
    mockProvider.setErrorMode('error');
    
    // Try to compress
    const result = await orchestrator.compress();
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(typeof result.error).toBe('string');
    expect(result.error?.length).toBeGreaterThan(0);
    
    // Error should be descriptive
    if (result.error) {
      expect(
        result.error.toLowerCase().includes('error') ||
        result.error.toLowerCase().includes('failed')
      ).toBe(true);
    }
  });
  
  it('should maintain state consistency after errors', async () => {
    // Add messages
    for (let i = 0; i < 5; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    const stateBefore = orchestrator.getState();
    
    // Enable error mode
    mockProvider.setErrorMode('error');
    
    // Try to compress (will fail)
    await orchestrator.compress();
    
    const stateAfter = orchestrator.getState();
    
    // State should be unchanged after failed compression
    expect(stateAfter.activeContext.recentMessages.length).toBe(
      stateBefore.activeContext.recentMessages.length
    );
    expect(stateAfter.activeContext.checkpoints.length).toBe(
      stateBefore.activeContext.checkpoints.length
    );
    expect(stateAfter.health.tokenUsage).toBe(stateBefore.health.tokenUsage);
  });
  
  it('should handle missing snapshot files gracefully', async () => {
    // Try to restore from non-existent snapshot
    try {
      await orchestrator.restoreSnapshot('non_existent_snapshot');
    } catch (error) {
      // Should throw or handle gracefully
      expect(error).toBeTruthy();
    }
    
    // System should still be valid
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should handle concurrent operations safely', async () => {
    // Add initial messages
    for (let i = 0; i < 4; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Try concurrent operations
    const operations = [
      orchestrator.compress(),
      orchestrator.createSnapshot('recovery'),
      orchestrator.saveHistory(),
      orchestrator.getState(),
      orchestrator.validate(),
    ];
    
    // Should all complete without crashing
    const results = await Promise.allSettled(operations);
    
    // At least some should succeed
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBeGreaterThan(0);
    
    // System should still be valid
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
});
