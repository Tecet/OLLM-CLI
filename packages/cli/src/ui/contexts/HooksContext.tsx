/**
 * HooksContext - Manages hook state and operations for the Hooks Panel UI
 * 
 * Provides centralized state management for:
 * - Loading hooks from HookRegistry
 * - Managing enabled/disabled state via SettingsService
 * - Categorizing hooks by event type
 * - Error handling for corrupted hooks
 */

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';

import { SettingsService } from '../../config/settingsService.js';
import { useServices } from '../../features/context/ServiceContext.js';
import { loadHooksFromFiles } from '../../services/hookLoader.js';

import type { HookRegistry } from '@ollm/ollm-cli-core/hooks/index.js';
import type { Hook, HookEvent } from '@ollm/ollm-cli-core/hooks/types.js';
import type { ServiceContainer } from '@ollm/ollm-cli-core/services/serviceContainer.js';

/**
 * Hook category for organizing hooks in the UI
 */
export interface HookCategory {
  /** Category display name */
  name: string;
  /** Event types included in this category */
  eventTypes: HookEvent[];
  /** Hooks in this category */
  hooks: Hook[];
  /** Icon for the category */
  icon: string;
}

/**
 * Hook state in the context
 */
export interface HooksState {
  /** All hooks organized by category */
  categories: HookCategory[];
  /** All hooks as a flat array */
  allHooks: Hook[];
  /** Set of enabled hook IDs */
  enabledHooks: Set<string>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: string | null;
  /** Corrupted hooks that failed to load */
  corruptedHooks: Array<{ id: string; error: string }>;
}

/**
 * Hook context value
 */
export interface HooksContextValue {
  /** Current state */
  state: HooksState;
  /** Reload hooks from registry */
  refreshHooks: () => Promise<void>;
  /** Toggle hook enabled state */
  toggleHook: (hookId: string) => Promise<void>;
  /** Check if a hook is enabled */
  isHookEnabled: (hookId: string) => boolean;
  /** Get hook by ID */
  getHook: (hookId: string) => Hook | undefined;
}

const HooksContext = createContext<HooksContextValue | undefined>(undefined);

/**
 * Hook to access hooks context
 */
export function useHooks(): HooksContextValue {
  const context = useContext(HooksContext);
  if (!context) {
    throw new Error('useHooks must be used within a HooksProvider');
  }
  return context;
}

export interface HooksProviderProps {
  children: ReactNode;
  /** Optional SettingsService instance (for testing) */
  settingsService?: SettingsService;
  /** Optional HookRegistry instance (for testing) */
  hookRegistry?: HookRegistry;
}

/**
 * Provider for hooks management
 */
export function HooksProvider({ 
  children, 
  settingsService: customSettings,
  hookRegistry: customRegistry
}: HooksProviderProps) {
  const [state, setState] = useState<HooksState>({
    categories: [],
    allHooks: [],
    enabledHooks: new Set(),
    isLoading: true,
    error: null,
    corruptedHooks: [],
  });

  // Get central hook registry from service container
  // Try to get the central service container; tests may not provide a ServiceProvider
  let container: ServiceContainer | undefined;
  try {
    // If a ServiceProvider is present, this will return the container.
    // If not, `useServices()` throws; we catch and treat container as undefined.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    container = useServices().container;
  } catch {
    container = undefined;
  }

  const hookRegistry = useMemo(() => {
    if (customRegistry) return customRegistry;
    if (!container) return null;
    return container.getHookService().getRegistry();
  }, [container, customRegistry]);
  
  const settingsService = useMemo(() => customSettings || SettingsService.getInstance(), [customSettings]);
  // Debug: log whether we are using a custom settings instance (tests) or the singleton
  console.debug('[HooksProvider] using customSettings?', !!customSettings);
  console.debug('[HooksProvider] settingsService identity', settingsService);

  /**
   * Categorize hooks by event type
   */
  const categorizeHooks = useCallback((hooksMap: Map<HookEvent, Hook[]>): HookCategory[] => {
    // Define category mappings
    const categoryMap: Record<string, { name: string; eventTypes: HookEvent[]; icon: string }> = {
      session: {
        name: 'Session Events',
        eventTypes: ['session_start', 'session_end'],
        icon: '🔄',
      },
      agent: {
        name: 'Agent Events',
        eventTypes: ['before_agent', 'after_agent'],
        icon: '🤖',
      },
      model: {
        name: 'Model Events',
        eventTypes: ['before_model', 'after_model'],
        icon: '🧠',
      },
      tool: {
        name: 'Tool Events',
        eventTypes: ['before_tool_selection', 'before_tool', 'after_tool'],
        icon: '🔧',
      },
      compression: {
        name: 'Compression Events',
        eventTypes: ['pre_compress', 'post_compress'],
        icon: '📦',
      },
      notification: {
        name: 'Notifications',
        eventTypes: ['notification'],
        icon: '🔔',
      },
    };

    // Group hooks by category
    const categories: HookCategory[] = [];
    
    for (const [_categoryKey, categoryDef] of Object.entries(categoryMap)) {
      const categoryHooks: Hook[] = [];
      
      // Collect hooks from all event types in this category
      for (const eventType of categoryDef.eventTypes) {
        const hooksForEvent = hooksMap.get(eventType) || [];
        categoryHooks.push(...hooksForEvent);
      }

      if (categoryHooks.length > 0) {
        categories.push({
          name: categoryDef.name,
          eventTypes: categoryDef.eventTypes,
          hooks: categoryHooks,
          icon: categoryDef.icon,
        });
      }
    }

    return categories;
  }, []);

  /**
   * Load hooks from registry and settings
   */
  const refreshHooks = useCallback(async () => {
    // Don't proceed if hook registry is not available yet
    if (!hookRegistry) {
      setState(prev => ({ ...prev, isLoading: false, error: 'Hook registry not initialized' }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get all hooks from registry organized by event
      const allHooksMap = hookRegistry.getAllHooks();
      const allHooks: Hook[] = [];
      const corruptedHooks: Array<{ id: string; error: string }> = [];

      // Flatten hooks from all events
      for (const [_event, hooks] of allHooksMap.entries()) {
        for (const hook of hooks) {
          try {
            // Validate hook structure
            if (!hook.id || !hook.name || !hook.command) {
              corruptedHooks.push({
                id: hook.id || 'unknown',
                error: 'Missing required fields (id, name, or command)',
              });
              continue;
            }
            allHooks.push(hook);
          } catch (_err) {
            corruptedHooks.push({
              id: hook.id || 'unknown',
              error: _err instanceof Error ? _err.message : 'Unknown error',
            });
          }
        }
      }

      // Get enabled state from settings
      const hookSettings = settingsService.getHookSettings();
      // Debug: snapshot of settings read
      try {
        console.debug('[HooksProvider] read hookSettings', JSON.stringify(hookSettings));
      } catch {
        console.debug('[HooksProvider] read hookSettings (unserializable)');
      }
      const enabledHooks = new Set<string>();
      
      for (const hook of allHooks) {
        // Default to enabled if not explicitly set
        const isEnabled = hookSettings.enabled[hook.id] ?? true;
        if (isEnabled) {
          enabledHooks.add(hook.id);
        }
      }

      // Categorize hooks using the map
      const categories = categorizeHooks(allHooksMap);

      setState({
        categories,
        allHooks,
        enabledHooks,
        isLoading: false,
        error: null,
        corruptedHooks,
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load hooks',
      }));
    }
  }, [hookRegistry, settingsService, categorizeHooks]);

  /**
   * Toggle hook enabled state
   */
  const toggleHook = useCallback(async (hookId: string) => {
    try {
      const currentlyEnabled = state.enabledHooks.has(hookId);
      const newEnabledState = !currentlyEnabled;

      // Update settings
      console.debug('[HooksProvider] setHookEnabled', hookId, newEnabledState);
      settingsService.setHookEnabled(hookId, newEnabledState);

      // Update local state
      setState(prev => {
        const newEnabledHooks = new Set(prev.enabledHooks);
        if (newEnabledState) {
          newEnabledHooks.add(hookId);
        } else {
          newEnabledHooks.delete(hookId);
        }

        console.debug('[HooksProvider] updating local enabledHooks for', hookId, '->', newEnabledState);

        return {
          ...prev,
          enabledHooks: newEnabledHooks,
        };
      });
    } catch (error) {
      // Revert on error
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to toggle hook',
      }));
    }
  }, [state.enabledHooks, settingsService]);

  /**
   * Check if a hook is enabled
   */
  const isHookEnabled = useCallback((hookId: string): boolean => {
    return state.enabledHooks.has(hookId);
  }, [state.enabledHooks]);

  /**
   * Get hook by ID
   */
  const getHook = useCallback((hookId: string): Hook | undefined => {
    return state.allHooks.find(h => h.id === hookId);
  }, [state.allHooks]);

  // Load hooks from files and then refresh
  useEffect(() => {
    const initializeHooks = async () => {
      // Wait for hook registry to be available
      if (!hookRegistry) return;
      
      // Load hooks from JSON files only when not using a custom registry (tests provide customRegistry)
      if (!customRegistry) {
        await loadHooksFromFiles(hookRegistry);
      }

      // Refresh the UI state
      await refreshHooks();
    };
    
    initializeHooks();
  }, [hookRegistry, customRegistry, refreshHooks]);

  const value: HooksContextValue = {
    state,
    refreshHooks,
    toggleHook,
    isHookEnabled,
    getHook,
  };

  return <HooksContext.Provider value={value}>{children}</HooksContext.Provider>;
}
