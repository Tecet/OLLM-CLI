/**
 * Prompt Mode Manager for Dynamic Prompt System
 * 
 * Orchestrates mode transitions, builds prompts, filters tools, and maintains mode history.
 * Implements hysteresis and cooldown to prevent rapid mode switching.
 */

import { EventEmitter } from 'events';

import { FocusModeManager } from './FocusModeManager.js';
import { ModeMetricsTracker } from './ModeMetricsTracker.js';
import { ModeTransitionAnimator } from './ModeTransitionAnimator.js';
import { createLogger } from '../utils/logger.js';

import type { ContextAnalyzer, ContextAnalysis, ModeType } from './ContextAnalyzer.js';
import type { ModelCapabilities } from '../services/modelManagementService.js';

const logger = createLogger('PromptModeManager');

/**
 * Mode configuration
 */
export interface ModeConfig {
  mode: ModeType;
  autoSwitch: boolean;
  minDuration: number;      // Minimum time in mode (ms)
  cooldownPeriod: number;   // Time between switches (ms)
  confidenceThreshold: number;
}

/**
 * Mode transition record
 */
export interface ModeTransition {
  from: ModeType;
  to: ModeType;
  timestamp: Date;
  trigger: 'auto' | 'manual' | 'tool' | 'explicit';
  confidence: number;
}

/**
 * Options for building prompts
 */
export interface PromptBuildOptions {
  mode: ModeType;
  skills?: string[];
  tools: Array<{ name: string }>;
  workspace?: {
    path: string;
    files?: string[];
  };
  additionalInstructions?: string;
  modelCapabilities?: Partial<ModelCapabilities>;
}

/**
 * Mode state tracking
 */
interface ModeState {
  currentMode: ModeType;
  previousMode: ModeType | null;
  autoSwitchEnabled: boolean;
  lastSwitchTime: Date;
  modeEntryTime: Date;
  activeSkills: string[];
}

/**
 * Confidence thresholds for mode transitions
 */
const CONFIDENCE_THRESHOLDS: Record<string, number> = {
  // Explicit requests always switch
  'explicit': 1.0,
  
  // Core mode transitions
  'assistant->planning': 0.70,
  'planning->developer': 0.80,
  'developer->planning': 0.60,  // Easier to step back
  'developer->debugger': 0.85,
  'debugger->developer': 0.70,
  
  // Tool mode
  'any->tool': 0.90,
  
  // Default threshold
  'default': 0.70
};

/**
 * Prompt Mode Manager
 * 
 * Central orchestration layer for the dynamic prompt system.
 */
export class PromptModeManager extends EventEmitter {
  private state: ModeState;
  private modeHistory: ModeTransition[] = [];
  private readonly maxHistorySize = 100;
  private metricsTracker?: ModeMetricsTracker;  // Optional: only created if enabled
  private focusModeManager: FocusModeManager;
  private animator: ModeTransitionAnimator;
  
  // Timing configuration
  private readonly minDuration = 15000;  // 15 seconds (reduced from 30s for better responsiveness)
  private readonly cooldownPeriod = 10000;  // 10 seconds
  
  constructor(
    private contextAnalyzer: ContextAnalyzer,
    config: { enableMetrics?: boolean } = {}
  ) {
    super();
    
    // Initialize metrics tracker (optional, default disabled)
    if (config.enableMetrics) {
      this.metricsTracker = new ModeMetricsTracker();
      // Load persisted metrics from disk
      this.loadMetrics();
    }
    
    // Initialize focus mode manager
    this.focusModeManager = new FocusModeManager();
    
    // Initialize transition animator
    this.animator = new ModeTransitionAnimator();
    
    // Initialize state
    this.state = {
      currentMode: 'assistant',
      previousMode: null,
      autoSwitchEnabled: true,
      lastSwitchTime: new Date(),
      modeEntryTime: new Date(),
      activeSkills: []
    };
    
    // Track initial mode entry (if metrics enabled)
    this.metricsTracker?.trackModeEntry('assistant');
  }
  
  /**
   * Get current mode
   */
  getCurrentMode(): ModeType {
    return this.state.currentMode;
  }
  
  /**
   * Get previous mode
   */
  getPreviousMode(): ModeType | null {
    return this.state.previousMode;
  }
  
  /**
   * Check if auto-switching is enabled
   */
  isAutoSwitchEnabled(): boolean {
    return this.state.autoSwitchEnabled;
  }
  
  /**
   * Enable or disable auto-switching
   */
  setAutoSwitch(enabled: boolean): void {
    this.state.autoSwitchEnabled = enabled;
    
    // Emit event so UI can persist the preference
    this.emit('auto-switch-changed', enabled);
  }
  
  /**
   * Force a specific mode (disables auto-switch)
   */
  forceMode(mode: ModeType): void {
    this.state.autoSwitchEnabled = false;
    this.switchMode(mode, 'manual', 1.0);
  }
  
  /**
   * Update active skills
   */
  updateSkills(skills: string[]): void {
    this.state.activeSkills = skills;
    this.emit('skills-changed', skills);
  }
  
  /**
   * Get active skills
   */
  getActiveSkills(): string[] {
    return this.state.activeSkills;
  }
  
  /**
   * Get metrics tracker (may be undefined if metrics disabled)
   */
  getMetricsTracker(): ModeMetricsTracker | undefined {
    return this.metricsTracker;
  }
  
  /**
   * Get transition animator
   */
  getAnimator(): ModeTransitionAnimator {
    return this.animator;
  }
  
  /**
   * Get focus mode manager
   */
  getFocusModeManager(): FocusModeManager {
    return this.focusModeManager;
  }

  /**
   * Get context analyzer
   */
  getContextAnalyzer(): ContextAnalyzer {
    return this.contextAnalyzer;
  }
  
  /**
   * Track a mode-specific event
   * Convenience method to track events through the metrics tracker
   */
  trackEvent(event: import('./ModeMetricsTracker.js').ModeEvent): void {
    this.metricsTracker?.trackEvent(event);
    
    // Persist metrics after tracking significant events (if metrics enabled)
    // (debounced to avoid excessive disk writes)
    if (this.metricsTracker) {
      this.debouncedPersistMetrics();
    }
  }
  
  /**
   * Persist metrics to disk
   * Saves current metrics to ~/.ollm/metrics/mode-metrics.json
   */
  persistMetrics(): void {
    if (!this.metricsTracker) return;  // Skip if metrics disabled
    
    try {
      this.metricsTracker.saveMetricsToDisk();
    } catch (error) {
      // Log error but don't throw - metrics persistence should not break functionality
      logger.error('Failed to persist mode metrics:', error);
    }
  }
  
  /**
   * Debounced version of persistMetrics to avoid excessive disk writes
   */
  private persistMetricsTimeout: NodeJS.Timeout | null = null;
  private debouncedPersistMetrics(): void {
    if (this.persistMetricsTimeout) {
      clearTimeout(this.persistMetricsTimeout);
    }
    
    this.persistMetricsTimeout = setTimeout(() => {
      this.persistMetrics();
      this.persistMetricsTimeout = null;
    }, 5000); // Wait 5 seconds after last event before persisting
  }
  
  /**
   * Load metrics from disk
   * Loads persisted metrics from ~/.ollm/metrics/mode-metrics.json
   * 
   * @returns true if metrics were loaded successfully, false otherwise
   */
  loadMetrics(): boolean {
    if (!this.metricsTracker) return false;  // Skip if metrics disabled
    
    try {
      return this.metricsTracker.loadMetricsFromDisk();
    } catch (error) {
      logger.error('Failed to load mode metrics:', error);
      return false;
    }
  }
  
  /**
   * Clear persisted metrics
   * Deletes the metrics file and resets in-memory metrics
   */
  clearMetrics(): void {
    if (!this.metricsTracker) return;  // Skip if metrics disabled
    
    try {
      this.metricsTracker.clearPersistedMetrics();
      this.metricsTracker.resetMetrics();
    } catch (error) {
      logger.error('Failed to clear mode metrics:', error);
    }
  }
  
  /**
   * Cleanup method to be called when shutting down
   * Ensures metrics are persisted before exit
   */
  shutdown(): void {
    // Cancel any pending debounced persist
    if (this.persistMetricsTimeout) {
      clearTimeout(this.persistMetricsTimeout);
      this.persistMetricsTimeout = null;
    }
    
    // Persist metrics one final time
    this.persistMetrics();
    
    // Shutdown focus mode manager
    this.focusModeManager.shutdown();
  }
  
  /**
   * Check if mode should switch based on analysis
   * 
   * Implements hysteresis and cooldown logic.
   */
  shouldSwitchMode(currentMode: ModeType, analysis: ContextAnalysis): boolean {
    // Check if focus mode blocks this switch
    const focusCheck = this.focusModeManager.shouldBlockModeSwitch(analysis.mode);
    if (focusCheck.blocked) {
      return false;
    }
    
    // Don't switch if auto-switch is disabled
    if (!this.state.autoSwitchEnabled) {
      return false;
    }
    
    // Don't switch to the same mode
    if (analysis.mode === currentMode) {
      return false;
    }
    
    // Check cooldown period (10s between switches)
    const timeSinceLastSwitch = Date.now() - this.state.lastSwitchTime.getTime();
    if (timeSinceLastSwitch < this.cooldownPeriod) {
      return false;
    }
    
    // Check hysteresis (15s minimum duration in current mode)
    const timeInCurrentMode = Date.now() - this.state.modeEntryTime.getTime();
    if (timeInCurrentMode < this.minDuration) {
      return false;
    }
    
    // Check confidence threshold
    const threshold = this.getConfidenceThreshold(currentMode, analysis.mode);
    if (analysis.confidence < threshold) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Get confidence threshold for a mode transition
   */
  private getConfidenceThreshold(from: ModeType, to: ModeType): number {
    // Check for specific transition
    const transitionKey = `${from}->${to}`;
    if (transitionKey in CONFIDENCE_THRESHOLDS) {
      return CONFIDENCE_THRESHOLDS[transitionKey];
    }
    
    // Check for any->mode pattern
    const anyToKey = `any->${to}`;
    if (anyToKey in CONFIDENCE_THRESHOLDS) {
      return CONFIDENCE_THRESHOLDS[anyToKey];
    }
    
    // Use default threshold
    return CONFIDENCE_THRESHOLDS['default'];
  }
  
  /**
   * Switch to a new mode
   */
  switchMode(
    newMode: ModeType,
    trigger: 'auto' | 'manual' | 'tool' | 'explicit',
    confidence: number = 0
  ): void {
    // Check if focus mode blocks this switch (except for explicit focus mode commands)
    if (trigger !== 'explicit') {
      const focusCheck = this.focusModeManager.shouldBlockModeSwitch(newMode);
      if (focusCheck.blocked) {
        // Emit blocked event so UI can show message
        this.emit('mode-switch-blocked', {
          targetMode: newMode,
          reason: focusCheck.reason
        });
        return;
      }
    }
    
    const oldMode = this.state.currentMode;
    
    // Create transition record
    const transition: ModeTransition = {
      from: oldMode,
      to: newMode,
      timestamp: new Date(),
      trigger,
      confidence
    };
    
    // Create and start animation
    const animation = this.animator.createAnimation(transition);
    this.animator.startAnimation(animation.id);
    
    // Emit animation-started event for UI
    this.emit('mode-animation-started', animation);
    
    // Update state
    this.state.previousMode = oldMode;
    this.state.currentMode = newMode;
    this.state.lastSwitchTime = new Date();
    this.state.modeEntryTime = new Date();
    
    this.addToHistory(transition);
    
    // Track metrics for this transition (if metrics enabled)
    this.metricsTracker?.trackModeTransition(transition);
    
    // Persist metrics to disk after transition (if metrics enabled)
    if (this.metricsTracker) {
      this.debouncedPersistMetrics();
    }
    
    // Emit mode-changed event
    this.emit('mode-changed', transition);
    
    // Complete animation after a short delay
    setTimeout(() => {
      this.animator.completeAnimation(animation.id);
      this.emit('mode-animation-completed', animation);
    }, animation.duration);
  }
  
  /**
   * Add transition to history
   */
  private addToHistory(transition: ModeTransition): void {
    this.modeHistory.push(transition);
    
    // Keep only last 100 transitions
    if (this.modeHistory.length > this.maxHistorySize) {
      // Remove excess items from the beginning
      const excess = this.modeHistory.length - this.maxHistorySize;
      this.modeHistory.splice(0, excess);
    }
  }
  
  /**
   * Get mode history
   */
  getModeHistory(): ModeTransition[] {
    return [...this.modeHistory];
  }
  
  /**
   * Get recent mode history (last N transitions)
   */
  getRecentHistory(count: number = 10): ModeTransition[] {
    return this.modeHistory.slice(-count);
  }
  
  /**
   * Build prompt for current mode
   *
   * Deprecated: system prompts are handled by ContextManager and tiered prompt files.
   */
  buildPrompt(_options: PromptBuildOptions): string {
    return '';
  }
  
  /**
   * Get allowed tools for a specific mode
   */
  getAllowedTools(mode: ModeType): string[] {
    const toolAccess: Record<ModeType, string[]> = {
      assistant: [],
      planning: [
        'web_search', 'web_fetch',
        'read_file', 'read_multiple_files',
        'grep_search', 'file_search', 'list_directory',
        'get_diagnostics', 'write_memory_dump',
        'trigger_hot_swap',
        'mcp:*'
      ],
      developer: ['*'],
      debugger: [
        'read_file', 'grep_search', 'list_directory',
        'get_diagnostics', 'shell',
        'git_diff', 'git_log',
        'web_search',
        'write_file', 'str_replace',
        'write_memory_dump',
        'trigger_hot_swap',
        'mcp:*'
      ]
    };
    
    return toolAccess[mode] || [];
  }

  /**
   * Check if a tool is allowed in a specific mode
   */
  isToolAllowed(toolName: string, mode: ModeType): boolean {
    const allowedTools = this.getAllowedTools(mode);
    
    // If mode allows all tools (*)
    if (allowedTools.includes('*')) {
      return true;
    }
    
    // Check exact match
    if (allowedTools.includes(toolName)) {
      return true;
    }
    
    // Check for MCP tool permission
    if (allowedTools.includes('mcp:*') && toolName.includes(':')) {
      return true;
    }
    
    // Check wildcard patterns (e.g., 'git_*')
    return allowedTools.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return toolName.startsWith(prefix);
      }
      return false;
    });
  }

  /**
   * Filter tools for a specific mode based on allowed tools
   */
  filterToolsForMode(tools: Array<{ name: string }>, mode: ModeType): Array<{ name: string }> {
    return tools.filter(tool => this.isToolAllowed(tool.name, mode));
  }

  /**
   * Get preferred temperature for a mode based on tiered architecture
   */
  getPreferredTemperature(mode: ModeType): number {
    const technicalModes: ModeType[] = ['developer', 'debugger'];
    const standardModes: ModeType[] = ['planning'];
    const creativeModes: ModeType[] = ['assistant'];

    if (technicalModes.includes(mode)) return 0.1;
    if (standardModes.includes(mode)) return 0.3;
    if (creativeModes.includes(mode)) return 0.5;
    
    return 0.3; // Default
  }
  
  /**
   * Get denied tools for a mode
   */
  getDeniedTools(mode: ModeType): string[] {
    const deniedTools: Record<ModeType, string[]> = {
      assistant: ['*'],
      
      planning: [
        'write_file', 'fs_append', 'str_replace', 'delete_file',
        'execute_pwsh', 'control_pwsh_process',
        'git_*'
      ],
      
      developer: [],
      
      debugger: ['delete_file', 'git_commit']
    };
    
    return deniedTools[mode] || [];
  }
  
  /**
   * Validate if a file path is allowed for writing in planning mode
   * @param filePath - The file path to validate
   * @param toolName - The tool attempting to write (for error messages)
   * @returns Object with allowed status and error message if denied
   */
  validateFilePathForPlanningMode(filePath: string, _toolName: string): {
    allowed: boolean;
    errorMessage?: string;
  } {
    // Only validate for planning mode
    if (this.state.currentMode !== 'planning') {
      return { allowed: true };
    }
    
    // Import the validation functions dynamically
    // Note: This is synchronous validation, so we use a simple check
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = ['md', 'txt', 'json', 'plan'];
    const allowedPaths = ['.kiro/', '.gemini/', 'docs/', 'plans/'];
    
    const isAllowedExtension = allowedExtensions.includes(extension);
    const isAllowedPath = allowedPaths.some(p => filePath.includes(p));
    
    if (!isAllowedExtension && !isAllowedPath) {
      return { 
        allowed: false, 
        errorMessage: `Planning mode restricts file writes. File "${filePath}" is not in an allowed location.` 
      };
    }
    
    return { allowed: true };
  }
  
  /**
   * Check if a tool with file path arguments should be allowed in planning mode
   * This is called before tool execution to validate file paths
   * @param toolName - The tool name
   * @param args - The tool arguments
   * @returns Object with allowed status and error message if denied
   */
  validateToolArgsForPlanningMode(toolName: string, args: Record<string, unknown>): {
    allowed: boolean;
    errorMessage?: string;
  } {
    // Only validate for planning mode
    if (this.state.currentMode !== 'planning') {
      return { allowed: true };
    }
    
    // Tools that write files and need validation
    const writeTools = ['write_file', 'fs_append', 'fsWrite', 'fsAppend'];
    
    if (!writeTools.includes(toolName)) {
      return { allowed: true };
    }
    
    // Extract file path from arguments
    let filePath: string | undefined;
    
    if (typeof args === 'object' && args !== null) {
      // Try common argument names with explicit casting
      filePath = (args.path as string | undefined) || 
                 (args.filePath as string | undefined) || 
                 (args.file as string | undefined) || 
                 (args.targetFile as string | undefined);
    }
    
    if (!filePath) {
      // Can't validate without a file path, allow it
      return { allowed: true };
    }
    
    return this.validateFilePathForPlanningMode(filePath, toolName);
  }
  
  /**
   * Get mode history in a serializable format for session persistence
   */
  getSerializableModeHistory(): Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }> {
    return this.modeHistory.map(transition => ({
      from: transition.from,
      to: transition.to,
      timestamp: transition.timestamp.toISOString(),
      trigger: transition.trigger,
      confidence: transition.confidence
    }));
  }
  
  /**
   * Restore mode history from serialized format (when resuming a session)
   */
  restoreModeHistory(history: Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: 'auto' | 'manual' | 'tool' | 'explicit';
    confidence: number;
  }>): void {
    this.modeHistory = history.map(transition => ({
      from: transition.from as ModeType,
      to: transition.to as ModeType,
      timestamp: new Date(transition.timestamp),
      trigger: transition.trigger,
      confidence: transition.confidence
    }));
    
    // Restore current mode from last transition if available
    if (this.modeHistory.length > 0) {
      const lastTransition = this.modeHistory[this.modeHistory.length - 1];
      this.state.currentMode = lastTransition.to;
      this.state.previousMode = lastTransition.from;
    }
  }
  
  /**
   * Register mode change listener
   */
  onModeChange(callback: (transition: ModeTransition) => void): void {
    this.on('mode-changed', callback);
  }
  
  /**
   * Remove mode change listener
   */
  offModeChange(callback: (transition: ModeTransition) => void): void {
    this.off('mode-changed', callback);
  }
}
