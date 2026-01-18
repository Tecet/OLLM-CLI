/**
 * Focus Mode Manager for Dynamic Prompt System
 * 
 * Manages focus mode sessions that lock the system to a specific mode for deep work.
 * Prevents both auto-switching and manual mode changes during the focus period.
 */

import { EventEmitter } from 'events';
import type { ModeType } from './ContextAnalyzer.js';

/**
 * Focus mode session configuration
 */
export interface FocusSession {
  /** The mode locked during focus */
  mode: ModeType;
  /** Duration in minutes */
  durationMinutes: number;
  /** Start time of the focus session */
  startTime: Date;
  /** End time of the focus session */
  endTime: Date;
  /** Whether the session is currently active */
  active: boolean;
}

/**
 * Focus mode state
 */
interface FocusModeState {
  /** Current focus session (null if not in focus mode) */
  currentSession: FocusSession | null;
  /** Timer for automatic focus mode end */
  timer: NodeJS.Timeout | null;
  /** Interval for countdown updates */
  countdownInterval: NodeJS.Timeout | null;
}

/**
 * Focus Mode Manager
 * 
 * Provides deep work sessions by locking to a specific mode for a duration.
 */
export class FocusModeManager extends EventEmitter {
  private state: FocusModeState;
  
  constructor() {
    super();
    
    this.state = {
      currentSession: null,
      timer: null,
      countdownInterval: null
    };
  }
  
  /**
   * Check if focus mode is currently active
   */
  isFocusModeActive(): boolean {
    return this.state.currentSession !== null && this.state.currentSession.active;
  }
  
  /**
   * Get current focus session
   */
  getCurrentSession(): FocusSession | null {
    return this.state.currentSession;
  }
  
  /**
   * Get remaining time in current focus session (in milliseconds)
   * Returns 0 if no active session
   */
  getRemainingTime(): number {
    if (!this.state.currentSession || !this.state.currentSession.active) {
      return 0;
    }
    
    const now = Date.now();
    const endTime = this.state.currentSession.endTime.getTime();
    const remaining = endTime - now;
    
    return Math.max(0, remaining);
  }
  
  /**
   * Get remaining time formatted as string (e.g., "25:30")
   */
  getRemainingTimeFormatted(): string {
    const remainingMs = this.getRemainingTime();
    
    if (remainingMs === 0) {
      return '0:00';
    }
    
    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Enable focus mode for a specific mode and duration
   * 
   * @param mode - The mode to lock to
   * @param durationMinutes - Duration in minutes (default: 25 minutes - Pomodoro)
   * @returns The created focus session
   */
  enableFocusMode(mode: ModeType, durationMinutes: number = 25): FocusSession {
    // Disable any existing focus session first
    if (this.isFocusModeActive()) {
      this.disableFocusMode();
    }
    
    // Validate duration (must be between 1 and 240 minutes / 4 hours)
    if (durationMinutes < 1 || durationMinutes > 240) {
      throw new Error('Focus duration must be between 1 and 240 minutes');
    }
    
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    
    // Create focus session
    const session: FocusSession = {
      mode,
      durationMinutes,
      startTime,
      endTime,
      active: true
    };
    
    this.state.currentSession = session;
    
    // Set timer to automatically end focus mode
    this.state.timer = setTimeout(() => {
      this.handleFocusTimeout();
    }, durationMinutes * 60 * 1000);
    
    // Start countdown interval (update every second)
    this.state.countdownInterval = setInterval(() => {
      this.emitCountdownUpdate();
    }, 1000);
    
    // Emit focus-started event
    this.emit('focus-started', session);
    
    // Emit initial countdown update
    this.emitCountdownUpdate();
    
    return session;
  }
  
  /**
   * Disable focus mode
   * 
   * @param reason - Reason for disabling (manual, timeout, error)
   */
  disableFocusMode(reason: 'manual' | 'timeout' | 'error' = 'manual'): void {
    if (!this.state.currentSession) {
      return;
    }
    
    const session = this.state.currentSession;
    
    // Clear timers
    if (this.state.timer) {
      clearTimeout(this.state.timer);
      this.state.timer = null;
    }
    
    if (this.state.countdownInterval) {
      clearInterval(this.state.countdownInterval);
      this.state.countdownInterval = null;
    }
    
    // Mark session as inactive
    session.active = false;
    
    // Clear current session
    this.state.currentSession = null;
    
    // Emit focus-ended event
    this.emit('focus-ended', { session, reason });
  }
  
  /**
   * Handle focus mode timeout (automatic end)
   */
  private handleFocusTimeout(): void {
    this.disableFocusMode('timeout');
  }
  
  /**
   * Emit countdown update event
   */
  private emitCountdownUpdate(): void {
    if (!this.isFocusModeActive()) {
      return;
    }
    
    const remaining = this.getRemainingTime();
    const formatted = this.getRemainingTimeFormatted();
    
    this.emit('countdown-update', {
      remainingMs: remaining,
      formatted,
      session: this.state.currentSession
    });
  }
  
  /**
   * Check if mode switching should be blocked
   * 
   * @param targetMode - The mode attempting to switch to
   * @returns Object with blocked status and reason
   */
  shouldBlockModeSwitch(targetMode: ModeType): {
    blocked: boolean;
    reason?: string;
  } {
    if (!this.isFocusModeActive()) {
      return { blocked: false };
    }
    
    const session = this.state.currentSession!;
    
    // Allow switching to the same mode (no-op)
    if (targetMode === session.mode) {
      return { blocked: false };
    }
    
    // Block switching to any other mode
    const remaining = this.getRemainingTimeFormatted();
    return {
      blocked: true,
      reason: `Focus mode is active (${session.mode} mode locked for ${remaining}). Use /mode focus off to disable.`
    };
  }
  
  /**
   * Extend current focus session by additional minutes
   * 
   * @param additionalMinutes - Minutes to add to current session
   */
  extendFocusSession(additionalMinutes: number): void {
    if (!this.isFocusModeActive()) {
      throw new Error('No active focus session to extend');
    }
    
    if (additionalMinutes < 1 || additionalMinutes > 120) {
      throw new Error('Extension must be between 1 and 120 minutes');
    }
    
    const session = this.state.currentSession!;
    
    // Update end time
    session.endTime = new Date(session.endTime.getTime() + additionalMinutes * 60 * 1000);
    session.durationMinutes += additionalMinutes;
    
    // Clear existing timer
    if (this.state.timer) {
      clearTimeout(this.state.timer);
    }
    
    // Set new timer
    const remainingMs = this.getRemainingTime();
    this.state.timer = setTimeout(() => {
      this.handleFocusTimeout();
    }, remainingMs);
    
    // Emit focus-extended event
    this.emit('focus-extended', {
      session,
      additionalMinutes,
      newEndTime: session.endTime
    });
  }
  
  /**
   * Get focus session statistics
   */
  getSessionStats(): {
    isActive: boolean;
    mode: ModeType | null;
    elapsedMinutes: number;
    remainingMinutes: number;
    totalMinutes: number;
    percentComplete: number;
  } {
    if (!this.state.currentSession) {
      return {
        isActive: false,
        mode: null,
        elapsedMinutes: 0,
        remainingMinutes: 0,
        totalMinutes: 0,
        percentComplete: 0
      };
    }
    
    const session = this.state.currentSession;
    const now = Date.now();
    const startTime = session.startTime.getTime();
    const endTime = session.endTime.getTime();
    const totalMs = endTime - startTime;
    const elapsedMs = now - startTime;
    const remainingMs = Math.max(0, endTime - now);
    
    return {
      isActive: session.active,
      mode: session.mode,
      elapsedMinutes: Math.floor(elapsedMs / 60000),
      remainingMinutes: Math.ceil(remainingMs / 60000),
      totalMinutes: session.durationMinutes,
      percentComplete: Math.min(100, Math.floor((elapsedMs / totalMs) * 100))
    };
  }
  
  /**
   * Cleanup method to be called when shutting down
   */
  shutdown(): void {
    if (this.isFocusModeActive()) {
      this.disableFocusMode('error');
    }
  }
  
  /**
   * Register focus-started listener
   */
  onFocusStarted(callback: (session: FocusSession) => void): void {
    this.on('focus-started', callback);
  }
  
  /**
   * Register focus-ended listener
   */
  onFocusEnded(callback: (data: { session: FocusSession; reason: string }) => void): void {
    this.on('focus-ended', callback);
  }
  
  /**
   * Register countdown-update listener
   */
  onCountdownUpdate(callback: (data: { remainingMs: number; formatted: string; session: FocusSession | null }) => void): void {
    this.on('countdown-update', callback);
  }
  
  /**
   * Register focus-extended listener
   */
  onFocusExtended(callback: (data: { session: FocusSession; additionalMinutes: number; newEndTime: Date }) => void): void {
    this.on('focus-extended', callback);
  }
  
  /**
   * Remove focus-started listener
   */
  offFocusStarted(callback: (session: FocusSession) => void): void {
    this.off('focus-started', callback);
  }
  
  /**
   * Remove focus-ended listener
   */
  offFocusEnded(callback: (data: { session: FocusSession; reason: string }) => void): void {
    this.off('focus-ended', callback);
  }
  
  /**
   * Remove countdown-update listener
   */
  offCountdownUpdate(callback: (data: { remainingMs: number; formatted: string; session: FocusSession | null }) => void): void {
    this.off('countdown-update', callback);
  }
  
  /**
   * Remove focus-extended listener
   */
  offFocusExtended(callback: (data: { session: FocusSession; additionalMinutes: number; newEndTime: Date }) => void): void {
    this.off('focus-extended', callback);
  }
}
