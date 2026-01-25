import { createLogger } from '../utils/logger.js';

const logger = createLogger('ModeMetricsTracker');
/**
 * Mode Metrics Tracker for Dynamic Prompt System
 * 
 * Tracks mode usage, transitions, and mode-specific events for analytics and insights.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

import type { ModeType } from './ContextAnalyzer.js';
import type { ModeTransition } from './PromptModeManager.js';

/**
 * Time spent in a mode during a session
 */
export interface ModeTimeMetrics {
  mode: ModeType;
  totalDuration: number;      // Total milliseconds in this mode
  entryCount: number;          // Number of times entered
  averageDuration: number;     // Average time per entry
  lastEntry: Date | null;      // Last time this mode was entered
  lastExit: Date | null;       // Last time this mode was exited
}

/**
 * Mode transition metrics
 */
export interface ModeTransitionMetrics {
  from: ModeType;
  to: ModeType;
  count: number;               // Number of times this transition occurred
  averageConfidence: number;   // Average confidence score for this transition
  triggers: {
    auto: number;              // Auto-triggered transitions
    manual: number;            // Manual transitions
    tool: number;              // Tool-triggered transitions
    explicit: number;          // Explicit request transitions
  };
}

/**
 * Debugger mode specific metrics
 */
export interface DebuggerModeMetrics {
  errorsAnalyzed: number;      // Number of errors analyzed
  bugsFound: number;           // Number of bugs identified
  fixesApplied: number;        // Number of fixes implemented
  successRate: number;         // Percentage of successful fixes
  averageTimeToFix: number;    // Average time from entry to fix (ms)
  commonErrorTypes: Map<string, number>;  // Error type frequency
}

/**
 * Planning mode specific metrics
 */
export interface PlanningModeMetrics {
  plansCreated: number;        // Number of plans created
  researchQueriesRun: number;  // Number of web searches performed
  filesAnalyzed: number;       // Number of files read/analyzed
  designsCreated: number;      // Number of design documents created
  architectureDiagrams: number; // Number of architecture diagrams
  averagePlanningTime: number; // Average time in planning mode (ms)
}

/**
 * Developer mode specific metrics
 */
export interface DeveloperModeMetrics {
  filesCreated: number;        // Number of files created
  filesModified: number;       // Number of files modified
  filesDeleted: number;        // Number of files deleted
  linesAdded: number;          // Total lines of code added
  linesRemoved: number;        // Total lines of code removed
  testsWritten: number;        // Number of tests written
  commitsCreated: number;      // Number of git commits
  refactoringsPerformed: number; // Number of refactoring operations
}

/**
 * Tool execution metrics
 */
export interface ToolModeMetrics {
  toolsExecuted: number;       // Number of tools executed
  successfulExecutions: number; // Number of successful tool executions
  failedExecutions: number;    // Number of failed tool executions
  averageExecutionTime: number; // Average tool execution time (ms)
  mostUsedTools: Map<string, number>; // Tool usage frequency
}

/**
 * Aggregated metrics for all modes
 */
export interface AggregatedMetrics {
  // Time metrics for each mode
  timeMetrics: Map<ModeType, ModeTimeMetrics>;
  
  // Transition metrics
  transitionMetrics: Map<string, ModeTransitionMetrics>;
  
  // Mode-specific metrics
  debuggerMetrics: DebuggerModeMetrics;
  planningMetrics: PlanningModeMetrics;
  developerMetrics: DeveloperModeMetrics;
  toolMetrics: ToolModeMetrics;
  
  // Session-level metrics
  sessionStart: Date;
  sessionDuration: number;     // Total session duration (ms)
  totalTransitions: number;    // Total number of mode transitions
  mostUsedMode: ModeType | null; // Mode with most time spent
  leastUsedMode: ModeType | null; // Mode with least time spent
}

/**
 * Mode-specific event types
 */
export type ModeEvent = 
  // Debugger events
  | { type: 'debugger:error-analyzed'; errorType: string }
  | { type: 'debugger:bug-found'; severity: 'critical' | 'high' | 'medium' | 'low' }
  | { type: 'debugger:fix-applied'; success: boolean; timeToFix: number }
  
  // Planning events
  | { type: 'planning:plan-created'; planType: string }
  | { type: 'planning:research-query'; query: string }
  | { type: 'planning:file-analyzed'; filePath: string }
  | { type: 'planning:design-created'; designType: string }
  | { type: 'planning:architecture-diagram'; diagramType: string }
  
  // Developer events
  | { type: 'developer:file-created'; filePath: string }
  | { type: 'developer:file-modified'; filePath: string; linesAdded: number; linesRemoved: number }
  | { type: 'developer:file-deleted'; filePath: string }
  | { type: 'developer:test-written'; testType: string }
  | { type: 'developer:commit-created'; message: string }
  | { type: 'developer:refactoring-performed'; refactoringType: string }
  
  // Tool events
  | { type: 'tool:tool-executed'; toolName: string; success: boolean; executionTime: number };

/**
 * Serializable metrics format for persistence
 */
export interface SerializableMetrics {
  timeMetrics: Array<[ModeType, ModeTimeMetrics]>;
  transitionMetrics: Array<[string, ModeTransitionMetrics]>;
  debuggerMetrics: Omit<DebuggerModeMetrics, 'commonErrorTypes'> & { commonErrorTypes: Array<[string, number]> };
  planningMetrics: PlanningModeMetrics;
  developerMetrics: DeveloperModeMetrics;
  toolMetrics: Omit<ToolModeMetrics, 'mostUsedTools'> & { mostUsedTools: Array<[string, number]> };
  sessionStart: string;
  sessionDuration: number;
  totalTransitions: number;
  mostUsedMode: ModeType | null;
  leastUsedMode: ModeType | null;
}

/**
 * Mode Metrics Tracker
 * 
 * Tracks and aggregates metrics for mode usage and mode-specific events.
 */
export class ModeMetricsTracker {
  private metrics: AggregatedMetrics;
  private currentModeEntry: Date | null = null;
  private currentMode: ModeType | null = null;
  
  constructor() {
    this.metrics = this.initializeMetrics();
  }
  
  /**
   * Initialize empty metrics structure
   */
  private initializeMetrics(): AggregatedMetrics {
    return {
      timeMetrics: new Map(),
      transitionMetrics: new Map(),
      debuggerMetrics: this.initializeDebuggerMetrics(),
      planningMetrics: this.initializePlanningMetrics(),
      developerMetrics: this.initializeDeveloperMetrics(),
      toolMetrics: this.initializeToolMetrics(),
      sessionStart: new Date(),
      sessionDuration: 0,
      totalTransitions: 0,
      mostUsedMode: null,
      leastUsedMode: null
    };
  }
  
  private initializeDebuggerMetrics(): DebuggerModeMetrics {
    return {
      errorsAnalyzed: 0,
      bugsFound: 0,
      fixesApplied: 0,
      successRate: 0,
      averageTimeToFix: 0,
      commonErrorTypes: new Map()
    };
  }
  
  private initializePlanningMetrics(): PlanningModeMetrics {
    return {
      plansCreated: 0,
      researchQueriesRun: 0,
      filesAnalyzed: 0,
      designsCreated: 0,
      architectureDiagrams: 0,
      averagePlanningTime: 0
    };
  }
  
  private initializeDeveloperMetrics(): DeveloperModeMetrics {
    return {
      filesCreated: 0,
      filesModified: 0,
      filesDeleted: 0,
      linesAdded: 0,
      linesRemoved: 0,
      testsWritten: 0,
      commitsCreated: 0,
      refactoringsPerformed: 0
    };
  }
  
  private initializeToolMetrics(): ToolModeMetrics {
    return {
      toolsExecuted: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      mostUsedTools: new Map()
    };
  }
  
  /**
   * Track mode entry event
   * Called when entering a new mode
   */
  trackModeEntry(mode: ModeType, timestamp: Date = new Date()): void {
    // If there's a current mode, track its exit first
    if (this.currentMode !== null && this.currentModeEntry !== null) {
      this.trackModeExit(this.currentMode, timestamp);
    }
    
    // Set new current mode
    this.currentMode = mode;
    this.currentModeEntry = timestamp;
    
    // Initialize time metrics for this mode if not exists
    if (!this.metrics.timeMetrics.has(mode)) {
      this.metrics.timeMetrics.set(mode, {
        mode,
        totalDuration: 0,
        entryCount: 0,
        averageDuration: 0,
        lastEntry: null,
        lastExit: null
      });
    }
    
    // Update entry count and last entry time
    const timeMetrics = this.metrics.timeMetrics.get(mode)!;
    timeMetrics.entryCount++;
    timeMetrics.lastEntry = timestamp;
  }
  
  /**
   * Track mode exit event
   * Called when exiting a mode
   */
  trackModeExit(mode: ModeType, timestamp: Date = new Date()): void {
    // Only track exit if this is the current mode and we have an entry time
    if (this.currentMode !== mode || this.currentModeEntry === null) {
      return;
    }
    
    // Calculate duration
    const duration = timestamp.getTime() - this.currentModeEntry.getTime();
    
    // Update time metrics
    const timeMetrics = this.metrics.timeMetrics.get(mode);
    if (timeMetrics) {
      timeMetrics.totalDuration += duration;
      timeMetrics.lastExit = timestamp;
      
      // Recalculate average duration
      if (timeMetrics.entryCount > 0) {
        timeMetrics.averageDuration = timeMetrics.totalDuration / timeMetrics.entryCount;
      }
    }
    
    // Clear current mode tracking
    this.currentMode = null;
    this.currentModeEntry = null;
  }
  
  /**
   * Track mode transition
   * Called when switching from one mode to another
   */
  trackModeTransition(transition: ModeTransition): void {
    const { from, to, trigger, confidence, timestamp } = transition;
    
    // Track exit from old mode and entry to new mode
    this.trackModeExit(from, timestamp);
    this.trackModeEntry(to, timestamp);
    
    // Update transition metrics
    const transitionKey = `${from}->${to}`;
    
    if (!this.metrics.transitionMetrics.has(transitionKey)) {
      this.metrics.transitionMetrics.set(transitionKey, {
        from,
        to,
        count: 0,
        averageConfidence: 0,
        triggers: {
          auto: 0,
          manual: 0,
          tool: 0,
          explicit: 0
        }
      });
    }
    
    const transitionMetrics = this.metrics.transitionMetrics.get(transitionKey)!;
    transitionMetrics.count++;
    
    // Update average confidence (running average)
    const totalConfidence = transitionMetrics.averageConfidence * (transitionMetrics.count - 1) + confidence;
    transitionMetrics.averageConfidence = totalConfidence / transitionMetrics.count;
    
    // Update trigger counts
    transitionMetrics.triggers[trigger]++;
    
    // Update total transitions
    this.metrics.totalTransitions++;
  }
  
  /**
   * Track mode-specific event
   * Called when a mode-specific event occurs (e.g., bug found, fix applied)
   */
  trackEvent(event: ModeEvent): void {
    switch (event.type) {
      // Debugger events
      case 'debugger:error-analyzed':
        this.metrics.debuggerMetrics.errorsAnalyzed++;
        this.incrementMapCounter(this.metrics.debuggerMetrics.commonErrorTypes, event.errorType);
        break;
      
      case 'debugger:bug-found':
        this.metrics.debuggerMetrics.bugsFound++;
        break;
      
      case 'debugger:fix-applied': {
        this.metrics.debuggerMetrics.fixesApplied++;
        
        // Update average time to fix (for all fixes, successful or not)
        const totalTime = this.metrics.debuggerMetrics.averageTimeToFix * (this.metrics.debuggerMetrics.fixesApplied - 1);
        this.metrics.debuggerMetrics.averageTimeToFix = (totalTime + event.timeToFix) / this.metrics.debuggerMetrics.fixesApplied;
        
        // Update success rate
        if (event.success) {
          this.metrics.debuggerMetrics.successRate = 
            (this.metrics.debuggerMetrics.successRate * (this.metrics.debuggerMetrics.fixesApplied - 1) + 100) / 
            this.metrics.debuggerMetrics.fixesApplied;
        } else {
          this.metrics.debuggerMetrics.successRate = 
            (this.metrics.debuggerMetrics.successRate * (this.metrics.debuggerMetrics.fixesApplied - 1)) / 
            this.metrics.debuggerMetrics.fixesApplied;
        }
        break;
      }
      
      // Planning events
      case 'planning:plan-created':
        this.metrics.planningMetrics.plansCreated++;
        break;
      
      case 'planning:research-query':
        this.metrics.planningMetrics.researchQueriesRun++;
        break;
      
      case 'planning:file-analyzed':
        this.metrics.planningMetrics.filesAnalyzed++;
        break;
      
      case 'planning:design-created':
        this.metrics.planningMetrics.designsCreated++;
        break;
      
      case 'planning:architecture-diagram':
        this.metrics.planningMetrics.architectureDiagrams++;
        break;
      
      // Developer events
      case 'developer:file-created':
        this.metrics.developerMetrics.filesCreated++;
        break;
      
      case 'developer:file-modified':
        this.metrics.developerMetrics.filesModified++;
        this.metrics.developerMetrics.linesAdded += event.linesAdded;
        this.metrics.developerMetrics.linesRemoved += event.linesRemoved;
        break;
      
      case 'developer:file-deleted':
        this.metrics.developerMetrics.filesDeleted++;
        break;
      
      case 'developer:test-written':
        this.metrics.developerMetrics.testsWritten++;
        break;
      
      case 'developer:commit-created':
        this.metrics.developerMetrics.commitsCreated++;
        break;
      
      case 'developer:refactoring-performed':
        this.metrics.developerMetrics.refactoringsPerformed++;
        break;
      
      // Tool events
      case 'tool:tool-executed': {
        this.metrics.toolMetrics.toolsExecuted++;
        this.incrementMapCounter(this.metrics.toolMetrics.mostUsedTools, event.toolName);
        
        if (event.success) {
          this.metrics.toolMetrics.successfulExecutions++;
        } else {
          this.metrics.toolMetrics.failedExecutions++;
        }
        
        // Update average execution time
        const totalExecutionTime = this.metrics.toolMetrics.averageExecutionTime * (this.metrics.toolMetrics.toolsExecuted - 1);
        this.metrics.toolMetrics.averageExecutionTime = (totalExecutionTime + event.executionTime) / this.metrics.toolMetrics.toolsExecuted;
        break;
      }
    }
  }
  
  /**
   * Helper method to increment a counter in a Map
   */
  private incrementMapCounter(map: Map<string, number>, key: string): void {
    const currentCount = map.get(key) || 0;
    map.set(key, currentCount + 1);
  }
  
  /**
   * Get all metrics
   */
  getMetrics(): AggregatedMetrics {
    // If there's a current mode, calculate its current duration
    if (this.currentMode !== null && this.currentModeEntry !== null) {
      const now = Date.now();
      const entryTime = this.currentModeEntry.getTime();
      
      // Only include current duration if entry time is not in the future
      if (entryTime <= now) {
        const currentDuration = now - entryTime;
        const timeMetrics = this.metrics.timeMetrics.get(this.currentMode);
        if (timeMetrics) {
          // Temporarily add current duration for accurate reporting
          // (without modifying the stored value)
          const tempMetrics = { ...this.metrics };
          const tempTimeMetrics = new Map(this.metrics.timeMetrics);
          const tempModeMetrics = { ...timeMetrics };
          tempModeMetrics.totalDuration += currentDuration;
          if (tempModeMetrics.entryCount > 0) {
            tempModeMetrics.averageDuration = tempModeMetrics.totalDuration / tempModeMetrics.entryCount;
          }
          tempTimeMetrics.set(this.currentMode, tempModeMetrics);
          tempMetrics.timeMetrics = tempTimeMetrics;
          
          // Update session duration
          tempMetrics.sessionDuration = now - this.metrics.sessionStart.getTime();
          
          // Update most/least used modes with temp metrics
          this.updateMostLeastUsedModesForMetrics(tempMetrics);
          
          return tempMetrics;
        }
      }
    }
    
    // Update session duration
    this.metrics.sessionDuration = Date.now() - this.metrics.sessionStart.getTime();
    
    // Update most/least used modes
    this.updateMostLeastUsedModes();
    
    return this.metrics;
  }
  
  /**
   * Update most and least used modes based on time metrics
   */
  private updateMostLeastUsedModes(): void {
    this.updateMostLeastUsedModesForMetrics(this.metrics);
  }
  
  /**
   * Update most and least used modes for given metrics
   */
  private updateMostLeastUsedModesForMetrics(metrics: AggregatedMetrics): void {
    if (metrics.timeMetrics.size === 0) {
      metrics.mostUsedMode = null;
      metrics.leastUsedMode = null;
      return;
    }
    
    let maxDuration = 0;
    let minDuration = Infinity;
    let mostUsed: ModeType | null = null;
    let leastUsed: ModeType | null = null;
    
    for (const [mode, timeMetrics] of metrics.timeMetrics.entries()) {
      if (timeMetrics.totalDuration > maxDuration) {
        maxDuration = timeMetrics.totalDuration;
        mostUsed = mode;
      }
      if (timeMetrics.totalDuration < minDuration && timeMetrics.totalDuration > 0) {
        minDuration = timeMetrics.totalDuration;
        leastUsed = mode;
      }
    }
    
    metrics.mostUsedMode = mostUsed;
    metrics.leastUsedMode = leastUsed;
  }
  
  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.currentModeEntry = null;
    this.currentMode = null;
  }
  
  /**
   * Serialize metrics for persistence
   */
  serializeMetrics(): SerializableMetrics {
    return {
      timeMetrics: Array.from(this.metrics.timeMetrics.entries()).map(([mode, metrics]) => [
        mode,
        {
          ...metrics,
          lastEntry: metrics.lastEntry,
          lastExit: metrics.lastExit
        }
      ]),
      transitionMetrics: Array.from(this.metrics.transitionMetrics.entries()),
      debuggerMetrics: {
        ...this.metrics.debuggerMetrics,
        commonErrorTypes: Array.from(this.metrics.debuggerMetrics.commonErrorTypes.entries())
      },
      planningMetrics: this.metrics.planningMetrics,
      developerMetrics: this.metrics.developerMetrics,
      toolMetrics: {
        ...this.metrics.toolMetrics,
        mostUsedTools: Array.from(this.metrics.toolMetrics.mostUsedTools.entries())
      },
      sessionStart: this.metrics.sessionStart.toISOString(),
      sessionDuration: this.metrics.sessionDuration,
      totalTransitions: this.metrics.totalTransitions,
      mostUsedMode: this.metrics.mostUsedMode,
      leastUsedMode: this.metrics.leastUsedMode
    };
  }
  
  /**
   * Deserialize metrics from persistence
   */
  deserializeMetrics(serialized: SerializableMetrics): void {
    this.metrics = {
      timeMetrics: new Map(serialized.timeMetrics),
      transitionMetrics: new Map(serialized.transitionMetrics),
      debuggerMetrics: {
        ...serialized.debuggerMetrics,
        commonErrorTypes: new Map(serialized.debuggerMetrics.commonErrorTypes)
      },
      planningMetrics: serialized.planningMetrics,
      developerMetrics: serialized.developerMetrics,
      toolMetrics: {
        ...serialized.toolMetrics,
        mostUsedTools: new Map(serialized.toolMetrics.mostUsedTools)
      },
      sessionStart: new Date(serialized.sessionStart),
      sessionDuration: serialized.sessionDuration,
      totalTransitions: serialized.totalTransitions,
      mostUsedMode: serialized.mostUsedMode,
      leastUsedMode: serialized.leastUsedMode
    };
  }
  
  /**
   * Get aggregated time metrics summary
   * Returns total time spent across all modes and percentage breakdown
   */
  getTimeMetricsSummary(): {
    totalTime: number;
    modeBreakdown: Array<{
      mode: ModeType;
      duration: number;
      percentage: number;
      entryCount: number;
    }>;
  } {
    const metrics = this.getMetrics();
    let totalTime = 0;
    
    // Calculate total time across all modes
    for (const timeMetrics of metrics.timeMetrics.values()) {
      totalTime += timeMetrics.totalDuration;
    }
    
    // Build breakdown with percentages
    const modeBreakdown = Array.from(metrics.timeMetrics.entries())
      .map(([mode, timeMetrics]) => ({
        mode,
        duration: timeMetrics.totalDuration,
        percentage: totalTime > 0 ? (timeMetrics.totalDuration / totalTime) * 100 : 0,
        entryCount: timeMetrics.entryCount
      }))
      .sort((a, b) => b.duration - a.duration); // Sort by duration descending
    
    return {
      totalTime,
      modeBreakdown
    };
  }
  
  /**
   * Get most common mode transitions
   * Returns top N transitions by count
   */
  getMostCommonTransitions(limit: number = 5): Array<{
    from: ModeType;
    to: ModeType;
    count: number;
    averageConfidence: number;
  }> {
    const metrics = this.getMetrics();
    
    return Array.from(metrics.transitionMetrics.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ from, to, count, averageConfidence }) => ({
        from,
        to,
        count,
        averageConfidence
      }));
  }
  
  /**
   * Get mode-specific metrics summary for a given mode
   * Returns relevant metrics based on the mode type
   */
  getModeSpecificSummary(mode: ModeType): Record<string, number | string> {
    const metrics = this.getMetrics();
    
    switch (mode) {
      case 'debugger':
        return {
          errorsAnalyzed: metrics.debuggerMetrics.errorsAnalyzed,
          bugsFound: metrics.debuggerMetrics.bugsFound,
          fixesApplied: metrics.debuggerMetrics.fixesApplied,
          successRate: `${metrics.debuggerMetrics.successRate.toFixed(1)}%`,
          averageTimeToFix: `${(metrics.debuggerMetrics.averageTimeToFix / 1000).toFixed(1)}s`
        };
      
      case 'planning':
        return {
          plansCreated: metrics.planningMetrics.plansCreated,
          researchQueriesRun: metrics.planningMetrics.researchQueriesRun,
          filesAnalyzed: metrics.planningMetrics.filesAnalyzed,
          designsCreated: metrics.planningMetrics.designsCreated,
          architectureDiagrams: metrics.planningMetrics.architectureDiagrams
        };
      
      case 'developer':
        return {
          filesCreated: metrics.developerMetrics.filesCreated,
          filesModified: metrics.developerMetrics.filesModified,
          filesDeleted: metrics.developerMetrics.filesDeleted,
          linesAdded: metrics.developerMetrics.linesAdded,
          linesRemoved: metrics.developerMetrics.linesRemoved,
          testsWritten: metrics.developerMetrics.testsWritten,
          commitsCreated: metrics.developerMetrics.commitsCreated
        };

      default:
        return {};
    }
  }
  
  /**
   * Get top items from a frequency map
   * Useful for getting most common errors, tools, etc.
   */
  getTopFrequencies(map: Map<string, number>, limit: number = 5): Array<{ item: string; count: number }> {
    return Array.from(map.entries())
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  
  /**
   * Get overall productivity metrics
   * Aggregates metrics across all modes to show overall productivity
   */
  getProductivitySummary(): {
    totalFiles: number;
    totalLines: number;
    totalTests: number;
    totalCommits: number;
    totalBugsFixed: number;
  } {
    const metrics = this.getMetrics();
    
    return {
      totalFiles: 
        metrics.developerMetrics.filesCreated + 
        metrics.developerMetrics.filesModified + 
        metrics.developerMetrics.filesDeleted,
      totalLines: 
        metrics.developerMetrics.linesAdded + 
        metrics.developerMetrics.linesRemoved,
      totalTests: metrics.developerMetrics.testsWritten,
      totalCommits: metrics.developerMetrics.commitsCreated,
      totalBugsFixed: metrics.debuggerMetrics.fixesApplied
    };
  }
  
  /**
   * Get session summary with key highlights
   * Returns a human-readable summary of the session
   */
  getSessionSummary(): {
    duration: string;
    modesUsed: number;
    totalTransitions: number;
    mostUsedMode: ModeType | null;
    productivity: {
      filesChanged: number;
      linesChanged: number;
      bugsFixed: number;
    };
  } {
    const metrics = this.getMetrics();
    const productivity = this.getProductivitySummary();
    
    // Format duration as human-readable string
    const durationMs = metrics.sessionDuration;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
    
    let durationStr = '';
    if (hours > 0) durationStr += `${hours}h `;
    if (minutes > 0) durationStr += `${minutes}m `;
    durationStr += `${seconds}s`;
    
    return {
      duration: durationStr.trim(),
      modesUsed: metrics.timeMetrics.size,
      totalTransitions: metrics.totalTransitions,
      mostUsedMode: metrics.mostUsedMode,
      productivity: {
        filesChanged: productivity.totalFiles,
        linesChanged: productivity.totalLines,
        bugsFixed: productivity.totalBugsFixed
      }
    };
  }
  
  /**
   * Save metrics to disk
   * Persists current metrics to ~/.ollm/metrics/mode-metrics.json
   */
  saveMetricsToDisk(): void {
    try {
      const homeDir = homedir();
      const metricsDir = join(homeDir, '.ollm', 'metrics');
      const metricsPath = join(metricsDir, 'mode-metrics.json');
      
      // Ensure metrics directory exists
      if (!existsSync(metricsDir)) {
        mkdirSync(metricsDir, { recursive: true });
      }
      
      // Serialize and save metrics
      const serialized = this.serializeMetrics();
      writeFileSync(metricsPath, JSON.stringify(serialized, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save mode metrics to disk:', error);
    }
  }
  
  /**
   * Load metrics from disk
   * Loads persisted metrics from ~/.ollm/metrics/mode-metrics.json
   * 
   * @returns true if metrics were loaded successfully, false otherwise
   */
  loadMetricsFromDisk(): boolean {
    try {
      const homeDir = homedir();
      const metricsPath = join(homeDir, '.ollm', 'metrics', 'mode-metrics.json');
      
      if (!existsSync(metricsPath)) {
        return false;
      }
      
      const content = readFileSync(metricsPath, 'utf-8');
      const serialized = JSON.parse(content) as SerializableMetrics;
      
      this.deserializeMetrics(serialized);
      return true;
    } catch (error) {
      logger.error('Failed to load mode metrics from disk:', error);
      return false;
    }
  }
  
  /**
   * Clear persisted metrics from disk
   * Deletes the metrics file from ~/.ollm/metrics/mode-metrics.json
   */
  clearPersistedMetrics(): void {
    try {
      const homeDir = homedir();
      const metricsPath = join(homeDir, '.ollm', 'metrics', 'mode-metrics.json');
      
      if (existsSync(metricsPath)) {
        unlinkSync(metricsPath);
      }
    } catch (error) {
      logger.error('Failed to clear persisted metrics:', error);
    }
  }
}
