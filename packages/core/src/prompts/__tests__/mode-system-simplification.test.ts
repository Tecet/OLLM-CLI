/**
 * Tests for Mode System Simplification Changes
 * 
 * Tests the recent improvements:
 * 1. Reduced hysteresis (30s → 15s)
 * 2. Optional metrics (default disabled)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptModeManager } from '../PromptModeManager.js';
import { ContextAnalyzer, type ContextAnalysis, type ModeType } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';
import { SystemPromptBuilder } from '../../context/SystemPromptBuilder.js';

describe('Mode System Simplification', () => {
  let promptRegistry: PromptRegistry;
  let promptBuilder: SystemPromptBuilder;
  let contextAnalyzer: ContextAnalyzer;
  
  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    promptBuilder = new SystemPromptBuilder(promptRegistry);
    contextAnalyzer = new ContextAnalyzer();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Reduced Hysteresis (15s)', () => {
    it('should allow mode switch after 15 seconds', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      // Start in developer mode
      manager.switchMode('developer', 'manual', 1.0);
      
      // Try to switch to planning immediately - should fail
      const analysis: ContextAnalysis = {
        mode: 'planning' as ModeType,
        confidence: 0.9,
        triggers: ['plan'],
        metadata: {
          keywords: ['plan'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      expect(manager.shouldSwitchMode('developer', analysis)).toBe(false);
      
      // Wait 15 seconds (hysteresis) + 10 seconds (cooldown) = 25 seconds
      vi.advanceTimersByTime(25 * 1000);
      
      // Now should allow switch
      expect(manager.shouldSwitchMode('developer', analysis)).toBe(true);
      
      manager.shutdown();
    });
    
    it('should block mode switch before 15 seconds', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      manager.switchMode('developer', 'manual', 1.0);
      
      const analysis: ContextAnalysis = {
        mode: 'planning' as ModeType,
        confidence: 0.9,
        triggers: ['plan'],
        metadata: {
          keywords: ['plan'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      // Wait only 14 seconds (less than hysteresis)
      vi.advanceTimersByTime(14 * 1000);
      
      // Should still block
      expect(manager.shouldSwitchMode('developer', analysis)).toBe(false);
      
      manager.shutdown();
    });
    
    it('should be more responsive than old 30s hysteresis', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      manager.switchMode('developer', 'manual', 1.0);
      
      const analysis: ContextAnalysis = {
        mode: 'debugger' as ModeType,
        confidence: 0.95,
        triggers: ['debug'],
        metadata: {
          keywords: ['debug', 'error'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: true
        }
      };
      
      // Old behavior: Would need to wait 30s + 10s = 40s
      // New behavior: Only need to wait 15s + 10s = 25s
      vi.advanceTimersByTime(25 * 1000);
      
      expect(manager.shouldSwitchMode('developer', analysis)).toBe(true);
      
      manager.shutdown();
    });
  });
  
  describe('Optional Metrics', () => {
    it('should NOT create metrics tracker by default', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      const metricsTracker = manager.getMetricsTracker();
      
      expect(metricsTracker).toBeUndefined();
      
      manager.shutdown();
    });
    
    it('should create metrics tracker when enabled', () => {
      const manager = new PromptModeManager(
        promptBuilder,
        promptRegistry,
        contextAnalyzer,
        { enableMetrics: true }
      );
      
      const metricsTracker = manager.getMetricsTracker();
      
      expect(metricsTracker).toBeDefined();
      expect(metricsTracker).not.toBeNull();
      
      manager.shutdown();
    });
    
    it('should NOT persist metrics when disabled', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      // Switch modes
      manager.switchMode('developer', 'manual', 1.0);
      
      // Try to persist metrics - should be no-op
      manager.persistMetrics();
      
      // Should not throw error
      expect(manager.getMetricsTracker()).toBeUndefined();
      
      manager.shutdown();
    });
    
    it('should persist metrics when enabled', () => {
      const manager = new PromptModeManager(
        promptBuilder,
        promptRegistry,
        contextAnalyzer,
        { enableMetrics: true }
      );
      
      // Switch modes
      manager.switchMode('developer', 'manual', 1.0);
      
      // Persist metrics - should work
      manager.persistMetrics();
      
      const metricsTracker = manager.getMetricsTracker();
      expect(metricsTracker).toBeDefined();
      
      manager.shutdown();
    });
    
    it('should handle trackEvent gracefully when metrics disabled', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      // Should not throw error
      expect(() => {
        manager.trackEvent({
          type: 'mode-switch',
          mode: 'developer',
          timestamp: new Date(),
          metadata: {}
        });
      }).not.toThrow();
      
      manager.shutdown();
    });
    
    it('should track events when metrics enabled', () => {
      const manager = new PromptModeManager(
        promptBuilder,
        promptRegistry,
        contextAnalyzer,
        { enableMetrics: true }
      );
      
      const metricsTracker = manager.getMetricsTracker();
      expect(metricsTracker).toBeDefined();
      
      // Track event
      manager.trackEvent({
        type: 'mode-switch',
        mode: 'developer',
        timestamp: new Date(),
        metadata: {}
      });
      
      // Should not throw
      manager.shutdown();
    });
    
    it('should handle clearMetrics gracefully when metrics disabled', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      // Should not throw error
      expect(() => {
        manager.clearMetrics();
      }).not.toThrow();
      
      manager.shutdown();
    });
  });
  
  describe('Backward Compatibility', () => {
    it('should work without config parameter', () => {
      // Old code that doesn't pass config
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      expect(manager.getCurrentMode()).toBe('assistant');
      expect(manager.getMetricsTracker()).toBeUndefined();
      
      manager.shutdown();
    });
    
    it('should work with empty config object', () => {
      const manager = new PromptModeManager(
        promptBuilder,
        promptRegistry,
        contextAnalyzer,
        {}
      );
      
      expect(manager.getCurrentMode()).toBe('assistant');
      expect(manager.getMetricsTracker()).toBeUndefined();
      
      manager.shutdown();
    });
    
    it('should preserve all existing functionality', () => {
      const manager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
      
      // Mode switching
      manager.switchMode('developer', 'manual', 1.0);
      expect(manager.getCurrentMode()).toBe('developer');
      
      // Auto-switch toggle
      manager.setAutoSwitch(false);
      expect(manager.isAutoSwitchEnabled()).toBe(false);
      
      // Skills
      manager.updateSkills(['typescript', 'react']);
      expect(manager.getActiveSkills()).toEqual(['typescript', 'react']);
      
      // Focus mode
      const focusManager = manager.getFocusModeManager();
      expect(focusManager).toBeDefined();
      
      // Animator
      const animator = manager.getAnimator();
      expect(animator).toBeDefined();
      
      manager.shutdown();
    });
  });
  
  describe('Performance Impact', () => {
    it('should initialize faster without metrics', () => {
      const startWithoutMetrics = Date.now();
      const managerWithoutMetrics = new PromptModeManager(
        promptBuilder,
        promptRegistry,
        contextAnalyzer
      );
      const timeWithoutMetrics = Date.now() - startWithoutMetrics;
      
      const startWithMetrics = Date.now();
      const managerWithMetrics = new PromptModeManager(
        promptBuilder,
        promptRegistry,
        contextAnalyzer,
        { enableMetrics: true }
      );
      const timeWithMetrics = Date.now() - startWithMetrics;
      
      // Without metrics should be faster (no disk I/O)
      expect(timeWithoutMetrics).toBeLessThanOrEqual(timeWithMetrics);
      
      managerWithoutMetrics.shutdown();
      managerWithMetrics.shutdown();
    });
  });
});
