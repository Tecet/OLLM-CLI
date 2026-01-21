/**
 * Test: Prompt Switching Verification
 * 
 * Verifies that the system actually switches prompts when:
 * 1. Context size changes (manual mode)
 * 2. Mode changes
 * 3. Transitioning from auto to manual mode
 * 
 * This test ensures the UI commands actually impact prompt selection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import { ContextTier, OperationalMode, SYSTEM_PROMPT_TEMPLATES } from '../types.js';
import type { ModelInfo } from '../types.js';

describe('Prompt Switching Verification', () => {
  let manager: ConversationContextManager;
  let systemPromptUpdates: Array<{
    tier: string;
    mode: string;
    content: string;
  }> = [];
  
  const mockModelInfo: ModelInfo = {
    parameters: 7000000000,
    quantization: 'f16',
    contextSize: 32768,
  };
  
  beforeEach(() => {
    systemPromptUpdates = [];
    
    manager = new ConversationContextManager(
      'test-session',
      mockModelInfo,
      {
        targetSize: 32768,
        autoSize: true,
        minSize: 2048,
        maxSize: 131072,
      }
    );
    
    // Listen for system-prompt-updated events
    manager.on('system-prompt-updated', (data) => {
      const eventData = data as {
        tier: string;
        mode: string;
        content: string;
      };
      systemPromptUpdates.push({
        tier: eventData.tier,
        mode: eventData.mode,
        content: eventData.content,
      });
    });
  });
  
  it('should switch prompt when changing from 32K to 4K context', async () => {
    await manager.start();
    systemPromptUpdates = [];
    
    // Get initial prompt (should be Tier 3 or higher)
    const initialPrompt = manager.getSystemPrompt();
    
    // Change to 4K (Tier 1)
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    // Should have emitted system-prompt-updated event
    expect(systemPromptUpdates.length).toBeGreaterThan(0);
    
    const update = systemPromptUpdates[0];
    expect(update.tier).toBe(ContextTier.TIER_1_MINIMAL); // '2-4K'
    
    // Get new prompt
    const newPrompt = manager.getSystemPrompt();
    
    // Prompts should be different
    expect(newPrompt).not.toBe(initialPrompt);
    
    // New prompt should match the Tier 1 template
    const expectedTemplate = SYSTEM_PROMPT_TEMPLATES['tier1-developer'];
    expect(newPrompt).toBe(expectedTemplate.template);
  });
  
  it('should switch prompt when changing from 4K to 32K context', async () => {
    // Start with 4K
    manager = new ConversationContextManager(
      'test-session',
      mockModelInfo,
      {
        targetSize: 4096,
        autoSize: false,
        minSize: 2048,
        maxSize: 131072,
      }
    );
    
    manager.on('system-prompt-updated', (data) => {
      const eventData = data as {
        tier: string;
        mode: string;
        content: string;
      };
      systemPromptUpdates.push({
        tier: eventData.tier,
        mode: eventData.mode,
        content: eventData.content,
      });
    });
    
    await manager.start();
    systemPromptUpdates = [];
    
    const initialPrompt = manager.getSystemPrompt();
    
    // Change to 32K (Tier 3)
    manager.updateConfig({ targetSize: 32768, autoSize: false });
    
    expect(systemPromptUpdates.length).toBeGreaterThan(0);
    
    const update = systemPromptUpdates[0];
    expect(update.tier).toBe(ContextTier.TIER_3_STANDARD); // '8-32K'
    
    const newPrompt = manager.getSystemPrompt();
    expect(newPrompt).not.toBe(initialPrompt);
    
    // New prompt should match the Tier 3 template
    const expectedTemplate = SYSTEM_PROMPT_TEMPLATES['tier3-developer'];
    expect(newPrompt).toBe(expectedTemplate.template);
  });
  
  it('should switch prompt when changing mode', async () => {
    await manager.start();
    systemPromptUpdates = [];
    
    const initialPrompt = manager.getSystemPrompt();
    const initialMode = manager.getMode();
    expect(initialMode).toBe(OperationalMode.DEVELOPER);
    
    // Change to assistant mode
    manager.setMode(OperationalMode.ASSISTANT);
    
    expect(systemPromptUpdates.length).toBeGreaterThan(0);
    
    const update = systemPromptUpdates[0];
    expect(update.mode).toBe(OperationalMode.ASSISTANT);
    
    const newPrompt = manager.getSystemPrompt();
    expect(newPrompt).not.toBe(initialPrompt);
  });
  
  it('should use correct prompt tier in auto mode (locked to hardware)', async () => {
    await manager.start();
    
    // In auto mode, effective tier should be locked to hardware capability
    // Even if we change context size, the prompt tier should stay the same
    const initialPrompt = manager.getSystemPrompt();
    
    systemPromptUpdates = [];
    
    // Change context size but keep auto mode
    manager.updateConfig({ targetSize: 16384, autoSize: true });
    
    // Prompt should NOT change in auto mode (locked to hardware capability)
    // The event might not even be emitted if tier doesn't change
    const newPrompt = manager.getSystemPrompt();
    
    // In auto mode, prompt stays locked to hardware capability
    // So it should be the same
    expect(newPrompt).toBe(initialPrompt);
  });
  
  it('should switch prompt when transitioning from auto to manual with different size', async () => {
    await manager.start();
    systemPromptUpdates = [];
    
    const initialPrompt = manager.getSystemPrompt();
    
    // Transition to manual mode with smaller context
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    expect(systemPromptUpdates.length).toBeGreaterThan(0);
    
    const update = systemPromptUpdates[0];
    expect(update.tier).toBe(ContextTier.TIER_1_MINIMAL);
    
    const newPrompt = manager.getSystemPrompt();
    expect(newPrompt).not.toBe(initialPrompt);
    
    // Should be using Tier 1 prompt now
    const expectedTemplate = SYSTEM_PROMPT_TEMPLATES['tier1-developer'];
    expect(newPrompt).toBe(expectedTemplate.template);
  });
  
  it('should emit system-prompt-updated event with correct tier information', async () => {
    await manager.start();
    systemPromptUpdates = [];
    
    // Change to 8K (Tier 2)
    manager.updateConfig({ targetSize: 8192, autoSize: false });
    
    expect(systemPromptUpdates.length).toBeGreaterThan(0);
    
    const update = systemPromptUpdates[0];
    
    // Verify event contains correct information
    expect(update.tier).toBe(ContextTier.TIER_2_BASIC); // '4-8K'
    expect(update.mode).toBe(OperationalMode.DEVELOPER);
    expect(update.content).toBeTruthy();
    expect(update.content.length).toBeGreaterThan(0);
    
    // Content should match the template
    const expectedTemplate = SYSTEM_PROMPT_TEMPLATES['tier2-developer'];
    expect(update.content).toBe(expectedTemplate.template);
  });
  
  it('should actually update the context messages with new prompt', async () => {
    await manager.start();
    
    // Get initial messages
    const initialMessages = await manager.getMessages();
    const initialSystemMessage = initialMessages.find(m => m.role === 'system');
    expect(initialSystemMessage).toBeTruthy();
    const initialContent = initialSystemMessage!.content;
    
    // Change context size
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    // Get updated messages
    const updatedMessages = await manager.getMessages();
    const updatedSystemMessage = updatedMessages.find(m => m.role === 'system');
    expect(updatedSystemMessage).toBeTruthy();
    const updatedContent = updatedSystemMessage!.content;
    
    // System message content should have changed
    expect(updatedContent).not.toBe(initialContent);
    
    // Should match Tier 1 template
    const expectedTemplate = SYSTEM_PROMPT_TEMPLATES['tier1-developer'];
    expect(updatedContent).toBe(expectedTemplate.template);
  });
});
