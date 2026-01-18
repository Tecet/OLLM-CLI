/**
 * Prompt Mode Manager for Dynamic Prompt System
 * 
 * Orchestrates mode transitions, builds prompts, filters tools, and maintains mode history.
 * Implements hysteresis and cooldown to prevent rapid mode switching.
 */

import { EventEmitter } from 'events';
import type { ContextAnalyzer, ContextAnalysis, ModeType } from './ContextAnalyzer.js';
import type { PromptRegistry } from './PromptRegistry.js';
import type { SystemPromptBuilder } from '../context/SystemPromptBuilder.js';

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
  
  // Specialized modes (high confidence required)
  'any->debugger': 0.85,
  'any->security': 0.85,
  'any->reviewer': 0.80,
  'any->performance': 0.80,
  
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
  
  // Timing configuration
  private readonly minDuration = 30000;  // 30 seconds
  private readonly cooldownPeriod = 10000;  // 10 seconds
  
  constructor(
    private promptBuilder: SystemPromptBuilder,
    private promptRegistry: PromptRegistry,
    private contextAnalyzer: ContextAnalyzer
  ) {
    super();
    
    // Initialize state
    this.state = {
      currentMode: 'assistant',
      previousMode: null,
      autoSwitchEnabled: true,
      lastSwitchTime: new Date(),
      modeEntryTime: new Date(),
      activeSkills: []
    };
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
  }
  
  /**
   * Get active skills
   */
  getActiveSkills(): string[] {
    return this.state.activeSkills;
  }
  
  /**
   * Check if mode should switch based on analysis
   * 
   * Implements hysteresis and cooldown logic.
   */
  shouldSwitchMode(currentMode: ModeType, analysis: ContextAnalysis): boolean {
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
    
    // Check hysteresis (30s minimum duration in current mode)
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
    const oldMode = this.state.currentMode;
    
    // Update state
    this.state.previousMode = oldMode;
    this.state.currentMode = newMode;
    this.state.lastSwitchTime = new Date();
    this.state.modeEntryTime = new Date();
    
    // Record transition
    const transition: ModeTransition = {
      from: oldMode,
      to: newMode,
      timestamp: new Date(),
      trigger,
      confidence
    };
    
    this.addToHistory(transition);
    
    // Emit mode-changed event
    this.emit('mode-changed', transition);
  }
  
  /**
   * Add transition to history
   */
  private addToHistory(transition: ModeTransition): void {
    this.modeHistory.push(transition);
    
    // Keep only last 100 transitions
    if (this.modeHistory.length > this.maxHistorySize) {
      this.modeHistory.shift();
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
   */
  buildPrompt(options: PromptBuildOptions): string {
    const { mode, skills = [], tools, workspace, additionalInstructions } = options;
    
    // Get mode template
    const modeTemplate = this.getModeTemplate(mode);
    
    // Build sections
    const sections: string[] = [];
    
    // 1. Mode persona and template
    sections.push(modeTemplate);
    
    // 2. Active skills
    if (skills.length > 0) {
      const skillsContent: string[] = [];
      for (const skillId of skills) {
        const skill = this.promptRegistry.get(skillId);
        if (skill) {
          skillsContent.push(skill.content);
        }
      }
      if (skillsContent.length > 0) {
        sections.push('# Active Skills\n' + skillsContent.join('\n\n'));
      }
    }
    
    // 3. Workspace context
    if (workspace) {
      sections.push(`# Workspace Context\nPath: ${workspace.path}`);
      if (workspace.files && workspace.files.length > 0) {
        sections.push(`Files: ${workspace.files.length} files in workspace`);
      }
    }
    
    // 4. Available tools
    const allowedTools = this.filterToolsForMode(tools, mode);
    if (allowedTools.length > 0) {
      sections.push(`# Available Tools\n${allowedTools.map(t => `- ${t.name}`).join('\n')}`);
    }
    
    // 5. Additional instructions
    if (additionalInstructions) {
      sections.push('# Additional Instructions\n' + additionalInstructions);
    }
    
    return sections.join('\n\n');
  }
  
  /**
   * Get mode template content
   */
  private getModeTemplate(mode: ModeType): string {
    // Mode templates will be implemented in Phase 1, Task 3
    // For now, return basic templates
    const templates: Record<ModeType, string> = {
      assistant: `# Mode: Assistant 💬
You are a helpful AI assistant. You can answer questions, explain concepts,
and have natural conversations about any topic.`,
      
      planning: `# Mode: Planning 📋
You are a technical architect and planner. Focus on research, design, and
planning before implementation. You have read-only access to the codebase.`,
      
      developer: `# Mode: Developer 👨‍💻
You are a senior software engineer. You have full access to all tools and
can implement, refactor, and modify code.`,
      
      tool: `# Mode: Tool Expert 🔧
You are a tool usage expert. You have enhanced access to all tools with
detailed guidance on their usage.`,
      
      debugger: `# Mode: Debugger 🐛
You are a debugging specialist. Systematically analyze errors, find root
causes, and implement fixes.`,
      
      security: `# Mode: Security Specialist 🔒
You are a security auditor. Identify vulnerabilities, assess risks, and
implement security fixes.`,
      
      reviewer: `# Mode: Code Reviewer 👀
You are a code reviewer. Assess code quality, identify issues, and provide
constructive feedback.`,
      
      performance: `# Mode: Performance Engineer ⚡
You are a performance engineer. Analyze bottlenecks, optimize code, and
improve system performance.`
    };
    
    return templates[mode] || templates.assistant;
  }
  
  /**
   * Filter tools for current mode
   */
  filterToolsForMode(tools: Array<{ name: string }>, mode: ModeType): Array<{ name: string }> {
    const allowedTools = this.getAllowedTools(mode);
    
    // If mode allows all tools (*)
    if (allowedTools.includes('*')) {
      return tools;
    }
    
    // Filter tools based on allowed list
    return tools.filter(tool => {
      // Check exact match
      if (allowedTools.includes(tool.name)) {
        return true;
      }
      
      // Check wildcard patterns (e.g., 'git_*')
      return allowedTools.some(pattern => {
        if (pattern.endsWith('*')) {
          const prefix = pattern.slice(0, -1);
          return tool.name.startsWith(prefix);
        }
        return false;
      });
    });
  }
  
  /**
   * Check if a tool is allowed in current mode
   */
  isToolAllowed(toolName: string, mode: ModeType): boolean {
    const allowedTools = this.getAllowedTools(mode);
    
    // If mode allows all tools
    if (allowedTools.includes('*')) {
      return true;
    }
    
    // Check exact match
    if (allowedTools.includes(toolName)) {
      return true;
    }
    
    // Check wildcard patterns
    return allowedTools.some(pattern => {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return toolName.startsWith(prefix);
      }
      return false;
    });
  }
  
  /**
   * Get allowed tools for a mode
   */
  getAllowedTools(mode: ModeType): string[] {
    const toolAccess: Record<ModeType, string[]> = {
      assistant: [],
      
      planning: [
        'web_search', 'web_fetch',
        'read_file', 'read_multiple_files',
        'grep_search', 'file_search', 'list_directory',
        'get_diagnostics'
      ],
      
      developer: ['*'],
      
      tool: ['*'],
      
      debugger: [
        'read_file', 'grep_search', 'list_directory',
        'get_diagnostics', 'shell',
        'git_diff', 'git_log',
        'web_search',
        'write_file', 'str_replace'
      ],
      
      security: [
        'read_file', 'grep_search', 'list_directory',
        'get_diagnostics', 'shell',
        'web_search',
        'write_file', 'str_replace'
      ],
      
      reviewer: [
        'read_file', 'grep_search', 'list_directory',
        'get_diagnostics', 'shell',
        'git_diff', 'git_log'
      ],
      
      performance: [
        'read_file', 'grep_search', 'list_directory',
        'get_diagnostics', 'shell',
        'web_search',
        'write_file', 'str_replace'
      ]
    };
    
    return toolAccess[mode] || [];
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
      
      tool: [],
      
      debugger: ['delete_file', 'git_commit'],
      
      security: ['delete_file'],
      
      reviewer: ['write_file', 'str_replace', 'delete_file', 'git_*'],
      
      performance: ['delete_file']
    };
    
    return deniedTools[mode] || [];
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
