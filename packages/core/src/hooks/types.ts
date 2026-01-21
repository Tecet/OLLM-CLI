/**
 * Core types for the hook system
 */

/**
 * Hook events that can trigger hook execution
 */
export type HookEvent =
  | 'session_start'
  | 'session_end'
  | 'before_agent'
  | 'after_agent'
  | 'before_model'
  | 'after_model'
  | 'before_tool_selection'
  | 'before_tool'
  | 'after_tool'
  | 'pre_compress'      // Before context compression
  | 'post_compress'     // After context compression
  | 'notification';     // General notification event

/**
 * Source of a hook determines its trust level
 */
export type HookSource = 'builtin' | 'user' | 'workspace' | 'downloaded' | 'extension';

/**
 * A hook is an executable script or command that runs in response to events
 */
export interface Hook {
  /** Unique identifier for the hook */
  id: string;
  /** Human-readable name */
  name: string;
  /** Command to execute */
  command: string;
  /** Optional command arguments */
  args?: string[];
  /** Source of the hook (determines trust level) */
  source: HookSource;
  /** Extension name if hook comes from an extension */
  extensionName?: string;
  /** Optional path to the hook script file (for hash computation) */
  sourcePath?: string;
}

/**
 * Input provided to a hook via stdin
 */
export interface HookInput {
  /** The event that triggered the hook */
  event: string;
  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Output expected from a hook via stdout
 */
export interface HookOutput {
  /** Whether to continue with the operation */
  continue: boolean;
  /** Optional system message to add to conversation */
  systemMessage?: string;
  /** Optional additional data to pass to subsequent hooks */
  data?: Record<string, unknown>;
  /** Optional error message if hook failed */
  error?: string;
}

/**
 * Context provided when planning hook execution
 */
export interface HookContext {
  /** Session identifier */
  sessionId: string;
  /** Event that triggered hooks */
  event: HookEvent;
  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Plan for executing hooks for an event
 */
export interface HookExecutionPlan {
  /** Hooks to execute */
  hooks: Hook[];
  /** Execution order strategy */
  order: 'registration' | 'priority';
  /** Whether to execute in parallel (future enhancement) */
  parallel: boolean;
}

/**
 * Approval record for a trusted hook
 */
export interface HookApproval {
  /** Source path of the hook */
  source: string;
  /** SHA-256 hash of the hook script */
  hash: string;
  /** Timestamp when approved */
  approvedAt: string;
  /** User who approved the hook */
  approvedBy: string;
}
