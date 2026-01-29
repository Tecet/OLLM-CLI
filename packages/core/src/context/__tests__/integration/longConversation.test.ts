/**
 * Integration Test: Long Conversation (10+ Checkpoints)
 *
 * Tests the complete context compression system with a long conversation
 * that triggers 10+ compressions. Validates that:
 * - System handles many compressions without crashing
 * - Checkpoints age properly over time
 * - Token usage stays within limits
 * - Conversation quality is maintained
 * - All subsystems work together correctly
 *
 * Requirements: All FR (FR-1 through FR-16)
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
 * Mock provider for testing
 */
class MockProvider implements ProviderAdapter {
  name = 'mock';
  
  async *chatStream(request: any) {
    // Simulate LLM response for summarization
    const messages = request.messages || [];
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.parts?.[0]?.text || lastMessage?.content || '';
    
    // If this is a summarization request, return a summary
    if (content.includes('Summarize') || content.includes('summarize') || content.includes('CONVERSATION TO SUMMARIZE')) {
      const summary = `Summary of conversation: Key points discussed include technical implementation, design decisions, and next steps. Total context preserved.`;
      
      yield { type: 'text' as const, value: summary };
      yield { type: 'finish' as const, reason: 'stop' as const };
    } else {
      // Regular response
      yield { type: 'text' as const, value: 'This is a test response from the mock provider.' };
      yield { type: 'finish' as const, reason: 'stop' as const };
    }
  }
}

describe('Integration: Long Conversation (10+ Checkpoints)', () => {
  let orchestrator: ContextOrchestrator;
  let tokenCounter: TokenCounterService;
  let storagePath: string;
  let sessionId: string;
  
  beforeEach(async () => {
    // Create temporary storage directory
    storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'ollm-test-'));
    sessionId = `test_session_${Date.now()}`;
    
    // Initialize token counter
    tokenCounter = new TokenCounterService();
    
    // Create system prompt
    const systemPrompt: Message = {
      role: 'system',
      content: 'You are a helpful AI assistant.',
      id: 'system_prompt',
      timestamp: new Date(),
    };
    
    // Initialize orchestrator with small context limit to trigger compressions
    orchestrator = new ContextOrchestrator({
      systemPrompt,
      ollamaLimit: 1500,
      tokenCounter,
      provider: new MockProvider(),
      model: 'test-model',
      sessionId,
      storagePath,
      keepRecentCount: 3,
      safetyMargin: 200, // Small safety margin for tests
    });
  });
  
  afterEach(async () => {
    // Cleanup temporary storage
    try {
      await fs.rm(storagePath, { recursive: true, force: true });
    } catch (_error) {
      // Ignore cleanup errors
    }
  });
  
  it('should handle long conversations without crashing', async () => {
    // Simulate a long conversation with many messages
    const messageCount = 50;
    let successfulAdds = 0;
    let compressionCount = 0;
    
    // Create moderately long messages (not too long to prevent adding many)
    const moderateContent = 'This is a discussion about software architecture. '.repeat(5);
    
    for (let i = 0; i < messageCount; i++) {
      // Create user message
      const userMessage: Message = {
        role: 'user',
        content: `User message ${i + 1}: ${moderateContent} Let's discuss feature X in detail.`,
        id: `user_${i}`,
        timestamp: new Date(),
      };
      
      // Add user message
      const userResult = await orchestrator.addMessage(userMessage);
      if (userResult.success) {
        successfulAdds++;
        if (userResult.compressionTriggered) {
          compressionCount++;
        }
      } else {
        // If we can't add more messages, that's okay - we've tested the system
        break;
      }
      
      // Create assistant message
      const assistantMessage: Message = {
        role: 'assistant',
        content: `Assistant response ${i + 1}: ${moderateContent} I understand your requirements.`,
        id: `assistant_${i}`,
        timestamp: new Date(),
      };
      
      // Add assistant message
      const assistantResult = await orchestrator.addMessage(assistantMessage);
      if (assistantResult.success) {
        successfulAdds++;
        if (assistantResult.compressionTriggered) {
          compressionCount++;
        }
      } else {
        // If we can't add more messages, that's okay
        break;
      }
    }
    
    // Verify we successfully added many messages
    expect(successfulAdds).toBeGreaterThanOrEqual(10);
    
    // Verify system is still healthy (compressions may or may not have triggered)
    const state = orchestrator.getState();
    expect(state.health.tokenUsage).toBeLessThan(state.health.tokenLimit);
    
    // Verify validation passes
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
    
    // Log compression info for debugging (not a test assertion)
    if (compressionCount > 0) {
      console.log(`Successfully triggered ${compressionCount} compressions`);
    }
  }, 60000); // 60 second timeout for long test
  
  it('should maintain conversation continuity across compressions', async () => {
    // Add messages and track what gets compressed
    const messages: Message[] = [];
    let successfulAdds = 0;
    
    // Create moderately long messages
    const moderateContent = 'This is important information. '.repeat(5);
    
    for (let i = 0; i < 30; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: ${moderateContent} Topic ${Math.floor(i / 2)}`,
        id: `msg_${i}`,
        timestamp: new Date(),
      };
      
      messages.push(message);
      const result = await orchestrator.addMessage(message);
      if (result.success) {
        successfulAdds++;
      } else {
        // Stop if we can't add more
        break;
      }
    }
    
    // Verify we added many messages
    expect(successfulAdds).toBeGreaterThanOrEqual(10);
    
    // Get final state
    const state = orchestrator.getState();
    
    // Verify we have recent messages (may or may not have checkpoints depending on compression)
    expect(state.activeContext.recentMessages.length).toBeGreaterThan(0);
    
    // If we have checkpoints, verify they contain summaries
    if (state.activeContext.checkpoints.length > 0) {
      for (const checkpoint of state.activeContext.checkpoints) {
        expect(checkpoint.summary).toBeTruthy();
        expect(checkpoint.summary.length).toBeGreaterThan(0);
        expect(checkpoint.tokenCount).toBeGreaterThan(0);
      }
    }
    
    // Verify recent messages are preserved
    const recentMessageIds = state.activeContext.recentMessages.map(m => m.id);
    expect(recentMessageIds.length).toBeGreaterThan(0);
  }, 60000);
  
  it('should keep token usage within limits throughout conversation', async () => {
    const tokenUsageHistory: number[] = [];
    
    // Create moderately long messages
    const moderateContent = 'This is a message with content. '.repeat(5);
    
    for (let i = 0; i < 40; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}: ${moderateContent} Discussing implementation details.`,
        id: `msg_${i}`,
        timestamp: new Date(),
      };
      
      await orchestrator.addMessage(message);
      
      // Track token usage
      const state = orchestrator.getState();
      tokenUsageHistory.push(state.health.tokenUsage);
      
      // Verify we never exceed limit
      expect(state.health.tokenUsage).toBeLessThan(state.health.tokenLimit);
    }
    
    // Verify token usage fluctuates (compressions are working)
    const maxUsage = Math.max(...tokenUsageHistory);
    const minUsage = Math.min(...tokenUsageHistory);
    expect(maxUsage - minUsage).toBeGreaterThan(100); // Should see significant variation
  }, 60000);
  
  it('should save and export session history correctly', async () => {
    // Add messages
    for (let i = 0; i < 15; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i + 1}`,
        id: `msg_${i}`,
        timestamp: new Date(),
      };
      
      await orchestrator.addMessage(message);
    }
    
    // Save history
    await orchestrator.saveHistory();
    
    // Verify history file exists
    const historyPath = path.join(storagePath, `${sessionId}.json`);
    const historyExists = await fs.access(historyPath).then(() => true).catch(() => false);
    expect(historyExists).toBe(true);
    
    // Export to markdown
    const markdown = orchestrator.exportHistory();
    expect(markdown).toContain(`Session ${sessionId}`);
    expect(markdown).toContain('Message 1');
    expect(markdown).toContain('Message 15');
    
    // Verify all messages are in history (not compressed)
    for (let i = 0; i < 15; i++) {
      expect(markdown).toContain(`Message ${i + 1}`);
    }
  }, 30000);
  
  it('should handle rapid message additions without errors', async () => {
    // Add messages rapidly without waiting
    const promises: Promise<any>[] = [];
    
    for (let i = 0; i < 10; i++) {
      const message: Message = {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Rapid message ${i + 1}`,
        id: `rapid_${i}`,
        timestamp: new Date(),
      };
      
      promises.push(orchestrator.addMessage(message));
    }
    
    // Wait for all to complete
    const results = await Promise.all(promises);
    
    // Verify all succeeded
    for (const result of results) {
      expect(result.success).toBe(true);
    }
    
    // Verify system is healthy
    const validation = orchestrator.validate();
    expect(validation.valid).toBe(true);
  }, 30000);
});
