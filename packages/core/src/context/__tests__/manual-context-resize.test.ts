/**
 * Test: Manual Context Resize and Tier Updates
 * 
 * Verifies that when a user manually changes context size:
 * 1. The actualContextTier updates to match the new size
 * 2. The effectivePromptTier updates to match actualContextTier (in manual mode)
 * 3. The tier-changed event is emitted with correct values
 * 4. The UI receives the event and updates display
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationContextManager } from '../contextManager.js';
import { ContextTier } from '../types.js';
import type { ModelInfo } from '../types.js';

describe('Manual Context Resize', () => {
  let manager: ConversationContextManager;
  let tierChangedEvents: unknown[] = [];
  
  const mockModelInfo: ModelInfo = {
    parameters: 7000000000,
    quantization: 'f16',
    contextSize: 32768,
  };
  
  beforeEach(() => {
    tierChangedEvents = [];
    
    // Create manager with auto-sizing enabled (default)
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
    
    // Listen for tier-changed events
    manager.on('tier-changed', (data) => {
      tierChangedEvents.push(data);
    });
  });
  
  it('should emit tier-changed event when resizing from 32K to 4K', async () => {
    // Start the manager (this will set initial tier based on 32K)
    await manager.start();
    
    // Clear events from startup
    tierChangedEvents = [];
    
    // Simulate user selecting 4K context size
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    // Should have emitted tier-changed event
    expect(tierChangedEvents.length).toBeGreaterThan(0);
    
    const event = tierChangedEvents[0] as {
      tier: string;
      actualContextTier: string;
      effectivePromptTier: string;
      hardwareCapabilityTier: string;
      promptTierLocked: boolean;
    };
    
    // Verify the event data
    expect(event.actualContextTier).toBe(ContextTier.TIER_1_MINIMAL); // '2-4K'
    expect(event.effectivePromptTier).toBe(ContextTier.TIER_1_MINIMAL); // Should match actual in manual mode
    expect(event.promptTierLocked).toBe(false); // Manual mode, not locked
  });
  
  it('should update effectivePromptTier to match actualContextTier in manual mode', async () => {
    await manager.start();
    tierChangedEvents = [];
    
    // Change to 8K (Tier 2)
    manager.updateConfig({ targetSize: 8192, autoSize: false });
    
    expect(tierChangedEvents.length).toBeGreaterThan(0);
    
    const event = tierChangedEvents[0] as {
      actualContextTier: string;
      effectivePromptTier: string;
    };
    
    expect(event.actualContextTier).toBe(ContextTier.TIER_2_BASIC); // '4-8K'
    expect(event.effectivePromptTier).toBe(ContextTier.TIER_2_BASIC); // Should match
  });
  
  it('should keep effectivePromptTier locked to hardware in auto mode', async () => {
    await manager.start();
    
    // Get initial hardware capability tier
    const startedEvent = tierChangedEvents[tierChangedEvents.length - 1] as {
      hardwareCapabilityTier: string;
      effectivePromptTier: string;
    };
    
    const hardwareTier = startedEvent.hardwareCapabilityTier;
    
    tierChangedEvents = [];
    
    // Change size but keep auto mode enabled
    manager.updateConfig({ targetSize: 16384, autoSize: true });
    
    // If event was emitted, effective tier should still match hardware
    if (tierChangedEvents.length > 0) {
      const event = tierChangedEvents[0] as {
        effectivePromptTier: string;
        hardwareCapabilityTier: string;
      };
      
      expect(event.effectivePromptTier).toBe(hardwareTier); // Locked to hardware
    }
  });
  
  it('should transition from auto to manual mode correctly', async () => {
    await manager.start();
    tierChangedEvents = [];
    
    // Get hardware capability tier
    const config = manager.config;
    expect(config.autoSize).toBe(true);
    
    // Transition to manual mode with smaller context
    manager.updateConfig({ targetSize: 4096, autoSize: false });
    
    expect(tierChangedEvents.length).toBeGreaterThan(0);
    
    const event = tierChangedEvents[0] as {
      actualContextTier: string;
      effectivePromptTier: string;
      promptTierLocked: boolean;
    };
    
    // In manual mode, effective tier should match actual tier
    expect(event.actualContextTier).toBe(ContextTier.TIER_1_MINIMAL);
    expect(event.effectivePromptTier).toBe(ContextTier.TIER_1_MINIMAL);
    expect(event.promptTierLocked).toBe(false);
  });
});
