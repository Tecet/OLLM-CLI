/**
 * Tests for PromptModeManager mode persistence functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptModeManager } from '../PromptModeManager.js';
import { ContextAnalyzer } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';

describe('PromptModeManager - Mode Persistence', () => {
  let modeManager: PromptModeManager;
  let promptRegistry: PromptRegistry;
  let contextAnalyzer: ContextAnalyzer;
  
  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    contextAnalyzer = new ContextAnalyzer();
    
    const systemPromptBuilder = {
      build: () => 'test prompt'
    };
    
    modeManager = new PromptModeManager(
      systemPromptBuilder as any,
      promptRegistry,
      contextAnalyzer
    );
  });
  
  describe('getSerializableModeHistory', () => {
    it('should return empty array when no mode changes have occurred', () => {
      const history = modeManager.getSerializableModeHistory();
      expect(history).toEqual([]);
    });
    
    it('should return serializable mode history after mode changes', () => {
      // Switch modes
      modeManager.switchMode('planning', 'manual', 0.8);
      modeManager.switchMode('developer', 'auto', 0.9);
      
      const history = modeManager.getSerializableModeHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0]).toMatchObject({
        from: 'assistant',
        to: 'planning',
        trigger: 'manual',
        confidence: 0.8
      });
      expect(history[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 format
      
      expect(history[1]).toMatchObject({
        from: 'planning',
        to: 'developer',
        trigger: 'auto',
        confidence: 0.9
      });
    });
    
    it('should limit history to last 100 transitions', () => {
      // Create 150 transitions
      for (let i = 0; i < 150; i++) {
        const mode = i % 2 === 0 ? 'planning' : 'developer';
        modeManager.switchMode(mode as any, 'auto', 0.7);
      }
      
      const history = modeManager.getSerializableModeHistory();
      expect(history).toHaveLength(100);
    });
  });
  
  describe('restoreModeHistory', () => {
    it('should restore mode history from serialized format', () => {
      const savedHistory = [
        {
          from: 'assistant',
          to: 'planning',
          timestamp: '2024-01-01T10:00:00.000Z',
          trigger: 'manual' as const,
          confidence: 0.8
        },
        {
          from: 'planning',
          to: 'developer',
          timestamp: '2024-01-01T10:05:00.000Z',
          trigger: 'auto' as const,
          confidence: 0.9
        }
      ];
      
      modeManager.restoreModeHistory(savedHistory);
      
      const restoredHistory = modeManager.getSerializableModeHistory();
      expect(restoredHistory).toHaveLength(2);
      expect(restoredHistory[0]).toMatchObject(savedHistory[0]);
      expect(restoredHistory[1]).toMatchObject(savedHistory[1]);
    });
    
    it('should restore current mode from last transition', () => {
      const savedHistory = [
        {
          from: 'assistant',
          to: 'planning',
          timestamp: '2024-01-01T10:00:00.000Z',
          trigger: 'manual' as const,
          confidence: 0.8
        },
        {
          from: 'planning',
          to: 'developer',
          timestamp: '2024-01-01T10:05:00.000Z',
          trigger: 'auto' as const,
          confidence: 0.9
        }
      ];
      
      modeManager.restoreModeHistory(savedHistory);
      
      expect(modeManager.getCurrentMode()).toBe('developer');
      expect(modeManager.getPreviousMode()).toBe('planning');
    });
    
    it('should handle empty history', () => {
      modeManager.restoreModeHistory([]);
      
      const history = modeManager.getSerializableModeHistory();
      expect(history).toEqual([]);
    });
  });
  
  describe('auto-switch persistence', () => {
    it('should emit auto-switch-changed event when setAutoSwitch is called', async () => {
      // Create a promise that resolves when the event is emitted
      const eventPromise = new Promise<boolean>((resolve) => {
        modeManager.once('auto-switch-changed', (enabled) => {
          resolve(enabled);
        });
      });
      
      // Trigger the event
      modeManager.setAutoSwitch(false);
      
      // Wait for the event and verify
      const enabled = await eventPromise;
      expect(enabled).toBe(false);
    });
    
    it('should update auto-switch state', () => {
      expect(modeManager.isAutoSwitchEnabled()).toBe(true);
      
      modeManager.setAutoSwitch(false);
      expect(modeManager.isAutoSwitchEnabled()).toBe(false);
      
      modeManager.setAutoSwitch(true);
      expect(modeManager.isAutoSwitchEnabled()).toBe(true);
    });
  });
  
  describe('mode change persistence', () => {
    it('should emit mode-changed event with correct transition data', async () => {
      // Create a promise that resolves when the event is emitted
      const eventPromise = new Promise<any>((resolve) => {
        modeManager.onModeChange((transition) => {
          resolve(transition);
        });
      });
      
      // Trigger the event
      modeManager.switchMode('planning', 'manual', 0.8);
      
      // Wait for the event and verify
      const transition = await eventPromise;
      expect(transition).toMatchObject({
        from: 'assistant',
        to: 'planning',
        trigger: 'manual',
        confidence: 0.8
      });
      expect(transition.timestamp).toBeInstanceOf(Date);
    });
  });
});
