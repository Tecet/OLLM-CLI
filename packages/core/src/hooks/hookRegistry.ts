/**
 * HookRegistry manages registration and discovery of hooks
 * 
 * Maintains a registry of hooks organized by event type, preserving
 * insertion order for deterministic execution.
 */

import type { Hook, HookEvent } from './types.js';

/**
 * Registry for managing hook registration and retrieval
 */
export class HookRegistry {
  private hooks: Map<HookEvent, Hook[]>;
  private hookById: Map<string, Hook>;

  constructor() {
    this.hooks = new Map();
    this.hookById = new Map();
  }

  /**
   * Register a hook for a specific event
   * 
   * @param event - The event to register the hook for
   * @param hook - The hook to register
   */
  registerHook(event: HookEvent, hook: Hook): void {
    // Get or create the hooks array for this event
    const eventHooks = this.hooks.get(event) || [];
    
    // Add the hook to the event's hooks array
    eventHooks.push(hook);
    
    // Update the map
    this.hooks.set(event, eventHooks);
    
    // Store hook by ID for quick lookup
    this.hookById.set(hook.id, hook);
  }

  /**
   * Get all hooks registered for a specific event
   * 
   * @param event - The event to get hooks for
   * @returns Array of hooks in registration order
   */
  getHooksForEvent(event: HookEvent): Hook[] {
    return this.hooks.get(event) || [];
  }

  /**
   * Unregister a hook by its ID
   * 
   * @param hookId - The ID of the hook to unregister
   * @returns true if hook was found and removed, false otherwise
   */
  unregisterHook(hookId: string): boolean {
    const hook = this.hookById.get(hookId);
    if (!hook) {
      return false;
    }

    // Remove from hookById map
    this.hookById.delete(hookId);

    // Remove from all event arrays
    for (const [event, eventHooks] of this.hooks.entries()) {
      const index = eventHooks.findIndex((h) => h.id === hookId);
      if (index !== -1) {
        eventHooks.splice(index, 1);
        // Update the map with the modified array
        this.hooks.set(event, eventHooks);
      }
    }

    return true;
  }

  /**
   * Get all registered hooks organized by event
   * 
   * @returns Map of events to their registered hooks
   */
  getAllHooks(): Map<HookEvent, Hook[]> {
    // Return a copy to prevent external modification
    const copy = new Map<HookEvent, Hook[]>();
    for (const [event, hooks] of this.hooks.entries()) {
      copy.set(event, [...hooks]);
    }
    return copy;
  }

  /**
   * Clear all hooks for a specific event
   * 
   * @param event - The event to clear hooks for
   */
  clearEvent(event: HookEvent): void {
    const eventHooks = this.hooks.get(event) || [];
    
    // Remove all hooks for this event from hookById map
    for (const hook of eventHooks) {
      this.hookById.delete(hook.id);
    }
    
    // Clear the event's hooks array
    this.hooks.delete(event);
  }

  /**
   * Clear all hooks from the registry
   */
  clear(): void {
    this.hooks.clear();
    this.hookById.clear();
  }

  /**
   * Get the total number of registered hooks
   * 
   * @returns Total count of hooks across all events
   */
  getHookCount(): number {
    return this.hookById.size;
  }

  /**
   * Check if a hook is registered
   * 
   * @param hookId - The ID of the hook to check
   * @returns true if the hook is registered
   */
  hasHook(hookId: string): boolean {
    return this.hookById.has(hookId);
  }

  /**
   * Get a hook by its ID
   * 
   * @param hookId - The ID of the hook to retrieve
   * @returns The hook if found, undefined otherwise
   */
  getHook(hookId: string): Hook | undefined {
    return this.hookById.get(hookId);
  }

  /**
   * Get all hooks organized by event type (category)
   * 
   * @returns Map of event types to their hooks
   */
  getHooksByCategory(): Map<HookEvent, Hook[]> {
    return this.getAllHooks();
  }

  /**
   * Get all user-created hooks
   * 
   * @returns Array of hooks with source 'user'
   */
  getUserHooks(): Hook[] {
    return Array.from(this.hookById.values()).filter(
      (hook) => hook.source === 'user'
    );
  }

  /**
   * Get all built-in hooks
   * 
   * @returns Array of hooks with source 'builtin'
   */
  getBuiltinHooks(): Hook[] {
    return Array.from(this.hookById.values()).filter(
      (hook) => hook.source === 'builtin'
    );
  }

  /**
   * Check if a hook can be edited
   * Only user-created hooks can be edited
   * 
   * @param hookId - The ID of the hook to check
   * @returns true if the hook can be edited
   */
  isEditable(hookId: string): boolean {
    const hook = this.hookById.get(hookId);
    return hook?.source === 'user';
  }

  /**
   * Check if a hook can be deleted
   * Only user-created hooks can be deleted
   * 
   * @param hookId - The ID of the hook to check
   * @returns true if the hook can be deleted
   */
  isDeletable(hookId: string): boolean {
    const hook = this.hookById.get(hookId);
    return hook?.source === 'user';
  }
}
