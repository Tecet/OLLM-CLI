/**
 * Environment Sanitization Service
 *
 * Filters sensitive environment variables before tool execution to prevent
 * API keys, secrets, and credentials from leaking to the LLM or logs.
 */

// @ts-ignore - picomatch doesn't have type definitions
import picomatch from 'picomatch';
import type { SanitizationConfig } from './types.js';
import { sanitizeErrorMessage } from './errorSanitization.js';

/**
 * Default environment variables that are always allowed
 */
const DEFAULT_ALLOW_LIST = [
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'LC_COLLATE',
  'LC_CTYPE',
  'LC_MESSAGES',
  'LC_MONETARY',
  'LC_NUMERIC',
  'LC_TIME',
];

/**
 * Default patterns for sensitive environment variables that should be denied
 */
const DEFAULT_DENY_PATTERNS = [
  '*_KEY',
  '*_SECRET',
  '*_TOKEN',
  '*_PASSWORD',
  '*_CREDENTIAL',
  'AWS_*',
  'GITHUB_*',
];

/**
 * Service for sanitizing environment variables before tool execution
 */
export class EnvironmentSanitizationService {
  private allowList: Set<string>;
  private denyPatterns: string[];
  private denyMatcher: (value: string) => boolean = () => false;

  constructor(config?: SanitizationConfig) {
    // Initialize with defaults
    this.allowList = new Set(DEFAULT_ALLOW_LIST);
    this.denyPatterns = [...DEFAULT_DENY_PATTERNS];

    // Apply custom configuration if provided
    if (config) {
      this.configure(config);
    } else {
      // Create matcher with default patterns
      this.denyMatcher = picomatch(this.denyPatterns, { nocase: true });
    }
  }

  /**
   * Configure the service with custom allow list and deny patterns
   */
  configure(config: SanitizationConfig): void {
    try {
      // Update allow list if provided
      if (config.allowList && config.allowList.length > 0) {
        this.allowList = new Set(config.allowList);
      }

      // Update deny patterns if provided
      if (config.denyPatterns && config.denyPatterns.length > 0) {
        this.denyPatterns = config.denyPatterns;
      }

      // Create matcher for deny patterns
      this.denyMatcher = picomatch(this.denyPatterns, { nocase: true });
    } catch (error) {
      // Log warning and fall back to defaults
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(
        'Invalid sanitization configuration, using defaults:',
        sanitizeErrorMessage(errorMessage)
      );
      this.allowList = new Set(DEFAULT_ALLOW_LIST);
      this.denyPatterns = [...DEFAULT_DENY_PATTERNS];
      this.denyMatcher = picomatch(this.denyPatterns, { nocase: true });
    }
  }

  /**
   * Sanitize an environment object by removing sensitive variables
   *
   * Variables are kept if:
   * 1. They are in the allow list, OR
   * 2. They do NOT match any deny patterns
   */
  sanitize(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(env)) {
      if (this.isAllowed(key)) {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Check if a variable name is allowed
   */
  isAllowed(varName: string): boolean {
    // Allow list takes precedence
    if (this.allowList.has(varName)) {
      return true;
    }

    // Check if it matches any deny patterns
    if (this.isDenied(varName)) {
      return false;
    }

    // If not in allow list and not denied, allow it
    return true;
  }

  /**
   * Check if a variable name matches any deny patterns
   */
  isDenied(varName: string): boolean {
    return this.denyMatcher(varName);
  }

  /**
   * Get the current allow list
   */
  getAllowList(): string[] {
    return Array.from(this.allowList);
  }

  /**
   * Get the current deny patterns
   */
  getDenyPatterns(): string[] {
    return [...this.denyPatterns];
  }
}
