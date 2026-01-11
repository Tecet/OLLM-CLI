/**
 * Output management utilities for tool results
 * Handles truncation and formatting of tool output
 */

export interface TruncationConfig {
  maxChars?: number;
  maxLines?: number;
}

export interface TruncationResult {
  content: string;
  truncated: boolean;
  omitted?: string;
}

/**
 * OutputFormatter provides utilities for truncating and formatting tool output
 * to prevent context overflow and optimize LLM consumption
 */
export class OutputFormatter {
  /**
   * Truncate output based on character and/or line limits
   * 
   * @param output - The output string to truncate
   * @param config - Truncation configuration with maxChars and/or maxLines
   * @returns TruncationResult with truncated content and metadata
   */
  static truncate(output: string, config: TruncationConfig): TruncationResult {
    let content = output;
    let truncated = false;
    let omitted: string | undefined;

    // Truncate by lines first
    if (config.maxLines !== undefined && config.maxLines > 0) {
      const lines = content.split('\n');
      if (lines.length > config.maxLines) {
        content = lines.slice(0, config.maxLines).join('\n');
        truncated = true;
        omitted = `${lines.length - config.maxLines} lines`;
      }
    }

    // Then truncate by characters
    if (config.maxChars !== undefined && config.maxChars > 0 && content.length > config.maxChars) {
      const originalLength = content.length;
      content = content.slice(0, config.maxChars);
      truncated = true;
      const charsOmitted = `${originalLength - config.maxChars} characters`;
      omitted = omitted ? `${omitted} and ${charsOmitted}` : charsOmitted;
    }

    // Append truncation indicator if content was truncated
    if (truncated && omitted) {
      content += `\n\n[Output truncated: ${omitted} omitted]`;
    }

    return { content, truncated, omitted };
  }

  /**
   * Format output for optimal LLM consumption
   * Trims whitespace and ensures clean structure
   * 
   * @param output - The output string to format
   * @returns Formatted output string
   */
  static formatForLLM(output: string): string {
    return output.trim();
  }

  /**
   * Format output for user display
   * Currently returns output as-is, but can be extended for user-specific formatting
   * 
   * @param output - The output string to format
   * @returns Formatted output string
   */
  static formatForDisplay(output: string): string {
    return output;
  }
}
