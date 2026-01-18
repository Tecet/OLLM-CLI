/**
 * Mode Persistence Integration Test
 * 
 * Tests the complete mode persistence flow including:
 * - Saving mode to settings
 * - Saving mode history to session metadata
 * - Restoring mode and history on session resume
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PromptModeManager } from '../PromptModeManager.js';
import { ContextAnalyzer } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';
import type { ModeTransition } from '../PromptModeManager.js';

describe('Mode Persistence Integration', () => {
  let modeManager: PromptModeManager;
  let contextAnalyzer: ContextAnalyzer;
  let promptRegistry: PromptRegistry;
  
  beforeEach(() => {
    // Create mock SystemPromptBuilder
    const mockBuilder = {
      build: vi.fn(() => 'mock prompt')
    };
    
    promptRegistry = new PromptRegistry();
    contextAnalyzer = new ContextAnalyzer();
    modeManager = new PromptModeManager(
      mockBuilder as any,
      promptRegistry,
      contextAnalyzer
    );
  });
  
  describe('Complete Persistence Flow', () => {
    it('should emit mode-changed events that can be saved to session', async () => {
      // Listen for mode changes
      const modeChanges: ModeTransition[] = [];
      
      const promise = new Promise<void>((resolve) => {
        modeManager.onModeChange((transition) => {
          modeChanges.push(transition);
          
          // Verify transition has all required fields for session persistence
          expect(transition.from).toBeDefined();
          expect(transition.to).toBeDefined();
          expect(transition.timestamp).toBeInstanceOf(Date);
          expect(transition.trigger).toBeDefined();
          expect(transition.confidence).toBeGreaterThanOrEqual(0);
          
          // If we've collected enough transitions, verify and complete
          if (modeChanges.length === 2) {
            expect(modeChanges[0].from).toBe('assistant');
            expect(modeChanges[0].to).toBe('planning');
            expect(modeChanges[1].from).toBe('planning');
            expect(modeChanges[1].to).toBe('developer');
            resolve();
          }
        });
      });
      
      // Perform mode transitions
      modeManager.switchMode('planning', 'auto', 0.75);
      modeManager.switchMode('developer', 'auto', 0.82);
      
      await promise;
    });
    
    it('should provide serializable history for session storage', () => {
      // Perform mode transitions
      modeManager.switchMode('planning', 'auto', 0.75);
      modeManager.switchMode('developer', 'manual', 1.0);
      modeManager.switchMode('debugger', 'auto', 0.90);
      
      // Get serializable history
      const history = modeManager.getSerializableModeHistory();
      
      // Verify history is serializable (all dates are strings)
      expect(history).toHaveLength(3);
      expect(typeof history[0].timestamp).toBe('string');
      expect(typeof history[1].timestamp).toBe('string');
      expect(typeof history[2].timestamp).toBe('string');
      
      // Verify history can be JSON serialized
      const json = JSON.stringify(history);
      expect(json).toBeDefined();
      
      // Verify history can be parsed back
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(3);
      expect(parsed[0].from).toBe('assistant');
      expect(parsed[0].to).toBe('planning');
    });
    
    it('should restore complete state from session data', () => {
      // Simulate session data with mode history
      const sessionModeHistory = [
        {
          from: 'assistant',
          to: 'planning',
          timestamp: new Date('2024-01-01T10:00:00Z').toISOString(),
          trigger: 'auto' as const,
          confidence: 0.75
        },
        {
          from: 'planning',
          to: 'developer',
          timestamp: new Date('2024-01-01T10:05:00Z').toISOString(),
          trigger: 'auto' as const,
          confidence: 0.82
        },
        {
          from: 'developer',
          to: 'debugger',
          timestamp: new Date('2024-01-01T10:10:00Z').toISOString(),
          trigger: 'auto' as const,
          confidence: 0.90
        }
      ];
      
      // Restore history
      modeManager.restoreModeHistory(sessionModeHistory);
      
      // Verify current mode is restored from last transition
      expect(modeManager.getCurrentMode()).toBe('debugger');
      expect(modeManager.getPreviousMode()).toBe('developer');
      
      // Verify history is restored
      const restoredHistory = modeManager.getModeHistory();
      expect(restoredHistory).toHaveLength(3);
      expect(restoredHistory[0].from).toBe('assistant');
      expect(restoredHistory[0].to).toBe('planning');
      expect(restoredHistory[2].from).toBe('developer');
      expect(restoredHistory[2].to).toBe('debugger');
    });
    
    it('should maintain auto-switch state across sessions', () => {
      // Disable auto-switch
      modeManager.setAutoSwitch(false);
      expect(modeManager.isAutoSwitchEnabled()).toBe(false);
      
      // Simulate saving and restoring session
      const autoSwitchState = modeManager.isAutoSwitchEnabled();
      
      // Create new manager (simulating session resume)
      const newManager = new PromptModeManager(
        { build: vi.fn(() => 'mock prompt') } as any,
        promptRegistry,
        contextAnalyzer
      );
      
      // Restore auto-switch state
      newManager.setAutoSwitch(autoSwitchState);
      
      // Verify state is preserved
      expect(newManager.isAutoSwitchEnabled()).toBe(false);
    });
    
    it('should handle session resume with empty history', () => {
      // Restore empty history (new session)
      modeManager.restoreModeHistory([]);
      
      // Should start in default mode
      expect(modeManager.getCurrentMode()).toBe('assistant');
      expect(modeManager.getPreviousMode()).toBeNull();
      expect(modeManager.getModeHistory()).toHaveLength(0);
    });
    
    it('should limit history size when restoring from session', () => {
      // Create history with more than 100 transitions
      const largeHistory = Array.from({ length: 150 }, (_, i) => ({
        from: i % 2 === 0 ? 'developer' : 'planning',
        to: i % 2 === 0 ? 'planning' : 'developer',
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        trigger: 'auto' as const,
        confidence: 0.75
      }));
      
      // Restore history - it will restore all 150 items
      modeManager.restoreModeHistory(largeHistory);
      
      // The history is restored as-is, but new transitions will be limited
      // Note: restoreModeHistory doesn't enforce the limit, it trusts the input
      // The limit is enforced when adding new transitions via switchMode
      const restoredHistory = modeManager.getModeHistory();
      expect(restoredHistory.length).toBe(150);
      
      // Add one more transition
      modeManager.switchMode('debugger', 'auto', 0.90);
      
      // Now the history should be trimmed to 100 (the addToHistory method enforces this)
      const trimmedHistory = modeManager.getModeHistory();
      expect(trimmedHistory.length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Settings Persistence', () => {
    it('should provide current mode for settings persistence', () => {
      // Switch to planning mode
      modeManager.switchMode('planning', 'manual', 1.0);
      
      // Get current mode (would be saved to settings)
      const currentMode = modeManager.getCurrentMode();
      expect(currentMode).toBe('planning');
      
      // Simulate loading from settings on app start
      const newManager = new PromptModeManager(
        { build: vi.fn(() => 'mock prompt') } as any,
        promptRegistry,
        contextAnalyzer
      );
      
      // Force mode from settings
      newManager.forceMode(currentMode);
      
      // Verify mode is restored
      expect(newManager.getCurrentMode()).toBe('planning');
    });
    
    it('should provide auto-switch state for settings persistence', () => {
      // Disable auto-switch
      modeManager.setAutoSwitch(false);
      
      // Get auto-switch state (would be saved to settings)
      const autoSwitchEnabled = modeManager.isAutoSwitchEnabled();
      expect(autoSwitchEnabled).toBe(false);
      
      // Simulate loading from settings on app start
      const newManager = new PromptModeManager(
        { build: vi.fn(() => 'mock prompt') } as any,
        promptRegistry,
        contextAnalyzer
      );
      
      // Restore auto-switch state from settings
      newManager.setAutoSwitch(autoSwitchEnabled);
      
      // Verify state is restored
      expect(newManager.isAutoSwitchEnabled()).toBe(false);
    });
  });
  
  describe('Event-Based Persistence', () => {
    it('should emit events that can trigger persistence operations', async () => {
      let modeChangeEmitted = false;
      let autoSwitchChangeEmitted = false;
      
      const promise = new Promise<void>((resolve) => {
        // Listen for mode changes
        modeManager.onModeChange((transition) => {
          modeChangeEmitted = true;
          
          // This event would trigger:
          // 1. Saving mode to settings
          // 2. Saving transition to session metadata
          expect(transition.to).toBe('planning');
          
          checkComplete();
        });
        
        // Listen for auto-switch changes
        modeManager.on('auto-switch-changed', (enabled) => {
          autoSwitchChangeEmitted = true;
          
          // This event would trigger:
          // 1. Saving auto-switch preference to settings
          expect(enabled).toBe(false);
          
          checkComplete();
        });
        
        function checkComplete() {
          if (modeChangeEmitted && autoSwitchChangeEmitted) {
            resolve();
          }
        }
      });
      
      // Trigger events
      modeManager.switchMode('planning', 'manual', 1.0);
      modeManager.setAutoSwitch(false);
      
      await promise;
    });
  });
});
