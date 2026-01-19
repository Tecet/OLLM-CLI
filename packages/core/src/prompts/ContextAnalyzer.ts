/**
 * Context Analyzer for Dynamic Prompt System
 * 
 * Analyzes conversation messages to detect context and recommend appropriate modes.
 * Implements keyword detection, confidence scoring, and conversation analysis.
 */

import type { Message } from '../provider/types.js';
import { MODE_METADATA } from './templates/modes/index.js';

/**
 * Available mode types in the system
 */
export type ModeType =
  | 'assistant'
  | 'planning'
  | 'developer'
  | 'debugger'
  | 'reviewer';

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
    'help', 'chat', 'tell me', 'hello', 'hi', 'who are you', 'what can you do',
    'explain', 'teach me', 'how does', 'why', 'understand', 'learn',
    'what is', 'tutorial', 'show me', 'walk me through', 'educational'
  ],
  planning: [
    'plan', 'architecture', 'design', 'how to implement', 'approach', 'strategy',
    'todo list', 'steps', 'requirements', 'specification', 'outline', 'structuring',
    'break down the task', 'sequence of actions', 'pre-implementation', 'brainstorm'
  ],
  developer: [
    'code', 'implement', 'feature', 'build', 'create', 'write', 'refactor',
    'add', 'new', 'function', 'class', 'component', 'script', 'logic',
    'setup', 'config', 'install', 'update', 'modify', 'change',
    'prototype', 'experiment', 'quick test', 'proof of concept', 'spike',
    'throwaway', 'poc', 'rapid', 'quick and dirty',
    'run', 'execute', 'call tool', 'use tool', 'list tools', 'get help with tools',
    'how to use', 'tool syntax', 'what tools', 'automated', 'scripted'
  ],
  debugger: [
    'debug', 'fix', 'bug', 'error', 'exception', 'stack trace', 'failing',
    'broken', 'not working', 'investigate', 'diagnose', 'root cause', 'crash',
    'logs', 'output', 'console', 'terminal', 'test failure', 'issue',
    'performance', 'slow', 'latency', 'high cpu', 'memory leak', 'optimize',
    'profiling', 'benchmark', 'efficient', 'bottleneck'
  ],
  reviewer: [
    'review', 'audit', 'best practices', 'improve', 'quality', 'style',
    'readability', 'structure', 'conventions', 'feedback', 'linter', 'prettier',
    'consistency', 'refactor suggestion', 'logic check', 'complexity',
    'security', 'vulnerability', 'secure', 'exploit', 'injection', 'auth',
    'encryption', 'mitigate', 'sanitize', 'hardened', 'risk'
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
    const confidences = this.calculateAllModeConfidences(messages);
    const sortedModes = (Object.keys(confidences) as ModeType[])
      .sort((a, b) => confidences[b] - confidences[a]);

    const topMode = sortedModes[0];
    const topConfidence = confidences[topMode];
    const metadata = this.analyzeMetadataForResponse(messages);

    return {
      mode: topMode,
      confidence: topConfidence,
      triggers: [], // Keywords that triggered this recommendation
      metadata
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

    const modeConfidences: Record<ModeType, number> = {
      assistant: this.calculateModeConfidence(recentMessages, 'assistant'),
      planning: this.calculateModeConfidence(recentMessages, 'planning'),
      developer: this.calculateModeConfidence(recentMessages, 'developer'),
      debugger: this.calculateModeConfidence(recentMessages, 'debugger'),
      reviewer: this.calculateModeConfidence(recentMessages, 'reviewer')
    };

    // Detect keywords and metadata
    const allText = recentMessages
      .map(m => m.parts.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join(' '))
      .join(' ');

    // Adjust for specific patterns
    if (/error|exception|stack trace|failed/i.test(allText)) {
      modeConfidences.debugger += 0.2;
    }

    if (/```/.test(allText)) {
      modeConfidences.developer += 0.15;
    }

    // Ensure confidences don't exceed 1.0 after adjustments
    for (const mode in modeConfidences) {
      modeConfidences[mode as ModeType] = Math.min(modeConfidences[mode as ModeType], 1.0);
    }

    return modeConfidences;
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
    
    const getIcon = (mode: ModeType): string => {
      const metadata = (MODE_METADATA as Record<string, { icon: string }>)[mode] || MODE_METADATA.assistant;
      return metadata.icon;
    };

    const generateReason = (mode: ModeType, _confidence: number): string => {
      const { metadata } = analysis;

      switch (mode) {
        case 'debugger':
          return metadata.errorMessagesPresent ? 'Error analysis recommended' : 'Root cause investigation';
        case 'reviewer':
          return 'Code quality assessment';
        case 'planning':
          return 'Strategic approach needed';
        case 'developer':
          return metadata.toolsUsed.length > 0 ? 'Tool usage detected' : 'Implementation ready';
        case 'assistant':
          return 'General assistance';
        default:
          return 'Suggested context switch';
      }
    };
    
    return Object.entries(confidences)
      .filter(([mode]) => mode !== currentMode)
      .sort(([, a], [, b]) => b - a)
      .slice(0, topN)
      .map(([mode, confidence]) => ({
        mode: mode as ModeType,
        icon: getIcon(mode as ModeType),
        confidence,
        reason: generateReason(mode as ModeType, confidence)
      }));
  }
  
  /**
   * Calculate confidence score for a specific mode
   * 
   * @param messages - Messages to analyze
   * @param mode - Mode to calculate confidence for
   * @returns Confidence score (0.0 to 1.0)
   */
  private calculateModeConfidence(messages: Message[], mode: ModeType): number {
    let confidence = 0.0;
    const keywords = MODE_KEYWORDS[mode] || [];
    
    // Use simple loops to avoid any potential scope/closure weirdness
    for (let i = 0; i < messages.length; i++) {
        const message = messages[i];
        const weight = Math.pow(1.5, i);
        
        let text = "";
        if (message.parts) {
            for (const part of message.parts) {
                 if (part.type === 'text') {
                     text += (part as any).text + " ";
                 }
            }
        }
        text = text.toLowerCase();
        
        // Count matches
        let matchCount = 0;
        if (keywords && keywords.length > 0) {
            for (const keyword of keywords) {
                if (text.indexOf(keyword.toLowerCase()) !== -1) {
                    matchCount++;
                }
            }
        }
        
        if (matchCount > 0) {
            const keywordScore = Math.min(matchCount, 3) / 3;
            confidence += keywordScore * weight * 0.4;
        }

        if (this.detectExplicitModeRequest(text, mode)) {
             confidence += 0.8 * weight;
        }
    }
    
    return Math.min(confidence / 4.0, 1.0);
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
      return 'developer';
    }
    
    return null;
  }
  
  private analyzeMetadataForResponse(messages: Message[]): ContextAnalysis['metadata'] {
    const allText = messages
      .map(m => m.parts.filter(p => p.type === 'text').map(p => (p as { type: 'text'; text: string }).text).join(' '))
      .join(' ');
    
    return {
      keywords: [],
      toolsUsed: [],
      recentTopics: [],
      codeBlocksPresent: /```/.test(allText),
      errorMessagesPresent: /error|exception|stack trace|failed/i.test(allText)
    };
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
