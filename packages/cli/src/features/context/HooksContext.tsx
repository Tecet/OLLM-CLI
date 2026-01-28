/**
 * HooksContext - State management for the Hooks Panel UI
 *
 * Provides hook data and management functions to all hook-related components.
 * Integrates with HookFileService for file operations and SettingsService for
 * enabled state persistence.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

import { SettingsService } from '../../config/settingsService.js';
import { HookFileService } from '../../services/hookFileService.js';

import type { UIHook, HookCategory, HookTestResult, UIHookEventType } from '../hooks/types.js';

/**
 * Context value interface
 */
export interface HooksContextValue {
  // Data
  hooks: UIHook[];
  categories: HookCategory[];
  enabledHooks: Set<string>;
  loading: boolean;
  error: string | null;

  // Actions
  toggleHook: (hookId: string) => Promise<void>;
  addHook: (hook: Omit<UIHook, 'id' | 'enabled' | 'trusted' | 'source'>) => Promise<void>;
  editHook: (hookId: string, updates: Partial<UIHook>) => Promise<void>;
  deleteHook: (hookId: string) => Promise<void>;
  testHook: (hookId: string) => Promise<HookTestResult>;
  refreshHooks: () => Promise<void>;
}

/**
 * Create the context
 */
const HooksContext = createContext<HooksContextValue | undefined>(undefined);

/**
 * Props for HooksProvider
 */
export interface HooksProviderProps {
  children: React.ReactNode;
}

/**
 * HooksProvider component
 * Manages hook state and provides hook management functions
 */
export const HooksProvider: React.FC<HooksProviderProps> = ({ children }) => {
  const [hooks, setHooks] = useState<UIHook[]>([]);
  const [enabledHooks, setEnabledHooks] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Services
  const hookFileService = useMemo(() => new HookFileService(), []);
  const settingsService = useMemo(() => SettingsService.getInstance(), []);

  /**
   * Load hooks from file system and settings
   */
  const loadHooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load hooks from user and workspace directories
      const [userHooks, workspaceHooks] = await Promise.all([
        hookFileService.loadUserHooks(),
        hookFileService.loadWorkspaceHooks(),
      ]);

      // Combine all hooks
      const allHooks = [...userHooks, ...workspaceHooks];

      // Load enabled state from settings
      const hookSettings = settingsService.getHookSettings();
      const enabled = new Set<string>();

      // Apply enabled state from settings
      allHooks.forEach((hook) => {
        // Default to enabled if not in settings
        const isEnabled = hookSettings.enabled[hook.id] ?? true;
        hook.enabled = isEnabled;
        if (isEnabled) {
          enabled.add(hook.id);
        }
      });

      setHooks(allHooks);
      setEnabledHooks(enabled);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load hooks';
      setError(errorMessage);
      console.error('Error loading hooks:', err);
    } finally {
      setLoading(false);
    }
  }, [hookFileService, settingsService]);

  /**
   * Initialize hooks on mount
   */
  useEffect(() => {
    loadHooks();
  }, [loadHooks]);

  /**
   * Categorize hooks by event type
   */
  const categories = useMemo<HookCategory[]>(() => {
    const fileEvents: UIHook[] = [];
    const promptEvents: UIHook[] = [];
    const userTriggered: UIHook[] = [];

    for (const hook of hooks) {
      switch (hook.when.type) {
        case 'fileEdited':
        case 'fileCreated':
        case 'fileDeleted':
          fileEvents.push(hook);
          break;
        case 'promptSubmit':
        case 'agentStop':
          promptEvents.push(hook);
          break;
        case 'userTriggered':
          userTriggered.push(hook);
          break;
      }
    }

    return [
      {
        name: 'File Events',
        eventTypes: ['fileEdited', 'fileCreated', 'fileDeleted'] as UIHookEventType[],
        hooks: fileEvents,
        expanded: true,
      },
      {
        name: 'Prompt Events',
        eventTypes: ['promptSubmit', 'agentStop'] as UIHookEventType[],
        hooks: promptEvents,
        expanded: true,
      },
      {
        name: 'User Triggered',
        eventTypes: ['userTriggered'] as UIHookEventType[],
        hooks: userTriggered,
        expanded: true,
      },
    ];
  }, [hooks]);

  /**
   * Toggle hook enabled state
   */
  const toggleHook = useCallback(
    async (hookId: string) => {
      try {
        const hook = hooks.find((h) => h.id === hookId);
        if (!hook) {
          throw new Error(`Hook not found: ${hookId}`);
        }

        const newEnabledState = !enabledHooks.has(hookId);

        // Update settings
        settingsService.setHookEnabled(hookId, newEnabledState);

        // Update local state
        setEnabledHooks((prev) => {
          const next = new Set(prev);
          if (newEnabledState) {
            next.add(hookId);
          } else {
            next.delete(hookId);
          }
          return next;
        });

        // Update hook object
        setHooks((prev) =>
          prev.map((h) => (h.id === hookId ? { ...h, enabled: newEnabledState } : h))
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to toggle hook';
        setError(errorMessage);
        throw err;
      }
    },
    [hooks, enabledHooks, settingsService]
  );

  /**
   * Add a new hook
   */
  const addHook = useCallback(
    async (hookData: Omit<UIHook, 'id' | 'enabled' | 'trusted' | 'source'>) => {
      try {
        // Generate unique ID from name
        const hookId = hookData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        // Check if hook with this ID already exists
        if (hooks.some((h) => h.id === hookId)) {
          throw new Error(`Hook with ID "${hookId}" already exists`);
        }

        // Create full hook object
        const newHook: UIHook = {
          ...hookData,
          id: hookId,
          enabled: true,
          trusted: false,
          source: 'user',
        };

        // Save to file system
        await hookFileService.saveHook(newHook);

        // Enable by default
        settingsService.setHookEnabled(hookId, true);

        // Refresh hooks list
        await loadHooks();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to add hook';
        setError(errorMessage);
        throw err;
      }
    },
    [hooks, hookFileService, settingsService, loadHooks]
  );

  /**
   * Edit an existing hook
   */
  const editHook = useCallback(
    async (hookId: string, updates: Partial<UIHook>) => {
      try {
        const hook = hooks.find((h) => h.id === hookId);
        if (!hook) {
          throw new Error(`Hook not found: ${hookId}`);
        }

        // Check if hook is editable
        if (hook.source === 'builtin') {
          throw new Error('Cannot edit built-in hooks');
        }

        // Update hook file
        await hookFileService.updateHook(hookId, updates);

        // Refresh hooks list
        await loadHooks();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to edit hook';
        setError(errorMessage);
        throw err;
      }
    },
    [hooks, hookFileService, loadHooks]
  );

  /**
   * Delete a hook
   */
  const deleteHook = useCallback(
    async (hookId: string) => {
      try {
        const hook = hooks.find((h) => h.id === hookId);
        if (!hook) {
          throw new Error(`Hook not found: ${hookId}`);
        }

        // Check if hook is deletable
        if (hook.source === 'builtin') {
          throw new Error('Cannot delete built-in hooks');
        }

        // Delete hook file
        await hookFileService.deleteHook(hookId);

        // Remove from settings
        settingsService.removeHookSetting(hookId);

        // Refresh hooks list
        await loadHooks();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete hook';
        setError(errorMessage);
        throw err;
      }
    },
    [hooks, hookFileService, settingsService, loadHooks]
  );

  /**
   * Test a hook (dry-run simulation)
   */
  const testHook = useCallback(
    async (hookId: string): Promise<HookTestResult> => {
      try {
        const hook = hooks.find((h) => h.id === hookId);
        if (!hook) {
          throw new Error(`Hook not found: ${hookId}`);
        }

        // Simulate hook execution (dry-run mode)
        // In a real implementation, this would trigger the hook system
        // with a test flag to prevent actual execution

        // For now, just validate the hook structure
        const validation = hookFileService.validateHook({
          name: hook.name,
          version: hook.version,
          description: hook.description,
          when: hook.when,
          then: hook.then,
        });

        if (!validation.valid) {
          return {
            success: false,
            message: 'Hook validation failed',
            details: validation.errors.join(', '),
          };
        }

        // Simulate successful test
        return {
          success: true,
          message: 'Hook test passed',
          details: `Would trigger on: ${hook.when.type}${
            hook.when.patterns ? ` (${hook.when.patterns.join(', ')})` : ''
          }\nWould execute: ${hook.then.type} - ${hook.then.prompt || hook.then.command}`,
        };
      } catch (err) {
        return {
          success: false,
          message: 'Hook test failed',
          details: err instanceof Error ? err.message : 'Unknown error',
        };
      }
    },
    [hooks, hookFileService]
  );

  /**
   * Refresh hooks from file system
   */
  const refreshHooks = useCallback(async () => {
    await loadHooks();
  }, [loadHooks]);

  /**
   * Context value
   */
  const value: HooksContextValue = {
    hooks,
    categories,
    enabledHooks,
    loading,
    error,
    toggleHook,
    addHook,
    editHook,
    deleteHook,
    testHook,
    refreshHooks,
  };

  return <HooksContext.Provider value={value}>{children}</HooksContext.Provider>;
};

/**
 * Hook to access HooksContext
 * @throws Error if used outside HooksProvider
 */
export const useHooks = (): HooksContextValue => {
  const context = useContext(HooksContext);
  if (!context) {
    throw new Error('useHooks must be used within a HooksProvider');
  }
  return context;
};
