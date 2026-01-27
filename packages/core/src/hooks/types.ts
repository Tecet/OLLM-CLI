/**
 * Core types for the hook system
 * 
 * The hook system provides event-driven customization for OLLM CLI.
 * Hooks are executable scripts that run at specific lifecycle events,
 * allowing users and extensions to modify behavior without changing core code.
 * 
 * @module hooks/types
 */

/**
 * Hook events that can trigger hook execution
 * 
 * Events are organized by lifecycle phase:
 * - Session events: session_start, session_end
 * - Agent events: before_agent, after_agent
 * - Model events: before_model, after_model
 * - Tool events: before_tool_selection, before_tool, after_tool
 * - Context events: pre_compress, post_compress
 * - General events: notification
 * 
 * @example
 * ```typescript
 * const event: HookEvent = 'before_model';
 * registry.registerHook(event, myHook);
 * ```
 */
export type HookEvent =
  | 'session_start'        // When a new session begins
  | 'session_end'          // When a session ends
  | 'session_saved'        // When a session is saved (rollback precursor)
  | 'before_agent'         // Before agent processes user input
  | 'after_agent'          // After agent generates response
  | 'before_model'         // Before calling the LLM
  | 'after_model'          // After receiving LLM response
  | 'before_tool_selection' // Before selecting tools to use
  | 'before_tool'          // Before executing a tool
  | 'after_tool'           // After tool execution completes
  | 'pre_compress'         // Before context compression
  | 'post_compress'        // After context compression
  | 'notification';        // General notification event

/**
 * Source of a hook determines its trust level
 * 
 * Trust hierarchy (from most to least trusted):
 * 1. builtin - Shipped with CLI, always trusted
 * 2. user - From ~/.ollm/, always trusted
 * 3. workspace - From .ollm/, requires approval (unless trustWorkspace enabled)
 * 4. downloaded - From extensions, requires approval
 * 5. extension - From extensions, requires approval
 * 
 * @see {@link TrustedHooks} for trust verification logic
 * 
 * @example
 * ```typescript
 * const hook: Hook = {
 *   id: 'my-hook',
 *   name: 'My Hook',
 *   command: 'node',
 *   args: ['hook.js'],
 *   source: 'user', // Always trusted
 * };
 * ```
 */
export type HookSource = 'builtin' | 'user' | 'workspace' | 'downloaded' | 'extension';

/**
 * A hook is an executable script or command that runs in response to events
 * 
 * Hooks communicate via JSON protocol over stdin/stdout:
 * - Input: { event: string, data: Record<string, unknown> }
 * - Output: { continue: boolean, systemMessage?: string, data?: Record<string, unknown> }
 * 
 * Security considerations:
 * - Commands are validated to prevent shell injection
 * - Hooks run with timeout enforcement (default: 30s)
 * - Output size is limited (default: 1MB)
 * - Trust verification required for workspace/downloaded hooks
 * 
 * @example
 * ```typescript
 * const hook: Hook = {
 *   id: 'log-model-calls',
 *   name: 'Log Model Calls',
 *   command: 'node',
 *   args: ['log-hook.js'],
 *   source: 'user',
 *   sourcePath: '/home/user/.ollm/hooks/log-hook.js',
 * };
 * 
 * registry.registerHook('before_model', hook);
 * ```
 */
export interface Hook {
  /** 
   * Unique identifier for the hook
   * Must be unique across all hooks in the registry
   */
  id: string;
  
  /** 
   * Human-readable name displayed in UI
   * Should be descriptive and concise
   */
  name: string;
  
  /** 
   * Command to execute (e.g., 'node', 'python', 'bash')
   * Must be absolute path or whitelisted command
   * Validated to prevent shell injection
   */
  command: string;
  
  /** 
   * Optional command arguments
   * Each argument is passed separately (no shell parsing)
   */
  args?: string[];
  
  /** 
   * Source of the hook (determines trust level)
   * @see {@link HookSource} for trust hierarchy
   */
  source: HookSource;
  
  /** 
   * Extension name if hook comes from an extension
   * Used for grouping and display purposes
   */
  extensionName?: string;
  
  /** 
   * Optional path to the hook script file
   * Used for hash computation and trust verification
   * If not provided, hash is computed from command/args
   */
  sourcePath?: string;
}

/**
 * Input provided to a hook via stdin
 * 
 * Hooks receive this JSON structure on stdin and must parse it
 * to determine what event triggered them and what data is available.
 * 
 * @example
 * ```typescript
 * const input: HookInput = {
 *   event: 'before_model',
 *   data: {
 *     messages: [...],
 *     model: 'llama2',
 *   },
 * };
 * 
 * // Hook receives this as JSON on stdin:
 * // {
 * //   "event": "before_model",
 * //   "data": {
 * //     "messages": [...],
 * //     "model": "llama2"
 * //   }
 * // }
 * ```
 */
export interface HookInput {
  /** 
   * The event that triggered the hook
   * Hooks can use this to determine what action to take
   */
  event: string;
  
  /** 
   * Event-specific data
   * Structure varies by event type
   * @see {@link HookTranslator} for event-specific data structures
   */
  data: Record<string, unknown>;
}

/**
 * Output expected from a hook via stdout
 * 
 * Hooks must write this JSON structure to stdout. The system
 * will parse it and use the values to determine how to proceed.
 * 
 * Control flow:
 * - continue: true - Proceed with operation
 * - continue: false - Abort operation (e.g., block tool execution)
 * 
 * @example
 * ```typescript
 * // Hook allows operation to continue
 * const output: HookOutput = {
 *   continue: true,
 *   systemMessage: 'Hook executed successfully',
 * };
 * 
 * // Hook blocks operation
 * const output: HookOutput = {
 *   continue: false,
 *   systemMessage: 'Operation blocked by security policy',
 * };
 * 
 * // Hook passes data to next hook
 * const output: HookOutput = {
 *   continue: true,
 *   data: {
 *     customField: 'value',
 *   },
 * };
 * ```
 */
export interface HookOutput {
  /** 
   * Whether to continue with the operation
   * - true: Proceed normally
   * - false: Abort operation (no further hooks execute)
   */
  continue: boolean;
  
  /** 
   * Optional system message to add to conversation
   * Displayed to user and included in context
   */
  systemMessage?: string;
  
  /** 
   * Optional additional data to pass to subsequent hooks
   * Merged with input data for next hook in sequence
   */
  data?: Record<string, unknown>;
  
  /** 
   * Optional error message if hook failed
   * Hook failures don't abort operation by default
   * Set continue: false to abort on error
   */
  error?: string;
}

/**
 * Context provided when planning hook execution
 * 
 * Used by HookPlanner to determine which hooks to execute
 * and in what order. Contains session and event information.
 * 
 * @example
 * ```typescript
 * const context: HookContext = {
 *   sessionId: 'abc123',
 *   event: 'before_model',
 *   data: {
 *     messages: [...],
 *     model: 'llama2',
 *   },
 * };
 * 
 * const plan = planner.planExecution(context.event, context);
 * ```
 */
export interface HookContext {
  /** 
   * Session identifier
   * Unique ID for the current session
   */
  sessionId: string;
  
  /** 
   * Event that triggered hooks
   * Determines which hooks are eligible for execution
   */
  event: HookEvent;
  
  /** 
   * Event-specific data
   * Passed to hooks as input
   */
  data: Record<string, unknown>;
}

/**
 * Plan for executing hooks for an event
 * 
 * Created by HookPlanner to determine execution strategy.
 * Contains ordered list of hooks and execution parameters.
 * 
 * @example
 * ```typescript
 * const plan: HookExecutionPlan = {
 *   hooks: [builtinHook, userHook, workspaceHook],
 *   order: 'priority',
 *   parallel: false,
 * };
 * 
 * const results = await runner.executeHooks(plan.hooks, input);
 * ```
 */
export interface HookExecutionPlan {
  /** 
   * Hooks to execute in order
   * Ordered by source priority (builtin > user > workspace > downloaded)
   */
  hooks: Hook[];
  
  /** 
   * Execution order strategy
   * - 'registration': Execute in registration order
   * - 'priority': Execute by source priority
   */
  order: 'registration' | 'priority';
  
  /** 
   * Whether to execute in parallel
   * Currently always false (sequential execution)
   * Future enhancement for independent hooks
   */
  parallel: boolean;
}

/**
 * Approval record for a trusted hook
 * 
 * Stores user approval for workspace/downloaded hooks.
 * Includes SHA-256 hash to detect script modifications.
 * 
 * Security:
 * - Hash is recomputed on each execution
 * - If hash doesn't match, re-approval is required
 * - Prevents malicious script modifications
 * 
 * @example
 * ```typescript
 * const approval: HookApproval = {
 *   source: '/workspace/.ollm/hooks/my-hook.js',
 *   hash: 'sha256:abc123...',
 *   approvedAt: '2026-01-22T10:00:00Z',
 *   approvedBy: 'user',
 * };
 * 
 * await trustedHooks.storeApproval(hook, approval.hash);
 * ```
 */
export interface HookApproval {
  /** 
   * Source path of the hook
   * Unique identifier for the approval record
   */
  source: string;
  
  /** 
   * SHA-256 hash of the hook script
   * Format: 'sha256:hexdigest'
   * Used to detect modifications
   */
  hash: string;
  
  /** 
   * Timestamp when approved
   * ISO 8601 format
   */
  approvedAt: string;
  
  /** 
   * User who approved the hook
   * From environment variables (USER or USERNAME)
   */
  approvedBy: string;
}
