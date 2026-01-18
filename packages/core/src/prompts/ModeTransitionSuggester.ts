/**
 * Mode Transition Suggester for Dynamic Prompt System
 * 
 * Provides proactive suggestions for mode transitions based on conversation context,
 * mode history, and common transition patterns. Helps users discover and understand
 * the mode system by suggesting appropriate mode switches at the right time.
 */

import type { ModeType } from './ContextAnalyzer.js';
import type { Message } from '../provider/types.js';

/**
 * Mode transition suggestion
 */
export interface ModeTransitionSuggestion {
  /** Current mode the user is in */
  currentMode: ModeType;
  /** Suggested mode to switch to */
  suggestedMode: ModeType;
  /** Human-readable reason for the suggestion */
  reason: string;
  /** Confidence score for this suggestion (0.0 to 1.0) */
  confidence: number;
  /** Whether to auto-switch or ask the user first */
  autoSwitch: boolean;
  /** Additional context about why this suggestion was made */
  context?: {
    /** Keywords that triggered the suggestion */
    triggers?: string[];
    /** Number of errors detected (for debugger suggestions) */
    errorCount?: number;
    /** Whether a plan appears complete (for planning->developer) */
    planComplete?: boolean;
    /** Whether technical terms were detected (for assistant->planning) */
    hasTechnicalTerms?: boolean;
    /** Whether security keywords were detected */
    hasSecurityKeywords?: boolean;
    /** Whether performance keywords were detected */
    hasPerformanceKeywords?: boolean;
    /** Whether review keywords were detected */
    hasReviewKeywords?: boolean;
  };
}

/**
 * Conversation context for analysis
 */
export interface ConversationContext {
  /** Recent messages in the conversation */
  messages: Message[];
  /** Current mode */
  currentMode: ModeType;
  /** Time spent in current mode (ms) */
  timeInMode: number;
  /** Number of errors in recent messages */
  errorCount: number;
  /** Whether technical terms are present */
  hasTechnicalTerms: boolean;
  /** Whether a plan appears complete */
  planComplete: boolean;
  /** Whether security keywords are present */
  hasSecurityKeywords: boolean;
  /** Whether performance keywords are present */
  hasPerformanceKeywords: boolean;
  /** Whether review keywords are present */
  hasReviewKeywords: boolean;
  /** Number of code blocks in recent messages */
  codeBlockCount: number;
}

/**
 * User preferences for suggestions
 */
export interface SuggestionPreferences {
  /** Whether suggestions are enabled */
  enabled: boolean;
  /** Modes to never suggest */
  disabledSuggestions: ModeType[];
  /** Specific transitions to never suggest */
  disabledTransitions: Array<{ from: ModeType; to: ModeType }>;
  /** Minimum confidence required to show suggestion */
  minConfidence: number;
}

/**
 * Mode Transition Suggester
 * 
 * Analyzes conversation context and suggests appropriate mode transitions
 * to help users navigate the mode system effectively.
 */
export class ModeTransitionSuggester {
  private preferences: SuggestionPreferences;
  
  constructor(preferences?: Partial<SuggestionPreferences>) {
    this.preferences = {
      enabled: true,
      disabledSuggestions: [],
      disabledTransitions: [],
      minConfidence: 0.70,
      ...preferences
    };
  }
  
  /**
   * Update suggestion preferences
   */
  updatePreferences(preferences: Partial<SuggestionPreferences>): void {
    this.preferences = {
      ...this.preferences,
      ...preferences
    };
  }
  
  /**
   * Get current preferences
   */
  getPreferences(): SuggestionPreferences {
    return { ...this.preferences };
  }
  
  /**
   * Disable suggestions for a specific mode
   */
  disableSuggestionForMode(mode: ModeType): void {
    if (!this.preferences.disabledSuggestions.includes(mode)) {
      this.preferences.disabledSuggestions.push(mode);
    }
  }
  
  /**
   * Disable a specific transition
   */
  disableTransition(from: ModeType, to: ModeType): void {
    const exists = this.preferences.disabledTransitions.some(
      t => t.from === from && t.to === to
    );
    
    if (!exists) {
      this.preferences.disabledTransitions.push({ from, to });
    }
  }
  
  /**
   * Check if a transition is disabled
   */
  private isTransitionDisabled(from: ModeType, to: ModeType): boolean {
    return this.preferences.disabledTransitions.some(
      t => t.from === from && t.to === to
    );
  }
  
  /**
   * Check if suggestions for a mode are disabled
   */
  private isSuggestionDisabled(mode: ModeType): boolean {
    return this.preferences.disabledSuggestions.includes(mode);
  }
  
  /**
   * Suggest a mode transition based on conversation context
   */
  suggestTransition(context: ConversationContext): ModeTransitionSuggestion | null {
    // Check if suggestions are enabled
    if (!this.preferences.enabled) {
      return null;
    }
    
    // Try each suggestion pattern in order of priority
    const suggestion = 
      this.suggestDebuggerMode(context) ||
      this.suggestSecurityMode(context) ||
      this.suggestPerformanceMode(context) ||
      this.suggestReviewerMode(context) ||
      this.suggestPlanningMode(context) ||
      this.suggestDeveloperMode(context) ||
      this.suggestPrototypeMode(context) ||
      this.suggestTeacherMode(context);
    
    // Check if suggestion meets minimum confidence
    if (suggestion && suggestion.confidence < this.preferences.minConfidence) {
      return null;
    }
    
    // Check if suggestion is disabled
    if (suggestion) {
      if (this.isSuggestionDisabled(suggestion.suggestedMode)) {
        return null;
      }
      
      if (this.isTransitionDisabled(suggestion.currentMode, suggestion.suggestedMode)) {
        return null;
      }
    }
    
    return suggestion;
  }
  
  /**
   * Suggest debugger mode when errors are detected
   */
  private suggestDebuggerMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Only suggest from developer mode
    if (context.currentMode !== 'developer') {
      return null;
    }
    
    // Check for multiple errors
    if (context.errorCount >= 3) {
      return {
        currentMode: 'developer',
        suggestedMode: 'debugger',
        reason: 'Multiple errors detected. Systematic debugging recommended',
        confidence: 0.90,
        autoSwitch: true,  // Auto-switch for errors
        context: {
          errorCount: context.errorCount
        }
      };
    }
    
    // Check for single error with high confidence
    if (context.errorCount >= 1) {
      return {
        currentMode: 'developer',
        suggestedMode: 'debugger',
        reason: 'Error detected. Switch to Debugger mode for systematic analysis?',
        confidence: 0.75,
        autoSwitch: false,  // Ask user first
        context: {
          errorCount: context.errorCount
        }
      };
    }
    
    return null;
  }
  
  /**
   * Suggest security mode when security keywords are detected
   */
  private suggestSecurityMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Don't suggest if already in security mode
    if (context.currentMode === 'security') {
      return null;
    }
    
    // Check for security keywords
    if (context.hasSecurityKeywords) {
      return {
        currentMode: context.currentMode,
        suggestedMode: 'security',
        reason: 'Security concerns detected. Switch to Security mode for thorough audit?',
        confidence: 0.85,
        autoSwitch: false,  // Ask user first
        context: {
          hasSecurityKeywords: true
        }
      };
    }
    
    return null;
  }
  
  /**
   * Suggest performance mode when performance keywords are detected
   */
  private suggestPerformanceMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Don't suggest if already in performance mode
    if (context.currentMode === 'performance') {
      return null;
    }
    
    // Check for performance keywords
    if (context.hasPerformanceKeywords) {
      return {
        currentMode: context.currentMode,
        suggestedMode: 'performance',
        reason: 'Performance concerns detected. Switch to Performance mode for optimization?',
        confidence: 0.80,
        autoSwitch: false,  // Ask user first
        context: {
          hasPerformanceKeywords: true
        }
      };
    }
    
    return null;
  }
  
  /**
   * Suggest reviewer mode when review keywords are detected
   */
  private suggestReviewerMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Only suggest from developer mode
    if (context.currentMode !== 'developer') {
      return null;
    }
    
    // Check for review keywords
    if (context.hasReviewKeywords) {
      return {
        currentMode: 'developer',
        suggestedMode: 'reviewer',
        reason: 'Code review requested. Switch to Reviewer mode for quality assessment?',
        confidence: 0.80,
        autoSwitch: false,  // Ask user first
        context: {
          hasReviewKeywords: true
        }
      };
    }
    
    return null;
  }
  
  /**
   * Suggest planning mode from assistant mode
   */
  private suggestPlanningMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Only suggest from assistant mode
    if (context.currentMode !== 'assistant') {
      return null;
    }
    
    // Check for technical terms
    if (context.hasTechnicalTerms) {
      return {
        currentMode: 'assistant',
        suggestedMode: 'planning',
        reason: 'This sounds like you want to plan an implementation. Switch to Planning mode?',
        confidence: 0.75,
        autoSwitch: false,  // Ask user first
        context: {
          hasTechnicalTerms: true
        }
      };
    }
    
    return null;
  }
  
  /**
   * Suggest developer mode from planning mode
   */
  private suggestDeveloperMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Only suggest from planning mode
    if (context.currentMode !== 'planning') {
      return null;
    }
    
    // Check if plan appears complete
    if (context.planComplete) {
      return {
        currentMode: 'planning',
        suggestedMode: 'developer',
        reason: 'The plan is complete. Ready to switch to Developer mode and start implementing?',
        confidence: 0.85,
        autoSwitch: false,  // Ask user first
        context: {
          planComplete: true
        }
      };
    }
    
    // Check for implementation keywords in planning mode
    if (context.timeInMode > 300000) {  // 5 minutes
      return {
        currentMode: 'planning',
        suggestedMode: 'developer',
        reason: 'Ready to start implementing? Switch to Developer mode?',
        confidence: 0.70,
        autoSwitch: false,  // Ask user first
        context: {}
      };
    }
    
    return null;
  }
  
  /**
   * Suggest prototype mode for quick experiments
   */
  private suggestPrototypeMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Don't suggest if already in prototype mode
    if (context.currentMode === 'prototype') {
      return null;
    }
    
    // Look for experiment/prototype keywords in recent messages
    const hasPrototypeKeywords = context.messages.some(msg => {
      const content = this.getMessageContent(msg).toLowerCase();
      return content.includes('experiment') ||
             content.includes('prototype') ||
             content.includes('quick test') ||
             content.includes('proof of concept') ||
             content.includes('spike');
    });
    
    if (hasPrototypeKeywords) {
      return {
        currentMode: context.currentMode,
        suggestedMode: 'prototype',
        reason: 'Quick experiment detected. Switch to Prototype mode for rapid testing?',
        confidence: 0.75,
        autoSwitch: false,  // Ask user first
        context: {}
      };
    }
    
    return null;
  }
  
  /**
   * Suggest teacher mode for learning
   */
  private suggestTeacherMode(context: ConversationContext): ModeTransitionSuggestion | null {
    // Don't suggest if already in teacher mode
    if (context.currentMode === 'teacher') {
      return null;
    }
    
    // Look for learning/explanation keywords in recent messages
    const hasTeacherKeywords = context.messages.some(msg => {
      const content = this.getMessageContent(msg).toLowerCase();
      return content.includes('explain') ||
             content.includes('teach me') ||
             content.includes('how does') ||
             content.includes('why') ||
             content.includes('understand') ||
             content.includes('learn');
    });
    
    if (hasTeacherKeywords && context.currentMode === 'assistant') {
      return {
        currentMode: 'assistant',
        suggestedMode: 'teacher',
        reason: 'Learning question detected. Switch to Teacher mode for detailed explanation?',
        confidence: 0.70,
        autoSwitch: false,  // Ask user first
        context: {}
      };
    }
    
    return null;
  }
  
  /**
   * Extract text content from a message
   */
  private getMessageContent(message: Message): string {
    if (!message.parts || message.parts.length === 0) {
      return '';
    }
    
    return message.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(' ');
  }
  
  /**
   * Build conversation context from messages
   */
  buildContext(
    messages: Message[],
    currentMode: ModeType,
    modeEntryTime: Date
  ): ConversationContext {
    const now = Date.now();
    const timeInMode = now - modeEntryTime.getTime();
    
    // Analyze recent messages (last 5)
    const recentMessages = messages.slice(-5);
    
    // Count errors
    const errorCount = this.countErrors(recentMessages);
    
    // Detect technical terms
    const hasTechnicalTerms = this.detectTechnicalTerms(recentMessages);
    
    // Check if plan is complete
    const planComplete = this.detectPlanComplete(recentMessages);
    
    // Detect security keywords
    const hasSecurityKeywords = this.detectSecurityKeywords(recentMessages);
    
    // Detect performance keywords
    const hasPerformanceKeywords = this.detectPerformanceKeywords(recentMessages);
    
    // Detect review keywords
    const hasReviewKeywords = this.detectReviewKeywords(recentMessages);
    
    // Count code blocks
    const codeBlockCount = this.countCodeBlocks(recentMessages);
    
    return {
      messages: recentMessages,
      currentMode,
      timeInMode,
      errorCount,
      hasTechnicalTerms,
      planComplete,
      hasSecurityKeywords,
      hasPerformanceKeywords,
      hasReviewKeywords,
      codeBlockCount
    };
  }
  
  /**
   * Count errors in messages
   */
  private countErrors(messages: Message[]): number {
    let count = 0;
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg).toLowerCase();
      
      // Check for error keywords
      if (
        content.includes('error') ||
        content.includes('exception') ||
        content.includes('typeerror') ||
        content.includes('referenceerror') ||
        content.includes('syntaxerror') ||
        content.includes('failed') ||
        content.includes('crash')
      ) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Detect technical terms in messages
   */
  private detectTechnicalTerms(messages: Message[]): boolean {
    const technicalTerms = [
      'implement', 'function', 'class', 'component', 'api', 'database',
      'algorithm', 'architecture', 'design pattern', 'framework', 'library',
      'typescript', 'javascript', 'python', 'react', 'node'
    ];
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg).toLowerCase();
      
      for (const term of technicalTerms) {
        if (content.includes(term)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detect if plan is complete
   */
  private detectPlanComplete(messages: Message[]): boolean {
    const completionPhrases = [
      'plan is complete',
      'planning is done',
      'ready to implement',
      'let\'s implement',
      'start implementing',
      'begin implementation',
      'plan looks good'
    ];
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg).toLowerCase();
      
      for (const phrase of completionPhrases) {
        if (content.includes(phrase)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detect security keywords
   */
  private detectSecurityKeywords(messages: Message[]): boolean {
    const securityKeywords = [
      'security', 'vulnerability', 'exploit', 'injection', 'xss', 'csrf',
      'authentication', 'authorization', 'encrypt', 'sanitize', 'attack'
    ];
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg).toLowerCase();
      
      for (const keyword of securityKeywords) {
        if (content.includes(keyword)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detect performance keywords
   */
  private detectPerformanceKeywords(messages: Message[]): boolean {
    const performanceKeywords = [
      'performance', 'optimize', 'slow', 'fast', 'benchmark', 'profile',
      'latency', 'throughput', 'memory', 'cpu', 'bottleneck', 'speed'
    ];
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg).toLowerCase();
      
      for (const keyword of performanceKeywords) {
        if (content.includes(keyword)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detect review keywords
   */
  private detectReviewKeywords(messages: Message[]): boolean {
    const reviewKeywords = [
      'review', 'check', 'assess', 'evaluate', 'quality', 'best practices',
      'code review', 'feedback', 'critique'
    ];
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg).toLowerCase();
      
      for (const keyword of reviewKeywords) {
        if (content.includes(keyword)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Count code blocks in messages
   */
  private countCodeBlocks(messages: Message[]): number {
    let count = 0;
    
    for (const msg of messages) {
      const content = this.getMessageContent(msg);
      const matches = content.match(/```/g);
      if (matches) {
        count += Math.floor(matches.length / 2);  // Each code block has 2 backticks
      }
    }
    
    return count;
  }
}
