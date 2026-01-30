/**
 * Mode-Aware Compression Integration
 *
 * Integrates the context compression system with operational modes to provide
 * mode-specific compression strategies and preservation rules.
 *
 * Requirements: FR-12
 */

import { OperationalMode, MODE_PROFILES, ModeProfile } from '../types.js';

/**
 * Preservation strategy for mode-specific content
 */
export interface PreservationStrategy {
  /** Preserve code snippets and file paths */
  preserveCode: boolean;
  /** Preserve goals and objectives */
  preserveGoals: boolean;
  /** Preserve error messages and stack traces */
  preserveErrors: boolean;
  /** Preserve architectural decisions (always true) */
  preserveDecisions: boolean;
  /** Additional content types to preserve */
  additionalPreservation: string[];
}

/**
 * Mode-aware compression integration
 *
 * Provides mode-specific summarization prompts and preservation strategies
 * to ensure important context is maintained based on operational mode.
 */
export class ModeAwareCompression {
  /**
   * Get mode-specific summarization prompt
   *
   * @param mode - Current operational mode
   * @param level - Compression level (1=compact, 2=moderate, 3=detailed)
   * @returns Summarization prompt tailored to the mode
   */
  getSummarizationPrompt(mode: OperationalMode, level: 1 | 2 | 3): string {
    const basePrompt = this.getBasePrompt(level);
    const modeInstructions = this.getModeInstructions(mode);

    return `${basePrompt}\n\n${modeInstructions}`;
  }

  /**
   * Get base summarization prompt for compression level
   *
   * @param level - Compression level
   * @returns Base prompt text
   */
  private getBasePrompt(level: 1 | 2 | 3): string {
    switch (level) {
      case 1: // Compact
        return `Summarize the following conversation into a very concise summary (50-100 tokens).
Focus only on the most critical information and key decisions.
Remove all redundant details, examples, and explanations.`;

      case 2: // Moderate
        return `Summarize the following conversation into a moderate summary (100-200 tokens).
Preserve important decisions, key context, and significant outcomes.
Remove redundant discussions and minor details.`;

      case 3: // Detailed
        return `Summarize the following conversation into a detailed summary (200-400 tokens).
Preserve all important context, decisions, and relevant details.
Only remove truly redundant or off-topic content.`;
    }
  }

  /**
   * Get mode-specific instructions for summarization
   *
   * @param mode - Operational mode
   * @returns Mode-specific instructions
   */
  private getModeInstructions(mode: OperationalMode): string {
    switch (mode) {
      case OperationalMode.DEVELOPER:
        return `Focus on preserving:
- Code snippets and file paths
- Technical decisions and rationale
- Error messages and debugging context
- Implementation details and architecture
- API contracts and data models
- File changes (created, modified, deleted)

Format code blocks with triple backticks and include file paths.
Preserve exact error messages and stack traces.`;

      case OperationalMode.PLANNING:
        return `Focus on preserving:
- Goals and objectives
- Architectural decisions and trade-offs
- Requirements and constraints
- Next steps and action items
- Milestones and deadlines
- Dependencies and blockers

Use structured format with clear sections for goals, decisions, and tasks.
Preserve goal markers and checkpoint status.`;

      case OperationalMode.DEBUGGER:
        return `Focus on preserving:
- Error symptoms and stack traces
- Debugging steps taken
- Root cause analysis
- Solutions attempted and their outcomes
- Reproduction steps
- Environment details

Preserve exact error messages and stack traces.
Document what was tried and what worked/didn't work.`;

      case OperationalMode.ASSISTANT:
      default:
        return `Focus on preserving:
- Key decisions made
- Important context and user preferences
- Conversation flow and continuity
- Action items and next steps
- User-stated preferences and requirements

Maintain a natural conversational tone.
Preserve user preferences and important context.`;
    }
  }

  /**
   * Get preservation strategy for a specific mode
   *
   * @param mode - Operational mode
   * @returns Preservation strategy configuration
   */
  getPreservationStrategy(mode: OperationalMode): PreservationStrategy {
    const profile = MODE_PROFILES[mode];

    return {
      preserveCode: mode === OperationalMode.DEVELOPER || mode === OperationalMode.DEBUGGER,
      preserveGoals: mode === OperationalMode.PLANNING,
      preserveErrors: mode === OperationalMode.DEBUGGER,
      preserveDecisions: true, // Always preserve decisions
      additionalPreservation: profile.neverCompress,
    };
  }

  /**
   * Get mode profile configuration
   *
   * @param mode - Operational mode
   * @returns Mode profile with compression rules
   */
  getModeProfile(mode: OperationalMode): ModeProfile {
    return MODE_PROFILES[mode];
  }

  /**
   * Determine if content should be preserved based on mode
   *
   * @param content - Content to check
   * @param mode - Current operational mode
   * @returns True if content should be preserved
   */
  shouldPreserveContent(content: string, mode: OperationalMode): boolean {
    const profile = MODE_PROFILES[mode];
    const strategy = this.getPreservationStrategy(mode);

    // Check for code blocks (preserve in developer/debugger modes)
    if (strategy.preserveCode && this.containsCode(content)) {
      return true;
    }

    // Check for error messages (preserve in debugger mode)
    if (strategy.preserveErrors && this.containsError(content)) {
      return true;
    }

    // Check for goals (preserve in planning mode)
    if (strategy.preserveGoals && this.containsGoal(content)) {
      return true;
    }

    // Check extraction rules
    if (profile.extractionRules) {
      for (const [_type, regex] of Object.entries(profile.extractionRules)) {
        if (regex.test(content)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if content contains code blocks
   *
   * @param content - Content to check
   * @returns True if content contains code
   */
  private containsCode(content: string): boolean {
    // Check for code blocks (triple backticks)
    if (content.includes('```')) {
      return true;
    }

    // Check for file paths
    if (/[a-zA-Z0-9_-]+\.[a-zA-Z]{2,4}/.test(content)) {
      return true;
    }

    // Check for common code patterns
    const codePatterns = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /interface\s+\w+/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /import\s+.*from/,
      /export\s+(default|const|function|class)/,
    ];

    return codePatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Check if content contains error messages
   *
   * @param content - Content to check
   * @returns True if content contains errors
   */
  private containsError(content: string): boolean {
    const errorPatterns = [
      /error:/i,
      /exception:/i,
      /failed:/i,
      /stack trace:/i,
      /at\s+\w+\s+\([^)]+:\d+:\d+\)/,
      /TypeError|ReferenceError|SyntaxError/,
    ];

    return errorPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Check if content contains goal-related information
   *
   * @param content - Content to check
   * @returns True if content contains goals
   */
  private containsGoal(content: string): boolean {
    const goalPatterns = [
      /\[GOAL\]/i,
      /\[CHECKPOINT\]/i,
      /\[DECISION\]/i,
      /goal:/i,
      /objective:/i,
      /requirement:/i,
      /must\s+(have|be|do)/i,
    ];

    return goalPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Extract important information based on mode
   *
   * @param content - Content to extract from
   * @param mode - Current operational mode
   * @returns Extracted important information
   */
  extractImportantInfo(content: string, mode: OperationalMode): string[] {
    const profile = MODE_PROFILES[mode];
    const extracted: string[] = [];

    if (!profile.extractionRules) {
      return extracted;
    }

    for (const [type, regex] of Object.entries(profile.extractionRules)) {
      const matches = content.match(regex);
      if (matches && matches[1]) {
        extracted.push(`[${type}] ${matches[1].trim()}`);
      }
    }

    return extracted;
  }

  /**
   * Get compression priority for content types based on mode
   *
   * @param mode - Operational mode
   * @returns Ordered list of content types (first = compress first)
   */
  getCompressionPriority(mode: OperationalMode): string[] {
    return MODE_PROFILES[mode].compressionPriority;
  }

  /**
   * Validate mode transition doesn't break compression state
   *
   * @param fromMode - Previous mode
   * @param toMode - New mode
   * @returns True if transition is safe
   */
  validateModeTransition(_fromMode: OperationalMode, _toMode: OperationalMode): boolean {
    // All mode transitions are safe - compression state is mode-agnostic
    // Only the summarization strategy changes
    return true;
  }

  /**
   * Get recommended compression level for mode
   *
   * @param mode - Operational mode
   * @returns Recommended compression level (1-3)
   */
  getRecommendedCompressionLevel(mode: OperationalMode): 1 | 2 | 3 {
    switch (mode) {
      case OperationalMode.DEVELOPER:
        return 3; // Detailed - preserve technical context

      case OperationalMode.DEBUGGER:
        return 3; // Detailed - preserve error context

      case OperationalMode.PLANNING:
        return 2; // Moderate - balance goals and details

      case OperationalMode.ASSISTANT:
      default:
        return 2; // Moderate - balance conversation flow
    }
  }
}
