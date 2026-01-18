/**
 * Context Analyzer for Dynamic Prompt System
 * 
 * Analyzes conversation messages to detect context and recommend appropriate modes.
 * Implements keyword detection, confidence scoring, and conversation analysis.
 */

import type { Message } from '../provider/types.js';

/**
 * Available mode types in the system
 */
export type ModeType =
  | 'assistant'
  | 'planning'
  | 'developer'
  | 'tool'
  | 'debugger'
  | 'security'
  | 'reviewer'
  | 'performance'
  | 'prototype'
  | 'teacher';

/**
 * Result of context analysis
 */
export interface ContextAnalysis {
  /** Recommended mode based on analysis */
  mode: ModeType;
  /** Confidence score (0.0 to 1.0) */
  confidence: number;
  /** Keywords that triggered this recommendation */
  triggers: string[];
  /** Additional metadata about the analysis */
  metadata: {
    keywords: string[];
    toolsUsed: string[];
    recentTopics: string[];
    codeBlocksPresent: boolean;
    errorMessagesPresent: boolean;
  };
}

/**
 * Confidence scores for all modes
 */
export interface AllModeConfidences {
  [mode: string]: number;
}

/**
 * Suggested mode with reason
 */
export interface SuggestedMode {
  mode: ModeType;
  icon: string;
  confidence: number;
  reason: string;
}

/**
 * Keyword detection result for a specific mode
 */
export interface KeywordDetection {
  mode: ModeType;
  keywords: string[];
}

/**
 * Mode-specific keyword sets
 */
const MODE_KEYWORDS: Record<ModeType, string[]> = {
  assistant: [
    'what', 'why', 'how', 'explain', 'tell me', 'describe', 'discuss',
    'chat', 'talk', 'help me understand', 'can you explain'
  ],
  planning: [
    'plan', 'design', 'architecture', 'architect', 'strategy', 'research',
    'investigate', 'explore', 'analyze', 'study', 'approach', 'roadmap',
    'outline', 'blueprint', 'structure', 'organize', 'prepare'
  ],
  developer: [
    'implement', 'write', 'create', 'build', 'code', 'refactor', 'fix',
    'modify', 'update', 'add feature', 'change', 'edit', 'develop',
    'construct', 'make', 'generate'
  ],
  tool: [
    'tool', 'use tool', 'run command', 'execute', 'call', 'invoke'
  ],
  debugger: [
    'debug', 'error', 'bug', 'crash', 'issue', 'problem', 'failing',
    'broken', 'exception', 'stack trace', 'traceback', 'fails', 'not working',
    'TypeError', 'ReferenceError', 'SyntaxError', 'undefined', 'null pointer'
  ],
  security: [
    'security', 'vulnerability', 'audit', 'exploit', 'injection', 'XSS',
    'CSRF', 'authentication', 'authorization', 'encrypt', 'sanitize',
    'secure', 'attack', 'breach', 'CVE', 'OWASP'
  ],
  reviewer: [
    'review', 'check', 'assess', 'evaluate', 'quality', 'best practices',
    'code review', 'feedback', 'critique', 'examine', 'inspect'
  ],
  performance: [
    'performance', 'optimize', 'slow', 'fast', 'benchmark', 'profile',
    'latency', 'throughput', 'memory', 'CPU', 'speed', 'bottleneck',
    'efficiency', 'faster'
  ],
  prototype: [
    'prototype', 'experiment', 'quick test', 'proof of concept', 'spike',
    'try out', 'throwaway', 'poc', 'quick demo', 'test idea', 'validate',
    'explore solution', 'rapid', 'quick and dirty'
  ],
  teacher: [
    'explain', 'teach me', 'how does', 'why', 'understand', 'learn',
    'what is', 'tutorial', 'show me', 'walk me through', 'help me learn',
    'educate', 'clarify', 'break down', 'simplify', 'demonstrate'
  ]
};

/**
 * Context Analyzer
 * 
 * Analyzes conversation messages to detect context and recommend modes.
 */
export class ContextAnalyzer {
  /**
   * Analyze conversation messages for mode recommendation
   * 
   * @param messages - Conversation messages to analyze (analyzes last 5)
   * @returns Context analysis with mode recommendation and confidence
   */
  analyzeConversation(messages: Message[]): ContextAnalysis {
    // Analyze last 5 messages for context
    const recentMessages = messages.slice(-5);
    
    // Calculate confidence for each mode
    const modeConfidences: Record<ModeType, number> = {
      assistant: this.calculateModeConfidence(recentMessages, 'assistant'),
      planning: this.calculateModeConfidence(recentMessages, 'planning'),
      developer: this.calculateModeConfidence(recentMessages, 'developer'),
      tool: this.calculateModeConfidence(recentMessages, 'tool'),
      debugger: this.calculateModeConfidence(recentMessages, 'debugger'),
      security: this.calculateModeConfidence(recentMessages, 'security'),
      reviewer: this.calculateModeConfidence(recentMessages, 'reviewer'),
      performance: this.calculateModeConfidence(recentMessages, 'performance'),
      prototype: this.calculateModeConfidence(recentMessages, 'prototype'),
      teacher: this.calculateModeConfidence(recentMessages, 'teacher')
    };
    
    // Find mode with highest confidence
    let recommendedMode: ModeType = 'assistant';
    let maxConfidence = 0;
    
    for (const [mode, confidence] of Object.entries(modeConfidences)) {
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
        recommendedMode = mode as ModeType;
      }
    }
    
    // Detect keywords and metadata
    const allText = recentMessages
      .map(m => m.parts.filter(p => p.type === 'text').map(p => (p as any).text).join(' '))
      .join(' ');
    
    const keywordDetections = this.detectKeywords(allText);
    const triggers = keywordDetections
      .filter(d => d.mode === recommendedMode)
      .flatMap(d => d.keywords);
    
    const allKeywords = keywordDetections.flatMap(d => d.keywords);
    const codeBlocksPresent = /```[\s\S]*?```/.test(allText);
    const errorMessagesPresent = this.detectErrorMessages(allText);
    
    // Extract tool usage
    const toolsUsed = recentMessages
      .filter(m => m.role === 'assistant' && m.toolCalls)
      .flatMap(m => m.toolCalls?.map(tc => tc.name) || []);
    
    // Extract recent topics (simple heuristic: first few words of user messages)
    const recentTopics = recentMessages
      .filter(m => m.role === 'user')
      .map(m => {
        const text = m.parts.find(p => p.type === 'text');
        if (text && 'text' in text) {
          const words = text.text.split(' ').slice(0, 5).join(' ');
          return words.length > 50 ? words.substring(0, 50) + '...' : words;
        }
        return '';
      })
      .filter(t => t.length > 0);
    
    return {
      mode: recommendedMode,
      confidence: maxConfidence,
      triggers,
      metadata: {
        keywords: allKeywords,
        toolsUsed,
        recentTopics,
        codeBlocksPresent,
        errorMessagesPresent
      }
    };
  }
  
  /**
   * Calculate confidence scores for all modes
   * 
   * @param messages - Conversation messages to analyze
   * @returns Object with confidence scores for each mode
   */
  calculateAllModeConfidences(messages: Message[]): AllModeConfidences {
    const recentMessages = messages.slice(-5);
    
    return {
      assistant: this.calculateModeConfidence(recentMessages, 'assistant'),
      planning: this.calculateModeConfidence(recentMessages, 'planning'),
      developer: this.calculateModeConfidence(recentMessages, 'developer'),
      tool: this.calculateModeConfidence(recentMessages, 'tool'),
      debugger: this.calculateModeConfidence(recentMessages, 'debugger'),
      security: this.calculateModeConfidence(recentMessages, 'security'),
      reviewer: this.calculateModeConfidence(recentMessages, 'reviewer'),
      performance: this.calculateModeConfidence(recentMessages, 'performance'),
      prototype: this.calculateModeConfidence(recentMessages, 'prototype'),
      teacher: this.calculateModeConfidence(recentMessages, 'teacher')
    };
  }
  
  /**
   * Get suggested modes with reasons
   * 
   * @param messages - Conversation messages to analyze
   * @param currentMode - Current active mode
   * @param topN - Number of suggestions to return (default: 3)
   * @returns Array of suggested modes with reasons
   */
  getSuggestedModes(messages: Message[], currentMode: ModeType, topN: number = 3): SuggestedMode[] {
    const confidences = this.calculateAllModeConfidences(messages);
    const analysis = this.analyzeConversation(messages);
    
    // Get mode metadata
    const getModeIcon = (mode: ModeType): string => {
      const icons: Record<ModeType, string> = {
        assistant: '💬',
        planning: '📋',
        developer: '👨‍💻',
        tool: '🔧',
        debugger: '🐛',
        security: '🔒',
        reviewer: '👀',
        performance: '⚡',
        prototype: '⚡🔬',
        teacher: '👨‍🏫'
      };
      return icons[mode] || '💬';
    };
    
    // Generate reasons for each mode
    const generateReason = (mode: ModeType, confidence: number): string => {
      const { metadata } = analysis;
      
      switch (mode) {
        case 'debugger':
          if (metadata.errorMessagesPresent) {
            return 'Multiple errors detected';
          }
          return 'Error analysis recommended';
          
        case 'security':
          if (metadata.keywords.some(k => k.includes('security') || k.includes('vulnerability'))) {
            return 'Security concerns detected';
          }
          return 'Security review recommended';
          
        case 'reviewer':
          if (metadata.keywords.some(k => k.includes('review') || k.includes('check'))) {
            return 'Code review requested';
          }
          return 'Quality assessment suggested';
          
        case 'performance':
          if (metadata.keywords.some(k => k.includes('slow') || k.includes('optimize'))) {
            return 'Performance issues detected';
          }
          return 'Optimization opportunities';
          
        case 'planning':
          if (metadata.keywords.some(k => k.includes('plan') || k.includes('design'))) {
            return 'Planning phase detected';
          }
          return 'Consider planning first';
          
        case 'developer':
          if (metadata.keywords.some(k => k.includes('implement') || k.includes('build'))) {
            return 'Implementation ready';
          }
          return 'Ready to implement';
          
        case 'prototype':
          if (metadata.keywords.some(k => k.includes('experiment') || k.includes('quick'))) {
            return 'Quick experiment suggested';
          }
          return 'Rapid prototyping mode';
          
        case 'teacher':
          if (metadata.keywords.some(k => k.includes('explain') || k.includes('learn'))) {
            return 'Learning opportunity';
          }
          return 'Educational context';
          
        case 'assistant':
          return 'General conversation';
          
        case 'tool':
          if (metadata.toolsUsed.length > 0) {
            return 'Tool usage detected';
          }
          return 'Enhanced tool guidance';
          
        default:
          return 'Suggested mode';
      }
    };
    
    // Sort modes by confidence (excluding current mode)
    const sortedModes = Object.entries(confidences)
      .filter(([mode]) => mode !== currentMode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([mode, confidence]) => ({
        mode: mode as ModeType,
        icon: getModeIcon(mode as ModeType),
        confidence,
        reason: generateReason(mode as ModeType, confidence)
      }));
    
    return sortedModes;
  }
  
  /**
   * Calculate confidence score for a specific mode
   * 
   * @param messages - Messages to analyze
   * @param mode - Mode to calculate confidence for
   * @returns Confidence score (0.0 to 1.0)
   */
  calculateModeConfidence(messages: Message[], mode: ModeType): number {
    let confidence = 0.0;
    const keywords = MODE_KEYWORDS[mode];
    
    // Analyze each message with exponential decay (recent messages weighted higher)
    messages.forEach((message, index) => {
      const weight = Math.pow(1.5, index); // Exponential weight: 1, 1.5, 2.25, 3.375, 5.0625
      const text = message.parts
        .filter(p => p.type === 'text')
        .map(p => (p as any).text)
        .join(' ')
        .toLowerCase();
      
      // Count keyword matches
      let matchCount = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
      
      // Add weighted confidence based on matches
      if (matchCount > 0) {
        confidence += (matchCount / keywords.length) * weight * 0.2;
      }
      
      // Boost for explicit mode requests
      if (this.detectExplicitModeRequest(text, mode)) {
        confidence += 0.5 * weight;
      }
      
      // Boost for code blocks in developer mode
      if (mode === 'developer' && /```[\s\S]*?```/.test(text)) {
        confidence += 0.2 * weight;
      }
      
      // Boost for error messages in debugger mode
      if (mode === 'debugger' && this.detectErrorMessages(text)) {
        confidence += 0.3 * weight;
      }
      
      // Boost for security keywords
      if (mode === 'security' && this.detectSecurityKeywords(text)) {
        confidence += 0.3 * weight;
      }
    });
    
    // Normalize confidence to 0-1 range
    // Maximum possible confidence with 5 messages and exponential weights is roughly:
    // 5 messages * max_weight(5.0625) * max_boost(0.7) ≈ 17.7
    const normalizedConfidence = Math.min(confidence / 15.0, 1.0);
    
    return normalizedConfidence;
  }
  
  /**
   * Detect keywords in text for all modes
   * 
   * @param text - Text to analyze
   * @returns Array of keyword detections for each mode
   */
  detectKeywords(text: string): KeywordDetection[] {
    const lowerText = text.toLowerCase();
    const detections: KeywordDetection[] = [];
    
    for (const [mode, keywords] of Object.entries(MODE_KEYWORDS)) {
      const matchedKeywords = keywords.filter(keyword =>
        lowerText.includes(keyword.toLowerCase())
      );
      
      if (matchedKeywords.length > 0) {
        detections.push({
          mode: mode as ModeType,
          keywords: matchedKeywords
        });
      }
    }
    
    return detections;
  }
  
  /**
   * Check if tool usage indicates mode switch
   * 
   * @param messages - Messages to analyze
   * @returns Recommended mode based on tool usage, or null
   */
  detectToolUsage(messages: Message[]): ModeType | null {
    const recentMessages = messages.slice(-3);
    
    // Check for tool calls in recent messages
    const hasToolCalls = recentMessages.some(m =>
      m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0
    );
    
    if (hasToolCalls) {
      return 'tool';
    }
    
    return null;
  }
  
  /**
   * Detect explicit mode request in text
   * 
   * @param text - Text to analyze
   * @param mode - Mode to check for
   * @returns True if explicit request detected
   */
  private detectExplicitModeRequest(text: string, mode: ModeType): boolean {
    const patterns = [
      `switch to ${mode}`,
      `use ${mode} mode`,
      `enter ${mode} mode`,
      `go to ${mode}`,
      `/mode ${mode}`
    ];
    
    return patterns.some(pattern => text.includes(pattern));
  }
  
  /**
   * Detect error messages in text
   * 
   * @param text - Text to analyze
   * @returns True if error messages detected
   */
  private detectErrorMessages(text: string): boolean {
    const errorPatterns = [
      /error:/i,
      /exception:/i,
      /stack trace/i,
      /traceback/i,
      /TypeError/i,
      /ReferenceError/i,
      /SyntaxError/i,
      /undefined is not/i,
      /cannot read property/i,
      /null pointer/i,
      /segmentation fault/i
    ];
    
    return errorPatterns.some(pattern => pattern.test(text));
  }
  
  /**
   * Detect security-related keywords in text
   * 
   * @param text - Text to analyze
   * @returns True if security keywords detected
   */
  private detectSecurityKeywords(text: string): boolean {
    const securityPatterns = [
      /SQL injection/i,
      /XSS/i,
      /CSRF/i,
      /CVE-\d{4}-\d{4,}/i,
      /OWASP/i,
      /authentication/i,
      /authorization/i,
      /vulnerability/i,
      /exploit/i
    ];
    
    return securityPatterns.some(pattern => pattern.test(text));
  }
}
