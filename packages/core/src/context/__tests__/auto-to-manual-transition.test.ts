/**
 * Auto-to-Manual Transition Tests
 * 
 * Tests for switching from auto-sizing mode to manual context size selection
 */

import { describe, it, expect, afterEach } from 'vitest';
import { createContextManager } from '../contextManager.js';
import type { ContextManagerInterface, ContextModelInfo, ContextConfig } from '../types.js';

describe('Auto-to-Manual Transition', () => {
  let manager: ContextManagerInterface;
  
  const createModelInfo = (maxTokens: number): ContextModelInfo => ({
    id: 'test-model',
    maxContextTokens: maxTokens,
    modelSizeGB: 7,
    quantization: 'f16',
    parameters: 7000000000 // 7B parameters
  });
  
  const createConfig = (targetSize: number, autoSize: boolean = false): Partial<ContextConfig> => ({
    targetSize,
    autoSize,
    compression: {
      enabled: false,
      threshold: 0.8,
      strategy: {
        type: 'fifo',
        preserveRecent: 10
      }
    }
  });
  
  afterEach(async () => {
    if (manager) {
      await manager.stop();
    }
  });
  
  it('should emit tier-changed when switching from auto to manual with 4K', async () => {
    // Start with auto-sizing (hardware determines tier)
    const modelInfo = createModelInfo(32768);
    const config = createConfig(32768, true); // auto-sizing enabled
    
    manager = createContextManager('test-session', modelInfo, config);
    
    let tierChangedCount = 0;
    let lastTierEvent: any = null;
    
    manager.on('tier-changed', (data) => {
      tierChangedCount++;
      lastTierEvent = data;
      console.log('[TEST] tier-changed event:', data);
    });
    
    await manager.start();
    
    // Should start in auto mode with hardware-determined tier
    const initialUsage = manager.getUsage();
    console.log('[TEST] Initial usage:', initialUsage);
    
    // Switch to manual 4K (Tier 1)
    console.log('[TEST] Switching to manual 4K...');
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    // Should have emitted tier-changed event
    expect(tierChangedCount).toBeGreaterThan(0);
    expect(lastTierEvent).toBeDefined();
    expect(lastTierEvent.actualContextTier).toBe('2-4K'); // Tier 1
    expect(lastTierEvent.promptTierLocked).toBe(false); // Manual mode
    
    console.log('[TEST] Final tier event:', lastTierEvent);
  });
  
  it('should update system prompt when switching to manual mode', async () => {
    const modelInfo = createModelInfo(32768);
    const config = createConfig(32768, true); // auto-sizing enabled
    
    manager = createContextManager('test-session', modelInfo, config);
    
    let promptUpdatedCount = 0;
    let lastPromptEvent: any = null;
    
    manager.on('system-prompt-updated', (data) => {
      promptUpdatedCount++;
      lastPromptEvent = data;
      console.log('[TEST] system-prompt-updated event:', data);
    });
    
    await manager.start();
    
    // Switch to manual 4K
    console.log('[TEST] Switching to manual 4K...');
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    // Should have updated system prompt
    expect(promptUpdatedCount).toBeGreaterThan(0);
    expect(lastPromptEvent).toBeDefined();
    expect(lastPromptEvent.tier).toBe('2-4K'); // Should use Tier 1 prompt
    
    console.log('[TEST] Final prompt event:', lastPromptEvent);
  });
  
  it('should use correct effective tier in manual mode', async () => {
    const modelInfo = createModelInfo(32768);
    const config = createConfig(32768, true); // auto-sizing enabled
    
    manager = createContextManager('test-session', modelInfo, config);
    
    await manager.start();
    
    // Switch to manual 4K
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    // In manual mode, effective tier should follow context size (Tier 1)
    // not hardware capability (which might be Tier 3)
    const usage = manager.getUsage();
    expect(usage.maxTokens).toBe(4096);
  });
});
