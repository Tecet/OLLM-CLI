/**
 * Integration tests for Focus Mode with Mode Switching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PromptModeManager } from '../PromptModeManager.js';
import { ContextAnalyzer } from '../ContextAnalyzer.js';
import { PromptRegistry } from '../PromptRegistry.js';
import { SystemPromptBuilder } from '../../context/SystemPromptBuilder.js';
import type { ModeType } from '../ContextAnalyzer.js';

describe('Focus Mode Integration', () => {
  let modeManager: PromptModeManager;
  let contextAnalyzer: ContextAnalyzer;
  let promptRegistry: PromptRegistry;
  let promptBuilder: SystemPromptBuilder;
  
  beforeEach(() => {
    promptRegistry = new PromptRegistry();
    promptBuilder = new SystemPromptBuilder(promptRegistry);
    contextAnalyzer = new ContextAnalyzer();
    modeManager = new PromptModeManager(promptBuilder, promptRegistry, contextAnalyzer);
    
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    modeManager.shutdown();
    vi.useRealTimers();
  });
  
  describe('focus mode blocking', () => {
    it('should block auto-switching when focus mode is active', () => {
      // Switch to developer mode first
      modeManager.switchMode('developer', 'manual', 1.0);
      
      // Enable focus mode for developer
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      // Try to auto-switch to planning mode
      const analysis = {
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
      
      const shouldSwitch = modeManager.shouldSwitchMode('developer', analysis);
      
      expect(shouldSwitch).toBe(false);
      expect(modeManager.getCurrentMode()).toBe('developer');
    });
    
    it('should block manual mode switching when focus mode is active', () => {
      // Switch to developer mode first
      modeManager.switchMode('developer', 'manual', 1.0);
      
      // Enable focus mode for developer
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      // Listen for blocked event
      const blockedListener = vi.fn();
      modeManager.on('mode-switch-blocked', blockedListener);
      
      // Try to manually switch to planning mode
      modeManager.switchMode('planning', 'manual', 0.8);
      
      // Should be blocked
      expect(blockedListener).toHaveBeenCalledWith(
        expect.objectContaining({
          targetMode: 'planning',
          reason: expect.stringContaining('Focus mode is active')
        })
      );
      expect(modeManager.getCurrentMode()).toBe('developer');
    });
    
    it('should allow switching to the same mode during focus', () => {
      // Switch to developer mode first
      modeManager.switchMode('developer', 'manual', 1.0);
      
      // Enable focus mode for developer
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      // Try to switch to developer (same mode)
      const analysis = {
        mode: 'developer' as ModeType,
        confidence: 0.9,
        triggers: ['implement'],
        metadata: {
          keywords: ['implement'],
          toolsUsed: [],
          recentTopics: [],
          codeBlocksPresent: false,
          errorMessagesPresent: false
        }
      };
      
      const shouldSwitch = modeManager.shouldSwitchMode('developer', analysis);
      
      // Should not switch (already in developer mode)
      expect(shouldSwitch).toBe(false);
      expect(modeManager.getCurrentMode()).toBe('developer');
    });
    
    it('should allow explicit mode switching during focus', () => {
      // Switch to developer mode first
      modeManager.switchMode('developer', 'manual', 1.0);
      
      // Enable focus mode for developer
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      // Listen for mode change
      const changeListener = vi.fn();
      modeManager.on('mode-changed', changeListener);
      
      // Try to explicitly switch to planning mode
      modeManager.switchMode('planning', 'explicit', 1.0);
      
      // Should succeed with explicit trigger
      expect(changeListener).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'developer',
          to: 'planning',
          trigger: 'explicit'
        })
      );
      expect(modeManager.getCurrentMode()).toBe('planning');
    });
  });
  
  describe('focus mode lifecycle', () => {
    it('should allow mode switching after focus mode ends', () => {
      // Enable focus mode for 1 minute
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 1);
      
      // Fast-forward past focus duration
      vi.advanceTimersByTime(61 * 1000);
      
      // Now try to switch modes
      const analysis = {
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
      
      // Wait for hysteresis (15s) and cooldown (10s)
      vi.advanceTimersByTime(25 * 1000);
      
      const shouldSwitch = modeManager.shouldSwitchMode('developer', analysis);
      
      expect(shouldSwitch).toBe(true);
    });
    
    it('should allow mode switching after manually disabling focus', () => {
      // Enable focus mode
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      // Manually disable focus mode
      focusManager.disableFocusMode('manual');
      
      // Now try to switch modes
      const analysis = {
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
      
      // Wait for hysteresis (15s) and cooldown (10s)
      vi.advanceTimersByTime(25 * 1000);
      
      const shouldSwitch = modeManager.shouldSwitchMode('developer', analysis);
      
      expect(shouldSwitch).toBe(true);
    });
  });
  
  describe('focus mode with mode manager shutdown', () => {
    it('should disable focus mode when mode manager shuts down', () => {
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      expect(focusManager.isFocusModeActive()).toBe(true);
      
      modeManager.shutdown();
      
      expect(focusManager.isFocusModeActive()).toBe(false);
    });
  });
  
  describe('focus mode events', () => {
    it('should emit focus-started when focus mode is enabled', () => {
      const listener = vi.fn();
      const focusManager = modeManager.getFocusModeManager();
      focusManager.onFocusStarted(listener);
      
      focusManager.enableFocusMode('developer', 30);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'developer',
          durationMinutes: 30,
          active: true
        })
      );
    });
    
    it('should emit focus-ended when focus mode times out', () => {
      const listener = vi.fn();
      const focusManager = modeManager.getFocusModeManager();
      focusManager.onFocusEnded(listener);
      
      focusManager.enableFocusMode('developer', 1);
      
      // Fast-forward past duration
      vi.advanceTimersByTime(61 * 1000);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'timeout'
        })
      );
    });
    
    it('should emit countdown-update events during focus', () => {
      const listener = vi.fn();
      const focusManager = modeManager.getFocusModeManager();
      focusManager.onCountdownUpdate(listener);
      
      focusManager.enableFocusMode('developer', 30);
      listener.mockClear(); // Clear initial call
      
      // Fast-forward 5 seconds
      vi.advanceTimersByTime(5000);
      
      expect(listener).toHaveBeenCalledTimes(5);
      expect(listener).toHaveBeenLastCalledWith(
        expect.objectContaining({
          remainingMs: expect.any(Number),
          formatted: expect.any(String)
        })
      );
    });
  });
  
  describe('focus mode with different modes', () => {
    it('should work with all mode types', () => {
      const modes: ModeType[] = [
        'assistant', 'planning', 'developer', 'tool',
        'debugger', 'security', 'reviewer', 'performance',
        'prototype', 'teacher'
      ];
      
      const focusManager = modeManager.getFocusModeManager();
      
      for (const mode of modes) {
        focusManager.enableFocusMode(mode, 1);
        
        expect(focusManager.isFocusModeActive()).toBe(true);
        expect(focusManager.getCurrentSession()?.mode).toBe(mode);
        
        focusManager.disableFocusMode();
      }
    });
  });
  
  describe('focus mode extension', () => {
    it('should allow extending focus session', () => {
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      const originalEndTime = focusManager.getCurrentSession()!.endTime;
      
      focusManager.extendFocusSession(15);
      
      const newEndTime = focusManager.getCurrentSession()!.endTime;
      expect(newEndTime.getTime()).toBe(originalEndTime.getTime() + 15 * 60 * 1000);
    });
    
    it('should continue blocking mode switches after extension', () => {
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 1);
      
      // Extend before timeout
      focusManager.extendFocusSession(30);
      
      // Try to switch modes
      const analysis = {
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
      
      const shouldSwitch = modeManager.shouldSwitchMode('developer', analysis);
      
      expect(shouldSwitch).toBe(false);
      expect(focusManager.isFocusModeActive()).toBe(true);
    });
  });
  
  describe('focus mode statistics', () => {
    it('should provide accurate session statistics', () => {
      const focusManager = modeManager.getFocusModeManager();
      focusManager.enableFocusMode('developer', 30);
      
      // Fast-forward 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);
      
      const stats = focusManager.getSessionStats();
      
      expect(stats.isActive).toBe(true);
      expect(stats.mode).toBe('developer');
      expect(stats.elapsedMinutes).toBe(10);
      expect(stats.remainingMinutes).toBe(20);
      expect(stats.totalMinutes).toBe(30);
      expect(stats.percentComplete).toBeCloseTo(33, 0);
    });
  });
});
