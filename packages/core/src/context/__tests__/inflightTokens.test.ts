/**
 * Inflight Token Accounting Tests
 * 
 * Tests for reportInflightTokens() and clearInflightTokens() methods,
 * including threshold checks with inflight tokens included.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createContextManager, ConversationContextManager } from '../contextManager.js';
import type { ModelInfo, Message } from '../types.js';

describe('Inflight Token Accounting', () => {
  let modelInfo: ModelInfo;

  beforeEach(() => {
    modelInfo = {
      parameters: 8,
      contextLimit: 32768
    };
  });

  it('should report inflight tokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    // Report 100 inflight tokens
    manager.reportInflightTokens(100);

    // Verify inflight tokens are tracked
    const internalManager = manager as ConversationContextManager;
    expect((internalManager as any).inflightTokens).toBe(100);
  });

  it('should accumulate inflight tokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    // Report multiple deltas
    manager.reportInflightTokens(50);
    manager.reportInflightTokens(30);
    manager.reportInflightTokens(20);

    // Should accumulate to 100
    const internalManager = manager as ConversationContextManager;
    expect((internalManager as any).inflightTokens).toBe(100);
  });

  it('should clear inflight tokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    // Report and then clear
    manager.reportInflightTokens(100);
    manager.clearInflightTokens();

    // Should be 0
    const internalManager = manager as ConversationContextManager;
    expect((internalManager as any).inflightTokens).toBe(0);
  });

  it('should not allow negative inflight tokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    // Report positive, then negative delta
    manager.reportInflightTokens(50);
    manager.reportInflightTokens(-100); // Would be -50

    // Should clamp to 0
    const internalManager = manager as ConversationContextManager;
    expect((internalManager as any).inflightTokens).toBeGreaterThanOrEqual(0);
  });

  it('should include inflight tokens in threshold checks', async () => {
    const manager = createContextManager('test-session', modelInfo, {
      snapshots: {
        enabled: true,
        autoCreate: true,
        autoThreshold: 0.8,
        maxCount: 5
      },
      targetSize: 2000
    });

    await manager.start();

    // Add messages to reach 70% (1400 tokens out of 2000)
    for (let i = 0; i < 7; i++) {
      const message: Message = {
        id: `msg-${i}`,
        role: 'user',
        content: 'A'.repeat(800), // ~200 tokens each
        timestamp: new Date()
      };
      await manager.addMessage(message);
    }

    const usageBeforeInflight = manager.getUsage();
    
    // Report 300 inflight tokens (70% + 15% = 85% > 80%)
    manager.reportInflightTokens(300);

    const usageAfterInflight = manager.getUsage();
    
    // Verify inflight tokens are included in usage
    expect(usageAfterInflight.currentTokens).toBe(usageBeforeInflight.currentTokens + 300);
    
    // Verify percentage increased
    expect(usageAfterInflight.percentage).toBeGreaterThan(usageBeforeInflight.percentage);

    await manager.stop();
  });

  it('should update context pool with inflight tokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    const initialUsage = manager.getUsage();
    const initialTokens = initialUsage.currentTokens;

    // Report inflight tokens
    manager.reportInflightTokens(100);

    const newUsage = manager.getUsage();
    
    // Context pool should include inflight tokens
    expect(newUsage.currentTokens).toBe(initialTokens + 100);
  });

  it('should restore context pool on clear', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    const initialUsage = manager.getUsage();
    const initialTokens = initialUsage.currentTokens;

    // Report and clear
    manager.reportInflightTokens(100);
    manager.clearInflightTokens();

    const finalUsage = manager.getUsage();
    
    // Should be back to original
    expect(finalUsage.currentTokens).toBe(initialTokens);
  });

  it('should handle errors gracefully in reportInflightTokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    // Should not throw even with invalid input
    expect(() => {
      manager.reportInflightTokens(NaN);
    }).not.toThrow();

    expect(() => {
      manager.reportInflightTokens(Infinity);
    }).not.toThrow();
  });

  it('should handle errors gracefully in clearInflightTokens', () => {
    const manager = createContextManager('test-session', modelInfo, {
      targetSize: 1000
    });

    // Should not throw
    expect(() => {
      manager.clearInflightTokens();
    }).not.toThrow();

    // Should work even when called multiple times
    expect(() => {
      manager.clearInflightTokens();
      manager.clearInflightTokens();
    }).not.toThrow();
  });
});
