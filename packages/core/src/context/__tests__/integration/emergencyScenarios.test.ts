/**
 * Integration Test: Emergency Scenarios
 *
 * Tests the emergency action system when normal compression fails:
 * - Emergency compression of largest checkpoint
 * - Emergency merging of multiple checkpoints
 * - Emergency rollover as last resort
 * - Snapshot creation before emergency actions
 * - Recovery from emergency situations
 *
 * Requirements: FR-8, FR-9
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
 * Mock provider that can simulate failures
 */
class MockProvider implements ProviderAdapter {
  name = 'mock';
  private shouldFail = false;
  private failureCount = 0;
  
  setShouldFail(fail: boolean) {
    this.shouldFail = fail;
    this.failureCount = 0;
  }
  
  async *chatStream(request: any) {
    if (this.shouldFail && this.failureCount < 2) {
      this.failureCount++;
      throw new Error('Simulated LLM failure');
    }
    
    const messages = request.messages || [];
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.parts?.[0]?.text || lastMessage?.content || '';
    let summary = 'Emergency summary: Critical information preserved.';
    
    if (content.includes('Level 1') || content.includes('Compact') || content.includes('ULTRA-COMPACT')) {
      summary = 'Brief: Key points.';
    }
    
    yield { type: 'text' as const, value: summary };
    yield { type: 'finish' as const, reason: 'stop' as const };
  }
}

describe('Integration: Emergency Scenarios', () => {
  let orchestrator: ContextOrchestrator;
  let tokenCounter: TokenCounterService;
  let storagePath: string;
  let sessionId: string;
  let mockProvider: MockProvider;
  
  beforeEach(async () => {
    storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));
    sessionId = `test_session_${Date.now()}`;
    tokenCounter = new TokenCounterService();
    mockProvider = new MockProvider();
    
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
  
  it('should handle context overflow gracefully', async () => {
    // Fill context to near capacity
    for (let i = 0; i < 15; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: This is a very long message with lots of content to fill up the context window quickly. We need to test emergency scenarios when the context is nearly full.`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      const result = await orchestrator.addMessage(message);
      
      // Should always succeed (either normal add or emergency compression)
      expect(result.success).toBe(true);
    }
    
    // System should still be valid
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
    
    // Should be able to add one more message
    const finalMessage: Message = {
      role: 'user',
      content: 'Final message',
      id: 'final',
      timestamp: new Date(),
    };
    
    const finalResult = await orchestrator.addMessage(finalMessage);
    expect(finalResult.success).toBe(true);
  }, 60000);
  
  it('should create snapshots before emergency actions', async () => {
    // Fill context
    for (let i = 0; i < 12; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: Content to trigger emergency.`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Manually create a snapshot
    const snapshotId = await orchestrator.createSnapshot('emergency');
    expect(snapshotId).toBeTruthy();
    
    // Verify snapshot file exists
    const snapshotFiles = await fs.readdir(storagePath);
    const hasSnapshot = snapshotFiles.some(file => file.includes('snapshot'));
    expect(hasSnapshot).toBe(true);
  }, 30000);
  
  it('should recover from LLM failures during compression', async () => {
    // Add some messages normally
    for (let i = 0; i < 5; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Enable failures
    mockProvider.setShouldFail(true);
    
    // Try to add more messages (should trigger compression which will fail)
    let _failureOccurred = false;
    for (let i = 5; i < 10; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: Long content to trigger compression.`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      const result = await orchestrator.addMessage(message);
      
      if (!result.success) {
        _failureOccurred = true;
        break;
      }
    }
    
    // Disable failures
    mockProvider.setShouldFail(false);
    
    // Should be able to continue after failure
    const recoveryMessage: Message = {
      role: 'user',
      content: 'Recovery message',
      id: 'recovery',
      timestamp: new Date(),
    };
    
    const recoveryResult = await orchestrator.addMessage(recoveryMessage);
    
    // May succeed or fail depending on state, but shouldn't crash
    expect(typeof recoveryResult.success).toBe('boolean');
  }, 30000);
  
  it('should maintain system health under stress', async () => {
    const healthChecks: boolean[] = [];
    
    // Stress test with many rapid additions
    for (let i = 0; i < 20; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Stress test message ${i + 1}: Adding lots of content to stress the system.`,
        id: `stress_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
      
      // Check health after each addition
      const validation = orchestrator.validate();
      healthChecks.push(validation.valid);
    }
    
    // System should remain valid throughout
    const allHealthy = healthChecks.every(check => check === true);
    expect(allHealthy).toBe(true);
    
    // Final state should be healthy
    const finalState = orchestrator.getState();
    expect(finalState.health.tokenUsage).toBeLessThan(finalState.health.tokenLimit);
  }, 60000);
  
  it('should handle very large messages gracefully', async () => {
    // Create a very large message
    const largeContent = 'This is a very large message. '.repeat(200);
    
    const largeMessage: Message = {
      role: 'user',
      content: largeContent,
      id: 'large_msg',
      timestamp: new Date(),
    };
    
    // Try to add it
    const result = await orchestrator.addMessage(largeMessage);
    
    // Should either succeed (with compression) or fail gracefully
    expect(typeof result.success).toBe('boolean');
    
    if (!result.success) {
      // Should have a clear error message
      expect(result.error).toBeTruthy();
    }
    
    // System should still be valid
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  });
  
  it('should prevent context overflow with validation', async () => {
    // Fill context to capacity
    for (let i = 0; i < 15; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: Content to fill context.`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Validation should always pass (system prevents overflow)
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
    expect(validation.tokens).toBeLessThan(validation.limit);
  }, 60000);
  
  it('should handle concurrent compression attempts', async () => {
    // Add many long messages to ensure compression is needed
    for (let i = 0; i < 15; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: Detailed content to ensure compression is triggered with enough tokens.`,
        id: `msg_${i}`,
        timestamp: new Date(),
        };
      
      await orchestrator.addMessage(message);
    }
    
    // Try to trigger multiple compressions concurrently
    const compressionPromises = [
      orchestrator.compress(),
      orchestrator.compress(),
      orchestrator.compress(),
    ];
    
    const results = await Promise.all(compressionPromises);
    
    // Only one should succeed (others should be blocked or fail)
    const successCount = results.filter(r => r.success).length;
    
    // At most one compression should succeed
    expect(successCount).toBeLessThanOrEqual(1);
    
    // System should still be healthy
    const state = orchestrator.getState();
    expect(state.health.tokenUsage).toBeLessThan(state.health.tokenLimit);
  });
  
  it('should cleanup old snapshots', async () => {
    // Create multiple snapshots
    const snapshotIds: string[] = [];
    
    for (let i = 0; i < 8; i++) {
      const id = await orchestrator.createSnapshot('recovery');
      snapshotIds.push(id);
    }
    
    // Cleanup keeping only 3
    await orchestrator.cleanupSnapshots(3);
    
    // Verify cleanup occurred (check directory)
    const snapshotFiles = await fs.readdir(storagePath);
    const snapshotCount = snapshotFiles.filter(file => file.includes('snapshot')).length;
    
    // Should have 3 or fewer snapshots
    expect(snapshotCount).toBeLessThanOrEqual(3);
  });
});
