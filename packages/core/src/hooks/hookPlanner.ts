/**
 * HookPlanner determines which hooks to execute for an event
 * 
 * Implements ordering logic to ensure user extension hooks execute
 * before workspace extension hooks, maintaining registration order
 * within each source type.
 */

import type { Hook, HookEvent, HookContext, HookExecutionPlan } from './types.js';
import type { HookRegistry } from './hookRegistry.js';

/**
 * Planner for determining hook execution order
 */
export class HookPlanner {
  constructor(private registry: HookRegistry) {}

  /**
   * Plan hook execution for an event
   * 
   * Orders hooks by source priority:
   * 1. Built-in hooks
   * 2. User hooks
   * 3. Workspace hooks
   * 4. Downloaded hooks
   * 
   * Within each source type, maintains registration order.
   * 
   * @param event - The event to plan execution for
   * @param context - Context information for the event
   * @returns Execution plan with ordered hooks
   */
  planExecution(event: HookEvent, _context: HookContext): HookExecutionPlan {
    // Get all hooks for this event
    const hooks = this.registry.getHooksForEvent(event);

    // Order hooks by source priority
    const orderedHooks = this.orderHooksBySource(hooks);

    return {
      hooks: orderedHooks,
      order: 'priority',
      parallel: false, // Sequential execution for now
    };
  }

  /**
   * Order hooks by source priority while maintaining registration order
   * within each source type
   * 
   * Priority order:
   * 1. builtin
   * 2. user
   * 3. workspace
   * 4. downloaded
   * 
   * @param hooks - Hooks to order
   * @returns Ordered hooks
   */
  private orderHooksBySource(hooks: Hook[]): Hook[] {
    const sourcePriority: Record<string, number> = {
      builtin: 0,
      user: 1,
      workspace: 2,
      downloaded: 3,
    };

    // Stable sort by source priority
    return [...hooks].sort((a, b) => {
      const priorityA = sourcePriority[a.source] ?? 999;
      const priorityB = sourcePriority[b.source] ?? 999;
      return priorityA - priorityB;
    });
  }
}
