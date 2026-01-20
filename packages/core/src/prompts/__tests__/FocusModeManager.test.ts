/**
 * Unit tests for FocusModeManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FocusModeManager } from '../FocusModeManager.js';

describe('FocusModeManager', () => {
  let focusManager: FocusModeManager;
  
  beforeEach(() => {
    focusManager = new FocusModeManager();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    focusManager.shutdown();
    vi.useRealTimers();
  });
  
  describe('initialization', () => {
    it('should start with no active focus session', () => {
      expect(focusManager.isFocusModeActive()).toBe(false);
      expect(focusManager.getCurrentSession()).toBeNull();
      expect(focusManager.getRemainingTime()).toBe(0);
    });
  });
  
  describe('enableFocusMode', () => {
    it('should enable focus mode for a specific mode and duration', () => {
      const session = focusManager.enableFocusMode('developer', 30);
      
      expect(focusManager.isFocusModeActive()).toBe(true);
      expect(session.mode).toBe('developer');
      expect(session.durationMinutes).toBe(30);
      expect(session.active).toBe(true);
    });
    
    it('should set correct start and end times', () => {
      const startTime = new Date();
      const session = focusManager.enableFocusMode('developer', 30);
      
      expect(session.startTime.getTime()).toBeGreaterThanOrEqual(startTime.getTime());
      expect(session.endTime.getTime()).toBe(
        session.startTime.getTime() + 30 * 60 * 1000
      );
    });
    
    it('should emit focus-started event', () => {
      const listener = vi.fn();
      focusManager.onFocusStarted(listener);
      
      const session = focusManager.enableFocusMode('developer', 30);
      
      expect(listener).toHaveBeenCalledWith(session);
    });
    
    it('should emit countdown-update event', () => {
      const listener = vi.fn();
      focusManager.onCountdownUpdate(listener);
      
      focusManager.enableFocusMode('developer', 30);
      
      expect(listener).toHaveBeenCalled();
    });
    
    it('should disable existing session before starting new one', () => {
      const listener = vi.fn();
      focusManager.onFocusEnded(listener);
      
      focusManager.enableFocusMode('developer', 30);
      focusManager.enableFocusMode('planning', 60);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'manual'
        })
      );
      expect(focusManager.getCurrentSession()?.mode).toBe('planning');
    });
    
    it('should throw error for invalid duration (too short)', () => {
      expect(() => focusManager.enableFocusMode('developer', 0)).toThrow(
        'Focus duration must be between 1 and 240 minutes'
      );
    });
    
    it('should throw error for invalid duration (too long)', () => {
      expect(() => focusManager.enableFocusMode('developer', 300)).toThrow(
        'Focus duration must be between 1 and 240 minutes'
      );
    });
  });
  
  describe('disableFocusMode', () => {
    it('should disable active focus mode', () => {
      focusManager.enableFocusMode('developer', 30);
      focusManager.disableFocusMode();
      
      expect(focusManager.isFocusModeActive()).toBe(false);
      expect(focusManager.getCurrentSession()).toBeNull();
    });
    
    it('should emit focus-ended event', () => {
      const listener = vi.fn();
      focusManager.onFocusEnded(listener);
      
      focusManager.enableFocusMode('developer', 30);
      focusManager.disableFocusMode('manual');
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'manual'
        })
      );
    });
    
    it('should do nothing if no active session', () => {
      const listener = vi.fn();
      focusManager.onFocusEnded(listener);
      
      focusManager.disableFocusMode();
      
      expect(listener).not.toHaveBeenCalled();
    });
    
    it('should clear timers', () => {
      focusManager.enableFocusMode('developer', 30);
      
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      focusManager.disableFocusMode();
      
      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
  
  describe('automatic timeout', () => {
    it('should automatically disable focus mode after duration', () => {
      const listener = vi.fn();
      focusManager.onFocusEnded(listener);
      
      focusManager.enableFocusMode('developer', 1); // 1 minute
      
      // Fast-forward time by 1 minute
      vi.advanceTimersByTime(60 * 1000);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'timeout'
        })
      );
      expect(focusManager.isFocusModeActive()).toBe(false);
    });
  });
  
  describe('getRemainingTime', () => {
    it('should return 0 when no active session', () => {
      expect(focusManager.getRemainingTime()).toBe(0);
    });
    
    it('should return correct remaining time', () => {
      focusManager.enableFocusMode('developer', 30);
      
      // Fast-forward 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);
      
      const remaining = focusManager.getRemainingTime();
      expect(remaining).toBeCloseTo(20 * 60 * 1000, -2); // ~20 minutes
    });
    
    it('should return 0 after session expires', () => {
      focusManager.enableFocusMode('developer', 1);
      
      // Fast-forward past expiration
      vi.advanceTimersByTime(2 * 60 * 1000);
      
      expect(focusManager.getRemainingTime()).toBe(0);
    });
  });
  
  describe('getRemainingTimeFormatted', () => {
    it('should format remaining time correctly', () => {
      focusManager.enableFocusMode('developer', 30);
      
      // Fast-forward 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      const formatted = focusManager.getRemainingTimeFormatted();
      expect(formatted).toBe('25:00');
    });
    
    it('should format with seconds', () => {
      focusManager.enableFocusMode('developer', 1);
      
      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30 * 1000);
      
      const formatted = focusManager.getRemainingTimeFormatted();
      expect(formatted).toBe('0:30');
    });
    
    it('should return 0:00 when no active session', () => {
      expect(focusManager.getRemainingTimeFormatted()).toBe('0:00');
    });
  });
  
  describe('shouldBlockModeSwitch', () => {
    it('should not block when focus mode is inactive', () => {
      const result = focusManager.shouldBlockModeSwitch('planning');
      
      expect(result.blocked).toBe(false);
      expect(result.reason).toBeUndefined();
    });
    
    it('should not block switching to the same mode', () => {
      focusManager.enableFocusMode('developer', 30);
      
      const result = focusManager.shouldBlockModeSwitch('developer');
      
      expect(result.blocked).toBe(false);
    });
    
    it('should block switching to a different mode', () => {
      focusManager.enableFocusMode('developer', 30);
      
      const result = focusManager.shouldBlockModeSwitch('planning');
      
      expect(result.blocked).toBe(true);
      expect(result.reason).toContain('Focus mode is active');
      expect(result.reason).toContain('developer mode locked');
    });
    
    it('should include remaining time in block reason', () => {
      focusManager.enableFocusMode('developer', 30);
      
      const result = focusManager.shouldBlockModeSwitch('planning');
      
      expect(result.reason).toContain('30:00');
    });
  });
  
  describe('extendFocusSession', () => {
    it('should extend current session', () => {
      focusManager.enableFocusMode('developer', 30);
      const originalEndTime = focusManager.getCurrentSession()!.endTime;
      
      focusManager.extendFocusSession(15);
      
      const newEndTime = focusManager.getCurrentSession()!.endTime;
      expect(newEndTime.getTime()).toBe(originalEndTime.getTime() + 15 * 60 * 1000);
    });
    
    it('should update duration', () => {
      focusManager.enableFocusMode('developer', 30);
      
      focusManager.extendFocusSession(15);
      
      expect(focusManager.getCurrentSession()!.durationMinutes).toBe(45);
    });
    
    it('should emit focus-extended event', () => {
      const listener = vi.fn();
      focusManager.onFocusExtended(listener);
      
      focusManager.enableFocusMode('developer', 30);
      focusManager.extendFocusSession(15);
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          additionalMinutes: 15
        })
      );
    });
    
    it('should throw error if no active session', () => {
      expect(() => focusManager.extendFocusSession(15)).toThrow(
        'No active focus session to extend'
      );
    });
    
    it('should throw error for invalid extension (too short)', () => {
      focusManager.enableFocusMode('developer', 30);
      
      expect(() => focusManager.extendFocusSession(0)).toThrow(
        'Extension must be between 1 and 120 minutes'
      );
    });
    
    it('should throw error for invalid extension (too long)', () => {
      focusManager.enableFocusMode('developer', 30);
      
      expect(() => focusManager.extendFocusSession(150)).toThrow(
        'Extension must be between 1 and 120 minutes'
      );
    });
  });
  
  describe('getSessionStats', () => {
    it('should return inactive stats when no session', () => {
      const stats = focusManager.getSessionStats();
      
      expect(stats.isActive).toBe(false);
      expect(stats.mode).toBeNull();
      expect(stats.elapsedMinutes).toBe(0);
      expect(stats.remainingMinutes).toBe(0);
      expect(stats.totalMinutes).toBe(0);
      expect(stats.percentComplete).toBe(0);
    });
    
    it('should return correct stats for active session', () => {
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
  
  describe('countdown updates', () => {
    it('should emit countdown updates every second', () => {
      const listener = vi.fn();
      focusManager.onCountdownUpdate(listener);
      
      focusManager.enableFocusMode('developer', 30);
      listener.mockClear(); // Clear initial call
      
      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000);
      
      expect(listener).toHaveBeenCalledTimes(3);
    });
    
    it('should stop countdown updates when disabled', () => {
      const listener = vi.fn();
      focusManager.onCountdownUpdate(listener);
      
      focusManager.enableFocusMode('developer', 30);
      listener.mockClear();
      
      focusManager.disableFocusMode();
      
      // Fast-forward time
      vi.advanceTimersByTime(5000);
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
  
  describe('shutdown', () => {
    it('should disable active focus mode on shutdown', () => {
      focusManager.enableFocusMode('developer', 30);
      
      focusManager.shutdown();
      
      expect(focusManager.isFocusModeActive()).toBe(false);
    });
    
    it('should emit focus-ended with error reason', () => {
      const listener = vi.fn();
      focusManager.onFocusEnded(listener);
      
      focusManager.enableFocusMode('developer', 30);
      focusManager.shutdown();
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'error'
        })
      );
    });
  });
  
  describe('event listeners', () => {
    it('should allow removing listeners', () => {
      const listener = vi.fn();
      
      focusManager.onFocusStarted(listener);
      focusManager.offFocusStarted(listener);
      
      focusManager.enableFocusMode('developer', 30);
      
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
