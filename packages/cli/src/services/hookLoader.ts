/**
 * Hook Loader Service
 *
 * Loads hooks from JSON files and registers them in the HookRegistry.
 * This bridges the gap between the file-based UIHook format and the
 * runtime HookRegistry.
 */

import { HookRegistry } from '@ollm/ollm-cli-core/hooks/hookRegistry.js';

import { hookFileService } from './hookFileService.js';
import { uiHookToCoreHook } from '../features/hooks/adapter.js';

import type { UIHook } from '../features/hooks/types.js';
import type { HookEvent } from '@ollm/ollm-cli-core/hooks/types.js';

/**
 * Map UI event types to core hook events
 */
const UI_TO_CORE_EVENT_MAP: Record<string, HookEvent> = {
  fileEdited: 'before_tool',
  fileCreated: 'before_tool',
  fileDeleted: 'before_tool',
  userTriggered: 'notification',
  promptSubmit: 'before_agent',
  agentStop: 'after_agent',
};

/**
 * Load hooks from JSON files and register them in the HookRegistry
 *
 * @param registry - HookRegistry instance to register hooks in
 * @returns Number of hooks loaded
 */
export async function loadHooksFromFiles(registry: HookRegistry): Promise<number> {
  let loadedCount = 0;

  try {
    // Load user hooks from ~/.ollm/hooks/
    const userHooks = await hookFileService.loadUserHooks();
    for (const uiHook of userHooks) {
      try {
        registerUIHook(registry, uiHook);
        loadedCount++;
      } catch (error) {
        console.error(`Failed to register user hook ${uiHook.id}:`, error);
      }
    }

    // Load workspace hooks from .ollm/hooks/
    const workspaceHooks = await hookFileService.loadWorkspaceHooks();
    for (const uiHook of workspaceHooks) {
      try {
        registerUIHook(registry, uiHook);
        loadedCount++;
      } catch (error) {
        console.error(`Failed to register workspace hook ${uiHook.id}:`, error);
      }
    }

    console.log(`Loaded ${loadedCount} hooks from files`);
  } catch (error) {
    console.error('Error loading hooks from files:', error);
  }

  return loadedCount;
}

/**
 * Register a UIHook in the HookRegistry
 *
 * @param registry - HookRegistry instance
 * @param uiHook - UIHook to register
 */
function registerUIHook(registry: HookRegistry, uiHook: UIHook): void {
  // Convert UIHook to core Hook
  const coreHook = uiHookToCoreHook(uiHook);

  // Determine the event type to register under
  const eventType = UI_TO_CORE_EVENT_MAP[uiHook.when.type] || 'notification';

  // Register the hook
  registry.registerHook(eventType, coreHook);
}

/**
 * Initialize hooks by loading from files and registering in registry
 *
 * This should be called during application startup.
 *
 * @param registry - Optional HookRegistry instance (creates new if not provided)
 * @returns HookRegistry with loaded hooks
 */
export async function initializeHooks(registry?: HookRegistry): Promise<HookRegistry> {
  const hookRegistry = registry || new HookRegistry();

  await loadHooksFromFiles(hookRegistry);

  return hookRegistry;
}
