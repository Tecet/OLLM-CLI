import { createLogger } from '../utils/logger.js';

const logger = createLogger('config');
/**
 * Hook system configuration management
 * 
 * Provides default values, validation, and constants for hook system configuration.
 * All configuration options are optional and will be merged with defaults.
 * 
 * @module hooks/config
 */

import { z } from 'zod';

import type { HookSource } from './types.js';

/**
 * Hook configuration interface
 * 
 * Controls global hook system behavior. All fields are optional
 * and will be merged with defaults.
 * 
 * @example
 * ```typescript
 * const config: HooksConfig = {
 *   enabled: true,
 *   timeout: 60000, // 60 seconds
 *   trustWorkspace: false,
 * };
 * 
 * const merged = mergeHooksConfig(config);
 * ```
 */
export interface HooksConfig {
  /** 
   * Enable or disable all hooks
   * When false, all hooks are skipped
   * @default true
   */
  enabled?: boolean;
  
  /** 
   * Hook execution timeout in milliseconds
   * Hooks exceeding this timeout are killed
   * @default 30000 (30 seconds)
   */
  timeout?: number;
  
  /** 
   * Auto-trust workspace hooks without approval
   * When true, workspace hooks don't require user approval
   * Security risk: Only enable for trusted workspaces
   * @default false
   */
  trustWorkspace?: boolean;
}

/**
 * Zod schema for hook configuration validation
 * 
 * Validates configuration structure and types.
 * All fields are optional.
 */
export const hooksConfigSchema = z.object({
  enabled: z.boolean().optional(),
  timeout: z.number().int().positive().optional(),
  trustWorkspace: z.boolean().optional(),
});

/**
 * Default hook configuration values
 * 
 * These values are used when configuration is not provided
 * or when merging partial configurations.
 */
export const DEFAULT_HOOKS_CONFIG: Required<HooksConfig> = {
  enabled: true,
  timeout: 30000, // 30 seconds
  trustWorkspace: false,
};

/**
 * Maximum output size for hook stdout/stderr
 * Hooks exceeding this size are killed
 */
export const MAX_HOOK_OUTPUT_SIZE = 1024 * 1024; // 1MB

/**
 * Grace period for SIGKILL after SIGTERM
 * If hook doesn't exit after SIGTERM, SIGKILL is sent after this delay
 */
export const KILL_GRACE_PERIOD_MS = 1000; // 1 second

/**
 * Whitelisted commands that can be executed without absolute paths
 * 
 * These are standard system commands and package managers considered
 * safe to execute. All other commands must use absolute paths.
 * 
 * Security note: bash and sh are included but hooks using them
 * should be carefully reviewed as they can execute arbitrary code.
 */
export const WHITELISTED_COMMANDS = [
  'node',      // Node.js runtime
  'python',    // Python 2 interpreter
  'python3',   // Python 3 interpreter
  'bash',      // Bash shell
  'sh',        // POSIX shell
  'npx',       // Node package executor
  'uvx',       // UV package executor (for MCP servers)
] as const;

/**
 * Source priority for hook execution ordering
 * 
 * Lower numbers execute first. Hooks with the same priority
 * execute in registration order.
 */
export const SOURCE_PRIORITY: Record<HookSource, number> = {
  builtin: 0,      // Highest priority
  user: 1,
  workspace: 2,
  downloaded: 3,
  extension: 3,    // Same as downloaded
};

/**
 * Merge user configuration with defaults
 * 
 * Creates a complete configuration by merging user-provided
 * values with defaults. All fields will be present in result.
 * 
 * @param userConfig - Partial user configuration
 * @returns Complete configuration with all fields
 * 
 * @example
 * ```typescript
 * const config = mergeHooksConfig({ timeout: 60000 });
 * // Result: { enabled: true, timeout: 60000, trustWorkspace: false }
 * ```
 */
export function mergeHooksConfig(
  userConfig: Partial<HooksConfig> = {}
): Required<HooksConfig> {
  return {
    ...DEFAULT_HOOKS_CONFIG,
    ...userConfig,
  };
}

/**
 * Validate hook configuration
 * 
 * Validates configuration structure and types using Zod schema.
 * Throws ZodError if validation fails.
 * 
 * @param config - Configuration to validate
 * @returns Validated configuration
 * @throws {z.ZodError} if configuration is invalid
 * 
 * @example
 * ```typescript
 * try {
 *   const config = validateHooksConfig({ timeout: 60000 });
 * } catch (error) {
 *   if (error instanceof z.ZodError) {
 *     logger.error('Invalid config:', error.errors);
 *   }
 * }
 * ```
 */
export function validateHooksConfig(config: unknown): HooksConfig {
  return hooksConfigSchema.parse(config);
}

/**
 * Validate hook structure
 * 
 * Validates that a hook object has all required fields and
 * that field values are valid.
 * 
 * @param hook - Hook to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateHook(hook);
 * if (!result.valid) {
 *   logger.error('Invalid hook:', result.error);
 * }
 * ```
 */
export function validateHook(hook: unknown): { valid: boolean; error?: string } {
  if (typeof hook !== 'object' || hook === null) {
    return { valid: false, error: 'Hook must be an object' };
  }

  const h = hook as Record<string, unknown>;

  // Validate required fields
  if (typeof h.id !== 'string' || h.id.trim() === '') {
    return { valid: false, error: 'Hook id must be a non-empty string' };
  }

  if (typeof h.name !== 'string' || h.name.trim() === '') {
    return { valid: false, error: 'Hook name must be a non-empty string' };
  }

  if (typeof h.command !== 'string' || h.command.trim() === '') {
    return { valid: false, error: 'Hook command must be a non-empty string' };
  }

  if (typeof h.source !== 'string') {
    return { valid: false, error: 'Hook source must be a string' };
  }

  const validSources: HookSource[] = ['builtin', 'user', 'workspace', 'downloaded', 'extension'];
  if (!validSources.includes(h.source as HookSource)) {
    return { valid: false, error: `Hook source must be one of: ${validSources.join(', ')}` };
  }

  // Validate optional fields
  if (h.args !== undefined && !Array.isArray(h.args)) {
    return { valid: false, error: 'Hook args must be an array' };
  }

  if (h.args !== undefined) {
    for (const arg of h.args as unknown[]) {
      if (typeof arg !== 'string') {
        return { valid: false, error: 'All hook args must be strings' };
      }
    }
  }

  if (h.extensionName !== undefined && typeof h.extensionName !== 'string') {
    return { valid: false, error: 'Hook extensionName must be a string' };
  }

  if (h.sourcePath !== undefined && typeof h.sourcePath !== 'string') {
    return { valid: false, error: 'Hook sourcePath must be a string' };
  }

  return { valid: true };
}

/**
 * Validate hook ID format
 * 
 * Hook IDs must be non-empty strings without special characters.
 * Allowed: alphanumeric, dash, underscore
 * 
 * @param id - Hook ID to validate
 * @returns true if ID is valid
 * 
 * @example
 * ```typescript
 * validateHookId('my-hook-123'); // true
 * validateHookId('my hook');     // false (space not allowed)
 * validateHookId('');            // false (empty)
 * ```
 */
export function validateHookId(id: string): boolean {
  if (typeof id !== 'string' || id.trim() === '') {
    return false;
  }

  // Allow alphanumeric, dash, underscore
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Validate hook command for security
 * 
 * Checks for shell metacharacters and ensures command is either
 * an absolute path or a whitelisted command.
 * 
 * @param command - Command to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateHookCommand('node');
 * if (!result.valid) {
 *   logger.error('Invalid command:', result.error);
 * }
 * ```
 */
export function validateHookCommand(command: string): { valid: boolean; error?: string } {
  if (typeof command !== 'string' || command.trim() === '') {
    return { valid: false, error: 'Command must be a non-empty string' };
  }

  // Check for shell metacharacters
  if (/[;&|`$(){}[\]<>]/.test(command)) {
    return { valid: false, error: 'Command contains invalid shell metacharacters' };
  }

  // Check if command is absolute path or whitelisted
  const isAbsolute = command.startsWith('/') || /^[A-Z]:\\/.test(command);
  const isWhitelisted = WHITELISTED_COMMANDS.includes(command as typeof WHITELISTED_COMMANDS[number]);

  if (!isAbsolute && !isWhitelisted) {
    return { 
      valid: false, 
      error: `Command must be absolute path or one of: ${WHITELISTED_COMMANDS.join(', ')}` 
    };
  }

  return { valid: true };
}
